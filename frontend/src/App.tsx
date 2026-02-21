import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import LoadingPage from './components/LoadingPage'
import LoginPage from './components/LoginPage'
import RegisterPage from './components/RegisterPage'
import PatientDashboard from './patients_portal/PatientDashboard'
import DoctorDashboard from './respondr_pages/DoctorDashboard'
import DoctorMessagesPage from './respondr_pages/DoctorMessagesPage'
import DoctorAlertsPage from './respondr_pages/DoctorAlertsPage'
import AccountPage from './components/AccountPage'
import VitalsPage from './patients_portal/VitalsPage'
import DoctorPage from './patients_portal/DoctorPage'

function App() {
  const [isAppBooting, setIsAppBooting] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAppBooting(false)
    }, 1000)
    return () => clearTimeout(timer)
  }, [])

  if (isAppBooting) return <LoadingPage />

  return (
    <Router>
      <div className="antialiased font-sans">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/patient-dashboard" element={<PatientDashboard />} />
          <Route path="/vitals" element={<VitalsPage />} />
          <Route path="/doctor" element={<DoctorPage />} />
          <Route path="/doctor-dashboard" element={<DoctorDashboard />} />
          <Route path="/doctor-messages" element={<DoctorMessagesPage />} />
          <Route path="/doctor-alerts" element={<DoctorAlertsPage />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
