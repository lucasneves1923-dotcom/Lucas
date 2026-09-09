import { useState } from 'react'
import { CheckCircle2, RefreshCw, XCircle } from 'lucide-react'
import { Card } from '../../components/common/ui.jsx'
import { runDiagnostics } from '../../lib/storage'

function ResultRow({ label, result }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}>
      {result.ok ? (
        <CheckCircle2 size={18} color="var(--color-success)" style={{ flexShrink: 0, marginTop: 2 }} />
      ) : (
        <XCircle size={18} color="var(--color-danger)" style={{ flexShrink: 0, marginTop: 2 }} />
      )}
      <div>
        <strong>{label}</strong>
        <p className="text-muted" style={{ margin: '2px 0 0' }}>{result.reason}</p>
      </div>
    </div>
  )
}

export default function DiagnosticsSettings() {
  const [results, setResults] = useState(() => runDiagnostics())

  return (
    <Card
      title="Diagnóstico de salvamento"
      action={
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setResults(runDiagnostics())}>
          <RefreshCw size={14} /> Testar novamente
        </button>
      }
    >
      <p className="text-muted">
        Testa se o armazenamento deste navegador está funcionando, tanto no modo compartilhado (localStorage,
        persiste entre sessões) quanto no modo individual de reserva (sessionStorage, usado automaticamente se o
        compartilhado falhar).
      </p>
      <ResultRow label="Armazenamento compartilhado (localStorage)" result={results.shared} />
      <ResultRow label="Armazenamento individual de reserva (sessionStorage)" result={results.individual} />
      {!results.shared.ok && (
        <p style={{ color: 'var(--color-danger)', marginTop: 12 }}>
          O armazenamento compartilhado está falhando — os dados estão sendo salvos apenas na aba atual (modo
          individual) e serão perdidos ao fechá-la. Use o backup manual como rede de segurança.
        </p>
      )}
    </Card>
  )
}
