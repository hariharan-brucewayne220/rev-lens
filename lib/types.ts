export type UserRole = 'admin' | 'manager' | 'rep'

export interface SessionUser {
  id: string
  orgId: string
  email: string
  name: string
  role: UserRole
}

export interface OrgScope {
  orgId: string
}

export interface UserScope extends OrgScope {
  userId: string
  role: UserRole
}
