/*************************************************************
 * 💾 ENVIO DE FUNCIONÁRIOS                                 *
 * DA BASE DE DADOS SQL SERVER (interna da RF)              *
 * PARA RAILWAY POSTGRESQL                                  *
 *                                                          *
 * Execução manual:                                         *
 *     node src/pages/api/syncEmployees.js                  *
 *************************************************************/

require('dotenv').config({ path: '.env.local' });
const sql = require('mssql');
const { Client } = require('pg');

// Configuração SQL Server
const sqlConfig = {
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

// Configuração Postgres (Railway)
const pgClient = new Client({
  connectionString: process.env.DATABASE_URL
});

// Validar configuração
function validateConfig() {
  const required = ['SQL_USER', 'SQL_PASSWORD', 'SQL_SERVER', 'SQL_DATABASE', 'DATABASE_URL'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  console.log('Environment variables loaded:', {
    SQL_SERVER: process.env.SQL_SERVER,
    SQL_DATABASE: process.env.SQL_DATABASE,
    SQL_USER: process.env.SQL_USER,
    DATABASE_URL: process.env.DATABASE_URL ? '***' : undefined
  });
}

async function main() {
  try {
    // Validar configuração antes de começar
    validateConfig();

    // 1. Conectar ao SQL Server e buscar os dados
    console.log('Connecting to SQL Server...');
    await sql.connect(sqlConfig);
    console.log('Connected to SQL Server successfully');

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
    console.log(`Fetched ${employees.length} employees from SQL Server.`);

    // 2. Conectar ao Postgres
    console.log('Connecting to Railway Postgres...');
    await pgClient.connect();
    console.log('Connected to Railway Postgres successfully');

    // 3. Verificar estrutura atual da tabela
    console.log('Checking current table structure...');
    const tableInfo = await pgClient.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'employees'
    `);

    // 4. Se a tabela não existir, criar com a estrutura correta
    if (tableInfo.rows.length === 0) {
      console.log('Table does not exist. Creating new table...');
      await pgClient.query(`
        CREATE TABLE employees (
          employee_number TEXT PRIMARY KEY,
          email TEXT,
          name TEXT,
          active BOOLEAN,
          company_name TEXT,
          user_id TEXT,
          department TEXT,
          admission_date TIMESTAMP,
          sync_status TEXT,
          current BOOLEAN,
          termination_date TIMESTAMP,
          created_at TIMESTAMP,
          created_by TEXT,
          updated_at TIMESTAMP,
          updated_by TEXT,
          identity_card TEXT,
          last_sync TIMESTAMP,
          passport_number TEXT,
          salary_rule TEXT,
          schedule_id TEXT
        );
      `);
    } else {
      // 5. Se a tabela existir, verificar se precisa de alterações
      console.log('Table exists. Checking if migration is needed...');
      const hasEmployeeNumber = tableInfo.rows.some(col => col.column_name === 'employee_number');
      const hasNumber = tableInfo.rows.some(col => col.column_name === 'number');

      if (hasNumber && !hasEmployeeNumber) {
        console.log('Migrating column name from "number" to "employee_number"...');
        await pgClient.query(`
          ALTER TABLE employees 
          RENAME COLUMN number TO employee_number;
        `);
      }
    }

    // 6. Inserir/atualizar dados
    console.log('Starting data sync...');
    let successCount = 0;
    let errorCount = 0;

    for (const emp of employees) {
      try {
        await pgClient.query(`
          INSERT INTO employees (
            employee_number, email, name, active, company_name, user_id, department, admission_date, sync_status, current, termination_date, created_at, created_by, updated_at, updated_by, identity_card, last_sync, passport_number, salary_rule, schedule_id
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
          )
          ON CONFLICT (employee_number) DO UPDATE SET
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
            schedule_id = EXCLUDED.schedule_id
        `, [
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
          emp.ScheduleId
        ]);
        successCount++;
      } catch (err) {
        console.error(`Error syncing employee ${emp.Number}:`, err);
        errorCount++;
      }
    }

    console.log('Sync completed!');
    console.log(`Successfully synced: ${successCount} employees`);
    console.log(`Failed to sync: ${errorCount} employees`);

  } catch (err) {
    console.error('Error during sync:', err);
    process.exit(1);
  } finally {
    await sql.close();
    await pgClient.end();
  }
}

main();
