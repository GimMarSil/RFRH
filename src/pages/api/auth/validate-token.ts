import { NextApiRequest, NextApiResponse } from 'next';
import { ConfidentialClientApplication } from '@azure/msal-node';

// MSAL configuration for backend
const msalConfig = {
  auth: {
    clientId: process.env.AZURE_AD_CLIENT_ID!,
    authority: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}`,
    clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
  }
};

// Initialize MSAL client
const msalClient = new ConfidentialClientApplication(msalConfig);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    // Get a token for Microsoft Graph using On-Behalf-Of flow
    const graphToken = await msalClient.acquireTokenOnBehalfOf({
      oboAssertion: token,
      scopes: ['https://graph.microsoft.com/.default']
    });

    if (!graphToken) {
      throw new Error('Failed to acquire Graph token');
    }

    // Validate the token with Microsoft Graph
    const response = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        Authorization: `Bearer ${graphToken.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Graph API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`Graph API error: ${response.status} ${response.statusText}`);
    }

    const userData = await response.json();
    return res.status(200).json({ id: userData.id });
  } catch (error) {
    console.error('Token validation error:', error);
    return res.status(401).json({ 
      error: 'Token validation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 