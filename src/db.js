const mysql = require('mysql2/promise');
require('dotenv').config({ quiet: true });

// Pool único, reutilizado por todos os services. As credenciais vêm do .env.
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'db_vendas',
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true // DATETIME volta como texto, sem conversão de fuso horário
});

// Usado na inicialização e na rota raiz para confirmar que o banco responde.
async function testarConexao() {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (erro) {
    console.error('Falha ao conectar no MySQL:', erro.message);
    throw erro;
  }
}

module.exports = pool;
module.exports.testarConexao = testarConexao;
