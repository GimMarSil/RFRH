import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Define your RH group ID (ensure this is consistent across your app)
const RH_GROUP_ID = 'a837ee80-f103-4d51-9869-e3b4da6bdeda';

async function checkUserAuthorization(req): Promise<{ authorized: boolean; userId?: string; userName?: string }> {
  const userId = req.headers['x-user-id'];
  const userName = req.headers['x-user-name'];
  let userGroups = [];
  try {
    userGroups = JSON.parse(req.headers['x-user-groups'] || '[]');
  } catch (e) {
    console.error("Error parsing user groups:", e);
  }

  if (!userId) {
    return { authorized: false };
  }

  const isRH = Array.isArray(userGroups) && userGroups.includes(RH_GROUP_ID);
  if (!isRH) {
    return { authorized: false };
  }
  return { authorized: true, userId, userName };
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const authCheck = await checkUserAuthorization(req);
    if (!authCheck.authorized) {
      return res.status(403).json({ message: 'Acesso negado. Requer perfil RH.' });
    }

    const { recruitment_id, stage } = req.query;

    if (!recruitment_id) {
      return res.status(400).json({ message: 'recruitment_id é obrigatório.' });
    }

    try {
      let query = 'SELECT * FROM candidates WHERE recruitment_id = $1';
      const queryParams: any[] = [recruitment_id];

      if (stage) {
        query += ' AND stage = $2';
        queryParams.push(stage);
      }

      query += ' ORDER BY application_date DESC';

      const result = await pool.query(query, queryParams);
      return res.status(200).json(result.rows);

    } catch (error) {
      console.error('Erro ao buscar candidatos:', error);
      return res.status(500).json({ message: 'Erro ao buscar candidatos', error: error.message });
    }
  } else if (req.method === 'POST') {
    const authCheck = await checkUserAuthorization(req);
    if (!authCheck.authorized) {
      return res.status(403).json({ message: 'Acesso negado. Requer perfil RH.' });
    }

    const {
      recruitment_id,
      full_name,
      email,
      phone,
      birth_date,
      nationality,
      location,
      current_position,
      current_employer,
      education,
      languages,
      skills,
      cv_url,
      motivation,
      source,
      stage: initialStage, // Renamed to avoid conflict with query.stage
      evaluation_notes,
      shortlisted,
      status: initialStatus, // Renamed to avoid conflict
    } = req.body;

    if (!recruitment_id || !full_name || !email) {
      return res.status(400).json({ message: 'recruitment_id, full_name e email são obrigatórios.' });
    }

    try {
      const query = `
        INSERT INTO candidates (
          recruitment_id, full_name, email, phone, birth_date, nationality, location, 
          current_position, current_employer, education, languages, skills, cv_url, 
          motivation, source, stage, evaluation_notes, shortlisted, status, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
        ) RETURNING *
      `;
      const values = [
        recruitment_id,
        full_name,
        email,
        phone || null,
        birth_date || null,
        nationality || null,
        location || null,
        current_position || null,
        current_employer || null,
        education || null,
        languages || null,
        skills || null,
        cv_url || null,
        motivation || null,
        source || null,
        initialStage || 'triage',
        evaluation_notes || null,
        typeof shortlisted === 'boolean' ? shortlisted : false,
        initialStatus || 'active',
        authCheck.userName || authCheck.userId, // Use authenticated user info
      ];

      const result = await pool.query(query, values);
      const newCandidate = result.rows[0];

      // Log the creation action
      try {
        const logQuery = `
          INSERT INTO candidates_log (candidate_id, action, changed_by, new_data, old_data)
          VALUES ($1, $2, $3, $4, $5)
        `;
        await pool.query(logQuery, [
          newCandidate.id,
          'CREATE',
          authCheck.userName || authCheck.userId,
          newCandidate, // Log the entire new candidate object
          null          // No old_data for creation
        ]);
      } catch (logError) {
        console.error('Failed to log candidate creation:', logError);
        // Optionally, decide if a logging failure should affect the main response
      }

      return res.status(201).json(newCandidate);

    } catch (error) {
      console.error('Erro ao criar candidato:', error);
      // Check for unique constraint violation for email (example)
      if (error.code === '23505' && error.constraint && error.constraint.includes('email')) {
        return res.status(409).json({ message: 'Erro ao criar candidato: O email fornecido já existe.', error: error.message });
      }
      return res.status(500).json({ message: 'Erro ao criar candidato', error: error.message });
    }

  } else {
    res.setHeader('Allow', ['GET', 'POST']); // Added POST to Allow header
    return res.status(405).json({ message: `Método ${req.method} não permitido.` });
  }
} 