/**
 * Vercel Serverless Function Entry Point
 * 
 * Minimal API endpoint for testing Vercel + Turso integration.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@libsql/client";

// Initialize Turso client
function getTursoClient() {
  if (!process.env.TURSO_DATABASE_URL) {
    throw new Error("TURSO_DATABASE_URL is not set");
  }
  return createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Extract the path from the URL
  const path = req.url?.split("?")[0] || "/api";

  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // Health check endpoint
    if (path === "/api/health" || path === "/api/health/") {
      const client = getTursoClient();
      await client.execute("SELECT 1");

      return res.status(200).json({
        status: "ok",
        timestamp: new Date().toISOString(),
        environment: "vercel",
        node_version: process.version,
        checks: {
          database: "ok",
        },
      });
    }

    // Root API endpoint
    if (path === "/api" || path === "/api/") {
      return res.status(200).json({
        message: "Shared Calendar API",
        version: "1.0.0",
        status: "running",
        environment: "vercel",
        endpoints: ["/api/health"],
      });
    }

    // 404 for other paths
    return res.status(404).json({
      error: "Not found",
      path: path,
    });
  } catch (error) {
    console.error("API Error:", error);
    return res.status(500).json({
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });
  }
}
