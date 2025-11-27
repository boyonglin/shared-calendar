/**
 * Vercel Serverless Function Entry Point
 *
 * This wraps the Express server for Vercel deployment.
 * All API routes are handled by this single serverless function.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

// Dynamic import to avoid TypeScript module resolution issues
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { default: app } = await import("../server/src/vercel-app.js");
  return app(req, res);
}
