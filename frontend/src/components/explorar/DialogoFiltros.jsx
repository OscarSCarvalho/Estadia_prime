import { useRef, useState } from 'react';
import Icone from '../Icone.jsx';
import Janela from '../Janela.jsx';
import { TIPOS_SERVICO } from '../../utils/perfis.js';

const centavosParaReais = (centavos) => (centavos ? String(centavos / 100) : '');
const reaisParaCentavos = (reais) => (reais ? Math.round(Number(reais) * 100) : '');

function ConteudoFiltros({ filtros, aoAplicar, aoFechar }) {
  const [precoMin, setPrecoMin] = useState(centavosParaReais(filtros.precoMin));
  const [precoMax, setPrecoMax] = useState(centavosParaReais(filtros.precoMax));
  const [servicos, setServicos] = useState(filtros.servicos ?? []);

  function alternarServico(valor) {
    setServicos((atuais) => (atuais.includes(valor) ? atuais.filter((s) => s !== valor) : [...atuais, valor]));
  }

  function aplicar(evento) {
    evento.preventDefault();
    aoAplicar({ precoMin: reaisParaCentavos(precoMin), precoMax: reaisParaCentavos(precoMax), servicos });
    aoFechar();
  }

  function limpar() {
    setPrecoMin('');
    setPrecoMax('');
    setServicos([]);
  }

  const campoPreco =
    'w-full rounded-xl border border-borda px-4 py-3 text-sm outline-none focus:border-tinta focus:ring-1 focus:ring-tinta';

  return (
    <form onSubmit={aplicar} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <fieldset>
          <legend className="font-titulo text-2xl font-semibold">Faixa de preço</legend>
          <p className="mt-1 text-sm text-grafite">Valor da diária, em reais.</p>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <label className="text-xs font-medium text-grafite">
              Mínimo
              <input type="number" min="0" step="50" inputMode="numeric" placeholder="R$ 0" value={precoMin} onChange={(e) => setPrecoMin(e.target.value)} className={`mt-1 ${campoPreco}`} />
            </label>
            <label className="text-xs font-medium text-grafite">
              Máximo
              <input type="number" min="0" step="50" inputMode="numeric" placeholder="Sem limite" value={precoMax} onChange={(e) => setPrecoMax(e.target.value)} className={`mt-1 ${campoPreco}`} />
            </label>
          </div>
        </fieldset>

        <fieldset className="mt-8 border-t border-linha pt-8">
          <legend className="font-titulo text-2xl font-semibold">Serviços disponíveis na cidade</legend>
          <p className="mt-1 text-sm text-grafite">Mostra só imóveis onde você pode contratar estes serviços.</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {TIPOS_SERVICO.map(({ valor, rotulo }) => {
              const marcado = servicos.includes(valor);
              return (
                <label
                  key={valor}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 text-sm font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ouro-escuro ${
                    marcado ? 'border-tinta bg-areia' : 'border-linha hover:border-grafite'
                  }`}
                >
                  <input type="checkbox" checked={marcado} onChange={() => alternarServico(valor)} className="sr-only" />
                  <Icone nome={valor} tamanho={22} />
                  {rotulo}
                </label>
              );
            })}
          </div>
        </fieldset>
      </div>

      <footer className="flex items-center justify-between border-t border-linha px-6 py-4">
        <button type="button" onClick={limpar} className="text-sm font-semibold underline underline-offset-4">
          Limpar tudo
        </button>
        <button type="submit" className="rounded-xl bg-tinta px-6 py-3 text-sm font-medium text-marfim hover:bg-grafite">
          Aplicar filtros
        </button>
      </footer>
    </form>
  );
}

export default function DialogoFiltros({ filtros, aoAplicar }) {
  const referencia = useRef(null);
  const [aberto, setAberto] = useState(false);
  const quantidadeAtivos = (filtros.precoMin ? 1 : 0) + (filtros.precoMax ? 1 : 0) + (filtros.servicos?.length ?? 0);

  function abrir() {
    setAberto(true);
    referencia.current.showModal();
  }

  function fechar() {
    referencia.current.close();
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="relative flex shrink-0 items-center gap-2 rounded-xl border border-linha bg-white px-4 py-3 text-xs font-semibold hover:border-tinta"
      >
        <Icone nome="filtros" tamanho={16} />
        Filtros
        {quantidadeAtivos > 0 && (
          <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-tinta text-[10px] text-marfim">
            {quantidadeAtivos}
          </span>
        )}
      </button>

      <Janela referencia={referencia} titulo="Filtros" rotuloFechar="Fechar filtros" aoFechar={() => setAberto(false)}>
        {aberto && <ConteudoFiltros filtros={filtros} aoAplicar={aoAplicar} aoFechar={fechar} />}
      </Janela>
    </>
  );
}
