import { useRef, useState } from 'react';
import { Link } from 'react-router';
import Icone from '../Icone.jsx';
import { comportamentoRolagem } from '../../utils/rolagem.js';

// Fotos do card: no celular desliza com o dedo; no computador, setas ao passar o mouse.
// A faixa de fotos é um link (clicar na foto abre o imóvel) fora da ordem do Tab: o link
// acessível do card é o título. As setas ficam fora do link (botão dentro de link é inválido)
export default function CarrosselFotos({ fotos, descricao, selo, destino, estadoDestino }) {
  const faixa = useRef(null);
  const [indice, setIndice] = useState(0);
  const ultima = fotos.length - 1;

  function irPara(novoIndice) {
    const alvo = Math.min(Math.max(novoIndice, 0), ultima);
    faixa.current.scrollTo({ left: alvo * faixa.current.clientWidth, behavior: comportamentoRolagem() });
  }

  function aoRolar() {
    const { scrollLeft, clientWidth } = faixa.current;
    setIndice(Math.round(scrollLeft / clientWidth));
  }

  const estiloSeta =
    'absolute top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-tinta opacity-0 shadow transition-opacity hover:bg-white focus-visible:opacity-100 group-hover:opacity-100 pointer-coarse:hidden';

  return (
    <div className="relative aspect-[20/19] overflow-hidden rounded-2xl bg-areia">
      <Link
        ref={faixa}
        to={destino}
        state={estadoDestino}
        tabIndex={-1}
        aria-hidden="true"
        draggable={false}
        onScroll={aoRolar}
        className="flex h-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {fotos.map((url, posicao) => (
          <img
            key={url}
            src={url}
            alt={posicao === 0 ? descricao : ''}
            loading="lazy"
            draggable={false}
            className="h-full w-full shrink-0 snap-center object-cover"
          />
        ))}
      </Link>

      {selo && (
        <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-tinta shadow-sm">
          {selo}
        </span>
      )}

      {fotos.length > 1 && (
        <>
          {indice > 0 && (
            <button type="button" aria-label="Foto anterior" onClick={() => irPara(indice - 1)} className={`${estiloSeta} left-3`}>
              <Icone nome="anterior" tamanho={16} />
            </button>
          )}
          {indice < ultima && (
            <button type="button" aria-label="Próxima foto" onClick={() => irPara(indice + 1)} className={`${estiloSeta} right-3`}>
              <Icone nome="proximo" tamanho={16} />
            </button>
          )}
          <div aria-hidden="true" className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {fotos.map((url, posicao) => (
              <span
                key={url}
                className={`h-1.5 w-1.5 rounded-full shadow-sm transition-colors ${posicao === indice ? 'bg-white' : 'bg-white/55'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
