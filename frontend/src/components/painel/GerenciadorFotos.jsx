import { useRef, useState } from 'react';
import Icone from '../Icone.jsx';
import { enviarFotos, removerFoto, reordenarFotos } from '../../services/painel.js';

const LIMITE_FOTOS = 10;
const TAMANHO_MAXIMO_MB = 5;
const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp'];

// Conferência rápida antes de enviar, só para avisar na hora. Quem decide é o servidor,
// que confere o conteúdo real do arquivo (CB15)
function problemaNosArquivos(arquivos, vagas) {
  if (arquivos.length > vagas) {
    return vagas === 0
      ? `O imóvel já tem ${LIMITE_FOTOS} fotos, o limite. Remova alguma para enviar outra.`
      : `Você pode enviar mais ${vagas} ${vagas === 1 ? 'foto' : 'fotos'} (limite de ${LIMITE_FOTOS}).`;
  }
  const grande = arquivos.find((arquivo) => arquivo.size > TAMANHO_MAXIMO_MB * 1024 * 1024);
  if (grande) return `"${grande.name}" passa de ${TAMANHO_MAXIMO_MB} MB.`;
  const outroTipo = arquivos.find((arquivo) => !TIPOS_ACEITOS.includes(arquivo.type));
  if (outroTipo) return `"${outroTipo.name}" não é uma foto JPG, PNG ou WEBP.`;
  return null;
}

function mover(lista, de, para) {
  const nova = [...lista];
  const [item] = nova.splice(de, 1);
  nova.splice(para, 0, item);
  return nova;
}

// H2.2: enviar, ordenar (arrastando ou pelos botões) e remover fotos. A primeira é a capa
export default function GerenciadorFotos({ imovelId, fotos, aoMudar }) {
  const [ocupado, setOcupado] = useState(null);
  const [erro, setErro] = useState('');
  const [arrastando, setArrastando] = useState(null);
  const seletor = useRef(null);
  const vagas = LIMITE_FOTOS - fotos.length;

  // `desfazer`: volta a tela ao estado anterior se a API recusar (ex.: reordenação otimista)
  async function executar(descricao, acao, desfazer) {
    setOcupado(descricao);
    setErro('');
    try {
      aoMudar(await acao());
    } catch (falha) {
      desfazer?.();
      setErro(falha.message);
    } finally {
      setOcupado(null);
    }
  }

  function aoEscolherArquivos(evento) {
    const arquivos = [...evento.target.files];
    evento.target.value = '';
    if (arquivos.length === 0) return;
    const problema = problemaNosArquivos(arquivos, vagas);
    if (problema) {
      setErro(problema);
      return;
    }
    const texto = arquivos.length === 1 ? 'Enviando a foto…' : `Enviando ${arquivos.length} fotos…`;
    executar(texto, () => enviarFotos(imovelId, arquivos));
  }

  function reordenar(de, para) {
    if (de === para || para < 0 || para >= fotos.length) return;
    const ordemAnterior = fotos;
    const novaOrdem = mover(fotos, de, para);
    aoMudar(novaOrdem);
    executar(
      'Salvando a ordem…',
      () => reordenarFotos(imovelId, novaOrdem.map((foto) => foto.id)),
      () => aoMudar(ordemAnterior),
    );
  }

  function remover(foto, posicao) {
    if (!window.confirm(`Remover a foto ${posicao + 1}? Essa ação não pode ser desfeita.`)) return;
    executar('Removendo a foto…', () => removerFoto(imovelId, foto.id));
  }

  const botaoIcone =
    'inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-tinta shadow-sm hover:bg-white disabled:opacity-40';

  return (
    <section aria-labelledby="titulo-fotos">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="titulo-fotos" className="font-titulo text-3xl font-semibold">
            Fotos
          </h2>
          <p className="mt-1 text-sm text-grafite">
            {fotos.length} de {LIMITE_FOTOS} · JPG, PNG ou WEBP até {TAMANHO_MAXIMO_MB} MB · arraste para mudar a ordem
          </p>
        </div>
        <button
          type="button"
          onClick={() => seletor.current.click()}
          disabled={Boolean(ocupado) || vagas === 0}
          className="inline-flex items-center gap-2 rounded-full border border-tinta px-5 py-2.5 text-sm font-medium hover:bg-tinta hover:text-marfim disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Icone nome="mais" tamanho={16} /> Adicionar fotos
        </button>
        <input
          ref={seletor}
          type="file"
          accept={TIPOS_ACEITOS.join(',')}
          multiple
          onChange={aoEscolherArquivos}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>

      {erro && (
        <p role="alert" className="mt-4 rounded-lg border border-erro/30 bg-erro-fundo px-4 py-3 text-sm text-erro">
          {erro}
        </p>
      )}
      <p role="status" className="mt-2 min-h-5 text-sm text-ouro-escuro">
        {ocupado}
      </p>

      {fotos.length === 0 ? (
        <button
          type="button"
          onClick={() => seletor.current.click()}
          disabled={Boolean(ocupado)}
          className="mt-2 flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-linha px-6 py-14 text-center hover:border-grafite"
        >
          <Icone nome="mais" tamanho={28} className="text-grafite" />
          <span className="font-medium">Envie as fotos do imóvel</span>
          <span className="text-sm text-grafite">Sem fotos, o imóvel não aparece na busca. A primeira vira a capa.</span>
        </button>
      ) : (
        <ol className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {fotos.map((foto, posicao) => (
            <li
              key={foto.id}
              draggable={!ocupado}
              onDragStart={() => setArrastando(posicao)}
              onDragEnd={() => setArrastando(null)}
              onDragOver={(evento) => evento.preventDefault()}
              onDrop={(evento) => {
                evento.preventDefault();
                if (arrastando !== null) reordenar(arrastando, posicao);
                setArrastando(null);
              }}
              className={`group relative aspect-[4/3] cursor-grab overflow-hidden rounded-xl bg-areia active:cursor-grabbing ${
                arrastando === posicao ? 'opacity-40' : ''
              }`}
            >
              <img src={foto.url_foto} alt={`Foto ${posicao + 1}`} className="h-full w-full object-cover" draggable={false} />
              {posicao === 0 && (
                <span className="absolute left-2 top-2 rounded-full bg-tinta px-2.5 py-0.5 text-xs font-semibold text-marfim">
                  Capa
                </span>
              )}
              <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-1">
                <div className="flex gap-1">
                  <button
                    type="button"
                    className={`${botaoIcone} ${posicao === 0 ? 'invisible' : ''}`}
                    disabled={Boolean(ocupado) || posicao === 0}
                    onClick={() => reordenar(posicao, posicao - 1)}
                  >
                    <Icone nome="anterior" tamanho={16} rotulo={`Mover a foto ${posicao + 1} para antes`} />
                  </button>
                  <button
                    type="button"
                    className={`${botaoIcone} ${posicao === fotos.length - 1 ? 'invisible' : ''}`}
                    disabled={Boolean(ocupado) || posicao === fotos.length - 1}
                    onClick={() => reordenar(posicao, posicao + 1)}
                  >
                    <Icone nome="proximo" tamanho={16} rotulo={`Mover a foto ${posicao + 1} para depois`} />
                  </button>
                </div>
                <div className="flex gap-1">
                  {posicao > 0 && (
                    <button
                      type="button"
                      className={botaoIcone}
                      disabled={Boolean(ocupado)}
                      onClick={() => reordenar(posicao, 0)}
                    >
                      <Icone nome="estrela" tamanho={16} rotulo={`Usar a foto ${posicao + 1} como capa`} />
                    </button>
                  )}
                  <button
                    type="button"
                    className={botaoIcone}
                    disabled={Boolean(ocupado)}
                    onClick={() => remover(foto, posicao)}
                  >
                    <Icone nome="lixeira" tamanho={16} rotulo={`Remover a foto ${posicao + 1}`} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
