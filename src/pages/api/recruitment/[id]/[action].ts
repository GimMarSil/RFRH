import { Pool } from 'pg'; // Assuming you have 'pg' installed
// import { getToken } from 'next-auth/jwt'; // Keep if you plan to use it for more direct auth

// PostgreSQL connection configuration using the DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false, // Adjust SSL for Railway if needed
});

// Define your approver group ID
const APPROVER_GROUP_ID = "a837ee80-f103-4d51-9869-e3b4da6bdeda"; // Example RH Group ID

async function checkUserAuthorization(req): Promise<{ authorized: boolean; userId?: string; userName?: string }> {
  const userGroupsHeader = req.headers['x-user-groups'];
  const userIdHeader = req.headers['x-user-id'];
  const userNameHeader = req.headers['x-user-name'];

  if (!userIdHeader) {
    console.warn("User ID not found in request for authorization.");
    return { authorized: false };
  }

  const userId = Array.isArray(userIdHeader) ? userIdHeader[0] : userIdHeader;
  const userName = Array.isArray(userNameHeader) ? userNameHeader[0] : userNameHeader;

  if (userGroupsHeader) {
    try {
      const userGroups = JSON.parse(Array.isArray(userGroupsHeader) ? userGroupsHeader[0] : userGroupsHeader);
      if (Array.isArray(userGroups) && userGroups.includes(APPROVER_GROUP_ID)) {
        return { authorized: true, userId, userName };
      }
    } catch (error) {
      console.error("Error parsing user groups for authorization:", error);
      // Fall through to return not authorized
    }
  }
  console.warn('User does not belong to the required group for approval/rejection.');
  return { authorized: false, userId, userName }; // Default to not authorized
}


export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { id, action } = req.query;
  const { rejection_reason } = req.body; // For reject action

  if (!id || (action !== 'approve' && action !== 'reject')) {
    return res.status(400).json({ message: 'Invalid request parameters.' });
  }

  const authCheck = await checkUserAuthorization(req);
  if (!authCheck.authorized) {
    return res.status(403).json({ message: 'Forbidden: User not authorized to perform this action.' });
  }

  const performingUserName = authCheck.userName || authCheck.userId || "System"; // Use userName if available, else userId

  // Ensure your PostgreSQL table is named 'recruitment' or adjust as needed
  const tableName = 'recruitment'; 

  let client;
  try {
    client = await pool.connect();
    console.log('Successfully connected to PostgreSQL for action:', action);

    if (action === 'approve') {
      const query = `
        UPDATE ${tableName}
        SET estado = $1,
            approved_by = $2,
            approved_at = NOW()
        WHERE id = $3 AND estado = $4
        RETURNING id;`; // RETURNING id to check if update occurred
      const values = ['Aprovado', performingUserName, id, 'Pendente'];
      const result = await client.query(query, values);

      if (result.rowCount === 0) {
        return res.status(404).json({ message: 'Request not found, already processed, or no changes made.' });
      }
      console.log(`Request ${id} approved successfully by ${performingUserName}`);
      return res.status(200).json({ success: true, message: 'Pedido aprovado com sucesso.' });

    } else if (action === 'reject') {
      if (!rejection_reason) {
        return res.status(400).json({ message: 'Rejection reason is required.' });
      }
      const query = `
        UPDATE ${tableName}
        SET estado = $1,
            rejected_by = $2,
            rejected_at = NOW(),
            rejection_reason = $3
        WHERE id = $4 AND estado = $5
        RETURNING id;`; // RETURNING id to check if update occurred
      const values = ['Rejeitado', performingUserName, rejection_reason, id, 'Pendente'];
      const result = await client.query(query, values);
      
      if (result.rowCount === 0) {
        return res.status(404).json({ message: 'Request not found, already processed, or no changes made.' });
      }
      console.log(`Request ${id} rejected successfully by ${performingUserName}`);
      return res.status(200).json({ success: true, message: 'Pedido rejeitado com sucesso.' });
    }
  } catch (error) {
    console.error(`Database error during ${action} action:`, error);
    return res.status(500).json({ message: `Error processing request: ${error.message}` });
  } finally {
    if (client) {
      client.release(); // Release the client back to the pool
    }
  }
} 