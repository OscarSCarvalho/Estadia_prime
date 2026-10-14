import { useState } from 'react';
import CampoTexto from './CampoTexto.jsx';

export default function CampoSenha(props) {
  const [visivel, setVisivel] = useState(false);

  return (
    <CampoTexto
      {...props}
      type={visivel ? 'text' : 'password'}
      acessorio={
        <button
          type="button"
          onClick={() => setVisivel((atual) => !atual)}
          aria-pressed={visivel}
          aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
          className="rounded-md px-2 py-1 text-xs font-medium text-ouro-escuro hover:bg-areia"
        >
          {visivel ? 'Ocultar' : 'Mostrar'}
        </button>
      }
    />
  );
}
