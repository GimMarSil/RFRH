import { cca, GRAPH_SCOPES } from './msalConfig'; // Import shared MSAL config

export interface GraphUser {
  id: string; // Azure AD Object ID
  displayName?: string;
  mail?: string;
  userPrincipalName?: string;
}

// Helper to get an application token for Microsoft Graph
export async function getGraphToken(): Promise<string | null> {
  try {
    const authResult = await cca.acquireTokenByClientCredential({ scopes: GRAPH_SCOPES });
    return authResult?.accessToken || null;
  } catch (error) {
    console.error('Failed to acquire Graph token by client credential:', error);
    return null;
  }
}

// Helper to fetch data from Graph
export async function fetchFromGraph(graphToken: string, url: string): Promise<any> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${graphToken}` },
  });
  if (!response.ok) {
    const errorText = await response.text();
    // Consider how to handle Graph API errors more gracefully or specifically if needed
    console.error(`Graph API error: ${response.status} ${response.statusText} - ${errorText} for URL: ${url}`);
    throw new Error(`Graph API error: ${response.status} ${response.statusText}`);
  }
  try {
    return await response.json();
  } catch (e) {
    // Handle cases where response might be ok but not JSON (e.g. 204 No Content for directReports if no one reports)
    if (response.status === 204) return { value: [] }; // Mimic Graph's empty value array for consistency
    console.error('Failed to parse Graph API JSON response:', e);
    throw new Error('Failed to parse Graph API JSON response.');
  }
}

// Helper specifically for getting direct subordinates
export async function getDirectGraphSubordinates(userAzureAdId: string): Promise<GraphUser[]> {
  if (!userAzureAdId) {
    console.warn('getDirectGraphSubordinates: userAzureAdId was not provided.');
    return [];
  }
  
  const graphToken = await getGraphToken();
  if (!graphToken) {
    console.error('getDirectGraphSubordinates: Failed to get Graph token.');
    // Depending on desired error handling, you might throw here or return empty
    return []; 
  }

  try {
    // Requesting only essential fields to minimize data transfer and permission scope if possible
    const graphSubordinatesData = await fetchFromGraph(
      graphToken, 
      `https://graph.microsoft.com/v1.0/users/${userAzureAdId}/directReports?$select=id,displayName,userPrincipalName,mail`
    );
    return (graphSubordinatesData?.value as GraphUser[]) || [];
  } catch (error) {
    // Log the specific error from fetchFromGraph (which already logs details)
    console.error(`getDirectGraphSubordinates: Error fetching direct reports for AAD user ${userAzureAdId}:`, error.message);
    return []; // Return empty array on error to allow checks like .length > 0 to fail gracefully
  }
} 