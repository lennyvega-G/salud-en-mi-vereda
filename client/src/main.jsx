import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './estilos.css';

createRoot(document.getElementById('root')).render(<App />);

// Registro del service worker para que la aplicación funcione sin conexión
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
}
