import { useEffect, useState } from 'react'
import { CheckCircle2, RefreshCw, XCircle } from 'lucide-react'
import { Card } from '../../components/common/ui.jsx'
import { runDiagnostics } from '../../lib/storage'
import { describeDbError, getDb } from '../../lib/dbStore'
import { useChurchData } from '../../context/DataContext.jsx'

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

async function testSharedDb() {
  try {
    const db = await getDb()
    if (!db) return { ok: false, reason: 'Banco de dados compartilhado indisponível nesta visualização.' }
    const ref = db.doc('diagnostics/ping')
    await ref.set({ checkedAt: new Date().toISOString() })
    const snap = await ref.get()
    if (!snap.exists) return { ok: false, reason: 'Gravação não confere na leitura de volta.' }
    return { ok: true, reason: 'Funcionando normalmente — os dados são compartilhados entre todos que acessam este app.' }
  } catch (error) {
    return { ok: false, reason: describeDbError(error) }
  }
}

export default function DiagnosticsSettings() {
  const { storageMode } = useChurchData()
  const [localResults, setLocalResults] = useState(null)
  const [dbResult, setDbResult] = useState(null)
  const [testing, setTesting] = useState(false)

  async function runTest() {
    setTesting(true)
    if (storageMode === 'db') {
      setDbResult(await testSharedDb())
    } else {
      setLocalResults(runDiagnostics())
    }
    setTesting(false)
  }

  useEffect(() => {
    runTest()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageMode])

  if (storageMode === 'db') {
    return (
      <Card
        title="Diagnóstico de salvamento"
        action={
          <button type="button" className="btn btn-secondary btn-sm" onClick={runTest} disabled={testing}>
            <RefreshCw size={14} /> Testar novamente
          </button>
        }
      >
        <p className="text-muted">
          Este app está usando o banco de dados compartilhado da Claude: todos que abrem este link e estão logados
          veem e editam os mesmos dados, em tempo real.
        </p>
        {dbResult && <ResultRow label="Banco de dados compartilhado" result={dbResult} />}
      </Card>
    )
  }

  return (
    <Card
      title="Diagnóstico de salvamento"
      action={
        <button type="button" className="btn btn-secondary btn-sm" onClick={runTest} disabled={testing}>
          <RefreshCw size={14} /> Testar novamente
        </button>
      }
    >
      <p className="text-muted">
        Testa se o armazenamento deste navegador está funcionando, tanto no modo compartilhado (localStorage,
        persiste entre sessões) quanto no modo individual de reserva (sessionStorage, usado automaticamente se o
        compartilhado falhar).
      </p>
      {localResults && (
        <>
          <ResultRow label="Armazenamento compartilhado (localStorage)" result={localResults.shared} />
          <ResultRow label="Armazenamento individual de reserva (sessionStorage)" result={localResults.individual} />
          {!localResults.shared.ok && (
            <p style={{ color: 'var(--color-danger)', marginTop: 12 }}>
              O armazenamento compartilhado está falhando — os dados estão sendo salvos apenas na aba atual (modo
              individual) e serão perdidos ao fechá-la. Use o backup manual como rede de segurança.
            </p>
          )}
        </>
      )}
    </Card>
  )
}
