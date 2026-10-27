const pool = require('../db');
const { ErroApp, registrarErro } = require('../utils/erros');
const {
  validarId,
  validarNumero,
  validarPercentual,
  validarTexto,
  validarBooleano
} = require('../utils/validacao');

const COLUNAS = 'id_vendedor, nome, meta_mensal, percentual_base, ativo';

// O MySQL devolve DECIMAL como texto e BOOLEAN como 0/1; aqui vira number/boolean.
function formatarVendedor(linha) {
  return {
    id_vendedor: linha.id_vendedor,
    nome: linha.nome,
    meta_mensal: Number(linha.meta_mensal),
    percentual_base: Number(linha.percentual_base),
    ativo: Boolean(linha.ativo)
  };
}

async function cadastrarVendedor(dados = {}) {
  try {
    const nome = validarTexto(dados.nome, 'nome', 100);
    const metaMensal = validarNumero(dados.meta_mensal, 'meta_mensal');
    const percentualBase = validarPercentual(dados.percentual_base, 'percentual_base');

    const [resultado] = await pool.execute(
      'INSERT INTO vendedores (nome, meta_mensal, percentual_base, ativo) VALUES (?, ?, ?, 1)',
      [nome, metaMensal, percentualBase]
    );
    return await buscarVendedor(resultado.insertId);
  } catch (erro) {
    registrarErro('cadastrarVendedor', erro);
    throw erro;
  }
}

// Filtro opcional: ativo = true | false. Sem filtro, lista todos.
async function listarVendedores({ ativo } = {}) {
  try {
    let sql = `SELECT ${COLUNAS} FROM vendedores`;
    const parametros = [];
    if (ativo !== undefined) {
      sql += ' WHERE ativo = ?';
      parametros.push(validarBooleano(ativo, 'ativo') ? 1 : 0);
    }
    sql += ' ORDER BY id_vendedor';

    const [linhas] = await pool.execute(sql, parametros);
    return linhas.map(formatarVendedor);
  } catch (erro) {
    registrarErro('listarVendedores', erro);
    throw erro;
  }
}

async function buscarVendedor(id) {
  try {
    const idVendedor = validarId(id, 'id do vendedor');
    const [linhas] = await pool.execute(
      `SELECT ${COLUNAS} FROM vendedores WHERE id_vendedor = ?`,
      [idVendedor]
    );
    if (linhas.length === 0) {
      throw new ErroApp(404, `Vendedor ${idVendedor} não encontrado`);
    }
    return formatarVendedor(linhas[0]);
  } catch (erro) {
    registrarErro('buscarVendedor', erro);
    throw erro;
  }
}

// Atualiza meta mensal e percentual base (e o nome, se informado).
// Vendas já registradas mantêm a comissão calculada na época.
async function atualizarVendedor(id, dados = {}) {
  try {
    const vendedor = await buscarVendedor(id);

    const campos = [];
    const parametros = [];
    if (dados.nome !== undefined) {
      campos.push('nome = ?');
      parametros.push(validarTexto(dados.nome, 'nome', 100));
    }
    if (dados.meta_mensal !== undefined) {
      campos.push('meta_mensal = ?');
      parametros.push(validarNumero(dados.meta_mensal, 'meta_mensal'));
    }
    if (dados.percentual_base !== undefined) {
      campos.push('percentual_base = ?');
      parametros.push(validarPercentual(dados.percentual_base, 'percentual_base'));
    }
    if (campos.length === 0) {
      throw new ErroApp(400, 'Informe ao menos um campo: nome, meta_mensal ou percentual_base');
    }

    // Os nomes das colunas vêm de uma lista fixa acima; só os valores são parâmetros
    await pool.execute(
      `UPDATE vendedores SET ${campos.join(', ')} WHERE id_vendedor = ?`,
      [...parametros, vendedor.id_vendedor]
    );
    return await buscarVendedor(vendedor.id_vendedor);
  } catch (erro) {
    registrarErro('atualizarVendedor', erro);
    throw erro;
  }
}

// Desativa sem apagar: o histórico de vendas continua intacto.
async function desativarVendedor(id) {
  try {
    const vendedor = await buscarVendedor(id);
    if (!vendedor.ativo) {
      throw new ErroApp(400, `Vendedor ${vendedor.id_vendedor} já está inativo`);
    }
    await pool.execute('UPDATE vendedores SET ativo = 0 WHERE id_vendedor = ?', [vendedor.id_vendedor]);
    return await buscarVendedor(vendedor.id_vendedor);
  } catch (erro) {
    registrarErro('desativarVendedor', erro);
    throw erro;
  }
}

async function ativarVendedor(id) {
  try {
    const vendedor = await buscarVendedor(id);
    if (vendedor.ativo) {
      throw new ErroApp(400, `Vendedor ${vendedor.id_vendedor} já está ativo`);
    }
    await pool.execute('UPDATE vendedores SET ativo = 1 WHERE id_vendedor = ?', [vendedor.id_vendedor]);
    return await buscarVendedor(vendedor.id_vendedor);
  } catch (erro) {
    registrarErro('ativarVendedor', erro);
    throw erro;
  }
}

// Exclusão física só é permitida para vendedor sem vendas; os demais devem ser desativados.
async function excluirVendedor(id) {
  try {
    const vendedor = await buscarVendedor(id);

    const [vendas] = await pool.execute(
      'SELECT COUNT(*) AS total FROM vendas WHERE id_vendedor = ?',
      [vendedor.id_vendedor]
    );
    if (vendas[0].total > 0) {
      throw new ErroApp(
        400,
        `O vendedor ${vendedor.nome} possui ${vendas[0].total} venda(s) e não pode ser excluído; use a desativação`
      );
    }

    await pool.execute('DELETE FROM vendedores WHERE id_vendedor = ?', [vendedor.id_vendedor]);
    return { mensagem: 'Vendedor excluído com sucesso', vendedor };
  } catch (erro) {
    registrarErro('excluirVendedor', erro);
    throw erro;
  }
}

module.exports = {
  cadastrarVendedor,
  listarVendedores,
  buscarVendedor,
  atualizarVendedor,
  desativarVendedor,
  ativarVendedor,
  excluirVendedor
};
