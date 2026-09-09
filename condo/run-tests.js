'use strict';

// Runner de testes de integracao sem dependencias externas: sobe a API de
// verdade (Express) sobre o banco em memoria em uma porta efemera e bate
// nela via HTTP, exercitando exatamente os requisitos de seguranca do
// projeto. Rode com `npm test` ou `node run-tests.js`.

const { criarApp } = require('./api');
const { criarMockDb } = require('./mock-db');

const JWT_SECRET = 'segredo-de-teste-nao-usar-em-producao';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem);
}

function assertEqual(atual, esperado, mensagem) {
  if (atual !== esperado) {
    throw new Error(`${mensagem} (esperado: ${JSON.stringify(esperado)}, obtido: ${JSON.stringify(atual)})`);
  }
}

async function criarAmbiente() {
  const db = criarMockDb();
  const codigosEnviados = new Map();

  const condominio = await db.condominios.criar({ nome: 'Jardim Aurora' });
  const outroCondominio = await db.condominios.criar({ nome: 'Condominio Vizinho' });

  const portao = await db.portoes.criar({
    condominioId: condominio.id,
    nome: 'Portao Principal',
    tempoAberturaSeg: 0,
    tempoCooldownSeg: 1
  });
  const portaoDoOutroCondominio = await db.portoes.criar({
    condominioId: outroCondominio.id,
    nome: 'Portao Vizinho',
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

  const app = criarApp(db, {
    jwtSecret: JWT_SECRET,
    enviarCodigo: async (telefone, codigo) => {
      codigosEnviados.set(telefone, codigo);
    },
    acionarHardware: async () => {}
  });

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  return {
    db,
    server,
    base,
    codigosEnviados,
    condominio,
    outroCondominio,
    portao,
    portaoDoOutroCondominio,
    morador,
    sindico
  };
}

async function encerrarAmbiente(env) {
  await new Promise((resolve) => env.server.close(resolve));
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
  const json = texto ? JSON.parse(texto) : null;
  return { status: resposta.status, headers: resposta.headers, json };
}

async function loginMorador(env, telefone) {
  await chamar(env.base, 'POST', '/auth/morador/solicitar-codigo', { body: { telefone } });
  const codigo = env.codigosEnviados.get(telefone);
  const resp = await chamar(env.base, 'POST', '/auth/morador/verificar-codigo', { body: { telefone, codigo } });
  return resp;
}

async function loginSindicoPrimeiroFator(env, telefone) {
  await chamar(env.base, 'POST', '/auth/sindico/solicitar-codigo', { body: { telefone } });
  return env.codigosEnviados.get(telefone);
}

async function loginSindicoCompleto(env, telefone, pin) {
  const codigo = await loginSindicoPrimeiroFator(env, telefone);
  return chamar(env.base, 'POST', '/auth/sindico/verificar-codigo', { body: { telefone, codigo, pin } });
}

async function prepararSindicoComPin(env, pin = '1234') {
  const loginInicial = await loginSindicoCompleto(env, env.sindico.telefone, undefined);
  assertEqual(loginInicial.status, 200, 'login inicial do sindico sem PIN deveria funcionar (bootstrap)');
  const tokenBootstrap = loginInicial.json.token;
  const def = await chamar(env.base, 'POST', '/admin/definir-pin', {
    body: { pinNovo: pin },
    token: tokenBootstrap
  });
  assertEqual(def.status, 200, 'definir PIN inicial deveria funcionar');
  return tokenBootstrap;
}

const testes = [];
function teste(nome, fn) {
  testes.push({ nome, fn });
}

// --- Login do morador ------------------------------------------------

teste('morador: solicitar codigo para telefone cadastrado envia um codigo', async (env) => {
  const resp = await chamar(env.base, 'POST', '/auth/morador/solicitar-codigo', {
    body: { telefone: env.morador.telefone }
  });
  assertEqual(resp.status, 200, 'deveria responder 200');
  assert(env.codigosEnviados.has(env.morador.telefone), 'deveria ter enviado um codigo');
});

teste('morador: solicitar codigo para telefone nao cadastrado responde generico e nao envia nada', async (env) => {
  const resp = await chamar(env.base, 'POST', '/auth/morador/solicitar-codigo', {
    body: { telefone: '+5511900000000' }
  });
  assertEqual(resp.status, 200, 'nao deveria revelar que o telefone nao existe');
  assert(!env.codigosEnviados.has('+5511900000000'), 'nao deveria ter enviado codigo');
});

teste('morador: verificar codigo correto retorna token', async (env) => {
  const resp = await loginMorador(env, env.morador.telefone);
  assertEqual(resp.status, 200, 'login deveria funcionar');
  assert(typeof resp.json.token === 'string' && resp.json.token.length > 0, 'deveria retornar um token');
  assertEqual(resp.json.usuario.papel, 'morador', 'papel retornado deveria ser morador');
});

teste('morador: verificar codigo errado falha', async (env) => {
  await chamar(env.base, 'POST', '/auth/morador/solicitar-codigo', { body: { telefone: env.morador.telefone } });
  const resp = await chamar(env.base, 'POST', '/auth/morador/verificar-codigo', {
    body: { telefone: env.morador.telefone, codigo: '000000' }
  });
  assertEqual(resp.status, 401, 'codigo errado deveria falhar');
});

teste('morador: codigo expirado nao funciona mais', async (env) => {
  await chamar(env.base, 'POST', '/auth/morador/solicitar-codigo', { body: { telefone: env.morador.telefone } });
  const codigoRow = await env.db.codigosAcesso.maisRecenteValidoPara(env.morador.id);
  codigoRow.expira_em = new Date(Date.now() - 1000);
  const codigo = env.codigosEnviados.get(env.morador.telefone);
  const resp = await chamar(env.base, 'POST', '/auth/morador/verificar-codigo', {
    body: { telefone: env.morador.telefone, codigo }
  });
  assertEqual(resp.status, 401, 'codigo expirado deveria falhar');
});

teste('morador: codigo ja usado nao pode ser reaproveitado', async (env) => {
  const primeiro = await loginMorador(env, env.morador.telefone);
  assertEqual(primeiro.status, 200, 'primeiro login deveria funcionar');
  const codigo = env.codigosEnviados.get(env.morador.telefone);
  const segundo = await chamar(env.base, 'POST', '/auth/morador/verificar-codigo', {
    body: { telefone: env.morador.telefone, codigo }
  });
  assertEqual(segundo.status, 401, 'reuso do mesmo codigo deveria falhar');
});

teste('morador: conta de sindico nao consegue logar pela rota de morador', async (env) => {
  await chamar(env.base, 'POST', '/auth/morador/solicitar-codigo', { body: { telefone: env.sindico.telefone } });
  assert(!env.codigosEnviados.has(env.sindico.telefone), 'rota de morador nao deveria enviar codigo para um sindico');
});

// --- Abrir portao / debounce -----------------------------------------

teste('portao: morador autenticado consegue abrir o portao do seu condominio', async (env) => {
  const login = await loginMorador(env, env.morador.telefone);
  const resp = await chamar(env.base, 'POST', `/portao/${env.portao.id}/abrir`, { token: login.json.token });
  assertEqual(resp.status, 200, 'abertura deveria funcionar');
  assertEqual(resp.json.ok, true, 'resposta deveria indicar sucesso');
});

teste('portao: segunda tentativa dentro do cooldown e bloqueada com 429', async (env) => {
  const login = await loginMorador(env, env.morador.telefone);
  const primeira = await chamar(env.base, 'POST', `/portao/${env.portao.id}/abrir`, { token: login.json.token });
  assertEqual(primeira.status, 200, 'primeira abertura deveria funcionar');
  const segunda = await chamar(env.base, 'POST', `/portao/${env.portao.id}/abrir`, { token: login.json.token });
  assertEqual(segunda.status, 429, 'segunda tentativa deveria ser bloqueada por cooldown');
});

teste('portao: depois do cooldown terminar, o portao pode ser aberto de novo', async (env) => {
  const login = await loginMorador(env, env.morador.telefone);
  await chamar(env.base, 'POST', `/portao/${env.portao.id}/abrir`, { token: login.json.token });
  await sleep(1200);
  const resp = await chamar(env.base, 'POST', `/portao/${env.portao.id}/abrir`, { token: login.json.token });
  assertEqual(resp.status, 200, 'depois do cooldown deveria funcionar de novo');
});

teste('portao: morador nao consegue abrir portao de outro condominio', async (env) => {
  const login = await loginMorador(env, env.morador.telefone);
  const resp = await chamar(env.base, 'POST', `/portao/${env.portaoDoOutroCondominio.id}/abrir`, {
    token: login.json.token
  });
  assertEqual(resp.status, 404, 'portao de outro condominio deveria ser invisivel');
});

teste('portao: debounce vale mesmo chamando a API direto, sem passar pelo cooldown visual', async (env) => {
  const login = await loginMorador(env, env.morador.telefone);
  await chamar(env.base, 'POST', `/portao/${env.portao.id}/abrir`, { token: login.json.token });
  const segunda = await chamar(env.base, 'POST', `/portao/${env.portao.id}/abrir`, { token: login.json.token });
  assertEqual(segunda.status, 429, 'o backend precisa bloquear mesmo sem nenhum app envolvido');
  assert(segunda.headers.get('retry-after') !== null, 'deveria informar Retry-After');
});

// --- Link de visitante -------------------------------------------------

teste('visitante: link valido abre o portao', async (env) => {
  const login = await loginMorador(env, env.morador.telefone);
  const linkResp = await chamar(env.base, 'POST', '/visitantes/link', {
    body: { portaoId: env.portao.id, limiteUsos: 1, validadeMinutos: 60 },
    token: login.json.token
  });
  assertEqual(linkResp.status, 201, 'criacao do link deveria funcionar');
  const abertura = await chamar(env.base, 'POST', `/v/${linkResp.json.token}/abrir`, {});
  assertEqual(abertura.status, 200, 'abertura via link deveria funcionar');
});

teste('visitante: link expirado nao abre o portao', async (env) => {
  const login = await loginMorador(env, env.morador.telefone);
  const linkResp = await chamar(env.base, 'POST', '/visitantes/link', {
    body: { portaoId: env.portao.id, limiteUsos: 1, validadeMinutos: 5 },
    token: login.json.token
  });
  const linkRow = await env.db.linksVisitante.buscarPorToken(linkResp.json.token);
  linkRow.expira_em = new Date(Date.now() - 1000);
  const abertura = await chamar(env.base, 'POST', `/v/${linkResp.json.token}/abrir`, {});
  assertEqual(abertura.status, 410, 'link expirado deveria falhar');
});

teste('visitante: limite de usos excedido bloqueia novas aberturas', async (env) => {
  const login = await loginMorador(env, env.morador.telefone);
  const linkResp = await chamar(env.base, 'POST', '/visitantes/link', {
    body: { portaoId: env.portao.id, limiteUsos: 1, validadeMinutos: 60 },
    token: login.json.token
  });
  const primeira = await chamar(env.base, 'POST', `/v/${linkResp.json.token}/abrir`, {});
  assertEqual(primeira.status, 200, 'primeiro uso deveria funcionar');
  const segunda = await chamar(env.base, 'POST', `/v/${linkResp.json.token}/abrir`, {});
  assertEqual(segunda.status, 410, 'segundo uso deveria exceder o limite');
});

teste('visitante: link revogado nao abre o portao', async (env) => {
  const login = await loginMorador(env, env.morador.telefone);
  const linkResp = await chamar(env.base, 'POST', '/visitantes/link', {
    body: { portaoId: env.portao.id, limiteUsos: 5, validadeMinutos: 60 },
    token: login.json.token
  });
  const linkRow = await env.db.linksVisitante.buscarPorToken(linkResp.json.token);
  linkRow.revogado = true;
  const abertura = await chamar(env.base, 'POST', `/v/${linkResp.json.token}/abrir`, {});
  assertEqual(abertura.status, 410, 'link revogado deveria falhar');
});

teste('visitante: token invalido responde 404 sem vazar detalhes', async (env) => {
  const resp = await chamar(env.base, 'POST', '/v/token-que-nao-existe/abrir', {});
  assertEqual(resp.status, 404, 'token invalido deveria responder 404');
});

// --- Historico do morador ----------------------------------------------

teste('meu-historico: retorna apenas as aberturas do proprio usuario', async (env) => {
  const outroMorador = await env.db.usuarios.criar({
    condominioId: env.condominio.id,
    nome: 'Bruno Morador',
    telefone: '+5511999990099',
    papel: 'morador'
  });
  const loginAna = await loginMorador(env, env.morador.telefone);
  const loginBruno = await loginMorador(env, outroMorador.telefone);

  await chamar(env.base, 'POST', `/portao/${env.portao.id}/abrir`, { token: loginAna.json.token });
  await sleep(1200);
  await chamar(env.base, 'POST', `/portao/${env.portao.id}/abrir`, { token: loginBruno.json.token });

  const historico = await chamar(env.base, 'GET', '/meu-historico', { token: loginAna.json.token });
  assertEqual(historico.status, 200, 'deveria retornar 200');
  assertEqual(historico.json.length, 1, 'deveria ver so a propria abertura');
});

// --- Separacao de papel morador / sindico -------------------------------

teste('admin: rota de administracao sem token responde 401', async (env) => {
  const resp = await chamar(env.base, 'GET', '/admin/moradores', {});
  assertEqual(resp.status, 401, 'sem token deveria ser 401');
});

teste('admin: token de morador nao da acesso a rota de sindico', async (env) => {
  const login = await loginMorador(env, env.morador.telefone);
  const resp = await chamar(env.base, 'GET', '/admin/moradores', { token: login.json.token });
  assertEqual(resp.status, 403, 'morador nao pode acessar rota de sindico');
});

teste('morador: token de sindico nao da acesso as rotas do morador', async (env) => {
  await prepararSindicoComPin(env, '1234');
  const login = await loginSindicoCompleto(env, env.sindico.telefone, '1234');
  const resp = await chamar(env.base, 'POST', `/portao/${env.portao.id}/abrir`, { token: login.json.token });
  assertEqual(resp.status, 403, 'sindico nao pode usar a rota de abrir portao do morador');
});

// --- Login do sindico (2FA) --------------------------------------------

teste('sindico: login com codigo e PIN corretos funciona', async (env) => {
  await prepararSindicoComPin(env, '4321');
  const resp = await loginSindicoCompleto(env, env.sindico.telefone, '4321');
  assertEqual(resp.status, 200, 'login com os dois fatores corretos deveria funcionar');
  assertEqual(resp.json.usuario.papel, 'sindico', 'papel deveria ser sindico');
});

teste('sindico: codigo certo mas PIN errado falha', async (env) => {
  await prepararSindicoComPin(env, '4321');
  const resp = await loginSindicoCompleto(env, env.sindico.telefone, '0000');
  assertEqual(resp.status, 401, 'PIN errado deveria falhar mesmo com codigo certo');
});

teste('sindico: PIN certo mas codigo errado falha', async (env) => {
  await prepararSindicoComPin(env, '4321');
  await chamar(env.base, 'POST', '/auth/sindico/solicitar-codigo', { body: { telefone: env.sindico.telefone } });
  const resp = await chamar(env.base, 'POST', '/auth/sindico/verificar-codigo', {
    body: { telefone: env.sindico.telefone, codigo: '000000', pin: '4321' }
  });
  assertEqual(resp.status, 401, 'codigo errado deveria falhar mesmo com PIN certo');
});

teste('sindico: sem PIN configurado, so consegue acessar /admin/definir-pin', async (env) => {
  const login = await loginSindicoCompleto(env, env.sindico.telefone, undefined);
  assertEqual(login.status, 200, 'login inicial sem PIN deveria funcionar (bootstrap)');
  const historico = await chamar(env.base, 'GET', '/admin/historico', { token: login.json.token });
  assertEqual(historico.status, 403, 'sem PIN configurado nao pode usar outras rotas de admin');
});

// --- Rotas administrativas -----------------------------------------------

teste('admin: sindico consegue cadastrar um morador', async (env) => {
  await prepararSindicoComPin(env, '1234');
  const login = await loginSindicoCompleto(env, env.sindico.telefone, '1234');
  const resp = await chamar(env.base, 'POST', '/admin/moradores', {
    body: { nome: 'Novo Morador', telefone: '+5511988887777' },
    token: login.json.token
  });
  assertEqual(resp.status, 201, 'cadastro deveria funcionar');
  assertEqual(resp.json.papel, 'morador', 'novo usuario deveria ser morador');
});

teste('admin: papel enviado no corpo da requisicao e ignorado ao cadastrar morador', async (env) => {
  await prepararSindicoComPin(env, '1234');
  const login = await loginSindicoCompleto(env, env.sindico.telefone, '1234');
  const resp = await chamar(env.base, 'POST', '/admin/moradores', {
    body: { nome: 'Tentando Escalar', telefone: '+5511977776666', papel: 'sindico' },
    token: login.json.token
  });
  assertEqual(resp.status, 201, 'cadastro deveria funcionar');
  assertEqual(resp.json.papel, 'morador', 'papel deveria ser sempre morador, ignorando o corpo da requisicao');
});

teste('admin: revogar morador o torna inativo e ele nao consegue mais logar', async (env) => {
  await prepararSindicoComPin(env, '1234');
  const loginSindico = await loginSindicoCompleto(env, env.sindico.telefone, '1234');
  const revogar = await chamar(env.base, 'POST', `/admin/moradores/${env.morador.id}/revogar`, {
    token: loginSindico.json.token
  });
  assertEqual(revogar.status, 200, 'revogacao deveria funcionar');

  const solicitacao = await chamar(env.base, 'POST', '/auth/morador/solicitar-codigo', {
    body: { telefone: env.morador.telefone }
  });
  assertEqual(solicitacao.status, 200, 'resposta deveria continuar generica mesmo para morador revogado');
  assert(!env.codigosEnviados.has(env.morador.telefone), 'morador revogado nao deveria receber codigo');
});

teste('admin: historico mostra apenas aberturas do proprio condominio', async (env) => {
  const outroMorador = await env.db.usuarios.criar({
    condominioId: env.outroCondominio.id,
    nome: 'Morador Vizinho',
    telefone: '+5511999991234',
    papel: 'morador'
  });
  const loginVizinho = await loginMorador(env, outroMorador.telefone);
  await chamar(env.base, 'POST', `/portao/${env.portaoDoOutroCondominio.id}/abrir`, {
    token: loginVizinho.json.token
  });

  const loginAna = await loginMorador(env, env.morador.telefone);
  await chamar(env.base, 'POST', `/portao/${env.portao.id}/abrir`, { token: loginAna.json.token });

  await prepararSindicoComPin(env, '1234');
  const loginSindico = await loginSindicoCompleto(env, env.sindico.telefone, '1234');
  const historico = await chamar(env.base, 'GET', '/admin/historico', { token: loginSindico.json.token });
  assertEqual(historico.status, 200, 'deveria retornar 200');
  assertEqual(historico.json.length, 1, 'sindico so deveria ver o historico do seu proprio condominio');
});

teste('admin: cadastrar morador gera registro de auditoria', async (env) => {
  await prepararSindicoComPin(env, '1234');
  const loginSindico = await loginSindicoCompleto(env, env.sindico.telefone, '1234');
  await chamar(env.base, 'POST', '/admin/moradores', {
    body: { nome: 'Auditado', telefone: '+5511955554444' },
    token: loginSindico.json.token
  });
  const registros = await env.db.auditoria.listarPorCondominio(env.condominio.id);
  const encontrado = registros.find((r) => r.acao === 'cadastrar_morador');
  assert(encontrado, 'deveria existir um registro de auditoria para o cadastro');
  assertEqual(encontrado.usuario_id, env.sindico.id, 'auditoria deveria registrar quem fez a acao');
});

teste('admin: revogar morador gera registro de auditoria', async (env) => {
  await prepararSindicoComPin(env, '1234');
  const loginSindico = await loginSindicoCompleto(env, env.sindico.telefone, '1234');
  await chamar(env.base, 'POST', `/admin/moradores/${env.morador.id}/revogar`, { token: loginSindico.json.token });
  const registros = await env.db.auditoria.listarPorCondominio(env.condominio.id);
  const encontrado = registros.find((r) => r.acao === 'revogar_morador');
  assert(encontrado, 'deveria existir um registro de auditoria para a revogacao');
});

teste('admin: relatorio de anomalias responde com a estrutura esperada', async (env) => {
  await prepararSindicoComPin(env, '1234');
  const loginSindico = await loginSindicoCompleto(env, env.sindico.telefone, '1234');
  const resp = await chamar(env.base, 'GET', '/admin/relatorios/anomalias', { token: loginSindico.json.token });
  assertEqual(resp.status, 200, 'relatorio deveria funcionar');
  assert(Array.isArray(resp.json.anomalias.aberturasForaDeHorario), 'deveria trazer a lista de fora de horario');
  assert(Array.isArray(resp.json.anomalias.usuariosComTentativasRepetidas), 'deveria trazer tentativas repetidas');
});

async function main() {
  let passou = 0;
  let falhou = 0;

  for (const { nome, fn } of testes) {
    const env = await criarAmbiente();
    try {
      await fn(env);
      passou += 1;
      console.log(`OK   - ${nome}`);
    } catch (err) {
      falhou += 1;
      console.log(`FAIL - ${nome}`);
      console.log(`       ${err.message}`);
    } finally {
      await encerrarAmbiente(env);
    }
  }

  console.log('');
  console.log(`${passou} passaram, ${falhou} falharam, ${testes.length} no total`);
  if (falhou > 0) process.exit(1);
}

main();
