import { useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { Card, ConfirmDialog } from '../../components/common/ui.jsx'
import { useChurchData } from '../../context/DataContext.jsx'
import { buildBackupJson, parseBackupJson } from '../../lib/storage'
import { saveGeneratedFile } from '../../lib/downloadFile'
import { todayIso } from '../../lib/format'

export default function BackupSettings() {
  const data = useChurchData()
  const { members, financeEntries, assets, congregations, branding, restoreFromBackup } = data
  const fileInputRef = useRef(null)
  const [pendingRestore, setPendingRestore] = useState(null)
  const [message, setMessage] = useState('')

  async function handleExport() {
    setMessage('')
    const json = buildBackupJson({ members, financeEntries, assets, congregations, branding })
    try {
      await saveGeneratedFile(`gestorchurch-backup-${todayIso()}.json`, json)
    } catch (error) {
      setMessage(error.message)
    }
  }

  function handleFileSelected(file) {
    setMessage('')
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const restoredData = parseBackupJson(String(reader.result))
        setPendingRestore(restoredData)
      } catch (error) {
        setMessage(error.message)
      }
    }
    reader.readAsText(file)
  }

  return (
    <Card title="Backup manual">
      <p className="text-muted">
        Exporte todos os dados do sistema como um arquivo <code>.json</code> para guardar em outro lugar (é a
        principal proteção contra perda de dados, já que este app roda sem servidor próprio). Você pode restaurar a
        partir de um backup a qualquer momento.
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-primary" onClick={handleExport}>
          <Download size={16} /> Exportar backup (.json)
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
          <Upload size={16} /> Restaurar de um backup
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={(e) => e.target.files?.[0] && handleFileSelected(e.target.files[0])}
        />
      </div>

      {message && <p style={{ color: 'var(--color-danger)', marginTop: 12 }}>{message}</p>}

      {pendingRestore && (
        <ConfirmDialog
          title="Restaurar backup"
          message="Isso vai substituir todos os dados atuais (membros, financeiro, patrimônio, congregações e personalização) pelos dados do arquivo. Deseja continuar?"
          confirmLabel="Restaurar"
          onConfirm={() => {
            restoreFromBackup(pendingRestore)
            setPendingRestore(null)
            setMessage('Backup restaurado com sucesso.')
          }}
          onCancel={() => setPendingRestore(null)}
        />
      )}
    </Card>
  )
}
