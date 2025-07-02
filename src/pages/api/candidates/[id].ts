import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

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

  if (!userId) return { authorized: false };
  const isRH = Array.isArray(userGroups) && userGroups.includes(RH_GROUP_ID);
  if (!isRH) return { authorized: false };
  return { authorized: true, userId, userName };
}

export default async function handler(req, res) {
  const { candidateId } = req.query;

  if (!candidateId || Array.isArray(candidateId)) {
    return res.status(400).json({ message: 'Valid candidateId must be provided in the path.' });
  }

  const authCheck = await checkUserAuthorization(req);
  if (!authCheck.authorized) {
    return res.status(403).json({ message: 'Acesso negado. Requer perfil RH.' });
  }

  if (req.method === 'PATCH') {
    const updates = req.body;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'Nenhum campo para atualizar fornecido.' });
    }

    // Fields allowed to be updated via PATCH
    const allowedFields = [
      'full_name', 'email', 'phone', 'birth_date', 'nationality', 'location',
      'current_position', 'current_employer', 'education', 'languages', 'skills',
      'cv_url', 'motivation', 'source', 'stage', 'evaluation_notes',
      'shortlisted', 'status'
    ];

    const fieldsToUpdate: string[] = [];
    const valuesToUpdate: any[] = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (updates.hasOwnProperty(field)) {
        fieldsToUpdate.push(`${field} = $${paramIndex++}`);
        valuesToUpdate.push(updates[field]);
      }
    }

    if (fieldsToUpdate.length === 0) {
      return res.status(400).json({ message: 'Nenhum campo válido para atualizar fornecido.' });
    }

    // Add updated_at timestamp
    fieldsToUpdate.push(`updated_at = CURRENT_TIMESTAMP`);

    valuesToUpdate.push(candidateId); // For the WHERE clause

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Fetch current candidate data for old_data
      const currentCandidateRes = await client.query('SELECT * FROM candidates WHERE id = $1', [candidateId]);
      if (currentCandidateRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Candidato não encontrado para atualização.' });
      }
      const oldData = currentCandidateRes.rows[0];

      // 2. Perform the update
      const updateQuery = `UPDATE candidates SET ${fieldsToUpdate.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
      const updateResult = await client.query(updateQuery, valuesToUpdate);
      const updatedCandidate = updateResult.rows[0];

      // 3. Log the update action
      try {
        const logQuery = `
          INSERT INTO candidates_log (candidate_id, action, changed_by, new_data, old_data)
          VALUES ($1, $2, $3, $4, $5)
        `;
        await client.query(logQuery, [
          updatedCandidate.id,
          'UPDATE',
          authCheck.userName || authCheck.userId,
          updatedCandidate,
          oldData
        ]);
      } catch (logError) {
        console.error('Failed to log candidate update:', logError);
        // Not rolling back for logging failure, but logging the error
      }

      await client.query('COMMIT');
      return res.status(200).json(updatedCandidate);

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Erro ao atualizar candidato:', error);
      if (error.code === '23505' && error.constraint && error.constraint.includes('email')) {
        return res.status(409).json({ message: 'Erro ao atualizar candidato: O email fornecido já existe para outro candidato.', error: error.message });
      }
      return res.status(500).json({ message: 'Erro ao atualizar candidato', error: error.message });
    } finally {
      client.release();
    }

  } else if (req.method === 'DELETE') {
    try {
      const result = await pool.query('DELETE FROM candidates WHERE id = $1 RETURNING *', [candidateId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Candidato não encontrado.' });
      }

      // Optionally, you might want to log this deletion or perform other cleanup.
      return res.status(200).json({ message: 'Candidato removido com sucesso.', deletedCandidate: result.rows[0] });

    } catch (error) {
      console.error('Erro ao remover candidato:', error);
      return res.status(500).json({ message: 'Erro ao remover candidato', error: error.message });
    }
  } else {
    res.setHeader('Allow', ['PATCH', 'DELETE']);
    return res.status(405).json({ message: `Método ${req.method} não permitido.` });
  }
} 