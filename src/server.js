require('dotenv').config({ quiet: true });
const app = require('./app');
const { testarConexao } = require('./db');

const PORT = Number(process.env.PORT) || 3000;

async function iniciar() {
  try {
    // Falha cedo se o banco estiver inacessível ou mal configurado
    await testarConexao();
    app.listen(PORT, () => {
      console.log(`Servidor rodando em http://localhost:${PORT}`);
    });
  } catch (erro) {
    console.error('Não foi possível iniciar a API. Verifique o MySQL e as variáveis do arquivo .env.');
    process.exit(1);
  }
}

iniciar();
