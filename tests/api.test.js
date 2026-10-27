// Teste de integração da API. Exige o servidor rodando (npm start) e o banco criado com
// sql/db_vendas.sql. Execução: npm run test:api  (use API_URL para outro endereço).
//
// Os dados criados aqui usam datas de janeiro/2025 e são removidos ao final, então os
// totais do relatório são previsíveis e o teste pode ser repetido sem recriar o banco.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

async function chamar(metodo, caminho, corpo) {
  const resposta = await fetch(`${BASE_URL}${caminho}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined
  });
  return { status: resposta.status, corpo: await resposta.json() };
}

// Códigos de venda aleatórios para não colidir com os dados de teste do banco
const codigoBase = 800000000 + Math.floor(Math.random() * 1000000);
const venda = (n) => codigoBase + n;

const estado = { idVendedor: null };

describe('API de vendas e comissões', () => {
  before(async () => {
    try {
      await fetch(`${BASE_URL}/`);
    } catch {
      throw new Error(`API inacessível em ${BASE_URL}. Inicie o servidor com "npm start".`);
    }
  });

  // Remoção de qualquer resíduo, mesmo se algum teste falhar no meio
  after(async () => {
    for (let n = 1; n <= 10; n++) {
      await chamar('DELETE', `/vendas/${venda(n)}`);
    }
    if (estado.idVendedor) {
      await chamar('DELETE', `/vendedores/${estado.idVendedor}`);
    }
  });

  describe('servidor e dados iniciais', () => {
    it('GET / informa servidor e banco', async () => {
      const r = await chamar('GET', '/');
      assert.equal(r.status, 200);
      assert.equal(r.corpo.banco, 'conectado');
    });

    it('banco possui as quatro regiões com os bônus corretos', async () => {
      const r = await chamar('GET', '/regioes');
      assert.equal(r.status, 200);
      const bonus = Object.fromEntries(r.corpo.map((x) => [x.nome_regiao, x.percentual_bonus]));
      assert.deepEqual(bonus, { Norte: 1, Nordeste: 1, Sudeste: 0, Sul: 0.5 });
    });

    it('banco possui ao menos 5 vendedores e 15 vendas em todas as regiões, com PF e PJ', async () => {
      const vendedores = await chamar('GET', '/vendedores');
      assert.ok(vendedores.corpo.length >= 5);

      const vendas = await chamar('GET', '/vendas');
      assert.ok(vendas.corpo.length >= 15);
      assert.equal(new Set(vendas.corpo.map((v) => v.id_regiao)).size >= 4, true);
      assert.deepEqual([...new Set(vendas.corpo.map((v) => v.tipo_cliente))].sort(), ['PF', 'PJ']);
    });
  });

  describe('vendedores', () => {
    it('cadastra vendedor ativo', async () => {
      const r = await chamar('POST', '/vendedores', { nome: 'Vendedor de Teste', meta_mensal: 1000, percentual_base: 5 });
      assert.equal(r.status, 201);
      assert.equal(r.corpo.ativo, true);
      assert.equal(r.corpo.percentual_base, 5);
      estado.idVendedor = r.corpo.id_vendedor;
    });

    it('rejeita cadastro inválido (400)', async () => {
      const semNome = await chamar('POST', '/vendedores', { meta_mensal: 1000, percentual_base: 5 });
      assert.equal(semNome.status, 400);
      const metaNegativa = await chamar('POST', '/vendedores', { nome: 'X', meta_mensal: -1, percentual_base: 5 });
      assert.equal(metaNegativa.status, 400);
      const percentualAlto = await chamar('POST', '/vendedores', { nome: 'X', meta_mensal: 1, percentual_base: 101 });
      assert.equal(percentualAlto.status, 400);
    });

    it('consulta por código e devolve 404 quando não existe', async () => {
      const ok = await chamar('GET', `/vendedores/${estado.idVendedor}`);
      assert.equal(ok.status, 200);
      assert.equal(ok.corpo.nome, 'Vendedor de Teste');
      const inexistente = await chamar('GET', '/vendedores/999999');
      assert.equal(inexistente.status, 404);
    });

    it('atualiza a meta mensal', async () => {
      const r = await chamar('PUT', `/vendedores/${estado.idVendedor}`, { meta_mensal: 6000 });
      assert.equal(r.status, 200);
      assert.equal(r.corpo.meta_mensal, 6000);
      assert.equal(r.corpo.percentual_base, 5);
    });

    it('atualização sem campos é rejeitada (400) e em vendedor inexistente dá 404', async () => {
      assert.equal((await chamar('PUT', `/vendedores/${estado.idVendedor}`, {})).status, 400);
      assert.equal((await chamar('PUT', '/vendedores/999999', { meta_mensal: 1 })).status, 404);
    });
  });

  describe('vendas e comissões', () => {
    const casos = [
      { n: 1, regiao: 1, tipo: 'PJ', valor: 2000, comissao: 180, percentual: 9, data: '2025-01-10 10:00:00' },
      { n: 2, regiao: 3, tipo: 'PF', valor: 1000, comissao: 70, percentual: 7, data: '2025-01-11 11:00:00' },
      { n: 3, regiao: 2, tipo: 'PF', valor: 1500, comissao: 120, percentual: 8, data: '2025-01-12 12:00:00' },
      { n: 4, regiao: 4, tipo: 'PJ', valor: 3000, comissao: 255, percentual: 8.5, data: '2025-01-31 23:30:00' }
    ];

    for (const c of casos) {
      it(`registra venda ${c.tipo} na região ${c.regiao} com comissão de ${c.comissao}`, async () => {
        const r = await chamar('POST', '/vendas', {
          id_venda: venda(c.n),
          id_vendedor: estado.idVendedor,
          id_regiao: c.regiao,
          data_venda: c.data,
          valor_venda: c.valor,
          tipo_cliente: c.tipo
        });
        assert.equal(r.status, 201);
        assert.equal(r.corpo.venda.valor_comissao, c.comissao);
        assert.equal(r.corpo.calculo_comissao.percentual_total, c.percentual);
      });
    }

    it('rejeita código de venda duplicado (400)', async () => {
      const r = await chamar('POST', '/vendas', {
        id_venda: venda(1), id_vendedor: estado.idVendedor, id_regiao: 1, valor_venda: 10, tipo_cliente: 'PF'
      });
      assert.equal(r.status, 400);
    });

    it('rejeita vendedor inexistente, região inexistente e dados inválidos (400)', async () => {
      const base = { id_venda: venda(9), id_vendedor: estado.idVendedor, id_regiao: 1, valor_venda: 10, tipo_cliente: 'PF' };
      const invalidos = [
        { ...base, id_vendedor: 999999 },
        { ...base, id_regiao: 99 },
        { ...base, valor_venda: -5 },
        { ...base, valor_venda: 0 },
        { ...base, tipo_cliente: 'XX' },
        { ...base, data_venda: '2025-02-30' },
        { ...base, valor_venda: undefined }
      ];
      for (const corpo of invalidos) {
        const r = await chamar('POST', '/vendas', corpo);
        assert.equal(r.status, 400, JSON.stringify(corpo));
      }
    });

    it('consulta venda por código e devolve 404 quando não existe', async () => {
      const ok = await chamar('GET', `/vendas/${venda(1)}`);
      assert.equal(ok.status, 200);
      assert.equal(ok.corpo.nome_regiao, 'Norte');
      assert.equal((await chamar('GET', '/vendas/999999999')).status, 404);
    });

    it('consulta vendas por vendedor, com totais', async () => {
      const r = await chamar('GET', `/vendas/vendedor/${estado.idVendedor}`);
      assert.equal(r.status, 200);
      assert.equal(r.corpo.quantidade_vendas, 4);
      assert.equal(r.corpo.total_vendido, 7500);
      assert.equal(r.corpo.total_comissao, 625);
      assert.equal((await chamar('GET', '/vendas/vendedor/999999')).status, 404);
    });

    it('consulta vendas por região e aplica filtro de período', async () => {
      const r = await chamar('GET', '/vendas/regiao/1?inicio=2025-01-01&fim=2025-01-31');
      assert.equal(r.status, 200);
      assert.deepEqual(r.corpo.vendas.map((v) => v.id_venda), [venda(1)]);
      assert.equal((await chamar('GET', '/vendas/regiao/99')).status, 404);
    });

    it('lista vendas por período, incluindo o último dia inteiro', async () => {
      const r = await chamar('GET', '/vendas?inicio=2025-01-01&fim=2025-01-31');
      assert.equal(r.status, 200);
      assert.equal(r.corpo.length, 4);
      assert.equal((await chamar('GET', '/vendas?inicio=2025-13-01')).status, 400);
    });

    it('atualiza venda e recalcula a comissão', async () => {
      const r = await chamar('PUT', `/vendas/${venda(2)}`, { valor_venda: 1200 });
      assert.equal(r.status, 200);
      assert.equal(r.corpo.venda.valor_comissao, 84);
      assert.equal((await chamar('PUT', '/vendas/999999999', { valor_venda: 1 })).status, 404);
      assert.equal((await chamar('PUT', `/vendas/${venda(2)}`, {})).status, 400);
    });

    it('exclui venda existente e devolve 404 na segunda tentativa', async () => {
      assert.equal((await chamar('DELETE', `/vendas/${venda(3)}`)).status, 200);
      assert.equal((await chamar('DELETE', `/vendas/${venda(3)}`)).status, 404);
    });
  });

  describe('relatório de performance (janeiro/2025)', () => {
    let relatorio;

    it('retorna 200 com os indicadores do período', async () => {
      const r = await chamar('GET', '/relatorios/performance?inicio=2025-01-01&fim=2025-01-31');
      assert.equal(r.status, 200);
      relatorio = r.corpo;
    });

    it('totais gerais e comissão média', () => {
      assert.equal(relatorio.total_vendas, 3);
      assert.equal(relatorio.valor_total_vendido, 6200);
      assert.equal(relatorio.comissao_total, 519);
      assert.equal(relatorio.comissao_media_geral, 173);
    });

    it('vendas e comissão média por região (inclui região sem vendas)', () => {
      const total = Object.fromEntries(relatorio.vendas_por_regiao.map((r) => [r.nome_regiao, r.total_vendido]));
      assert.deepEqual(total, { Norte: 2000, Nordeste: 0, Sudeste: 1200, Sul: 3000 });
      const media = Object.fromEntries(relatorio.comissao_media_por_regiao.map((r) => [r.nome_regiao, r.comissao_media]));
      assert.deepEqual(media, { Norte: 180, Nordeste: 0, Sudeste: 84, Sul: 255 });
    });

    it('vendas por tipo de cliente', () => {
      assert.deepEqual(relatorio.vendas_por_tipo_cliente, [
        { tipo_cliente: 'PF', quantidade_vendas: 1, total_vendido: 1200 },
        { tipo_cliente: 'PJ', quantidade_vendas: 2, total_vendido: 5000 }
      ]);
    });

    it('melhor vendedor e maior comissão', () => {
      assert.equal(relatorio.melhor_vendedor.id_vendedor, estado.idVendedor);
      assert.equal(relatorio.melhor_vendedor.total_vendido, 6200);
      assert.equal(relatorio.maior_comissao.id_vendedor, estado.idVendedor);
      assert.equal(relatorio.maior_comissao.total_comissao, 519);
    });

    it('metas: vendedor de teste (meta 6000, vendeu 6200) atingiu', () => {
      assert.equal(relatorio.metas.mes_referencia, '2025-01');
      const meu = relatorio.metas.vendedores.find((v) => v.id_vendedor === estado.idVendedor);
      assert.equal(meu.atingiu_meta, true);
      assert.equal(relatorio.metas.quantidade_atingida, 1);
    });

    it('período sem vendas devolve zeros e indicadores nulos', async () => {
      const r = await chamar('GET', '/relatorios/performance?inicio=2020-01-01&fim=2020-01-31');
      assert.equal(r.status, 200);
      assert.equal(r.corpo.total_vendas, 0);
      assert.equal(r.corpo.melhor_vendedor, null);
      assert.equal(r.corpo.metas.quantidade_atingida, 0);
    });

    it('relatório de outubro/2026 usa os dados de teste do banco', async () => {
      const r = await chamar('GET', '/relatorios/performance?inicio=2026-10-01&fim=2026-10-31');
      assert.equal(r.status, 200);
      assert.equal(r.corpo.metas.mes_referencia, '2026-10');
      assert.ok(r.corpo.total_vendas >= 15);
      assert.equal(r.corpo.vendas_por_regiao.length, 4);
      assert.ok(r.corpo.metas.quantidade_atingida >= 1);
    });

    it('rejeita parâmetros ausentes, inválidos ou invertidos (400)', async () => {
      const urls = [
        '/relatorios/performance',
        '/relatorios/performance?inicio=2025-01-01',
        '/relatorios/performance?inicio=01/01/2025&fim=2025-01-31',
        '/relatorios/performance?inicio=2025-01-31&fim=2025-01-01'
      ];
      for (const url of urls) {
        assert.equal((await chamar('GET', url)).status, 400, url);
      }
    });
  });

  describe('ciclo de vida do vendedor', () => {
    it('desativa e rejeita nova venda para vendedor inativo (400)', async () => {
      const d = await chamar('PATCH', `/vendedores/${estado.idVendedor}/desativar`);
      assert.equal(d.status, 200);
      assert.equal(d.corpo.ativo, false);

      const venda5 = await chamar('POST', '/vendas', {
        id_venda: venda(5), id_vendedor: estado.idVendedor, id_regiao: 1, valor_venda: 10, tipo_cliente: 'PF'
      });
      assert.equal(venda5.status, 400);
    });

    it('preserva o histórico de vendas do vendedor inativo', async () => {
      const r = await chamar('GET', `/vendas/vendedor/${estado.idVendedor}`);
      assert.equal(r.status, 200);
      assert.equal(r.corpo.quantidade_vendas, 3);
    });

    it('vendedor inativo sai da lista de ativos e do cálculo de metas', async () => {
      const ativos = await chamar('GET', '/vendedores?ativo=true');
      assert.equal(ativos.corpo.some((v) => v.id_vendedor === estado.idVendedor), false);
      const inativos = await chamar('GET', '/vendedores?ativo=false');
      assert.equal(inativos.corpo.some((v) => v.id_vendedor === estado.idVendedor), true);
      const rel = await chamar('GET', '/relatorios/performance?inicio=2025-01-01&fim=2025-01-31');
      assert.equal(rel.corpo.metas.vendedores.some((v) => v.id_vendedor === estado.idVendedor), false);
    });

    it('não exclui vendedor com vendas (400)', async () => {
      const r = await chamar('DELETE', `/vendedores/${estado.idVendedor}`);
      assert.equal(r.status, 400);
    });

    it('reativa o vendedor', async () => {
      const r = await chamar('PATCH', `/vendedores/${estado.idVendedor}/ativar`);
      assert.equal(r.status, 200);
      assert.equal(r.corpo.ativo, true);
    });
  });

  describe('regiões', () => {
    it('rejeita região duplicada e nome fora das quatro permitidas (400)', async () => {
      assert.equal((await chamar('POST', '/regioes', { nome_regiao: 'Norte', percentual_bonus: 1 })).status, 400);
      assert.equal((await chamar('POST', '/regioes', { nome_regiao: 'Centro-Oeste', percentual_bonus: 1 })).status, 400);
    });

    it('consulta, atualiza e não exclui região com vendas', async () => {
      assert.equal((await chamar('GET', '/regioes/4')).corpo.nome_regiao, 'Sul');
      assert.equal((await chamar('GET', '/regioes/99')).status, 404);

      const atualizada = await chamar('PUT', '/regioes/4', { percentual_bonus: 0.5 });
      assert.equal(atualizada.status, 200);
      assert.equal(atualizada.corpo.percentual_bonus, 0.5);

      assert.equal((await chamar('DELETE', '/regioes/4')).status, 400);
    });
  });

  describe('erros gerais', () => {
    it('rota inexistente devolve 404 e JSON malformado devolve 400', async () => {
      assert.equal((await chamar('GET', '/nao-existe')).status, 404);

      const resposta = await fetch(`${BASE_URL}/vendedores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ "nome": "quebrado",'
      });
      assert.equal(resposta.status, 400);
    });
  });
});
