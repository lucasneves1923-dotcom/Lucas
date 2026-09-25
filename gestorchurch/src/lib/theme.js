export function applyBrandingCssVars(branding) {
  const root = document.documentElement
  if (branding.primaryColor) root.style.setProperty('--color-ink', branding.primaryColor)
  if (branding.accentColor) {
    root.style.setProperty('--color-accent', branding.accentColor)
    root.style.setProperty('--color-accent-soft', `${branding.accentColor}33`)
  }
}
