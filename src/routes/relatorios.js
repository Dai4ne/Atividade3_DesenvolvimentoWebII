const express = require('express');
const relatorios = require('../services/relatorios');

const router = express.Router();

// GET /relatorios/performance?inicio=AAAA-MM-DD&fim=AAAA-MM-DD
router.get('/performance', async (req, res, next) => {
  try {
    res.json(await relatorios.gerarRelatorioPerformance(req.query.inicio, req.query.fim));
  } catch (erro) {
    next(erro);
  }
});

module.exports = router;
