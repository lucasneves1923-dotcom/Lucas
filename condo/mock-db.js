'use strict';

// Banco em memoria usado nos testes e no modo de demonstracao local.
// Implementa a mesma interface assincrona que a versao real em Postgres vai
// expor, para que api.js nunca precise saber qual das duas esta por tras.

const { randomUUID } = require('crypto');

function criarMockDb() {
  const tabelas = {
    condominios: [],
    usuarios: [],
    codigosAcesso: [],
    portoes: [],
    linksVisitante: [],
    aberturas: [],
    auditoria: []
  };

  return {
    _tabelas: tabelas,

    condominios: {
      async criar({ nome, endereco }) {
        const row = { id: randomUUID(), nome, endereco: endereco || null, criado_em: new Date() };
        tabelas.condominios.push(row);
        return row;
      }
    },

    usuarios: {
      async criar({ condominioId, nome, telefone, papel }) {
        const row = {
          id: randomUUID(),
          condominio_id: condominioId,
          nome,
          telefone,
          papel: papel || 'morador',
          pin_hash: null,
          ativo: true,
          criado_em: new Date()
        };
        tabelas.usuarios.push(row);
        return row;
      },
      async buscarPorId(id) {
        return tabelas.usuarios.find((u) => u.id === id) || null;
      },
      async buscarPorTelefone(condominioId, telefone) {
        return (
          tabelas.usuarios.find(
            (u) => u.telefone === telefone && (!condominioId || u.condominio_id === condominioId)
          ) || null
        );
      },
      async buscarPorTelefoneEmQualquerCondominio(telefone) {
        return tabelas.usuarios.filter((u) => u.telefone === telefone);
      },
      async listarPorCondominio(condominioId) {
        return tabelas.usuarios.filter((u) => u.condominio_id === condominioId);
      },
      async definirAtivo(id, ativo) {
        const row = tabelas.usuarios.find((u) => u.id === id);
        if (row) row.ativo = ativo;
        return row || null;
      },
      async definirPinHash(id, pinHash) {
        const row = tabelas.usuarios.find((u) => u.id === id);
        if (row) row.pin_hash = pinHash;
        return row || null;
      }
    },

    codigosAcesso: {
      async criar({ usuarioId, codigoHash, canal, expiraEm }) {
        const row = {
          id: randomUUID(),
          usuario_id: usuarioId,
          codigo_hash: codigoHash,
          canal: canal || 'sms',
          tentativas: 0,
          usado: false,
          expira_em: expiraEm,
          criado_em: new Date()
        };
        tabelas.codigosAcesso.push(row);
        return row;
      },
      async maisRecenteValidoPara(usuarioId) {
        const candidatos = tabelas.codigosAcesso
          .filter((c) => c.usuario_id === usuarioId && !c.usado && c.expira_em > new Date())
          .sort((a, b) => b.criado_em - a.criado_em);
        return candidatos[0] || null;
      },
      async registrarTentativa(id) {
        const row = tabelas.codigosAcesso.find((c) => c.id === id);
        if (row) row.tentativas += 1;
        return row || null;
      },
      async marcarUsado(id) {
        const row = tabelas.codigosAcesso.find((c) => c.id === id);
        if (row) row.usado = true;
        return row || null;
      }
    },

    portoes: {
      async criar({ condominioId, nome, tempoAberturaSeg, tempoCooldownSeg }) {
        const row = {
          id: randomUUID(),
          condominio_id: condominioId,
          nome,
          tempo_abertura_seg: tempoAberturaSeg ?? 15,
          tempo_cooldown_seg: tempoCooldownSeg ?? 20,
          criado_em: new Date()
        };
        tabelas.portoes.push(row);
        return row;
      },
      async buscarPorId(id) {
        return tabelas.portoes.find((p) => p.id === id) || null;
      },
      async listarPorCondominio(condominioId) {
        return tabelas.portoes.filter((p) => p.condominio_id === condominioId);
      }
    },

    linksVisitante: {
      async criar({ portaoId, criadoPorUsuarioId, token, limiteUsos, expiraEm }) {
        const row = {
          id: randomUUID(),
          portao_id: portaoId,
          criado_por_usuario_id: criadoPorUsuarioId,
          token,
          limite_usos: limiteUsos,
          usos_realizados: 0,
          expira_em: expiraEm,
          revogado: false,
          criado_em: new Date()
        };
        tabelas.linksVisitante.push(row);
        return row;
      },
      async buscarPorToken(token) {
        return tabelas.linksVisitante.find((l) => l.token === token) || null;
      },
      async incrementarUso(id) {
        const row = tabelas.linksVisitante.find((l) => l.id === id);
        if (row) row.usos_realizados += 1;
        return row || null;
      }
    },

    aberturas: {
      async criar({ portaoId, usuarioId, linkVisitanteId, origem, resultado }) {
        const row = {
          id: randomUUID(),
          portao_id: portaoId,
          usuario_id: usuarioId || null,
          link_visitante_id: linkVisitanteId || null,
          origem,
          resultado,
          criado_em: new Date()
        };
        tabelas.aberturas.push(row);
        return row;
      },
      async ultimaComSucessoPara(portaoId) {
        const candidatas = tabelas.aberturas
          .filter((a) => a.portao_id === portaoId && a.resultado === 'sucesso')
          .sort((a, b) => b.criado_em - a.criado_em);
        return candidatas[0] || null;
      },
      async listarPorUsuario(usuarioId) {
        return tabelas.aberturas
          .filter((a) => a.usuario_id === usuarioId)
          .sort((a, b) => b.criado_em - a.criado_em);
      },
      async listarPorCondominio(condominioId, portoesDoCondominio) {
        const idsPortoes = new Set(portoesDoCondominio.map((p) => p.id));
        return tabelas.aberturas
          .filter((a) => idsPortoes.has(a.portao_id))
          .sort((a, b) => b.criado_em - a.criado_em);
      }
    },

    auditoria: {
      async registrar({ condominioId, usuarioId, acao, detalhes }) {
        const row = {
          id: randomUUID(),
          condominio_id: condominioId,
          usuario_id: usuarioId,
          acao,
          detalhes: detalhes || {},
          criado_em: new Date()
        };
        tabelas.auditoria.push(row);
        return row;
      },
      async listarPorCondominio(condominioId) {
        return tabelas.auditoria
          .filter((a) => a.condominio_id === condominioId)
          .sort((a, b) => b.criado_em - a.criado_em);
      }
    }
  };
}

module.exports = { criarMockDb };
