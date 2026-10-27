const express = require('express');
const regioes = require('../services/regioes');

const router = express.Router();

// POST /regioes
router.post('/', async (req, res, next) => {
  try {
    res.status(201).json(await regioes.cadastrarRegiao(req.body));
  } catch (erro) {
    next(erro);
  }
});

// GET /regioes
router.get('/', async (req, res, next) => {
  try {
    res.json(await regioes.listarRegioes());
  } catch (erro) {
    next(erro);
  }
});

// GET /regioes/:id
router.get('/:id', async (req, res, next) => {
  try {
    res.json(await regioes.buscarRegiao(req.params.id));
  } catch (erro) {
    next(erro);
  }
});

// PUT /regioes/:id
router.put('/:id', async (req, res, next) => {
  try {
    res.json(await regioes.atualizarRegiao(req.params.id, req.body));
  } catch (erro) {
    next(erro);
  }
});

// DELETE /regioes/:id (somente sem vendas)
router.delete('/:id', async (req, res, next) => {
  try {
    res.json(await regioes.excluirRegiao(req.params.id));
  } catch (erro) {
    next(erro);
  }
});

module.exports = router;
