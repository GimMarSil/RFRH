import { LogLevel } from "@azure/msal-browser";

// Temporary debugging logs
console.log("DEBUG: Client ID:", process.env.NEXT_PUBLIC_AZURE_CLIENT_ID);
console.log("DEBUG: Authority:", process.env.NEXT_PUBLIC_AZURE_AUTHORITY);
console.log("DEBUG: Redirect URI:", process.env.NEXT_PUBLIC_REDIRECT_URI);

export const msalConfig = {
    auth: {
        clientId: process.env.NEXT_PUBLIC_AZURE_CLIENT_ID,
        authority: process.env.NEXT_PUBLIC_AZURE_AUTHORITY,
        redirectUri: process.env.NEXT_PUBLIC_REDIRECT_URI || "http://localhost:3000/landing",
        postLogoutRedirectUri: process.env.NEXT_PUBLIC_POST_LOGOUT_REDIRECT_URI || "/",
        navigateToLoginRequestUrl: true,
    },
    cache: {
        cacheLocation: "sessionStorage",
        storeAuthStateInCookie: false,
    },
    system: {
        loggerOptions: {
            loggerCallback: (level, message, containsPii) => {
                if (containsPii) {
                    return;
                }
                switch (level) {
                    case LogLevel.Error:
                        console.error(message);
                        return;
                    case LogLevel.Info:
                        return;
                    case LogLevel.Verbose:
                        return;
                    case LogLevel.Warning:
                        console.warn(message);
                        return;
                    default:
                        return;
                }
            }
        }
    }
};

export const loginRequest = {
    scopes: ["User.Read"]
}; 