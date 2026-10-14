import { Link } from 'react-router';
import Icone from '../Icone.jsx';

const ABAS = [
  { valor: 'imoveis', rotulo: 'Imóveis', icone: 'casa', destino: '/explorar' },
  { valor: 'servicos', rotulo: 'Serviços', icone: 'mordomo', destino: '/explorar?aba=servicos' },
];

export default function AbasExplorar({ abaAtiva }) {
  return (
    <nav aria-label="O que explorar" className="flex justify-center gap-8">
      {ABAS.map((aba) => {
        const ativa = aba.valor === abaAtiva;
        return (
          <Link
            key={aba.valor}
            to={aba.destino}
            aria-current={ativa ? 'page' : undefined}
            className={`flex items-center gap-2 border-b-2 pb-3 pt-1 text-sm font-medium transition-colors ${
              ativa ? 'border-tinta text-tinta' : 'border-transparent text-grafite hover:text-tinta'
            }`}
          >
            <Icone nome={aba.icone} tamanho={22} className={ativa ? 'text-ouro-escuro' : ''} />
            {aba.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
