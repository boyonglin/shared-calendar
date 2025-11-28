/**
 * Local development server for testing the Vercel API function
 */
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
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
app.all(["/api", "/api/*"], async (req, res) => {
    try {
        const handler = await loadHandler();
        // Convert Express req to Vercel format
        const vercelReq = req;
        const vercelRes = res;
        // Call the Vercel handler
        await handler(vercelReq, vercelRes);
    }
    catch (error) {
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
