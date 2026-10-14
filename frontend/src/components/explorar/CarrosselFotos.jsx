import { useState } from 'react';
import Icone from '../Icone.jsx';

// Usado dentro de um card que é link: os botões não podem disparar a navegação do card
function impedirNavegacao(evento) {
  evento.preventDefault();
  evento.stopPropagation();
}

export default function CarrosselFotos({ fotos, descricao, selo }) {
  const [indice, setIndice] = useState(0);
  const ultima = fotos.length - 1;

  function irPara(evento, novoIndice) {
    impedirNavegacao(evento);
    setIndice(Math.min(Math.max(novoIndice, 0), ultima));
  }

  const estiloSeta =
    'absolute top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-tinta opacity-0 shadow transition-opacity hover:bg-white focus-visible:opacity-100 group-hover:opacity-100';

  return (
    <div className="relative aspect-[20/19] overflow-hidden rounded-2xl bg-areia">
      <div
        className="flex h-full transition-transform duration-300 ease-out"
        style={{ transform: `translateX(-${indice * 100}%)` }}
      >
        {fotos.map((url, posicao) => (
          <img
            key={url}
            src={url}
            alt={posicao === indice ? descricao : ''}
            loading="lazy"
            className="h-full w-full shrink-0 object-cover"
          />
        ))}
      </div>

      {selo && (
        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-tinta shadow-sm">
          {selo}
        </span>
      )}

      {fotos.length > 1 && (
        <>
          {indice > 0 && (
            <button type="button" aria-label="Foto anterior" onClick={(e) => irPara(e, indice - 1)} className={`${estiloSeta} left-3`}>
              <Icone nome="anterior" tamanho={16} />
            </button>
          )}
          {indice < ultima && (
            <button type="button" aria-label="Próxima foto" onClick={(e) => irPara(e, indice + 1)} className={`${estiloSeta} right-3`}>
              <Icone nome="proximo" tamanho={16} />
            </button>
          )}
          <div aria-hidden="true" className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {fotos.map((url, posicao) => (
              <span
                key={url}
                className={`h-1.5 w-1.5 rounded-full transition-colors ${posicao === indice ? 'bg-white' : 'bg-white/55'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
