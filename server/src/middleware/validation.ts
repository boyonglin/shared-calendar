import type { Request, Response, NextFunction } from "express";
import { body, param, validationResult } from "express-validator";

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
  body("userId").notEmpty().withMessage("User ID is required"),
  body("title").notEmpty().withMessage("Title is required"),
  body("start")
    .isISO8601()
    .withMessage("Start time must be a valid ISO 8601 date"),
  body("end").isISO8601().withMessage("End time must be a valid ISO 8601 date"),
  validate,
];
