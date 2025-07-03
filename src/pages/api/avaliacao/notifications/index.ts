import { NextApiResponse } from 'next';
import { withAuth, AuthenticatedRequest } from '../../../middleware/auth';
import { isAdmin } from '../../../../lib/auth';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function handler(req: AuthenticatedRequest, res: NextApiResponse): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Authentication required' });
    return;
  }

  const client = await pool.connect();
  try {
    if (req.method === 'GET') {
      // Get notifications for the current user
      const result = await client.query(
        `SELECT * FROM evaluation_notifications 
         WHERE recipient_id = $1 
         ORDER BY created_at DESC 
         LIMIT 50`,
        [req.user.id]
      );

      res.status(200).json(result.rows);
      return;

    } else if (req.method === 'PUT') {
      // Mark notification as read
      const { id } = req.body;

      if (!id) {
        res.status(400).json({ message: 'Notification ID is required' });
        return;
      }

      const result = await client.query(
        `UPDATE evaluation_notifications 
         SET status = 'read', read_at = NOW() 
         WHERE id = $1 AND recipient_id = $2 
         RETURNING *`,
        [id, req.user.id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ message: 'Notification not found' });
        return;
      }

      res.status(200).json(result.rows[0]);
      return;

    } else {
      res.setHeader('Allow', ['GET', 'PUT']);
      res.status(405).end(`Method ${req.method} Not Allowed for this route.`);
      return;
    }
  } catch (error) {
    console.error('Error in notifications API:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
    return;
  } finally {
    client.release();
  }
}

export default withAuth(handler); 