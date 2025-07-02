import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { employeeId } = req.query;
    try {
      let query = 'SELECT * FROM training_sessions ORDER BY start_date DESC';
      let values: any[] = [];
      if (employeeId) {
        query = 'SELECT * FROM training_sessions WHERE employee_id = $1 ORDER BY start_date DESC';
        values = [employeeId];
      }
      const result = await pool.query(query, values);
      return res.status(200).json(result.rows);
    } catch (error) {
      console.error('Error fetching training sessions:', error);
      return res.status(500).json({ message: 'Failed to fetch training sessions', error: error.message });
    }
  } else if (req.method === 'POST') {
    const {
      employee_id,
      title,
      description,
      start_date,
      end_date,
      location,
      trainer,
      created_by_user_id,
    } = req.body;

    if (!employee_id || !title || !start_date || !created_by_user_id) {
      return res.status(400).json({ message: 'Required fields missing' });
    }

    try {
      const query = `INSERT INTO training_sessions (employee_id, title, description, start_date, end_date, location, trainer, created_by_user_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`;
      const values = [
        employee_id,
        title,
        description || null,
        start_date,
        end_date || null,
        location || null,
        trainer || null,
        created_by_user_id,
      ];
      const result = await pool.query(query, values);
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error creating training session:', error);
      return res.status(500).json({ message: 'Failed to create training session', error: error.message });
    }
  } else {
    return res.status(405).json({ message: 'Method not allowed' });
  }
}
