import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ChatDockProvider } from './context/ChatDockContext';
import { ThemeProvider } from './context/ThemeContext';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root was not found in index.html.');

createRoot(container).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        {/* Inside AuthProvider: the dock polls as the signed-in account and has
            to be cleared when that account changes. */}
        <ChatDockProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ChatDockProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
);
