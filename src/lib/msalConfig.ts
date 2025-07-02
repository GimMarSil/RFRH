import * as msalNode from '@azure/msal-node';

// Configuration for MSAL Node (CCA for backend)
export const msalConfig = {
  auth: {
    clientId: process.env.AZURE_AD_CLIENT_ID!,
    authority: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}`,
    clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
  },
};

export const cca = new msalNode.ConfidentialClientApplication(msalConfig);

// Microsoft Graph API Scopes for Application Permissions
export const GRAPH_SCOPES = ['https://graph.microsoft.com/.default']; 