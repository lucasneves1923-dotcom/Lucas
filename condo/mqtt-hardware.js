'use strict';

// Implementacao real de acionamento de hardware: publica no topico MQTT
// exclusivo do portao. E o firmware em esp32_portao.ino quem esta
// inscrito nesse topico e aciona o rele ao receber a mensagem - este
// modulo nao sabe nada sobre fiacao, so publica o comando.
//
// O topico segue o padrao condominios/{condominioId}/portoes/{portaoId}/comando.
// Para o piloto (um unico condominio/portao fixo), o firmware usa um
// topico fixo gravado no .ino; o valor gravado la precisa bater com o que
// sai daqui para aquele portao especifico.

const mqtt = require('mqtt');

function topicoComandoPadrao(portao) {
  return `condominios/${portao.condominio_id}/portoes/${portao.id}/comando`;
}

/**
 * @param {object} config
 * @param {string} config.url ex: mqtts://usuario:senha@broker.hivemq.cloud:8883
 * @param {(portao: object) => string} [config.topico] override do calculo do topico
 * @param {number} [config.timeoutMs]
 */
function criarAcionarHardware(config = {}) {
  const url = config.url || process.env.MQTT_URL;
  if (!url) {
    throw new Error('MQTT_URL nao configurada');
  }

  const client = mqtt.connect(url, {
    username: config.username || process.env.MQTT_USERNAME,
    password: config.password || process.env.MQTT_PASSWORD,
    reconnectPeriod: 2000
  });

  const conectado = new Promise((resolve, reject) => {
    client.once('connect', resolve);
    client.once('error', reject);
  });

  const topicoPara = config.topico || topicoComandoPadrao;
  const timeoutMs = config.timeoutMs || 5000;

  async function acionarHardware(portao) {
    await Promise.race([
      conectado,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout conectando ao broker MQTT')), timeoutMs))
    ]);

    const payload = JSON.stringify({ comando: 'abrir', em: new Date().toISOString() });
    await new Promise((resolve, reject) => {
      const temporizador = setTimeout(() => reject(new Error('timeout publicando no broker MQTT')), timeoutMs);
      client.publish(topicoPara(portao), payload, { qos: 1 }, (err) => {
        clearTimeout(temporizador);
        if (err) reject(err);
        else resolve();
      });
    });
  }

  acionarHardware.fechar = () => client.end();

  return acionarHardware;
}

module.exports = { criarAcionarHardware, topicoComandoPadrao };
