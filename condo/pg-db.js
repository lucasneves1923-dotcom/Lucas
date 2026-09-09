'use strict';

// Driver real de Postgres. Implementa exatamente a mesma interface
// assincrona que mock-db.js expoe, para que api.js funcione identico nos
// dois casos - so troca em server.js qual dos dois e usado.
//
// Testado localmente contra um Postgres de verdade (ver
// test-pg-db.js); ao apontar DATABASE_URL para o projeto Supabase, o
// mesmo codigo funciona sem nenhuma mudanca, porque Supabase e Postgres.

const { Pool } = require('pg');

function criarPgDb(connectionStringOuConfig) {
  const pool = new Pool(
    typeof connectionStringOuConfig === 'string'
      ? { connectionString: connectionStringOuConfig }
      : connectionStringOuConfig
  );

  async function linha(sql, params) {
    const { rows } = await pool.query(sql, params);
    return rows[0] || null;
  }

  async function linhas(sql, params) {
    const { rows } = await pool.query(sql, params);
    return rows;
  }

  return {
    pool,
    async fechar() {
      await pool.end();
    },

    condominios: {
      async criar({ nome, endereco }) {
        return linha('INSERT INTO condominios (nome, endereco) VALUES ($1, $2) RETURNING *', [
          nome,
          endereco || null
        ]);
      }
    },

    usuarios: {
      async criar({ condominioId, nome, telefone, papel }) {
        return linha(
          'INSERT INTO usuarios (condominio_id, nome, telefone, papel) VALUES ($1, $2, $3, $4) RETURNING *',
          [condominioId, nome, telefone, papel || 'morador']
        );
      },
      async buscarPorId(id) {
        return linha('SELECT * FROM usuarios WHERE id = $1', [id]);
      },
      async buscarPorTelefone(condominioId, telefone) {
        return linha('SELECT * FROM usuarios WHERE condominio_id = $1 AND telefone = $2', [
          condominioId,
          telefone
        ]);
      },
      async buscarPorTelefoneEmQualquerCondominio(telefone) {
        return linhas('SELECT * FROM usuarios WHERE telefone = $1', [telefone]);
      },
      async listarPorCondominio(condominioId) {
        return linhas('SELECT * FROM usuarios WHERE condominio_id = $1 ORDER BY criado_em', [condominioId]);
      },
      async definirAtivo(id, ativo) {
        return linha('UPDATE usuarios SET ativo = $2 WHERE id = $1 RETURNING *', [id, ativo]);
      },
      async definirPinHash(id, pinHash) {
        return linha('UPDATE usuarios SET pin_hash = $2 WHERE id = $1 RETURNING *', [id, pinHash]);
      }
    },

    codigosAcesso: {
      async criar({ usuarioId, codigoHash, canal, expiraEm }) {
        return linha(
          'INSERT INTO codigos_acesso (usuario_id, codigo_hash, canal, expira_em) VALUES ($1, $2, $3, $4) RETURNING *',
          [usuarioId, codigoHash, canal || 'sms', expiraEm]
        );
      },
      async maisRecenteValidoPara(usuarioId) {
        return linha(
          `SELECT * FROM codigos_acesso
             WHERE usuario_id = $1 AND usado = false AND expira_em > now()
             ORDER BY criado_em DESC LIMIT 1`,
          [usuarioId]
        );
      },
      async registrarTentativa(id) {
        return linha('UPDATE codigos_acesso SET tentativas = tentativas + 1 WHERE id = $1 RETURNING *', [id]);
      },
      async marcarUsado(id) {
        return linha('UPDATE codigos_acesso SET usado = true WHERE id = $1 RETURNING *', [id]);
      }
    },

    portoes: {
      async criar({ condominioId, nome, tempoAberturaSeg, tempoCooldownSeg }) {
        return linha(
          `INSERT INTO portoes (condominio_id, nome, tempo_abertura_seg, tempo_cooldown_seg)
             VALUES ($1, $2, $3, $4) RETURNING *`,
          [condominioId, nome, tempoAberturaSeg ?? 15, tempoCooldownSeg ?? 20]
        );
      },
      async buscarPorId(id) {
        return linha('SELECT * FROM portoes WHERE id = $1', [id]);
      },
      async listarPorCondominio(condominioId) {
        return linhas('SELECT * FROM portoes WHERE condominio_id = $1', [condominioId]);
      }
    },

    linksVisitante: {
      async criar({ portaoId, criadoPorUsuarioId, token, limiteUsos, expiraEm }) {
        return linha(
          `INSERT INTO links_visitante (portao_id, criado_por_usuario_id, token, limite_usos, expira_em)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [portaoId, criadoPorUsuarioId, token, limiteUsos, expiraEm]
        );
      },
      async buscarPorToken(token) {
        return linha('SELECT * FROM links_visitante WHERE token = $1', [token]);
      },
      async incrementarUso(id) {
        return linha('UPDATE links_visitante SET usos_realizados = usos_realizados + 1 WHERE id = $1 RETURNING *', [
          id
        ]);
      }
    },

    aberturas: {
      async criar({ portaoId, usuarioId, linkVisitanteId, origem, resultado }) {
        return linha(
          `INSERT INTO aberturas (portao_id, usuario_id, link_visitante_id, origem, resultado)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [portaoId, usuarioId || null, linkVisitanteId || null, origem, resultado]
        );
      },
      async ultimaComSucessoPara(portaoId) {
        return linha(
          `SELECT * FROM aberturas WHERE portao_id = $1 AND resultado = 'sucesso'
             ORDER BY criado_em DESC LIMIT 1`,
          [portaoId]
        );
      },
      async listarPorUsuario(usuarioId) {
        return linhas('SELECT * FROM aberturas WHERE usuario_id = $1 ORDER BY criado_em DESC', [usuarioId]);
      },
      async listarPorCondominio(condominioId, portoesDoCondominio) {
        const idsPortoes = portoesDoCondominio.map((p) => p.id);
        if (idsPortoes.length === 0) return [];
        return linhas('SELECT * FROM aberturas WHERE portao_id = ANY($1::uuid[]) ORDER BY criado_em DESC', [
          idsPortoes
        ]);
      }
    },

    auditoria: {
      async registrar({ condominioId, usuarioId, acao, detalhes }) {
        return linha(
          'INSERT INTO auditoria (condominio_id, usuario_id, acao, detalhes) VALUES ($1, $2, $3, $4) RETURNING *',
          [condominioId, usuarioId, acao, JSON.stringify(detalhes || {})]
        );
      },
      async listarPorCondominio(condominioId) {
        return linhas('SELECT * FROM auditoria WHERE condominio_id = $1 ORDER BY criado_em DESC', [condominioId]);
      }
    }
  };
}

module.exports = { criarPgDb };
