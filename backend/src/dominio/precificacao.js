// RN01–RN03 e RN19: todos os valores da reserva, em centavos inteiros, calculados só com dados do banco.
// Nada que venha do navegador entra aqui como preço (SPEC: "Preço manipulado no navegador")

// RN03 + CB10: o repasse é arredondado para baixo e o centavo que sobra fica com a plataforma.
// Conta só com inteiros: valor × (100 − pct) cabe com folga no Number
function dividirValor(valor, comissaoPct) {
  const repasse = Math.floor((valor * (100 - comissaoPct)) / 100);
  return { comissao: valor - repasse, repasse };
}

// Cada linha é dividida sozinha: a comissão gravada por item fecha no centavo com o subtotal
function calcularLinhas(linhas, comissaoPct) {
  return linhas.map((linha) => {
    const subtotal = linha.precoUnitario * linha.quantidade;
    const { comissao, repasse } = dividirValor(subtotal, comissaoPct);
    return { ...linha, subtotal, valorComissao: comissao, repasse };
  });
}

const somar = (linhas, campo) => linhas.reduce((soma, linha) => soma + linha[campo], 0);

// `itens`: serviços premium dos prestadores; `inclusos`: serviços do próprio anfitrião (RN17).
// Ambos [{ precoUnitario, quantidade, ...qualquer outro campo, que é mantido }].
// RN19: os inclusos pagam a comissão da hospedagem e o repasse deles vai para o anfitrião.
// `valorServicos` = inclusos + premium, como em reservas.valor_servicos (CHECK valor_total = hospedagem + serviços)
function calcularReserva({ precoDiaria, noites, itens = [], inclusos = [], comissaoHospedagemPct, comissaoServicoPct }) {
  const valorHospedagem = precoDiaria * noites;
  const hospedagem = dividirValor(valorHospedagem, comissaoHospedagemPct);
  const inclusosCalculados = calcularLinhas(inclusos, comissaoHospedagemPct);
  const itensCalculados = calcularLinhas(itens, comissaoServicoPct);

  const valorInclusos = somar(inclusosCalculados, 'subtotal');
  const valorServicosPremium = somar(itensCalculados, 'subtotal');

  return {
    valorHospedagem,
    valorInclusos,
    valorServicosPremium,
    valorServicos: valorInclusos + valorServicosPremium,
    valorTotal: valorHospedagem + valorInclusos + valorServicosPremium,
    valorComissao: hospedagem.comissao + somar(inclusosCalculados, 'valorComissao') + somar(itensCalculados, 'valorComissao'),
    repasseAnfitriao: hospedagem.repasse + somar(inclusosCalculados, 'repasse'),
    inclusos: inclusosCalculados,
    itens: itensCalculados,
  };
}

module.exports = { dividirValor, calcularReserva };
