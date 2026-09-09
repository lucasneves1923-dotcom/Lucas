import { useState } from 'react'
import { Modal } from '../../components/common/ui.jsx'
import { useChurchData } from '../../context/DataContext.jsx'
import { extractReceiptData, fileToBase64, getSavedApiKey, saveApiKey } from '../../lib/claudeReceipt'
import { findBestMatch } from '../../lib/csv'
import { todayIso } from '../../lib/format'
import FinanceForm from './FinanceForm.jsx'

export default function ReceiptImport({ onClose }) {
  const { members } = useChurchData()
  const [apiKey, setApiKey] = useState(() => getSavedApiKey())
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [status, setStatus] = useState('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [extracted, setExtracted] = useState(null)

  function handleFileChange(selected) {
    setFile(selected)
    setPreview(selected ? URL.createObjectURL(selected) : '')
    setExtracted(null)
    setErrorMessage('')
  }

  async function handleAnalyze() {
    if (!apiKey.trim()) {
      setErrorMessage('Informe sua chave de API da Anthropic (Claude) para analisar o comprovante.')
      return
    }
    if (!file) {
      setErrorMessage('Selecione uma foto ou print do comprovante.')
      return
    }
    setStatus('analyzing')
    setErrorMessage('')
    try {
      saveApiKey(apiKey.trim())
      const base64Image = await fileToBase64(file)
      const result = await extractReceiptData({
        apiKey: apiKey.trim(),
        base64Image,
        mediaType: file.type || 'image/jpeg',
      })
      setExtracted(result)
      setStatus('done')
    } catch (error) {
      setErrorMessage(error.message || 'Falha ao analisar o comprovante.')
      setStatus('idle')
    }
  }

  if (extracted) {
    const matchedMember = extracted.senderName
      ? findBestMatch(extracted.senderName, members, (m) => m.fullName)
      : null

    return (
      <FinanceForm
        title="Revisar lançamento importado por IA"
        reviewNotice={
          matchedMember
            ? `Comprovante analisado. Remetente reconhecido como "${matchedMember.fullName}". Confira os dados antes de salvar.`
            : `Comprovante analisado${extracted.senderName ? ` (remetente detectado: "${extracted.senderName}", sem membro correspondente encontrado)` : ''}. Confira os dados antes de salvar.`
        }
        initialValues={{
          type: 'entrada',
          category: extracted.probableCategory || 'Dízimo',
          amount: extracted.amount ?? '',
          date: extracted.date || todayIso(),
          method: extracted.method || 'Pix',
          description: extracted.senderName ? `Pix de ${extracted.senderName}` : '',
          memberId: matchedMember?.id || '',
        }}
        onClose={onClose}
      />
    )
  }

  return (
    <Modal title="Importar comprovante por IA" onClose={onClose}>
      <p className="text-muted">
        Envie a foto ou print de um comprovante de pagamento. A IA da Claude extrai remetente, valor, data e categoria
        provável — nada é salvo automaticamente, você revisa antes de confirmar.
      </p>

      <div className="field">
        <label htmlFor="apiKey">Chave de API da Anthropic (Claude)</label>
        <input
          id="apiKey"
          type="password"
          placeholder="sk-ant-…"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
        <span className="text-muted" style={{ fontSize: '0.78rem' }}>
          Fica salva apenas neste navegador. Como este app roda sem backend, a chave é usada diretamente do
          navegador — use uma chave com escopo limitado se possível.
        </span>
      </div>

      <div className="field">
        <label htmlFor="receiptFile">Foto ou print do comprovante</label>
        <input
          id="receiptFile"
          type="file"
          accept="image/*"
          onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
        />
      </div>

      {preview && (
        <img
          src={preview}
          alt="Pré-visualização do comprovante"
          style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 8, border: '1px solid var(--color-border)' }}
        />
      )}

      {errorMessage && <p style={{ color: 'var(--color-danger)' }}>{errorMessage}</p>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Cancelar
        </button>
        <button type="button" className="btn btn-primary" disabled={status === 'analyzing'} onClick={handleAnalyze}>
          {status === 'analyzing' ? 'Analisando…' : 'Analisar comprovante'}
        </button>
      </div>
    </Modal>
  )
}
