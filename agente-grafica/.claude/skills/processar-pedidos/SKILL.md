---
name: processar-pedidos
description: Processa os pedidos novos do Trello — baixa os cartões da lista "A fazer", monta a ficha de cada pedido, gera o PDF final com sangria e montagem na bobina, e comenta/move o cartão. Use quando pedirem para processar, rodar ou verificar os pedidos da gráfica.
---

# Rodada de processamento de pedidos

Siga na ordem. Não pule a leitura de `regras.md`.

## 1. Preparar

1. Leia `regras.md` (instruções da equipe) e `config.yaml → tipos` (padrões de cada tipo).
2. Rode `python -m grafica trello baixar`. A saída lista os cartões de "A fazer", cada um com
   `pasta`, `descricao`, `comentarios` e `anexos` já baixados.
3. Se a lista vier vazia, diga "Nenhum pedido novo" e pare.

## 2. Para cada cartão

### 2a. Entender o pedido
Leia título, descrição, etiquetas e **todos** os comentários (os mais novos valem mais — é
assim que a equipe responde às suas perguntas). Descubra:

- tipo (adesivo, banner, outro)
- tamanho final (largura x altura em cm)
- quantidade de cada arte
- qual anexo é cada arte
- qualquer pedido especial (sangria diferente, não girar, arte já com sangria...)

Converta unidades com cuidado: "50x50mm" = 5 x 5 cm; "1,20 x 0,80 m" = 120 x 80 cm.

### 2b. Faltou algo? Pergunte, não chute
Se qualquer item acima estiver faltando, ambíguo ou contraditório (ex.: descrição diz 5x5 e o
título 5x7; dois anexos e não diz qual é qual; anexo é um link externo não baixado):

```bash
python -m grafica trello comentar <id> "🤖 Dúvida: <pergunta objetiva, uma por linha>. Responda aqui no cartão e mova de volta para 'A fazer'."
python -m grafica trello mover <id> duvidas
```
Passe para o próximo cartão.

### 2c. Produzir
```bash
python -m grafica trello mover <id> em_producao
```
Escreva `trabalho/<id>/pedido.json` (formato no `CLAUDE.md`). Depois:
```bash
python -m grafica processar trabalho/<id>/pedido.json
```

- **Deu `ERRO:`** → comente no cartão o problema em português simples + o que o humano precisa
  fazer (ex.: "A imagem tem 90 dpi no tamanho de 50 cm; o mínimo é 150. Peça ao cliente um
  arquivo maior ou confirme um tamanho menor."), mova para `duvidas` e siga para o próximo.
  Não tente contornar mudando a ficha para "fazer caber".
- **Deu certo** → a saída tem `resumo`, `arquivo_final` e `avisos`.

### 2d. Entregar
```bash
python -m grafica trello comentar <id> "🤖 Pronto para imprimir.
<resumo>
Arquivo: <arquivo_final>
Avisos: <avisos, ou 'nenhum'>"
python -m grafica trello mover <id> pronto
```
Se `config.yaml → trello.anexar_resultado` for `true`, rode também
`python -m grafica trello anexar <id> <arquivo_final>`.

## 3. Relatório final
Liste em uma tabela curta: cartão, cliente, resultado (pronto / dúvida / erro) e o motivo
quando não ficou pronto.
