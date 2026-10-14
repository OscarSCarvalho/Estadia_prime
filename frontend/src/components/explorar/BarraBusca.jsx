import { useId, useState } from 'react';
import Icone from '../Icone.jsx';
import { TIPOS_SERVICO } from '../../utils/perfis.js';
import { hojeIso } from '../../utils/formatacao.js';

function Segmento({ rotulo, children, className = '' }) {
  const id = useId();
  return (
    <div
      className={`flex min-w-0 flex-1 flex-col rounded-full px-6 py-2.5 transition-colors focus-within:bg-areia hover:bg-areia ${className}`}
    >
      <label htmlFor={id} className="text-xs font-semibold text-tinta">
        {rotulo}
      </label>
      {children(id)}
    </div>
  );
}

const estiloCampo = 'w-full truncate bg-transparent text-sm text-grafite outline-none';

function BotaoBuscar() {
  return (
    <button
      type="submit"
      className="m-1.5 flex shrink-0 items-center justify-center gap-2 rounded-full bg-tinta px-4 py-3 text-sm font-medium text-marfim transition-colors hover:bg-ouro-escuro md:px-5"
    >
      <Icone nome="busca" tamanho={18} />
      <span>Buscar</span>
    </button>
  );
}

function Divisor() {
  return <span aria-hidden="true" className="hidden h-8 w-px shrink-0 bg-linha md:block" />;
}

const estiloBarra =
  'mx-auto flex max-w-4xl flex-col rounded-3xl border border-linha bg-white shadow-[0_6px_20px_rgba(28,27,31,0.08)] md:flex-row md:items-center md:rounded-full';

export function BarraBuscaImoveis({ filtros, cidades, aoBuscar }) {
  const [cidade, setCidade] = useState(filtros.cidade ?? '');
  const [checkin, setCheckin] = useState(filtros.checkin ?? '');
  const [checkout, setCheckout] = useState(filtros.checkout ?? '');
  const [hospedes, setHospedes] = useState(filtros.hospedes ?? '');
  const hoje = hojeIso();

  function aoEnviar(evento) {
    evento.preventDefault();
    aoBuscar({ cidade, checkin, checkout: checkout > checkin ? checkout : '', hospedes });
  }

  function aoMudarCheckin(valor) {
    setCheckin(valor);
    if (checkout && checkout <= valor) setCheckout('');
  }

  return (
    <form role="search" onSubmit={aoEnviar} className={estiloBarra}>
      <Segmento rotulo="Onde" className="md:flex-[1.4]">
        {(id) => (
          <select id={id} value={cidade} onChange={(e) => setCidade(e.target.value)} className={estiloCampo}>
            <option value="">Qualquer destino</option>
            {cidades.map(({ cidade: nome, estado }) => (
              <option key={nome} value={nome}>
                {estado ? `${nome}, ${estado}` : nome}
              </option>
            ))}
          </select>
        )}
      </Segmento>
      <Divisor />
      <Segmento rotulo="Check-in">
        {(id) => (
          <input id={id} type="date" min={hoje} value={checkin} onChange={(e) => aoMudarCheckin(e.target.value)} className={estiloCampo} />
        )}
      </Segmento>
      <Divisor />
      <Segmento rotulo="Check-out">
        {(id) => (
          <input
            id={id}
            type="date"
            min={checkin || hoje}
            value={checkout}
            onChange={(e) => setCheckout(e.target.value)}
            className={estiloCampo}
          />
        )}
      </Segmento>
      <Divisor />
      <Segmento rotulo="Hóspedes">
        {(id) => (
          <select id={id} value={hospedes} onChange={(e) => setHospedes(e.target.value)} className={estiloCampo}>
            <option value="">Quantos?</option>
            {Array.from({ length: 16 }, (_, i) => i + 1).map((quantidade) => (
              <option key={quantidade} value={quantidade}>
                {quantidade} {quantidade === 1 ? 'hóspede' : 'hóspedes'}
              </option>
            ))}
          </select>
        )}
      </Segmento>
      <BotaoBuscar />
    </form>
  );
}

export function BarraBuscaServicos({ filtros, cidades, aoBuscar }) {
  const [cidade, setCidade] = useState(filtros.cidade ?? '');
  const [tipoServico, setTipoServico] = useState(filtros.tipoServico ?? '');

  function aoEnviar(evento) {
    evento.preventDefault();
    aoBuscar({ cidade, tipoServico });
  }

  return (
    <form role="search" onSubmit={aoEnviar} className={`${estiloBarra} md:max-w-2xl`}>
      <Segmento rotulo="Onde">
        {(id) => (
          <select id={id} value={cidade} onChange={(e) => setCidade(e.target.value)} className={estiloCampo}>
            <option value="">Qualquer destino</option>
            {cidades.map(({ cidade: nome, estado }) => (
              <option key={nome} value={nome}>
                {estado ? `${nome}, ${estado}` : nome}
              </option>
            ))}
          </select>
        )}
      </Segmento>
      <Divisor />
      <Segmento rotulo="Serviço">
        {(id) => (
          <select id={id} value={tipoServico} onChange={(e) => setTipoServico(e.target.value)} className={estiloCampo}>
            <option value="">Todos os serviços</option>
            {TIPOS_SERVICO.map(({ valor, rotulo }) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        )}
      </Segmento>
      <BotaoBuscar />
    </form>
  );
}
