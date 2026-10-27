-- Banco de dados do sistema de vendas, comissões e metas.
-- Requer MySQL 8.0.16+ (as restrições CHECK só são aplicadas a partir dessa versão).
-- O script é reexecutável: apaga e recria as tabelas, restaurando os dados de teste.

CREATE DATABASE IF NOT EXISTS db_vendas
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE db_vendas;

DROP TABLE IF EXISTS vendas;
DROP TABLE IF EXISTS vendedores;
DROP TABLE IF EXISTS regioes;

-- ---------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------

CREATE TABLE regioes (
  id_regiao        INT           NOT NULL AUTO_INCREMENT,
  nome_regiao      VARCHAR(50)   NOT NULL,
  percentual_bonus DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
  PRIMARY KEY (id_regiao),
  CONSTRAINT uq_regioes_nome UNIQUE (nome_regiao),
  CONSTRAINT ck_regioes_nome CHECK (nome_regiao IN ('Norte', 'Nordeste', 'Sudeste', 'Sul')),
  CONSTRAINT ck_regioes_bonus CHECK (percentual_bonus BETWEEN 0 AND 100)
) ENGINE = InnoDB;

CREATE TABLE vendedores (
  id_vendedor     INT           NOT NULL AUTO_INCREMENT,
  nome            VARCHAR(100)  NOT NULL,
  meta_mensal     DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  percentual_base DECIMAL(5,2)  NOT NULL,
  ativo           BOOLEAN       NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id_vendedor),
  CONSTRAINT ck_vendedores_meta CHECK (meta_mensal >= 0),
  CONSTRAINT ck_vendedores_base CHECK (percentual_base BETWEEN 0 AND 100)
) ENGINE = InnoDB;

CREATE TABLE vendas (
  id_venda       INT           NOT NULL AUTO_INCREMENT,
  id_vendedor    INT           NOT NULL,
  id_regiao      INT           NOT NULL,
  data_venda     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  valor_venda    DECIMAL(12,2) NOT NULL,
  tipo_cliente   ENUM('PF', 'PJ') NOT NULL,
  valor_comissao DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (id_venda),
  -- RESTRICT impede apagar vendedor ou região que tenham vendas (preserva o histórico)
  CONSTRAINT fk_vendas_vendedor FOREIGN KEY (id_vendedor)
    REFERENCES vendedores (id_vendedor) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_vendas_regiao FOREIGN KEY (id_regiao)
    REFERENCES regioes (id_regiao) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT ck_vendas_valor CHECK (valor_venda > 0),
  CONSTRAINT ck_vendas_comissao CHECK (valor_comissao >= 0),
  -- Índices usados pelos filtros por período e pelos relatórios
  INDEX idx_vendas_data (data_venda),
  INDEX idx_vendas_vendedor_data (id_vendedor, data_venda),
  INDEX idx_vendas_regiao_data (id_regiao, data_venda)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- Dados de teste
-- ---------------------------------------------------------------------

INSERT INTO regioes (id_regiao, nome_regiao, percentual_bonus) VALUES
  (1, 'Norte',    1.00),
  (2, 'Nordeste', 1.00),
  (3, 'Sudeste',  0.00),
  (4, 'Sul',      0.50);

-- O vendedor 6 é inativo, mas mantém uma venda no histórico.
INSERT INTO vendedores (id_vendedor, nome, meta_mensal, percentual_base, ativo) VALUES
  (1, 'Ana Souza',    20000.00, 5.00, TRUE),
  (2, 'Bruno Lima',   15000.00, 4.50, TRUE),
  (3, 'Carla Mendes', 25000.00, 6.00, TRUE),
  (4, 'Diego Ferreira', 10000.00, 4.00, TRUE),
  (5, 'Elisa Rocha',  30000.00, 5.50, TRUE),
  (6, 'Fábio Torres', 12000.00, 5.00, FALSE);

-- A comissão das vendas de teste é calculada na própria inserção, com a mesma regra
-- da API: valor * (percentual_base + bônus do cliente + bônus da região) / 100.
-- Bônus do cliente: PF = 2%, PJ = 3%. Bônus da região vem da tabela regioes.
INSERT INTO vendas (id_venda, id_vendedor, id_regiao, data_venda, valor_venda, tipo_cliente, valor_comissao)
SELECT t.id_venda, t.id_vendedor, t.id_regiao, t.data_venda, t.valor_venda, t.tipo_cliente,
       ROUND(t.valor_venda * (ve.percentual_base + IF(t.tipo_cliente = 'PJ', 3, 2) + r.percentual_bonus) / 100, 2)
FROM (
  SELECT  1 AS id_venda, 1 AS id_vendedor, 1 AS id_regiao, '2026-10-02 10:15:00' AS data_venda,  8000.00 AS valor_venda, 'PJ' AS tipo_cliente
  UNION ALL SELECT  2, 1, 3, '2026-10-08 14:30:00',  7500.00, 'PF'
  UNION ALL SELECT  3, 1, 4, '2026-10-15 09:45:00',  6000.00, 'PJ'
  UNION ALL SELECT 10, 1, 1, '2026-10-22 11:20:00',  2000.00, 'PJ'
  UNION ALL SELECT  4, 2, 2, '2026-10-03 11:00:00',  5000.00, 'PF'
  UNION ALL SELECT  5, 2, 2, '2026-10-12 16:20:00',  4200.50, 'PJ'
  UNION ALL SELECT  6, 2, 1, '2026-10-20 13:10:00',  3000.00, 'PF'
  UNION ALL SELECT  7, 3, 3, '2026-10-01 09:00:00', 12000.00, 'PJ'
  UNION ALL SELECT  8, 3, 3, '2026-10-10 15:00:00',  9000.00, 'PF'
  UNION ALL SELECT  9, 3, 4, '2026-10-18 10:30:00',  5500.00, 'PJ'
  UNION ALL SELECT 11, 4, 2, '2026-10-05 08:50:00',  3500.00, 'PF'
  UNION ALL SELECT 12, 4, 1, '2026-10-14 12:00:00',  2800.00, 'PJ'
  UNION ALL SELECT 13, 4, 4, '2026-10-21 14:15:00',  1900.00, 'PF'
  UNION ALL SELECT 14, 5, 3, '2026-10-04 10:00:00', 15000.00, 'PJ'
  UNION ALL SELECT 15, 5, 2, '2026-10-11 11:30:00',  9800.00, 'PF'
  UNION ALL SELECT 16, 5, 4, '2026-10-19 15:40:00',  4000.00, 'PJ'
  UNION ALL SELECT 17, 5, 1, '2026-10-26 09:10:00',  3000.00, 'PF'
  UNION ALL SELECT 18, 6, 3, '2026-10-09 16:00:00',  4000.00, 'PF'
  UNION ALL SELECT 19, 1, 2, '2026-09-18 10:00:00',  3000.00, 'PF'
) AS t
JOIN vendedores ve ON ve.id_vendedor = t.id_vendedor
JOIN regioes r     ON r.id_regiao    = t.id_regiao;

-- Garante que o próximo código automático fique acima dos códigos de teste
ALTER TABLE vendas AUTO_INCREMENT = 20;
