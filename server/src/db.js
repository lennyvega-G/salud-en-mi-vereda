const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : false,
});

// Consulta parametrizada: los valores nunca se concatenan al SQL (evita inyección SQL)
function query(texto, valores) {
  return pool.query(texto, valores);
}

module.exports = { pool, query };
