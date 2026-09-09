'use strict';

// API do sistema de controle de acesso. Duas regras nunca podem ser
// quebradas aqui, em nenhuma refatoracao futura:
//
//   1. O papel do usuario (morador/sindico) e SEMPRE lido do banco, nunca
//      do token JWT nem do corpo da requisicao. O JWT so carrega o id do
//      usuario; tudo o mais e reconferido a cada chamada.
//   2. Nenhuma rota de administracao aceita um "papel" vindo do cliente -
//      cadastro de morador, por exemplo, e sempre criado com papel fixo
//      no codigo, nunca lido do body.

const crypto = require('crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const OTP_TTL_MS = 5 * 60 * 1000; // codigo valido por 5 minutos
const OTP_MAX_TENTATIVAS = 5;
const TOKEN_TTL = '12h';
const PIN_REGEX = /^\d{4,6}$/;

function gerarCodigoOtp() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function gerarTokenVisitante() {
  return crypto.randomBytes(24).toString('hex');
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function sanitizarUsuario(usuario) {
  return {
    id: usuario.id,
    nome: usuario.nome,
    telefone: usuario.telefone,
    papel: usuario.papel,
    ativo: usuario.ativo,
    pinConfigurado: usuario.pin_hash != null
  };
}

async function checarCooldown(db, portao) {
  const ultima = await db.aberturas.ultimaComSucessoPara(portao.id);
  if (!ultima) return { bloqueado: false };
  const cicloMs = (portao.tempo_abertura_seg + portao.tempo_cooldown_seg) * 1000;
  const decorridoMs = Date.now() - new Date(ultima.criado_em).getTime();
  if (decorridoMs < cicloMs) {
    return { bloqueado: true, restanteSeg: Math.ceil((cicloMs - decorridoMs) / 1000) };
  }
  return { bloqueado: false };
}

/**
 * @param {object} db implementacao de mock-db.js ou do driver real de Postgres
 * @param {object} [opts]
 * @param {string} [opts.jwtSecret]
 * @param {(telefone: string, codigo: string, canal: string) => Promise<void>} [opts.enviarCodigo]
 * @param {(portao: object) => Promise<void>} [opts.acionarHardware]
 */
function criarApp(db, opts = {}) {
  const jwtSecret = opts.jwtSecret || process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET nao configurado');
  }
  const enviarCodigo =
    opts.enviarCodigo ||
    (async (telefone, codigo, canal) => {
      // eslint-disable-next-line no-console
      console.log(`[dev] enviando codigo ${codigo} para ${telefone} via ${canal}`);
    });
  const acionarHardware =
    opts.acionarHardware ||
    (async (portao) => {
      // Placeholder: em producao isso publica no topico MQTT do dispositivo
      // do portao. A implementacao real entra quando o broker MQTT for
      // contratado (ver README/proximos passos).
      // eslint-disable-next-line no-console
      console.log(`[dev] acionando hardware do portao ${portao.id} (placeholder)`);
    });

  const app = express();
  app.use(express.json());

  // ---------------------------------------------------------------------
  // Autenticacao
  // ---------------------------------------------------------------------

  const autenticarUsuario = asyncHandler(async (req, res, next) => {
    const header = req.headers.authorization || '';
    const [tipo, token] = header.split(' ');
    if (tipo !== 'Bearer' || !token) {
      return res.status(401).json({ erro: 'nao autenticado' });
    }
    let payload;
    try {
      payload = jwt.verify(token, jwtSecret);
    } catch {
      return res.status(401).json({ erro: 'token invalido ou expirado' });
    }
    const usuario = await db.usuarios.buscarPorId(payload.sub);
    if (!usuario || !usuario.ativo) {
      return res.status(401).json({ erro: 'nao autenticado' });
    }
    // req.usuario e sempre uma leitura fresca do banco desta requisicao;
    // nunca e derivado do conteudo do token alem do id.
    req.usuario = usuario;
    next();
  });

  function exigirPapel(papel) {
    return asyncHandler(async (req, res, next) => {
      if (!req.usuario) {
        return res.status(401).json({ erro: 'nao autenticado' });
      }
      // Reconfere direto no banco, independente do que uma middleware
      // anterior tenha deixado em req.usuario - protege contra qualquer
      // reordenacao futura de rotas/middlewares.
      const usuarioAtual = await db.usuarios.buscarPorId(req.usuario.id);
      if (!usuarioAtual || !usuarioAtual.ativo || usuarioAtual.papel !== papel) {
        return res.status(403).json({ erro: 'acesso negado' });
      }
      req.usuario = usuarioAtual;
      next();
    });
  }

  const exigirMorador = exigirPapel('morador');
  const exigirSindico = exigirPapel('sindico');

  const exigirSindicoComPinConfigurado = asyncHandler(async (req, res, next) => {
    exigirSindico(req, res, async (err) => {
      if (err) return next(err);
      if (req.usuario.pin_hash == null) {
        return res.status(403).json({ erro: 'defina um PIN de administrador antes de continuar' });
      }
      next();
    });
  });

  // ---------------------------------------------------------------------
  // Login - morador (1 fator: codigo por SMS/WhatsApp)
  // ---------------------------------------------------------------------

  app.post(
    '/auth/morador/solicitar-codigo',
    asyncHandler(async (req, res) => {
      const { telefone } = req.body || {};
      if (!telefone) return res.status(400).json({ erro: 'telefone obrigatorio' });

      const candidatos = await db.usuarios.buscarPorTelefoneEmQualquerCondominio(telefone);
      const usuario = candidatos.find((u) => u.papel === 'morador' && u.ativo);
      if (usuario) {
        const codigo = gerarCodigoOtp();
        const codigoHash = await bcrypt.hash(codigo, 10);
        await db.codigosAcesso.criar({
          usuarioId: usuario.id,
          codigoHash,
          canal: 'sms',
          expiraEm: new Date(Date.now() + OTP_TTL_MS)
        });
        await enviarCodigo(usuario.telefone, codigo, 'sms');
      }
      // Resposta identica exista ou nao o usuario, para nao revelar quem
      // esta cadastrado.
      res.json({ ok: true, mensagem: 'Se o telefone estiver cadastrado, um codigo foi enviado.' });
    })
  );

  app.post(
    '/auth/morador/verificar-codigo',
    asyncHandler(async (req, res) => {
      const { telefone, codigo } = req.body || {};
      if (!telefone || !codigo) return res.status(400).json({ erro: 'telefone e codigo obrigatorios' });

      const candidatos = await db.usuarios.buscarPorTelefoneEmQualquerCondominio(telefone);
      const usuario = candidatos.find((u) => u.papel === 'morador' && u.ativo);
      if (!usuario) return res.status(401).json({ erro: 'credenciais invalidas' });

      const codigoRow = await db.codigosAcesso.maisRecenteValidoPara(usuario.id);
      if (!codigoRow || codigoRow.tentativas >= OTP_MAX_TENTATIVAS) {
        return res.status(401).json({ erro: 'credenciais invalidas' });
      }

      const confere = await bcrypt.compare(codigo, codigoRow.codigo_hash);
      if (!confere) {
        await db.codigosAcesso.registrarTentativa(codigoRow.id);
        return res.status(401).json({ erro: 'credenciais invalidas' });
      }

      await db.codigosAcesso.marcarUsado(codigoRow.id);
      const token = jwt.sign({ sub: usuario.id }, jwtSecret, { expiresIn: TOKEN_TTL });
      res.json({ token, usuario: sanitizarUsuario(usuario) });
    })
  );

  // ---------------------------------------------------------------------
  // Login - sindico (2 fatores: codigo + PIN)
  // ---------------------------------------------------------------------

  app.post(
    '/auth/sindico/solicitar-codigo',
    asyncHandler(async (req, res) => {
      const { telefone } = req.body || {};
      if (!telefone) return res.status(400).json({ erro: 'telefone obrigatorio' });

      const candidatos = await db.usuarios.buscarPorTelefoneEmQualquerCondominio(telefone);
      const usuario = candidatos.find((u) => u.papel === 'sindico' && u.ativo);
      if (usuario) {
        const codigo = gerarCodigoOtp();
        const codigoHash = await bcrypt.hash(codigo, 10);
        await db.codigosAcesso.criar({
          usuarioId: usuario.id,
          codigoHash,
          canal: 'whatsapp',
          expiraEm: new Date(Date.now() + OTP_TTL_MS)
        });
        await enviarCodigo(usuario.telefone, codigo, 'whatsapp');
      }
      res.json({ ok: true, mensagem: 'Se o telefone estiver cadastrado, um codigo foi enviado.' });
    })
  );

  app.post(
    '/auth/sindico/verificar-codigo',
    asyncHandler(async (req, res) => {
      const { telefone, codigo, pin } = req.body || {};
      if (!telefone || !codigo) return res.status(400).json({ erro: 'telefone e codigo obrigatorios' });

      const candidatos = await db.usuarios.buscarPorTelefoneEmQualquerCondominio(telefone);
      const usuario = candidatos.find((u) => u.papel === 'sindico' && u.ativo);
      if (!usuario) return res.status(401).json({ erro: 'credenciais invalidas' });

      const codigoRow = await db.codigosAcesso.maisRecenteValidoPara(usuario.id);
      if (!codigoRow || codigoRow.tentativas >= OTP_MAX_TENTATIVAS) {
        return res.status(401).json({ erro: 'credenciais invalidas' });
      }

      const codigoConfere = await bcrypt.compare(codigo, codigoRow.codigo_hash);
      if (!codigoConfere) {
        await db.codigosAcesso.registrarTentativa(codigoRow.id);
        return res.status(401).json({ erro: 'credenciais invalidas' });
      }

      // Segundo fator: PIN. So e exigido se ja existir um configurado -
      // um sindico recem-cadastrado via seed ainda nao tem PIN e precisa
      // primeiro definir um (ver /admin/definir-pin), mas so depois de
      // provar o primeiro fator.
      if (usuario.pin_hash != null) {
        const pinConfere = typeof pin === 'string' && (await bcrypt.compare(pin, usuario.pin_hash));
        if (!pinConfere) {
          await db.codigosAcesso.registrarTentativa(codigoRow.id);
          return res.status(401).json({ erro: 'credenciais invalidas' });
        }
      }

      await db.codigosAcesso.marcarUsado(codigoRow.id);
      const token = jwt.sign({ sub: usuario.id }, jwtSecret, { expiresIn: TOKEN_TTL });
      res.json({ token, usuario: sanitizarUsuario(usuario) });
    })
  );

  // ---------------------------------------------------------------------
  // Rotas do morador
  // ---------------------------------------------------------------------

  app.post(
    '/portao/:portaoId/abrir',
    autenticarUsuario,
    exigirMorador,
    asyncHandler(async (req, res) => {
      const portao = await db.portoes.buscarPorId(req.params.portaoId);
      if (!portao || portao.condominio_id !== req.usuario.condominio_id) {
        return res.status(404).json({ erro: 'portao nao encontrado' });
      }

      const cooldown = await checarCooldown(db, portao);
      if (cooldown.bloqueado) {
        await db.aberturas.criar({
          portaoId: portao.id,
          usuarioId: req.usuario.id,
          origem: 'morador',
          resultado: 'bloqueado_cooldown'
        });
        res.set('Retry-After', String(cooldown.restanteSeg));
        return res.status(429).json({ erro: 'portao em cooldown', restanteSeg: cooldown.restanteSeg });
      }

      try {
        await acionarHardware(portao);
      } catch {
        await db.aberturas.criar({
          portaoId: portao.id,
          usuarioId: req.usuario.id,
          origem: 'morador',
          resultado: 'erro'
        });
        return res.status(502).json({ erro: 'falha ao acionar o portao' });
      }

      await db.aberturas.criar({
        portaoId: portao.id,
        usuarioId: req.usuario.id,
        origem: 'morador',
        resultado: 'sucesso'
      });
      res.json({
        ok: true,
        tempoAberturaSeg: portao.tempo_abertura_seg,
        tempoCooldownSeg: portao.tempo_cooldown_seg
      });
    })
  );

  app.post(
    '/visitantes/link',
    autenticarUsuario,
    exigirMorador,
    asyncHandler(async (req, res) => {
      const { portaoId } = req.body || {};
      const portao = await db.portoes.buscarPorId(portaoId);
      if (!portao || portao.condominio_id !== req.usuario.condominio_id) {
        return res.status(404).json({ erro: 'portao nao encontrado' });
      }

      const validadeMinutos = Math.min(Math.max(Number(req.body?.validadeMinutos) || 60, 5), 24 * 60);
      const limiteUsos = Math.min(Math.max(Number(req.body?.limiteUsos) || 1, 1), 20);

      const link = await db.linksVisitante.criar({
        portaoId: portao.id,
        criadoPorUsuarioId: req.usuario.id,
        token: gerarTokenVisitante(),
        limiteUsos,
        expiraEm: new Date(Date.now() + validadeMinutos * 60 * 1000)
      });

      res.status(201).json({
        token: link.token,
        caminho: `/v/${link.token}/abrir`,
        expiraEm: link.expira_em,
        limiteUsos: link.limite_usos
      });
    })
  );

  app.get(
    '/meu-historico',
    autenticarUsuario,
    exigirMorador,
    asyncHandler(async (req, res) => {
      const aberturas = await db.aberturas.listarPorUsuario(req.usuario.id);
      res.json(aberturas);
    })
  );

  // ---------------------------------------------------------------------
  // Rota publica de visitante (sem autenticacao - protegida pelo token
  // aleatorio do link, expiracao e limite de usos)
  // ---------------------------------------------------------------------

  app.post(
    '/v/:token/abrir',
    asyncHandler(async (req, res) => {
      const link = await db.linksVisitante.buscarPorToken(req.params.token);
      if (!link) return res.status(404).json({ erro: 'link invalido' });
      if (link.revogado) return res.status(410).json({ erro: 'link revogado' });
      if (new Date(link.expira_em) < new Date()) return res.status(410).json({ erro: 'link expirado' });
      if (link.usos_realizados >= link.limite_usos) {
        return res.status(410).json({ erro: 'limite de usos atingido' });
      }

      const portao = await db.portoes.buscarPorId(link.portao_id);
      if (!portao) return res.status(404).json({ erro: 'portao nao encontrado' });

      const cooldown = await checarCooldown(db, portao);
      if (cooldown.bloqueado) {
        await db.aberturas.criar({
          portaoId: portao.id,
          linkVisitanteId: link.id,
          origem: 'visitante',
          resultado: 'bloqueado_cooldown'
        });
        res.set('Retry-After', String(cooldown.restanteSeg));
        return res.status(429).json({ erro: 'portao em cooldown', restanteSeg: cooldown.restanteSeg });
      }

      try {
        await acionarHardware(portao);
      } catch {
        await db.aberturas.criar({
          portaoId: portao.id,
          linkVisitanteId: link.id,
          origem: 'visitante',
          resultado: 'erro'
        });
        return res.status(502).json({ erro: 'falha ao acionar o portao' });
      }

      await db.linksVisitante.incrementarUso(link.id);
      await db.aberturas.criar({
        portaoId: portao.id,
        linkVisitanteId: link.id,
        origem: 'visitante',
        resultado: 'sucesso'
      });
      res.json({ ok: true });
    })
  );

  // ---------------------------------------------------------------------
  // Rotas do sindico
  // ---------------------------------------------------------------------

  app.post(
    '/admin/definir-pin',
    autenticarUsuario,
    exigirSindico,
    asyncHandler(async (req, res) => {
      const { pinAtual, pinNovo } = req.body || {};
      if (!PIN_REGEX.test(pinNovo || '')) {
        return res.status(400).json({ erro: 'PIN deve ter entre 4 e 6 digitos' });
      }
      if (req.usuario.pin_hash != null) {
        const confere = typeof pinAtual === 'string' && (await bcrypt.compare(pinAtual, req.usuario.pin_hash));
        if (!confere) return res.status(401).json({ erro: 'PIN atual incorreto' });
      }
      const novoHash = await bcrypt.hash(pinNovo, 10);
      await db.usuarios.definirPinHash(req.usuario.id, novoHash);
      await db.auditoria.registrar({
        condominioId: req.usuario.condominio_id,
        usuarioId: req.usuario.id,
        acao: 'definir_pin',
        detalhes: {}
      });
      res.json({ ok: true });
    })
  );

  app.post(
    '/admin/moradores',
    autenticarUsuario,
    exigirSindicoComPinConfigurado,
    asyncHandler(async (req, res) => {
      const { nome, telefone } = req.body || {};
      if (!nome || !telefone) return res.status(400).json({ erro: 'nome e telefone obrigatorios' });

      const existente = await db.usuarios.buscarPorTelefone(req.usuario.condominio_id, telefone);
      if (existente) return res.status(409).json({ erro: 'ja existe um usuario com esse telefone neste condominio' });

      // papel e sempre 'morador' aqui - o corpo da requisicao nunca e lido
      // para decidir isso, mesmo que alguem envie { papel: 'sindico' }.
      const morador = await db.usuarios.criar({
        condominioId: req.usuario.condominio_id,
        nome,
        telefone,
        papel: 'morador'
      });

      await db.auditoria.registrar({
        condominioId: req.usuario.condominio_id,
        usuarioId: req.usuario.id,
        acao: 'cadastrar_morador',
        detalhes: { moradorId: morador.id, telefone: morador.telefone }
      });

      res.status(201).json(sanitizarUsuario(morador));
    })
  );

  app.get(
    '/admin/moradores',
    autenticarUsuario,
    exigirSindicoComPinConfigurado,
    asyncHandler(async (req, res) => {
      const usuarios = await db.usuarios.listarPorCondominio(req.usuario.condominio_id);
      res.json(usuarios.filter((u) => u.papel === 'morador').map(sanitizarUsuario));
    })
  );

  app.post(
    '/admin/moradores/:id/revogar',
    autenticarUsuario,
    exigirSindicoComPinConfigurado,
    asyncHandler(async (req, res) => {
      const alvo = await db.usuarios.buscarPorId(req.params.id);
      if (!alvo || alvo.condominio_id !== req.usuario.condominio_id || alvo.papel !== 'morador') {
        return res.status(404).json({ erro: 'morador nao encontrado' });
      }
      await db.usuarios.definirAtivo(alvo.id, false);
      await db.auditoria.registrar({
        condominioId: req.usuario.condominio_id,
        usuarioId: req.usuario.id,
        acao: 'revogar_morador',
        detalhes: { moradorId: alvo.id }
      });
      res.json({ ok: true });
    })
  );

  app.get(
    '/admin/historico',
    autenticarUsuario,
    exigirSindicoComPinConfigurado,
    asyncHandler(async (req, res) => {
      const portoes = await db.portoes.listarPorCondominio(req.usuario.condominio_id);
      let aberturas = await db.aberturas.listarPorCondominio(req.usuario.condominio_id, portoes);

      const { usuarioId, portaoId, desde, ate } = req.query;
      if (usuarioId) aberturas = aberturas.filter((a) => a.usuario_id === usuarioId);
      if (portaoId) aberturas = aberturas.filter((a) => a.portao_id === portaoId);
      if (desde) aberturas = aberturas.filter((a) => new Date(a.criado_em) >= new Date(String(desde)));
      if (ate) aberturas = aberturas.filter((a) => new Date(a.criado_em) <= new Date(String(ate)));

      res.json(aberturas);
    })
  );

  app.get(
    '/admin/relatorios/anomalias',
    autenticarUsuario,
    exigirSindicoComPinConfigurado,
    asyncHandler(async (req, res) => {
      const dias = Math.min(Math.max(Number(req.query.dias) || 30, 1), 365);
      const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

      const portoes = await db.portoes.listarPorCondominio(req.usuario.condominio_id);
      const aberturas = (await db.aberturas.listarPorCondominio(req.usuario.condominio_id, portoes)).filter(
        (a) => new Date(a.criado_em) >= desde
      );

      const foraDeHorario = aberturas.filter((a) => {
        const hora = new Date(a.criado_em).getHours();
        return a.resultado === 'sucesso' && (hora < 5 || hora >= 23);
      });

      const bloqueiosPorUsuario = new Map();
      for (const a of aberturas) {
        if (a.resultado !== 'bloqueado_cooldown' || !a.usuario_id) continue;
        bloqueiosPorUsuario.set(a.usuario_id, (bloqueiosPorUsuario.get(a.usuario_id) || 0) + 1);
      }
      const usuariosComTentativasRepetidas = [...bloqueiosPorUsuario.entries()]
        .filter(([, total]) => total >= 3)
        .map(([usuarioId, total]) => ({ usuarioId, tentativasBloqueadas: total }));

      res.json({
        periodo: { desde, dias },
        totalAberturas: aberturas.length,
        anomalias: {
          aberturasForaDeHorario: foraDeHorario,
          usuariosComTentativasRepetidas
        }
      });
    })
  );

  app.get('/saude', (req, res) => res.json({ ok: true }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ erro: 'erro interno' });
  });

  return app;
}

module.exports = { criarApp, checarCooldown, gerarCodigoOtp, gerarTokenVisitante };
