// =============================================================================
// User Types
// =============================================================================

export interface User {
  id: string;
  name: string;
  email: string;
  color: string;
}

// =============================================================================
// Calendar Types
// =============================================================================

/** Supported calendar providers */
export type CalendarProvider = "google" | "icloud" | "outlook";

export interface CalendarEvent {
  id: string;
  userId: string;
  start: Date;
  end: Date;
  title?: string;
  isAllDay?: boolean;
  description?: string;
  location?: string;
  /** Source provider for the event */
  provider?: CalendarProvider;
  /** For friend events, the connection ID */
  friendConnectionId?: number;
  /**
   * Original timezone of the event (IANA format, e.g., "America/New_York")
   * Used for cross-timezone event display
   */
  originalTimezone?: string;
}

export interface TimeSlot {
  date: Date;
  hour: number;
  minute?: number;
  isAllDay?: boolean;
}

/** Information about a connected calendar account */
export interface CalendarAccountInfo {
  userId: string;
  provider: CalendarProvider;
  email: string | null;
  isPrimary: boolean;
}

// =============================================================================
// Friend/Connection Types
// =============================================================================

export type ConnectionStatus =
  | "pending"
  | "accepted"
  | "incoming"
  | "requested";

export interface UserConnection {
  id: number;
  userId: string;
  friendEmail: string;
  friendUserId?: string;
  friendName?: string;
  status: ConnectionStatus;
  createdAt: string;
}

/** Friend with computed color for display */
export interface FriendWithColor extends UserConnection {
  friendColor: string;
}

/** Incoming friend request for display */
export interface FriendRequest {
  id: number;
  userId: string;
  friendEmail: string;
  friendUserId: string | null;
  friendName: string;
  friendColor: string;
  status: "incoming";
  createdAt: string;
}

// =============================================================================
// API Response Types
// =============================================================================

/** Standard API error response */
export interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
}

/** Standard API success response wrapper */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

/** Paginated API response */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// =============================================================================
// Auth Types
// =============================================================================

/** Authentication state */
export type AuthState = "authenticated" | "unauthenticated" | "loading";

/** JWT payload structure */
export interface JwtPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

/** Provider connection status response */
export interface ProviderConnectionStatus {
  connected: boolean;
  email?: string;
  userId?: string;
}

// =============================================================================
// Health Check Types
// =============================================================================

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  database: {
    connected: boolean;
  };
}
