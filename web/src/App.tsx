import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Login, Register } from './routes/Auth'
import Home from './routes/Home'
import { AuthProvider, useAuth } from './auth/AuthContext'
import AppShell from './components/AppShell'
import Futures from './routes/Futures'
import Spot from './routes/Spot'
import Markets from './routes/Markets'
import Deposit from './routes/Deposit'
import Wallet from './routes/Wallet'
import Settings from './routes/Settings'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppShell>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<Protected><Home /></Protected>} />
            <Route path="/futures" element={<Protected><Futures /></Protected>} />
            <Route path="/spot" element={<Protected><Spot /></Protected>} />
            <Route path="/wallet" element={<Protected><Wallet /></Protected>} />
            <Route path="/deposit" element={<Protected><Deposit /></Protected>} />
            <Route path="/settings" element={<Protected><Settings /></Protected>} />
            <Route path="/markets" element={<Protected><Markets /></Protected>} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App

function Protected({ children }: { children: React.ReactNode }) {
  const { isReady, isAuthed } = useAuth()
  if (!isReady) return null
  return isAuthed ? <>{children}</> : <Navigate to="/login" replace />
}
