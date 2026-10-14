// Guarda as tentativas na memória do processo: zera ao reiniciar e não é compartilhado entre
// processos. Suficiente para o MVP, que roda num único processo Node (CONTEXT.md §4.1).
const LIMITE_ENTRADAS_ANTES_DA_LIMPEZA = 10_000;

function criarLimitadorTentativasMemoria({
  maximoFalhas = 5,
  janelaMs = 15 * 60 * 1000,
  agora = () => Date.now(),
} = {}) {
  const falhasPorChave = new Map();

  function janelaExpirou(registro) {
    return agora() - registro.inicioJanela >= janelaMs;
  }

  function removerJanelasExpiradas() {
    for (const [chave, registro] of falhasPorChave) {
      if (janelaExpirou(registro)) falhasPorChave.delete(chave);
    }
  }

  function segundosAteLiberar(chave) {
    const registro = falhasPorChave.get(chave);
    if (!registro || registro.falhas < maximoFalhas || janelaExpirou(registro)) return 0;
    return Math.ceil((registro.inicioJanela + janelaMs - agora()) / 1000);
  }

  function registrarFalha(chave) {
    const registro = falhasPorChave.get(chave);
    if (!registro || janelaExpirou(registro)) {
      if (falhasPorChave.size >= LIMITE_ENTRADAS_ANTES_DA_LIMPEZA) removerJanelasExpiradas();
      falhasPorChave.set(chave, { falhas: 1, inicioJanela: agora() });
      return;
    }
    registro.falhas += 1;
  }

  function limpar(chave) {
    falhasPorChave.delete(chave);
  }

  return { segundosAteLiberar, registrarFalha, limpar };
}

module.exports = { criarLimitadorTentativasMemoria };
