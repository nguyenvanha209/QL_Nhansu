// Thin wrapper — actual storage happens in luongStore to avoid circular deps at module load
type Action = 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW' | 'EXPORT' | 'LOGIN' | 'APPROVE' | 'REJECT'

export function logAction(
  userId: string,
  userFullName: string,
  action: Action,
  entity: string,
  entityId?: string,
  moTa?: string
) {
  // Lazy-import to break circular dependency
  import('@/store/luongStore').then(({ useLuongStore }) => {
    useLuongStore.getState().addNhatKy({
      userId,
      userFullName,
      action,
      entity,
      entityId,
      moTa: moTa ?? `${action} ${entity}${entityId ? ` [${entityId}]` : ''}`,
      thoiGian: new Date().toISOString(),
    })
  })
}
