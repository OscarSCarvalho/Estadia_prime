// Cadastra imóveis e serviços de DEMONSTRAÇÃO no banco de desenvolvimento, para o site não ficar vazio.
// Passa pelos mesmos casos de uso da API (validação, fotos conferidas pelos bytes, cidade padronizada).
//
// Uso: npm run db:demonstracao -- <e-mail da conta de anfitrião>
//   - os 12 imóveis vão para a conta de anfitrião informada (aparecem no painel "Meus imóveis")
//   - os 14 serviços ganham prestadores fictícios (@demo.example.com), sem senha conhecida
//   - pode rodar de novo: o que já existe é pulado
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');

const { carregarConfig } = require('../src/config');
const { abrirBanco } = require('../src/db/database');
const { criarRepositorioUsuarios } = require('../src/repositorios/repositorioUsuarios');
const { criarRepositorioImoveis } = require('../src/repositorios/repositorioImoveis');
const { criarRepositorioFotos } = require('../src/repositorios/repositorioFotos');
const { criarRepositorioServicos } = require('../src/repositorios/repositorioServicos');
const { criarServicoSenhaBcrypt } = require('../src/adaptadores/servicoSenhaBcrypt');
const { criarArmazenamentoFotosDisco } = require('../src/adaptadores/armazenamentoFotosDisco');
const { criarCadastrarUsuario } = require('../src/casos_uso/cadastrarUsuario');
const { criarCadastrarImovel } = require('../src/casos_uso/imoveisDoAnfitriao');
const { criarAdicionarFotos } = require('../src/casos_uso/fotosDoImovel');
const { criarCadastrarServico } = require('../src/casos_uso/servicosDoPrestador');
const { IMOVEIS, SERVICOS } = require('./demonstracao/dados');

const PASTA_FOTOS = path.join(__dirname, 'demonstracao', 'fotos');
const DOMINIO_PRESTADORES = 'demo.example.com';

function emailDoPrestador(nome) {
  const usuario = nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.|\.$/g, '');
  return `${usuario}@${DOMINIO_PRESTADORES}`;
}

async function main() {
  const config = carregarConfig();
  if (config.emProducao) throw new Error('Dados de demonstração não podem ser criados em produção');

  const emailAnfitriao = (process.argv[2] ?? '').trim().toLowerCase();
  if (!emailAnfitriao) throw new Error('Informe o e-mail da conta de anfitrião: npm run db:demonstracao -- email@exemplo.com');

  const db = abrirBanco();
  const repositorioUsuarios = criarRepositorioUsuarios(db);
  const repositorioImoveis = criarRepositorioImoveis(db);
  const repositorioFotos = criarRepositorioFotos(db);
  const repositorioServicos = criarRepositorioServicos(db);
  const armazenamentoFotos = criarArmazenamentoFotosDisco({ pasta: config.pastaUploads });

  const cadastrarImovel = criarCadastrarImovel({ repositorioImoveis });
  const adicionarFotos = criarAdicionarFotos({ repositorioImoveis, repositorioFotos, armazenamentoFotos });
  const cadastrarServico = criarCadastrarServico({ repositorioServicos });
  const cadastrarUsuario = criarCadastrarUsuario({
    repositorioUsuarios,
    servicoSenha: criarServicoSenhaBcrypt({ custo: config.custoHashSenha }),
  });

  try {
    const anfitriao = repositorioUsuarios.buscarPorEmail(emailAnfitriao);
    if (!anfitriao || anfitriao.tipo !== 'anfitriao') {
      throw new Error(`Não existe conta de anfitrião com o e-mail ${emailAnfitriao}`);
    }

    const titulosExistentes = new Set(repositorioImoveis.listarDoAnfitriao(anfitriao.id).map((imovel) => imovel.titulo));
    let imoveisCriados = 0;
    for (const { fotos, ...dados } of IMOVEIS) {
      if (titulosExistentes.has(dados.titulo)) continue;
      const imovel = cadastrarImovel(anfitriao.id, { ...dados, endereco: `Endereço de demonstração, ${dados.cidade}` });
      const arquivos = fotos.map((arquivo) => ({ bytes: fs.readFileSync(path.join(PASTA_FOTOS, arquivo)) }));
      await adicionarFotos(anfitriao.id, imovel.id, arquivos);
      imoveisCriados += 1;
    }

    let servicosCriados = 0;
    for (const { prestador: nome, ...dados } of SERVICOS) {
      const email = emailDoPrestador(nome);
      if (repositorioUsuarios.buscarPorEmail(email)) continue;
      // Senha aleatória e descartada: ninguém entra nessas contas
      const prestador = await cadastrarUsuario({ nome, email, senha: randomBytes(24).toString('base64url'), tipo: 'prestador' });
      cadastrarServico(prestador.id, dados);
      servicosCriados += 1;
    }

    console.log(`✔ ${imoveisCriados} imóveis criados para ${emailAnfitriao} (${IMOVEIS.length - imoveisCriados} já existiam)`);
    console.log(`✔ ${servicosCriados} serviços criados (${SERVICOS.length - servicosCriados} já existiam)`);
    if (!config.permitirSemRecebimento) {
      console.log('⚠ PERMITIR_SEM_RECEBIMENTO não está "true" no .env: sem conta Stripe, nada disso aparece na busca (RN13)');
    }
  } finally {
    db.close();
  }
}

main().catch((erro) => {
  console.error(`✘ ${erro.message}`);
  process.exitCode = 1;
});
