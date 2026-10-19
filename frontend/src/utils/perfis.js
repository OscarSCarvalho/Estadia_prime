export const PERFIS = {
  hospede: {
    titulo: 'Hóspede',
    descricao: 'Quero reservar estadias exclusivas e contratar serviços premium.',
  },
  anfitriao: {
    titulo: 'Anfitrião',
    descricao: 'Tenho imóveis de alto padrão para receber hóspedes.',
  },
  prestador: {
    titulo: 'Prestador',
    descricao: 'Ofereço serviços como mordomo, motorista, barman ou eventos.',
  },
};

export const ORDEM_PERFIS = ['hospede', 'anfitriao', 'prestador'];

// Os nomes (chaves) seguem os valores aceitos pelo banco (schema.sql)
export const TIPOS_IMOVEL = [
  { valor: 'villa', rotulo: 'Villas' },
  { valor: 'casa', rotulo: 'Casas' },
  { valor: 'cobertura', rotulo: 'Coberturas' },
  { valor: 'apartamento', rotulo: 'Apartamentos' },
  { valor: 'chale', rotulo: 'Chalés' },
  { valor: 'sitio', rotulo: 'Sítios' },
  { valor: 'fazenda', rotulo: 'Fazendas' },
];

export const ROTULO_TIPO_IMOVEL = {
  villa: 'Villa',
  casa: 'Casa',
  cobertura: 'Cobertura',
  apartamento: 'Apartamento',
  chale: 'Chalé',
  sitio: 'Sítio',
  fazenda: 'Fazenda',
};

const TIPOS_IMOVEL_FEMININOS = new Set(['villa', 'casa', 'cobertura', 'fazenda']);

// Concordância do título da página do imóvel: "Casa inteira", "Sítio inteiro", "Chalé inteiro"
export function descreverImovelInteiro(tipoImovel) {
  return `${ROTULO_TIPO_IMOVEL[tipoImovel]} ${TIPOS_IMOVEL_FEMININOS.has(tipoImovel) ? 'inteira' : 'inteiro'}`;
}

// RN17: serviços inclusos do próprio anfitrião (valores do CHECK da migração 002)
export const UNIDADES_INCLUSO = [
  { valor: 'noite', rotulo: 'Por noite' },
  { valor: 'hospede', rotulo: 'Por hóspede' },
  { valor: 'estadia', rotulo: 'Valor fixo por estadia' },
];

export const ROTULO_UNIDADE_INCLUSO = { noite: 'noite', hospede: 'hóspede', estadia: 'estadia' };

// Atalhos do painel: um clique preenche nome, cobrança e descrição; o anfitrião só informa o preço
export const SUGESTOES_INCLUSOS = [
  { nome: 'Caseiro', unidade_preco: 'noite', descricao: 'Cuida da casa e do jardim durante a estadia.' },
  { nome: 'Limpeza diária', unidade_preco: 'noite', descricao: 'Arrumação dos quartos e das áreas comuns todos os dias.' },
  { nome: 'Café da manhã', unidade_preco: 'hospede', descricao: 'Servido todas as manhãs.' },
  { nome: 'Enxoval de cama e banho', unidade_preco: 'estadia', descricao: 'Lençóis, toalhas de banho e de piscina.' },
  { nome: 'Lenha', unidade_preco: 'estadia', descricao: 'Para a lareira, a churrasqueira ou o fogão a lenha.' },
  { nome: 'Piscineiro', unidade_preco: 'estadia', descricao: 'Limpeza e tratamento da piscina.' },
];

const UNIDADE_INCLUSO_NO_PLURAL = { noite: ['noite', 'noites'], hospede: ['hóspede', 'hóspedes'] };

// Ex.: { preco: 15000, unidade_preco: 'noite' }, 3 → "R$ 150 × 3 noites"; estadia → "valor fixo"
export function descreverCobrancaIncluso(unidadePreco, quantidade, precoFormatado) {
  if (unidadePreco === 'estadia') return 'valor fixo';
  const [singular, plural] = UNIDADE_INCLUSO_NO_PLURAL[unidadePreco];
  return `${precoFormatado} × ${quantidade} ${quantidade === 1 ? singular : plural}`;
}

export const TIPOS_SERVICO = [
  { valor: 'mordomo', rotulo: 'Mordomo' },
  { valor: 'copeiro', rotulo: 'Copeiro' },
  { valor: 'empregado', rotulo: 'Empregado' },
  { valor: 'motorista', rotulo: 'Motorista' },
  { valor: 'barman', rotulo: 'Barman' },
  { valor: 'eventos', rotulo: 'Eventos' },
];

export const ROTULO_TIPO_SERVICO = Object.fromEntries(TIPOS_SERVICO.map(({ valor, rotulo }) => [valor, rotulo]));

export const ROTULO_UNIDADE_PRECO = { hora: 'hora', diaria: 'diária', evento: 'evento' };

export const SERVICOS_PREMIUM = [
  { nome: 'Mordomo', descricao: 'Recepção, organização e cuidado com cada detalhe da casa.' },
  { nome: 'Copeiro', descricao: 'Serviço de mesa impecável em cafés, almoços e jantares.' },
  { nome: 'Empregado', descricao: 'Limpeza e arrumação diárias durante toda a estadia.' },
  { nome: 'Motorista', descricao: 'Traslados e passeios com carro executivo e motorista dedicado.' },
  { nome: 'Barman', descricao: 'Coquetelaria autoral para recepções e fins de tarde.' },
  { nome: 'Eventos', descricao: 'Produção completa de celebrações dentro do imóvel.' },
];

// Foto padrão de cada tipo de serviço (a tabela de serviços não tem foto própria)
export function fotoDoServico(tipoServico) {
  return `/imagens/servicos/${tipoServico}.jpg`;
}

export const UNIDADES_PRECO = [
  { valor: 'diaria', rotulo: 'Por diária' },
  { valor: 'hora', rotulo: 'Por hora' },
  { valor: 'evento', rotulo: 'Por evento' },
];

// Cadastro de recebimento com CNPJ (companyType do Asaas)
export const TIPOS_EMPRESA = [
  { valor: 'mei', rotulo: 'MEI' },
  { valor: 'limitada', rotulo: 'Limitada (Ltda.)' },
  { valor: 'individual', rotulo: 'Empresário individual' },
  { valor: 'associacao', rotulo: 'Associação' },
];

// RN09: situação do repasse nas telas do anfitrião e do prestador
export const SITUACAO_REPASSE = {
  aguardando_checkin: 'Repasse em',
  processando: 'Repasse em processamento',
  enviado: 'Repasse enviado',
};

export const ESTADOS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA',
  'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
];

const UNIDADE_NO_PLURAL = { hora: ['hora', 'horas'], diaria: ['diária', 'diárias'], evento: ['evento', 'eventos'] };

// Ex.: (2, 'diaria') → "2 diárias"
export function descreverQuantidade(quantidade, unidadePreco) {
  const [singular, plural] = UNIDADE_NO_PLURAL[unidadePreco] ?? ['unidade', 'unidades'];
  return `${quantidade} ${quantidade === 1 ? singular : plural}`;
}

export const STATUS_RESERVA = {
  pendente: { rotulo: 'Aguardando pagamento', classes: 'bg-ouro/25 text-ouro-escuro' },
  confirmada: { rotulo: 'Confirmada', classes: 'bg-tinta text-marfim' },
  concluida: { rotulo: 'Concluída', classes: 'bg-areia text-tinta' },
  cancelada: { rotulo: 'Cancelada', classes: 'bg-areia text-grafite' },
  expirada: { rotulo: 'Expirada', classes: 'bg-areia text-grafite' },
};
