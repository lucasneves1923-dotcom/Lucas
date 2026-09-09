import { useMemo, useState } from 'react'
import { Modal } from '../../components/common/ui.jsx'
import { useChurchData } from '../../context/DataContext.jsx'
import { MEMBER_ROLES } from '../../lib/constants'
import { findBestMatch, normalizeDate, parseCsvFile, parseDelimitedText, suggestColumnMapping } from '../../lib/csv'

const TARGET_FIELDS = [
  { key: 'fullName', label: 'Nome completo', required: true },
  { key: 'phone', label: 'Telefone' },
  { key: 'email', label: 'E-mail' },
  { key: 'address', label: 'Endereço' },
  { key: 'birthDate', label: 'Data de nascimento' },
  { key: 'memberSince', label: 'Membro desde' },
  { key: 'role', label: 'Função/Cargo' },
  { key: 'congregationName', label: 'Congrega em' },
  { key: 'status', label: 'Status' },
  { key: 'notes', label: 'Observações' },
]

export default function MemberImport({ onClose }) {
  const { congregations, importMembers } = useChurchData()
  const [step, setStep] = useState('input')
  const [pastedText, setPastedText] = useState('')
  const [parsed, setParsed] = useState(null)
  const [mapping, setMapping] = useState({})
  const [parseError, setParseError] = useState('')

  async function handleFile(file) {
    try {
      const result = await parseCsvFile(file)
      applyParsed(result)
    } catch {
      setParseError('Não foi possível ler o arquivo CSV.')
    }
  }

  function handlePasteParse() {
    if (!pastedText.trim()) {
      setParseError('Cole os dados copiados da planilha antes de continuar.')
      return
    }
    const result = parseDelimitedText(pastedText)
    applyParsed(result)
  }

  function applyParsed(result) {
    if (!result.rows.length) {
      setParseError('Nenhuma linha reconhecida. Verifique se a primeira linha tem os cabeçalhos das colunas.')
      return
    }
    setParseError('')
    setParsed(result)
    setMapping(suggestColumnMapping(result.columns))
    setStep('mapping')
  }

  const previewRows = useMemo(() => {
    if (!parsed) return []
    return parsed.rows.map((row) => {
      const record = {}
      for (const field of TARGET_FIELDS) {
        const column = mapping[field.key]
        record[field.key] = column ? row[column] : ''
      }
      const roleMatch = findBestMatch(record.role, MEMBER_ROLES) || 'Membro'
      const congregationMatch = record.congregationName
        ? findBestMatch(record.congregationName, congregations, (c) => c.name)
        : null
      const status = /inativ/i.test(record.status || '') ? 'Inativo' : 'Ativo'
      return {
        fullName: (record.fullName || '').trim(),
        phone: (record.phone || '').trim(),
        email: (record.email || '').trim(),
        address: (record.address || '').trim(),
        birthDate: normalizeDate(record.birthDate),
        memberSince: normalizeDate(record.memberSince),
        role: roleMatch,
        congregationId: congregationMatch?.id || '',
        congregationLabel: congregationMatch?.name || (record.congregationName ? `"${record.congregationName}" (não encontrada)` : '—'),
        status,
        notes: (record.notes || '').trim(),
      }
    })
  }, [parsed, mapping, congregations])

  const validRows = previewRows.filter((r) => r.fullName)
  const skippedCount = previewRows.length - validRows.length

  function handleConfirm() {
    importMembers(
      validRows.map(({ congregationLabel: _congregationLabel, ...rest }) => rest),
    )
    onClose()
  }

  return (
    <Modal title="Importar membros em massa" onClose={onClose} wide>
      {step === 'input' && (
        <div>
          <p className="text-muted">
            Cole os dados copiados de uma planilha (Google Sheets, Excel) ou envie um arquivo CSV. A primeira linha
            deve conter os nomes das colunas.
          </p>
          <div className="field">
            <label htmlFor="pasted">Colar dados</label>
            <textarea
              id="pasted"
              rows={8}
              placeholder={'Nome\tTelefone\tCargo\nJoão Silva\t(11) 99999-0000\tPastor'}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="csvFile">Ou enviar arquivo CSV</label>
            <input
              id="csvFile"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>
          {parseError && <p style={{ color: 'var(--color-danger)' }}>{parseError}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary" onClick={handlePasteParse}>
              Continuar
            </button>
          </div>
        </div>
      )}

      {step === 'mapping' && parsed && (
        <div>
          <p className="text-muted">
            {parsed.rows.length} linha(s) encontrada(s). Confirme de qual coluna vem cada campo (sugestão automática já
            aplicada quando possível).
          </p>
          <div className="grid grid-2">
            {TARGET_FIELDS.map((field) => (
              <div className="field" key={field.key}>
                <label htmlFor={`map-${field.key}`}>
                  {field.label}
                  {field.required ? ' *' : ''}
                </label>
                <select
                  id={`map-${field.key}`}
                  value={mapping[field.key] || ''}
                  onChange={(e) => setMapping((prev) => ({ ...prev, [field.key]: e.target.value }))}
                >
                  <option value="">— Não importar —</option>
                  {parsed.columns.map((column) => (
                    <option key={column} value={column}>
                      {column}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setStep('input')}>
              Voltar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!mapping.fullName}
              onClick={() => setStep('preview')}
            >
              Pré-visualizar
            </button>
          </div>
          {!mapping.fullName && (
            <p style={{ color: 'var(--color-danger)', fontSize: '0.85rem' }}>
              Mapeie a coluna de nome completo para continuar.
            </p>
          )}
        </div>
      )}

      {step === 'preview' && (
        <div>
          <p className="text-muted">
            {validRows.length} membro(s) serão importados.
            {skippedCount > 0 ? ` ${skippedCount} linha(s) sem nome serão ignoradas.` : ''}
          </p>
          <div className="table-wrap" style={{ maxHeight: 340, overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Cargo</th>
                  <th>Congrega em</th>
                  <th>Membro desde</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {validRows.map((row, index) => (
                  <tr key={`${row.fullName}-${index}`}>
                    <td>{row.fullName}</td>
                    <td>{row.role}</td>
                    <td>{row.congregationLabel}</td>
                    <td>{row.memberSince || '—'}</td>
                    <td>{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setStep('mapping')}>
              Voltar
            </button>
            <button type="button" className="btn btn-primary" disabled={validRows.length === 0} onClick={handleConfirm}>
              Confirmar importação
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
