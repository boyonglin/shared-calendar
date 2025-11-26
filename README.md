# Shared Calendar

A calendar sharing application with Google Calendar, iCloud Calendar, and Outlook Calendar integration for viewing team availability and scheduling meetings.

## Stack

- **Frontend**: React + TypeScript + Vite + Tailwind + shadcn/ui
- **Backend**: Node.js + Express + SQLite
- **Auth**: Server-side OAuth via Google APIs

### Prerequisites

- [Pixi](https://prefix.dev/) installed.

### Commands

- **Install Dependencies**: `pixi run install`
- **Build for Production**: `pixi run build`
- **Start Development Server**: `pixi run dev`
- **Format Code**: `pixi run format`
- **Lint Code**: `pixi run lint`

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

## Outlook Calendar Setup

1. Sign up for [OneCal](https://onecalunified.com/) to get API credentials
2. Create a new app in the OneCal dashboard
3. Copy the **App ID** and **API Key**
4. Add these to `server/.env`:
   ```
   ONECAL_APP_ID=your_app_id
   ONECAL_API_KEY=your_api_key
   ```
5. Connect your Microsoft/Outlook account in the app interface

**Note**: OneCal provides a unified API for accessing Microsoft/Outlook calendars with OAuth support.

## Project Structure

```
/client         Frontend (React + Vite)
/server         Backend (Express + SQLite)
  /src
    /config       Environment configuration with Zod validation
    /db           Database schema and migrations
    /middleware   Security & validation middleware
    /routes       API routes (auth, calendar, friends, ai)
    /services     Calendar providers (Google, iCloud, Outlook)
    /utils        Utilities (logging, calendar helpers)
  API.md          📖 Complete API documentation
/shared         Shared TypeScript types
```

## API Documentation

See [`server/API.md`](./server/API.md) for complete API documentation including:

- All endpoints with request/response examples
- Authentication flow
- Rate limiting details
- Error response formats

## Features

✅ Google & iCloud & Outlook Calendar integrations  
✅ Filter calendar view by team members  
✅ Create calendar invites  
✅ AI calendar assistants: draft invitations  
✅ Multi-user calendar sharing  
✅ Cross-timezone event synchronization  
🚧 AI calendar assistants: scheduling conflicts, suggest optimal times
