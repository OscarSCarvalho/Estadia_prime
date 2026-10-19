const { carregarConfig } = require('./config');
const { abrirBanco } = require('./db/database');
const { criarApp } = require('./app');

const config = carregarConfig();
const db = abrirBanco();

const { app, encerrar, gateway, executarRotinaPagamentos } = criarApp({ db, config });
const INTERVALO_ROTINA_MS = 15 * 60_000;

const servidor = app.listen(config.porta, () => {
  console.log(`Estadia Prime API rodando em http://localhost:${config.porta} (pagamento: ${gateway.nome})`);
});

// RN07 + RN09 + CB03: expira reservas, tenta reembolsos pendentes e faz os repasses (sem biblioteca de agenda)
async function rodarRotina() {
  const resumo = await executarRotinaPagamentos();
  if (resumo) console.log('Rotina de pagamentos:', JSON.stringify(resumo));
}
const rotina = setInterval(() => rodarRotina().catch(console.error), INTERVALO_ROTINA_MS);
setTimeout(() => rodarRotina().catch(console.error), 10_000).unref();

function desligar(sinal) {
  console.log(`${sinal} recebido, encerrando...`);
  clearInterval(rotina);
  servidor.close(() => {
    encerrar();
    db.close();
    process.exit(0);
  });
}

process.on('SIGINT', () => desligar('SIGINT'));
process.on('SIGTERM', () => desligar('SIGTERM'));
