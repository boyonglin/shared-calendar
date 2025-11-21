import { body, param, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to handle validation errors
 */
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      error: 'Validation failed',
      details: errors.array(),
    });
    return;
  }
  next();
};

/**
 * Validation rules for user ID parameter
 */
export const validateUserId = [
  param('userId').isString().trim().notEmpty().withMessage('User ID is required'),
  handleValidationErrors,
];

/**
 * Validation rules for primary user ID parameter
 */
export const validatePrimaryUserId = [
  param('primaryUserId').isString().trim().notEmpty().withMessage('Primary user ID is required'),
  handleValidationErrors,
];

/**
 * Validation rules for user ID in path
 */
export const validateUserIdParam = [
  param('id').isString().trim().notEmpty().withMessage('User ID is required'),
  handleValidationErrors,
];

/**
 * Validation rules for iCloud credentials
 */
export const validateICloudCredentials = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isString().notEmpty().withMessage('Password is required'),
  handleValidationErrors,
];

/**
 * Validation rules for calendar event data
 */
export const validateCalendarEvent = [
  body('title')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Title must be a string with max 255 characters'),
  body('start').isISO8601().withMessage('Start date must be a valid ISO 8601 date'),
  body('end').isISO8601().withMessage('End date must be a valid ISO 8601 date'),
  body('isAllDay').optional().isBoolean().withMessage('isAllDay must be a boolean'),
  handleValidationErrors,
];
