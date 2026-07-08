import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Launch from './screens/Launch'
import Landing from './screens/Landing'
import Auth from './screens/Auth'
import ForgotPassword from './screens/ForgotPassword'
import OtpVerification from './screens/OtpVerification'
import Dashboard from './screens/Dashboard'
import Slots from './screens/Slots'
import SlotsTester from './screens/SlotsTester'
import SsoCallback from './screens/SsoCallback'

export default function App() {
  return (
    <HashRouter>
      <div className="app-shell">
        <div className="phone-frame">
          <Routes>
            <Route path="/" element={<Launch />} />
            <Route path="/home" element={<Landing />} />
            <Route path="/login" element={<Auth />} />
            <Route path="/signup" element={<Auth />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/verify" element={<OtpVerification />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/slots" element={<Slots />} />
            <Route path="/slots-tester" element={<SlotsTester />} />
            <Route path="/sso-callback" element={<SsoCallback />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </HashRouter>
  )
}