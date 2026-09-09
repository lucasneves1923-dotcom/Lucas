import { Card } from '../../components/common/ui.jsx'
import { useChurchData } from '../../context/DataContext.jsx'

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'))
    reader.readAsDataURL(file)
  })
}

export default function BrandingSettings() {
  const { branding, updateBranding } = useChurchData()

  async function handleLogoChange(file) {
    if (!file) return
    const dataUrl = await readFileAsDataUrl(file)
    updateBranding({ logoDataUrl: dataUrl })
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
          value={branding.churchName}
          onChange={(e) => updateBranding({ churchName: e.target.value })}
        />
      </div>

      <div className="field">
        <label htmlFor="logo">Logotipo</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {branding.logoDataUrl && (
            <img
              src={branding.logoDataUrl}
              alt="Logotipo atual"
              style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--color-border)' }}
            />
          )}
          <input id="logo" type="file" accept="image/*" onChange={(e) => handleLogoChange(e.target.files?.[0])} />
          {branding.logoDataUrl && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => updateBranding({ logoDataUrl: '' })}>
              Remover
            </button>
          )}
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="primaryColor">Cor primária</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              id="primaryColor"
              type="color"
              className="color-swatch"
              value={branding.primaryColor}
              onChange={(e) => updateBranding({ primaryColor: e.target.value })}
            />
            <span className="num">{branding.primaryColor}</span>
          </div>
        </div>
        <div className="field">
          <label htmlFor="accentColor">Cor de destaque</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              id="accentColor"
              type="color"
              className="color-swatch"
              value={branding.accentColor}
              onChange={(e) => updateBranding({ accentColor: e.target.value })}
            />
            <span className="num">{branding.accentColor}</span>
          </div>
        </div>
      </div>

      <p className="text-muted" style={{ fontSize: '0.82rem' }}>
        As cores e o logotipo já são aplicados ao menu lateral e a toda a interface em tempo real.
      </p>
    </Card>
  )
}
