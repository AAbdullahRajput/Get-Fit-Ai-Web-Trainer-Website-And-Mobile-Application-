import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Route helper: Convert clean pathname SSO redirects into hash routes for HashRouter compatibility
if (window.location.pathname === '/sso-callback') {
  const search = window.location.search || '';
  const hash = window.location.hash || '';
  const hashParams = hash.replace('#', '');
  const connector = search ? '&' : '?';
  const finalParams = hashParams ? `${search}${connector}${hashParams}` : search;
  window.location.replace(window.location.origin + '/#/sso-callback' + finalParams);
} else if (window.location.pathname === '/login') {
  window.location.replace(window.location.origin + '/#/login');
} else if (window.location.pathname === '/signup') {
  window.location.replace(window.location.origin + '/#/signup');
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
