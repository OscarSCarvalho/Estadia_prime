import { useState } from 'react';
import Icone from '../Icone.jsx';

const NOTAS = [1, 2, 3, 4, 5];
const ROTULO_NOTA = { 1: 'Ruim', 2: 'Regular', 3: 'Boa', 4: 'Muito boa', 5: 'Excelente' };

// Nota já dada, só para leitura
export function Estrelas({ nota, tamanho = 14 }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-ouro-escuro">
      {NOTAS.map((posicao) => (
        <Icone key={posicao} nome="estrela" tamanho={tamanho} preenchido={posicao <= nota} />
      ))}
      <span className="sr-only">Nota {nota} de 5</span>
    </span>
  );
}

// Escolha da nota: um grupo de botões de rádio com cara de estrelas (funciona com teclado e leitor de tela)
export function SeletorNota({ nome, nota, aoEscolher, legenda = 'Sua nota', erro }) {
  const [emDestaque, setEmDestaque] = useState(null);
  const notaVisivel = emDestaque ?? nota;

  return (
    <fieldset aria-invalid={erro ? 'true' : undefined}>
      <legend className="text-sm font-medium">{legenda}</legend>
      <div className="mt-1 flex items-center gap-3">
        <div className="flex" onMouseLeave={() => setEmDestaque(null)}>
          {NOTAS.map((valor) => (
            <label
              key={valor}
              onMouseEnter={() => setEmDestaque(valor)}
              className="cursor-pointer rounded-md p-1 text-ouro-escuro has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ouro-escuro"
            >
              <input
                type="radio"
                name={nome}
                value={valor}
                checked={nota === valor}
                onChange={() => aoEscolher(valor)}
                className="sr-only"
              />
              <Icone nome="estrela" tamanho={28} preenchido={valor <= (notaVisivel ?? 0)} />
              <span className="sr-only">
                {valor} {valor === 1 ? 'estrela' : 'estrelas'}, {ROTULO_NOTA[valor]}
              </span>
            </label>
          ))}
        </div>
        <span aria-hidden="true" className="text-sm text-grafite">
          {notaVisivel ? ROTULO_NOTA[notaVisivel] : ''}
        </span>
      </div>
      {erro && <p className="mt-1 text-sm text-erro">{erro}</p>}
    </fieldset>
  );
}
