/**
 * Shared Core - Main Export
 *
 * This module provides shared functionality that works in both:
 * - Local Express development server
 * - Vercel serverless deployment
 *
 * By centralizing core logic here, we avoid code duplication
 * and ensure consistent behavior across environments.
 */

// Database
export {
  getDb,
  ensureDbInitialized,
  closeDb,
  healthCheck,
} from "./db/index.js";

// Repositories
export {
  calendarAccountRepository,
  userConnectionRepository,
  type CalendarAccount,
  type CalendarProvider,
  type CreateGoogleAccountParams,
  type CreateICloudAccountParams,
  type CreateOutlookAccountParams,
  type ConnectionStatus,
  type UserConnection,
  type UserConnectionWithMetadata,
} from "./repositories/index.js";

// Services
export {
  googleAuthService,
  icloudAuthService,
  onecalAuthService,
  aiService,
} from "./services/index.js";

// Constants
export * from "./constants/index.js";

// Utilities
export {
  encrypt,
  decrypt,
  createAuthCode,
  exchangeAuthCode,
  isValidEmail,
  parseDateParam,
  validateFriendId,
  generateFriendColor,
  extractFriendName,
  sanitizeInput,
  sanitizeOutput,
  validateTone,
  buildAIPrompt,
  sanitizeEventDetails,
} from "./utils/index.js";
