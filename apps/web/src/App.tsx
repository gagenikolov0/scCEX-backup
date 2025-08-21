import './App.css'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useMemo } from 'react'
import { Login, Register } from './routes/Auth'
import Home from './routes/Home'

function App() {
  const isAuthed = useMemo(() => !!localStorage.getItem('accessToken'), [])
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={isAuthed ? <Home /> : <Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
