const { carregarConfig } = require('./config');
const { abrirBanco } = require('./db/database');
const { criarApp } = require('./app');

const config = carregarConfig();
const db = abrirBanco();
const { app, encerrar } = criarApp({ db, config });

const servidor = app.listen(config.porta, () => {
  console.log(`Estadia Prime API rodando em http://localhost:${config.porta}`);
});

function desligar(sinal) {
  console.log(`${sinal} recebido, encerrando...`);
  servidor.close(() => {
    encerrar();
    db.close();
    process.exit(0);
  });
}

process.on('SIGINT', () => desligar('SIGINT'));
process.on('SIGTERM', () => desligar('SIGTERM'));
