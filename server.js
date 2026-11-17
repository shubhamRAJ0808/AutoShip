const express = require("express");
const { Pool } = require("pg");

const app = express();
const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "appuser",
  password: process.env.DB_PASSWORD || "apppass",
  database: process.env.DB_NAME || "appdb",
  port: 5432,
});

// Health check (does not need the database)
app.get("/health", (req, res) => res.json({ status: "ok" }));

// Home page: counts visits and stores them in PostgreSQL
app.get("/", async (req, res) => {
  try {
    await pool.query(
      "CREATE TABLE IF NOT EXISTS visits (id SERIAL PRIMARY KEY, visited_at TIMESTAMP DEFAULT NOW())"
    );
    await pool.query("INSERT INTO visits DEFAULT VALUES");
    const result = await pool.query("SELECT COUNT(*) FROM visits");
    res.json({ message: "Hello from the CI/CD pipeline!", visits: Number(result.rows[0].count) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Web app listening on port ${port}`));
}
