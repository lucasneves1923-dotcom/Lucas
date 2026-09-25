import { useMemo, useState } from 'react'
import { Printer } from 'lucide-react'
import { useChurchData } from '../../context/DataContext.jsx'
import { Card, EmptyState } from '../../components/common/ui.jsx'
import { formatCurrency, formatDate, todayIso } from '../../lib/format'

const CONTRIBUTION_CATEGORIES = ['Dízimo', 'Oferta', 'Oferta Especial']

export default function ContributionsReport() {
  const { members, financeEntries, branding } = useChurchData()
  const currentYear = Number(todayIso().slice(0, 4))
  const [year, setYear] = useState(currentYear)
  const [selectedMemberId, setSelectedMemberId] = useState('')

  const yearEntries = useMemo(
    () =>
      financeEntries.filter(
        (e) =>
          e.type === 'entrada' &&
          e.memberId &&
          Number(e.date?.slice(0, 4)) === Number(year) &&
          CONTRIBUTION_CATEGORIES.includes(e.category),
      ),
    [financeEntries, year],
  )

  const totalsByMember = useMemo(() => {
    const totals = new Map()
    yearEntries.forEach((entry) => {
      totals.set(entry.memberId, (totals.get(entry.memberId) || 0) + Number(entry.amount))
    })
    return Array.from(totals.entries())
      .map(([memberId, total]) => ({
        member: members.find((m) => m.id === memberId),
        total,
      }))
      .filter((row) => row.member)
      .sort((a, b) => a.member.fullName.localeCompare(b.member.fullName, 'pt-BR'))
  }, [yearEntries, members])

  const selectedMember = members.find((m) => m.id === selectedMemberId)
  const selectedEntries = yearEntries
    .filter((e) => e.memberId === selectedMemberId)
    .sort((a, b) => a.date.localeCompare(b.date))
  const selectedTotal = selectedEntries.reduce((sum, e) => sum + Number(e.amount), 0)

  return (
    <div>
      <Card>
        <div className="field-row no-print" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ maxWidth: 140 }}>
            <label htmlFor="year">Ano</label>
            <input id="year" type="number" value={year} onChange={(e) => setYear(e.target.value)} />
          </div>
        </div>

        {totalsByMember.length === 0 ? (
          <EmptyState title="Nenhuma contribuição vinculada a membros neste ano" />
        ) : (
          <div className="table-wrap">
            <table className="data-table stack-on-mobile">
              <thead>
                <tr>
                  <th>Membro</th>
                  <th>Total de contribuições ({year})</th>
                  <th aria-label="Ações" className="no-print" />
                </tr>
              </thead>
              <tbody>
                {totalsByMember.map(({ member, total }) => (
                  <tr key={member.id}>
                    <td data-label="Membro">{member.fullName}</td>
                    <td data-label="Total" className="amount">{formatCurrency(total)}</td>
                    <td data-label="Ações" className="no-print">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSelectedMemberId(member.id)}
                      >
                        Ver declaração
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selectedMember && (
        <Card>
          <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
              <Printer size={16} /> Imprimir declaração
            </button>
          </div>
          <h2 style={{ marginTop: 0 }}>{branding.churchName}</h2>
          <p>Declaração anual de contribuições — exercício {year}</p>
          <p>
            Declaramos que <strong>{selectedMember.fullName}</strong> contribuiu com esta igreja, no ano de {year},
            com o valor total de <strong>{formatCurrency(selectedTotal)}</strong>, conforme detalhamento abaixo.
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Categoria</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {selectedEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatDate(entry.date)}</td>
                    <td>{entry.category}</td>
                    <td className="amount">{formatCurrency(entry.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-muted" style={{ marginTop: 24 }}>
            Documento gerado pelo GestorChurch em {formatDate(todayIso())}.
          </p>
        </Card>
      )}
    </div>
  )
}
