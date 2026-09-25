function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () =>
      reject(new Error('Não foi possível processar essa imagem (formato não suportado pelo navegador).'))
    img.src = src
  })
}

function dataUrlByteLength(dataUrl) {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  return Math.ceil((base64.length * 3) / 4)
}

/**
 * Redimensiona e comprime uma imagem para caber num documento do banco de
 * dados do Artifact (limite de 256 KiB por documento) com folga para os
 * outros campos da marca. Sempre devolve um data URL pronto para uso em
 * <img src> e para salvar.
 */
export async function resizeImageToDataUrl(file, { maxDimension = 256, maxBytes = 180_000 } = {}) {
  const original = await readFileAsDataUrl(file)
  const img = await loadImage(original)

  const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth, img.naturalHeight))
  const width = Math.max(1, Math.round(img.naturalWidth * scale))
  const height = Math.max(1, Math.round(img.naturalHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, width, height)

  const candidates = [
    () => canvas.toDataURL('image/png'),
    () => canvas.toDataURL('image/jpeg', 0.85),
    () => canvas.toDataURL('image/jpeg', 0.6),
    () => canvas.toDataURL('image/jpeg', 0.4),
  ]

  for (const makeCandidate of candidates) {
    const dataUrl = makeCandidate()
    if (dataUrlByteLength(dataUrl) <= maxBytes) return dataUrl
  }

  throw new Error(
    'Essa imagem é grande/detalhada demais mesmo depois de compactada. Tente uma versão mais simples ou menor do logotipo.',
  )
}
