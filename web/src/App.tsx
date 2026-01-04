import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Box, Loader, Center } from '@mantine/core'
import { lazy, Suspense } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { AccountProvider } from './contexts/AccountContext'
import { MarketProvider } from './contexts/MarketContext'
import { PriceProvider } from './contexts/PriceContext'
import AppShell from './components/AppShell'

// Lazy load routes
const Home = lazy(() => import('./routes/Home'))
const AuthHub = lazy(() => import('./routes/Auth'))
const Futures = lazy(() => import('./routes/Futures'))
const Spot = lazy(() => import('./routes/Spot'))
const Markets = lazy(() => import('./routes/Markets'))
const Deposit = lazy(() => import('./routes/Deposit'))
const Withdraw = lazy(() => import('./routes/Withdraw'))
const Wallet = lazy(() => import('./routes/Wallet'))
const Settings = lazy(() => import('./routes/Settings'))
const UserInsight = lazy(() => import('@/routes/UserInsight'))

const PageLoader = () => (
  <Center style={{ height: '100vh' }}>
    <Loader size="xl" variant="dots" />
  </Center>
)

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AccountProvider>
          <PriceProvider>
            <MarketProvider>
              <AppShell>
                <AuthWrapper>
                  <Suspense fallback={<PageLoader />}>
                    <Routes>
                      {/* Public routes */}
                      <Route path="/login" element={<AuthHub />} />
                      <Route path="/register" element={<AuthHub />} />
                      <Route path="/" element={<Home />} />
                      <Route path="/markets" element={<Markets />} />
                      <Route path="/spot" element={<Spot />} />
                      <Route path="/futures" element={<Futures />} />

                      {/* Protected routes */}
                      <Route path="/wallet" element={<Protected><Wallet /></Protected>} />
                      <Route path="/deposit" element={<Protected><Deposit /></Protected>} />
                      <Route path="/withdraw" element={<Protected><Withdraw /></Protected>} />
                      <Route path="/settings" element={<Protected><Settings /></Protected>} />
                      <Route path="/trader/:username" element={<UserInsight />} />

                      {/* Catch-all route for SPA */}
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </Suspense>
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
