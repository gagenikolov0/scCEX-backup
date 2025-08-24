import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Login, Register } from './routes/Auth'
import Home from './routes/Home'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { AccountProvider } from './auth/AccountContext'
import { MarketProvider } from './markets/MarketContext'
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
      <AccountProvider>
        <MarketProvider>
          <BrowserRouter>
            <AppShell>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            {/* Public market pages */}
            <Route path="/" element={<Home />} />
            <Route path="/markets" element={<Markets />} />
            <Route path="/spot" element={<Spot />} />
            <Route path="/futures" element={<Futures />} />
            {/* Account pages require auth */}
            <Route path="/wallet" element={<Protected><Wallet /></Protected>} />
            <Route path="/deposit" element={<Protected><Deposit /></Protected>} />
            <Route path="/settings" element={<Protected><Settings /></Protected>} />
          </Routes>
            </AppShell>
          </BrowserRouter>
        </MarketProvider>
      </AccountProvider>
    </AuthProvider>
  )
}

export default App

function Protected({ children }: { children: React.ReactNode }) {
  const { isReady, isAuthed } = useAuth()
  if (!isReady) return null
  return isAuthed ? <>{children}</> : <Navigate to="/login" replace />
}
