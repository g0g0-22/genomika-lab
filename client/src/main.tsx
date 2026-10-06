import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { LangProvider } from './i18n';
import { ThemeProvider } from './lib/theme';
import { AuthProvider } from './lib/auth';
import './styles/app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <LangProvider>
        <AuthProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthProvider>
      </LangProvider>
    </ThemeProvider>
  </StrictMode>
);
