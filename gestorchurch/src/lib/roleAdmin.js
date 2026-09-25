import { getDb, describeDbError } from './dbStore'
import { getUserCapability } from './userStore'

export async function searchPeople(query) {
  const user = await getUserCapability()
  if (!user) return []
  return user.search(query)
}

export async function resolveProfiles(ids) {
  const user = await getUserCapability()
  if (!user || !ids || ids.length === 0) return {}
  return user.profiles(ids)
}

export async function listRoleAssignments() {
  const db = await getDb()
  if (!db) return []
  const snapshot = await db.collection('roles').get()
  return snapshot.docs.map((doc) => ({ id: doc.id, role: doc.data().role }))
}

export async function assignRole(userId, role) {
  const db = await getDb()
  if (!db) throw new Error('Banco de dados indisponível nesta visualização.')
  try {
    await db.doc(`roles/${userId}`).set({ role, assignedAt: new Date().toISOString() })
  } catch (error) {
    throw new Error(describeDbError(error))
  }
}

export async function removeRoleAssignment(userId) {
  const db = await getDb()
  if (!db) throw new Error('Banco de dados indisponível nesta visualização.')
  try {
    await db.doc(`roles/${userId}`).delete()
  } catch (error) {
    throw new Error(describeDbError(error))
  }
}
