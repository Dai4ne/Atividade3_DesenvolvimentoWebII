// Erro de regra de negócio ou validação, com o status HTTP que deve ser devolvido.
class ErroApp extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

// Registra no console apenas erros inesperados (banco, bugs).
// Erros de validação já são devolvidos ao cliente e não precisam poluir o log.
function registrarErro(contexto, erro) {
  if (!(erro instanceof ErroApp)) {
    console.error(`Erro em ${contexto}:`, erro.message);
  }
}

const ERROS_DE_CONEXAO = [
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'PROTOCOL_CONNECTION_LOST',
  'ER_ACCESS_DENIED_ERROR',
  'ER_BAD_DB_ERROR',
  'ER_CON_COUNT_ERROR'
];

// Converte qualquer erro em { status, mensagem } para a resposta da API.
function traduzirErro(erro) {
  if (erro instanceof ErroApp) {
    return { status: erro.status, mensagem: erro.message };
  }
  if (erro.type === 'entity.parse.failed') {
    return { status: 400, mensagem: 'JSON inválido no corpo da requisição' };
  }
  if (ERROS_DE_CONEXAO.includes(erro.code)) {
    return { status: 500, mensagem: 'Erro de conexão com o banco de dados' };
  }
  // Proteção extra caso uma corrida entre requisições escape das validações
  if (erro.code === 'ER_DUP_ENTRY') {
    return { status: 400, mensagem: 'Registro duplicado' };
  }
  if (erro.code === 'ER_NO_REFERENCED_ROW_2' || erro.code === 'ER_ROW_IS_REFERENCED_2') {
    return { status: 400, mensagem: 'Operação viola um relacionamento entre registros' };
  }
  return { status: 500, mensagem: 'Erro interno ao processar a requisição' };
}

module.exports = { ErroApp, registrarErro, traduzirErro };
