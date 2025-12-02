# Shared Calendar API Documentation

Base URL:

- **Local**: `http://localhost:3001`
- **Production**: `https://shared-calendar-vibe.vercel.app`

## Overview

The Shared Calendar API provides endpoints for:

- **Authentication**: Google OAuth, iCloud CalDAV, and Outlook (via OneCal)
- **Calendar Management**: CRUD operations for calendar events
- **Friends**: Social features for sharing calendars with friends
- **AI Features**: AI-powered invitation draft generation

## Authentication

Most endpoints require authentication via JWT token stored in an HTTP-only cookie named `token`.

### How Authentication Works

1. User initiates OAuth flow via `/api/auth/google` or `/api/auth/outlook`
2. After successful OAuth, server sets HTTP-only cookie with JWT
3. Server redirects with a short-lived exchange code (not userId) for security
4. Client exchanges the code for user data via `/api/auth/exchange`
5. Subsequent requests automatically include cookie for authentication
6. JWT contains: `{ userId: string, email: string }`

---

## Auth Endpoints

### Google OAuth

#### `GET /api/auth/google`

Initiates Google OAuth flow. Redirects user to Google consent screen.

**Response**: HTTP 302 redirect to Google OAuth

---

#### `GET /api/auth/google/callback`

OAuth callback handler. Google redirects here after user consent.

**Query Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `code` | string | Yes | Authorization code from Google |

**Success Response**:

- Sets `token` cookie (HTTP-only, 30 days)
- HTTP 302 redirect to `{CLIENT_URL}?auth=success&code={authCode}`

**Error Response**: HTTP 302 redirect to `{CLIENT_URL}?auth=error`

---

#### `POST /api/auth/exchange`

Exchange a short-lived auth code for user data. This is used after OAuth callback to securely retrieve user information without exposing it in the URL.

**Request Body**:

```json
{
  "code": "short_lived_auth_code"
}
```

**Success Response** (200):

```json
{
  "userId": "google_user_id",
  "email": "user@gmail.com",
  "provider": "google"
}
```

**Error Responses**:

- `400`: Missing code or invalid/expired code

---

### iCloud Authentication

#### `POST /api/auth/icloud`

Connect iCloud calendar via CalDAV (app-specific password required).

**Authentication**: Required

**Request Body**:

```json
{
  "email": "user@icloud.com",
  "password": "xxxx-xxxx-xxxx-xxxx"
}
```

**Success Response** (200):

```json
{
  "user": {
    "id": "icloud_user_id",
    "email": "user@icloud.com"
  },
  "token": "jwt_token"
}
```

**Error Responses**:

- `400`: Invalid email or password format
- `401`: Authentication failed (wrong credentials)

---

### Outlook OAuth (via OneCal)

#### `GET /api/auth/outlook`

Initiates Outlook OAuth flow via OneCal integration.

**Authentication**: Required (must be logged in with Google first)

**Response**: HTTP 302 redirect to OneCal OAuth

---

#### `GET /api/auth/outlook/callback`

OAuth callback handler for Outlook.

**Query Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `endUserAccountId` | string | Yes | OneCal account ID |

**Success Response**: HTTP 302 redirect to `{CLIENT_URL}?auth=success&provider=outlook&code={authCode}`

**Error Response**: HTTP 400/500 with error message

---

### Account Revocation

#### `DELETE /api/auth/revoke`

Revoke Google authorization and delete all user data. This removes the user's account, all connected calendar accounts, and friend connections.

**Authentication**: Required

**Success Response** (200):

```json
{
  "success": true,
  "message": "Account successfully revoked"
}
```

**Error Responses**:

- `401`: Not authenticated
- `500`: Failed to revoke account

---

## User Endpoints

### `GET /api/users/:id`

Get user profile by ID.

**Path Parameters**:
| Name | Type | Description |
|------|------|-------------|
| `id` | string | User ID (Google sub) |

**Success Response** (200):

```json
{
  "id": "google_user_id",
  "email": "user@gmail.com",
  "name": "John Doe",
  "picture": "https://..."
}
```

**Error Responses**:

- `400`: Invalid user ID format
- `404`: User not found

---

## Calendar Endpoints

### `GET /api/calendar/all-events/:primaryUserId`

Fetch events from ALL connected calendar accounts for a user.

**Authentication**: Required

**Path Parameters**:
| Name | Type | Description |
|------|------|-------------|
| `primaryUserId` | string | Primary user ID |

**Query Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `timeMin` | ISO 8601 | No | Start of time range |
| `timeMax` | ISO 8601 | No | End of time range |

**Success Response** (200):

```json
[
  {
    "id": "event_id",
    "summary": "Meeting Title",
    "start": { "dateTime": "2025-01-15T10:00:00Z" },
    "end": { "dateTime": "2025-01-15T11:00:00Z" },
    "userId": "user_id",
    "accountType": "google",
    "accountEmail": "user@gmail.com"
  }
]
```

**Error Responses**:

- `400`: Invalid date parameter
- `401`: Not authenticated

---

### `GET /api/calendar/events-stream/:primaryUserId`

Fetch events using Server-Sent Events (SSE) for real-time streaming. Events are sent as they become available from each provider.

**Authentication**: Required

**Path Parameters**:
| Name | Type | Description |
|------|------|-------------|
| `primaryUserId` | string | Primary user ID |

**Query Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `timeMin` | ISO 8601 | No | Start of time range |
| `timeMax` | ISO 8601 | No | End of time range |

**Response**: Server-Sent Events stream

**Event Types**:

```
data: {"type": "events", "provider": "google", "events": [...]}

data: {"type": "error", "provider": "icloud", "message": "Failed to fetch events"}

data: {"type": "complete"}
```

---

### `GET /api/calendar/:userId/events`

Fetch events for a specific user account.

**Path Parameters**:
| Name | Type | Description |
|------|------|-------------|
| `userId` | string | Calendar account user ID |

**Query Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `timeMin` | ISO 8601 | No | Start of time range |
| `timeMax` | ISO 8601 | No | End of time range |

**Success Response** (200): Array of calendar events

**Error Responses**:

- `400`: Invalid parameters or unsupported provider
- `401`: Authentication expired
- `404`: User not found

---

### `POST /api/calendar/events`

Create a new calendar event.

**Authentication**: Required

**Request Body**:

```json
{
  "title": "Team Meeting",
  "description": "Weekly sync",
  "start": "2025-01-15T10:00:00Z",
  "end": "2025-01-15T11:00:00Z",
  "attendees": ["friend@example.com"],
  "isAllDay": false
}
```

**Success Response** (200):

```json
{
  "id": "created_event_id",
  "summary": "Team Meeting",
  "start": { "dateTime": "2025-01-15T10:00:00Z" },
  "end": { "dateTime": "2025-01-15T11:00:00Z" }
}
```

**Error Responses**:

- `400`: Invalid request body / Only Google calendar supported
- `401`: Not authenticated
- `404`: User not found

---

### iCloud Status & Management

#### `GET /api/calendar/icloud/status`

Check if user has iCloud connected.

**Authentication**: Required

**Success Response** (200):

```json
{
  "connected": true,
  "email": "user@icloud.com",
  "userId": "icloud_user_id"
}
```

or

```json
{
  "connected": false
}
```

---

#### `DELETE /api/calendar/icloud/:userId`

Remove iCloud connection.

**Authentication**: Required

**Path Parameters**:
| Name | Type | Description |
|------|------|-------------|
| `userId` | string | iCloud account user ID |

**Success Response** (200):

```json
{
  "success": true
}
```

**Error Responses**:

- `401`: Not authenticated

---

### Outlook Status & Management

#### `GET /api/calendar/outlook/status`

Check if user has Outlook connected.

**Authentication**: Required

**Success Response** (200):

```json
{
  "connected": true,
  "email": "user@outlook.com",
  "userId": "outlook_user_id"
}
```

or

```json
{
  "connected": false
}
```

---

#### `DELETE /api/calendar/outlook/:userId`

Remove Outlook connection.

**Authentication**: Required

**Path Parameters**:
| Name | Type | Description |
|------|------|-------------|
| `userId` | string | Outlook account user ID |

**Success Response** (200):

```json
{
  "success": true
}
```

---

## Friends Endpoints

### `POST /api/friends`

Add a friend by email (sends a friend request).

**Authentication**: Required

**Request Body**:

```json
{
  "friendEmail": "friend@example.com"
}
```

**Success Response** (201):

```json
{
  "success": true,
  "connection": {
    "id": 1,
    "userId": "your_user_id",
    "friendEmail": "friend@example.com",
    "friendUserId": "friend_user_id_or_null",
    "friendName": "Friend Name",
    "status": "requested",
    "createdAt": "2025-01-15T10:00:00Z"
  },
  "message": "Friend request sent! They need to accept it."
}
```

**Status values**:

- `pending`: Friend hasn't signed up yet
- `requested`: Request sent, waiting for acceptance
- `incoming`: Incoming request from another user
- `accepted`: Mutually accepted friendship

**Error Responses**:

- `400`: Invalid email / trying to add yourself
- `409`: Already friends / request already sent

---

### `GET /api/friends`

Get all friends for the authenticated user (excludes incoming requests).

**Authentication**: Required

**Success Response** (200):

```json
{
  "friends": [
    {
      "id": 1,
      "userId": "your_user_id",
      "friendEmail": "friend@example.com",
      "friendUserId": "friend_user_id",
      "friendName": "Friend Name",
      "friendColor": "#10b981",
      "status": "accepted",
      "createdAt": "2025-01-15T10:00:00Z"
    }
  ]
}
```

---

### `POST /api/friends/sync-pending`

Sync pending friend connections (check if pending friends have signed up).

**Authentication**: Required

**Success Response** (200):

```json
{
  "success": true,
  "message": "Synced 2 pending connections",
  "updatedCount": 2
}
```

---

### `DELETE /api/friends/:friendId`

Remove a friend (mutual removal).

**Authentication**: Required

**Path Parameters**:
| Name | Type | Description |
|------|------|-------------|
| `friendId` | number | Friend connection ID |

**Success Response** (200):

```json
{
  "success": true,
  "message": "Friend removed successfully"
}
```

**Error Responses**:

- `400`: Invalid friend ID
- `404`: Friend connection not found

---

### `GET /api/friends/requests/incoming`

Get incoming friend requests.

**Authentication**: Required

**Success Response** (200):

```json
{
  "requests": [
    {
      "id": 2,
      "userId": "your_user_id",
      "friendEmail": "requester@example.com",
      "friendUserId": "requester_user_id",
      "friendName": "Requester Name",
      "friendColor": "#f59e0b",
      "status": "incoming",
      "createdAt": "2025-01-15T10:00:00Z"
    }
  ],
  "count": 1
}
```

---

### `POST /api/friends/:friendId/accept`

Accept a friend request.

**Authentication**: Required

**Path Parameters**:
| Name | Type | Description |
|------|------|-------------|
| `friendId` | number | Friend request ID |

**Success Response** (200):

```json
{
  "success": true,
  "message": "Friend request accepted!"
}
```

**Error Responses**:

- `400`: Invalid friend ID
- `404`: Friend request not found

---

### `POST /api/friends/:friendId/reject`

Reject a friend request.

**Authentication**: Required

**Path Parameters**:
| Name | Type | Description |
|------|------|-------------|
| `friendId` | number | Friend request ID |

**Success Response** (200):

```json
{
  "success": true,
  "message": "Friend request rejected"
}
```

---

### `GET /api/friends/:friendId/events`

Get friend's calendar events (only for mutually accepted connections).

**Authentication**: Required

**Path Parameters**:
| Name | Type | Description |
|------|------|-------------|
| `friendId` | number | Friend connection ID |

**Query Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `timeMin` | ISO 8601 | No | Start of time range |
| `timeMax` | ISO 8601 | No | End of time range |

**Success Response** (200):

```json
{
  "events": [
    {
      "id": "event_id",
      "summary": "Friend's Meeting",
      "start": { "dateTime": "2025-01-15T10:00:00Z" },
      "end": { "dateTime": "2025-01-15T11:00:00Z" },
      "userId": "friend_user_id",
      "friendConnectionId": 1
    }
  ],
  "errors": []
}
```

**Error Responses**:

- `400`: Invalid parameters
- `404`: Friend not found or connection not mutually accepted

---

## AI Endpoints

### `POST /api/ai/draft-invitation`

Generate an AI-powered invitation draft for a calendar event.

**Authentication**: Required

**Request Body**:

```json
{
  "title": "Team Planning Session",
  "description": "Quarterly planning meeting",
  "start": "2025-01-15T10:00:00Z",
  "end": "2025-01-15T11:00:00Z",
  "attendees": ["Alice", "Bob"],
  "location": "Conference Room A",
  "tone": "professional",
  "geminiApiKey": "your_gemini_api_key"
}
```

**Tone options**: `professional`, `casual`, `friendly`

**Success Response** (200):

```json
{
  "draft": "Dear Team,\n\nI'd like to invite you to our Team Planning Session scheduled for January 15th, 2025, from 10:00 AM to 11:00 AM in Conference Room A.\n\n..."
}
```

**Error Responses**:

- `400`: Invalid request body / Invalid API key format / Invalid datetime format
- `401`: Not authenticated
- `500`: AI generation failed

---

## Utility Endpoints

### `GET /api/health`

Health check endpoint (no rate limiting).

**Success Response** (200):

```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:00:00.000Z"
}
```

**Degraded Response** (503):

```json
{
  "status": "degraded",
  "timestamp": "2025-01-15T10:00:00.000Z"
}
```

---

### `GET /api/privacy`

Redirects to the privacy policy page.

**Response**: HTTP 301 redirect to privacy policy URL

---

### `GET /api`

Root API endpoint with version and available endpoints.

**Success Response** (200):

```json
{
  "message": "Shared Calendar API",
  "version": "1.0.0",
  "endpoints": ["GET /api/health", "GET /api/auth/google", "..."]
}
```

---

## Error Response Format

All error responses follow this format:

```json
{
  "error": "Human-readable error message"
}
```

Common HTTP status codes:

- `400`: Bad Request (invalid input)
- `401`: Unauthorized (not authenticated)
- `404`: Not Found
- `405`: Method Not Allowed
- `409`: Conflict (duplicate resource)
- `429`: Too Many Requests (rate limited)
- `500`: Internal Server Error
- `503`: Service Unavailable (database issues)

---

## Environment Variables

Required environment variables for the server:

| Variable               | Description                                                                 |
| ---------------------- | --------------------------------------------------------------------------- |
| `PORT`                 | Server port (default: 3001)                                                 |
| `CLIENT_URL`           | Frontend URL for CORS and redirects                                         |
| `NODE_ENV`             | `development` \| `production` \| `test`                                     |
| `GOOGLE_CLIENT_ID`     | Google OAuth client ID                                                      |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret                                                  |
| `GOOGLE_REDIRECT_URI`  | Google OAuth callback URL                                                   |
| `JWT_SECRET`           | Secret for signing JWTs (min 32 chars)                                      |
| `ENCRYPTION_KEY`       | 32-byte key for encrypting iCloud passwords                                 |
| `ONECAL_APP_ID`        | OneCal app ID (for Outlook)                                                 |
| `ONECAL_API_KEY`       | OneCal API key (for Outlook)                                                |
| `GEMINI_API_KEY`       | Google Gemini API key (for AI features) - optional, can be user-provided    |
| `LOG_LEVEL`            | Logging level: `fatal` \| `error` \| `warn` \| `info` \| `debug` \| `trace` |
