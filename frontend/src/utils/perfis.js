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
  { valor: 'fazenda', rotulo: 'Fazendas' },
];

export const ROTULO_TIPO_IMOVEL = {
  villa: 'Villa',
  casa: 'Casa',
  cobertura: 'Cobertura',
  apartamento: 'Apartamento',
  chale: 'Chalé',
  fazenda: 'Fazenda',
};

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
