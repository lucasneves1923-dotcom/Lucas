import { useEffect, useState } from 'react'
import { getUserCapability } from '../lib/userStore'

/** Resolve nomes/avatares para uma lista de ids de usuário (cacheado pela própria capability). */
export function useProfiles(ids) {
  const [profiles, setProfiles] = useState({})
  const key = [...new Set(ids)].sort().join(',')

  useEffect(() => {
    if (!key) return undefined
    let cancelled = false
    getUserCapability().then(async (user) => {
      if (!user || cancelled) return
      const result = await user.profiles(key.split(','))
      if (!cancelled) setProfiles((prev) => ({ ...prev, ...result }))
    })
    return () => {
      cancelled = true
    }
  }, [key])

  return profiles
}
