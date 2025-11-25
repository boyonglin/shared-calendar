import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email?: string;
  };
}

export const authenticateUser = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // Check for token in Authorization header first, then fall back to cookie
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader) {
    token = authHeader.split(" ")[1]; // Bearer <token>
  } else if (req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) {
    res.status(401).json({ error: "No token provided" });
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as {
      userId: string;
      email?: string;
    };
    (req as AuthRequest).user = decoded;
    next();
  } catch (error) {
    console.error("JWT verification error:", error);
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: "Token expired" });
    } else if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: "Malformed token" });
    } else {
      res.status(401).json({ error: "Invalid token" });
    }
  }
};
