import { logger } from '@/lib/logger';
import sql from 'mssql';

const sqlConfig = {
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  options: {
    encrypt: true,
    trustServerCertificate: true,
    connectTimeout: 30000,
    requestTimeout: 30000,
    debug: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { userId } = req.query;

  try {
    await sql.connect(sqlConfig);

    const columnRes = await sql.query`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Employee'`;
    const cols: string[] = columnRes.recordset.map(r => r.COLUMN_NAME);
    const selectCols = cols.map(c => {
      if (c === 'Number') return '[Number] as employee_number';
      if (c === 'UserId') return '[UserId] as user_id';
      return `[${c}]`;
    }).join(', ');

    const baseQuery = `SELECT ${selectCols} FROM [RFWebApp].[dbo].[Employee]`;

    const activeCondition = cols.includes('Active') ? ' [Active] = 1' : '1=1';

    let query: string;
    if (userId === 'ALL') {
      query = `${baseQuery} WHERE${activeCondition}`;
    } else {
      const conditions: string[] = [];
      if (cols.includes('UserId')) conditions.push('[UserId] = @userId');
      if (cols.includes('Email')) conditions.push('[Email] = @userId');
      if (cols.includes('UserPrincipalName')) conditions.push('[UserPrincipalName] = @userId');
      const where = conditions.length ? `(${conditions.join(' OR ')})` : '1=1';
      query = `${baseQuery} WHERE ${where} AND${activeCondition}`;
    }

    const request = new sql.Request();
    request.input('userId', sql.NVarChar, userId as string);
    const result = await request.query(query);

    res.status(200).json(result.recordset);
  } catch (error) {
    logger.error('Database error:', error);
    logger.error('Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack,
      originalError: error.originalError
    });
    res.status(500).json({ 
      message: 'Error fetching employee data',
      error: error.message,
      details: error.originalError ? error.originalError.message : null
    });
  } finally {
    sql.close();
  }
} 
