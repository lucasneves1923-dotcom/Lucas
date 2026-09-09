import Papa from 'papaparse'

export function parseDelimitedText(text) {
  const result = Papa.parse(text.trim(), {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  })
  return {
    rows: result.data,
    columns: result.meta.fields || [],
    errors: result.errors,
  }
}

export function parseCsvFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      complete: (result) =>
        resolve({ rows: result.data, columns: result.meta.fields || [], errors: result.errors }),
      error: reject,
    })
  })
}

const DATE_PATTERNS = [
  { regex: /^(\d{4})-(\d{2})-(\d{2})$/, order: ['y', 'm', 'd'] },
  { regex: /^(\d{2})\/(\d{2})\/(\d{4})$/, order: ['d', 'm', 'y'] },
  { regex: /^(\d{2})-(\d{2})-(\d{4})$/, order: ['d', 'm', 'y'] },
  { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/, order: ['d', 'm', 'y2'] },
]

export function normalizeDate(value) {
  if (!value) return ''
  const trimmed = String(value).trim()
  for (const pattern of DATE_PATTERNS) {
    const match = trimmed.match(pattern.regex)
    if (!match) continue
    const parts = {}
    pattern.order.forEach((key, index) => {
      parts[key] = match[index + 1]
    })
    const year = parts.y || (parts.y2 ? `20${parts.y2}` : null)
    if (!year || !parts.m || !parts.d) continue
    const month = parts.m.padStart(2, '0')
    const day = parts.d.padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  const asDate = new Date(trimmed)
  if (!Number.isNaN(asDate.getTime())) {
    return asDate.toISOString().slice(0, 10)
  }
  return ''
}

function normalizeKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function findBestMatch(value, options, getLabel = (o) => o) {
  const target = normalizeKey(value)
  if (!target) return null
  const exact = options.find((option) => normalizeKey(getLabel(option)) === target)
  if (exact) return exact
  const partial = options.find(
    (option) =>
      normalizeKey(getLabel(option)).includes(target) || target.includes(normalizeKey(getLabel(option))),
  )
  return partial || null
}

const FIELD_ALIASES = {
  fullName: ['nome', 'nome completo', 'name'],
  phone: ['telefone', 'celular', 'phone', 'whatsapp'],
  email: ['email', 'e-mail'],
  address: ['endereco', 'endereço', 'address'],
  birthDate: ['nascimento', 'data de nascimento', 'birthdate', 'data nasc'],
  memberSince: ['membro desde', 'data de entrada', 'entrada'],
  role: ['cargo', 'funcao', 'função', 'role'],
  congregationName: ['congrega em', 'congregacao', 'congregação', 'filial'],
  status: ['status', 'situacao', 'situação'],
  notes: ['observacoes', 'observações', 'notes'],
}

export function suggestColumnMapping(columns) {
  const mapping = {}
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    const found = columns.find((column) => aliases.includes(normalizeKey(column)))
    if (found) mapping[field] = found
  }
  return mapping
}
