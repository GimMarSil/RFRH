import { IPublicClientApplication, InteractionRequiredAuthError, InteractionStatus, AccountInfo } from "@azure/msal-browser";

// This should match the API scopes defined in your MSAL configuration and frontend components.
const apiScopes = [process.env.NEXT_PUBLIC_API_SCOPES || "api://YOUR_BACKEND_APP_ID_URI/.default"];

/**
 * Interface for options required by the API client.
 */
export interface ApiClientOptions {
  msalInstance: IPublicClientApplication;
  // The ID of the employee profile the user is currently acting as.
  // This would typically be retrieved from a global state/context (e.g., React Context) in a real application.
  selectedEmployeeId: string | null; 
  interactionStatus: InteractionStatus; // Added to pass the status from useMsal()
  activeAccount: AccountInfo | null; // Added to pass the active account from useMsal()
}

/**
 * Fetches data from the API with authentication headers.
 * @param url The API endpoint URL.
 * @param options Standard fetch options (method, body, etc.).
 * @param clientOptions Options required for the API client, including MSAL instance and selectedEmployeeId.
 * @returns A promise that resolves with the JSON response.
 */
export async function fetchWithAuth<T = any>(
  apiUrl: string, 
  requestOptions: RequestInit = { method: 'GET' }, 
  options: ApiClientOptions
): Promise<T> {
  const { msalInstance, interactionStatus, activeAccount, selectedEmployeeId } = options;

  if (!msalInstance || !activeAccount) {
    console.error('[apiClient] MSAL instance or active account is missing. Cannot proceed with authenticated request.', { msalInstanceExists: !!msalInstance, activeAccountExists: !!activeAccount });
    // For GET requests, we might have previously allowed them to proceed,
    // but protected GET endpoints will fail. It's better to stop here.
    return Promise.reject(new Error('Authentication context not available.'));
  }

  const request = {
    account: activeAccount,
    scopes: apiScopes // Reverted to use the apiScopes constant
  };

  let tokenResponse;

  console.log(`[apiClient] fetchWithAuth attempting for URL: ${apiUrl}, Method: ${requestOptions.method}`);
  console.log('[apiClient] Options:', { interactionStatus, selectedEmployeeId, activeAccountUsername: activeAccount.username });

  try {
    if (interactionStatus === InteractionStatus.None) {
      tokenResponse = await msalInstance.acquireTokenSilent(request);
      console.log(`[apiClient] Token acquired silently for ${apiUrl}:`, tokenResponse ? 'Token obtained' : 'Token NOT obtained');
    } else {
      console.warn(`[apiClient] Interaction in progress (${interactionStatus}), skipping silent token acquisition for ${apiUrl}. This might lead to auth failure if a redirect/popup isn't completing.`);
      // Decide if we should attempt acquireTokenRedirect/Popup here or if the main app flow handles it.
      // For now, we'll let it proceed, and if no token, it will fail below.
      // This situation (interaction in progress) should ideally resolve before making API calls.
    }
  } catch (error) {
    console.error(`[apiClient] Silent token acquisition failed for ${apiUrl}:`, error);
    if (error instanceof InteractionRequiredAuthError) {
      console.log(`[apiClient] Interaction required for ${apiUrl}. Depending on app flow, redirect/popup should be invoked.`);
      // msalInstance.acquireTokenRedirect(request); // Or acquireTokenPopup
      // For now, let API call fail to indicate an issue with interaction handling.
    }
    // If acquireTokenSilent fails for other reasons, tokenResponse will be undefined and handled below.
  }

  const headers = new Headers(requestOptions.headers || {});
  if (selectedEmployeeId) {
    headers.append('x-selected-employee-id', selectedEmployeeId);
  } else {
    // This warning is useful for most endpoints. Some endpoints (like an initial user-role lookup)
    // might legitimately be called without a selectedEmployeeId.
    console.warn(`X-Selected-Employee-ID is not set for API call to ${apiUrl}. This might be an issue for some endpoints.`);
  }
  if (requestOptions.method !== 'GET' && requestOptions.method !== 'HEAD' && requestOptions.body) {
    headers.append('Content-Type', 'application/json');
  }

  if (tokenResponse && tokenResponse.accessToken) {
    headers.append('Authorization', `Bearer ${tokenResponse.accessToken}`);
    console.log(`[apiClient] Authorization header added for ${apiUrl}. Token snippet: ${tokenResponse.accessToken.substring(0, 20)}...`);
  } else {
    console.warn(`[apiClient] No access token available for ${apiUrl}. Proceeding without Authorization header. This will likely fail for protected routes.`);
    // For GET requests, we used to let them pass, but now we are stricter.
    // However, if the server simply complains about *no header* vs. an *invalid token*,
    // this branch means the header isn't even being added.
  }
  
  console.log(`[apiClient] Headers being sent for ${apiUrl}:`, Array.from(headers.entries()));

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || ''; // e.g., http://localhost:3000

  try {
    const response = await fetch(`${apiBaseUrl}${apiUrl}`, {
      ...requestOptions,
      headers,
    });

    if (apiUrl.includes('activeMatrixCheck')) {
      console.log(`[apiClient] Response status for activeMatrixCheck (${apiUrl}): ${response.status}`);
    }

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { message: response.statusText || "API request failed" };
      }
      const error = new Error(errorData.details || errorData.message || `API request failed with status ${response.status}`) as any;
      error.response = response;
      error.data = errorData;
      error.status = response.status;
      throw error;
    }

    // Handle cases where response might be empty (e.g., 204 No Content for DELETE)
    if (response.status === 204) {
      return Promise.resolve(null as unknown as T);
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
      return response.json() as Promise<T>;
    } else {
      // For non-JSON responses, like plain text.
      return response.text().then(text => text || null) as unknown as Promise<T>;
    }
  } catch (error) {
    // Log network errors or errors during fetch/json parsing
    console.error(`[apiClient] Fetch or JSON parsing error for ${apiUrl}:`, error);
    // Re-throw the error so the calling function can handle it
    // If it's already our custom error object, just rethrow it.
    if (error && typeof error === 'object' && 'status' in error) throw error;
    throw new Error(`Network error or failed to fetch/parse for ${apiUrl}`);
  }
}

/*
Example usage (in a React component):

import { useMsal } from "@azure/msal-react";
import { fetchWithAuth, ApiClientOptions } from "@/lib/apiClient"; // Adjust path as needed

// Assume selectedEmployeeId is managed in a global state, e.g., React Context
// For demonstration, we'll retrieve it from a hypothetical context or prop.
// import { useSelectedEmployeeContext } from "@/contexts/SelectedEmployeeContext"; 

function MyComponent() {
  const { instance, accounts } = useMsal();
  // const { selectedEmployeeId } = useSelectedEmployeeContext(); // Example from context
  const selectedEmployeeIdForApi = "employee-id-from-context-or-props"; // Replace with actual source

  const handleFetchData = async () => {
    if (accounts.length === 0) {
      console.error("No user signed in.");
      // Potentially trigger login or show a message
      return;
    }

    const clientOptions: ApiClientOptions = {
      msalInstance: instance,
      selectedEmployeeId: selectedEmployeeIdForApi,
      interactionStatus: accounts[0].localAccountState,
      activeAccount: accounts[0],
    };

    try {
      // Example GET request
      const data = await fetchWithAuth<{ message: string }>(
        "/api/some-protected-endpoint", 
        { method: "GET" }, 
        clientOptions
      );
      console.log("Fetched data:", data);

      // Example POST request
      // const postData = { name: "Test" };
      // const response = await fetchWithAuth<any>(
      //   "/api/another-endpoint",
      //   {
      //     method: "POST",
      //     body: JSON.stringify(postData),
      //   },
      //   clientOptions
      // );
      // console.log("POST response:", response);

    } catch (error: any) {
      console.error("API call failed:", error);
      if (error instanceof InteractionRequiredAuthError) {
        // Handle interaction required error (e.g., by redirecting or showing a popup)
        // instance.acquireTokenRedirect(tokenRequest).catch(console.error);
      } else {
        // Handle other errors (e.g., display a notification to the user)
        // alert(`Error: ${error.message}`);
      }
    }
  };

  return (
    <button onClick={handleFetchData}>Fetch Protected Data</button>
  );
}
*/ 