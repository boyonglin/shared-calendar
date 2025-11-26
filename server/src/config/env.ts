import { z } from "zod";

const envSchema = z.object({
  // Server Configuration
  PORT: z.string().default("3001").transform(Number),
  CLIENT_URL: z.string().url("CLIENT_URL must be a valid URL"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .optional(),

  // Google OAuth Configuration
  GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID is required"),
  GOOGLE_CLIENT_SECRET: z.string().min(1, "GOOGLE_CLIENT_SECRET is required"),
  GOOGLE_REDIRECT_URI: z
    .string()
    .url("GOOGLE_REDIRECT_URI must be a valid URL"),

  // OneCal Configuration (for Outlook Calendar integration)
  ONECAL_APP_ID: z.string().optional(),
  ONECAL_API_KEY: z.string().optional(),

  // Gemini Configuration
  GEMINI_API_KEY: z.string().optional(),

  // Security
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters for security"),

  // Encryption (for iCloud passwords)
  ENCRYPTION_KEY: z
    .string()
    .refine(
      (key) => {
        // Accept 64 hex characters OR 32 raw bytes
        if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) return true;
        if (Buffer.from(key).length === 32) return true;
        return false;
      },
      {
        message:
          "ENCRYPTION_KEY must be exactly 32 bytes (or 64 hex characters)",
      },
    )
    .optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates and parses environment variables
 * @throws {Error} If validation fails
 */
export function validateEnv(): Env {
  try {
    const parsed = envSchema.parse(process.env);

    // Production security checks
    if (parsed.NODE_ENV === "production") {
      if (parsed.JWT_SECRET.length < 64) {
        console.warn(
          "⚠️ WARNING: JWT_SECRET should be at least 64 characters in production for optimal security.",
        );
      }
    }

    return parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.issues.map(
        (err) => `  - ${err.path.join(".")}: ${err.message}`,
      );
      console.error(
        "❌ Environment variable validation failed:\n" + missingVars.join("\n"),
      );
      throw new Error("Invalid environment variables. Check your .env file.");
    }
    throw error;
  }
}

// Export validated environment variables
export const env = validateEnv();
