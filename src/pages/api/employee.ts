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
    console.log('Attempting to connect to SQL Server with config:', {
      server: sqlConfig.server,
      database: sqlConfig.database,
      user: sqlConfig.user,
      options: sqlConfig.options
    });

    await sql.connect(sqlConfig);
    console.log('Successfully connected to SQL Server');

    let result;
    if (userId === "ALL") {
      // Buscar todos os funcionários
      result = await sql.query`
        SELECT 
          [Number] as employee_number,
          [Email],
          [Name],
          [Active],
          [CompanyName],
          [UserId] as user_id,
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
        WHERE [Active] = 1
      `;
    } else {
      // Buscar apenas funcionários do userId
      result = await sql.query`
        SELECT 
          [Number] as employee_number,
          [Email],
          [Name],
          [Active],
          [CompanyName],
          [UserId] as user_id,
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
        WHERE [UserId] = ${userId}
        AND [Active] = 1
      `;
    }

    console.log('Query executed successfully, found', result.recordset.length, 'records');
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error('Database error:', error);
    console.error('Error details:', {
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