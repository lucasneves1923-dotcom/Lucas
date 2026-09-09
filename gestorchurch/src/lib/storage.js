// Camada de persistência do GestorChurch.
//
// Este app não tem backend próprio. "Compartilhado" aqui significa
// localStorage (mesmo navegador/dispositivo, mesma origem) — é o mais
// próximo de dados compartilhados que dá para ter sem servidor. Se a
// gravação em localStorage falhar (modo privado, quota excedida, storage
// desabilitado), o sistema cai automaticamente para sessionStorage
// ("individual", não sobrevive ao fechar a aba) para não perder os dados
// da sessão atual. O backup manual em .json é a rede de segurança real
// contra perda de dados entre dispositivos ou navegadores diferentes.

const STORAGE_KEY = 'gestorchurch.data.v1'
const SCHEMA_VERSION = 1

export function loadData() {
  const shared = tryRead(safeLocalStorage())
  if (shared.ok) return { data: shared.data, mode: 'shared' }

  const individual = tryRead(safeSessionStorage())
  if (individual.ok) return { data: individual.data, mode: 'individual' }

  return { data: null, mode: 'none' }
}

export function saveData(data) {
  const payload = JSON.stringify({ version: SCHEMA_VERSION, savedAt: new Date().toISOString(), data })

  const sharedResult = tryWrite(safeLocalStorage(), payload)
  if (sharedResult.ok) {
    return { ok: true, mode: 'shared' }
  }

  const individualResult = tryWrite(safeSessionStorage(), payload)
  if (individualResult.ok) {
    return { ok: true, mode: 'individual', reason: sharedResult.reason }
  }

  return { ok: false, mode: 'none', reason: individualResult.reason || sharedResult.reason }
}

export function runDiagnostics() {
  return {
    shared: testStorage(safeLocalStorage()),
    individual: testStorage(safeSessionStorage()),
  }
}

export function buildBackupJson(data) {
  return JSON.stringify(
    { app: 'GestorChurch', version: SCHEMA_VERSION, exportedAt: new Date().toISOString(), data },
    null,
    2,
  )
}

export function parseBackupJson(text) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Arquivo inválido: não é um JSON legível.')
  }
  if (!parsed || typeof parsed !== 'object' || !parsed.data) {
    throw new Error('Arquivo inválido: estrutura de backup não reconhecida.')
  }
  return parsed.data
}

function safeLocalStorage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

function safeSessionStorage() {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null
  } catch {
    return null
  }
}

function tryRead(storage) {
  if (!storage) return { ok: false, reason: 'Armazenamento indisponível neste navegador.' }
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return { ok: false, reason: 'Nenhum dado salvo ainda.' }
    const parsed = JSON.parse(raw)
    return { ok: true, data: parsed.data }
  } catch (error) {
    return { ok: false, reason: describeError(error) }
  }
}

function tryWrite(storage, payload) {
  if (!storage) return { ok: false, reason: 'Armazenamento indisponível neste navegador.' }
  try {
    storage.setItem(STORAGE_KEY, payload)
    return { ok: true }
  } catch (error) {
    return { ok: false, reason: describeError(error) }
  }
}

function testStorage(storage) {
  if (!storage) {
    return { ok: false, reason: 'Armazenamento indisponível neste navegador (bloqueado ou modo privado).' }
  }
  const probeKey = `${STORAGE_KEY}.__diagnostic__`
  try {
    storage.setItem(probeKey, '1')
    const readBack = storage.getItem(probeKey)
    storage.removeItem(probeKey)
    if (readBack !== '1') {
      return { ok: false, reason: 'Gravação não confere na leitura de volta.' }
    }
    return { ok: true, reason: 'Funcionando normalmente.' }
  } catch (error) {
    return { ok: false, reason: describeError(error) }
  }
}

function describeError(error) {
  if (!error) return 'Erro desconhecido.'
  if (error.name === 'QuotaExceededError') return 'Cota de armazenamento excedida.'
  if (error.name === 'SecurityError') return 'Acesso bloqueado (modo privado ou permissões do navegador).'
  return error.message || String(error)
}
