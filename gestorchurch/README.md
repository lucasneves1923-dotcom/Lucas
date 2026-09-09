# GestorChurch

Sistema de gestão financeira e administrativa de igrejas: membros, financeiro
(dízimos/ofertas/despesas), patrimônio (com depreciação), relatórios e
personalização de marca. SPA em React, sem backend próprio.

Implementado a partir da especificação em `docs/spec.md` (nesta pasta).

## Rodando localmente

```bash
npm install
npm run dev
```

`npm run build` gera a versão de produção em `dist/`; `npm run lint` roda o
oxlint.

## Módulos

- **Painel** — cartões de resumo, gráfico de entradas x saídas (6 meses),
  despesas do mês por categoria, últimos lançamentos.
- **Membros** — cadastro completo (cargo, congregação, status etc.), busca e
  importação em massa (colar de planilha ou CSV, com mapeamento de colunas e
  prévia antes de confirmar).
- **Financeiro** — lançamentos de entrada/saída por categoria, filtro por
  tipo, e importação de comprovante por IA (foto/print → Claude com visão →
  formulário pré-preenchido para revisão humana antes de salvar).
- **Patrimônio** — bens com vida útil sugerida por categoria e depreciação
  linear calculada automaticamente.
- **Relatórios** — por período, contribuições anuais por membro (para
  declaração) e patrimônio, todos imprimíveis.
- **Personalização** — nome da igreja, logotipo, cores (aplicadas em tempo
  real), congregações/filiais, diagnóstico de armazenamento e backup manual.

## Persistência e limitações conhecidas

Este app **não tem backend**. Os dados são salvos no `localStorage` do
navegador ("modo compartilhado" no diagnóstico — na prática, compartilhado
entre abas do mesmo navegador/dispositivo, não entre dispositivos diferentes).
Se a gravação falhar (modo privado, quota excedida etc.), o sistema cai
automaticamente para `sessionStorage` ("modo individual", não sobrevive ao
fechar a aba) para não perder os dados da sessão atual.

Por isso o **backup manual** (Personalização → Backup, exporta/importa
`.json`) é a única forma real de levar os dados de um navegador/dispositivo
para outro, ou de se proteger contra perda de dados — use-o com regularidade
enquanto o produto não tiver um backend/sincronização de verdade.

Não há autenticação: qualquer pessoa com acesso ao navegador onde o app roda
vê e edita os dados. Adequado para validação interna de uma única igreja, não
para uso público.

## Importação de comprovante por IA

O recurso em Financeiro → "Importar comprovante por IA" chama a API da
Anthropic (`/v1/messages`, modelo com visão) diretamente do navegador,
usando uma chave de API informada pelo usuário e salva em `localStorage`.
Como não há backend para intermediar a chamada com segurança, use uma chave
com escopo limitado. O resultado da IA nunca é salvo automaticamente — sempre
abre o formulário para revisão humana antes de confirmar.
