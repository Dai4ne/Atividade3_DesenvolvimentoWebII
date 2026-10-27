# Sistema de Vendas com Comissões, Metas e Performance

API REST em **Node.js + Express + MySQL** (`mysql2/promise`) para gerenciar vendedores, regiões e vendas, calcular comissões automaticamente e gerar relatórios de desempenho comercial.

- Funções assíncronas (`async/await`) com `try/catch` em todos os services
- Consultas SQL parametrizadas (sem concatenação de valores, protegendo contra SQL Injection)
- Relatórios com `JOIN`, `GROUP BY`, `SUM()`, `AVG()` e `COUNT()`
- Credenciais do banco em variáveis de ambiente (`.env`), sem senhas no código

---

## Sumário

1. [Pré-requisitos](#1-pré-requisitos)
2. [Instalação passo a passo](#2-instalação-passo-a-passo)
3. [Executando a aplicação](#3-executando-a-aplicação)
4. [Estrutura do projeto](#4-estrutura-do-projeto)
5. [Modelo de dados](#5-modelo-de-dados)
6. [Regras de comissão](#6-regras-de-comissão)
7. [Endpoints da API](#7-endpoints-da-api)
8. [Relatório de performance](#8-relatório-de-performance)
9. [Testes](#9-testes)
10. [Tratamento de erros](#10-tratamento-de-erros)
11. [Decisões de projeto](#11-decisões-de-projeto)
12. [Problemas comuns](#12-problemas-comuns)

---

## 1. Pré-requisitos

| Ferramenta | Versão | Observação |
| --- | --- | --- |
| Node.js | 18 ou superior | Inclui o `npm` e o `fetch` usado nos testes |
| MySQL | **8.0.16 ou superior** | Versões anteriores ignoram as restrições `CHECK` |
| Cliente HTTP | qualquer | VS Code com a extensão *REST Client*, Postman, Insomnia ou Thunder Client |

Confira as versões instaladas:

```bash
node -v
npm -v
mysql --version
```

---

## 2. Instalação passo a passo

### 2.1 Obter o projeto

```bash
git clone <url-do-seu-repositorio>
cd sistema-vendas
```

### 2.2 Instalar as dependências

```bash
npm install
```

Dependências de produção: `express`, `mysql2` e `dotenv`.

### 2.3 Configurar as variáveis de ambiente

Copie o arquivo de exemplo e edite com os dados do seu MySQL:

```bash
# Linux / macOS / Git Bash
cp .env.example .env

# Windows (PowerShell)
Copy-Item .env.example .env
```

Conteúdo do `.env`:

```env
PORT=3000

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=sua_senha_aqui
DB_NAME=db_vendas
```

> O `.env` está no `.gitignore` e **não deve ser enviado ao GitHub**. Apenas o `.env.example` (sem senha) é versionado.

### 2.4 Criar o banco de dados

O script `sql/db_vendas.sql` cria o banco `db_vendas`, as três tabelas, os relacionamentos e os dados de teste (4 regiões, 6 vendedores e 19 vendas). Escolha **uma** das opções:

**Opção A: pelo npm (usa as credenciais do `.env`, não precisa do cliente `mysql`)**

```bash
npm run db:init
```

**Opção B: pela linha de comando do MySQL**

```bash
mysql -u root -p < sql/db_vendas.sql
```

**Opção C: pelo MySQL Workbench / DBeaver**

Abra o arquivo `sql/db_vendas.sql` e execute o script inteiro.

O script é **reexecutável**: ele apaga e recria as tabelas, então serve também para restaurar os dados de teste a qualquer momento.

### 2.5 Verificar a instalação

```bash
npm test
```

Executa os testes unitários da regra de comissão (não precisam de banco).

---

## 3. Executando a aplicação

```bash
npm start
```

Saída esperada:

```
Servidor rodando em http://localhost:3000
```

Para reiniciar automaticamente a cada alteração de código (desenvolvimento):

```bash
npm run dev
```

Teste rápido:

```bash
curl http://localhost:3000/
```

```json
{ "status": "ok", "mensagem": "API de vendas e comissões em execução", "banco": "conectado" }
```

Se o MySQL estiver parado ou as credenciais estiverem erradas, a API não inicia e mostra a mensagem de erro no console.

| Script | Função |
| --- | --- |
| `npm start` | Inicia a API |
| `npm run dev` | Inicia a API reiniciando a cada alteração |
| `npm run db:init` | Executa `sql/db_vendas.sql` (recria o banco com os dados de teste) |
| `npm test` | Testes unitários da comissão (sem banco) |
| `npm run test:api` | Testes de integração da API (exige servidor e banco rodando) |

---

## 4. Estrutura do projeto

```
sistema-vendas/
├── sql/
│   └── db_vendas.sql          # Banco, tabelas, relacionamentos e dados de teste
├── scripts/
│   └── init-db.js             # Executa o .sql usando o .env (npm run db:init)
├── src/
│   ├── server.js              # Inicialização: valida a conexão e sobe o Express
│   ├── app.js                 # Express, rotas, 404 e tratamento central de erros
│   ├── db.js                  # Pool de conexões mysql2/promise
│   ├── routes/                # Camada HTTP (recebe a requisição e responde JSON)
│   │   ├── vendedores.js
│   │   ├── regioes.js
│   │   ├── vendas.js
│   │   └── relatorios.js
│   ├── services/              # Regras de negócio e SQL (funções async/await)
│   │   ├── vendedores.js
│   │   ├── regioes.js
│   │   ├── vendas.js
│   │   ├── comissao.js        # calcularComissao(): única implementação da regra
│   │   └── relatorios.js      # gerarRelatorioPerformance()
│   └── utils/
│       ├── erros.js           # ErroApp, tradução de erros em status HTTP
│       └── validacao.js       # Validações reutilizáveis
├── tests/
│   ├── comissao.test.js       # Testes unitários da comissão
│   └── api.test.js            # Testes de integração (script de teste automatizado)
├── requests.http              # Requisições manuais para todos os endpoints
├── .env.example
└── package.json
```

As rotas só tratam HTTP; toda a regra de negócio e o acesso ao banco ficam nos services.

---

## 5. Modelo de dados

```
regioes (1) ────< vendas >──── (1) vendedores
```

**regioes**

| Campo | Tipo | Restrições |
| --- | --- | --- |
| id_regiao | INT | PK, auto incremento |
| nome_regiao | VARCHAR(50) | Único; somente Norte, Nordeste, Sudeste ou Sul |
| percentual_bonus | DECIMAL(5,2) | Entre 0 e 100 |

**vendedores**

| Campo | Tipo | Restrições |
| --- | --- | --- |
| id_vendedor | INT | PK, auto incremento |
| nome | VARCHAR(100) | Obrigatório |
| meta_mensal | DECIMAL(12,2) | `>= 0` |
| percentual_base | DECIMAL(5,2) | Entre 0 e 100 |
| ativo | BOOLEAN | Padrão `TRUE` |

**vendas**

| Campo | Tipo | Restrições |
| --- | --- | --- |
| id_venda | INT | PK (código único da venda) |
| id_vendedor | INT | FK para `vendedores`, `ON DELETE RESTRICT` |
| id_regiao | INT | FK para `regioes`, `ON DELETE RESTRICT` |
| data_venda | DATETIME | Padrão: data/hora atual |
| valor_venda | DECIMAL(12,2) | `> 0` |
| tipo_cliente | ENUM('PF','PJ') | Obrigatório |
| valor_comissao | DECIMAL(12,2) | `>= 0`, calculado pela API |

`ON DELETE RESTRICT` garante que um vendedor ou região com vendas nunca seja apagado, preservando o histórico. Há índices em `data_venda`, `(id_vendedor, data_venda)` e `(id_regiao, data_venda)` para acelerar os filtros e relatórios.

### Dados de teste (`sql/db_vendas.sql`)

- **Regiões:** Norte (1%), Nordeste (1%), Sudeste (0%), Sul (0,5%)
- **Vendedores:** 5 ativos (Ana, Bruno, Carla, Diego, Elisa) e 1 inativo (Fábio, com uma venda no histórico)
- **Vendas:** 19 vendas distribuídas nas quatro regiões, com PF e PJ, quase todas em outubro/2026 e uma em setembro/2026
- **Metas de outubro/2026:** Ana, Carla e Elisa atingem a meta; Bruno e Diego não

---

## 6. Regras de comissão

```
comissão = valor_venda × (percentual_base + bônus do cliente + bônus da região) / 100
```

Os percentuais são **somados**, sem composição.

| Tipo de cliente | Bônus | | Região | Bônus |
| --- | --- | --- | --- | --- |
| PF (Pessoa Física) | 2% | | Norte | 1% |
| PJ (Pessoa Jurídica) | 3% | | Nordeste | 1% |
| | | | Sudeste | 0% |
| | | | Sul | 0,5% |

**Exemplo:** venda de R$ 2.000,00, cliente PJ, região Norte, vendedor com base de 5%:
5% + 3% + 1% = 9% → R$ 2.000,00 × 9% = **R$ 180,00**.

A regra existe em um único lugar, a função `calcularComissao()` em `src/services/comissao.js`, usada tanto no registro quanto na atualização de vendas. O bônus da região é lido da tabela `regioes`, e o cálculo é feito em centavos para evitar erros de ponto flutuante.

---

## 7. Endpoints da API

Todas as respostas são JSON. Em caso de erro: `{ "erro": "mensagem" }`.

### Vendedores

| Método | Endpoint | Operação | Sucesso |
| --- | --- | --- | --- |
| POST | `/vendedores` | Cadastrar vendedor | 201 |
| GET | `/vendedores` | Listar (filtro opcional `?ativo=true\|false`) | 200 |
| GET | `/vendedores/:id` | Consultar por código | 200 |
| PUT | `/vendedores/:id` | Atualizar `meta_mensal`, `percentual_base` e/ou `nome` | 200 |
| PATCH | `/vendedores/:id/desativar` | Desativar (preserva o histórico) | 200 |
| PATCH | `/vendedores/:id/ativar` | Reativar | 200 |
| DELETE | `/vendedores/:id` | Excluir (somente se não tiver vendas) | 200 |

Corpo do cadastro:

```json
{ "nome": "Gabriela Nunes", "meta_mensal": 18000, "percentual_base": 5 }
```

### Regiões

| Método | Endpoint | Operação | Sucesso |
| --- | --- | --- | --- |
| POST | `/regioes` | Cadastrar (nome entre Norte, Nordeste, Sudeste e Sul) | 201 |
| GET | `/regioes` | Listar | 200 |
| GET | `/regioes/:id` | Consultar | 200 |
| PUT | `/regioes/:id` | Atualizar `percentual_bonus` e/ou `nome_regiao` | 200 |
| DELETE | `/regioes/:id` | Excluir (somente se não tiver vendas) | 200 |

### Vendas

| Método | Endpoint | Operação | Sucesso |
| --- | --- | --- | --- |
| POST | `/vendas` | Registrar venda (valida e calcula a comissão) | 201 |
| GET | `/vendas` | Listar (filtros opcionais `?inicio=` e `?fim=`) | 200 |
| GET | `/vendas/:id` | Consultar por código | 200 |
| GET | `/vendas/vendedor/:id` | Vendas de um vendedor, com totais | 200 |
| GET | `/vendas/regiao/:id` | Vendas de uma região, com totais | 200 |
| PUT | `/vendas/:id` | Atualizar venda (recalcula a comissão) | 200 |
| DELETE | `/vendas/:id` | Excluir venda (verifica se existe) | 200 |

Corpo do registro (`id_venda` e `data_venda` são opcionais):

```json
{
  "id_venda": 101,
  "id_vendedor": 1,
  "id_regiao": 1,
  "data_venda": "2026-10-23 10:00:00",
  "valor_venda": 2000,
  "tipo_cliente": "PJ"
}
```

Resposta `201`:

```json
{
  "venda": {
    "id_venda": 101,
    "id_vendedor": 1,
    "nome_vendedor": "Ana Souza",
    "id_regiao": 1,
    "nome_regiao": "Norte",
    "data_venda": "2026-10-23 10:00:00",
    "valor_venda": 2000,
    "tipo_cliente": "PJ",
    "valor_comissao": 180
  },
  "calculo_comissao": {
    "percentual_base": 5,
    "percentual_cliente": 3,
    "percentual_regiao": 1,
    "percentual_total": 9,
    "valor_comissao": 180
  }
}
```

**Validações do registro** (todas retornam `400`):

- código de venda (`id_venda`) já existente (omitindo o campo, o MySQL gera o próximo código)
- vendedor inexistente ou **inativo**
- região inexistente
- `valor_venda` ausente, zero ou negativo
- `tipo_cliente` diferente de `PF` ou `PJ`
- `data_venda` inválida (formatos aceitos: `AAAA-MM-DD` ou `AAAA-MM-DD HH:MM:SS`)

`/vendas/vendedor/:id` e `/vendas/regiao/:id` aceitam os mesmos filtros `inicio` e `fim` e devolvem, além da lista, `quantidade_vendas`, `total_vendido` e `total_comissao`.

### Relatórios

| Método | Endpoint | Operação |
| --- | --- | --- |
| GET | `/relatorios/performance?inicio=AAAA-MM-DD&fim=AAAA-MM-DD` | Relatório gerencial do período |

### Saúde

| Método | Endpoint | Operação |
| --- | --- | --- |
| GET | `/` | Confirma que a API e o banco estão no ar |

---

## 8. Relatório de performance

```
GET /relatorios/performance?inicio=2026-10-01&fim=2026-10-31
```

O período inclui o dia final por inteiro. Indicadores retornados:

| Campo da resposta | Indicador | Como é calculado |
| --- | --- | --- |
| `total_vendas` | Total de vendas | `COUNT(*)` |
| `vendas_por_regiao` | Soma em R$ por região | `LEFT JOIN` regiões + `GROUP BY` + `SUM()` |
| `vendas_por_tipo_cliente` | Soma em R$ para PF e PJ | `GROUP BY tipo_cliente` + `SUM()` |
| `melhor_vendedor` | Maior valor vendido | `JOIN` vendedores + `GROUP BY` + `SUM()` |
| `maior_comissao` | Maior comissão acumulada | `JOIN` vendedores + `GROUP BY` + `SUM(valor_comissao)` |
| `metas` | Metas atingidas no mês | `LEFT JOIN` + `GROUP BY` + `SUM()` comparado com a meta |
| `comissao_media_geral` | Média da comissão por venda | `AVG(valor_comissao)` |
| `comissao_media_por_regiao` | Média da comissão por região | `LEFT JOIN` + `GROUP BY` + `AVG()` |

Também são retornados `valor_total_vendido` e `comissao_total`.

**Mês de referência das metas:** a meta é mensal, então é avaliada no **mês calendário da data inicial** informada. Para cada vendedor **ativo**, somam-se as vendas desse mês inteiro e compara-se com a `meta_mensal`. O campo `metas.mes_referencia` informa o mês usado (ex.: `"2026-10"`), e `metas.vendedores` detalha total vendido, percentual atingido e se atingiu a meta. Os demais indicadores usam exatamente o intervalo `inicio` a `fim`.

Recortes do relatório (a resposta completa é maior):

```json
{
  "periodo": { "inicio": "2026-10-01", "fim": "2026-10-31" },
  "total_vendas": 18,
  "melhor_vendedor": { "id_vendedor": 5, "nome": "Elisa Rocha", "quantidade_vendas": 4, "total_vendido": 31800 },
  "metas": {
    "mes_referencia": "2026-10",
    "vendedores_ativos": 5,
    "quantidade_atingida": 3
  }
}
```

(Com o banco recém-criado pelo script; após rodar o `requests.http`, os totais mudam porque novas vendas são registradas.)

---

## 9. Testes

### 9.1 Requisições manuais: `requests.http`

Arquivo com uma requisição para cada endpoint e cada cenário de erro, no estilo de quem usa a extensão **REST Client** do VS Code (clique em *Send Request* acima de cada `###`). Também pode ser consultado para montar as requisições no Postman, Insomnia ou Thunder Client.

Roteiro coberto, em ordem:

- cadastro de vendedor e validações (nome ausente, meta negativa, percentual acima de 100)
- consulta (todos, ativos, inativos, por código, inexistente), atualização de meta e de percentual base
- regiões: listar, consultar, duplicidade, nome inválido, atualizar bônus, tentativa de excluir com vendas
- registro de vendas nas **quatro regiões**, PF e PJ, com a comissão esperada no título de cada requisição
- erros de venda: código duplicado, vendedor inexistente, vendedor inativo, região inexistente, valor negativo/zero, tipo e data inválidos
- listagens e consultas por vendedor e por região, atualização com recálculo e exclusão
- desativar/reativar vendedor, histórico preservado e exclusão de vendedor
- relatórios (outubro, semana, setembro, período vazio, parâmetros inválidos)
- rota inexistente e JSON malformado

> Execute o `requests.http` a partir do banco recém-criado (`npm run db:init`): ele assume que o primeiro vendedor cadastrado recebe o `id` 7. Para repetir o roteiro, recrie o banco com o mesmo comando.

### 9.2 Teste automatizado da API: `npm run test:api`

Script de integração (`tests/api.test.js`, usa o executor nativo do Node) que percorre a API real e verifica status e valores. Com o servidor rodando em outro terminal:

```bash
npm start            # terminal 1
npm run test:api     # terminal 2
```

Por padrão usa `http://localhost:3000`; para outro endereço: `API_URL=http://host:porta npm run test:api`.

Cobre os testes obrigatórios do enunciado:

- dados de teste: pelo menos 5 vendedores e 15 vendas, nas 4 regiões, com PF e PJ
- cadastro de vendedor e registro de vendas com **comissão correta** (R$ 180, 70, 120 e 255)
- venda com **código duplicado**
- venda para vendedor **inexistente** e **inativo**
- **atualização da meta mensal**
- consultas **por região** e **por vendedor**
- **relatório mensal** com valores exatos e identificação do **atingimento de metas**
- exclusão com verificação de existência, desativação com histórico preservado

O teste cria seus próprios dados em janeiro/2025 e os remove ao final, portanto pode ser repetido sem recriar o banco.

### 9.3 Testes unitários da comissão: `npm test`

Testa `calcularComissao()` sem banco: exemplo do enunciado (R$ 180,00), PF/PJ, bônus por região, soma sem composição, arredondamento em centavos e tipo de cliente inválido.

### 9.4 Erro de conexão com o banco

Com a API rodando, pare o MySQL e faça qualquer requisição: a API responde `500` com `{"erro":"Erro de conexão com o banco de dados"}` (sem expor detalhes internos) e registra o motivo no console. `GET /` responde `500` com `"banco": "indisponível"`.

### 9.5 Capturas de tela (entregável)

Salve as capturas das requisições e respostas do Postman/Insomnia (ou do REST Client) em uma pasta `docs/capturas/` do repositório. Sugestão do que capturar: cadastro de vendedor, venda com comissão de R$ 180,00, venda duplicada (400), vendedor inativo (400), atualização de meta, consultas por vendedor e por região e o relatório de performance.

---

## 10. Tratamento de erros

| Código | Quando |
| --- | --- |
| `200` | Consulta, atualização ou exclusão bem-sucedida |
| `201` | Cadastro ou registro de venda bem-sucedido |
| `400` | Dados inválidos ou regra de negócio violada (valor, código duplicado, vendedor inativo, região inválida, período inválido, exclusão com vínculos, JSON malformado) |
| `404` | Recurso da URL não encontrado (vendedor, região ou venda) ou rota inexistente |
| `500` | Falha de conexão com o banco ou erro interno |

Cada função dos services usa `try/catch`: erros inesperados são registrados no console e repassados com `throw`; um middleware central em `src/app.js` converte tudo em resposta JSON. Mensagens de erro do MySQL nunca vão para o cliente.

Convenção adotada: referência inexistente **no corpo** da requisição (por exemplo, `id_vendedor` inexistente ao registrar uma venda) retorna `400`; recurso inexistente **na URL** (por exemplo, `GET /vendedores/999`) retorna `404`.

---

## 11. Decisões de projeto

- **Funções exigidas pelo enunciado:** `cadastrarVendedor`, `listarVendedores`, `atualizarVendedor`, `desativarVendedor`, `registrarVenda`, `listarVendas`, `consultarVendasPorVendedor`, `excluirVenda`, `calcularComissao` e `gerarRelatorioPerformance`, todas `async`. Foram acrescentadas as demais operações de CRUD (buscar, ativar, excluir vendedor, atualizar venda e CRUD de regiões).
- **Desativar vs. excluir vendedor:** a desativação mantém todo o histórico. A exclusão física só é aceita quando o vendedor não tem vendas; o mesmo vale para regiões.
- **Comissão histórica:** alterar o `percentual_base` de um vendedor **não** recalcula vendas já registradas. Já ao **atualizar uma venda** (`PUT /vendas/:id`), a comissão é recalculada com o percentual atual do vendedor e o bônus atual da região.
- **Vendedor inativo em venda existente:** é possível corrigir vendas antigas de um vendedor inativo; só não é possível registrar vendas novas para ele nem transferir uma venda para ele.
- **Código da venda:** pode ser informado (e então precisa ser único) ou omitido, caso em que o MySQL gera o próximo.
- **Regiões:** o nome é restrito às quatro regiões do enunciado, na API e por `CHECK` no banco.
- **Segurança:** todas as consultas usam `execute` com parâmetros (`?`). Os únicos trechos de SQL montados dinamicamente são os nomes de colunas do `UPDATE`, vindos de uma lista fixa no código.

---

## 12. Problemas comuns

| Sintoma | Causa provável e solução |
| --- | --- |
| `ER_ACCESS_DENIED_ERROR` | Usuário ou senha incorretos no `.env` |
| `ECONNREFUSED` | MySQL parado, ou `DB_HOST`/`DB_PORT` incorretos |
| `ER_BAD_DB_ERROR` (Unknown database) | O banco ainda não foi criado: execute `npm run db:init` |
| `Table ... doesn't exist` | Mesmo caso: o script SQL não foi executado no banco correto |
| Restrições `CHECK` não são aplicadas | MySQL anterior à 8.0.16; atualize o MySQL |
| `EADDRINUSE` | A porta já está em uso; mude `PORT` no `.env` |
| `requests.http` retorna 404 no vendedor 7 | O banco não está no estado inicial; execute `npm run db:init` |
| `npm run test:api` falha com "API inacessível" | O servidor não está rodando; execute `npm start` em outro terminal |
