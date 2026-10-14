// Cria avaliações de DEMONSTRAÇÃO no banco de desenvolvimento, para ver a Etapa 5 funcionando antes do pagamento.
// Sem pagamento (Etapa 4b) nenhuma reserva chega a "confirmada", então nenhuma estadia termina de verdade:
// este script grava estadias no passado direto no banco, pulando o fluxo de pagamento de propósito.
//
// Uso: npm run db:demonstracao-avaliacoes -- <e-mail da conta de hóspede>
//   1. hóspedes fictícios (@demo.example.com, sem senha conhecida) avaliam a maioria dos imóveis e serviços
//      de demonstração (rode antes o `npm run db:demonstracao`); 3 imóveis ficam sem avaliação ("Novo")
//   2. a conta de hóspede informada ganha uma estadia que terminou ontem, pronta para ser avaliada
//      em "Minhas reservas"
//   - pode rodar de novo: o que já existe é pulado
const { randomBytes } = require('node:crypto');

const { carregarConfig } = require('../src/config');
const { abrirBanco } = require('../src/db/database');
const { criarRepositorioUsuarios } = require('../src/repositorios/repositorioUsuarios');
const { criarRepositorioReservas } = require('../src/repositorios/repositorioReservas');
const { criarRepositorioAvaliacoes } = require('../src/repositorios/repositorioAvaliacoes');
const { criarServicoSenhaBcrypt } = require('../src/adaptadores/servicoSenhaBcrypt');
const { criarCadastrarUsuario } = require('../src/casos_uso/cadastrarUsuario');
const { calcularReserva } = require('../src/dominio/precificacao');
const { hojeEmBrasilia, calcularNoites } = require('../src/dominio/periodo');

const HOSPEDES_FICTICIOS = [
  'Marina Albuquerque',
  'Ricardo Montenegro',
  'Helena Vasconcellos',
  'Fernando Prado',
  'Beatriz Leme',
  'Gustavo Saldanha',
];
const IMOVEIS_SEM_AVALIACAO = 3;

const COMENTARIOS_IMOVEL = [
  [5, 'Impecável do início ao fim. A casa é ainda mais bonita do que nas fotos e a vista ao entardecer é inesquecível.'],
  [5, 'Lugar perfeito para reunir a família. Tudo limpo, organizado e com muito bom gosto. Voltaremos com certeza.'],
  [4, 'Casa linda e muito confortável. Só a internet oscilou um pouco em alguns momentos.'],
  [5, 'Privacidade total e acabamento de altíssimo padrão. O anfitrião respondeu tudo rapidamente.'],
  [5, null],
  [4, 'Ótima localização e quartos espaçosos. A cozinha poderia ter mais utensílios, mas nada que atrapalhasse.'],
  [5, 'Superou todas as expectativas. Piscina impecável, roupa de cama de hotel cinco estrelas.'],
];

const COMENTARIOS_SERVICO = [
  [5, 'Extremamente atencioso e discreto. Antecipou tudo o que precisávamos.'],
  [5, 'Profissional excepcional, pontual e muito educado. Fez toda a diferença na viagem.'],
  [4, 'Muito bom serviço, recomendo.'],
  [5, null],
];

function emailDoHospede(nome) {
  const usuario = nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.');
  return `hospede.${usuario}@demo.example.com`;
}

function somarDias(data, dias) {
  return new Date(Date.parse(`${data}T00:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10);
}

async function main() {
  const config = carregarConfig();
  if (config.emProducao) throw new Error('Dados de demonstração não podem ser criados em produção');

  const emailHospede = (process.argv[2] ?? '').trim().toLowerCase();
  if (!emailHospede) {
    throw new Error('Informe o e-mail da conta de hóspede: npm run db:demonstracao-avaliacoes -- email@exemplo.com');
  }

  const db = abrirBanco();
  const repositorioUsuarios = criarRepositorioUsuarios(db);
  const repositorioReservas = criarRepositorioReservas(db);
  const repositorioAvaliacoes = criarRepositorioAvaliacoes(db);
  const cadastrarUsuario = criarCadastrarUsuario({
    repositorioUsuarios,
    servicoSenha: criarServicoSenhaBcrypt({ custo: config.custoHashSenha }),
  });
  const comissoes = { comissaoHospedagemPct: config.comissaoHospedagemPct, comissaoServicoPct: config.comissaoServicoPct };
  const hoje = hojeEmBrasilia();

  const imoveis = db.prepare("SELECT * FROM imoveis WHERE endereco LIKE 'Endereço de demonstração%' ORDER BY id").all();
  const servicosDaCidade = db.prepare(`
    SELECT s.* FROM servicos s JOIN usuarios p ON p.id = s.prestador_id
     WHERE p.email LIKE '%@demo.example.com' AND s.cidade_atuacao = ? ORDER BY s.id
  `);
  const periodoOcupado = db.prepare(`
    SELECT EXISTS (
      SELECT 1 FROM reservas WHERE imovel_id = @imovelId AND status IN ('pendente', 'confirmada', 'concluida')
         AND data_checkin < @checkout AND @checkin < data_checkout
    ) AS ocupado
  `);
  const ajusteDataAvaliacao = db.prepare("UPDATE avaliacoes SET data = @data || ' 15:00:00' WHERE id = @id");

  // Estadia já paga e terminada, com um serviço da cidade no primeiro dia (os valores seguem RN01–RN03)
  function gravarEstadia({ hospedeId, imovel, checkin, checkout, servico, status }) {
    const itens = servico ? [{ servicoId: servico.id, data: checkin, quantidade: 1, precoUnitario: servico.preco }] : [];
    const valores = calcularReserva({ precoDiaria: imovel.preco_diaria, noites: calcularNoites(checkin, checkout), itens, ...comissoes });
    return repositorioReservas.emTransacao(() => {
      const reservaId = repositorioReservas.inserir({ hospedeId, imovelId: imovel.id, checkin, checkout, numHospedes: 2, valores });
      repositorioReservas.alterarStatus(reservaId, 'pendente', status);
      return reservaId;
    });
  }

  try {
    if (imoveis.length === 0) throw new Error('Nenhum imóvel de demonstração. Rode antes: npm run db:demonstracao -- <e-mail do anfitrião>');

    const hospedeReal = repositorioUsuarios.buscarPorEmail(emailHospede);
    if (!hospedeReal || hospedeReal.tipo !== 'hospede') throw new Error(`Não existe conta de hóspede com o e-mail ${emailHospede}`);

    // 1. Avaliações dos hóspedes fictícios
    let avaliacoesCriadas = 0;
    if (repositorioUsuarios.buscarPorEmail(emailDoHospede(HOSPEDES_FICTICIOS[0]))) {
      console.log('• Avaliações de demonstração já existiam: nada a fazer na parte 1');
    } else {
      const hospedes = [];
      for (const nome of HOSPEDES_FICTICIOS) {
        // Senha aleatória e descartada: ninguém entra nessas contas
        hospedes.push(await cadastrarUsuario({ nome, email: emailDoHospede(nome), senha: randomBytes(24).toString('base64url'), tipo: 'hospede' }));
      }

      let sequencia = 0;
      imoveis.slice(0, imoveis.length - IMOVEIS_SEM_AVALIACAO).forEach((imovel, posicaoImovel) => {
        const estadias = 2 + (posicaoImovel % 3);
        const servicos = servicosDaCidade.all(imovel.cidade);
        for (let numero = 0; numero < estadias; numero += 1) {
          // Estadias de 3 noites, a cada 30 dias, a partir de 25 dias atrás: nunca se sobrepõem
          const checkout = somarDias(hoje, -25 - numero * 30);
          const checkin = somarDias(checkout, -3);
          const hospede = hospedes[(posicaoImovel + numero) % hospedes.length];
          const servico = servicos.length > 0 && numero % 2 === 0 ? servicos[(posicaoImovel + numero) % servicos.length] : null;
          const reservaId = gravarEstadia({ hospedeId: hospede.id, imovel, checkin, checkout, servico, status: 'concluida' });

          const [nota, comentario] = COMENTARIOS_IMOVEL[sequencia % COMENTARIOS_IMOVEL.length];
          const doImovel = repositorioAvaliacoes.inserir({ reservaId, autorId: hospede.id, tipoAlvo: 'imovel', alvoId: imovel.id, nota, comentario });
          ajusteDataAvaliacao.run({ id: doImovel.id, data: somarDias(checkout, 2) });
          avaliacoesCriadas += 1;

          if (servico) {
            const [notaServico, comentarioServico] = COMENTARIOS_SERVICO[sequencia % COMENTARIOS_SERVICO.length];
            const doServico = repositorioAvaliacoes.inserir({
              reservaId,
              autorId: hospede.id,
              tipoAlvo: 'servico',
              alvoId: servico.id,
              nota: notaServico,
              comentario: comentarioServico,
            });
            ajusteDataAvaliacao.run({ id: doServico.id, data: somarDias(checkout, 2) });
            avaliacoesCriadas += 1;
          }
          sequencia += 1;
        }
      });
      console.log(`✔ ${avaliacoesCriadas} avaliações criadas por ${hospedes.length} hóspedes fictícios`);
    }

    // 2. Estadia da conta real, terminada ontem, para testar o formulário de avaliação
    const checkout = somarDias(hoje, -1);
    const checkin = somarDias(checkout, -3);
    const imovelComServico = imoveis.find((imovel) => servicosDaCidade.all(imovel.cidade).length > 0) ?? imoveis[0];
    const jaTemParaAvaliar = db
      .prepare("SELECT 1 FROM reservas WHERE hospede_id = ? AND status IN ('confirmada', 'concluida') AND data_checkout >= ?")
      .get(hospedeReal.id, somarDias(hoje, -14));
    if (jaTemParaAvaliar) {
      console.log(`• ${emailHospede} já tem uma estadia recente para avaliar: nada a fazer na parte 2`);
    } else if (periodoOcupado.get({ imovelId: imovelComServico.id, checkin, checkout }).ocupado) {
      console.log(`⚠ ${imovelComServico.titulo} já está ocupado de ${checkin} a ${checkout}: estadia de teste não criada`);
    } else {
      gravarEstadia({
        hospedeId: hospedeReal.id,
        imovel: imovelComServico,
        checkin,
        checkout,
        servico: servicosDaCidade.all(imovelComServico.cidade)[0],
        status: 'confirmada',
      });
      console.log(`✔ Estadia de teste criada para ${emailHospede}: ${imovelComServico.titulo}, ${checkin} a ${checkout}`);
      console.log('  Entre com essa conta e abra "Minhas reservas" para avaliar o imóvel e o serviço');
    }
  } finally {
    db.close();
  }
}

main().catch((erro) => {
  console.error(`✘ ${erro.message}`);
  process.exitCode = 1;
});
