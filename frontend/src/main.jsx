import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import './index.css'
import App from './App.jsx'

// Route helper: Convert clean pathname SSO redirects into hash routes for HashRouter compatibility
if (window.location.pathname === '/sso-callback') {
  const search = window.location.search;
  window.location.replace(window.location.origin + '/' + search + '#/sso-callback');
} else if (window.location.pathname === '/login') {
  window.location.replace(window.location.origin + '/#/login');
} else if (window.location.pathname === '/signup') {
  window.location.replace(window.location.origin + '/#/signup');
}

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} signInUrl="/login" signUpUrl="/signup">
      <App />
    </ClerkProvider>
  </StrictMode>,
)
