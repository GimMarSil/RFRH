import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Test connection on startup
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Helper function to normalize dates to YYYY-MM-DD format
function normalizeDate(date: string | Date | undefined): string {
  if (!date) return "";
  if (typeof date === "string") return date.split("T")[0];
  return date.toISOString().split("T")[0];
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { userId, id } = req.query;
    if (id) {
      // Buscar pedido específico por ID
      try {
        const result = await pool.query(
          `SELECT * FROM recruitment WHERE id = $1`,
          [id]
        );
        if (!result.rows.length) {
          return res.status(404).json({ message: 'Pedido não encontrado' });
        }
        const pedido = result.rows[0];
        // Normalizar datas para YYYY-MM-DD
        pedido.request_date = normalizeDate(pedido.request_date);
        pedido.admission_date = normalizeDate(pedido.admission_date);
        // Controle de acesso: só RH ou criador pode ver
        const headerUserId = req.headers.userid;
        let headerUserGroups = [];
        try { headerUserGroups = JSON.parse(req.headers.usergroups || '[]'); } catch {}
        const isRH = Array.isArray(headerUserGroups) && headerUserGroups.includes('a837ee80-f103-4d51-9869-e3b4da6bdeda');
        const isOwner = String(pedido.created_by) === String(headerUserId);
        if (!isRH && !isOwner) {
          return res.status(403).json({ message: 'Acesso negado' });
        }
        return res.status(200).json(pedido);
      } catch (error) {
        console.error('Erro ao buscar pedido:', error);
        console.error('Connection string:', process.env.DATABASE_URL ? 'Defined' : 'Not defined');
        return res.status(500).json({ message: 'Erro ao buscar pedido', error: error.message });
      }
    }
    if (!userId) {
      return res.status(400).json({ message: 'userId é obrigatório' });
    }
    try {
      console.log('Attempting to connect to database...');
      const result = await pool.query(
        `SELECT * FROM recruitment WHERE responsible_identification = $1 ORDER BY request_date DESC`,
        [userId]
      );
      console.log('Query successful, found', result.rows.length, 'records');
      return res.status(200).json(result.rows);
    } catch (error) {
      console.error('Erro ao buscar pedidos de recrutamento:', error);
      console.error('Connection string:', process.env.DATABASE_URL ? 'Defined' : 'Not defined');
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      return res.status(500).json({ message: 'Erro ao buscar pedidos', error: error.message });
    }
  } else if (req.method === 'POST') {
    const data = req.body;
    console.log('POST /api/recruitment payload:', data);

    try {
      const query = `
        INSERT INTO recruitment (
          function, request_date, company, department, responsible_identification, admission_date, type, vacancies, justification, pre_identified_candidates, recruitment_validated_by, hr_intervention, responsibilities, profile, contract, duration, contract_geography, salary, premium_type, premium_value, meals, card_plafond, health_insurance, mobile, new_mobile, car, laptop, visit_card, card_function, epi, work_clothes, other_equipment, expatriation_country, local_housing, local_transport, expatriation_meals, annual_trips, weekly_aid, weekly_aid_value, obs, estado, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42
        ) RETURNING *
      `;
      const values = [
        data.function,
        data.request_date,
        data.company,
        data.department,
        data.responsible_identification,
        data.admission_date,
        data.type,
        data.vacancies,
        data.justification,
        data.pre_identified_candidates,
        data.recruitment_validated_by,
        data.hr_intervention,
        data.responsibilities,
        data.profile,
        data.contract,
        data.duration,
        data.contract_geography,
        data.salary,
        data.premium_type,
        data.premium_value,
        data.meals,
        data.card_plafond,
        data.health_insurance,
        data.mobile,
        data.new_mobile,
        data.car,
        data.laptop,
        data.visit_card,
        data.card_function,
        data.epi,
        data.work_clothes,
        data.other_equipment,
        data.expatriation_country,
        data.local_housing,
        data.local_transport,
        data.expatriation_meals,
        data.annual_trips,
        data.weekly_aid,
        data.weekly_aid_value,
        data.obs,
        data.estado || 'Pendente',
        data.user_id || data.created_by || data.responsible_identification || null
      ];
      const result = await pool.query(query, values);
      console.log('Inserted recruitment:', result.rows[0]);
      // Gravar log de criação
      await pool.query(
        `INSERT INTO recruitment_log (recruitment_id, action, changed_by, old_data, new_data) VALUES ($1, $2, $3, $4, $5)`,
        [
          result.rows[0].id,
          'create',
          data.user_id || data.created_by || data.responsible_identification || null,
          null,
          JSON.stringify(result.rows[0])
        ]
      );
      res.status(200).json({ success: true, id: result.rows[0].id });
    } catch (error) {
      console.error('Erro ao gravar recrutamento:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  } else if (req.method === 'PUT') {
    const data = req.body;
    const { id, user_id, user_groups } = data;
    const userId = user_id;
    const userGroups = user_groups;
    if (!id || !userId) {
      return res.status(400).json({ message: 'id e userId são obrigatórios' });
    }
    try {
      // Buscar o pedido original
      const pedidoRes = await pool.query('SELECT * FROM recruitment WHERE id = $1', [id]);
      if (!pedidoRes.rows.length) {
        return res.status(404).json({ message: 'Pedido não encontrado' });
      }
      const pedido = pedidoRes.rows[0];
      const isRH = Array.isArray(userGroups) && userGroups.includes('a837ee80-f103-4d51-9869-e3b4da6bdeda');
      const isOwner = String(pedido.created_by) === String(userId);
      if (pedido.estado === 'Pendente') {
        if (!isOwner && !isRH) {
          return res.status(403).json({ message: 'Só o criador ou RH pode editar pedidos pendentes.' });
        }
      } else {
        if (!isRH) {
          return res.status(403).json({ message: 'Só RH pode editar pedidos não pendentes.' });
        }
      }
      // Atualizar pedido
      const updateFields = [
        'function', 'request_date', 'company', 'department', 'responsible_identification', 'admission_date', 'type', 'vacancies', 'justification', 'pre_identified_candidates', 'recruitment_validated_by', 'hr_intervention', 'responsibilities', 'profile', 'contract', 'duration', 'contract_geography', 'salary', 'premium_type', 'premium_value', 'meals', 'card_plafond', 'health_insurance', 'mobile', 'new_mobile', 'car', 'laptop', 'visit_card', 'card_function', 'epi', 'work_clothes', 'other_equipment', 'expatriation_country', 'local_housing', 'local_transport', 'expatriation_meals', 'annual_trips', 'weekly_aid', 'weekly_aid_value', 'obs', 'estado'
      ];
      // Garantir que request_date e admission_date são string YYYY-MM-DD
      if (data.request_date && typeof data.request_date === 'string' && data.request_date.includes('T')) {
        data.request_date = data.request_date.split('T')[0];
      }
      if (data.admission_date && typeof data.admission_date === 'string' && data.admission_date.includes('T')) {
        data.admission_date = data.admission_date.split('T')[0];
      }
      const setClause = updateFields.map((f, i) => `${f} = $${i + 2}`).join(', ');
      const values = updateFields.map(f => data[f]);
      const updateQuery = `UPDATE recruitment SET ${setClause} WHERE id = $1 RETURNING *`;
      const result = await pool.query(updateQuery, [id, ...values]);
      // Gravar log de alteração
      await pool.query(
        `INSERT INTO recruitment_log (recruitment_id, action, changed_by, old_data, new_data) VALUES ($1, $2, $3, $4, $5)`,
        [
          id,
          'update',
          userId,
          JSON.stringify(pedido),
          JSON.stringify(result.rows[0])
        ]
      );
      res.status(200).json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('Erro ao atualizar pedido:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  } else {
    return res.status(405).json({ message: 'Method not allowed' });
  }
} 