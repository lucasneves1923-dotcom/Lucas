'use strict';

// Valida pg-db.js contra um Postgres de verdade (nao o banco em memoria).
// Sobe a API de ponta a ponta sobre o driver real, batendo via HTTP, para
// provar que a troca do banco em mock-db.js.criarMockDb() por
// pg-db.js.criarPgDb() nao muda nenhum comportamento de api.js.
//
// Requer DATABASE_URL apontando para um Postgres com o schema.sql ja
// aplicado. Rode com `npm run test:pg`.

const { criarApp } = require('./api');
const { criarPgDb } = require('./pg-db');

const JWT_SECRET = 'segredo-de-teste-nao-usar-em-producao';
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://condo_test:condo_test_pw@127.0.0.1:5432/condo_test';

function assert(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem);
}
function assertEqual(atual, esperado, mensagem) {
  if (atual !== esperado) {
    throw new Error(`${mensagem} (esperado: ${JSON.stringify(esperado)}, obtido: ${JSON.stringify(atual)})`);
  }
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function chamar(base, metodo, caminho, { body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const resposta = await fetch(base + caminho, {
    method: metodo,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const texto = await resposta.text();
  return { status: resposta.status, json: texto ? JSON.parse(texto) : null };
}

async function limparTabelas(db) {
  // TRUNCATE ... CASCADE respeita as FKs; a tabela auditoria e append-only
  // (trigger bloqueia DELETE/UPDATE), entao ela precisa ser truncada
  // separadamente, direto pelo superusuario do pool de teste.
  await db.pool.query(
    'TRUNCATE aberturas, links_visitante, codigos_acesso, dispositivos, cameras, portoes, usuarios, condominios RESTART IDENTITY CASCADE'
  );
  await db.pool.query('ALTER TABLE auditoria DISABLE TRIGGER auditoria_append_only');
  await db.pool.query('TRUNCATE auditoria');
  await db.pool.query('ALTER TABLE auditoria ENABLE TRIGGER auditoria_append_only');
}

async function main() {
  const db = criarPgDb(DATABASE_URL);
  await limparTabelas(db);

  const codigosEnviados = new Map();
  const app = criarApp(db, {
    jwtSecret: JWT_SECRET,
    enviarCodigo: async (telefone, codigo) => codigosEnviados.set(telefone, codigo),
    acionarHardware: async () => {}
  });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  let passou = 0;
  let falhou = 0;
  const falhas = [];

  async function verificar(nome, fn) {
    try {
      await fn();
      passou += 1;
      console.log(`OK   - ${nome}`);
    } catch (err) {
      falhou += 1;
      falhas.push(nome);
      console.log(`FAIL - ${nome}`);
      console.log(`       ${err.message}`);
    }
  }

  const condominio = await db.condominios.criar({ nome: 'Jardim Aurora (pg)' });
  const portao = await db.portoes.criar({
    condominioId: condominio.id,
    nome: 'Portao Principal',
    tempoAberturaSeg: 0,
    tempoCooldownSeg: 1
  });
  const morador = await db.usuarios.criar({
    condominioId: condominio.id,
    nome: 'Ana Moradora',
    telefone: '+5511999990001',
    papel: 'morador'
  });
  const sindico = await db.usuarios.criar({
    condominioId: condominio.id,
    nome: 'Carlos Sindico',
    telefone: '+5511999990002',
    papel: 'sindico'
  });

  await verificar('schema real: criar/ler usuario preserva os campos esperados', async () => {
    const lido = await db.usuarios.buscarPorId(morador.id);
    assertEqual(lido.papel, 'morador', 'papel deveria ser morador');
    assertEqual(lido.pin_hash, null, 'morador nao deveria ter pin_hash');
  });

  await verificar('schema real: constraint impede PIN em morador', async () => {
    let falhouComoEsperado = false;
    try {
      await db.pool.query('UPDATE usuarios SET pin_hash = $2 WHERE id = $1', [morador.id, 'qualquer-hash']);
    } catch {
      falhouComoEsperado = true;
    }
    assert(falhouComoEsperado, 'o banco deveria rejeitar pin_hash em morador (CHECK pin_somente_sindico)');
  });

  await verificar('login do morador (OTP) funciona sobre o banco real', async () => {
    await chamar(base, 'POST', '/auth/morador/solicitar-codigo', { body: { telefone: morador.telefone } });
    const codigo = codigosEnviados.get(morador.telefone);
    const resp = await chamar(base, 'POST', '/auth/morador/verificar-codigo', {
      body: { telefone: morador.telefone, codigo }
    });
    assertEqual(resp.status, 200, 'login deveria funcionar');
  });

  await verificar('abrir portao e debounce funcionam sobre o banco real', async () => {
    const login = await chamar(base, 'POST', '/auth/morador/verificar-codigo', {
      body: { telefone: morador.telefone, codigo: codigosEnviados.get(morador.telefone) }
    });
    // codigo ja usado no teste anterior - pede um novo
    await chamar(base, 'POST', '/auth/morador/solicitar-codigo', { body: { telefone: morador.telefone } });
    const relogin = await chamar(base, 'POST', '/auth/morador/verificar-codigo', {
      body: { telefone: morador.telefone, codigo: codigosEnviados.get(morador.telefone) }
    });
    assertEqual(relogin.status, 200, 'novo login deveria funcionar');
    const token = relogin.json.token;

    const primeira = await chamar(base, 'POST', `/portao/${portao.id}/abrir`, { token });
    assertEqual(primeira.status, 200, 'primeira abertura deveria funcionar');
    const segunda = await chamar(base, 'POST', `/portao/${portao.id}/abrir`, { token });
    assertEqual(segunda.status, 429, 'segunda tentativa deveria ser bloqueada por cooldown (lido do Postgres)');
    await sleep(1200);
    const terceira = await chamar(base, 'POST', `/portao/${portao.id}/abrir`, { token });
    assertEqual(terceira.status, 200, 'depois do cooldown deveria abrir de novo');
  });

  await verificar('2FA do sindico + cadastro de morador + auditoria persistem no Postgres', async () => {
    // bootstrap: primeiro login sem PIN
    await chamar(base, 'POST', '/auth/sindico/solicitar-codigo', { body: { telefone: sindico.telefone } });
    const bootstrap = await chamar(base, 'POST', '/auth/sindico/verificar-codigo', {
      body: { telefone: sindico.telefone, codigo: codigosEnviados.get(sindico.telefone) }
    });
    assertEqual(bootstrap.status, 200, 'bootstrap sem PIN deveria funcionar');
    await chamar(base, 'POST', '/admin/definir-pin', { body: { pinNovo: '1234' }, token: bootstrap.json.token });

    await chamar(base, 'POST', '/auth/sindico/solicitar-codigo', { body: { telefone: sindico.telefone } });
    const login = await chamar(base, 'POST', '/auth/sindico/verificar-codigo', {
      body: { telefone: sindico.telefone, codigo: codigosEnviados.get(sindico.telefone), pin: '1234' }
    });
    assertEqual(login.status, 200, 'login completo com PIN deveria funcionar');

    const cadastro = await chamar(base, 'POST', '/admin/moradores', {
      body: { nome: 'Novo Morador', telefone: '+5511988887777' },
      token: login.json.token
    });
    assertEqual(cadastro.status, 201, 'cadastro deveria funcionar');

    const auditoria = await db.auditoria.listarPorCondominio(condominio.id);
    const registro = auditoria.find((a) => a.acao === 'cadastrar_morador');
    assert(registro, 'deveria existir registro de auditoria persistido no Postgres');

    let bloqueouDelete = false;
    try {
      await db.pool.query('DELETE FROM auditoria WHERE id = $1', [registro.id]);
    } catch {
      bloqueouDelete = true;
    }
    assert(bloqueouDelete, 'a trigger append-only deveria impedir apagar auditoria');
  });

  await new Promise((resolve) => server.close(resolve));
  await db.fechar();

  console.log('');
  console.log(`${passou} passaram, ${falhou} falharam, ${passou + falhou} no total (contra Postgres real)`);
  if (falhou > 0) {
    console.log('Falharam:', falhas.join(', '));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Erro ao rodar test-pg-db.js:', err);
  process.exit(1);
});
