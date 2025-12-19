/**
 * Local development server for testing the Vercel API function
 *
 * This dev server now uses the same Express app as both
 * the local server and Vercel deployment, ensuring consistency.
 */
import dotenv from "dotenv";

// Load environment variables from root .env
dotenv.config({ path: "../.env" });

import { app, logger } from "../server/src/app.js";
import { ensureDbInitialized } from "../shared/core/index.js";

const PORT = process.env.PORT || 3001;

// Initialize database
ensureDbInitialized()
  .then(() => {
    logger.info("Database connection established");
  })
  .catch((err) => {
    logger.error({ err }, "Failed to initialize database");
  });

// Start the server
app.listen(PORT, () => {
  logger.info({ port: PORT }, "🚀 API dev server started");
  logger.info("📍 Test endpoints:");
  logger.info(`   GET  http://localhost:${PORT}/api`);
  logger.info(`   GET  http://localhost:${PORT}/api/health`);
});
