// Executa sql/db_vendas.sql usando as credenciais do .env.
// Alternativa para quem não usa o cliente de linha de comando do MySQL.
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ quiet: true });

async function inicializarBanco() {
  let conexao;
  try {
    const script = fs.readFileSync(path.join(__dirname, '..', 'sql', 'db_vendas.sql'), 'utf8');

    // O script cria o banco, então a conexão não informa "database"
    conexao = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      multipleStatements: true
    });

    await conexao.query(script);
    console.log('Banco db_vendas criado e populado com sucesso.');
  } catch (erro) {
    console.error('Erro ao inicializar o banco:', erro.message);
    process.exitCode = 1;
  } finally {
    if (conexao) await conexao.end();
  }
}

inicializarBanco();
