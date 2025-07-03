import React from 'react';
import { msalConfig } from '@/config/authConfig';

const MSALDebug: React.FC = () => {
  if (process.env.NODE_ENV !== 'development') return null;

  const computedRedirect =
    typeof window !== 'undefined'
      ? (process.env.NEXT_PUBLIC_REDIRECT_URI || `${window.location.origin}/landing`)
      : '';

  const envInfo = {
    NEXT_PUBLIC_AZURE_CLIENT_ID: process.env.NEXT_PUBLIC_AZURE_CLIENT_ID,
    NEXT_PUBLIC_AZURE_AUTHORITY: process.env.NEXT_PUBLIC_AZURE_AUTHORITY,
    NEXT_PUBLIC_REDIRECT_URI: process.env.NEXT_PUBLIC_REDIRECT_URI,
  };

  return (
    <div style={{ background: '#eee', padding: '1rem', marginTop: '1rem' }}>
      <h3>MSAL Debug</h3>
      <pre>{JSON.stringify({ envInfo, computedRedirect, msalConfig }, null, 2)}</pre>
    </div>
  );
};

export default MSALDebug;
