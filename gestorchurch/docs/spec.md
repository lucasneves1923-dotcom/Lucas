# GestorChurch — Especificação do Sistema

Documento de referência com tudo que foi definido para o sistema de gestão financeira e administrativa de igrejas **GestorChurch**. Pode ser usado para documentação, para briefar um desenvolvedor, ou como prompt para recriar/estender o sistema em outra ferramenta.

## Visão geral

Sistema white-label (nome fixo "GestorChurch", com marca personalizável por igreja/cliente) para gestão de:
- Membros e suas funções na igreja
- Financeiro (dízimos, ofertas, despesas)
- Patrimônio (bens móveis, com depreciação)
- Relatórios financeiros e de contribuições
- Personalização de marca por cliente (multi-tenant básico)

Construído como aplicativo React de página única (SPA), com armazenamento persistente via API de storage do artefato (chave-valor), sem backend próprio.

## Módulos

### 1. Painel (Dashboard)
- Cartões de resumo: saldo em caixa, entradas do mês, saídas do mês, membros ativos, patrimônio líquido
- Gráfico de barras: entradas x saídas dos últimos 6 meses
- Gráfico de pizza: despesas do mês por categoria
- Tabela dos últimos lançamentos financeiros

### 2. Membros
Campos cadastrais:
- Nome completo* (obrigatório)
- Telefone, e-mail, endereço
- Data de nascimento
- Data de entrada como membro ("membro desde")
- Status: Ativo / Inativo
- **Função/Cargo**: Membro (padrão), Pastor, Tesoureiro, Secretário(a), Cooperador, Diácono, Evangelista, Presbítero, Missionário
- **Congrega em**: vínculo com uma congregação/filial cadastrada (gerenciadas em Personalização)
- Observações

Funcionalidades:
- Busca por nome
- Edição e exclusão
- **Importação em massa**: cola dados copiados de planilha (Google Forms → Google Sheets) ou envia arquivo CSV; interface de mapeamento de colunas (com sugestão automática); prévia antes de confirmar; reconhece datas em vários formatos, tenta casar cargo e congregação com as opções cadastradas.

### 3. Financeiro
Modelo de lançamento:
- Tipo: Entrada ou Saída
- Categorias de entrada: Dízimo, Oferta, Oferta Especial, Doação, Campanha/Evento, Outros
- Categorias de saída: Aluguel/Manutenção, Contas (água/luz/internet), Salários e Ajudas de Custo, Missões, Eventos e Ação Social, Materiais e Suprimentos, Outros
- Valor, data, método (Dinheiro, Pix, Cartão, Transferência, Cheque), descrição
- Vínculo opcional com um membro (para dízimo/oferta)

Funcionalidades:
- Filtro por tipo (todos/entradas/saídas)
- **Importar comprovante por IA**: usuário envia foto/print de comprovante de pagamento (Pix etc.); o sistema chama a API da Claude (com visão) para extrair nome do remetente, valor, data, categoria provável (dízimo/oferta) e método; tenta casar o nome com um membro cadastrado; abre o formulário pré-preenchido para revisão humana antes de salvar (nunca salva automaticamente sem confirmação)

### 4. Patrimônio
Campos:
- Descrição, categoria, marca, modelo, quantidade
- Valor unitário, valor residual
- Data de aquisição, vida útil em anos (sugerida automaticamente por categoria, editável)
- Status: em uso / manutenção / baixado
- Localização, observações

Categorias e vida útil padrão sugerida:
- Mobiliário — 10 anos
- Som e Áudio — 10 anos
- Instrumentos Musicais — 10 anos
- Eletrônicos e Informática — 5 anos
- Veículos — 5 anos
- Imóveis e Instalações — 25 anos
- Outros — 10 anos

Cálculo de depreciação (linear): `(valor total − valor residual) ÷ vida útil` por ano, proporcional ao tempo decorrido desde a aquisição, com valor contábil = valor total − depreciação acumulada.

### 5. Relatórios
- **Por período**: totais de entradas/saídas, saldo do período, detalhamento por categoria, impressão
- **Contribuições por membro**: declaração anual de contribuições (dízimos/ofertas) por membro — útil para comprovantes/declaração de IR
- **Patrimônio**: valor total de aquisição, depreciação acumulada, valor contábil líquido, detalhamento por categoria e lista completa dos bens

### 6. Personalização (painel administrativo)
- Nome da igreja/cliente (o nome do sistema em si, "GestorChurch", é fixo e não editável)
- Logotipo (upload de imagem, exibido no menu lateral)
- Cor primária e cor de destaque (com pré-visualização ao vivo, aplicadas em toda a interface)
- **Congregações**: cadastro de nome + endereço de cada congregação/filial, usado no campo "Congrega em" do cadastro de membros
- **Diagnóstico de salvamento**: testa se o armazenamento (compartilhado e individual) está funcionando e mostra o motivo exato de eventuais falhas
- **Backup manual**: exporta todos os dados como arquivo `.json` para download, e permite restaurar a partir de um backup

## Comportamento de dados

- Armazenamento persistente via API de chave-valor do artefato, com **dados compartilhados** (todos que acessam o mesmo sistema publicado veem os mesmos dados — apropriado para uma única igreja com várias pessoas testando/usando)
- Mecanismo de reserva: se o modo compartilhado falhar, tenta salvar em modo individual automaticamente, para não perder dados
- Indicador visual "Salvo" / aviso de erro com o motivo real, sempre que uma alteração é gravada ou falha
- Sem autenticação/login — qualquer pessoa com o link de acesso pode ver e editar os dados (adequado para fase de validação interna, não para uso público ainda)

## Design visual

- Paleta: tom "ink" escuro (padrão `#17222B`, customizável), dourado/latão como destaque (padrão `#B8934A`, customizável), fundo em tom sálvia claro (`#EEF1EC`)
- Tipografia: serifada (Source Serif 4) para títulos, sans-serif (IBM Plex Sans) para corpo, monoespaçada (IBM Plex Mono) para valores numéricos/financeiros
- Menu lateral fixo à esquerda com navegação por ícones + rótulos
- Responsivo: em telas estreitas (celular), o menu lateral vira uma trilha só de ícones, grades de cartões se reorganizam automaticamente, e tabelas viram cartões empilhados (em vez de exigir rolagem lateral)

## Stack técnica

- React (componente único), sem dependências de build externas além das disponíveis no ambiente do artefato
- Bibliotecas: `recharts` (gráficos), `lucide-react` (ícones), `papaparse` (leitura de CSV para importação de membros)
- Chamada à API da Anthropic (`/v1/messages`, modelo com visão) para leitura automática de comprovantes financeiros
- Persistência via API de storage do artefato (`window.storage.get/set/delete`)

## Pendências / próximos passos conhecidos

- Publicar o artefato para validar com uso real (compartilhando o link com pessoas da igreja)
- Investigar instabilidade pontual do armazenamento (erros "Storage set failed: Unexpected response type") — usar o backup manual como rede de segurança nesse meio tempo
- Avaliar necessidade futura de autenticação/login e isolamento de dados por igreja, caso o produto evolua para atender várias igrejas de forma independente (hoje é um sistema single-tenant por instância)
- Verificar disponibilidade de marca antes de formalizar o nome "GestorChurch" (há um concorrente com nome muito parecido, "GestChurch")

## Notas de implementação (esta versão)

Esta implementação é um app Vite + React que roda tanto como projeto comum
(`npm run dev`/`npm run build`) quanto publicado como Artifact da Claude —
o mesmo código se adapta em tempo de execução aos dois ambientes.

Publicado como Artifact, a persistência usa a capability `db` da Claude:
um banco compartilhado de verdade entre todos que abrem o link (exige login
na mesma organização Claude), com atualização em tempo real entre viewers —
isto é o que a especificação original chamava de "API de storage do
artefato" com "dados compartilhados". Rodando como app comum (fora do
Artifact), ou se a capability `db` não estiver disponível nessa
visualização, o app cai para `localStorage`/`sessionStorage` do navegador
(`src/lib/storage.js`), com o mesmo comportamento observável descrito
originalmente — modo compartilhado com fallback para individual, diagnóstico
e indicador de salvamento — mas "compartilhado" nesse caso significa *entre
abas do mesmo navegador*, não entre dispositivos diferentes. O backup manual
em `.json` continua valendo nos dois modos, como rede de segurança e como
forma de levar dados entre ambientes. Ver `README.md` para detalhes de cada
capability usada (`db`, `sample`, `downloads`, `user`).

### Módulo 7 — Mural (adicionado depois da v1)

Quadro de avisos/eventos do ministério: lista de posts (título, data opcional
do evento, texto), mais recentes primeiro. Todo mundo lê; só quem tem nível
de acesso "Administrador" publica, edita ou exclui. Só funciona no Artifact
publicado (depende da coleção `muralPosts` no banco compartilhado) — fora
dele mostra um aviso explicando isso em vez de quebrar.

### Níveis de acesso (adicionado depois da v1)

Administrador / Tesoureiro / Membro, controlando o que cada pessoa vê no
menu lateral (ver README.md para a matriz de acesso completa e as
limitações — é controle de interface, não uma trava de segurança de
servidor). Só existe no Artifact publicado, usando a capability `user` para
identificar quem está vendo a página e uma coleção `roles` no banco para
guardar o papel de cada pessoa. O dono do Artifact é sempre Administrador;
qualquer outra pessoa entra como "Membro" até alguém com permissão de
edição do Artifact atribuir um papel diferente em Personalização → Usuários.
