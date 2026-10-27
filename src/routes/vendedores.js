const express = require('express');
const vendedores = require('../services/vendedores');

const router = express.Router();

// POST /vendedores
router.post('/', async (req, res, next) => {
  try {
    res.status(201).json(await vendedores.cadastrarVendedor(req.body));
  } catch (erro) {
    next(erro);
  }
});

// GET /vendedores?ativo=true|false
router.get('/', async (req, res, next) => {
  try {
    res.json(await vendedores.listarVendedores({ ativo: req.query.ativo }));
  } catch (erro) {
    next(erro);
  }
});

// GET /vendedores/:id
router.get('/:id', async (req, res, next) => {
  try {
    res.json(await vendedores.buscarVendedor(req.params.id));
  } catch (erro) {
    next(erro);
  }
});

// PUT /vendedores/:id
router.put('/:id', async (req, res, next) => {
  try {
    res.json(await vendedores.atualizarVendedor(req.params.id, req.body));
  } catch (erro) {
    next(erro);
  }
});

// PATCH /vendedores/:id/desativar
router.patch('/:id/desativar', async (req, res, next) => {
  try {
    res.json(await vendedores.desativarVendedor(req.params.id));
  } catch (erro) {
    next(erro);
  }
});

// PATCH /vendedores/:id/ativar
router.patch('/:id/ativar', async (req, res, next) => {
  try {
    res.json(await vendedores.ativarVendedor(req.params.id));
  } catch (erro) {
    next(erro);
  }
});

// DELETE /vendedores/:id (somente sem vendas)
router.delete('/:id', async (req, res, next) => {
  try {
    res.json(await vendedores.excluirVendedor(req.params.id));
  } catch (erro) {
    next(erro);
  }
});

module.exports = router;
