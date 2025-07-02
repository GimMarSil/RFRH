import { NextApiRequest, NextApiResponse } from 'next';
import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { PublicClientApplication, AccountInfo } from '@azure/msal-browser';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { executeQuery } from '../lib/db/pool';

// Types
export interface AuthenticatedRequest extends NextApiRequest {
  user?: {
    id: string;
    roles: string[];
    account?: AccountInfo;
  };
}

// MSAL configuration
const msalConfig = {
  auth: {
    clientId: process.env.AZURE_AD_CLIENT_ID!,
    authority: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}`,
    redirectUri: process.env.AZURE_AD_REDIRECT_URI,
    clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
};

// MSAL Node configuration for client credentials
const msalNodeConfig = {
  auth: {
    clientId: process.env.AZURE_AD_CLIENT_ID!,
    authority: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}`,
    clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
  }
};

// Validate MSAL configuration
function validateMsalConfig() {
  const requiredVars = {
    AZURE_AD_CLIENT_ID: process.env.AZURE_AD_CLIENT_ID,
    AZURE_AD_TENANT_ID: process.env.AZURE_AD_TENANT_ID,
    AZURE_AD_REDIRECT_URI: process.env.AZURE_AD_REDIRECT_URI,
    AZURE_AD_CLIENT_SECRET: process.env.AZURE_AD_CLIENT_SECRET,
  };

  const missingVars = Object.entries(requiredVars)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missingVars.length > 0) {
    console.error('Missing required Azure AD configuration:', {
      missing: missingVars,
      config: {
        ...requiredVars,
        AZURE_AD_CLIENT_SECRET: requiredVars.AZURE_AD_CLIENT_SECRET ? '[REDACTED]' : undefined
      }
    });
    throw new Error(`Missing required Azure AD configuration: ${missingVars.join(', ')}`);
  }
}

// Initialize MSAL instances
let msalInstance: PublicClientApplication;
let confidentialClient: ConfidentialClientApplication;

try {
  validateMsalConfig();
  msalInstance = new PublicClientApplication(msalConfig);
  confidentialClient = new ConfidentialClientApplication(msalNodeConfig);
  console.log('MSAL instances initialized successfully');
} catch (error) {
  console.error('Failed to initialize MSAL:', error);
  throw error;
}

// Cache for Graph API token
let graphTokenCache: {
  token: string;
  expiresAt: number;
} | null = null;

// Helper to get Graph API token using client credentials
async function getGraphApiToken(): Promise<string> {
  // Check if we have a valid cached token
  if (graphTokenCache && graphTokenCache.expiresAt > Date.now() + 60000) { // 1 minute buffer
    return graphTokenCache.token;
  }

  try {
    const result = await confidentialClient.acquireTokenByClientCredential({
      scopes: [process.env.AZURE_AD_GRAPH_SCOPE || 'https://graph.microsoft.com/.default'],
    });

    if (!result?.accessToken) {
      throw new Error('Failed to acquire Graph API token');
    }

    // Cache the token
    graphTokenCache = {
      token: result.accessToken,
      expiresAt: Date.now() + (result.expiresIn || 3600) * 1000,
    };

    return result.accessToken;
  } catch (error) {
    console.error('Error acquiring Graph API token:', error);
    throw error;
  }
}

// Helper to validate user token
async function validateUserToken(token: string): Promise<{ id: string; roles: string[] } | null> {
  console.log('🔐 Validating token against Microsoft Graph...');

  try {
    // Get Graph API token using client credentials
    const graphToken = await getGraphApiToken();

    // Decode the user token to get the user ID
    const decodedToken = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    const userId = decodedToken.oid || decodedToken.sub;

    if (!userId) {
      console.error('Could not extract user ID from token');
      return null;
    }

    // Use the Graph API token to get user info
    const response = await fetch(`https://graph.microsoft.com/v1.0/users/${userId}`, {
      headers: {
        Authorization: `Bearer ${graphToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('❌ Microsoft Graph API error:', {
        status: response.status,
        statusText: response.statusText,
        error: body,
      });
      return null;
    }

    const user = await response.json();
    console.log('✅ Microsoft Graph user info:', user);

    if (!user || !user.userPrincipalName) {
      console.error('Could not extract userPrincipalName from Graph API response for user ID:', userId);
      return null;
    }

    // Get user roles from Microsoft Graph groups
    const groupsResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${userId}/memberOf`, {
      headers: {
        Authorization: `Bearer ${graphToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!groupsResponse.ok) {
      console.warn('Could not fetch user groups from Microsoft Graph');
      return {
        id: user.userPrincipalName,
        roles: []
      };
    }

    const groups = await groupsResponse.json();
    const roles = groups.value
      .filter((group: any) => group['@odata.type'] === '#microsoft.graph.group')
      .map((group: any) => group.displayName.toLowerCase());

    console.log('User roles from Microsoft Graph:', roles);
    return {
      id: user.userPrincipalName,
      roles: roles
    };
  } catch (error) {
    console.error('Token validation error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return null;
  }
}

// Helper to get user's manager from Microsoft Graph
export async function getUserManager(token: string): Promise<any> {
  try {
    const graphToken = await getGraphApiToken();
    
    // Decode the user token to get the user ID
    const decodedToken = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    const userId = decodedToken.oid || decodedToken.sub;

    if (!userId) {
      console.error('Could not extract user ID from token');
      return null;
    }

    const response = await fetch(`https://graph.microsoft.com/v1.0/users/${userId}/manager`, {
      headers: {
        Authorization: `Bearer ${graphToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('❌ Error fetching manager:', {
        status: response.status,
        statusText: response.statusText,
        error: body,
      });
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching manager:', error);
    return null;
  }
}

// Helper to get user's direct reports from Microsoft Graph
// Accepts an optional userIdOrUpn to fetch reports for a specific user, 
// otherwise defaults to the user in the provided token (effectively "/me").
export async function getUserDirectReports(token: string, userIdOrUpn?: string): Promise<any[]> {
  try {
    const graphToken = await getGraphApiToken(); // This uses client credentials, not the user's token
    
    let targetUserId = userIdOrUpn; // Use provided userIdOrUpn if available

    if (!targetUserId) {
      // If userIdOrUpn is not provided, get the user ID from the *user's* token for /me equivalent
      const decodedUserToken = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      targetUserId = decodedUserToken.oid || decodedUserToken.sub;
      if (!targetUserId) {
        console.error('[getUserDirectReports] Could not extract user ID from provided token when userIdOrUpn is not specified.');
        return [];
      }
      console.log(`[getUserDirectReports] Fetching reports for user from token (me): ${targetUserId}`);
    } else {
      console.log(`[getUserDirectReports] Fetching reports for specified user: ${targetUserId}`);
    }

    const endpoint = `https://graph.microsoft.com/v1.0/users/${targetUserId}/directReports?$select=id,displayName,userPrincipalName`;
    
    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${graphToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('❌ Error fetching direct reports:', {
        status: response.status,
        statusText: response.statusText,
        error: body,
      });
      return [];
    }

    const data = await response.json();
    return data.value || [];
  } catch (error) {
    console.error('Error fetching direct reports:', error);
    return [];
  }
}

// Helper function to check if user has required role
export function hasRole(roles: string[], requiredRole: string): boolean {
  return roles.includes(requiredRole);
}

// Helper function to check if user has any of the required roles
export function hasAnyRole(roles: string[], requiredRoles: string[]): boolean {
  return requiredRoles.some(role => roles.includes(role));
}

// Helper function to check if user is accessing their own data
export function isSelfAccess(userId: string, targetId: string): boolean {
  return userId === targetId;
}

// Helper function to check if user is a manager
export function isManager(roles: string[]): boolean {
  return hasRole(roles, 'manager');
}

// Helper function to check if user is an admin
export function isAdmin(roles: string[]): boolean {
  return hasRole(roles, 'admin');
}

// Authentication middleware
export function withAuth(handler: (req: AuthenticatedRequest, res: NextApiResponse) => Promise<void>) {
  return async (req: AuthenticatedRequest, res: NextApiResponse) => {
    try {
      // Get the authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
          error: 'Unauthorized',
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      // Extract and validate token
      const token = authHeader.split(' ')[1];
      const userData = await validateUserToken(token);

      if (!userData) {
        return res.status(401).json({ 
          error: 'Unauthorized',
          message: 'Invalid or expired token',
          code: 'INVALID_TOKEN'
        });
      }

      // Get selected employee ID from header
      const selectedEmployeeId = req.headers['x-selected-employee-id'] as string;
      if (!selectedEmployeeId) {
        return res.status(403).json({ 
          error: 'Forbidden',
          message: 'Selected employee ID is required',
          code: 'EMPLOYEE_REQUIRED'
        });
      }

      // DEBUGGING: Log types and values before the query
      console.log('[AuthMiddleware] Employee Validation - Type of selectedEmployeeId:', typeof selectedEmployeeId, 'Value:', selectedEmployeeId);
      console.log('[AuthMiddleware] Employee Validation - Type of userData.id:', typeof userData.id, 'Value:', userData.id);

      // Verify selected employee belongs to user
      const employeeCheck = await executeQuery(
        'SELECT 1 FROM employees WHERE employee_number = $1 AND user_id = $2',
        [selectedEmployeeId, userData.id]
      );

      if (employeeCheck.length === 0) {
        console.error('[AuthMiddleware] Employee validation FAILED. No match found for:', {
          selectedEmployeeId,
          userId: userData.id,
          queryResult: employeeCheck
        });
        return res.status(403).json({ 
          error: 'Forbidden',
          message: 'Selected employee does not belong to user',
          code: 'INVALID_EMPLOYEE'
        });
      } else {
        console.log('[AuthMiddleware] Employee validation SUCCESSFUL.');
      }

      // Attach user data to request
      req.user = {
        ...userData,
        account: await msalInstance.getActiveAccount(),
      };

      // Call the handler
      await handler(req, res);
    } catch (error) {
      console.error('Authentication error in withAuth:', error);
      
      if (error instanceof InteractionRequiredAuthError) {
        return res.status(401).json({ 
          error: 'Authentication Required',
          message: 'User interaction required',
          code: 'INTERACTION_REQUIRED'
        });
      }

      return res.status(500).json({ 
        error: 'Internal Server Error',
        message: 'Authentication failed',
        code: 'AUTH_ERROR'
      });
    }
  };
} 