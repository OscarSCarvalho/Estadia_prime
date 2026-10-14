// RN01–RN03: todos os valores da reserva, em centavos inteiros, calculados só com dados do banco.
// Nada que venha do navegador entra aqui como preço (SPEC: "Preço manipulado no navegador")

// RN03 + CB10: o repasse é arredondado para baixo e o centavo que sobra fica com a plataforma.
// Conta só com inteiros: valor × (100 − pct) cabe com folga no Number
function dividirValor(valor, comissaoPct) {
  const repasse = Math.floor((valor * (100 - comissaoPct)) / 100);
  return { comissao: valor - repasse, repasse };
}

// `itens`: [{ precoUnitario, quantidade, ...qualquer outro campo, que é mantido }]
function calcularReserva({ precoDiaria, noites, itens = [], comissaoHospedagemPct, comissaoServicoPct }) {
  const valorHospedagem = precoDiaria * noites;
  const hospedagem = dividirValor(valorHospedagem, comissaoHospedagemPct);

  const itensCalculados = itens.map((item) => {
    const subtotal = item.precoUnitario * item.quantidade;
    const { comissao, repasse } = dividirValor(subtotal, comissaoServicoPct);
    return { ...item, subtotal, valorComissao: comissao, repasse };
  });

  const valorServicos = itensCalculados.reduce((soma, item) => soma + item.subtotal, 0);
  const comissaoServicos = itensCalculados.reduce((soma, item) => soma + item.valorComissao, 0);

  return {
    valorHospedagem,
    valorServicos,
    valorTotal: valorHospedagem + valorServicos,
    valorComissao: hospedagem.comissao + comissaoServicos,
    repasseAnfitriao: hospedagem.repasse,
    itens: itensCalculados,
  };
}

module.exports = { dividirValor, calcularReserva };
