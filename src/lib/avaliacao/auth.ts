import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export type UserRole = 'employee' | 'manager' | 'hr' | 'admin';

interface UserRoleInfo {
  role: UserRole;
  isManager: boolean;
  subordinates: string[]; // Array of employee IDs
  department?: string;
  businessUnit?: string;
}

// Cache user role info to avoid repeated DB queries
const roleInfoCache = new Map<string, { info: UserRoleInfo; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getUserRoleInfo(employeeId: string): Promise<UserRoleInfo | null> {
  // Check cache first
  const cached = roleInfoCache.get(employeeId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.info;
  }

  const client = await pool.connect();
  try {
    // Get user's role and department info
    const roleQuery = await client.query(`
      SELECT 
        e.role,
        e.department_id,
        e.business_unit_id,
        EXISTS (
          SELECT 1 FROM employee_hierarchy 
          WHERE manager_id = $1 AND status = 'active'
        ) as is_manager
      FROM employees e
      WHERE e.id = $1 AND e.status = 'active'
    `, [employeeId]);

    if (roleQuery.rows.length === 0) {
      return null;
    }

    const { role, department_id, business_unit_id, is_manager } = roleQuery.rows[0];

    // Get subordinates if manager
    let subordinates: string[] = [];
    if (is_manager) {
      const subordinatesQuery = await client.query(`
        SELECT employee_id 
        FROM employee_hierarchy 
        WHERE manager_id = $1 AND status = 'active'
      `, [employeeId]);
      subordinates = subordinatesQuery.rows.map(row => row.employee_id);
    }

    const roleInfo: UserRoleInfo = {
      role: role as UserRole,
      isManager: is_manager,
      subordinates,
      department: department_id,
      businessUnit: business_unit_id
    };

    // Update cache
    roleInfoCache.set(employeeId, { info: roleInfo, timestamp: Date.now() });

    return roleInfo;
  } finally {
    client.release();
  }
}

// Helper to check if a user is an HR user
async function isHRUser(userId: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id = $1 AND role = $2)',
      [userId, 'hr']
    );
    return result.rows[0].exists;
  } finally {
    client.release();
  }
}

// Helper to check if a user is a manager
async function isManager(userId: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id = $1 AND role = $2)',
      [userId, 'manager']
    );
    return result.rows[0].exists;
  } finally {
    client.release();
  }
}

// Helper to check if a user is a direct manager of an employee
async function isDirectManager(managerId: string, employeeId: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT EXISTS(SELECT 1 FROM employee_hierarchy WHERE manager_id = $1 AND employee_id = $2)',
      [managerId, employeeId]
    );
    return result.rows[0].exists;
  } finally {
    client.release();
  }
}

// Helper to check if a user is an indirect manager of an employee
async function isIndirectManager(managerId: string, employeeId: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `WITH RECURSIVE manager_hierarchy AS (
        SELECT manager_id, employee_id, 1 as level
        FROM employee_hierarchy
        WHERE manager_id = $1
        UNION ALL
        SELECT eh.manager_id, eh.employee_id, mh.level + 1
        FROM employee_hierarchy eh
        JOIN manager_hierarchy mh ON eh.manager_id = mh.employee_id
      )
      SELECT EXISTS(SELECT 1 FROM manager_hierarchy WHERE employee_id = $2)`,
      [managerId, employeeId]
    );
    return result.rows[0].exists;
  } finally {
    client.release();
  }
}

// Check if a user can access an evaluation
export async function canAccessEvaluation(
  userId: string,
  evaluationId: string,
  evaluationType: 'employee' | 'self'
): Promise<boolean> {
  const client = await pool.connect();
  try {
    // HR users can access any evaluation
    if (await isHRUser(userId)) {
      return true;
    }

    if (evaluationType === 'employee') {
      // For employee evaluations, check if user is the employee, direct manager, or indirect manager
      const result = await client.query(
        'SELECT employee_id, manager_id FROM employee_evaluations WHERE id = $1',
        [evaluationId]
      );

      if (result.rows.length === 0) {
        return false;
      }

      const { employee_id, manager_id } = result.rows[0];

      // Employee can access their own evaluation
      if (userId === employee_id) {
        return true;
      }

      // Check if user is the direct manager
      if (userId === manager_id) {
        return true;
      }

      // Check if user is an indirect manager
      return await isIndirectManager(userId, employee_id);
    } else {
      // For self-evaluations, check if user is the employee or HR
      const result = await client.query(
        'SELECT employee_id FROM self_evaluations WHERE id = $1',
        [evaluationId]
      );

      if (result.rows.length === 0) {
        return false;
      }

      const { employee_id } = result.rows[0];
      return userId === employee_id;
    }
  } finally {
    client.release();
  }
}

// Check if a user can modify an evaluation
export async function canModifyEvaluation(
  userId: string,
  evaluationId: string,
  evaluationType: 'employee' | 'self',
  newStatus?: string
): Promise<boolean> {
  const client = await pool.connect();
  try {
    // HR users can modify any evaluation
    if (await isHRUser(userId)) {
      return true;
    }

    if (evaluationType === 'employee') {
      // For employee evaluations, check if user is the direct manager
      const result = await client.query(
        'SELECT manager_id, status FROM employee_evaluations WHERE id = $1',
        [evaluationId]
      );

      if (result.rows.length === 0) {
        return false;
      }

      const { manager_id, status } = result.rows[0];

      // Only the direct manager can modify the evaluation
      if (userId !== manager_id) {
        return false;
      }

      // Additional status-based checks
      if (status === 'validated' || status === 'cancelled') {
        return false;
      }

      // If newStatus is provided, check if the transition is allowed
      if (newStatus && status !== newStatus) {
        // Only HR can validate or revert to draft
        if (newStatus === 'validated' || (newStatus === 'draft' && status !== 'draft')) {
          return false;
        }
      }

      return true;
    } else {
      // For self-evaluations, check if user is the employee
      const result = await client.query(
        'SELECT employee_id, status FROM self_evaluations WHERE id = $1',
        [evaluationId]
      );

      if (result.rows.length === 0) {
        return false;
      }

      const { employee_id, status } = result.rows[0];

      // Only the employee can modify their self-evaluation
      if (userId !== employee_id) {
        return false;
      }

      // Additional status-based checks
      if (status === 'submitted' || status === 'cancelled') {
        return false;
      }

      // If newStatus is provided, check if the transition is allowed
      if (newStatus && status !== newStatus) {
        // Only HR can revert to draft
        if (newStatus === 'draft' && status !== 'draft') {
          return false;
        }
      }

      return true;
    }
  } finally {
    client.release();
  }
}

// Check if a user can create an evaluation for an employee
export async function canCreateEvaluation(
  userId: string,
  employeeId: string
): Promise<boolean> {
  // HR users can create evaluations for any employee
  if (await isHRUser(userId)) {
    return true;
  }

  // Check if user is a direct manager of the employee
  return await isDirectManager(userId, employeeId);
}

// Check if a user can create a self-evaluation
export async function canCreateSelfEvaluation(
  userId: string,
  matrixId: number
): Promise<boolean> {
  const client = await pool.connect();
  try {
    // Check if the matrix is applicable to the user
    const result = await client.query(
      `SELECT EXISTS(
        SELECT 1 FROM evaluation_matrix_applicability
        WHERE matrix_id = $1 AND employee_id = $2 AND status = 'active'
        AND valid_from <= CURRENT_DATE AND valid_to >= CURRENT_DATE
      )`,
      [matrixId, userId]
    );
    return result.rows[0].exists;
  } finally {
    client.release();
  }
}

export async function canAccessMatrix(
  actingEmployeeId: string,
  matrixId: number
): Promise<boolean> {
  const client = await pool.connect();
  try {
    const roleInfo = await getUserRoleInfo(actingEmployeeId);
    if (!roleInfo) return false;

    // Admins and HR can access all matrices
    if (roleInfo.role === 'admin' || roleInfo.role === 'hr') return true;

    // Check if matrix is applicable to employee
    const applicabilityQuery = await client.query(`
      SELECT 1 
      FROM evaluation_matrix_applicability 
      WHERE matrix_id = $1 
      AND employee_id = $2 
      AND status = 'active'
      AND valid_from <= CURRENT_DATE 
      AND valid_to >= CURRENT_DATE
    `, [matrixId, actingEmployeeId]);

    return applicabilityQuery.rows.length > 0;
  } finally {
    client.release();
  }
}

export async function canManageMatrix(
  actingEmployeeId: string,
  matrixId: number
): Promise<boolean> {
  const client = await pool.connect();
  try {
    const roleInfo = await getUserRoleInfo(actingEmployeeId);
    if (!roleInfo) return false;

    // Admins and HR can manage all matrices
    if (roleInfo.role === 'admin' || roleInfo.role === 'hr') return true;

    // Managers can manage matrices they created
    if (roleInfo.isManager) {
      const matrixQuery = await client.query(`
        SELECT 1 
        FROM evaluation_matrices 
        WHERE id = $1 
        AND employee_id = $2
      `, [matrixId, actingEmployeeId]);

      return matrixQuery.rows.length > 0;
    }

    return false;
  } finally {
    client.release();
  }
} 