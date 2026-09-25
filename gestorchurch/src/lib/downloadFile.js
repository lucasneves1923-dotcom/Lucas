import { isRunningInsideArtifact } from './artifactEnv'

const DOWNLOAD_ERROR_MESSAGES = {
  rejected_extension: 'Formato de arquivo não permitido aqui.',
  extension_not_enabled: 'Este formato de arquivo está desabilitado nesta visualização.',
  too_large: 'O arquivo é grande demais para ser salvo aqui.',
  declined: 'Download cancelado.',
  rate_limited: 'Já há um pedido de download em aberto — aguarde um instante e tente de novo.',
  bad_request: 'Não foi possível preparar o arquivo para download.',
  unavailable: 'Download indisponível nesta visualização.',
  not_granted: 'Esta visualização não tem permissão para salvar arquivos.',
}

function downloadViaBrowserLink(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * Salva um arquivo gerado pelo app. Dentro do ambiente de artefato da Claude
 * (sem acesso a link de download comum) usa a capability `downloads`; fora
 * dele (app rodando como site normal) usa o fluxo padrão de blob + <a download>.
 */
export async function saveGeneratedFile(filename, content, mimeType = 'application/json') {
  if (isRunningInsideArtifact()) {
    const downloads = await window.claude.use('downloads')
    if (!downloads) {
      throw new Error('Download indisponível nesta visualização.')
    }
    try {
      await downloads.save({ filename, data: content })
      return
    } catch (error) {
      throw new Error(DOWNLOAD_ERROR_MESSAGES[error?.code] || error?.message || 'Falha ao salvar o arquivo.')
    }
  }

  downloadViaBrowserLink(filename, content, mimeType)
}
