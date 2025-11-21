import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { GoogleUser, GoogleAuthContextType } from '../types/google';
import { clearStoredSession } from '../utils/googleStorage';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { authApi } from '../services/api/auth';
import { API_BASE_URL } from '../config/api';

const GoogleAuthContext = createContext<GoogleAuthContextType | undefined>(undefined);

export function GoogleAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<GoogleUser | null>(null);
  // const [calendarEvents, setCalendarEvents] = useState<GoogleCalendarEvent[]>([]);
  // const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  // const [isInitialized, setIsInitialized] = useState(true); // No longer waiting for Google script
  // const [isGoogleLoaded, setIsGoogleLoaded] = useState(true); // Not needed for server flow
  const isInitialized = true;
  const isGoogleLoaded = true;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authSuccess = params.get('auth');
    const userId = params.get('userId');

    if (authSuccess === 'success' && userId) {
      // Clear params from URL
      window.history.replaceState({}, '', window.location.pathname);

      // Fetch user data
      authApi
        .getUser(userId)
        .then((data) => {
          setUser(data);
          // Also fetch events
          // Also fetch events
          // loadCalendarEvents(userId); // Moved to CalendarContext
        })
        .catch((err) => console.error('Failed to fetch user:', err));
    }
  }, []);

  const handleSignIn = () => {
    // Redirect to server auth endpoint
    window.location.href = `${API_BASE_URL}/api/auth/google`;
  };

  const signOut = () => {
    setUser(null);
    // setCalendarEvents([]);
    clearStoredSession();
  };

  // Event fetching logic moved to CalendarContext

  return (
    <GoogleAuthContext.Provider
      value={{
        user,
        // calendarEvents,
        // isLoadingEvents,
        isGoogleLoaded,
        signIn: handleSignIn,
        signOut,
        // loadCalendarEvents
      }}
    >
      <GoogleSignInButton
        isInitialized={isInitialized}
        isSignedIn={!!user}
        onSignIn={handleSignIn}
      />
      {children}
    </GoogleAuthContext.Provider>
  );
}

export function useGoogleAuth() {
  const context = useContext(GoogleAuthContext);
  if (context === undefined) {
    throw new Error('useGoogleAuth must be used within a GoogleAuthProvider');
  }
  return context;
}
