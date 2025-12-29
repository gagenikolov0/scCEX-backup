import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Box } from '@mantine/core'
import { Login, Register } from './routes/Auth'
import Home from './routes/Home'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { AccountProvider } from './contexts/AccountContext'
import { MarketProvider } from './contexts/MarketContext'
import { PriceProvider } from './contexts/PriceContext'
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
        <AccountProvider>
          <PriceProvider>
            <MarketProvider>
              <AppShell>
                <AuthWrapper>
                  <Routes>
                    {/* Public routes */}
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/" element={<Home />} />
                    <Route path="/markets" element={<Markets />} />
                    <Route path="/spot" element={<Spot />} />
                    <Route path="/futures" element={<Futures />} />

                    {/* Protected routes */}
                    <Route path="/wallet" element={<Protected><Wallet /></Protected>} />
                    <Route path="/deposit" element={<Protected><Deposit /></Protected>} />
                    <Route path="/settings" element={<Protected><Settings /></Protected>} />

                    {/* Catch-all route for SPA */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </AuthWrapper>
              </AppShell>
            </MarketProvider>
          </PriceProvider>
        </AccountProvider>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App

function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { isReady } = useAuth()
  // Instead of null, we return a Box that keeps the background color stable
  if (!isReady) return (
    <Box style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Optional: Add a subtle logo or nothing to keep it absolutely clean */}
    </Box>
  )
  return <>{children}</>
}

function Protected({ children }: { children: React.ReactNode }) {
  const { isAuthed } = useAuth()
  return isAuthed ? <>{children}</> : <Navigate to="/login" replace />
}
