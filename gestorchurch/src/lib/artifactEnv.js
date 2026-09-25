/** True quando este app está rodando dentro do visualizador de Artifacts da Claude. */
export function isRunningInsideArtifact() {
  return typeof window !== 'undefined' && typeof window.claude?.use === 'function'
}
