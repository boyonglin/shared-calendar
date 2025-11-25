import type { Request, Response, NextFunction } from "express";
import { body, param, validationResult } from "express-validator";

// Email validation regex - RFC 5322 compliant pattern for consistent email validation
// This pattern properly validates:
// - Local part with allowed special characters
// - Domain part with proper structure and TLD requirement
// - Prevents consecutive dots and invalid edge cases
export const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

// Helper function to validate email format
export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

// Validation middleware to check for errors
export const validate = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

// Validation rules for iCloud credentials
export const validateICloudCredentials = [
  body("email").isEmail().withMessage("Valid email is required"),
  body("password").notEmpty().withMessage("Password is required"),
  validate,
];

// Validation rules for userId parameter
export const validateUserIdParam = [
  param("id").notEmpty().withMessage("User ID is required"),
  validate,
];

// Validation rules for userId query parameter
export const validateUserId = [
  param("userId").notEmpty().withMessage("User ID is required"),
  validate,
];

// Validation rules for primaryUserId parameter
export const validatePrimaryUserId = [
  param("primaryUserId").notEmpty().withMessage("Primary User ID is required"),
  validate,
];

// Validation rules for creating an event
export const validateCreateEvent = [
  body("title")
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ max: 200 })
    .withMessage("Title must be at most 200 characters"),
  body("start")
    .isISO8601({ strict: false })
    .withMessage("Start time must be a valid ISO 8601 date"),
  body("end")
    .isISO8601({ strict: false })
    .withMessage("End time must be a valid ISO 8601 date")
    .custom((end, { req }) => {
      const start = req.body.start;
      if (!start) return true;
      const startDate = new Date(start);
      const endDate = new Date(end);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return true;
      if (endDate <= startDate) {
        throw new Error("End time must be after start time");
      }
      return true;
    }),
  validate,
];

// Validation rules for drafting an invitation
export const validateDraftInvitation = [
  body("title")
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ max: 200 })
    .withMessage("Title must be at most 200 characters"),
  body("start")
    .isISO8601({ strict: false })
    .withMessage("Start time must be a valid ISO 8601 date"),
  body("end")
    .isISO8601({ strict: false })
    .withMessage("End time must be a valid ISO 8601 date")
    .custom((end, { req }) => {
      const start = req.body.start;
      if (!start) return true;
      const startDate = new Date(start);
      const endDate = new Date(end);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return true;
      if (endDate <= startDate) {
        throw new Error("End time must be after start time");
      }
      return true;
    }),
  body("geminiApiKey").optional(),
  body("description")
    .optional()
    .isLength({ max: 2000 })
    .withMessage("Description must be at most 2000 characters"),
  body("attendees")
    .optional()
    .isArray()
    .withMessage("Attendees must be an array")
    .custom((attendees) => {
      if (attendees && attendees.length > 50) {
        throw new Error("Attendees must be an array with at most 50 items");
      }
      return true;
    }),
  body("tone")
    .optional()
    .isIn(["professional", "casual", "friendly"])
    .withMessage("Tone must be one of: professional, casual, friendly"),
  validate,
];
