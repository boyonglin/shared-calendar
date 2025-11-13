import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

interface GoogleProfile {
  email: string;
  name: string;
  picture?: string;
  sub: string;
}

interface GoogleUser {
  idToken: string;
  profile: GoogleProfile;
}

interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  start?: {
    dateTime?: string;
    date?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
  };
}

interface GoogleAuthContextType {
  user: GoogleUser | null;
  calendarEvents: GoogleCalendarEvent[];
  isLoadingEvents: boolean;
  isGoogleLoaded: boolean;
  signIn: () => void;
  signOut: () => void;
  loadCalendarEvents: () => void;
}

const GoogleAuthContext = createContext<GoogleAuthContextType | undefined>(undefined);

// LocalStorage keys
const STORAGE_KEYS = {
  USER: 'google_user',
  ACCESS_TOKEN: 'google_access_token',
  TOKEN_EXPIRY: 'google_token_expiry',
  CALENDAR_EVENTS: 'google_calendar_events',
};

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
    const savedUser = localStorage.getItem(STORAGE_KEYS.USER);
    const savedToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    const savedExpiry = localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);
    const savedEvents = localStorage.getItem(STORAGE_KEYS.CALENDAR_EVENTS);

    if (savedUser && savedToken && savedExpiry) {
      const expiryTime = parseInt(savedExpiry, 10);
      const now = Date.now();

      // Check if token is still valid (with 5-minute buffer)
      if (now < expiryTime - 5 * 60 * 1000) {
        setUser(JSON.parse(savedUser));
        accessTokenRef.current = savedToken;
        
        if (savedEvents) {
          setCalendarEvents(JSON.parse(savedEvents));
        }
        
        console.log('Session restored from localStorage');
      } else {
        // Token expired, clear storage
        clearStoredSession();
        console.log('Stored token expired, cleared session');
      }
    }
  }, []);

  // Persist user session to localStorage
  useEffect(() => {
    if (user && accessTokenRef.current) {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessTokenRef.current);
      // Google access tokens typically expire in 1 hour
      const expiryTime = Date.now() + 60 * 60 * 1000;
      localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, expiryTime.toString());
    }
  }, [user]);

  // Persist calendar events to localStorage
  useEffect(() => {
    if (calendarEvents.length > 0) {
      localStorage.setItem(STORAGE_KEYS.CALENDAR_EVENTS, JSON.stringify(calendarEvents));
    }
  }, [calendarEvents]);

  const clearStoredSession = () => {
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRY);
    localStorage.removeItem(STORAGE_KEYS.CALENDAR_EVENTS);
  };

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
      }, 100);

      // Cleanup after 10 seconds
      setTimeout(() => clearInterval(interval), 10000);

      return () => clearInterval(interval);
    }
  }, []);

  const initializeGoogle = () => {
    if (!window.google || !CLIENT_ID) return;

    // Prepare OAuth2 token client that handles both sign-in and calendar access
    tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: 'openid profile email https://www.googleapis.com/auth/calendar.readonly',
      callback: (tokenResponse: any) => {
        if (tokenResponse.error) {
          console.error('Token error', tokenResponse);
          setIsLoadingEvents(false);
          return;
        }
        accessTokenRef.current = tokenResponse.access_token;
        
        // Fetch user profile
        fetchUserProfile(tokenResponse.access_token);
        
        // Fetch calendar events
        fetchCalendarEvents(tokenResponse.access_token);
      }
    });

    setIsInitialized(true);
  };

  async function fetchUserProfile(accessToken: string) {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      if (!res.ok) {
        throw new Error('Failed to fetch user profile');
      }

      const profile = await res.json();
      setUser({ 
        idToken: accessToken, 
        profile: {
          email: profile.email,
          name: profile.name,
          picture: profile.picture,
          sub: profile.id
        }
      });
    } catch (e) {
      console.error('Error fetching user profile:', e);
    }
  }

  // Render the button when initialized and not signed in
  useEffect(() => {
    if (!isInitialized || user || !window.google || !tokenClientRef.current) return;
    
    const buttonDiv = document.getElementById('g_id_onload_signin');
    if (buttonDiv) {
      // Clear any existing content
      buttonDiv.innerHTML = '';
      
      // Create a custom button that triggers OAuth flow
      const button = document.createElement('button');
      button.className = 'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2';
      button.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 48 48">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          <path fill="none" d="M0 0h48v48H0z"/>
        </svg>
        Sign in with Google
      `;
      button.onclick = () => {
        setIsLoadingEvents(true);
        tokenClientRef.current.requestAccessToken({ prompt: 'consent' });
      };
      buttonDiv.appendChild(button);
    }
  }, [isInitialized, user]);

  async function fetchCalendarEvents(accessToken: string) {
    try {
      const timeMin = new Date().toISOString();
      const timeMax = new Date();
      timeMax.setDate(timeMax.getDate() + 30); // Next 30 days
      const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
        timeMin
      )}&timeMax=${encodeURIComponent(
        timeMax.toISOString()
      )}&singleEvents=true&orderBy=startTime&maxResults=100`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Calendar API error: ${res.status} ${text}`);
      }

      const data = await res.json();
      setCalendarEvents(data.items || []);
    } catch (e) {
      console.error(e);
      alert('Failed to fetch calendar events: ' + (e as Error).message);
    } finally {
      setIsLoadingEvents(false);
    }
  }

  const signIn = () => {
    if (!tokenClientRef.current) {
      alert('Google Sign-In not initialized');
      return;
    }
    setIsLoadingEvents(true);
    tokenClientRef.current.requestAccessToken({ prompt: 'consent' });
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

  const loadCalendarEvents = () => {
    if (!accessTokenRef.current) {
      // If no token, trigger sign-in which will also load calendar
      signIn();
      return;
    }
    // If already have token, just fetch calendar
    setIsLoadingEvents(true);
    fetchCalendarEvents(accessTokenRef.current);
  };

  return (
    <GoogleAuthContext.Provider
      value={{
        user,
        calendarEvents,
        isLoadingEvents,
        isGoogleLoaded,
        signIn,
        signOut,
        loadCalendarEvents
      }}
    >
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

// Add type declarations for Google Identity Services
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          prompt: () => void;
          renderButton: (element: HTMLElement, options: any) => void;
          disableAutoSelect: () => void;
        };
        oauth2: {
          initTokenClient: (config: any) => any;
        };
      };
    };
  }
}
