import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/manrope';
import '@fontsource/ibm-plex-mono/latin-400.css';
import App from './App';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Popup root element missing');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
