import { isRunningInsideArtifact } from './artifactEnv'

let userPromise = null

/** Resolve o namespace `user` (memoizado). `null` fora do Artifact ou quando indisponível. */
export function getUserCapability() {
  if (!isRunningInsideArtifact()) return Promise.resolve(null)
  if (!userPromise) userPromise = window.claude.use('user')
  return userPromise
}
