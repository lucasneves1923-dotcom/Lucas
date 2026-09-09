const API_KEY_STORAGE_KEY = 'gestorchurch.anthropicApiKey'
const CLAUDE_MODEL = 'claude-sonnet-5'

export function getSavedApiKey() {
  try {
    return window.localStorage.getItem(API_KEY_STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

export function saveApiKey(key) {
  try {
    if (key) window.localStorage.setItem(API_KEY_STORAGE_KEY, key)
    else window.localStorage.removeItem(API_KEY_STORAGE_KEY)
  } catch {
    // Sem armazenamento disponível: a chave só vale para esta sessão.
  }
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'))
    reader.readAsDataURL(file)
  })
}

const EXTRACTION_PROMPT = `Você está analisando a foto ou print de um comprovante de pagamento (ex: Pix) recebido por uma igreja.
Extraia as informações em JSON puro, sem markdown, com exatamente estas chaves:
{
  "senderName": string ou null,
  "amount": number ou null (apenas o valor numérico, sem símbolo de moeda),
  "date": string no formato AAAA-MM-DD ou null,
  "probableCategory": um destes valores: "Dízimo", "Oferta", "Oferta Especial", "Doação", "Outros",
  "method": um destes valores: "Pix", "Dinheiro", "Cartão", "Transferência", "Cheque"
}
Se não conseguir determinar um campo com confiança, use null. Responda apenas com o JSON.`

export async function extractReceiptData({ apiKey, base64Image, mediaType }) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Image } },
            { type: 'text', text: EXTRACTION_PROMPT },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Falha na chamada à API da Claude (${response.status}): ${body.slice(0, 200)}`)
  }

  const payload = await response.json()
  const text = payload?.content?.find((block) => block.type === 'text')?.text || ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('A resposta da IA não continha um JSON reconhecível.')
  }

  try {
    return JSON.parse(jsonMatch[0])
  } catch {
    throw new Error('Não foi possível interpretar o JSON retornado pela IA.')
  }
}
