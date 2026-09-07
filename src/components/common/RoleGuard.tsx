import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { Result, Button } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import type { UserRole } from '@/types/auth'

interface RoleGuardProps {
  allowedRoles: UserRole[]
  children: ReactNode
}

export default function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const { currentUser } = useAuth()
  const navigate = useNavigate()

  if (!currentUser) return <Navigate to="/login" replace />

  if (!allowedRoles.includes(currentUser.role)) {
    return (
      <Result
        status="403"
        title="Không có quyền truy cập"
        subTitle="Bạn không có quyền xem trang này."
        extra={<Button type="primary" onClick={() => navigate('/dashboard')}>Về tổng quan</Button>}
      />
    )
  }

  return <>{children}</>
}
