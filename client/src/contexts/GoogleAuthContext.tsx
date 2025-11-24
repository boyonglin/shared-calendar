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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authSuccess = params.get("auth");
    const userId = params.get("userId");
    const provider = params.get("provider");

    if (authSuccess === "success" && userId) {
      // Clear params from URL
      window.history.replaceState({}, "", window.location.pathname);

      // If this is an Outlook callback, don't set it as the main user
      // The Outlook connection will be detected by the useOutlookConnection hook
      if (provider === "outlook") {
        // Keep existing Google session, don't do anything
        return;
      }

      // Only fetch and set user if this is a Google login
      // Fetch user data
      authApi
        .getUser(userId)
        .then((data) => {
          // Only set user if it's a Google account
          if (!data.provider || data.provider === "google") {
            setUser(data);
            // Save session to localStorage
            if (data.idToken) {
              saveUserSession(data, data.idToken);
            }
          }
        })
        .catch(() => {
          // Silently handle error
        });
    }
  }, []);

  const handleSignIn = () => {
    // Redirect to server auth endpoint
    window.location.href = `${API_BASE_URL}/api/auth/google`;
  };

  const signOut = () => {
    setUser(null);
    clearStoredSession();
  };

  // Event fetching logic moved to CalendarContext

  return (
    <GoogleAuthContext.Provider
      value={{
        user,
        signIn: handleSignIn,
        signOut,
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
