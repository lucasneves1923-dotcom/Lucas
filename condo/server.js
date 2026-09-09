'use strict';

// Ponto de entrada real do backend. Sem DATABASE_URL configurada, sobe em
// "modo demo" com o banco em memoria (mock-db.js) so para permitir rodar e
// explorar a API localmente - nunca use esse modo em producao, ele perde
// todos os dados a cada reinicio.
//
// Proximo passo (ver README): trocar o bloco `else` abaixo por um driver
// real de Postgres (`pg`) implementando a mesma interface de mock-db.js.

const { criarApp } = require('./api');

async function main() {
  let db;

  if (process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL configurada, mas o driver real de Postgres ainda nao foi implementado. ' +
        'Proximo passo do projeto: escrever pg-db.js com a mesma interface de mock-db.js.'
    );
  } else {
    // eslint-disable-next-line no-console
    console.warn('[server] DATABASE_URL nao configurada - subindo em modo demo com banco em memoria.');
    const { criarMockDb } = require('./mock-db');
    db = criarMockDb();
  }

  const jwtSecret = process.env.JWT_SECRET || 'apenas-para-desenvolvimento-local';
  if (!process.env.JWT_SECRET) {
    // eslint-disable-next-line no-console
    console.warn('[server] JWT_SECRET nao configurado - usando um valor fixo de desenvolvimento.');
  }

  const app = criarApp(db, { jwtSecret });
  const porta = process.env.PORT || 3000;
  app.listen(porta, () => {
    // eslint-disable-next-line no-console
    console.log(`[server] API rodando na porta ${porta}`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[server] falha ao iniciar:', err.message);
  process.exit(1);
});
