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

Refer to that file when creating your own `.env.local`. You can also run
`npm run setup-env` to copy the example file automatically.

## Employee Selection Flow

After signing in, the app fetches the employees associated with the authenticated user. When there is more than one employee, a modal appears asking the user to choose which profile to use. The chosen employee ID is stored in `SelectedEmployeeContext` and persisted to local storage. All API calls include this ID in the `x-selected-employee-id` header so the backend can verify access.

