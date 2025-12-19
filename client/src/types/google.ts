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
  profile: GoogleProfile;
  provider?: string;
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
  events?: GoogleCalendarEvent[];
}

// ============================================================================
// Context Types
// ============================================================================

export interface GoogleAuthContextType {
  user: GoogleUser | null;
  isRevoking: boolean;
  signIn: () => void;
  signOut: () => Promise<void>;
  revokeAccount: () => Promise<void>;
}

// ============================================================================
// Global Type Declarations
// ============================================================================

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: unknown) => void;
          prompt: () => void;
          renderButton: (element: HTMLElement, options: unknown) => void;
          disableAutoSelect: () => void;
        };
        oauth2: {
          initTokenClient: (config: unknown) => unknown;
        };
      };
    };
  }
}
