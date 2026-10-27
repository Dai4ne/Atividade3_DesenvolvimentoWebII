// Testes unitários da regra de comissão. Não precisam de banco de dados.
// Execução: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const { calcularComissao } = require('../src/services/comissao');

test('exemplo do enunciado: R$ 2.000 PJ no Norte com base 5% = R$ 180,00 (9%)', async () => {
  const r = await calcularComissao(2000, 5, 'PJ', 1);
  assert.equal(r.percentual_total, 9);
  assert.equal(r.valor_comissao, 180);
});

test('PF no Sudeste soma 2% e 0% de bônus', async () => {
  const r = await calcularComissao(1000, 5, 'PF', 0);
  assert.equal(r.percentual_cliente, 2);
  assert.equal(r.percentual_total, 7);
  assert.equal(r.valor_comissao, 70);
});

test('PJ no Sul soma 3% e 0,5% de bônus', async () => {
  const r = await calcularComissao(3000, 5, 'PJ', 0.5);
  assert.equal(r.percentual_total, 8.5);
  assert.equal(r.valor_comissao, 255);
});

test('os percentuais são somados, sem composição', async () => {
  // Com composição daria 1000 * 1,05 * 1,02 * 1,01 - 1000; a regra é soma simples: 8%
  const r = await calcularComissao(1000, 5, 'PF', 1);
  assert.equal(r.valor_comissao, 80);
});

test('arredonda para centavos sem erro de ponto flutuante', async () => {
  const r = await calcularComissao(4200.5, 4.5, 'PJ', 1);
  // 4200,50 * 8,5% = 357,0425
  assert.equal(r.valor_comissao, 357.04);

  const s = await calcularComissao(0.1, 0.2, 'PF', 0);
  // 0,10 * 2,2% = 0,0022 -> 0,00
  assert.equal(s.valor_comissao, 0);
});

test('percentual base zero ainda recebe os bônus', async () => {
  const r = await calcularComissao(100, 0, 'PJ', 0);
  assert.equal(r.valor_comissao, 3);
});

test('aceita valores vindos do MySQL como texto (DECIMAL)', async () => {
  const r = await calcularComissao('2000.00', '5.00', 'PJ', '1.00');
  assert.equal(r.valor_comissao, 180);
});

test('rejeita tipo de cliente inválido', async () => {
  await assert.rejects(() => calcularComissao(100, 5, 'XX', 0), { status: 400 });
});
