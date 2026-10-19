// Guarda o carrinho na aba do navegador até o pagamento (Etapa 4b). Só ids, datas e quantidades:
// preços nunca são lidos daqui, sempre do catálogo.
// `inclusosRetirados`: ids dos inclusos que o hóspede DESMARCOU. Guardar os retirados (e não os mantidos)
// faz um incluso novo do anfitrião já vir marcado, como manda a RN18
const PREFIXO = 'estadia-prime:carrinho';
const VAZIO = Object.freeze({ itens: [], inclusosRetirados: [] });

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

// Aceita também o formato antigo (só a lista de itens), de antes dos inclusos
export function lerCarrinho(chave) {
  try {
    const salvo = JSON.parse(sessionStorage.getItem(chave) ?? 'null');
    const { itens, inclusosRetirados } = Array.isArray(salvo) ? { itens: salvo } : (salvo ?? {});
    return {
      itens: Array.isArray(itens) ? itens.filter(itemBemFormado) : [],
      inclusosRetirados: Array.isArray(inclusosRetirados) ? inclusosRetirados.filter(Number.isInteger) : [],
    };
  } catch {
    return VAZIO;
  }
}

export function salvarCarrinho(chave, { itens, inclusosRetirados } = VAZIO) {
  try {
    if (itens.length === 0 && inclusosRetirados.length === 0) sessionStorage.removeItem(chave);
    else sessionStorage.setItem(chave, JSON.stringify({ itens, inclusosRetirados }));
  } catch {
    // Navegador sem armazenamento (aba anônima, bloqueio): o carrinho vale só enquanto a página estiver aberta
  }
}
