/* eslint-disable react/react-in-jsx-scope */
import { useState, useEffect } from 'react';
import { TranscribeFile } from './components/TranscribeFile';
import { Login } from './components/Login';
import { LogOut } from 'lucide-react';
import systemLogo from '/images/Logo_STA.png';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar si hay un token guardado al cargar la aplicación
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (token && storedUser) {
      console.log('✅ [AUTH] Token encontrado en localStorage');
      setIsAuthenticated(true);
      setUser(JSON.parse(storedUser));
    } else {
      console.log('❌ [AUTH] No hay sesión activa');
    }
    
    setLoading(false);
  }, []);

  const handleLoginSuccess = (userData: any) => {
    setIsAuthenticated(true);
    setUser(userData.user);
  };

  const handleLogout = () => {
    console.log('🚪 [AUTH] Cerrando sesión...');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
    console.log('✅ [AUTH] Sesión cerrada');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-accent)] mx-auto mb-4"></div>
          <p className="text-[var(--color-secondary)]">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-gray-50 to-blue-50">
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
                <h1 className="mb-1 text-[#003B7E]">Sistema de Transcripción Automática</h1>
                {user && (
                  <p className="text-sm text-[#4A5568]">
                    Bienvenido, <strong>{user.email}</strong>
                  </p>
                )}
              </div>
            </div>
            
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#1976D2] to-[#00BCD4] text-white rounded-lg hover:shadow-lg transition-all"
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