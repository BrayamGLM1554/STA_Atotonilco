import { Code2 } from 'lucide-react';

/**
 * COMPONENTE DE CRÉDITOS DE DESARROLLADORES
 * 
 * ⚠️ ADVERTENCIA: Este componente está protegido por CODEOWNERS
 * Cualquier modificación requiere aprobación explícita de los autores.
 * 
 * Para modificar este archivo, consulta las reglas en .github/CODEOWNERS
 */

export const DEVELOPERS = [
  'Ing. Brayam Gilberto López Morales',
  'Ing. Arturo Darinel López Castillo',
  'Ing. Juan Mateo Hernández de Luna',
] as const;

interface DeveloperCreditsProps {
  variant?: 'watermark' | 'footer' | 'compact';
  className?: string;
}

export function DeveloperCredits({ variant = 'watermark', className = '' }: DeveloperCreditsProps) {
  if (variant === 'watermark') {
    return (
      <div className={`bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 rounded-xl shadow-sm border border-blue-100 ${className}`}>
        <div className="px-6 py-3">
          <div className="flex items-center justify-center gap-2 text-sm">
            <Code2 className="w-4 h-4 text-[#1976D2]" />
            <span className="font-medium text-[#003B7E]">Desarrollado por:</span>
            <span className="text-[#4A5568] font-semibold">
              {DEVELOPERS.join(', ')}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'footer') {
    return (
      <div className={`text-xs text-[var(--color-secondary)] ${className}`}>
        <p className="font-medium mb-1">Desarrollado por:</p>
        {DEVELOPERS.map((dev, index) => (
          <p key={index}>{dev}</p>
        ))}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`text-xs text-[#4A5568] text-center ${className}`}>
        <p className="mb-1">Desarrollado por:</p>
        {DEVELOPERS.map((dev, index) => (
          <p key={index}>{dev}</p>
        ))}
      </div>
    );
  }

  return null;
}

/**
 * Hook para obtener los nombres de desarrolladores
 * Útil cuando necesitas los nombres como strings
 */
export function useDevelopers() {
  return {
    developers: DEVELOPERS,
    developersString: DEVELOPERS.join(', '),
    developersArray: [...DEVELOPERS],
  };
}