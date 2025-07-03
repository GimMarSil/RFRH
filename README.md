# RFRH

This project requires a number of environment variables to run locally. Copy `.env.local.example` to `.env.local` and fill in the values for your environment.

## Required variables

The following variables are referenced in the code base:

- `AZURE_AD_API_AUDIENCE`
- `AZURE_AD_CLIENT_ID`
- `AZURE_AD_CLIENT_SECRET`
- `AZURE_AD_GRAPH_SCOPE`
- `AZURE_AD_REDIRECT_URI`
- `AZURE_AD_TENANT_ID`
- `DATABASE_URL`
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_API_SCOPES`
- `NEXT_PUBLIC_AZURE_AUTHORITY`
- `NEXT_PUBLIC_AZURE_CLIENT_ID`
- `NEXT_PUBLIC_AZURE_LOGOUT_REDIRECT_URI`
- `NEXT_PUBLIC_POST_LOGOUT_REDIRECT_URI`
- `NEXT_PUBLIC_REDIRECT_URI`
- `SQL_DATABASE`
- `SQL_OPTIONS_ENCRYPT`
- `SQL_OPTIONS_TRUST_SERVER_CERTIFICATE`
- `SQL_PASSWORD`
- `SQL_SERVER`
- `SQL_USER`

Configure these variables in your `.env.local` file before starting the application.
