import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { Result, Button } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import type { UserRole } from '@/types/auth'
import type { Action } from '@/utils/rbac'

interface RoleGuardProps {
  allowedRoles: UserRole[]
  // Quyền thay thế: tài khoản được cấp riêng quyền này cũng vào được, dù vai trò
  // không nằm trong allowedRoles. Thiếu chỗ này thì quản trị viên tích quyền cho
  // ai đó mà không có tác dụng gì — bấm vào vẫn bị chặn, không rõ vì sao.
  quyen?: { resource: string; action: Action }
  children: ReactNode
}

export default function RoleGuard({ allowedRoles, quyen, children }: RoleGuardProps) {
  const { currentUser, hasPermission } = useAuth()
  const navigate = useNavigate()

  if (!currentUser) return <Navigate to="/login" replace />

  const duocVao =
    allowedRoles.includes(currentUser.role) ||
    (quyen ? hasPermission(quyen.resource, quyen.action) : false)

  if (!duocVao) {
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
