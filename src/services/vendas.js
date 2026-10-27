const pool = require('../db');
const { ErroApp, registrarErro } = require('../utils/erros');
const {
  validarId,
  validarNumero,
  validarTipoCliente,
  validarData,
  validarDataHora,
  agora,
  somarDias
} = require('../utils/validacao');
const { calcularComissao } = require('./comissao');
const { buscarVendedor } = require('./vendedores');
const { buscarRegiao } = require('./regioes');

const SELECT_VENDA = `
  SELECT v.id_venda, v.id_vendedor, ve.nome AS nome_vendedor,
         v.id_regiao, r.nome_regiao, v.data_venda,
         v.valor_venda, v.tipo_cliente, v.valor_comissao
  FROM vendas v
  JOIN vendedores ve ON ve.id_vendedor = v.id_vendedor
  JOIN regioes r ON r.id_regiao = v.id_regiao`;

function formatarVenda(linha) {
  return {
    id_venda: linha.id_venda,
    id_vendedor: linha.id_vendedor,
    nome_vendedor: linha.nome_vendedor,
    id_regiao: linha.id_regiao,
    nome_regiao: linha.nome_regiao,
    data_venda: linha.data_venda,
    valor_venda: Number(linha.valor_venda),
    tipo_cliente: linha.tipo_cliente,
    valor_comissao: Number(linha.valor_comissao)
  };
}

// Dentro do registro de uma venda, vendedor ou região inexistentes são erro de
// validação do corpo (400), e não recurso não encontrado na URL (404).
async function obterVendedorParaVenda(idVendedor, { exigirAtivo }) {
  const [linhas] = await pool.execute(
    'SELECT id_vendedor, percentual_base, ativo FROM vendedores WHERE id_vendedor = ?',
    [idVendedor]
  );
  if (linhas.length === 0) {
    throw new ErroApp(400, `Vendedor ${idVendedor} não encontrado`);
  }
  if (exigirAtivo && !linhas[0].ativo) {
    throw new ErroApp(400, `Vendedor ${idVendedor} está inativo e não pode registrar vendas`);
  }
  return linhas[0];
}

async function obterRegiaoParaVenda(idRegiao) {
  const [linhas] = await pool.execute(
    'SELECT id_regiao, percentual_bonus FROM regioes WHERE id_regiao = ?',
    [idRegiao]
  );
  if (linhas.length === 0) {
    throw new ErroApp(400, `Região ${idRegiao} não encontrada`);
  }
  return linhas[0];
}

// Valida a venda, calcula a comissão e grava. id_venda é opcional: quando informado,
// precisa ser único; quando omitido, o MySQL gera o próximo código.
async function registrarVenda(dados = {}) {
  try {
    const idVendedor = validarId(dados.id_vendedor, 'id_vendedor');
    const idRegiao = validarId(dados.id_regiao, 'id_regiao');
    const valorVenda = validarNumero(dados.valor_venda, 'valor_venda', { min: 0, minExclusivo: true });
    const tipoCliente = validarTipoCliente(dados.tipo_cliente);
    const dataVenda = dados.data_venda !== undefined && dados.data_venda !== null
      ? validarDataHora(dados.data_venda, 'data_venda')
      : agora();

    let idVenda = null;
    if (dados.id_venda !== undefined && dados.id_venda !== null) {
      idVenda = validarId(dados.id_venda, 'id_venda');
      const [existente] = await pool.execute('SELECT 1 FROM vendas WHERE id_venda = ?', [idVenda]);
      if (existente.length > 0) {
        throw new ErroApp(400, `Já existe uma venda com o código ${idVenda}`);
      }
    }

    const vendedor = await obterVendedorParaVenda(idVendedor, { exigirAtivo: true });
    const regiao = await obterRegiaoParaVenda(idRegiao);
    const comissao = await calcularComissao(
      valorVenda, vendedor.percentual_base, tipoCliente, regiao.percentual_bonus
    );

    const [resultado] = await pool.execute(
      `INSERT INTO vendas (id_venda, id_vendedor, id_regiao, data_venda, valor_venda, tipo_cliente, valor_comissao)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [idVenda, idVendedor, idRegiao, dataVenda, valorVenda, tipoCliente, comissao.valor_comissao]
    );

    return {
      venda: await buscarVenda(idVenda ?? resultado.insertId),
      calculo_comissao: comissao
    };
  } catch (erro) {
    registrarErro('registrarVenda', erro);
    throw erro;
  }
}

// Consulta base usada pelas listagens. Todos os filtros são opcionais e parametrizados.
async function consultarVendas({ idVendedor, idRegiao, inicio, fim } = {}) {
  const condicoes = [];
  const parametros = [];

  if (idVendedor !== undefined) {
    condicoes.push('v.id_vendedor = ?');
    parametros.push(idVendedor);
  }
  if (idRegiao !== undefined) {
    condicoes.push('v.id_regiao = ?');
    parametros.push(idRegiao);
  }
  if (inicio !== undefined) {
    condicoes.push('v.data_venda >= ?');
    parametros.push(validarData(inicio, 'inicio'));
  }
  if (fim !== undefined) {
    // O dia final entra inteiro: usa-se o início do dia seguinte como limite exclusivo
    condicoes.push('v.data_venda < ?');
    parametros.push(somarDias(validarData(fim, 'fim'), 1));
  }

  const where = condicoes.length > 0 ? ` WHERE ${condicoes.join(' AND ')}` : '';
  const [linhas] = await pool.execute(
    `${SELECT_VENDA}${where} ORDER BY v.data_venda DESC, v.id_venda DESC`,
    parametros
  );
  return linhas.map(formatarVenda);
}

async function listarVendas(filtros = {}) {
  try {
    return await consultarVendas({ inicio: filtros.inicio, fim: filtros.fim });
  } catch (erro) {
    registrarErro('listarVendas', erro);
    throw erro;
  }
}

async function buscarVenda(id) {
  try {
    const idVenda = validarId(id, 'id da venda');
    const [linhas] = await pool.execute(`${SELECT_VENDA} WHERE v.id_venda = ?`, [idVenda]);
    if (linhas.length === 0) {
      throw new ErroApp(404, `Venda ${idVenda} não encontrada`);
    }
    return formatarVenda(linhas[0]);
  } catch (erro) {
    registrarErro('buscarVenda', erro);
    throw erro;
  }
}

// Totais calculados sobre a lista já filtrada (em centavos, para não acumular erro de ponto flutuante)
function resumirVendas(vendas) {
  const somar = (campo) =>
    vendas.reduce((total, venda) => total + Math.round(venda[campo] * 100), 0) / 100;
  return {
    quantidade_vendas: vendas.length,
    total_vendido: somar('valor_venda'),
    total_comissao: somar('valor_comissao')
  };
}

async function consultarVendasPorVendedor(idVendedor, filtros = {}) {
  try {
    const vendedor = await buscarVendedor(idVendedor);
    const vendas = await consultarVendas({
      idVendedor: vendedor.id_vendedor,
      inicio: filtros.inicio,
      fim: filtros.fim
    });
    return { vendedor, ...resumirVendas(vendas), vendas };
  } catch (erro) {
    registrarErro('consultarVendasPorVendedor', erro);
    throw erro;
  }
}

async function consultarVendasPorRegiao(idRegiao, filtros = {}) {
  try {
    const regiao = await buscarRegiao(idRegiao);
    const vendas = await consultarVendas({
      idRegiao: regiao.id_regiao,
      inicio: filtros.inicio,
      fim: filtros.fim
    });
    return { regiao, ...resumirVendas(vendas), vendas };
  } catch (erro) {
    registrarErro('consultarVendasPorRegiao', erro);
    throw erro;
  }
}

// Atualiza qualquer campo da venda (exceto o código) e recalcula a comissão com
// o percentual atual do vendedor e o bônus atual da região.
async function atualizarVenda(id, dados = {}) {
  try {
    const atual = await buscarVenda(id);

    const campos = ['id_vendedor', 'id_regiao', 'data_venda', 'valor_venda', 'tipo_cliente'];
    if (!campos.some((campo) => dados[campo] !== undefined)) {
      throw new ErroApp(400, `Informe ao menos um campo: ${campos.join(', ')}`);
    }

    const idVendedor = dados.id_vendedor !== undefined ? validarId(dados.id_vendedor, 'id_vendedor') : atual.id_vendedor;
    const idRegiao = dados.id_regiao !== undefined ? validarId(dados.id_regiao, 'id_regiao') : atual.id_regiao;
    const valorVenda = dados.valor_venda !== undefined
      ? validarNumero(dados.valor_venda, 'valor_venda', { min: 0, minExclusivo: true })
      : atual.valor_venda;
    const tipoCliente = dados.tipo_cliente !== undefined ? validarTipoCliente(dados.tipo_cliente) : atual.tipo_cliente;
    const dataVenda = dados.data_venda !== undefined ? validarDataHora(dados.data_venda, 'data_venda') : atual.data_venda;

    // Só exige vendedor ativo quando a venda é transferida para outro vendedor,
    // para permitir corrigir vendas antigas de quem já foi desativado.
    const vendedor = await obterVendedorParaVenda(idVendedor, { exigirAtivo: idVendedor !== atual.id_vendedor });
    const regiao = await obterRegiaoParaVenda(idRegiao);
    const comissao = await calcularComissao(
      valorVenda, vendedor.percentual_base, tipoCliente, regiao.percentual_bonus
    );

    await pool.execute(
      `UPDATE vendas
       SET id_vendedor = ?, id_regiao = ?, data_venda = ?, valor_venda = ?, tipo_cliente = ?, valor_comissao = ?
       WHERE id_venda = ?`,
      [idVendedor, idRegiao, dataVenda, valorVenda, tipoCliente, comissao.valor_comissao, atual.id_venda]
    );

    return {
      venda: await buscarVenda(atual.id_venda),
      calculo_comissao: comissao
    };
  } catch (erro) {
    registrarErro('atualizarVenda', erro);
    throw erro;
  }
}

// Confere se a venda existe (404 caso contrário) antes de excluir.
async function excluirVenda(id) {
  try {
    const venda = await buscarVenda(id);
    await pool.execute('DELETE FROM vendas WHERE id_venda = ?', [venda.id_venda]);
    return { mensagem: 'Venda excluída com sucesso', venda };
  } catch (erro) {
    registrarErro('excluirVenda', erro);
    throw erro;
  }
}

module.exports = {
  registrarVenda,
  listarVendas,
  buscarVenda,
  consultarVendasPorVendedor,
  consultarVendasPorRegiao,
  atualizarVenda,
  excluirVenda
};
