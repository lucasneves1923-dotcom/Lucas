export const MEMBER_ROLES = [
  'Membro',
  'Pastor',
  'Tesoureiro',
  'Secretário(a)',
  'Cooperador',
  'Diácono',
  'Evangelista',
  'Presbítero',
  'Missionário',
]

export const MEMBER_STATUSES = ['Ativo', 'Inativo']

export const INCOME_CATEGORIES = [
  'Dízimo',
  'Oferta',
  'Oferta Especial',
  'Doação',
  'Campanha/Evento',
  'Outros',
]

export const EXPENSE_CATEGORIES = [
  'Aluguel/Manutenção',
  'Contas (água/luz/internet)',
  'Salários e Ajudas de Custo',
  'Missões',
  'Eventos e Ação Social',
  'Materiais e Suprimentos',
  'Outros',
]

export const PAYMENT_METHODS = ['Dinheiro', 'Pix', 'Cartão', 'Transferência', 'Cheque']

export const ASSET_CATEGORIES = [
  { name: 'Mobiliário', usefulLifeYears: 10 },
  { name: 'Som e Áudio', usefulLifeYears: 10 },
  { name: 'Instrumentos Musicais', usefulLifeYears: 10 },
  { name: 'Eletrônicos e Informática', usefulLifeYears: 5 },
  { name: 'Veículos', usefulLifeYears: 5 },
  { name: 'Imóveis e Instalações', usefulLifeYears: 25 },
  { name: 'Outros', usefulLifeYears: 10 },
]

export const ASSET_STATUSES = [
  { value: 'em_uso', label: 'Em uso' },
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'baixado', label: 'Baixado' },
]

export function defaultUsefulLife(categoryName) {
  const match = ASSET_CATEGORIES.find((c) => c.name === categoryName)
  return match ? match.usefulLifeYears : 10
}
