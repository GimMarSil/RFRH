import { NextApiResponse } from 'next';
import { withAuth, AuthenticatedRequest, isAdmin } from '../../../middleware/auth';
import { runNotificationChecks } from '../../../lib/evaluation/notificationService';

async function handler(req: AuthenticatedRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  if (!req.user) {
    res.status(401).json({ message: 'Authentication required' });
    return;
  }

  if (!isAdmin(req.user.roles)) {
    res.status(403).json({ message: 'Only admins can trigger notification checks' });
    return;
  }

  try {
    await runNotificationChecks();
    res.status(200).json({ message: 'Notification checks completed successfully' });
  } catch (error) {
    console.error('Error running notification checks:', error);
    res.status(500).json({ message: 'Error running notification checks', error: error.message });
  }
}

export default withAuth(handler); 