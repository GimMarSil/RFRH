import sql from 'mssql';

// Ensure these environment variables are set in your .env.local or environment
const sqlConfigConnection = {
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  server: process.env.SQL_SERVER!,
  database: process.env.SQL_DATABASE,
  options: {
    encrypt: process.env.SQL_OPTIONS_ENCRYPT === 'true',
    trustServerCertificate: process.env.SQL_OPTIONS_TRUST_SERVER_CERTIFICATE === 'true',
  },
  pool: {
    max: 10, // max number of connections in the pool
    min: 0, // min number of connections in the pool
    idleTimeoutMillis: 30000 // how long a client is allowed to remain idle before being closed
  }
};

// Function to get Azure AD User ID (UPN or OID depending on what's in Employee.UserId)
// from an employee number.
// Your Employee.UserId column stores the UPN based on user-role-info.ts.
export async function getEmployeeUpnFromNumber(employeeNumber: string): Promise<string | null> {
  if (!employeeNumber) {
    console.warn('getEmployeeUpnFromNumber: employeeNumber was not provided.');
    return null;
  }

  let pool;
  try {
    pool = await sql.connect(sqlConfigConnection);
    const result = await pool.request()
      .input('employeeNumber', sql.NVarChar, employeeNumber) // Assuming Employee.Number can be string-like or is converted
      .query`SELECT UserId FROM [RFWebApp].[dbo].[Employee] WHERE [Number] = @employeeNumber AND Active = 1`;
    
    if (result.recordset.length > 0 && result.recordset[0].UserId) {
      return result.recordset[0].UserId;
    } else {
      console.warn(`getEmployeeUpnFromNumber: No active user found for employee number ${employeeNumber} or UserId is null.`);
      return null;
    }
  } catch (dbError) {
    console.error(`DB error in getEmployeeUpnFromNumber for employee number ${employeeNumber}:`, dbError);
    return null; 
  } finally {
    if (pool) {
      await pool.close(); // Close the connection pool
    }
  }
}

// We also need a function to get the Azure AD Object ID (oid) from UPN if directReports needs OID
// The getDirectGraphSubordinates function currently takes userAzureAdId, which implies OID.
// The loggedInUserAzureAdId in user-role-info.ts is `validatedUserPayload.oid`
// So we need a way to go from Employee Number -> UPN (Employee.UserId) -> Azure AD Object ID (oid)

// This function would typically involve a Graph call itself, or assume Employee.UserId IS the OID if your sync process ensures that.
// For now, let's assume the `getDirectGraphSubordinates` can work with UPN if we adjust its Graph call, or that Employee.UserId can be an OID.
// The existing user-role-info.ts uses `loggedInUserAzureAdId = validatedUserPayload.oid as string;` for Graph calls.
// And `loggedInUserUpn = validatedUserPayload.preferred_username as string;` to query DB.
// So, to query Graph for an arbitrary employee (from selectedEmployeeId), we need their OID.

// Let's add a function to get the OID using UPN via Graph (if not directly available in DB)
import { getGraphToken, fetchFromGraph } from './azureGraphService'; // May cause circular dependency if azureGraphService imports this.
                                                              // Consider placing getGraphToken and fetchFromGraph in a more basic http client lib.
                                                              // For now, proceed with caution or plan to move graph http utils.

export async function getAzureADObjectIdFromUpn(upn: string): Promise<string | null> {
  if (!upn) return null;
  const graphToken = await getGraphToken();
  if (!graphToken) {
    console.error('getAzureADObjectIdFromUpn: Failed to get graph token.');
    return null;
  }
  try {
    const graphUser = await fetchFromGraph(graphToken, `https://graph.microsoft.com/v1.0/users/${upn}?$select=id`);
    return graphUser?.id || null;
  } catch (error) {
    console.error(`Error fetching AAD Object ID for UPN ${upn} from Graph:`, error);
    return null;
  }
}

// Retorna todos os funcionários ativos (Number, CompanyName, Name)
export async function getAllActiveEmployees() {
  let pool;
  try {
    pool = await sql.connect(sqlConfigConnection);
    const result = await pool.request()
      .query(`SELECT [Number], [CompanyName], [Name] FROM [RFWebApp].[dbo].[Employee] WHERE [Active] = 1`);
    // Retorna um array de objetos { Number, CompanyName, Name }
    return result.recordset;
  } catch (dbError) {
    console.error('DB error in getAllActiveEmployees:', dbError);
    return [];
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

export async function getEmployeeDetailsByUserId(userId: string) {
  try {
    const poolConnection = await sql.connect(sqlConfigConnection);
    const result = await poolConnection.request()
      .input('userId', sql.VarChar, userId)
      .query(`
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
        WHERE [UserId] = @userId AND [Active] = 1
      `);
    return result.recordset[0];
  } catch (err) {
    console.error('Error fetching employee data from SQL Server:', err);
    return null;
  }
}

export async function getEmployeeDetailsByNumber(number: string) {
  try {
    const poolConnection = await sql.connect(sqlConfigConnection);
    const result = await poolConnection.request()
      .input('number', sql.VarChar, number)
      .query(`
        SELECT [Number], [CompanyName], [Name]
        FROM [RFWebApp].[dbo].[Employee]
        WHERE [Number] = @number AND [Active] = 1
      `);
    return result.recordset[0];
  } catch (err) {
    console.error('Error fetching employee data from SQL Server:', err);
    return null;
  }
} 