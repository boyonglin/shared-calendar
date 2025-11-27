// Auto-detect API URL based on environment
function getApiBaseUrl(): string {
  // If explicitly set via environment variable, use that
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  // In production (Vercel), use relative path (same domain)
  if (import.meta.env.PROD) {
    return "";
  }

  // In development, use localhost
  return "http://localhost:3001";
}

export const API_BASE_URL = getApiBaseUrl();
