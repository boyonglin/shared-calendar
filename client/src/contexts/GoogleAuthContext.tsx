import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { GoogleUser, GoogleCalendarEvent, GoogleAuthContextType } from '../types/google';
import { GOOGLE_OAUTH_SCOPE, GOOGLE_LOAD_CHECK_INTERVAL_MS, GOOGLE_LOAD_TIMEOUT_MS } from '../constants/google';
import { restoreSession, saveUserSession, saveCalendarEvents, clearStoredSession } from '../utils/googleStorage';
import { fetchUserProfile, fetchCalendarEvents } from '../services/googleApi';
import { GoogleSignInButton } from '../components/GoogleSignInButton';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

const GoogleAuthContext = createContext<GoogleAuthContextType | undefined>(undefined);

export function GoogleAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<GoogleCalendarEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);
  const tokenClientRef = useRef<any>(null);
  const accessTokenRef = useRef<string | null>(null);

  // Restore session from localStorage on mount
  useEffect(() => {
    const session = restoreSession();

    if (session) {
      setUser(session.user);
      accessTokenRef.current = session.accessToken;

      if (session.events) {
        setCalendarEvents(session.events);
      }

      console.log('Session restored from localStorage');
    } else {
      console.log('No valid session found or token expired');
    }
  }, []);

  // Persist user session to localStorage
  useEffect(() => {
    if (user && accessTokenRef.current) {
      saveUserSession(user, accessTokenRef.current);
    }
  }, [user]);

  // Persist calendar events to localStorage
  useEffect(() => {
    if (calendarEvents.length > 0) {
      saveCalendarEvents(calendarEvents);
    }
  }, [calendarEvents]);

  useEffect(() => {
    // Wait for Google script to load
    const checkGoogleLoaded = () => {
      if (window.google?.accounts?.id) {
        setIsGoogleLoaded(true);
        return true;
      }
      return false;
    };

    if (checkGoogleLoaded()) {
      initializeGoogle();
    } else {
      // Poll for Google to load
      const interval = setInterval(() => {
        if (checkGoogleLoaded()) {
          clearInterval(interval);
          initializeGoogle();
        }
      }, GOOGLE_LOAD_CHECK_INTERVAL_MS);

      // Cleanup after 10 seconds
      setTimeout(() => clearInterval(interval), GOOGLE_LOAD_TIMEOUT_MS);

      return () => clearInterval(interval);
    }
  }, []);

  const initializeGoogle = () => {
    if (!window.google || !CLIENT_ID) return;

    // Prepare OAuth2 token client that handles both sign-in and calendar access
    tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: GOOGLE_OAUTH_SCOPE,
      callback: async (tokenResponse: any) => {
        if (tokenResponse.error) {
          console.error('Token error', tokenResponse);
          setIsLoadingEvents(false);
          return;
        }
        accessTokenRef.current = tokenResponse.access_token;

        // Fetch user profile and calendar events
        try {
          const userProfile = await fetchUserProfile(tokenResponse.access_token);
          setUser(userProfile);

          const events = await fetchCalendarEvents(tokenResponse.access_token);
          setCalendarEvents(events);
        } catch (error) {
          console.error('Error fetching Google data:', error);
          alert('Failed to load Google data: ' + (error as Error).message);
        } finally {
          setIsLoadingEvents(false);
        }
      }
    });

    setIsInitialized(true);
  };

  const handleSignIn = () => {
    setIsLoadingEvents(true);
    tokenClientRef.current?.requestAccessToken({ prompt: 'consent' });
  };

  const signOut = () => {
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
    }
    setUser(null);
    setCalendarEvents([]);
    accessTokenRef.current = null;
    clearStoredSession();
  };

  const loadCalendarEvents = async () => {
    if (!accessTokenRef.current) {
      // If no token, trigger sign-in which will also load calendar
      handleSignIn();
      return;
    }
    // If already have token, just fetch calendar
    setIsLoadingEvents(true);
    try {
      const events = await fetchCalendarEvents(accessTokenRef.current);
      setCalendarEvents(events);
    } catch (error) {
      console.error('Error loading calendar events:', error);
      alert('Failed to fetch calendar events: ' + (error as Error).message);
    } finally {
      setIsLoadingEvents(false);
    }
  };

  return (
    <GoogleAuthContext.Provider
      value={{
        user,
        calendarEvents,
        isLoadingEvents,
        isGoogleLoaded,
        signIn: handleSignIn,
        signOut,
        loadCalendarEvents
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
