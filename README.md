# Shared Calendar

This is a calendar sharing application with Google Calendar integration for viewing team availability and scheduling meetings.

## Stack

- **Frontend**: React + TypeScript + Vite + Tailwind + shadcn/ui
- **Backend**: Node.js + Express + SQLite (Better-SQLite3)
- **Auth**: Server-side OAuth via Google APIs (with Refresh Token support)

## Quick Start

```bash
# Install root dependencies (concurrently, etc.)
npm install

# Install client & server dependencies
npm run install:all

# Set up Environment Variables
cp client/.env.example client/.env
cp server/.env.example server/.env

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

**Note**: This app uses server-side OAuth to securely store refresh tokens in a local SQLite database (`server/shared-calendar.db`). This allows the app to maintain access to the user's calendar even after the session expires.

## Project Structure

```
/client         Frontend (React + Vite)
/server         Backend (Express - minimal)
/shared         Shared TypeScript types
```

## Features

✅ Google Calendar OAuth & integration  
✅ View your calendar events  
🚧 Create calendar invites  
🚧 Multi-user calendar sharing  
🚧 Multi-platform calendar integrations  
🚧 Cross-timezone event synchronization