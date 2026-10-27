const express = require('express');
const { testarConexao } = require('./db');
const { traduzirErro } = require('./utils/erros');

const app = express();

app.use(express.json());

// Verificação de saúde: confirma que a API está no ar e que o banco responde
app.get('/', async (req, res) => {
  try {
    await testarConexao();
    res.json({ status: 'ok', mensagem: 'API de vendas e comissões em execução', banco: 'conectado' });
  } catch (erro) {
    res.status(500).json({ status: 'erro', mensagem: 'API em execução, mas o banco está indisponível', banco: 'indisponível' });
  }
});

app.use('/vendedores', require('./routes/vendedores'));
app.use('/regioes', require('./routes/regioes'));
app.use('/vendas', require('./routes/vendas'));
app.use('/relatorios', require('./routes/relatorios'));

// Rota inexistente
app.use((req, res) => {
  res.status(404).json({ erro: `Rota ${req.method} ${req.originalUrl} não encontrada` });
});

// Tratamento central de erros: toda falha chega aqui via next(erro)
app.use((erro, req, res, next) => {
  const { status, mensagem } = traduzirErro(erro);
  if (status === 500) {
    console.error(`${req.method} ${req.originalUrl}:`, erro.message);
  }
  res.status(status).json({ erro: mensagem });
});

module.exports = app;
