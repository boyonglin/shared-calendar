/**
 * Local development server for testing the Vercel API function
 *
 * This dev server now uses the same Express app as both
 * the local server and Vercel deployment, ensuring consistency.
 */
import dotenv from "dotenv";

// Load environment variables from root .env
dotenv.config({ path: "../.env" });

import { app } from "../server/src/app.js";
import { ensureDbInitialized } from "../shared/core/index.js";

const PORT = process.env.PORT || 3001;

// Initialize database
ensureDbInitialized()
  .then(() => {
    console.log("Database initialized");
  })
  .catch(console.error);

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 API dev server running at http://localhost:${PORT}`);
  console.log(`📍 Test endpoints:`);
  console.log(`   GET  http://localhost:${PORT}/api`);
  console.log(`   GET  http://localhost:${PORT}/api/health`);
});
