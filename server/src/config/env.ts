import { z } from "zod";

const envSchema = z.object({
  // Server Configuration
  PORT: z.string().default("3001").transform(Number),
  CLIENT_URL: z.string().url("CLIENT_URL must be a valid URL"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Google OAuth Configuration
  GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID is required"),
  GOOGLE_CLIENT_SECRET: z.string().min(1, "GOOGLE_CLIENT_SECRET is required"),
  GOOGLE_REDIRECT_URI: z
    .string()
    .url("GOOGLE_REDIRECT_URI must be a valid URL"),

  // OneCal Configuration (for Outlook Calendar integration)
  ONECAL_APP_ID: z.string().optional(),
  ONECAL_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates and parses environment variables
 * @throws {Error} If validation fails
 */
export function validateEnv(): Env {
  try {
    return envSchema.parse(process.env);
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
