import { logger } from '@/lib/logger';
import { NextApiRequest, NextApiResponse } from 'next';
import sql from 'mssql';
import { Client } from 'pg';

const sqlConfig = {
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  server: process.env.SQL_SERVER!,
  database: process.env.SQL_DATABASE,
  options: {
    encrypt: process.env.SQL_OPTIONS_ENCRYPT === 'true',
    trustServerCertificate: process.env.SQL_OPTIONS_TRUST_SERVER_CERTIFICATE === 'true',
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

const pgClient = new Client({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    await sql.connect(sqlConfig);
    const result = await sql.query(`
      SELECT
        [Number],
        [Email],
        [Name],
        [Active],
        [CompanyName],
        [UserId],
        [Department],
        [AdmissionDate],
        [SyncStatus],
        [Current],
        [TerminationDate],
        [CreatedAt],
        [CreatedBy],
        [UpdatedAt],
        [UpdatedBy],
        [IdentityCard],
        [LastSync],
        [PassportNumber],
        [SalaryRule],
        [ScheduleId]
      FROM [RFWebApp].[dbo].[Employee]
    `);

    const employees = result.recordset;
    await pgClient.connect();

    let processed = 0;
    for (const emp of employees) {
      try {
        await pgClient.query(
          `INSERT INTO employees (
            employee_number, email, name, active, company_name, user_id, department, admission_date,
            sync_status, current, termination_date, created_at, created_by, updated_at, updated_by,
            identity_card, last_sync, passport_number, salary_rule, schedule_id
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20
          ) ON CONFLICT (employee_number) DO UPDATE SET
            email = EXCLUDED.email,
            name = EXCLUDED.name,
            active = EXCLUDED.active,
            company_name = EXCLUDED.company_name,
            user_id = EXCLUDED.user_id,
            department = EXCLUDED.department,
            admission_date = EXCLUDED.admission_date,
            sync_status = EXCLUDED.sync_status,
            current = EXCLUDED.current,
            termination_date = EXCLUDED.termination_date,
            created_at = EXCLUDED.created_at,
            created_by = EXCLUDED.created_by,
            updated_at = EXCLUDED.updated_at,
            updated_by = EXCLUDED.updated_by,
            identity_card = EXCLUDED.identity_card,
            last_sync = EXCLUDED.last_sync,
            passport_number = EXCLUDED.passport_number,
            salary_rule = EXCLUDED.salary_rule,
            schedule_id = EXCLUDED.schedule_id`,
          [
            emp.Number,
            emp.Email,
            emp.Name,
            emp.Active,
            emp.CompanyName,
            emp.UserId,
            emp.Department,
            emp.AdmissionDate,
            emp.SyncStatus,
            emp.Current,
            emp.TerminationDate,
            emp.CreatedAt,
            emp.CreatedBy,
            emp.UpdatedAt,
            emp.UpdatedBy,
            emp.IdentityCard,
            emp.LastSync,
            emp.PassportNumber,
            emp.SalaryRule,
            emp.ScheduleId,
          ],
        );
        processed += 1;
      } catch (err) {
        logger.error(`Error syncing employee ${emp.Number}:`, err);
      }
    }

    res.status(200).json({ success: true, processed });
  } catch (err: any) {
    logger.error('Error during employee sync:', err);
    res.status(500).json({ message: 'Error syncing employees', error: err.message });
  } finally {
    await sql.close();
    await pgClient.end();
  }
}
