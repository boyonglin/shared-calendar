/**
 * Local development server for testing the Vercel API function
 */
import express, { type Request, type Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import type { VercelRequest, VercelResponse } from "@vercel/node";

// Load environment variables from root .env
dotenv.config({ path: "../.env" });

// Dynamic import for the handler
const loadHandler = async () => {
  const module = await import("./index.js");
  return module.default;
};

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Mock Vercel request/response adapter - handle /api and /api/*
app.all(["/api", "/api/*"], async (req: Request, res: Response) => {
  try {
    const handler = await loadHandler();

    // Convert Express req to Vercel format
    const vercelReq = req as unknown as VercelRequest;
    const vercelRes = res as unknown as VercelResponse;

    // Call the Vercel handler
    await handler(vercelReq, vercelRes);
  } catch (error) {
    console.error("Handler error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 API dev server running at http://localhost:${PORT}`);
  console.log(`📍 Test endpoints:`);
  console.log(`   GET  http://localhost:${PORT}/api`);
  console.log(`   GET  http://localhost:${PORT}/api/health`);
});
