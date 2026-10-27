const { ErroApp } = require('../utils/erros');

// Bônus fixo por tipo de cliente (em %). O bônus da região vem do banco.
const BONUS_CLIENTE = { PF: 2, PJ: 3 };

// Única implementação da regra de comissão (usada ao registrar e ao atualizar vendas).
// Os percentuais são somados, sem composição:
//   comissão = valor * (base + bônus cliente + bônus região) / 100
async function calcularComissao(valorVenda, percentualBase, tipoCliente, percentualRegiao) {
  const percentualCliente = BONUS_CLIENTE[tipoCliente];
  if (percentualCliente === undefined) {
    throw new ErroApp(400, "tipo_cliente deve ser 'PF' ou 'PJ'");
  }

  const base = Number(percentualBase);
  const regiao = Number(percentualRegiao);
  const percentualTotal = Math.round((base + percentualCliente + regiao) * 100) / 100;

  // Conta em centavos para evitar erros de ponto flutuante (ex.: 0.1 + 0.2)
  const centavosVenda = Math.round(Number(valorVenda) * 100);
  const centavosPercentual = Math.round(percentualTotal * 100);
  const centavosComissao = Math.round((centavosVenda * centavosPercentual) / 10000);

  return {
    percentual_base: base,
    percentual_cliente: percentualCliente,
    percentual_regiao: regiao,
    percentual_total: percentualTotal,
    valor_comissao: centavosComissao / 100
  };
}

module.exports = { calcularComissao, BONUS_CLIENTE };
