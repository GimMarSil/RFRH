import { NextApiResponse } from 'next';

// Custom error classes
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(401, 'AUTH_REQUIRED', message);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Not authorized to perform this action') {
    super(403, 'FORBIDDEN', message);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, 'NOT_FOUND', `${resource} not found`);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, 'CONFLICT', message);
  }
}

// Error response formatter
export function sendError(res: NextApiResponse, error: Error | AppError) {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      error: error.name,
      code: error.code,
      message: error.message,
      details: error.details,
    });
  }

  // Handle unexpected errors
  console.error('Unexpected error:', error);
  return res.status(500).json({
    error: 'InternalServerError',
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
  });
}

// Error handler middleware
export function withErrorHandler(
  handler: (req: any, res: NextApiResponse) => Promise<void>
) {
  return async (req: any, res: NextApiResponse) => {
    try {
      await handler(req, res);
    } catch (error) {
      sendError(res, error as Error);
    }
  };
}

// Validation helper
export function validateRequired<T>(
  data: Partial<T>,
  requiredFields: (keyof T)[]
): void {
  const missingFields = requiredFields.filter((field) => !data[field]);
  
  if (missingFields.length > 0) {
    throw new ValidationError(
      'Missing required fields',
      { missingFields }
    );
  }
}

// Permission helper
export function requireRole(roles: string[], userRoles: string[]): void {
  const hasRole = roles.some((role) => userRoles.includes(role));
  if (!hasRole) {
    throw new AuthorizationError(
      `Required role not found. Required: ${roles.join(', ')}`
    );
  }
} 