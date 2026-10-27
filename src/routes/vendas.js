const express = require('express');
const vendas = require('../services/vendas');

const router = express.Router();

// POST /vendas
router.post('/', async (req, res, next) => {
  try {
    res.status(201).json(await vendas.registrarVenda(req.body));
  } catch (erro) {
    next(erro);
  }
});

// GET /vendas?inicio=AAAA-MM-DD&fim=AAAA-MM-DD
router.get('/', async (req, res, next) => {
  try {
    res.json(await vendas.listarVendas(req.query));
  } catch (erro) {
    next(erro);
  }
});

// As rotas fixas vêm antes de /:id para não serem confundidas com um código de venda

// GET /vendas/vendedor/:id
router.get('/vendedor/:id', async (req, res, next) => {
  try {
    res.json(await vendas.consultarVendasPorVendedor(req.params.id, req.query));
  } catch (erro) {
    next(erro);
  }
});

// GET /vendas/regiao/:id
router.get('/regiao/:id', async (req, res, next) => {
  try {
    res.json(await vendas.consultarVendasPorRegiao(req.params.id, req.query));
  } catch (erro) {
    next(erro);
  }
});

// GET /vendas/:id
router.get('/:id', async (req, res, next) => {
  try {
    res.json(await vendas.buscarVenda(req.params.id));
  } catch (erro) {
    next(erro);
  }
});

// PUT /vendas/:id
router.put('/:id', async (req, res, next) => {
  try {
    res.json(await vendas.atualizarVenda(req.params.id, req.body));
  } catch (erro) {
    next(erro);
  }
});

// DELETE /vendas/:id
router.delete('/:id', async (req, res, next) => {
  try {
    res.json(await vendas.excluirVenda(req.params.id));
  } catch (erro) {
    next(erro);
  }
});

module.exports = router;
