/* eslint-disable react/react-in-jsx-scope */
import { useState, useEffect } from 'react';
import { TranscribeFile } from './components/TranscribeFile';
import { Login } from './components/Login';
import { LogOut } from 'lucide-react';
import systemLogo from '/images/LogoCircular.png';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (token && storedUser) {
      console.log('[AUTH] Token encontrado en localStorage');
      setIsAuthenticated(true);
      setUser(JSON.parse(storedUser));
    } else {
      console.log('[AUTH] No hay sesión activa');
    }
    
    setLoading(false);
  }, []);

  const handleLoginSuccess = (userData: any) => {
    setIsAuthenticated(true);
    setUser(userData.user);
  };

  const handleLogout = () => {
    console.log('[AUTH] Cerrando sesión...');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
    console.log('[AUTH] Sesión cerrada');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          {/* 🎨 ANTES: border-[var(--color-accent)] (azul) */}
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: '#8B2035' }}></div>
          {/* 🎨 ANTES: text-[var(--color-secondary)] (azul) */}
          <p style={{ color: '#8B2035' }}>Cargando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-gray-50 to-red-50">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img 
                src={systemLogo} 
                alt="STA Logo" 
                className="h-16 w-auto object-contain"
              />
              <div>
                {/* 🎨 ANTES: text-[#003B7E] (azul oscuro) */}
                <h1 className="mb-1" style={{ color: '#3D0A14' }}>Sistema de Transcripción Automática</h1>
                {user && (
                  <p className="text-sm text-[#4A5568]">
                    Bienvenido, <strong>{user.email}</strong>
                  </p>
                )}
              </div>
            </div>
            
            {/* 🎨 ANTES: from-[#1976D2] to-[#00BCD4] (azul) */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-5 py-2.5 text-white rounded-lg hover:shadow-lg transition-all"
              style={{ background: 'linear-gradient(to right, #8B2035, #3D0A14)' }}
            >
              <LogOut className="w-4 h-4" />
              Cerrar Sesión
            </button>
          </div>
        </div>

        {/* Content */}
        <TranscribeFile />
      </div>
    </div>
  );
}