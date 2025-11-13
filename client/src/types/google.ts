// ============================================================================
// Google API Types
// ============================================================================

export interface GoogleProfile {
  email: string;
  name: string;
  picture?: string;
  sub: string;
}

export interface GoogleUser {
  idToken: string;
  profile: GoogleProfile;
}

export interface GoogleCalendarEvent {
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

// ============================================================================
// Storage Types
// ============================================================================

export interface StoredSession {
  user: GoogleUser;
  accessToken: string;
  events?: GoogleCalendarEvent[];
}

// ============================================================================
// Context Types
// ============================================================================

export interface GoogleAuthContextType {
  user: GoogleUser | null;
  calendarEvents: GoogleCalendarEvent[];
  isLoadingEvents: boolean;
  isGoogleLoaded: boolean;
  signIn: () => void;
  signOut: () => void;
  loadCalendarEvents: () => void;
}

// ============================================================================
// Global Type Declarations
// ============================================================================

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
