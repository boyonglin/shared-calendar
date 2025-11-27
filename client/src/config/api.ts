// Auto-detect API URL based on environment
function getApiBaseUrl(): string {
  // If explicitly set via environment variable, use that
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  // Check if running on Vercel or production domain
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    // If not localhost, use same origin (empty string for relative URLs)
    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
      return "";
    }
  }

  // In development, use localhost
  return "http://localhost:3001";
}

export const API_BASE_URL = getApiBaseUrl();
