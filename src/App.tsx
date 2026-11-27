import React, { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ScrollToTop } from './components/ScrollToTop';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { ToastProvider } from './context/ToastContext';
import { CartProvider } from './context/CartContext';
import { AdminAuthProvider } from './context/AdminAuthContext';
import { AppRoutes } from './routes';
import { connectBackend } from './services/backend';

export const App: React.FC = () => {
  useEffect(() => {
    void connectBackend();
  }, []);

  return (
    <BrowserRouter>
      <ScrollToTop />
      <ThemeProvider>
        <LanguageProvider>
          <ToastProvider>
            <CartProvider>
              <AdminAuthProvider>
                <AppRoutes />
              </AdminAuthProvider>
            </CartProvider>
          </ToastProvider>
        </LanguageProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};

export default App;
