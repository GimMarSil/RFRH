# RFRH Portal

## Project Overview

RFRH is a Next.js application used to manage recruitment and employee evaluations. Authentication is handled through Microsoft Azure Active Directory using MSAL. Data about employees and evaluations is stored in a SQL Server database.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.local.example` to `.env.local` and fill in the required variables.
3. Run the development server:
   ```bash
   npm run dev
   ```

The application will start on `http://localhost:3000` by default.

### Environment Variables

The example file `.env.local.example` lists all configuration values used by the project:

- `NEXT_PUBLIC_AZURE_CLIENT_ID`
- `NEXT_PUBLIC_AZURE_AUTHORITY`
- `NEXT_PUBLIC_REDIRECT_URI`
- `AZURE_AD_CLIENT_ID`
- `AZURE_AD_CLIENT_SECRET`
- `AZURE_AD_TENANT_ID`
- `SQL_USER`
- `SQL_PASSWORD`
- `SQL_SERVER`
- `SQL_DATABASE`
- `DATABASE_URL`

Refer to that file when creating your own `.env.local`.

## Employee Selection Flow

After signing in, the app fetches the employees associated with the authenticated user. When there is more than one employee, a modal appears asking the user to choose which profile to use. The chosen employee ID is stored in `SelectedEmployeeContext` and persisted to local storage. All API calls include this ID in the `x-selected-employee-id` header so the backend can verify access.

