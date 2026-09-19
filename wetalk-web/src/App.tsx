import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import LoginPage from '@/pages/LoginPage'
import ChatPage from '@/pages/ChatPage'
import MomentsPage from '@/pages/MomentsPage'
import { useAuthStore } from '@/store/auth'

export default function App() {
  const bootstrapped = useAuthStore((s) => s.bootstrapped)
  const user = useAuthStore((s) => s.user)
  const bootstrap = useAuthStore((s) => s.bootstrap)

  useEffect(() => {
    void bootstrap()
    // 401 且刷新失败（见 api/client.ts）→ 回登录页
    const onUnauthorized = () => useAuthStore.getState().logout()
    window.addEventListener('wetalk:unauthorized', onUnauthorized)
    return () => window.removeEventListener('wetalk:unauthorized', onUnauthorized)
  }, [bootstrap])

  if (!bootstrapped) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        加载中…
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/" element={user ? <ChatPage /> : <Navigate to="/login" replace />} />
        <Route path="/moments" element={user ? <MomentsPage /> : <Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
