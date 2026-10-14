// Dados de DEMONSTRAÇÃO para o ambiente de desenvolvimento (npm run db:demonstracao).
// Fotos: Unsplash (licença gratuita para uso comercial), na pasta ./fotos
// Preços em reais, como no cadastro pela API. Endereços são fictícios

const IMOVEIS = [
  {
    titulo: 'Villa Vista Mar',
    descricao: 'Villa contemporânea com piscina de borda infinita, varandas em vidro e teto em madeira nobre. Ambientes integrados que se abrem para o deck, a poucos minutos das praias mais exclusivas de Búzios.',
    tipo_imovel: 'villa',
    cidade: 'Búzios',
    estado: 'RJ',
    diaria: 2500,
    num_hospedes: 8,
    num_quartos: 4,
    fotos: [
      'villa-vista-mar-1.jpg',
      'villa-vista-mar-2.jpg',
      'villa-vista-mar-3.jpg'
    ]
  },
  {
    titulo: 'Casa Contemporânea do Quadrado',
    descricao: 'Arquitetura branca e minimalista com piscina de azulejos, solário na cobertura e suítes amplas. Perfeita para famílias que querem privacidade perto do Quadrado.',
    tipo_imovel: 'casa',
    cidade: 'Trancoso',
    estado: 'BA',
    diaria: 3200,
    num_hospedes: 10,
    num_quartos: 5,
    fotos: [
      'casa-contemporanea-1.jpg',
      'casa-contemporanea-2.jpg',
      'casa-contemporanea-3.jpg'
    ]
  },
  {
    titulo: 'Mansão Jardim Tropical',
    descricao: 'Casarão clássico com varanda colonial, jardim tropical e piscina cercada de palmeiras. Interiores aconchegantes com madeira e iluminação indireta.',
    tipo_imovel: 'casa',
    cidade: 'Angra dos Reis',
    estado: 'RJ',
    diaria: 2800,
    num_hospedes: 12,
    num_quartos: 6,
    fotos: [
      'mansao-tropical-1.jpg',
      'mansao-tropical-2.jpg',
      'mansao-tropical-3.jpg'
    ]
  },
  {
    titulo: 'Villa Branca Ilhabela',
    descricao: 'Volumes brancos, piscina iluminada e sala de jantar com vista para o canal. Uma villa pensada para receber com elegância.',
    tipo_imovel: 'villa',
    cidade: 'Ilhabela',
    estado: 'SP',
    diaria: 2100,
    num_hospedes: 8,
    num_quartos: 4,
    fotos: [
      'villa-branca-1.jpg',
      'villa-branca-2.jpg'
    ]
  },
  {
    titulo: 'Cobertura Atlântica',
    descricao: 'Cobertura duplex com piscina privativa e vista frontal para o mar. Escada em vidro, pé-direito duplo e varanda gourmet.',
    tipo_imovel: 'cobertura',
    cidade: 'Rio de Janeiro',
    estado: 'RJ',
    diaria: 1800,
    num_hospedes: 6,
    num_quartos: 3,
    fotos: [
      'cobertura-atlantica-1.jpg'
    ]
  },
  {
    titulo: 'Chalé da Serra',
    descricao: 'Chalé em madeira cercado pela mata, com lareira, banheira e deck para as noites frias da serra.',
    tipo_imovel: 'chale',
    cidade: 'Campos do Jordão',
    estado: 'SP',
    diaria: 950,
    num_hospedes: 4,
    num_quartos: 2,
    fotos: [
      'chale-da-serra-1.jpg',
      'chale-da-serra-2.jpg'
    ]
  },
  {
    titulo: 'Bangalô Pé na Areia',
    descricao: 'Bangalô sobre a água cristalina, com acesso direto ao mar e piscina compartilhada entre coqueiros.',
    tipo_imovel: 'casa',
    cidade: 'Fernando de Noronha',
    estado: 'PE',
    diaria: 2600,
    num_hospedes: 2,
    num_quartos: 1,
    fotos: [
      'bangalo-pe-na-areia-1.jpg',
      'bangalo-pe-na-areia-2.jpg'
    ]
  },
  {
    titulo: 'Fazenda Vale Verde',
    descricao: 'Sede de fazenda em madeira com piscina aquecida, lago e trilhas. Ideal para celebrações e grupos grandes.',
    tipo_imovel: 'fazenda',
    cidade: 'Itaipava',
    estado: 'RJ',
    diaria: 1500,
    num_hospedes: 16,
    num_quartos: 8,
    fotos: [
      'fazenda-vale-verde-1.jpg',
      'fazenda-vale-verde-2.jpg'
    ]
  },
  {
    titulo: 'Casa Jardim Geribá',
    descricao: 'Casa de arquitetura autoral com grandes panos de vidro, jardim iluminado e área gourmet integrada.',
    tipo_imovel: 'casa',
    cidade: 'Búzios',
    estado: 'RJ',
    diaria: 1650,
    num_hospedes: 6,
    num_quartos: 3,
    fotos: [
      'casa-jardim-1.jpg',
      'casa-jardim-2.jpg'
    ]
  },
  {
    titulo: 'Villa Mediterrânea',
    descricao: 'Villa em estilo mediterrâneo com piscina de borda, jardim gramado e suítes voltadas para o pôr do sol.',
    tipo_imovel: 'villa',
    cidade: 'Florianópolis',
    estado: 'SC',
    diaria: 1900,
    num_hospedes: 8,
    num_quartos: 4,
    fotos: [
      'villa-mediterranea-1.jpg',
      'villa-mediterranea-2.jpg'
    ]
  },
  {
    titulo: 'Apartamento Frente Mar',
    descricao: 'Apartamento decorado por designer, iluminado e a uma quadra da praia. Cozinha completa e varanda com vista.',
    tipo_imovel: 'apartamento',
    cidade: 'Rio de Janeiro',
    estado: 'RJ',
    diaria: 850,
    num_hospedes: 4,
    num_quartos: 2,
    fotos: [
      'apartamento-frente-mar-1.jpg',
      'apartamento-frente-mar-2.jpg'
    ]
  },
  {
    titulo: 'Casa Minimalista Itapororoca',
    descricao: 'Casa térrea de linhas retas com piscina raia, jardim de cactos e integração total com a área externa.',
    tipo_imovel: 'casa',
    cidade: 'Trancoso',
    estado: 'BA',
    diaria: 1750,
    num_hospedes: 6,
    num_quartos: 3,
    fotos: [
      'casa-minimalista-1.jpg',
      'casa-minimalista-2.jpg'
    ]
  }
];

const SERVICOS = [
  {
    prestador: 'Paulo Andrade',
    tipo_servico: 'mordomo',
    descricao: 'Mordomo bilíngue com 15 anos em residências e hotéis de luxo.',
    preco: 800,
    unidade_preco: 'diaria',
    cidade_atuacao: 'Búzios'
  },
  {
    prestador: 'Lúcia Ramos',
    tipo_servico: 'copeiro',
    descricao: 'Serviço de mesa à francesa para cafés, almoços e jantares.',
    preco: 450,
    unidade_preco: 'diaria',
    cidade_atuacao: 'Búzios'
  },
  {
    prestador: 'Carlos Mendes',
    tipo_servico: 'motorista',
    descricao: 'Sedã executivo blindado, traslado do aeroporto e passeios.',
    preco: 900,
    unidade_preco: 'diaria',
    cidade_atuacao: 'Búzios'
  },
  {
    prestador: 'Atelier Celebra',
    tipo_servico: 'eventos',
    descricao: 'Produção completa: decoração, buffet, música e equipe.',
    preco: 12000,
    unidade_preco: 'evento',
    cidade_atuacao: 'Búzios'
  },
  {
    prestador: 'Jorge Lima',
    tipo_servico: 'mordomo',
    descricao: 'Gestão da casa, recepção de hóspedes e reservas em restaurantes.',
    preco: 750,
    unidade_preco: 'diaria',
    cidade_atuacao: 'Trancoso'
  },
  {
    prestador: 'Diego Torres',
    tipo_servico: 'barman',
    descricao: 'Coquetelaria autoral com ingredientes brasileiros.',
    preco: 1200,
    unidade_preco: 'evento',
    cidade_atuacao: 'Trancoso'
  },
  {
    prestador: 'Marta Souza',
    tipo_servico: 'empregado',
    descricao: 'Limpeza e arrumação diárias com padrão de hotelaria.',
    preco: 350,
    unidade_preco: 'diaria',
    cidade_atuacao: 'Angra dos Reis'
  },
  {
    prestador: 'Fernando Alves',
    tipo_servico: 'motorista',
    descricao: 'Motorista particular com carro executivo e cadeirinha infantil.',
    preco: 850,
    unidade_preco: 'diaria',
    cidade_atuacao: 'Rio de Janeiro'
  },
  {
    prestador: 'Rosa Oliveira',
    tipo_servico: 'empregado',
    descricao: 'Arrumação, lavanderia e organização de armários.',
    preco: 320,
    unidade_preco: 'diaria',
    cidade_atuacao: 'Rio de Janeiro'
  },
  {
    prestador: 'Bianca Rocha',
    tipo_servico: 'barman',
    descricao: 'Bar móvel completo para recepções ao pôr do sol.',
    preco: 1100,
    unidade_preco: 'evento',
    cidade_atuacao: 'Florianópolis'
  },
  {
    prestador: 'Casa Festa Serrana',
    tipo_servico: 'eventos',
    descricao: 'Casamentos e aniversários ao ar livre na serra.',
    preco: 15000,
    unidade_preco: 'evento',
    cidade_atuacao: 'Itaipava'
  },
  {
    prestador: 'Antônio Prado',
    tipo_servico: 'copeiro',
    descricao: 'Copeiro experiente em serviço de vinhos e harmonização.',
    preco: 500,
    unidade_preco: 'diaria',
    cidade_atuacao: 'Ilhabela'
  },
  {
    prestador: 'Henrique Costa',
    tipo_servico: 'motorista',
    descricao: 'Lancha e carro com motorista para explorar a ilha.',
    preco: 1500,
    unidade_preco: 'diaria',
    cidade_atuacao: 'Fernando de Noronha'
  },
  {
    prestador: 'Sérgio Nunes',
    tipo_servico: 'mordomo',
    descricao: 'Mordomo para chalés: lareira, enxoval e café da manhã servido.',
    preco: 700,
    unidade_preco: 'diaria',
    cidade_atuacao: 'Campos do Jordão'
  }
];

module.exports = { IMOVEIS, SERVICOS };
