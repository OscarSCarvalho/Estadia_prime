import { useContext } from 'react';
import { AuthContexto } from '../contexto/AuthContexto.js';

export function useAuth() {
  const contexto = useContext(AuthContexto);
  if (!contexto) throw new Error('useAuth precisa estar dentro de <ProvedorAuth>');
  return contexto;
}
