'use strict';

// Valida a implementacao real de acionarHardware() de ponta a ponta: sobe
// um broker MQTT embutido (aedes, em processo, sem depender de internet
// nem de contratar HiveMQ Cloud), simula o firmware do ESP32 assinando o
// topico de comando, e confere que o comando publicado chega. Quando o
// broker gerenciado de verdade for contratado, so trocar MQTT_URL - o
// codigo de producao (mqtt-hardware.js) e o mesmo.

const net = require('net');
const Aedes = require('aedes');
const mqtt = require('mqtt');
const { criarAcionarHardware, topicoComandoPadrao } = require('./mqtt-hardware');

function assertEqual(atual, esperado, mensagem) {
  if (atual !== esperado) {
    throw new Error(`${mensagem} (esperado: ${JSON.stringify(esperado)}, obtido: ${JSON.stringify(atual)})`);
  }
}

async function main() {
  const aedes = new Aedes();
  const servidor = net.createServer(aedes.handle);
  await new Promise((resolve) => servidor.listen(0, resolve));
  const porta = servidor.address().port;
  const url = `mqtt://127.0.0.1:${porta}`;

  const portao = { id: 'portao-jardim-aurora-01', condominio_id: 'jardim-aurora' };
  const topico = topicoComandoPadrao(portao);

  // Simula o firmware: se inscreve no topico de comando deste portao e
  // reage exatamente como o .ino reagiria (aqui, so registra o payload
  // recebido em vez de acionar um rele de verdade).
  const dispositivoSimulado = mqtt.connect(url);
  await new Promise((resolve, reject) => {
    dispositivoSimulado.once('connect', resolve);
    dispositivoSimulado.once('error', reject);
  });
  let recebeu = null;
  dispositivoSimulado.on('message', (_topico, payload) => {
    recebeu = JSON.parse(payload.toString());
  });
  await new Promise((resolve, reject) => {
    dispositivoSimulado.subscribe(topico, (err) => (err ? reject(err) : resolve()));
  });

  const acionarHardware = criarAcionarHardware({ url });
  await acionarHardware(portao);
  await new Promise((resolve) => setTimeout(resolve, 300));

  try {
    if (!recebeu) throw new Error('o dispositivo assinante nao recebeu nenhum comando');
    assertEqual(recebeu.comando, 'abrir', 'comando publicado deveria ser "abrir"');
    console.log('OK   - acionarHardware publica no topico MQTT do portao e o dispositivo simulado recebe o comando');
  } finally {
    acionarHardware.fechar();
    dispositivoSimulado.end(true);
    await new Promise((resolve) => servidor.close(resolve));
    aedes.close();
  }

  console.log('');
  console.log('1 passaram, 0 falharam, 1 no total (contra broker MQTT embutido)');
}

main().catch((err) => {
  console.error('FAIL -', err.message);
  process.exit(1);
});
