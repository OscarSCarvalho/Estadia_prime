import { Link, useNavigate } from 'react-router';
import FormularioImovel from '../../components/painel/FormularioImovel.jsx';
import { cadastrarImovel } from '../../services/painel.js';

// H2.1. Depois de salvar, segue para a tela do imóvel, onde entram as fotos
export default function NovoImovel() {
  const navegar = useNavigate();

  async function salvar(dados) {
    const imovel = await cadastrarImovel(dados);
    navegar(`/painel/imoveis/${imovel.id}`, { state: { recemCadastrado: true } });
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link to="/painel/imoveis" className="text-sm font-medium text-grafite hover:text-tinta">
        ← Meus imóveis
      </Link>
      <h1 className="mt-4 font-titulo text-5xl font-semibold">Cadastrar imóvel</h1>
      <p className="mt-3 text-grafite">Primeiro os dados e a diária. Na próxima tela você envia as fotos.</p>

      <div className="mt-10 rounded-2xl border border-linha bg-white p-6 sm:p-8">
        <FormularioImovel textoBotao="Salvar e enviar fotos" textoSalvando="Salvando…" aoSalvar={salvar} />
      </div>
    </div>
  );
}
