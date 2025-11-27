/**
 * Vercel Serverless Function Entry Point
 *
 * This wraps the Express server for Vercel deployment.
 * All API routes are handled by this single serverless function.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import app from "../server/src/vercel-app";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Forward the request to Express
  return app(req, res);
}
