// Guarda o carrinho na aba do navegador até o pagamento (Etapa 4b). Só ids, datas e quantidades:
// preços nunca são lidos daqui, sempre do catálogo.
const PREFIXO = 'estadia-prime:carrinho';

export function chaveCarrinho({ imovelId, checkin, checkout }) {
  return `${PREFIXO}:${imovelId}:${checkin}:${checkout}`;
}

function itemBemFormado(item) {
  return (
    Number.isInteger(item?.servico_id) &&
    typeof item.data_servico === 'string' &&
    Number.isInteger(item.quantidade) &&
    item.quantidade >= 1
  );
}

export function lerCarrinho(chave) {
  try {
    const salvo = JSON.parse(sessionStorage.getItem(chave) ?? '[]');
    return Array.isArray(salvo) ? salvo.filter(itemBemFormado) : [];
  } catch {
    return [];
  }
}

export function salvarCarrinho(chave, itens) {
  try {
    if (itens.length === 0) sessionStorage.removeItem(chave);
    else sessionStorage.setItem(chave, JSON.stringify(itens));
  } catch {
    // Navegador sem armazenamento (aba anônima, bloqueio): o carrinho vale só enquanto a página estiver aberta
  }
}
