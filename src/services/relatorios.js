const pool = require('../db');
const { ErroApp, registrarErro } = require('../utils/erros');
const { validarData, somarDias } = require('../utils/validacao');

const arredondar = (valor) => Math.round(Number(valor) * 100) / 100;

// Relatório gerencial do período [inicio, fim] (ambos inclusive, formato AAAA-MM-DD).
// A meta mensal é avaliada no mês calendário da data inicial (mês de referência),
// somando todas as vendas desse mês de cada vendedor ativo.
async function gerarRelatorioPerformance(inicio, fim) {
  try {
    const dataInicio = validarData(inicio, 'inicio');
    const dataFim = validarData(fim, 'fim');
    if (dataInicio > dataFim) {
      throw new ErroApp(400, 'inicio não pode ser posterior a fim');
    }

    // Limites do período e do mês de referência (fim sempre exclusivo)
    const limiteFim = somarDias(dataFim, 1);
    const periodo = [dataInicio, limiteFim];

    const mesReferencia = dataInicio.slice(0, 7);
    const inicioMes = `${mesReferencia}-01`;
    const [ano, mes] = mesReferencia.split('-').map(Number);
    const inicioProximoMes = new Date(Date.UTC(ano, mes, 1)).toISOString().slice(0, 10);

    const [
      [totais],
      [porRegiao],
      [porTipoCliente],
      [melhorVendedor],
      [maiorComissao],
      [metas]
    ] = await Promise.all([
      // Total de vendas, valor total e comissão média geral
      pool.execute(
        `SELECT COUNT(*) AS total_vendas,
                COALESCE(SUM(valor_venda), 0) AS valor_total,
                COALESCE(SUM(valor_comissao), 0) AS comissao_total,
                COALESCE(AVG(valor_comissao), 0) AS comissao_media
         FROM vendas
         WHERE data_venda >= ? AND data_venda < ?`,
        periodo
      ),
      // Soma de vendas e comissão média por região (LEFT JOIN mantém regiões sem vendas)
      pool.execute(
        `SELECT r.id_regiao, r.nome_regiao,
                COUNT(v.id_venda) AS quantidade_vendas,
                COALESCE(SUM(v.valor_venda), 0) AS total_vendido,
                COALESCE(AVG(v.valor_comissao), 0) AS comissao_media
         FROM regioes r
         LEFT JOIN vendas v ON v.id_regiao = r.id_regiao
                           AND v.data_venda >= ? AND v.data_venda < ?
         GROUP BY r.id_regiao, r.nome_regiao
         ORDER BY r.id_regiao`,
        periodo
      ),
      // Soma de vendas por tipo de cliente
      pool.execute(
        `SELECT tipo_cliente,
                COUNT(*) AS quantidade_vendas,
                SUM(valor_venda) AS total_vendido
         FROM vendas
         WHERE data_venda >= ? AND data_venda < ?
         GROUP BY tipo_cliente`,
        periodo
      ),
      // Vendedor com maior valor vendido
      pool.execute(
        `SELECT ve.id_vendedor, ve.nome,
                COUNT(*) AS quantidade_vendas,
                SUM(v.valor_venda) AS total_vendido
         FROM vendas v
         JOIN vendedores ve ON ve.id_vendedor = v.id_vendedor
         WHERE v.data_venda >= ? AND v.data_venda < ?
         GROUP BY ve.id_vendedor, ve.nome
         ORDER BY total_vendido DESC, ve.nome
         LIMIT 1`,
        periodo
      ),
      // Vendedor com maior comissão acumulada
      pool.execute(
        `SELECT ve.id_vendedor, ve.nome,
                COUNT(*) AS quantidade_vendas,
                SUM(v.valor_comissao) AS total_comissao
         FROM vendas v
         JOIN vendedores ve ON ve.id_vendedor = v.id_vendedor
         WHERE v.data_venda >= ? AND v.data_venda < ?
         GROUP BY ve.id_vendedor, ve.nome
         ORDER BY total_comissao DESC, ve.nome
         LIMIT 1`,
        periodo
      ),
      // Meta x realizado no mês de referência, para cada vendedor ativo
      pool.execute(
        `SELECT ve.id_vendedor, ve.nome, ve.meta_mensal,
                COALESCE(SUM(v.valor_venda), 0) AS total_vendido,
                CASE WHEN COALESCE(SUM(v.valor_venda), 0) >= ve.meta_mensal THEN 1 ELSE 0 END AS atingiu_meta
         FROM vendedores ve
         LEFT JOIN vendas v ON v.id_vendedor = ve.id_vendedor
                           AND v.data_venda >= ? AND v.data_venda < ?
         WHERE ve.ativo = 1
         GROUP BY ve.id_vendedor, ve.nome, ve.meta_mensal
         ORDER BY ve.nome`,
        [inicioMes, inicioProximoMes]
      )
    ]);

    const vendedoresMeta = metas.map((m) => ({
      id_vendedor: m.id_vendedor,
      nome: m.nome,
      meta_mensal: arredondar(m.meta_mensal),
      total_vendido: arredondar(m.total_vendido),
      percentual_atingido: m.meta_mensal > 0 ? arredondar((m.total_vendido / m.meta_mensal) * 100) : null,
      atingiu_meta: Boolean(m.atingiu_meta)
    }));

    // Garante PF e PJ no resultado, mesmo sem vendas de um dos tipos
    const vendasPorTipo = ['PF', 'PJ'].map((tipo) => {
      const linha = porTipoCliente.find((l) => l.tipo_cliente === tipo);
      return {
        tipo_cliente: tipo,
        quantidade_vendas: linha ? linha.quantidade_vendas : 0,
        total_vendido: linha ? arredondar(linha.total_vendido) : 0
      };
    });

    return {
      periodo: { inicio: dataInicio, fim: dataFim },
      total_vendas: totais[0].total_vendas,
      valor_total_vendido: arredondar(totais[0].valor_total),
      comissao_total: arredondar(totais[0].comissao_total),
      comissao_media_geral: arredondar(totais[0].comissao_media),
      vendas_por_regiao: porRegiao.map((l) => ({
        id_regiao: l.id_regiao,
        nome_regiao: l.nome_regiao,
        quantidade_vendas: l.quantidade_vendas,
        total_vendido: arredondar(l.total_vendido)
      })),
      comissao_media_por_regiao: porRegiao.map((l) => ({
        id_regiao: l.id_regiao,
        nome_regiao: l.nome_regiao,
        comissao_media: arredondar(l.comissao_media)
      })),
      vendas_por_tipo_cliente: vendasPorTipo,
      melhor_vendedor: melhorVendedor.length > 0
        ? { ...melhorVendedor[0], total_vendido: arredondar(melhorVendedor[0].total_vendido) }
        : null,
      maior_comissao: maiorComissao.length > 0
        ? { ...maiorComissao[0], total_comissao: arredondar(maiorComissao[0].total_comissao) }
        : null,
      metas: {
        mes_referencia: mesReferencia,
        vendedores_ativos: vendedoresMeta.length,
        quantidade_atingida: vendedoresMeta.filter((v) => v.atingiu_meta).length,
        vendedores: vendedoresMeta
      }
    };
  } catch (erro) {
    registrarErro('gerarRelatorioPerformance', erro);
    throw erro;
  }
}

module.exports = { gerarRelatorioPerformance };
