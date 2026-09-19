import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { errorMessage } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'

type Mode = 'login' | 'register'

export default function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const register = useAuthStore((s) => s.register)

  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [loading, setLoading] = useState(false)

  const isRegister = mode === 'register'

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      if (isRegister) {
        await register(username, password, nickname || username)
        toast.success('注册成功，已自动登录')
      } else {
        await login(username, password)
        toast.success('登录成功')
      }
      navigate('/', { replace: true })
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 via-background to-primary/5 p-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 shadow-lg">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <MessageCircle className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold">WeTalk</h1>
          <p className="text-sm text-muted-foreground">现代化的即时通讯平台</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          {isRegister && (
            <Input
              placeholder="昵称（选填）"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={32}
            />
          )}
          <Input
            placeholder="用户名（4-32 位字母数字）"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            pattern="[A-Za-z0-9_]{4,32}"
            title="4-32 位字母、数字或下划线"
            required
            autoFocus
          />
          <Input
            type="password"
            placeholder="密码（6-64 位）"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            maxLength={64}
            required
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '请稍候…' : isRegister ? '注册并登录' : '登录'}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          {isRegister ? '已有账号？' : '没有账号？'}
          <button
            type="button"
            className="ml-1 text-primary hover:underline"
            onClick={() => setMode(isRegister ? 'login' : 'register')}
          >
            {isRegister ? '去登录' : '立即注册'}
          </button>
        </p>
      </div>
    </div>
  )
}
