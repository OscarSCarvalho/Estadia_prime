import { useState } from 'react';
import Icone from '../Icone.jsx';
import { Estrelas } from './Estrelas.jsx';
import { CarregandoSimples } from '../Esqueletos.jsx';
import { useDados } from '../../hooks/useDados.js';
import { listarAvaliacoes } from '../../services/avaliacoes.js';
import { formatarMesAno, formatarNota } from '../../utils/formatacao.js';

function ItemAvaliacao({ avaliacao }) {
  return (
    <li className="break-inside-avoid">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-areia font-titulo text-lg font-semibold"
        >
          {avaliacao.autor.charAt(0).toUpperCase()}
        </span>
        <div>
          <p className="font-semibold">{avaliacao.autor}</p>
          <p className="text-sm text-grafite">{formatarMesAno(avaliacao.data)}</p>
        </div>
      </div>
      <div className="mt-2">
        <Estrelas nota={avaliacao.nota} tamanho={13} />
      </div>
      {avaliacao.comentario && <p className="mt-1.5 whitespace-pre-line leading-relaxed text-tinta/90">{avaliacao.comentario}</p>}
    </li>
  );
}

// H7.2: nota média e comentários de um imóvel ou serviço. `alvo`: { tipo: 'imovel' | 'servico', id }.
// Ao trocar de alvo, use `key` para recomeçar do zero
export default function ListaAvaliacoes({ alvo, textoVazio = 'Ainda sem avaliações.', duasColunas = false }) {
  const { dados, erro, carregando, recarregar } = useDados(`avaliacoes|${alvo.tipo}|${alvo.id}`, () => listarAvaliacoes(alvo));
  const [paginasExtras, setPaginasExtras] = useState([]);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [erroMais, setErroMais] = useState('');

  if (carregando) return <CarregandoSimples className="py-8" />;
  if (erro) {
    return (
      <p role="alert" className="py-6 text-grafite">
        Não foi possível carregar as avaliações.{' '}
        <button type="button" onClick={recarregar} className="font-medium text-tinta underline underline-offset-4">
          Tentar de novo
        </button>
      </p>
    );
  }
  if (dados.total_avaliacoes === 0) return <p className="py-2 text-grafite">{textoVazio}</p>;

  // Uma avaliação nova entre uma página e outra empurra as demais: a repetida aparece uma vez só
  const porId = new Map([...dados.avaliacoes, ...paginasExtras.flatMap((pagina) => pagina.avaliacoes)].map((item) => [item.id, item]));
  const avaliacoes = [...porId.values()];
  const ultimaPagina = paginasExtras.at(-1)?.pagina ?? dados.pagina;
  const temMais = ultimaPagina < dados.total_paginas;

  async function mostrarMais() {
    setCarregandoMais(true);
    setErroMais('');
    try {
      const proxima = await listarAvaliacoes(alvo, ultimaPagina + 1);
      setPaginasExtras((atuais) => [...atuais, proxima]);
    } catch (falha) {
      setErroMais(falha.message);
    } finally {
      setCarregandoMais(false);
    }
  }

  return (
    <div>
      <p className="flex items-center gap-2 text-xl font-semibold">
        <Icone nome="estrela" tamanho={20} preenchido />
        {formatarNota(dados.nota_media)}
        <span aria-hidden="true">·</span>
        {dados.total_avaliacoes} {dados.total_avaliacoes === 1 ? 'avaliação' : 'avaliações'}
      </p>

      <ul className={`mt-6 grid gap-8 ${duasColunas ? 'md:grid-cols-2 md:gap-x-12' : ''}`}>
        {avaliacoes.map((avaliacao) => (
          <ItemAvaliacao key={avaliacao.id} avaliacao={avaliacao} />
        ))}
      </ul>

      {temMais && (
        <button
          type="button"
          onClick={mostrarMais}
          disabled={carregandoMais}
          className="mt-8 rounded-xl border border-tinta px-6 py-3 text-sm font-medium hover:bg-tinta hover:text-marfim disabled:cursor-wait disabled:opacity-60"
        >
          {carregandoMais ? 'Carregando…' : 'Mostrar mais avaliações'}
        </button>
      )}
      {erroMais && (
        <p role="alert" className="mt-2 text-sm text-erro">
          {erroMais}
        </p>
      )}
    </div>
  );
}
