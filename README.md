# Shared Calendar

A modern, full-stack calendar sharing application that integrates with Google Calendar, iCloud Calendar, and Outlook Calendar. Designed for teams and individuals to view shared availability, manage friend connections, and schedule meetings with AI-powered assistance.

![Node.js](https://img.shields.io/badge/Node.js-24.x-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
![React](https://img.shields.io/badge/React-18.x-61dafb)
![License](https://img.shields.io/badge/License-MIT-yellow)

## ✨ Features

### Calendar Integration

- **Multi-Provider Support**: Connect Google Calendar, iCloud Calendar, and Outlook Calendar simultaneously
- **Unified View**: View all your calendars and friends' calendars in a single weekly view
- **Event Creation**: Create calendar invites directly from the app with attendee selection
- **Cross-Timezone Support**: Events are properly synchronized across different timezones

### Social Features

- **Friend System**: Add friends by email and share calendar availability
- **Friend Requests**: Send, receive, accept, or reject friend requests
- **Privacy-Focused**: Only mutually accepted friends can view each other's calendars
- **Team Collaboration**: Filter calendar view by team members

### AI-Powered Assistant

- **Smart Invitation Drafts**: Generate professional, casual, or friendly invitation messages using Google Gemini AI
- **Customizable Tone**: Choose between professional, casual, and friendly tones for your invitations
- **Secure Input Handling**: Built-in sanitization to prevent prompt injection attacks

### User Experience

- **Progressive Web App (PWA)**: Install as a native app on desktop or mobile
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- **Real-Time Updates**: Automatic calendar refresh and event synchronization
- **Toast Notifications**: Instant feedback for all user actions

---

## 🛠️ Tech Stack

| Layer        | Technologies                                                                  |
| ------------ | ----------------------------------------------------------------------------- |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, Radix UI, Lucide Icons   |
| **Backend**  | Node.js 24, Express 5, TypeScript, SQLite (libSQL)                            |
| **Auth**     | Server-side OAuth 2.0 (Google), CalDAV (iCloud), OneCal API (Outlook), JWT    |
| **AI**       | Google Gemini API (gemini-flash-latest)                                       |
| **Tooling**  | Pixi (package management), ESLint, Prettier, Zod (validation), Pino (logging) |
| **PWA**      | Vite PWA Plugin, Workbox                                                      |

---

## 🚀 Getting Started

### Prerequisites

- [Pixi](https://prefix.dev/) package manager installed
- Node.js 24.x (automatically managed by Pixi)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/boyonglin/shared-calendar.git
cd shared-calendar

# Install all dependencies
pixi run install

# Start development server (frontend + backend)
pixi run dev
```

The app will be available at:

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001

### Available Commands

| Command            | Description                                 |
| ------------------ | ------------------------------------------- |
| `pixi run install` | Install all dependencies                    |
| `pixi run build`   | Build both client and server for production |
| `pixi run format`  | Format code with Prettier                   |
| `pixi run lint`    | Lint code with ESLint                       |
| `pixi run dev`     | Start both frontend and backend dev servers |

---

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
PORT=3001
CLIENT_URL=http://localhost:5173
NODE_ENV=development
LOG_LEVEL=info

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/google/callback

# OneCal - Outlook Integration
ONECAL_APP_ID=your_onecal_app_id
ONECAL_API_KEY=your_onecal_api_key

# Security
JWT_SECRET=your_jwt_secret_min_32_chars_64_for_production
ENCRYPTION_KEY=your_32_byte_encryption_key_or_64_hex_chars
```

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Create **OAuth 2.0 Client ID** (Web application):
   - **Authorized JavaScript origins**: `http://localhost:5173`
   - **Authorized redirect URIs**: `http://localhost:3001/api/auth/google/callback`
3. Enable **Google Calendar API** in APIs & Services → Library
4. Configure OAuth consent screen:
   - Add your account as a test user
   - Required scopes:
     - `.../auth/userinfo.profile`
     - `.../auth/userinfo.email`
     - `.../auth/calendar.readonly`
     - `.../auth/calendar.events`
5. Copy **Client ID** and **Client Secret** to your `.env` file

> **Note**: This app uses server-side OAuth to securely store refresh tokens in a local SQLite database (`server/shared-calendar.db`), maintaining calendar access across sessions.

### iCloud Calendar Setup

1. Go to [Apple ID Account Settings](https://appleid.apple.com/)
2. Sign in with your Apple ID
3. Navigate to **Sign-In and Security** → **App-Specific Passwords**
4. Generate a new app-specific password for this application
5. Use your iCloud email and the generated password when connecting in the app

> **Important**: Always use an app-specific password, not your regular Apple ID password.

### Outlook Calendar Setup (via OneCal)

1. Sign up for [OneCal](https://onecalunified.com/) to get API credentials
2. Create a new app in the OneCal dashboard
3. Copy the **App ID** and **API Key** to your `.env` file
4. Connect your Microsoft/Outlook account through the app interface

---

## 📁 Project Structure

```
shared-calendar/
├── client/                 # Frontend (React + Vite + Tailwind)
├── server/                 # Backend (Express + SQLite)
│   └── API.md              # 📖 Complete API documentation
├── shared/                 # Shared TypeScript types
├── api/                    # Vercel serverless functions
├── pixi.toml               # Pixi configuration
└── package.json            # Root package (npm workspaces)
```

---

## 📚 API Documentation

See [`server/API.md`](./server/API.md) for complete API documentation including:

- **Authentication**: Google OAuth, iCloud CalDAV, Outlook (OneCal) endpoints
- **Calendar Management**: CRUD operations for calendar events
- **Friends**: Social features for sharing calendars
- **AI Features**: Invitation draft generation
- **Request/Response Examples**: Full examples for all endpoints
- **Error Handling**: Standard error response formats

---

## 🔒 Security

- **Server-side OAuth**: Tokens are stored securely on the server, never exposed to the client
- **JWT Authentication**: HTTP-only cookies with configurable expiration
- **Encrypted Storage**: iCloud passwords encrypted with AES-256-GCM
- **Input Validation**: Zod schemas for all API inputs
- **CORS Protection**: Strict origin validation
- **Helmet Security Headers**: HTTP security headers enabled
- **Rate Limiting**: Built-in protection against abuse
- **AI Prompt Sanitization**: Protection against prompt injection attacks

---

## 🗺️ Roadmap

### Completed

- ✅ Google, iCloud, and Outlook Calendar integrations
- ✅ Filter calendar view by team members
- ✅ Create calendar invites with attendee selection
- ✅ AI-powered invitation draft generation
- ✅ Multi-user calendar sharing with friend system
- ✅ Cross-timezone event synchronization
- ✅ Progressive Web App (PWA) support

### In Progress

- 🚧 User interface: dark theme
- 🚧 AI calendar assistant: scheduling conflicts, suggest optimal times

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [shadcn/ui](https://ui.shadcn.com/) for the beautiful UI components
- [Radix UI](https://www.radix-ui.com/) for accessible component primitives
- [Lucide](https://lucide.dev/) for the icon set
- [Google Gemini](https://ai.google.dev/) for AI capabilities
- [OneCal](https://onecalunified.com/) for Outlook Calendar integration
