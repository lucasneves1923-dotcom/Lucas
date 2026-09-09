# Sistema de controle de acesso — Portaria Jardim Aurora (piloto)

Backend, firmware e protótipos de frontend do sistema descrito no projeto:
app do morador que abre o portão remotamente, painel separado do síndico,
link temporário para visitantes e portão acionado via ESP32/MQTT.

## Requisito de segurança inegociável

Não existe tela de "criar conta". Um usuário só existe se o síndico o
cadastrar pelo painel administrativo. O papel (morador/síndico) nunca é
decidido pelo cliente — toda rota sensível reconfirma o papel direto no
banco a cada chamada. App do morador e painel do síndico são sistemas
separados. Login do síndico exige 2 fatores (código + PIN); morador nunca
tem PIN. Toda ação administrativa é auditada (tabela `auditoria`, nunca
apagada — reforçado por um trigger append-only no Postgres). O debounce
do portão é calculado no servidor a partir da tabela `aberturas`, não
confia em nada vindo do cliente.

Qualquer mudança na lógica de permissão, no backend ou no schema precisa
manter esses pontos e atualizar `run-tests.js`.

## Arquivos

- `schema.sql` — schema Postgres multi-tenant completo
- `api.js` — API Express (`criarApp(db, opts)`), com toda a lógica de
  autenticação, papéis, debounce e auditoria
- `mock-db.js` — banco em memória usado em `run-tests.js` e no modo demo
- `pg-db.js` — driver real de Postgres, mesma interface de `mock-db.js`
- `mqtt-hardware.js` — acionamento real do portão via MQTT
- `seed.js` — script de linha de comando para cadastrar o primeiro
  síndico (não existe rota HTTP para isso, de propósito)
- `server.js` — ponto de entrada real: usa Postgres/MQTT de verdade
  quando `DATABASE_URL`/`MQTT_URL` estão configuradas, senão cai no modo
  demo (banco em memória + placeholder que só loga no console)
- `run-tests.js` — 32 testes de integração batendo na API via HTTP sobre
  o banco em memória
- `test-pg-db.js` — os fluxos mais sensíveis (login, debounce, 2FA,
  auditoria) rodando sobre um Postgres de verdade, não o mock
- `test-mqtt.js` — `acionarHardware()` publicando de verdade num broker
  MQTT (embutido no teste, sem depender de internet) e um dispositivo
  simulado recebendo o comando, do mesmo jeito que o ESP32 receberia
- `esp32_portao.ino` — firmware do ESP32 (wifi + MQTT + relé)
- `condo_app_prototype.jsx` — protótipo do app do morador
- `admin_panel_prototype.jsx` — protótipo do painel do síndico

## Rodando localmente

```bash
npm install
npm test         # 32 testes de integração sobre o banco em memória
npm start        # sobe a API em modo demo (sem Postgres) na porta 3000
```

Com um Postgres de verdade disponível (schema já aplicado):

```bash
DATABASE_URL=postgres://usuario:senha@host:5432/banco npm run test:pg
```

Com um broker MQTT de verdade disponível:

```bash
MQTT_URL=mqtts://usuario:senha@broker:8883 node -e "
  const { criarAcionarHardware } = require('./mqtt-hardware');
  criarAcionarHardware({ url: process.env.MQTT_URL })({ id: 'teste', condominio_id: 'teste' });
"
```

(sem `MQTT_URL` real disponível agora, `npm run test:mqtt` já prova o mesmo
código contra um broker embutido no próprio teste)

## O que já está pronto vs. o que ainda depende de você

O código de `pg-db.js` e `mqtt-hardware.js` já foi escrito e testado de
ponta a ponta — contra um Postgres local de verdade e contra um broker
MQTT real (embutido no teste, para não depender de internet). Esse
código funciona sem nenhuma mudança contra Supabase (que é só Postgres
gerenciado) e contra um broker gerenciado como o HiveMQ Cloud — só troca
a URL de conexão.

O que continua exigindo uma ação sua, porque envolve contas externas
(possivelmente com pagamento) e hardware físico que ninguém consegue
acessar remotamente:

1. Criar o projeto no Supabase, rodar `schema.sql` lá e pegar a
   `DATABASE_URL` real.
2. Contratar um broker MQTT gerenciado (ex: HiveMQ Cloud, plano free) e
   pegar as credenciais.
3. Preencher `WIFI_SSID`, `WIFI_SENHA`, `MQTT_HOST`, `MQTT_USUARIO` e
   `MQTT_SENHA` em `esp32_portao.ino` e gravar no ESP32.
4. Testar o ESP32 fisicamente com um multímetro antes de ligar no motor
   do portão real.
5. Rodar `seed.js` apontando para a `DATABASE_URL` real, para cadastrar o
   primeiro condomínio, portão e síndico do piloto:
   ```bash
   DATABASE_URL=postgres://... node seed.js \
     --condominio "Jardim Aurora" \
     --sindico-nome "Nome do síndico" \
     --sindico-telefone "+55..." \
     --portao-nome "Portão Principal"
   ```
   O síndico criado ainda não tem PIN — ele define o próprio PIN no
   primeiro login, via `/admin/definir-pin`.
6. Configurar `DATABASE_URL`, `JWT_SECRET` e `MQTT_URL` no ambiente onde a
   API vai rodar de verdade (não no modo demo local).
7. Validar o fluxo completo no condomínio piloto antes de pensar em vender
   para outros condomínios.
