const { ErroApp } = require('./erros');

const MAX_DECIMAL_12_2 = 9999999999.99;

// Valida ids vindos da URL ou do corpo (inteiro positivo).
function validarId(valor, campo = 'id') {
  const texto = String(valor ?? '');
  if (!/^\d+$/.test(texto) || Number(texto) < 1 || Number(texto) > 2147483647) {
    throw new ErroApp(400, `${campo} deve ser um inteiro positivo`);
  }
  return Number(texto);
}

// Valida números com no máximo 2 casas decimais (compatível com DECIMAL(x,2)).
function validarNumero(valor, campo, { min = 0, minExclusivo = false, max = MAX_DECIMAL_12_2 } = {}) {
  if (valor === undefined || valor === null || valor === '') {
    throw new ErroApp(400, `${campo} é obrigatório`);
  }
  if (typeof valor !== 'number' && typeof valor !== 'string') {
    throw new ErroApp(400, `${campo} deve ser numérico`);
  }
  const numero = Number(valor);
  if (!Number.isFinite(numero)) {
    throw new ErroApp(400, `${campo} deve ser numérico`);
  }
  if (minExclusivo ? numero <= min : numero < min) {
    throw new ErroApp(400, `${campo} deve ser ${minExclusivo ? 'maior que' : 'maior ou igual a'} ${min}`);
  }
  if (numero > max) {
    throw new ErroApp(400, `${campo} deve ser menor ou igual a ${max}`);
  }
  if (Math.abs(numero * 100 - Math.round(numero * 100)) > 1e-6) {
    throw new ErroApp(400, `${campo} deve ter no máximo 2 casas decimais`);
  }
  return numero;
}

function validarPercentual(valor, campo) {
  return validarNumero(valor, campo, { min: 0, max: 100 });
}

function validarTexto(valor, campo, tamanhoMaximo) {
  if (typeof valor !== 'string' || valor.trim() === '') {
    throw new ErroApp(400, `${campo} é obrigatório`);
  }
  const texto = valor.trim();
  if (texto.length > tamanhoMaximo) {
    throw new ErroApp(400, `${campo} deve ter no máximo ${tamanhoMaximo} caracteres`);
  }
  return texto;
}

function validarTipoCliente(valor) {
  const tipo = typeof valor === 'string' ? valor.trim().toUpperCase() : '';
  if (tipo !== 'PF' && tipo !== 'PJ') {
    throw new ErroApp(400, "tipo_cliente deve ser 'PF' ou 'PJ'");
  }
  return tipo;
}

function dataExiste(ano, mes, dia, hora = 0, minuto = 0, segundo = 0) {
  if (ano < 1000 || hora > 23 || minuto > 59 || segundo > 59) return false;
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
}

// Aceita AAAA-MM-DD e devolve o mesmo texto, se for uma data real.
function validarData(valor, campo) {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(valor ?? ''));
  if (!partes || !dataExiste(+partes[1], +partes[2], +partes[3])) {
    throw new ErroApp(400, `${campo} deve estar no formato AAAA-MM-DD`);
  }
  return partes[0];
}

// Aceita AAAA-MM-DD, AAAA-MM-DD HH:MM[:SS] ou com "T" no lugar do espaço.
// Devolve no formato do MySQL: AAAA-MM-DD HH:MM:SS.
function validarDataHora(valor, campo) {
  const partes = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(String(valor ?? ''));
  if (!partes) {
    throw new ErroApp(400, `${campo} deve estar no formato AAAA-MM-DD ou AAAA-MM-DD HH:MM:SS`);
  }
  const [, ano, mes, dia, hora = '00', minuto = '00', segundo = '00'] = partes;
  if (!dataExiste(+ano, +mes, +dia, +hora, +minuto, +segundo)) {
    throw new ErroApp(400, `${campo} não é uma data válida`);
  }
  return `${ano}-${mes}-${dia} ${hora}:${minuto}:${segundo}`;
}

// Data e hora atuais do servidor no formato do MySQL.
function agora() {
  const d = new Date();
  const dois = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())} ` +
    `${dois(d.getHours())}:${dois(d.getMinutes())}:${dois(d.getSeconds())}`;
}

// Soma dias a uma data AAAA-MM-DD. Usado para o limite exclusivo dos períodos.
function somarDias(dataIso, dias) {
  const [ano, mes, dia] = dataIso.split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

// Converte "true", "false", "1" e "0" da query string em booleano.
function validarBooleano(valor, campo) {
  if (['true', '1'].includes(String(valor).toLowerCase())) return true;
  if (['false', '0'].includes(String(valor).toLowerCase())) return false;
  throw new ErroApp(400, `${campo} deve ser true ou false`);
}

module.exports = {
  validarId,
  validarNumero,
  validarPercentual,
  validarTexto,
  validarTipoCliente,
  validarData,
  validarDataHora,
  validarBooleano,
  agora,
  somarDias
};
