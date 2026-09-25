# 🖨️ Agente de acabamento da gráfica

Recebe pedidos pelo **Trello**, prepara a arte (**CorelDRAW 25**, PDF ou imagem) e entrega um
**PDF pronto para o RIP**: textos em curvas, sangria e peças montadas na largura da bobina.
Ele não imprime. Só prepara e avisa no cartão.

```
Trello "A fazer" ──► agente lê o pedido ──► falta informação? ──► pergunta no cartão ("Dúvidas")
                                 │
                                 ▼
                  CDR → CorelDRAW (textos em curvas, exporta PDF)
                  PDF / PNG / JPG → direto
                                 │
                                 ▼
                  sangria (espelhada) → montagem na bobina de 1,27 m
                                 │
                                 ▼
                  saida/<pedido>.pdf + comentário no cartão ──► "Pronto para imprimir"
```

## Por que é confiável

| Parte | Quem faz | Por quê |
|---|---|---|
| Entender o cartão, perguntar o que falta | IA (Claude Code) | Texto livre, cada cliente escreve de um jeito |
| Contas de montagem, sangria, PDF | Programa em Python (`grafica/`) | Mesma entrada, mesmo resultado. Testado automaticamente |
| Abrir `.cdr`, converter textos em curvas | CorelDRAW por automação (COM) | Nada de clicar na tela, que é lento e erra |

A IA **não faz conta de cabeça**. Ela preenche uma ficha (`pedido.json`) e o programa faz o
resto. Se algo não bate (proporção errada, resolução baixa, peça maior que a bobina), o
programa **para e explica**, e o agente pergunta no cartão em vez de chutar.

## Como a equipe "ensina" o agente

São três lugares, do mais fixo ao mais conversado:

1. **`config.yaml`**: números da gráfica: largura da bobina (127 cm), margens, sangria e
   espaçamento de cada tipo, resolução mínima. Mudou a bobina? Muda aqui.
2. **`regras.md`**: regras em português normal ("cliente X sempre manda arte com sangria",
   "adesivo de preço nunca gira"). Quando o agente errar, escreva aqui a regra que evitaria o erro.
3. **Comentários no cartão do Trello**: quando o agente tem dúvida, ele pergunta no cartão e
   move para "Dúvidas do agente". Você responde no comentário e arrasta de volta para "A fazer".

Modelo de cartão que evita perguntas: [`modelos/cartao-trello.md`](modelos/cartao-trello.md).

---

## Instalação (Windows, uma vez só)

### 1. Python
Baixe em <https://www.python.org/downloads/> (3.11 ou mais novo). No instalador, **marque
"Add python.exe to PATH"**.

### 2. Claude Code
Siga <https://docs.claude.com/en/docs/claude-code/setup>. No Windows ele precisa do
**Git for Windows** (<https://git-scm.com/download/win>).

### 3. Baixar este projeto
No PowerShell:
```powershell
git clone https://github.com/lucasneves1923-dotcom/Lucas.git
cd Lucas\agente-grafica
pip install -r requirements.txt
```

### 4. Testar o CorelDRAW
```powershell
python -m grafica corel testar
```
Deve aparecer `CorelDRAW conectado: versão 25.x`. Depois, teste um `.cdr` de verdade (passo 7).

### 5. Trello
1. Crie um quadro com as listas **A fazer**, **Em produção**, **Dúvidas do agente** e
   **Pronto para imprimir**. Se quiser outros nomes, ajuste em `config.yaml → trello.listas`.
2. Acesse <https://trello.com/power-ups/admin> → **New** → crie um Power-Up qualquer
   (ex.: "Agente Gráfica") → aba **API key** → gere a chave. Na mesma tela, clique no link
   **Token** e autorize.
3. Copie `.env.example` para `.env` e preencha `TRELLO_KEY`, `TRELLO_TOKEN` e `TRELLO_BOARD`
   (o código que aparece depois de `/b/` no endereço do quadro).

### 6. Ajustar os números
Abra `config.yaml` e confira margens, sangria e espaçamento com o que o seu RIP e a sua plotter
de recorte usam.

### 7. Primeiro teste (sem Trello)
Crie a pasta `trabalho\teste`, coloque uma arte nela e crie `trabalho\teste\pedido.json`:
```json
{
  "id": "teste",
  "tipo": "adesivo",
  "largura_cm": 5,
  "altura_cm": 5,
  "itens": [{ "arquivo": "minha-arte.cdr", "quantidade": 100 }]
}
```
```powershell
python -m grafica processar trabalho\teste\pedido.json
python -m grafica corel abrir saida\teste_adesivo_5x5cm.pdf
```
Confira no Corel se o resultado está como você faria à mão.

---

## Uso no dia a dia

Abra o terminal na pasta `agente-grafica` e rode `claude`. Depois, escolha um jeito:

- **Uma rodada:** digite `/processar-pedidos`
- **Automático enquanto o Claude estiver aberto:** `/loop 10m /processar-pedidos`
- **Automático sem janela aberta:** no Agendador de Tarefas do Windows, crie uma tarefa a cada
  10 minutos que rode, na pasta `agente-grafica`:
  `claude -p "/processar-pedidos"`

### Conta rápida sem gerar arquivo
```powershell
python -m grafica simular --largura 5 --altura 5 --quantidade 100
```
→ `100 peças de 5.4 x 5.4 cm: 21 por linha x 5 linhas, 32.2 cm de bobina de 127 cm`

(5,4 cm = 5 cm + 0,2 cm de sangria de cada lado; 0,3 cm de espaço entre as peças.)

## O que o programa faz

- **Montagem na bobina:** calcula quantas peças cabem por linha na largura útil
  (127 − 2 × margem lateral), testa a peça girada 90° e escolhe o que gasta **menos bobina**.
  Vários modelos do mesmo tamanho entram no mesmo arquivo. Acima de 5 m, divide em páginas
  (limite prático do formato PDF).
- **Sangria:** `espelhar` (padrão), `esticar` (estica a última linha da borda), `arte_ja_tem`
  (confere que a arte já veio com sangria) ou `nenhuma`. A arte original continua vetorial.
  Só a faixa de sangria, que é cortada fora, vira imagem.
- **Textos em curvas:** feito pelo próprio CorelDRAW nos `.cdr`, e forçado também na
  exportação do PDF.
- **Conferências:** recusa arte com proporção diferente do pedido (e avisa se parece girada),
  imagem abaixo da resolução mínima e peça que não cabe na bobina.
- **Nunca altera o arquivo original.** O `.cdr` é fechado sem salvar.

## Limitações atuais (próximos passos)

- **A automação do CorelDRAW não pôde ser testada** onde este código foi escrito, porque não há
  Windows/Corel lá. Todo o resto foi testado. Por isso o passo 4 e o passo 7 são importantes:
  se der erro, copie a mensagem para o Claude Code e peça o ajuste.
- **Linha de corte para plotter (CutContour)** e **marcas de registro** ainda não são geradas.
  Se a sua plotter recorta por contorno, esse é o próximo recurso a adicionar.
- A sangria é gerada em **CMYK** (`config.yaml → qualidade.cor_sangria`). Se a maioria das
  artes chega em RGB (fotos, PNG), teste `rgb`.
- Peças de tamanhos diferentes no mesmo arquivo ainda não são montadas juntas: viram
  arquivos separados.

## Para quem for mexer no código

```bash
pip install -r requirements.txt
python -m pytest -q
```

| Arquivo | O que faz |
|---|---|
| `grafica/pedido.py` | lê e valida a ficha `pedido.json` |
| `grafica/entrada.py` | abre PDF/CDR/imagem e ajusta ao tamanho final |
| `grafica/corel.py` | automação do CorelDRAW (COM) |
| `grafica/sangria.py` | sangria espelhada/esticada |
| `grafica/montagem.py` | cálculo e desenho da montagem na bobina |
| `grafica/processar.py` | junta tudo e gera PDF + relatório |
| `grafica/trello.py` | baixar cartões, comentar, mover, anexar |
| `CLAUDE.md` + `.claude/skills/processar-pedidos/` | instruções do agente |
