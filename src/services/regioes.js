const pool = require('../db');
const { ErroApp, registrarErro } = require('../utils/erros');
const { validarId, validarPercentual } = require('../utils/validacao');

const REGIOES_VALIDAS = ['Norte', 'Nordeste', 'Sudeste', 'Sul'];

function formatarRegiao(linha) {
  return {
    id_regiao: linha.id_regiao,
    nome_regiao: linha.nome_regiao,
    percentual_bonus: Number(linha.percentual_bonus)
  };
}

// Aceita o nome em qualquer caixa e devolve a grafia oficial.
function validarNomeRegiao(valor) {
  const nome = typeof valor === 'string'
    ? REGIOES_VALIDAS.find((r) => r.toLowerCase() === valor.trim().toLowerCase())
    : undefined;
  if (!nome) {
    throw new ErroApp(400, `nome_regiao deve ser um de: ${REGIOES_VALIDAS.join(', ')}`);
  }
  return nome;
}

async function cadastrarRegiao(dados = {}) {
  try {
    const nome = validarNomeRegiao(dados.nome_regiao);
    const bonus = validarPercentual(dados.percentual_bonus ?? 0, 'percentual_bonus');

    const [existente] = await pool.execute('SELECT 1 FROM regioes WHERE nome_regiao = ?', [nome]);
    if (existente.length > 0) {
      throw new ErroApp(400, `A região ${nome} já está cadastrada`);
    }

    const [resultado] = await pool.execute(
      'INSERT INTO regioes (nome_regiao, percentual_bonus) VALUES (?, ?)',
      [nome, bonus]
    );
    return await buscarRegiao(resultado.insertId);
  } catch (erro) {
    registrarErro('cadastrarRegiao', erro);
    throw erro;
  }
}

async function listarRegioes() {
  try {
    const [linhas] = await pool.execute(
      'SELECT id_regiao, nome_regiao, percentual_bonus FROM regioes ORDER BY id_regiao'
    );
    return linhas.map(formatarRegiao);
  } catch (erro) {
    registrarErro('listarRegioes', erro);
    throw erro;
  }
}

async function buscarRegiao(id) {
  try {
    const idRegiao = validarId(id, 'id da região');
    const [linhas] = await pool.execute(
      'SELECT id_regiao, nome_regiao, percentual_bonus FROM regioes WHERE id_regiao = ?',
      [idRegiao]
    );
    if (linhas.length === 0) {
      throw new ErroApp(404, `Região ${idRegiao} não encontrada`);
    }
    return formatarRegiao(linhas[0]);
  } catch (erro) {
    registrarErro('buscarRegiao', erro);
    throw erro;
  }
}

// Permite alterar o bônus e, opcionalmente, o nome (dentro das quatro regiões válidas).
async function atualizarRegiao(id, dados = {}) {
  try {
    const regiao = await buscarRegiao(id);

    if (dados.nome_regiao === undefined && dados.percentual_bonus === undefined) {
      throw new ErroApp(400, 'Informe nome_regiao e/ou percentual_bonus');
    }
    const nome = dados.nome_regiao !== undefined ? validarNomeRegiao(dados.nome_regiao) : regiao.nome_regiao;
    const bonus = dados.percentual_bonus !== undefined
      ? validarPercentual(dados.percentual_bonus, 'percentual_bonus')
      : regiao.percentual_bonus;

    if (nome !== regiao.nome_regiao) {
      const [existente] = await pool.execute('SELECT 1 FROM regioes WHERE nome_regiao = ?', [nome]);
      if (existente.length > 0) {
        throw new ErroApp(400, `A região ${nome} já está cadastrada`);
      }
    }

    await pool.execute(
      'UPDATE regioes SET nome_regiao = ?, percentual_bonus = ? WHERE id_regiao = ?',
      [nome, bonus, regiao.id_regiao]
    );
    return await buscarRegiao(regiao.id_regiao);
  } catch (erro) {
    registrarErro('atualizarRegiao', erro);
    throw erro;
  }
}

// Só remove regiões sem vendas, para não perder o histórico.
async function excluirRegiao(id) {
  try {
    const regiao = await buscarRegiao(id);

    const [vendas] = await pool.execute(
      'SELECT COUNT(*) AS total FROM vendas WHERE id_regiao = ?',
      [regiao.id_regiao]
    );
    if (vendas[0].total > 0) {
      throw new ErroApp(400, `A região ${regiao.nome_regiao} possui ${vendas[0].total} venda(s) e não pode ser excluída`);
    }

    await pool.execute('DELETE FROM regioes WHERE id_regiao = ?', [regiao.id_regiao]);
    return { mensagem: 'Região excluída com sucesso', regiao };
  } catch (erro) {
    registrarErro('excluirRegiao', erro);
    throw erro;
  }
}

module.exports = {
  cadastrarRegiao,
  listarRegioes,
  buscarRegiao,
  atualizarRegiao,
  excluirRegiao
};
