# Shared Calendar

A calendar sharing application with Google Calendar and iCloud Calendar integration for viewing team availability and scheduling meetings.

## Stack

- **Frontend**: React + TypeScript + Vite + Tailwind + shadcn/ui
- **Backend**: Node.js + Express + SQLite (Better-SQLite3)
- **Auth**: Server-side OAuth via Google APIs (with Refresh Token support)
- **Security**: Helmet, Rate Limiting, Input Validation, Environment Variable Validation

## Development with Pixi

This project uses [Pixi](https://prefix.dev/) for environment management and task execution.

### Prerequisites

- [Pixi](https://prefix.dev/) installed.

### Commands

- **Install Dependencies**: `pixi run install`
- **Build for Production**: `pixi run build`
- **Start Development Server**: `pixi run dev`
- **Lint Code**: `pixi run lint`
- **Format Code**: `pixi run format`

### Project Structure

- `client/`: React frontend
- `server/`: Express backend
- `shared/`: Shared types and utilities

# Configure server/.env with your Google Credentials
# GOOGLE_CLIENT_ID=...
# GOOGLE_CLIENT_SECRET=...

# Start dev servers
npm run dev
# → Client: http://localhost:5173
# → Server: http://localhost:3001
```

## Google OAuth Setup

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Create **OAuth 2.0 Client ID** (Web application)
   - **Authorized JavaScript origins**: `http://localhost:5173`
   - **Authorized redirect URIs**: `http://localhost:3001/api/auth/google/callback`
3. Enable **Google Calendar API** in APIs & Services
4. Configure OAuth consent screen
   - Add your account as a test user
   - Required scopes: `.../auth/userinfo.profile`, `.../auth/userinfo.email`, `.../auth/calendar.readonly`, `.../auth/calendar.events`
5. Copy **Client ID** and **Client Secret** → `server/.env`

**Note**: This app uses server-side OAuth to securely store refresh tokens in a local SQLite database (`server/shared-calendar.db`). This allows the app to maintain access to your calendar even after the session expires.

## iCloud Calendar Setup

1. Go to [Apple ID Account Settings](https://appleid.apple.com/)
2. Sign in with your Apple ID
3. Navigate to **Security** → **App-Specific Passwords**
4. Generate a new app-specific password for this application
5. Use your iCloud email and the generated password when connecting in the app

**Important**: Use an app-specific password, not your regular Apple ID password.

## Project Structure

```
/client         Frontend (React + Vite)
/server         Backend (Express + SQLite)
  /src
    /config       Environment configuration with Zod validation
    /middleware   Security & validation middleware
    /routes       API routes (auth, calendar)
    /services     Calendar providers (Google, iCloud)
/shared         Shared TypeScript types
```

## Features

✅ Google Calendar OAuth & integration  
✅ iCloud Calendar integration (via CalDAV)  
✅ View events from multiple calendar accounts  
✅ Filter calendar view by team members  
🚧 Create calendar invites  
🚧 Multi-user calendar sharing  
🚧 Cross-timezone event synchronization

## Security Features

- **Helmet**: Content Security Policy, XSS protection
- **Rate Limiting**: API endpoint protection (100 req/15min, auth: 50 req/15min)
- **Input Validation**: express-validator on all API endpoints
- **Environment Validation**: Zod schema validation on startup
- **Password Encryption**: AES-256-CBC encryption for iCloud credentials
- **Error Boundaries**: Graceful error handling in React