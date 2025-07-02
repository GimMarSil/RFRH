import { Pool } from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Validate SSL configuration
const sslConfig = process.env.NODE_ENV === 'production' 
  ? { rejectUnauthorized: false } 
  : undefined;

// Create a single pool instance to be reused across the application
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 2000, // How long to wait for a connection
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Helper function to execute queries with proper error handling
export async function executeQuery<T = any>(
  query: string,
  params: any[] = [],
  client?: any
): Promise<T[]> {
  const shouldRelease = !client;
  const queryClient = client || await pool.connect();
  
  try {
    const result = await queryClient.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  } finally {
    if (shouldRelease) {
      queryClient.release();
    }
  }
}

// Helper function to execute transactions
export async function executeTransaction<T = any>(
  callback: (client: any) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
} 