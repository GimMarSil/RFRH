import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { recruitmentId } = req.query;
  if (!recruitmentId) {
    return res.status(400).json({ message: 'recruitmentId é obrigatório' });
  }

  try {
    const result = await pool.query(
      `SELECT * FROM recruitment_log WHERE recruitment_id = $1 ORDER BY changed_at ASC`,
      [recruitmentId]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar histórico:', error);
    res.status(500).json({ message: 'Erro ao buscar histórico', error: error.message });
  }
}
