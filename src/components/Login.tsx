import { useState } from 'react';
import { Loader2, Lock, Mail, LogIn } from 'lucide-react';
import loginLogo from '/images/Logo.png';

const AUTH_API_URL = 'https://login-transcriptor.onrender.com/api/auth';

interface LoginProps {
  onLoginSuccess: (userData: any) => void;
}

export function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Por favor completa todos los campos');
      return;
    }

    console.log('🔐 [LOGIN] Iniciando sesión...');
    console.log('📧 Email:', email);
    console.log('🌐 API URL:', AUTH_API_URL);
    
    setLoading(true);
    setError(null);

    try {
      const loginStartTime = Date.now();
      
      console.log('📤 [LOGIN] Enviando petición a:', `${AUTH_API_URL}/login`);
      
      const response = await fetch(`${AUTH_API_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const loginEndTime = Date.now();
      const loginTime = ((loginEndTime - loginStartTime) / 1000).toFixed(2);
      console.log(`✅ [LOGIN] Respuesta recibida en ${loginTime}s | Status: ${response.status}`);

      const data = await response.json();
      console.log('📦 [LOGIN] Respuesta:', data);

      if (!response.ok) {
        // Manejar errores HTTP
        if (response.status === 400) {
          setError('Por favor completa todos los campos correctamente');
        } else if (response.status === 401) {
          setError('Correo o contraseña incorrectos');
        } else if (response.status === 500) {
          setError('Error del servidor. Intenta más tarde');
        } else {
          setError(data.message || 'Error al iniciar sesión');
        }
        console.error('❌ [LOGIN] Error HTTP:', response.status, data);
        return;
      }

      if (data.success) {
        // Guardar token en localStorage
        localStorage.setItem('token', data.data.token);
        localStorage.setItem('user', JSON.stringify(data.data.user));
        
        console.log('✅ [LOGIN] Token guardado en localStorage');
        console.log('👤 [LOGIN] Usuario:', data.data.user.email);
        
        // Notificar al componente padre
        onLoginSuccess(data.data);
      } else {
        console.error('❌ [LOGIN] Error:', data.message);
        setError(data.message || 'Error al iniciar sesión');
      }
    } catch (err) {
      console.error('❌ [LOGIN CRÍTICO] Error completo:', err);
      
      if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
        setError('No se pudo conectar al servidor. Verifica tu conexión a internet o que el servidor esté disponible.');
        console.error('❌ [LOGIN] Posibles causas:');
        console.error('   - Servidor no disponible');
        console.error('   - Problema de CORS');
        console.error('   - Sin conexión a internet');
        console.error('   - URL incorrecta:', AUTH_API_URL);
      } else {
        setError('Error inesperado. Por favor intenta de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#003B7E] via-[#1976D2] to-[#00BCD4] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        {/* Header with Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <img 
              src={loginLogo} 
              alt="STA Logo" 
              className="w-32 h-32 object-contain"
            />
          </div>
          <h1 className="mb-2 text-[#003B7E]">Iniciar Sesión</h1>
          <p className="text-[#4A5568]">
            Sistema de Transcripción Automática
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email Field */}
          <div>
            <label htmlFor="email" className="block mb-2 text-sm">
              Correo electrónico
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="w-5 h-5 text-[var(--color-secondary)]" />
              </div>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
                placeholder="usuario@ejemplo.com"
                disabled={loading}
                autoComplete="email"
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label htmlFor="password" className="block mb-2 text-sm">
              Contraseña
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="w-5 h-5 text-[var(--color-secondary)]" />
              </div>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
                placeholder="••••••••"
                disabled={loading}
                autoComplete="current-password"
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] text-white py-3 rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Iniciando sesión...
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                Iniciar Sesión
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-sm text-[var(--color-secondary)]">
            ¿Problemas para acceder? Contacta al administrador
          </p>
        </div>
      </div>
    </div>
  );
}