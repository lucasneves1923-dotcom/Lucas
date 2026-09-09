import { isRunningInsideArtifact } from './artifactEnv'

let dbPromise = null

/** Resolve o namespace `db` (memoizado). `null` quando indisponível ou fora do Artifact. */
export function getDb() {
  if (!isRunningInsideArtifact()) return Promise.resolve(null)
  if (!dbPromise) dbPromise = window.claude.use('db')
  return dbPromise
}

const DB_ERROR_MESSAGES = {
  invalid_argument: 'Dado inválido para salvar.',
  resource_exhausted: 'Muitas operações em pouco tempo — aguarde um instante.',
  quota_exceeded: 'Limite de armazenamento deste app atingido.',
  unavailable: 'Serviço de dados temporariamente indisponível — tente novamente.',
  revoked: 'O acesso deste app aos dados foi revogado — recarregue a página.',
  not_granted: 'Este app não tem permissão para acessar os dados aqui.',
  capability_disabled: 'Armazenamento indisponível nesta visualização.',
  capability_removed: 'Armazenamento indisponível nesta visualização.',
  transform_error: 'Dado inválido para salvar.',
}

export function describeDbError(error) {
  return DB_ERROR_MESSAGES[error?.code] || error?.message || 'Falha ao acessar os dados.'
}

/** Substitui todo o conteúdo de uma coleção pelos itens dados (usado no restaurar backup). */
export async function replaceCollection(db, collectionName, items) {
  const existing = await db.collection(collectionName).get()
  await Promise.all(existing.docs.map((doc) => db.collection(collectionName).doc(doc.id).delete()))
  await Promise.all(
    items.map((item) => {
      const { id, ...fields } = item
      return db.collection(collectionName).doc(id).set(fields)
    }),
  )
}

export function snapshotToArray(querySnapshot) {
  return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
}
