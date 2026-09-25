// Nível de acesso ao app (diferente do "Cargo" do cadastro de membro — um é
// função na igreja, o outro é o que essa pessoa pode ver/editar aqui dentro).
export const ACCESS_ROLES = [
  { value: 'admin', label: 'Administrador' },
  { value: 'tesoureiro', label: 'Tesoureiro' },
  { value: 'membro', label: 'Membro' },
]

export const ACCESS_ROLE_LABELS = Object.fromEntries(ACCESS_ROLES.map((r) => [r.value, r.label]))

export const DEFAULT_ROLE = 'membro'

const PAGE_ACCESS = {
  admin: ['dashboard', 'members', 'finance', 'assets', 'reports', 'mural', 'settings'],
  tesoureiro: ['dashboard', 'finance', 'assets', 'reports', 'mural'],
  membro: ['dashboard', 'mural'],
}

export function pagesForRole(role) {
  return PAGE_ACCESS[role] || PAGE_ACCESS[DEFAULT_ROLE]
}

export function canAccessPage(role, page) {
  return pagesForRole(role).includes(page)
}
