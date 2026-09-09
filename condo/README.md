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
apagada). O debounce do portão é calculado no servidor a partir da tabela
`aberturas`, não confia em nada vindo do cliente.

Qualquer mudança na lógica de permissão, no backend ou no schema precisa
manter esses pontos e atualizar `run-tests.js`.

## Arquivos

- `schema.sql` — schema Postgres multi-tenant completo
- `api.js` — API Express (`criarApp(db, opts)`), com toda a lógica de
  autenticação, papéis, debounce e auditoria
- `mock-db.js` — banco em memória usado nos testes e no modo demo local
- `server.js` — ponto de entrada real (hoje sobe em modo demo; ver
  "Próximos passos")
- `run-tests.js` — 32 testes de integração batendo na API via HTTP
- `esp32_portao.ino` — firmware do ESP32 (wifi + MQTT + relé)
- `condo_app_prototype.jsx` — protótipo do app do morador
- `admin_panel_prototype.jsx` — protótipo do painel do síndico

## Rodando localmente

```bash
npm install
npm test        # roda os 32 testes de integração sobre o banco em memória
npm start        # sobe a API em modo demo (sem Postgres) na porta 3000
```

## Próximos passos

1. Criar projeto no Supabase, rodar `schema.sql` lá, pegar a `DATABASE_URL`.
2. Escrever `pg-db.js` implementando a mesma interface de `mock-db.js`
   (as queries já foram pensadas para isso) e trocar em `server.js`.
3. Rodar a API localmente com `DATABASE_URL` configurada e testar contra o
   Postgres de verdade.
4. Contratar um broker MQTT gerenciado (ex: HiveMQ Cloud) e implementar de
   fato `acionarHardware()` em `api.js` (hoje é um placeholder), além de
   preencher as credenciais em `esp32_portao.ino`.
5. Testar o ESP32 fisicamente com um multímetro antes de ligar no motor do
   portão real.
6. Cadastrar o primeiro síndico manualmente via SQL direto no Supabase (não
   existe endpoint público para isso, de propósito) — ele define o PIN no
   primeiro login, pela rota `/admin/definir-pin`.
7. Validar o fluxo completo no condomínio piloto antes de vender para
   outros condomínios.
