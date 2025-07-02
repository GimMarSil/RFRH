import { z } from 'zod';

// Base schemas for reuse
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');
const statusSchema = z.enum(['draft', 'in_progress', 'submitted', 'validated', 'cancelled', 'acknowledged']);

// Validation schemas
const evaluationCriterionSchema = z.object({
  name: z.string().min(1, 'Criterion name is required'),
  description: z.string().optional(),
  weight: z.number().min(0.01).max(100),
  is_competency_gap_critical: z.boolean().default(false),
  min_score_possible: z.number().min(0).max(100).default(0),
  max_score_possible: z.number().min(0).max(100).default(100),
}).refine(data => data.min_score_possible <= data.max_score_possible, {
  message: 'Minimum score must be less than or equal to maximum score'
});

const matrixInputSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  valid_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  valid_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  criteria: z.array(evaluationCriterionSchema).min(1, 'At least one criterion is required'),
}).refine(data => new Date(data.valid_from) <= new Date(data.valid_to), {
  message: 'Valid from date must be before or equal to valid to date'
});

const scoreInputSchema = z.object({
  criterion_id: z.number().int().positive(),
  achievement_percentage: z.number().min(0).max(100),
  manager_criterion_comments: z.string().optional(),
});

const selfScoreInputsSchema = z.object({
  criterion_id: z.number().int().positive(),
  achievement_percentage: z.number().min(0).max(100),
  employee_criterion_comments: z.string().optional(),
});

const evaluationInputSchema = z.object({
  matrix_id: z.number().int().positive(),
  employee_id: z.string(),
  evaluation_period_month: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: statusSchema.optional(),
  manager_overall_comments: z.string().optional(),
  employee_acknowledgement_comments: z.string().optional(),
  cancellation_reason: z.string().optional(),
});

// Self-evaluation schemas
const selfEvaluationInputSchema = z.object({
  matrix_id: z.number().int().positive(),
  evaluation_period_month: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const selfEvaluationUpdateSchema = z.object({
  status: statusSchema.optional(),
  employee_overall_comments: z.string().max(2000).optional(),
  total_weighted_score: z.number().min(0).max(100).optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update'
});

interface ValidationResult {
  success: boolean;
  errors?: string[];
}

interface MatrixInput {
  title: string;
  description?: string;
  valid_from: string;
  valid_to: string;
  status?: string;
  criteria?: Array<{
    name: string;
    description?: string;
    weight: number;
    is_competency_gap_critical?: boolean;
    min_score_possible?: number;
    max_score_possible?: number;
  }>;
  applicable_employee_ids?: string[];
}

// Validation functions
export async function validateMatrixInput(input: MatrixInput): Promise<ValidationResult> {
  const errors: string[] = [];

  // Validate title
  if (!input.title || input.title.trim().length === 0) {
    errors.push('Title is required');
  } else if (input.title.length > 255) {
    errors.push('Title must be less than 255 characters');
  }

  // Validate dates
  if (!input.valid_from) {
    errors.push('Valid from date is required');
  } else {
    const validFrom = new Date(input.valid_from);
    if (isNaN(validFrom.getTime())) {
      errors.push('Valid from date is invalid');
    }
  }

  if (!input.valid_to) {
    errors.push('Valid to date is required');
  } else {
    const validTo = new Date(input.valid_to);
    if (isNaN(validTo.getTime())) {
      errors.push('Valid to date is invalid');
    }
  }

  if (input.valid_from && input.valid_to) {
    const validFrom = new Date(input.valid_from);
    const validTo = new Date(input.valid_to);
    if (validFrom >= validTo) {
      errors.push('Valid from date must be before valid to date');
    }
  }

  // Validate status
  if (input.status && !['draft', 'active', 'inactive'].includes(input.status)) {
    errors.push('Status must be one of: draft, active, inactive');
  }

  // Validate criteria
  if (!input.criteria || !Array.isArray(input.criteria) || input.criteria.length === 0) {
    errors.push('At least one criterion is required');
  } else {
    let totalWeight = 0;
    input.criteria.forEach((criterion, index) => {
      // Validate criterion name
      if (!criterion.name || criterion.name.trim().length === 0) {
        errors.push(`Criterion ${index + 1}: Name is required`);
      } else if (criterion.name.length > 255) {
        errors.push(`Criterion ${index + 1}: Name must be less than 255 characters`);
      }

      // Validate criterion weight
      if (typeof criterion.weight !== 'number' || isNaN(criterion.weight)) {
        errors.push(`Criterion ${index + 1}: Weight must be a number`);
      } else if (criterion.weight <= 0) {
        errors.push(`Criterion ${index + 1}: Weight must be greater than 0`);
      } else {
        totalWeight += criterion.weight;
      }

      // Validate score range
      if (criterion.min_score_possible !== undefined) {
        if (typeof criterion.min_score_possible !== 'number' || isNaN(criterion.min_score_possible)) {
          errors.push(`Criterion ${index + 1}: Minimum score must be a number`);
        } else if (criterion.min_score_possible < 0) {
          errors.push(`Criterion ${index + 1}: Minimum score must be greater than or equal to 0`);
        }
      }

      if (criterion.max_score_possible !== undefined) {
        if (typeof criterion.max_score_possible !== 'number' || isNaN(criterion.max_score_possible)) {
          errors.push(`Criterion ${index + 1}: Maximum score must be a number`);
        } else if (criterion.max_score_possible > 100) {
          errors.push(`Criterion ${index + 1}: Maximum score must be less than or equal to 100`);
        }
      }

      if (criterion.min_score_possible !== undefined && criterion.max_score_possible !== undefined) {
        if (criterion.min_score_possible >= criterion.max_score_possible) {
          errors.push(`Criterion ${index + 1}: Minimum score must be less than maximum score`);
        }
      }
    });

    // Validate total weight
    if (Math.abs(totalWeight - 100) > 0.01) {
      errors.push('Total weight of all criteria must equal 100');
    }
  }

  // Validate applicable employee IDs
  if (input.applicable_employee_ids) {
    if (!Array.isArray(input.applicable_employee_ids)) {
      errors.push('Applicable employee IDs must be an array');
    } else if (input.applicable_employee_ids.length === 0) {
      errors.push('At least one applicable employee must be specified');
    } else {
      input.applicable_employee_ids.forEach((id, index) => {
        if (!id || typeof id !== 'string') {
          errors.push(`Applicable employee ID at index ${index} is invalid`);
        }
      });
    }
  }

  return {
    success: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

export async function validateScoreInputs(data: unknown) {
  return z.array(scoreInputSchema).parse(data);
}

export async function validateSelfScoreInputs(input: unknown) {
  try {
    const validatedData = await selfScoreInputsSchema.parseAsync(input);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message
        }))
      };
    }
    return {
      success: false,
      errors: [{ path: '', message: 'Invalid input format' }]
    };
  }
}

export async function validateEmployeeEvaluationInput(data: unknown) {
  return evaluationInputSchema.parse(data);
}

export async function validateSelfEvaluationInput(input: unknown) {
  try {
    const validatedData = await selfEvaluationInputSchema.parseAsync(input);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message
        }))
      };
    }
    return {
      success: false,
      errors: [{ path: '', message: 'Invalid input format' }]
    };
  }
}

// Status transition validation
export function validateStatusTransition(
  currentStatus: string,
  newStatus: string,
  userRole: 'employee' | 'manager' | 'admin',
  evaluationType: 'self' | 'employee'
): boolean {
  const validTransitions: Record<string, string[]> = {
    // Self-evaluation transitions
    self: {
      employee: {
        draft: ['submitted'],
        submitted: [], // Once submitted, no further transitions allowed
      },
      admin: {
        draft: ['submitted'],
        submitted: ['draft'], // Admin can revert to draft if needed
      }
    },
    // Employee evaluation transitions
    employee: {
      employee: {
        submitted: ['acknowledged'], // Employee can only acknowledge
      },
      manager: {
        draft: ['in_progress', 'submitted'],
        in_progress: ['submitted'],
        submitted: ['in_progress'], // Manager can revert to in_progress
      },
      admin: {
        draft: ['in_progress', 'submitted'],
        in_progress: ['submitted', 'draft'],
        submitted: ['in_progress', 'draft', 'acknowledged'],
        acknowledged: ['submitted', 'in_progress', 'draft'],
      }
    }
  };

  const transitions = validTransitions[evaluationType]?.[userRole]?.[currentStatus] || [];
  return transitions.includes(newStatus);
}

// Date validation helpers
export function isValidDateRange(from: string, to: string): boolean {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  return fromDate <= toDate;
}

export function isDateInRange(date: string, from: string, to: string): boolean {
  const checkDate = new Date(date);
  const fromDate = new Date(from);
  const toDate = new Date(to);
  return checkDate >= fromDate && checkDate <= toDate;
}

// Score validation helpers
export function isValidScoreRange(score: number, min: number, max: number): boolean {
  return score >= min && score <= max;
}

export function calculateWeightedScore(
  achievementPercentage: number,
  criterionWeight: number
): number {
  const normalizedScore = achievementPercentage / 100;
  return parseFloat((normalizedScore * criterionWeight).toFixed(2));
}

// Helper function to validate weights sum to 100
export function validateWeightsSum(weights: number[]): boolean {
  const sum = weights.reduce((acc, weight) => acc + weight, 0);
  return Math.abs(sum - 100) < 0.01; // Allow for small floating point differences
}

// Helper function to validate evaluation period
export function validateEvaluationPeriod(period: string): boolean {
  const date = new Date(period);
  const today = new Date();
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(today.getFullYear() - 1);
  
  return date >= oneYearAgo && date <= today;
}

// Validation for evaluation updates
export async function validateEvaluationUpdate(input: unknown) {
  try {
    const validatedData = await evaluationInputSchema.parseAsync(input);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message
        }))
      };
    }
    return {
      success: false,
      errors: [{ path: '', message: 'Invalid input format' }]
    };
  }
}

// Self-evaluation update validation
export async function validateSelfEvaluationUpdate(input: unknown) {
  try {
    const validatedData = await selfEvaluationUpdateSchema.parseAsync(input);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message
        }))
      };
    }
    return {
      success: false,
      errors: [{ path: '', message: 'Invalid input format' }]
    };
  }
} 