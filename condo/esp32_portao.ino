/*
 * Firmware do ESP32 instalado no portao.
 *
 * O ESP32 nunca fala direto com o app do morador nem recebe comandos de
 * abertura vindos da internet publica: ele so se inscreve num topico MQTT
 * exclusivo deste portao, dentro de um broker gerenciado, e reage a
 * mensagens que chegam nesse topico. Quem decide se um pedido de abertura
 * e legitimo (autenticacao, papel do usuario, debounce) e sempre o backend
 * na nuvem - o ESP32 so aciona o rele.
 *
 * Bibliotecas necessarias (Arduino IDE / PlatformIO):
 *   - WiFi.h (nativa do core ESP32)
 *   - PubSubClient (knolleary/pubsubclient)
 */

#include <WiFi.h>
#include <PubSubClient.h>

// ---------------------------------------------------------------------
// Configuracao - trocar pelos valores reais antes de gravar no ESP32.
// Em producao, mover para um arquivo separado (config.h) fora do
// controle de versao, para nao vazar credenciais no repositorio.
// ---------------------------------------------------------------------

const char* WIFI_SSID = "NOME_DA_REDE_WIFI";
const char* WIFI_SENHA = "SENHA_DA_REDE_WIFI";

const char* MQTT_HOST = "SEU_BROKER.hivemq.cloud";
const int   MQTT_PORTA = 8883; // TLS
const char* MQTT_USUARIO = "USUARIO_DO_DISPOSITIVO";
const char* MQTT_SENHA = "SENHA_DO_DISPOSITIVO";

// Identificador unico deste portao - deve bater com o cadastro em
// `dispositivos.identificador` no banco.
const char* DISPOSITIVO_ID = "portao-jardim-aurora-01";
const char* TOPICO_COMANDO = "condominios/jardim-aurora/portoes/principal/comando";
const char* TOPICO_STATUS  = "condominios/jardim-aurora/portoes/principal/status";

const int PINO_RELE = 26;
const bool RELE_ATIVO_EM_LOW = true; // a maioria dos modulos de rele aciona em LOW

const unsigned long PULSO_RELE_MS = 600;      // tempo que o rele fica acionado, simulando o toque do botao fisico
const unsigned long INTERVALO_PING_MS = 30000; // ping de status a cada 30s

WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);

unsigned long ultimoPing = 0;

void acionarRele() {
  digitalWrite(PINO_RELE, RELE_ATIVO_EM_LOW ? LOW : HIGH);
  delay(PULSO_RELE_MS);
  digitalWrite(PINO_RELE, RELE_ATIVO_EM_LOW ? HIGH : LOW);
}

void publicarStatus(const char* estado) {
  String payload = String("{\"dispositivo\":\"") + DISPOSITIVO_ID +
                    "\",\"estado\":\"" + estado +
                    "\",\"uptime_ms\":" + String(millis()) + "}";
  mqtt.publish(TOPICO_STATUS, payload.c_str());
}

void aoReceberMensagem(char* topico, byte* payload, unsigned int tamanho) {
  // O corpo da mensagem nao precisa carregar nenhuma decisao de negocio -
  // o backend so publica neste topico depois de ja ter validado tudo
  // (autenticacao, papel do usuario, cooldown). Qualquer mensagem aqui
  // significa "abra agora".
  Serial.println("Comando recebido, acionando o rele.");
  acionarRele();
  publicarStatus("abriu");
}

void conectarWifi() {
  Serial.printf("Conectando ao wifi %s...\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_SENHA);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWifi conectado.");
}

void reconectarMqtt() {
  while (!mqtt.connected()) {
    Serial.println("Conectando ao broker MQTT...");
    if (mqtt.connect(DISPOSITIVO_ID, MQTT_USUARIO, MQTT_SENHA)) {
      Serial.println("MQTT conectado.");
      mqtt.subscribe(TOPICO_COMANDO);
      publicarStatus("online");
    } else {
      Serial.printf("Falha ao conectar ao MQTT, rc=%d. Tentando de novo em 5s.\n", mqtt.state());
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(PINO_RELE, OUTPUT);
  digitalWrite(PINO_RELE, RELE_ATIVO_EM_LOW ? HIGH : LOW); // rele comeca desligado

  conectarWifi();
  mqtt.setServer(MQTT_HOST, MQTT_PORTA);
  mqtt.setCallback(aoReceberMensagem);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    conectarWifi();
  }
  if (!mqtt.connected()) {
    reconectarMqtt();
  }
  mqtt.loop();

  unsigned long agora = millis();
  if (agora - ultimoPing >= INTERVALO_PING_MS) {
    ultimoPing = agora;
    publicarStatus("online");
  }
}
