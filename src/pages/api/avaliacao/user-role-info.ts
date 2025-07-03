import type { NextApiRequest, NextApiResponse } from 'next';
import * as jose from 'jose';
import sql from 'mssql';
import * as msalNode from '@azure/msal-node';

// Configuration for MSAL Node (CCA for backend)
const msalConfig = {
  auth: {
    clientId: process.env.AZURE_AD_CLIENT_ID!, // Client ID of this backend application
    authority: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}`,
    clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
  },
};
const cca = new msalNode.ConfidentialClientApplication(msalConfig);

// Microsoft Graph API Scopes for Application Permissions
const GRAPH_SCOPES = ['https://graph.microsoft.com/.default']; // Standard scope for app permissions

interface GraphUser {
  id: string; // Azure AD Object ID
  displayName?: string;
  mail?: string;
  userPrincipalName?: string;
}

interface Subordinate {
  id: string;       // EmployeeId from your DB (if found)
  azureAdUserId: string; // Azure AD User Object ID
  name: string;
  email?: string;
}

interface Manager {
  id: string;       // EmployeeId from your DB (if found)
  azureAdUserId: string; // Azure AD User Object ID
  name: string;
  email?: string;
}

interface UserRoleInfo {
  userId: string;        // Azure AD User Object ID of the logged-in user
  employeeId?: string;   // EmployeeId from your DB for the logged-in user (if found)
  name?: string;         // Name from your DB or Graph for the logged-in user
  email?: string;        // Email from your DB or Graph for the logged-in user
  isManager: boolean;
  subordinates: Subordinate[];
  managers: Manager[];
}

interface ErrorResponse {
  error: string;
  details?: string;
}

const sqlConfigConnection = {
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  server: process.env.SQL_SERVER!,
  database: process.env.SQL_DATABASE,
  options: {
    encrypt: process.env.SQL_OPTIONS_ENCRYPT === 'true',
    trustServerCertificate: process.env.SQL_OPTIONS_TRUST_SERVER_CERTIFICATE === 'true',
  },
};

// Token validation for the incoming user token (from frontend)
const AZURE_AD_TENANT_ID = process.env.AZURE_AD_TENANT_ID;
const JWKS_URI = `https://login.microsoftonline.com/${AZURE_AD_TENANT_ID}/discovery/v2.0/keys`;
const ISSUER = `https://login.microsoftonline.com/${AZURE_AD_TENANT_ID}/v2.0`;
const AUDIENCE = process.env.AZURE_AD_API_AUDIENCE; // This should be the client ID of this app: 2d448115-...

async function validateUserToken(token: string): Promise<jose.JWTPayload | null> {
  if (!AZURE_AD_TENANT_ID || !AUDIENCE) {
    console.error('Backend: Missing Azure AD config for user token validation (TENANT_ID, API_AUDIENCE).');
    return null;
  }
  try {
    const JWKS = jose.createRemoteJWKSet(new URL(JWKS_URI));
    const { payload } = await jose.jwtVerify(token, JWKS, { issuer: ISSUER, audience: AUDIENCE });
    return payload;
  } catch (error: any) {
    console.error('User token validation error:', error.message);
    return null;
  }
}

// Helper to get an application token for Microsoft Graph
async function getGraphToken(): Promise<string | null> {
  try {
    const authResult = await cca.acquireTokenByClientCredential({ scopes: GRAPH_SCOPES });
    return authResult?.accessToken || null;
  } catch (error) {
    console.error('Failed to acquire Graph token by client credential:', error);
    return null;
  }
}

// Helper to fetch data from Graph
async function fetchFromGraph(graphToken: string, url: string): Promise<any> {
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${graphToken}` },
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Graph API error: ${response.status} ${response.statusText} - ${errorText}`);
  }
  return response.json();
}

// Helper to get employee details from SQL by Azure AD User Principal Name
async function getEmployeeFromDbByUpn(userPrincipalName: string): Promise<any | null> {
  if (!userPrincipalName) return null;
  try {
    const pool = await sql.connect(sqlConfigConnection);
    const result = await pool.request()
      .input('userPrincipalName', sql.NVarChar, userPrincipalName)
      .query`SELECT [Number] AS EmployeeId, Name, Email, UserId FROM [RFWebApp].[dbo].[Employee] WHERE UserId = @userPrincipalName`;
    return result.recordset[0] || null;
  } catch (dbError) {
    console.error(`DB error fetching employee by UPN ${userPrincipalName}:`, dbError);
    return null;
  }
}

// Interface for the data fetched from SQL for subordinates
interface DbEmployeeDetails {
  UserId: string;       // Azure AD User Principal Name (from SQL table)
  EmployeeId: string | null;  // This will now be the 'Number' column from DB
  DisplayInfo: string; // Concatenated string: Number | CompanyName | Name
  Name: string;         // Original name from DB
  Email: string | null; // Email from DB
}

// Helper to get multiple employee details from SQL by Azure AD User Principal Names
async function getEmployeesFromDbByUpns(userPrincipalNames: string[]): Promise<DbEmployeeDetails[]> {
  if (!userPrincipalNames || userPrincipalNames.length === 0) {
    return [];
  }
  try {
    const pool = await sql.connect(sqlConfigConnection);
    const request = pool.request();

    userPrincipalNames.forEach((upn, index) => {
      request.input(`upn_bulk_${index}`, sql.NVarChar, upn);
    });
    const inClause = userPrincipalNames.map((_, index) => `@upn_bulk_${index}`).join(',');

    const query = `
      SELECT
        UserId,
        [Number] AS EmployeeId,
        CAST([Number] AS VARCHAR) + ' | ' + [CompanyName] + ' | ' + [Name] AS DisplayInfo,
        Name,
        Email
      FROM [RFWebApp].[dbo].[Employee]
      WHERE Active = 1 AND UserId IN (${inClause})
    `;

    const result = await request.query(query);
    return result.recordset as DbEmployeeDetails[];
  } catch (dbError) {
    console.error(`DB error fetching employees by UPNs:`, dbError);
    return []; 
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UserRoleInfo | ErrorResponse>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', details: 'No Bearer token provided.' });
  }
  const userToken = authHeader.substring(7);
  const validatedUserPayload = await validateUserToken(userToken);

  if (!validatedUserPayload || !validatedUserPayload.oid) {
    return res.status(401).json({ error: 'Unauthorized', details: 'Invalid or expired user token.' });
  }
  const loggedInUserAzureAdId = validatedUserPayload.oid as string;
  const loggedInUserUpn = validatedUserPayload.preferred_username as string;

  const graphToken = await getGraphToken();
  if (!graphToken) {
    return res.status(500).json({ error: 'Internal Server Error', details: 'Could not acquire token for Graph API.' });
  }

  try {
    // Get logged-in user's details from DB (and basic info from token if not in DB)
    const loggedInUserDbInfo = await getEmployeeFromDbByUpn(loggedInUserUpn);
    const loggedInUserName = loggedInUserDbInfo?.Name || validatedUserPayload.name as string || 'N/A';
    const loggedInUserEmail = loggedInUserDbInfo?.Email || loggedInUserUpn;

    // 1. Get Direct Subordinates from Graph
    const graphSubordinatesData = await fetchFromGraph(graphToken, `https://graph.microsoft.com/v1.0/users/${loggedInUserAzureAdId}/directReports?$select=id,displayName,mail,userPrincipalName`);
    const subordinates: Subordinate[] = [];

    if (graphSubordinatesData && graphSubordinatesData.value && (graphSubordinatesData.value as GraphUser[]).length > 0) {
      const graphUsers = graphSubordinatesData.value as GraphUser[];
      const graphUserUpns = graphUsers.map(gu => gu.userPrincipalName).filter(upn => !!upn) as string[];
      
      const dbEmployeeDetailsList = await getEmployeesFromDbByUpns(graphUserUpns);

      const dbEmployeesMap = new Map<string, DbEmployeeDetails>();
      dbEmployeeDetailsList.forEach(dbEmp => {
        if(dbEmp.UserId) dbEmployeesMap.set(dbEmp.UserId, dbEmp);
      });

      for (const graphUser of graphUsers) {
        const dbInfo = graphUser.userPrincipalName ? dbEmployeesMap.get(graphUser.userPrincipalName) : undefined;
        
        if (dbInfo) { // Only add if found and active in local DB
          subordinates.push({
            azureAdUserId: graphUser.id, 
            id: dbInfo.EmployeeId!, 
            name: dbInfo.DisplayInfo, 
            email: dbInfo.Email || graphUser.mail || graphUser.userPrincipalName,
          });
        }
      }
    }

    // 2. Get Manager from Graph
    const managers: Manager[] = [];
    try {
      const graphManagerData = await fetchFromGraph(graphToken, `https://graph.microsoft.com/v1.0/users/${loggedInUserAzureAdId}/manager?$select=id,displayName,mail,userPrincipalName`);
      if (graphManagerData && graphManagerData.id) {
        const graphManager = graphManagerData as GraphUser;
        let dbManager = null;
        if (graphManager.userPrincipalName) {
            dbManager = await getEmployeeFromDbByUpn(graphManager.userPrincipalName);
        }
        managers.push({
          azureAdUserId: graphManager.id,
          id: dbManager?.EmployeeId || graphManager.id,
          name: dbManager?.Name || graphManager.displayName || 'N/A',
          email: dbManager?.Email || graphManager.mail || graphManager.userPrincipalName,
        });
      }
    } catch (managerError: any) {
        if (managerError.message && managerError.message.includes('404')) {
            console.log(`User ${loggedInUserAzureAdId} does not have a manager in Azure AD.`);
        } else {
            console.error('Error fetching manager from Graph:', managerError);
        }
    }

    const isManager = subordinates.length > 0;

    await sql.close(); // Close SQL pool after all DB operations

    return res.status(200).json({
      userId: loggedInUserAzureAdId,
      employeeId: loggedInUserDbInfo?.EmployeeId,
      name: loggedInUserName,
      email: loggedInUserEmail,
      isManager,
      subordinates,
      managers,
    });

  } catch (err: any) {
    console.error('API Error processing user role info with Graph:', err);
    await sql.close();
    return res.status(500).json({ 
      error: 'Internal Server Error', 
      details: err.message || 'An unexpected error occurred.'
    });
  }
} 