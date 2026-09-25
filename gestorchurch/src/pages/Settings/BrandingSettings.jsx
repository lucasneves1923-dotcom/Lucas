import { useEffect, useRef, useState } from 'react'
import { Card } from '../../components/common/ui.jsx'
import { useChurchData } from '../../context/DataContext.jsx'
import { applyBrandingCssVars } from '../../lib/theme'
import { resizeImageToDataUrl } from '../../lib/image'

const COMMIT_DELAY_MS = 400

export default function BrandingSettings() {
  const { branding, updateBranding } = useChurchData()
  // Rascunho local: a tela reage à digitação/arrasto do seletor de cor na hora,
  // sem esperar o resultado de cada gravação (que, em modo compartilhado, viaja
  // até o servidor e volta antes de refletir no estado global). A gravação em
  // si é adiada um pouco (ou disparada ao sair do campo/fechar a aba) para não
  // mandar uma escrita a cada tecla/pixel arrastado.
  const [draft, setDraft] = useState(branding)
  // draftRef é a fonte da verdade para leitura síncrona (setState/useEffect só
  // refletem no próximo render, o que é tarde demais para quem chama commitNow()
  // logo em seguida de um setField(), como o upload de logo). Toda escrita em
  // draftRef acontece diretamente onde o valor muda, nunca via useEffect.
  const draftRef = useRef(draft)
  const commitTimerRef = useRef(null)
  const dirtyRef = useRef(false)
  const [logoError, setLogoError] = useState('')
  const [logoBusy, setLogoBusy] = useState(false)

  // Só resincroniza com o estado global quando não há edição local pendente
  // (evita que uma atualização vinda do servidor apague o que a pessoa está digitando).
  useEffect(() => {
    if (!dirtyRef.current) {
      draftRef.current = branding
      setDraft(branding)
    }
  }, [branding])

  function commitNow() {
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current)
      commitTimerRef.current = null
    }
    if (dirtyRef.current) {
      dirtyRef.current = false
      updateBranding(draftRef.current)
    }
  }

  useEffect(() => {
    function flushIfPending() {
      if (dirtyRef.current) commitNow()
    }
    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') flushIfPending()
    }
    window.addEventListener('pagehide', flushIfPending)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      flushIfPending()
      window.removeEventListener('pagehide', flushIfPending)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function setField(field, value) {
    const next = { ...draftRef.current, [field]: value }
    dirtyRef.current = true
    draftRef.current = next
    setDraft(next)
    if (field === 'primaryColor' || field === 'accentColor') {
      applyBrandingCssVars(next) // pré-visualização instantânea, sem esperar a gravação
    }
    if (commitTimerRef.current) clearTimeout(commitTimerRef.current)
    commitTimerRef.current = setTimeout(commitNow, COMMIT_DELAY_MS)
  }

  async function handleLogoChange(file) {
    if (!file) return
    setLogoError('')
    setLogoBusy(true)
    try {
      // Redimensiona/comprime antes de guardar: um documento do banco de dados
      // compartilhado tem limite de tamanho, e fotos de celular passam disso
      // facilmente em base64. O logotipo só precisa ficar nítido em ~40px mesmo.
      const dataUrl = await resizeImageToDataUrl(file)
      setField('logoDataUrl', dataUrl)
      commitNow() // arquivo é uma ação só, não precisa esperar debounce
    } catch (error) {
      setLogoError(error.message || 'Não foi possível usar essa imagem.')
    } finally {
      setLogoBusy(false)
    }
  }

  function removeLogo() {
    setField('logoDataUrl', '')
    commitNow()
  }

  return (
    <Card title="Identidade visual">
      <p className="text-muted">
        O nome do sistema ("GestorChurch") é fixo. Aqui você personaliza o nome da igreja, o logotipo e as cores
        aplicadas em toda a interface.
      </p>

      <div className="field">
        <label htmlFor="churchName">Nome da igreja/cliente</label>
        <input
          id="churchName"
          value={draft.churchName}
          onChange={(e) => setField('churchName', e.target.value)}
          onBlur={commitNow}
        />
      </div>

      <div className="field">
        <label htmlFor="logo">Logotipo</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {draft.logoDataUrl && (
            <img
              src={draft.logoDataUrl}
              alt="Logotipo atual"
              style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--color-border)' }}
            />
          )}
          <input
            id="logo"
            type="file"
            accept="image/*"
            disabled={logoBusy}
            onChange={(e) => handleLogoChange(e.target.files?.[0])}
          />
          {draft.logoDataUrl && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={removeLogo}>
              Remover
            </button>
          )}
        </div>
        {logoBusy && <span className="text-muted" style={{ fontSize: '0.82rem' }}>Processando imagem…</span>}
        {logoError && <p style={{ color: 'var(--color-danger)', fontSize: '0.85rem' }}>{logoError}</p>}
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="primaryColor">Cor primária</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              id="primaryColor"
              type="color"
              className="color-swatch"
              value={draft.primaryColor}
              onChange={(e) => setField('primaryColor', e.target.value)}
              onBlur={commitNow}
            />
            <span className="num">{draft.primaryColor}</span>
          </div>
        </div>
        <div className="field">
          <label htmlFor="accentColor">Cor de destaque</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              id="accentColor"
              type="color"
              className="color-swatch"
              value={draft.accentColor}
              onChange={(e) => setField('accentColor', e.target.value)}
              onBlur={commitNow}
            />
            <span className="num">{draft.accentColor}</span>
          </div>
        </div>
      </div>

      <p className="text-muted" style={{ fontSize: '0.82rem' }}>
        As cores e o logotipo já são aplicados ao menu lateral e a toda a interface em tempo real.
      </p>
    </Card>
  )
}
