'use strict';

// Ponto de entrada real do backend.
//
//   - DATABASE_URL configurada -> usa Postgres de verdade (pg-db.js).
//     Funciona identico apontando para um Postgres local ou para o
//     projeto Supabase (Supabase e so Postgres gerenciado).
//   - DATABASE_URL ausente -> sobe em "modo demo" com o banco em memoria
//     (mock-db.js). Nunca use esse modo em producao: perde todos os
//     dados a cada reinicio.
//
//   - MQTT_URL configurada -> aciona o portao de verdade, publicando no
//     broker MQTT real (mqtt-hardware.js).
//   - MQTT_URL ausente -> usa um placeholder que so loga no console, para
//     permitir testar o resto do fluxo sem broker nenhum.

const { criarApp } = require('./api');

async function main() {
  let db;

  if (process.env.DATABASE_URL) {
    const { criarPgDb } = require('./pg-db');
    db = criarPgDb(process.env.DATABASE_URL);
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

  let acionarHardware;
  if (process.env.MQTT_URL) {
    const { criarAcionarHardware } = require('./mqtt-hardware');
    acionarHardware = criarAcionarHardware({ url: process.env.MQTT_URL });
  } else {
    // eslint-disable-next-line no-console
    console.warn('[server] MQTT_URL nao configurada - acionamento do portao e so um placeholder (log no console).');
  }

  const app = criarApp(db, { jwtSecret, acionarHardware });
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
