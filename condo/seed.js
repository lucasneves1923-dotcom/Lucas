#!/usr/bin/env node
'use strict';

// Script de linha de comando para cadastrar o primeiro sindico de um
// condominio. De proposito, isso NAO existe como rota HTTP - so quem tem
// acesso direto a DATABASE_URL consegue criar o primeiro sindico. Depois
// disso, todo o resto (outros sindicos, se aplicavel, e todos os
// moradores) e cadastrado pelo proprio painel administrativo.
//
// Uso:
//   DATABASE_URL=postgres://... node seed.js \
//     --condominio "Jardim Aurora" \
//     --sindico-nome "Carlos Sindico" \
//     --sindico-telefone "+5511999990002" \
//     [--portao-nome "Portao Principal"]
//
// O sindico criado nao recebe PIN aqui - ele define o proprio PIN no
// primeiro login (codigo por SMS/WhatsApp, sem PIN ainda), atraves de
// POST /admin/definir-pin, que e a unica rota liberada antes disso.

const { criarPgDb } = require('./pg-db');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) {
      const chave = argv[i].slice(2);
      const proximo = argv[i + 1];
      if (proximo !== undefined && !proximo.startsWith('--')) {
        args[chave] = proximo;
        i += 1;
      } else {
        args[chave] = true;
      }
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    console.error('Defina DATABASE_URL antes de rodar o seed (aponte para o Postgres/Supabase do condominio).');
    process.exit(1);
  }

  const condominioNome = args.condominio;
  const sindicoNome = args['sindico-nome'];
  const sindicoTelefone = args['sindico-telefone'];
  const portaoNome = args['portao-nome'] || 'Portao Principal';

  if (!condominioNome || !sindicoNome || !sindicoTelefone) {
    console.error(
      'Uso: node seed.js --condominio "Nome" --sindico-nome "Nome" --sindico-telefone "+55..." [--portao-nome "Nome"]'
    );
    process.exit(1);
  }

  const db = criarPgDb(DATABASE_URL);
  try {
    const condominio = await db.condominios.criar({ nome: condominioNome });
    const portao = await db.portoes.criar({ condominioId: condominio.id, nome: portaoNome });
    const sindico = await db.usuarios.criar({
      condominioId: condominio.id,
      nome: sindicoNome,
      telefone: sindicoTelefone,
      papel: 'sindico'
    });

    console.log('Condominio criado:', condominio.id, '-', condominio.nome);
    console.log('Portao criado:    ', portao.id, '-', portao.nome);
    console.log('Sindico criado:   ', sindico.id, '-', sindico.nome, sindico.telefone);
    console.log('');
    console.log('O sindico ainda nao tem PIN. No primeiro login (POST /auth/sindico/verificar-codigo');
    console.log('so com o codigo, sem PIN), o servidor libera apenas POST /admin/definir-pin ate ele');
    console.log('configurar um PIN de administrador - so depois disso as outras rotas de admin abrem.');
  } finally {
    await db.fechar();
  }
}

main().catch((err) => {
  console.error('Falha ao rodar o seed:', err.message);
  process.exit(1);
});
