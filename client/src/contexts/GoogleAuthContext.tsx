import type { ReactNode } from "react";
import { createContext, useContext, useState, useEffect } from "react";
import type { GoogleUser, GoogleAuthContextType } from "../types/google";
import {
  clearStoredSession,
  restoreSession,
  saveUserSession,
} from "../utils/googleStorage";
import { authApi } from "@/services/api/auth";
import { API_BASE_URL } from "@/config/api";

const GoogleAuthContext = createContext<GoogleAuthContextType | undefined>(
  undefined,
);

export function GoogleAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<GoogleUser | null>(() => {
    const storedSession = restoreSession();
    return storedSession ? storedSession.user : null;
  });
  const [isRevoking, setIsRevoking] = useState(false);

  // Verify session on app startup using JWT cookie
  useEffect(() => {
    const verifySession = async () => {
      // Skip if we're handling an OAuth callback
      const params = new URLSearchParams(window.location.search);
      if (params.get("auth")) {
        return;
      }

      // Only verify with server if we have a stored session to check
      // This avoids unnecessary 401 errors when not signed in
      const storedSession = restoreSession();
      if (!storedSession) {
        return;
      }

      try {
        // Try to verify session with server using JWT cookie
        const userData = await authApi.me();
        if (userData?.id) {
          const restoredUser: GoogleUser = {
            profile: {
              sub: userData.id,
              email: userData.email || "",
              name: userData.name || userData.email || "User",
              picture: userData.picture,
            },
            provider: "google",
          };
          setUser(restoredUser);
          saveUserSession(restoredUser);
        }
      } catch {
        // JWT cookie is invalid or expired - clear local session
        clearStoredSession();
        setUser(null);
      }
    };

    verifySession();
  }, []);

  useEffect(() => {
    const handleAuthCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const authSuccess = params.get("auth");
      const authCode = params.get("code");
      const provider = params.get("provider");

      if (authSuccess === "success" && authCode) {
        // Clear params from URL immediately
        window.history.replaceState({}, "", window.location.pathname);

        // JWT token is now stored in HTTP-only cookie by the server

        // If this is an Outlook callback, don't set it as the main user
        // The Outlook connection will be detected by the useOutlookConnection hook
        if (provider === "outlook") {
          // Keep existing Google session, don't do anything
          return;
        }

        try {
          // Exchange the auth code for user data
          const exchangeData = await authApi.exchangeCode(authCode);

          // Only proceed if it's a Google account
          if (exchangeData.provider !== "google") {
            return;
          }

          // Fetch full user profile
          const data = await authApi.getUser(exchangeData.userId);

          if (data) {
            setUser(data);
            // Save session to localStorage (tokens managed by HTTP-only cookies)
            saveUserSession(data);
          }
        } catch {
          // Silently handle error - code may be expired or invalid
        }
      }
    };

    handleAuthCallback();
  }, []);

  const handleSignIn = () => {
    // Redirect to server auth endpoint
    window.location.href = `${API_BASE_URL}/api/auth/google`;
  };

  const signOut = async () => {
    try {
      // Call server to clear the HTTP-only JWT cookie
      await authApi.logout();
    } catch (error) {
      console.error("Failed to logout from server:", error);
    }
    setUser(null);
    clearStoredSession();
  };

  const revokeAccount = async () => {
    setIsRevoking(true);
    try {
      await authApi.revokeAccount();
      setUser(null);
      clearStoredSession();
    } catch (error) {
      console.error("Failed to revoke account:", error);
      throw error;
    } finally {
      setIsRevoking(false);
    }
  };

  // Event fetching logic moved to CalendarContext

  return (
    <GoogleAuthContext.Provider
      value={{
        user,
        isRevoking,
        signIn: handleSignIn,
        signOut,
        revokeAccount,
      }}
    >
      {children}
    </GoogleAuthContext.Provider>
  );
}

export function useGoogleAuth() {
  const context = useContext(GoogleAuthContext);
  if (context === undefined) {
    throw new Error("useGoogleAuth must be used within a GoogleAuthProvider");
  }
  return context;
}
