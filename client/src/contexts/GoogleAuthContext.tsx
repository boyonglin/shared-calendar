import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { GoogleUser, GoogleCalendarEvent, GoogleAuthContextType } from '../types/google';
import { clearStoredSession } from '../utils/googleStorage';
import { GoogleSignInButton } from '../components/GoogleSignInButton';

const GoogleAuthContext = createContext<GoogleAuthContextType | undefined>(undefined);

export function GoogleAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<GoogleCalendarEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isInitialized, setIsInitialized] = useState(true); // No longer waiting for Google script
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(true); // Not needed for server flow

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authSuccess = params.get('auth');
    const userId = params.get('userId');

    if (authSuccess === 'success' && userId) {
      // Clear params from URL
      window.history.replaceState({}, '', window.location.pathname);

      // Fetch user data
      fetch(`http://localhost:3001/api/users/${userId}`)
        .then(res => res.json())
        .then(data => {
          setUser(data);
          // Also fetch events
          loadCalendarEvents(userId);
        })
        .catch(err => console.error('Failed to fetch user:', err));
    }
  }, []);

  const handleSignIn = () => {
    // Redirect to server auth endpoint
    window.location.href = 'http://localhost:3001/api/auth/google';
  };

  const signOut = () => {
    setUser(null);
    setCalendarEvents([]);
    clearStoredSession();
  };

  const loadCalendarEvents = async (userId?: string) => {
    const targetUserId = userId || user?.profile.sub; // Assuming sub is the ID
    if (!targetUserId) return;

    setIsLoadingEvents(true);
    try {
      const res = await fetch(`http://localhost:3001/api/calendar/${targetUserId}/events`);
      if (!res.ok) throw new Error('Failed to fetch events');
      const events = await res.json();
      setCalendarEvents(events);
    } catch (error) {
      console.error('Error loading calendar events:', error);
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
