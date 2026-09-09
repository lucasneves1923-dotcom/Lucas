import { parseDateOnly } from './format'

/**
 * Depreciação linear: (valor total − valor residual) ÷ vida útil, proporcional
 * ao tempo decorrido desde a aquisição. Valor contábil = valor total − depreciação acumulada.
 */
export function calculateDepreciation(asset, asOf = new Date()) {
  const quantity = Number(asset.quantity) || 1
  const unitValue = Number(asset.unitValue) || 0
  const residualValue = Number(asset.residualValue) || 0
  const usefulLifeYears = Number(asset.usefulLifeYears) || 1

  const totalValue = unitValue * quantity
  const totalResidual = Math.min(residualValue * quantity, totalValue)
  const depreciableBase = Math.max(totalValue - totalResidual, 0)

  const acquisitionDate = parseDateOnly(asset.acquisitionDate)
  const elapsedYears = acquisitionDate
    ? Math.max((asOf.getTime() - acquisitionDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000), 0)
    : 0

  const annualDepreciation = usefulLifeYears > 0 ? depreciableBase / usefulLifeYears : 0
  const accumulatedDepreciation = Math.min(
    annualDepreciation * elapsedYears,
    depreciableBase,
  )
  const bookValue = totalValue - accumulatedDepreciation

  return {
    totalValue,
    totalResidual,
    annualDepreciation,
    accumulatedDepreciation,
    bookValue,
    fullyDepreciated: accumulatedDepreciation >= depreciableBase && depreciableBase > 0,
  }
}
