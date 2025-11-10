# Shared Calendar — React OAuth Demo

This is a minimal Vite + React demo app to test signing in with Google using the Google Identity Services (client-side).

What it does
- Shows a Google Sign-in button (client-side).
- When signed in, the app decodes the ID token (JWT) and displays basic profile information.

Setup

1. Create credentials in Google Cloud Console
   - Go to APIs & Services → Credentials → Create Credentials → OAuth client ID
   - Choose "Web application"
   - Add an Authorized JavaScript origin: `http://localhost:5173`
   - For development you can leave Authorized redirect URIs blank when using the client-side Google Identity button.
   - Copy the Client ID.

2. In this folder (`web-react/`) create a `.env` file and add your client id:

```
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

3. Install and run

```powershell
cd web-react
npm install
npm run dev
```

4. Open `http://localhost:5173` in your browser and click the Sign in button.

Notes
- For scopes beyond basic profile info (e.g., Google Calendar API access), you'll need to request additional scopes and obtain access tokens, and likely add a server-side component to securely store refresh tokens. This demo only demonstrates authentication and profile retrieval via the ID token.
- If you plan to use OAuth scopes that require verification (sensitive scopes), configure the OAuth consent screen and add your account as a test user while in testing mode.
