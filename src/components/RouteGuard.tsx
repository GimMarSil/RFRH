import React, { useEffect } from 'react';
import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import { logger } from '@/lib/logger';

const RouteGuard: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const isAuthenticated = useIsAuthenticated();
  const { instance, inProgress } = useMsal();

  useEffect(() => {
    if (!isAuthenticated && inProgress === 'none') {
      instance.loginRedirect().catch((err) => {
        logger.error('[RouteGuard] loginRedirect failed:', err);
      });
    }
  }, [isAuthenticated, inProgress, instance]);

  if (!isAuthenticated) {
    return <p className="p-4">A redirecionar para login...</p>;
  }

  return <>{children}</>;
};

export default RouteGuard;
