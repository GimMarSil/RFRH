import { logger } from '@/lib/logger';
import { LogLevel } from "@azure/msal-browser";


const origin = typeof window !== 'undefined' ? window.location.origin : '';

export const msalConfig = {
    auth: {
        clientId: process.env.NEXT_PUBLIC_AZURE_CLIENT_ID || '',
        authority: process.env.NEXT_PUBLIC_AZURE_AUTHORITY || '',
        redirectUri: process.env.NEXT_PUBLIC_REDIRECT_URI || `${origin}/landing`,
        postLogoutRedirectUri: process.env.NEXT_PUBLIC_POST_LOGOUT_REDIRECT_URI || origin || '/',
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
                        logger.error('[MSAL]', message);
                        return;
                    case LogLevel.Info:
                        logger.log('[MSAL]', message);
                        return;
                    case LogLevel.Verbose:
                        logger.log('[MSAL VERBOSE]', message);
                        return;
                    case LogLevel.Warning:
                        console.warn('[MSAL]', message);
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
