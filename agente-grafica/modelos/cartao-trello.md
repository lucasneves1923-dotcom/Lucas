# Modelo de cartão do Trello

Copie isto na **descrição** do cartão e anexe a arte (PDF, CDR, PNG ou JPG) ao cartão.
O agente entende texto livre também, mas com este modelo ele quase nunca precisa perguntar.

```
Cliente: Loja X
Tipo: adesivo            (adesivo | banner | outro)
Tamanho final: 5 x 5 cm  (largura x altura, sem sangria)
Quantidade: 100
Arte: logo-lojax.pdf     (nome do anexo; se houver mais de uma, uma linha para cada com a quantidade)
Arte já tem sangria? não
Observações: pode girar
```

Vários modelos do mesmo tamanho no mesmo pedido:

```
Cliente: Mercado Y
Tipo: adesivo
Tamanho final: 5 x 5 cm
Artes:
- promo-1.pdf: 100
- promo-2.pdf: 50
```

## Listas do quadro

| Lista | Quem coloca o cartão aqui |
|---|---|
| **A fazer** | Humano (pedido novo, ou depois de responder uma dúvida) |
| **Em produção** | Agente, enquanto prepara o arquivo |
| **Dúvidas do agente** | Agente, quando falta informação ou a arte tem problema |
| **Pronto para imprimir** | Agente, com o resumo e o caminho do PDF final no comentário |

Para responder uma dúvida: escreva a resposta como **comentário** no cartão e arraste o
cartão de volta para **A fazer**.
