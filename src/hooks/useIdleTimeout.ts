import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/store/authStore'

const IDLE_MS = 10 * 60 * 1000 // 10 phút

export function useIdleTimeout() {
  const currentUser = useAuthStore((s) => s.currentUser)
  const logout = useAuthStore((s) => s.logout)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!currentUser) return

    const reset = () => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        logout()
      }, IDLE_MS)
    }

    const EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click']
    EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    reset()

    return () => {
      if (timer.current) clearTimeout(timer.current)
      EVENTS.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [currentUser, logout])
}
