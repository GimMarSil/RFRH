import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const schemaManagementQueries = `
    -- Recruitment Table (from previous steps, ensuring all columns are present)
    CREATE TABLE IF NOT EXISTS recruitment (
      id SERIAL PRIMARY KEY,
      function TEXT,
      request_date DATE,
      company TEXT,
      department TEXT,
      responsible_identification TEXT,
      admission_date DATE,
      type TEXT,
      vacancies INTEGER,
      justification TEXT,
      pre_identified_candidates TEXT,
      recruitment_validated_by TEXT,
      hr_intervention BOOLEAN,
      responsibilities TEXT,
      profile TEXT,
      contract TEXT,
      duration TEXT,
      contract_geography TEXT,
      salary TEXT,
      premium_type TEXT,
      premium_value TEXT,
      meals TEXT,
      card_plafond TEXT,
      health_insurance TEXT,
      mobile BOOLEAN,
      new_mobile BOOLEAN,
      car BOOLEAN,
      laptop BOOLEAN,
      visit_card BOOLEAN,
      card_function TEXT,
      epi BOOLEAN,
      work_clothes BOOLEAN,
      other_equipment TEXT,
      expatriation_country TEXT,
      local_housing TEXT,
      local_transport TEXT,
      expatriation_meals TEXT,
      annual_trips INTEGER,
      weekly_aid TEXT,
      weekly_aid_value TEXT,
      obs TEXT,
      created_by TEXT,
      estado TEXT DEFAULT 'Pendente', -- For approval workflow
      approved_by TEXT NULL,
      approved_at TIMESTAMPTZ NULL,
      rejection_reason TEXT NULL,
      rejected_by TEXT NULL,
      rejected_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    DO $$ 
    BEGIN
      -- Idempotent ALTER statements for recruitment table (as before)
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruitment' AND column_name='created_by') THEN ALTER TABLE recruitment ADD COLUMN created_by TEXT; END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruitment' AND column_name='estado') THEN ALTER TABLE recruitment ADD COLUMN estado TEXT DEFAULT 'Pendente'; END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruitment' AND column_name='approved_by') THEN ALTER TABLE recruitment ADD COLUMN approved_by TEXT NULL; END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruitment' AND column_name='approved_at') THEN ALTER TABLE recruitment ADD COLUMN approved_at TIMESTAMPTZ NULL; END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruitment' AND column_name='rejection_reason') THEN ALTER TABLE recruitment ADD COLUMN rejection_reason TEXT NULL; END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruitment' AND column_name='rejected_by') THEN ALTER TABLE recruitment ADD COLUMN rejected_by TEXT NULL; END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruitment' AND column_name='rejected_at') THEN ALTER TABLE recruitment ADD COLUMN rejected_at TIMESTAMPTZ NULL; END IF;
      -- Ensure created_at is TIMESTAMPTZ and has default
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruitment' AND column_name='created_at' AND udt_name='timestamp') THEN
        ALTER TABLE recruitment ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC', ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
      ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruitment' AND column_name='created_at') THEN
        ALTER TABLE recruitment ADD COLUMN created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
      END IF;
    END $$;

    -- Recruitment Log Table (as before)
    CREATE TABLE IF NOT EXISTS recruitment_log (
      id SERIAL PRIMARY KEY,
      recruitment_id INTEGER REFERENCES recruitment(id) ON DELETE CASCADE,
      action TEXT, -- e.g., 'CREATE', 'UPDATE', 'APPROVE', 'REJECT'
      changed_by TEXT,
      changed_at TIMESTAMP DEFAULT NOW(),
      old_data JSONB NULL,
      new_data JSONB NULL
    );

    -- Admission Table (NEW - placeholder, expand with actual columns needed)
    CREATE TABLE IF NOT EXISTS admission (
      id SERIAL PRIMARY KEY,
      recruitment_request_id INTEGER REFERENCES recruitment(id) NULL, -- Link to the recruitment request if applicable
      candidate_name TEXT NOT NULL,
      admission_date DATE,
      contract_type TEXT,
      salary_details TEXT, 
      -- Add other relevant fields for the admission process
      status TEXT DEFAULT 'Pendente', -- e.g., 'Pendente', 'Documentação Recebida', 'Integrado', 'Cancelado'
      created_at TIMESTAMP DEFAULT NOW(),
      created_by TEXT,
      updated_at TIMESTAMP DEFAULT NOW(),
      updated_by TEXT
      -- Remember to add any specific status or logging fields needed for admissions
    );

    DO $$ 
    BEGIN
      -- Idempotent ALTER statements for admission table (example)
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admission' AND column_name='status') THEN ALTER TABLE admission ADD COLUMN status TEXT DEFAULT 'Pendente'; END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admission' AND column_name='updated_at') THEN ALTER TABLE admission ADD COLUMN updated_at TIMESTAMP DEFAULT NOW(); END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admission' AND column_name='updated_by') THEN ALTER TABLE admission ADD COLUMN updated_by TEXT; END IF;
    END $$;

    -- Admission Log Table (NEW)
    CREATE TABLE IF NOT EXISTS admission_log (
      id SERIAL PRIMARY KEY,
      admission_id INTEGER REFERENCES admission(id) ON DELETE CASCADE,
      action TEXT, -- e.g., 'CREATE', 'UPDATE', 'STATUS_CHANGE'
      changed_by TEXT,
      changed_at TIMESTAMP DEFAULT NOW(),
      old_data JSONB NULL,
      new_data JSONB NULL
    );
  `;

  const client = await pool.connect(); // Acquire a client
  try {
    await client.query('BEGIN'); // Start transaction

    await client.query(schemaManagementQueries);
    console.log('Schema for recruitment, logs, and admission tables verified/updated.');

    // Create candidates table separately
    await client.query(`
      CREATE TABLE IF NOT EXISTS candidates (
        id SERIAL PRIMARY KEY,
        recruitment_id INTEGER NOT NULL REFERENCES recruitment(id) ON DELETE CASCADE,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        birth_date DATE,
        nationality TEXT,
        location TEXT,
        current_position TEXT,
        current_employer TEXT,
        education TEXT,
        languages TEXT,
        skills TEXT,
        cv_url TEXT,
        motivation TEXT,
        source TEXT,
        application_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        stage TEXT NOT NULL DEFAULT 'triage',  -- triage, evaluation, interview_tech, interview_manager, final_choice
        evaluation_notes TEXT,
        shortlisted BOOLEAN DEFAULT false,
        status TEXT DEFAULT 'active',          -- active, rejected, withdrawn, hired
        created_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Ensured candidates table exists.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS candidates_log (
        id SERIAL PRIMARY KEY,
        candidate_id INTEGER REFERENCES candidates(id) ON DELETE CASCADE,
        action TEXT, -- e.g., 'CREATE', 'UPDATE', 'STAGE_CHANGE', 'STATUS_CHANGE'
        changed_by TEXT,
        changed_at TIMESTAMP DEFAULT NOW(),
        old_data JSONB NULL,
        new_data JSONB NULL
      );
    `);
    console.log('Ensured candidates_log table exists.');

    await client.query('COMMIT'); // Commit transaction
    res.status(200).json({ success: true, message: 'All tables (recruitment, logs, admission, candidates) verified/updated successfully.' });
  } catch (error) {
    await client.query('ROLLBACK'); // Rollback transaction on error
    console.error('Erro ao criar/atualizar tabelas:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release(); // Release client
  }
}
