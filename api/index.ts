/**
 * Vercel Serverless Function Entry Point
 *
 * "Write Once, Run Everywhere" architecture:
 * This file imports the Express app from the server package,
 * ensuring that any route added to server/src/routes automatically works on Vercel.
 *
 * All route handlers are defined once in server/src/routes/*.ts
 * and shared between local development and Vercel deployment.
 */
import dotenv from "dotenv";
dotenv.config({ path: "../.env" });

import { app } from "../server/src/app";
import { ensureDbInitialized } from "../shared/core";

// Initialize database on cold start
ensureDbInitialized().catch(console.error);

// Export the Express app as the default Vercel handler
export default app;
