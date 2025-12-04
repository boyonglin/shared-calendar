# Shared Calendar Application - Test Cases

## Table of Contents

1. [Frontend UI Test Cases](#frontend-ui-test-cases)
   - [Authentication](#authentication)
   - [Calendar View](#calendar-view)
   - [User List / Team Members](#user-list--team-members)
   - [Event Creation / Invite Dialog](#event-creation--invite-dialog)
   - [Friends Manager](#friends-manager)
   - [Settings Modal](#settings-modal)
   - [User Profile Dropdown](#user-profile-dropdown)
   - [iCloud Connection](#icloud-connection)
   - [Outlook Connection](#outlook-connection)
   - [Dark Mode](#dark-mode)
   - [Event Block](#event-block)
2. [Backend API Test Cases](#backend-api-test-cases)
   - [Authentication Routes](#authentication-routes)
   - [Calendar Routes](#calendar-routes)
   - [Friends Routes](#friends-routes)
   - [User Routes](#user-routes)
   - [AI Routes](#ai-routes)
3. [Backend Storage Test Cases](#backend-storage-test-cases)
   - [Calendar Account Repository](#calendar-account-repository)
   - [User Connection Repository](#user-connection-repository)
   - [Database Operations](#database-operations)

---

## Frontend UI Test Cases

### Authentication

| ID       | Test Case                        | Steps                                                   | Expected Result                                     |
| -------- | -------------------------------- | ------------------------------------------------------- | --------------------------------------------------- |
| AUTH-001 | Google Sign-In button display    | 1. Load application without authentication              | Google Sign-In button should be visible in header   |
| AUTH-002 | Initiate Google Sign-In          | 1. Click "Sign in with Google" button                   | User should be redirected to Google OAuth page      |
| AUTH-003 | Successful Google authentication | 1. Complete Google OAuth flow                           | User profile dropdown appears with user info        |
| AUTH-004 | Sign out functionality           | 1. Sign in 2. Open profile dropdown 3. Click "Sign out" | User is signed out, Google Sign-In button reappears |
| AUTH-005 | Session persistence (PWA)        | 1. Sign in 2. Close app 3. Reopen app                   | Session should be restored automatically            |
| AUTH-006 | Auth code exchange               | 1. Complete OAuth 2. Return with auth code in URL       | Auth code is exchanged for user data                |

### Calendar View

| ID      | Test Case                            | Steps                                                      | Expected Result                                            |
| ------- | ------------------------------------ | ---------------------------------------------------------- | ---------------------------------------------------------- |
| CAL-001 | Display current week                 | 1. Load application                                        | Calendar shows current week (Mon-Sun)                      |
| CAL-002 | Navigate to previous week            | 1. Click left chevron button                               | Calendar shows previous week                               |
| CAL-003 | Navigate to next week                | 1. Click right chevron button                              | Calendar shows next week                                   |
| CAL-004 | Navigate to today                    | 1. Navigate away from current week 2. Click "Today" button | Calendar returns to current week                           |
| CAL-005 | Display week range in header         | 1. View calendar                                           | Header shows "Mon, Day - Sun, Day" format                  |
| CAL-006 | Highlight today's column             | 1. View current week                                       | Today's column has highlighted background                  |
| CAL-007 | Display time slots (6 AM - 10 PM)    | 1. View calendar                                           | Time slots from 6:00 AM to 10:00 PM visible                |
| CAL-008 | Display half-hour intervals          | 1. View calendar                                           | Time slots show 30-minute intervals                        |
| CAL-009 | Display all-day events row           | 1. View calendar                                           | All-day row visible at top                                 |
| CAL-010 | Click time slot (authenticated)      | 1. Sign in 2. Click on empty time slot                     | Invite dialog opens with selected time                     |
| CAL-011 | Click time slot (unauthenticated)    | 1. Without signing in, click time slot                     | Warning toast: "Please sign in to create calendar invites" |
| CAL-012 | Click all-day slot                   | 1. Sign in 2. Click all-day row for a date                 | Invite dialog opens with all-day option                    |
| CAL-013 | Display user events                  | 1. Sign in with calendar events                            | Events appear as colored blocks                            |
| CAL-014 | Display friend events                | 1. Have accepted friends with events 2. Select friend      | Friend's events visible with their color                   |
| CAL-015 | Display team members legend          | 1. Select multiple users                                   | Legend shows user names with colors                        |
| CAL-016 | Scroll calendar content              | 1. Scroll within calendar area                             | Time slots scroll, header stays fixed                      |
| CAL-017 | Mobile: Time indicators between rows | 1. View on mobile (<640px)                                 | Time indicators appear as separator rows                   |
| CAL-018 | Desktop: Time column on left         | 1. View on desktop (≥640px)                                | Time column visible on left side                           |

### User List / Team Members

| ID      | Test Case                               | Steps                            | Expected Result                          |
| ------- | --------------------------------------- | -------------------------------- | ---------------------------------------- |
| USR-001 | Display current user                    | 1. Sign in                       | Current user shown with "(You)" label    |
| USR-002 | Display mock users (guest mode)         | 1. View without signing in       | Mock users (Alice, Bob, Carol) displayed |
| USR-003 | Display friends                         | 1. Sign in with accepted friends | Friends appear in user list              |
| USR-004 | Toggle user visibility                  | 1. Click checkbox next to user   | User's events shown/hidden on calendar   |
| USR-005 | Current user selected by default        | 1. Sign in                       | Current user checkbox is checked         |
| USR-006 | Display user color indicator            | 1. View user list                | Each user has colored avatar             |
| USR-007 | Display user email                      | 1. View user list                | Email shown below user name              |
| USR-008 | Manage Friends button (authenticated)   | 1. Sign in                       | "Manage Friends" button visible          |
| USR-009 | Manage Friends button (unauthenticated) | 1. View without signing in       | "Manage Friends" button hidden           |
| USR-010 | Incoming request badge                  | 1. Have pending friend requests  | Orange badge shows count on button       |
| USR-011 | Click Manage Friends                    | 1. Click "Manage Friends" button | Friends Manager dialog opens             |

### Event Creation / Invite Dialog

| ID      | Test Case                        | Steps                                                   | Expected Result                              |
| ------- | -------------------------------- | ------------------------------------------------------- | -------------------------------------------- |
| INV-001 | Dialog opens with time slot info | 1. Click time slot                                      | Dialog shows date and time                   |
| INV-002 | Display all-day event info       | 1. Click all-day slot                                   | Dialog shows date with "(All day)"           |
| INV-003 | Enter event title                | 1. Type in title field                                  | Title is captured (required field)           |
| INV-004 | Enter event description          | 1. Type in description field                            | Description is captured (optional)           |
| INV-005 | Select duration (timed events)   | 1. Click time slot 2. Select duration                   | Options: 15m, 30m, 45m, 1h, 1.5h, 2h         |
| INV-006 | Duration hidden for all-day      | 1. Click all-day slot                                   | Duration selector not shown                  |
| INV-007 | Select attendees                 | 1. Check attendees checkboxes                           | Selected attendees are marked                |
| INV-008 | Submit without title             | 1. Leave title empty 2. Click "Send Invite"             | Button disabled, form not submitted          |
| INV-009 | Submit with title                | 1. Enter title 2. Click "Send Invite"                   | Event created, success toast shown           |
| INV-010 | Cancel dialog                    | 1. Click "Cancel"                                       | Dialog closes, no event created              |
| INV-011 | Close dialog (X button)          | 1. Click X or outside dialog                            | Dialog closes                                |
| INV-012 | AI Draft button display          | 1. Open invite dialog                                   | "AI Draft" button visible                    |
| INV-013 | AI Draft without title           | 1. Click "AI Draft" without title                       | Error toast: "Please enter a title first"    |
| INV-014 | AI Draft without API key         | 1. Enter title 2. Click "AI Draft" (no API key)         | Error toast with settings link               |
| INV-015 | AI Draft with valid API key      | 1. Configure API key 2. Enter title 3. Click "AI Draft" | Description populated with AI-generated text |
| INV-016 | Select tone for AI Draft         | 1. Select Professional/Casual/Friendly                  | AI draft uses selected tone                  |
| INV-017 | Mobile date format               | 1. View on mobile                                       | Date: "Fri, Dec 5, 2025 at 2:00 PM"          |
| INV-018 | Desktop date format              | 1. View on desktop                                      | Date: "Friday, December 5, 2025 at 2:00 PM"  |

### Friends Manager

| ID      | Test Case                          | Steps                                           | Expected Result                                     |
| ------- | ---------------------------------- | ----------------------------------------------- | --------------------------------------------------- |
| FRD-001 | Open Friends Manager               | 1. Click "Manage Friends"                       | Dialog opens with tabs                              |
| FRD-002 | Display three tabs                 | 1. Open Friends Manager                         | "My Friends", "Add Friend", "Requests" tabs visible |
| FRD-003 | View friends list                  | 1. Go to "My Friends" tab                       | List of friends with status badges                  |
| FRD-004 | Search friends                     | 1. Type in search field                         | Friends filtered by name or email                   |
| FRD-005 | Empty friends list message         | 1. View with no friends                         | "No friends added yet" message                      |
| FRD-006 | Friend status: Connected           | 1. View accepted friend                         | Green "Connected" badge                             |
| FRD-007 | Friend status: Pending             | 1. View requested friend                        | Orange "Pending" badge                              |
| FRD-008 | Friend status: Pending Sign up      | 1. View pending friend (not registered)         | Gray "Pending Sign up" badge                         |
| FRD-009 | Remove friend                      | 1. Click X button on friend                     | Friend removed, list updated                        |
| FRD-010 | Add friend tab                     | 1. Go to "Add Friend" tab                       | Email input and submit button shown                 |
| FRD-011 | Add friend by email                | 1. Enter valid email 2. Click "Send Invitation" | Success message, friend added to list               |
| FRD-012 | Add friend - invalid email         | 1. Enter invalid email                          | Error message displayed                             |
| FRD-013 | Add self as friend                 | 1. Enter own email                              | Error: "You cannot add yourself as a friend"        |
| FRD-014 | Add duplicate friend               | 1. Add same email twice                         | Error: "Friend request already sent"                |
| FRD-015 | View incoming requests             | 1. Go to "Requests" tab                         | List of pending requests shown                      |
| FRD-016 | Request badge count                | 1. Have incoming requests                       | Badge shows count on "Requests" tab                 |
| FRD-017 | Accept friend request              | 1. Click checkmark on request                   | Request accepted, moves to friends                  |
| FRD-018 | Reject friend request              | 1. Click X on request                           | Request removed                                     |
| FRD-019 | Empty requests message             | 1. View with no requests                        | "No pending requests" message                       |
| FRD-020 | Optimistic update - add friend     | 1. Add friend                                   | Friend appears immediately (before server response) |
| FRD-021 | Optimistic update - remove friend  | 1. Remove friend                                | Friend disappears immediately                       |
| FRD-022 | Optimistic update - accept request | 1. Accept request                               | Request moves to friends immediately                |
| FRD-023 | Rollback on error                  | 1. Add friend 2. Server returns error           | Optimistic update rolled back                       |
| FRD-024 | Initial tab based on requests      | 1. Open with pending requests                   | "Requests" tab selected by default                  |
| FRD-025 | Close dialog                       | 1. Click X or outside                           | Dialog closes, state reset                          |

### Settings Modal

| ID      | Test Case                      | Steps                                     | Expected Result                               |
| ------- | ------------------------------ | ----------------------------------------- | --------------------------------------------- |
| SET-001 | Open Settings                  | 1. Click Settings in profile dropdown     | Settings modal opens                          |
| SET-002 | Display Gemini API Key section | 1. Open Settings                          | API key input field visible                   |
| SET-003 | Save API key                   | 1. Enter API key 2. Click "Save"          | Key saved to localStorage, validation started |
| SET-004 | API key validation - valid     | 1. Save valid API key                     | Green checkmark, "API key configured"         |
| SET-005 | API key validation - invalid   | 1. Save invalid API key                   | Warning icon, saved but marked invalid        |
| SET-006 | Mask stored API key            | 1. View with stored key                   | Shows "xxxx••••••••xxxx" format               |
| SET-007 | Toggle API key visibility      | 1. Click eye icon while typing            | Password field toggles visibility             |
| SET-008 | Remove API key                 | 1. Click "Remove" button                  | Key removed from localStorage                 |
| SET-009 | Link to Google AI Studio       | 1. View without API key                   | Link to get API key shown                     |
| SET-010 | Display danger zone            | 1. Open Settings (authenticated)          | "Danger Zone" section visible                 |
| SET-011 | Delete account button          | 1. Click "Delete account"                 | Confirmation dialog opens                     |
| SET-012 | Confirm account deletion       | 1. Click "Delete account" in confirmation | Account deleted, user signed out              |
| SET-013 | Cancel account deletion        | 1. Click "Cancel" in confirmation         | Dialog closes, account unchanged              |
| SET-014 | Close Settings                 | 1. Click X or outside                     | Modal closes, state reset                     |

### User Profile Dropdown

| ID      | Test Case                   | Steps                                            | Expected Result                           |
| ------- | --------------------------- | ------------------------------------------------ | ----------------------------------------- |
| PRO-001 | Display user info           | 1. Sign in                                       | Avatar, name, email shown                 |
| PRO-002 | Open dropdown               | 1. Click profile area                            | Dropdown menu opens                       |
| PRO-003 | Reload Calendar events      | 1. Click "Reload Calendar events"                | Events refreshed, loading indicator shown |
| PRO-004 | Reload while loading        | 1. Click reload while loading                    | Button disabled                           |
| PRO-005 | Connect iCloud option       | 1. View without iCloud connected                 | "Connect iCloud Calendar" option shown    |
| PRO-006 | iCloud submenu (connected)  | 1. View with iCloud connected                    | iCloud submenu with account info          |
| PRO-007 | Change iCloud account       | 1. Open iCloud submenu 2. Click "Change account" | iCloud modal opens                        |
| PRO-008 | Remove iCloud connection    | 1. Click "Remove connection"                     | iCloud disconnected                       |
| PRO-009 | Connect Outlook option      | 1. View without Outlook connected                | "Connect Outlook Calendar" option shown   |
| PRO-010 | Outlook submenu (connected) | 1. View with Outlook connected                   | Outlook submenu with account info         |
| PRO-011 | Change Outlook account      | 1. Click "Change account"                        | Outlook OAuth flow starts                 |
| PRO-012 | Remove Outlook connection   | 1. Click "Remove connection"                     | Outlook disconnected                      |
| PRO-013 | Settings option             | 1. Click "Settings"                              | Settings modal opens                      |
| PRO-014 | Sign out option             | 1. Click "Sign out"                              | User signed out                           |

### iCloud Connection

| ID      | Test Case                            | Steps                                | Expected Result                |
| ------- | ------------------------------------ | ------------------------------------ | ------------------------------ |
| ICL-001 | Open iCloud modal                    | 1. Click "Connect iCloud Calendar"   | Modal with Apple ID form opens |
| ICL-002 | Enter Apple ID                       | 1. Type username                     | "@icloud.com" suffix shown     |
| ICL-003 | Enter App-Specific Password          | 1. Type password                     | Password masked                |
| ICL-004 | Connect with valid credentials       | 1. Enter valid credentials 2. Submit | iCloud connected, modal closes |
| ICL-005 | Connect with invalid credentials     | 1. Enter invalid credentials         | Error message displayed        |
| ICL-006 | Link to create App-Specific Password | 1. View modal                        | Link to Apple support article  |
| ICL-007 | Cancel iCloud connection             | 1. Click "Cancel"                    | Modal closes                   |
| ICL-008 | Loading state during connection      | 1. Submit credentials                | Button shows "Connecting..."   |

### Outlook Connection

| ID      | Test Case                   | Steps                               | Expected Result                       |
| ------- | --------------------------- | ----------------------------------- | ------------------------------------- |
| OUT-001 | Initiate Outlook connection | 1. Click "Connect Outlook Calendar" | Redirected to Microsoft OAuth         |
| OUT-002 | Complete Outlook OAuth      | 1. Complete OAuth flow              | Outlook connected, redirected back    |
| OUT-003 | OAuth callback handling     | 1. Return from OAuth                | Connection established, events loaded |

### Dark Mode

| ID      | Test Case                   | Steps                                | Expected Result                        |
| ------- | --------------------------- | ------------------------------------ | -------------------------------------- |
| DRK-001 | Toggle dark mode            | 1. Click moon/sun icon               | Theme switches                         |
| DRK-002 | Dark mode persistence       | 1. Enable dark mode 2. Refresh page  | Dark mode persists                     |
| DRK-003 | System preference (initial) | 1. First visit with system dark mode | Follows system preference              |
| DRK-004 | Override system preference  | 1. Toggle manually                   | Manual preference persists over system |
| DRK-005 | Dark mode button icon       | 1. View in light mode                | Moon icon shown                        |
| DRK-006 | Light mode button icon      | 1. View in dark mode                 | Sun icon shown                         |

### Event Block

| ID      | Test Case                          | Steps                                       | Expected Result                        |
| ------- | ---------------------------------- | ------------------------------------------- | -------------------------------------- |
| EVT-001 | Display own event title            | 1. View own event                           | Event title visible                    |
| EVT-002 | Display friend event as "Busy"     | 1. View friend's event                      | Shows "Busy" (privacy)                 |
| EVT-003 | Event block color                  | 1. View event                               | Block has user's assigned color        |
| EVT-004 | Mobile: Long press for tooltip     | 1. Long press on mobile (500ms)             | Tooltip appears with title/Busy        |
| EVT-005 | Mobile: Tooltip auto-dismiss       | 1. Trigger tooltip                          | Tooltip dismisses after 3 seconds      |
| EVT-006 | Mobile: Only one tooltip at a time | 1. Long press event A 2. Long press event B | Only event B tooltip visible           |
| EVT-007 | Desktop: Hover title attribute     | 1. Hover over own event on desktop          | Browser title tooltip shows event name |
| EVT-008 | Tooltip hidden on scroll           | 1. Show tooltip 2. Scroll                   | Tooltip disappears                     |
| EVT-009 | Prevent context menu on long press | 1. Long press on mobile                     | Native context menu suppressed         |

---

## Backend API Test Cases

### Authentication Routes

| ID           | Test Case                            | Endpoint                     | Method | Expected Result                           |
| ------------ | ------------------------------------ | ---------------------------- | ------ | ----------------------------------------- |
| API-AUTH-001 | Google OAuth initiation              | `/api/auth/google`           | GET    | Redirect to Google OAuth URL              |
| API-AUTH-002 | Google OAuth callback                | `/api/auth/google/callback`  | GET    | Set JWT cookie, redirect to client        |
| API-AUTH-003 | Google OAuth callback - missing code | `/api/auth/google/callback`  | GET    | 400 error: "Missing code"                 |
| API-AUTH-004 | Exchange auth code                   | `/api/auth/exchange`         | POST   | Return userId, email, provider            |
| API-AUTH-005 | Exchange invalid code                | `/api/auth/exchange`         | POST   | 400 error: "Invalid or expired code"      |
| API-AUTH-006 | Get current user                     | `/api/auth/me`               | GET    | Return user profile                       |
| API-AUTH-007 | Get current user - no auth           | `/api/auth/me`               | GET    | 401 Unauthorized                          |
| API-AUTH-008 | iCloud authentication                | `/api/auth/icloud`           | POST   | Return token and user info                |
| API-AUTH-009 | iCloud auth - invalid credentials    | `/api/auth/icloud`           | POST   | 401 error                                 |
| API-AUTH-010 | Outlook OAuth initiation             | `/api/auth/outlook`          | GET    | Redirect to OneCal OAuth                  |
| API-AUTH-011 | Outlook OAuth callback               | `/api/auth/outlook/callback` | GET    | Create/update account, redirect           |
| API-AUTH-012 | Outlook callback - invalid state     | `/api/auth/outlook/callback` | GET    | 400 error: "Invalid state"                |
| API-AUTH-013 | Logout                               | `/api/auth/logout`           | POST   | Clear JWT cookie                          |
| API-AUTH-014 | Revoke account                       | `/api/auth/revoke`           | DELETE | Delete all user data, revoke Google token |

### Calendar Routes

| ID          | Test Case                           | Endpoint                              | Method | Expected Result                     |
| ----------- | ----------------------------------- | ------------------------------------- | ------ | ----------------------------------- |
| API-CAL-001 | Get all events                      | `/api/calendar/all-events/:userId`    | GET    | Array of events from all providers  |
| API-CAL-002 | Get all events - invalid time range | `/api/calendar/all-events/:userId`    | GET    | 400 error for invalid dates         |
| API-CAL-003 | Get events (SSE streaming)          | `/api/calendar/events-stream/:userId` | GET    | SSE stream with events per provider |
| API-CAL-004 | SSE heartbeat                       | `/api/calendar/events-stream/:userId` | GET    | Heartbeat comments every 15s        |
| API-CAL-005 | SSE complete event                  | `/api/calendar/events-stream/:userId` | GET    | Final "complete" event sent         |
| API-CAL-006 | SSE timeout                         | `/api/calendar/events-stream/:userId` | GET    | Timeout after 60s                   |
| API-CAL-007 | Get specific user events            | `/api/calendar/:userId/events`        | GET    | Events for specific provider        |
| API-CAL-008 | Get events - unauthorized user      | `/api/calendar/:userId/events`        | GET    | 403 Forbidden                       |
| API-CAL-009 | Create event                        | `/api/calendar/events`                | POST   | New event created in Google         |
| API-CAL-010 | Create event - missing fields       | `/api/calendar/events`                | POST   | 400 validation error                |
| API-CAL-011 | Create all-day event                | `/api/calendar/events`                | POST   | All-day event created               |
| API-CAL-012 | Create event with attendees         | `/api/calendar/events`                | POST   | Event created, invites sent         |
| API-CAL-013 | Get iCloud status                   | `/api/calendar/icloud/status`         | GET    | Return connected status and email   |
| API-CAL-014 | Delete iCloud connection            | `/api/calendar/icloud/:userId`        | DELETE | Remove iCloud account               |
| API-CAL-015 | Get Outlook status                  | `/api/calendar/outlook/status`        | GET    | Return connected status and email   |
| API-CAL-016 | Delete Outlook connection           | `/api/calendar/outlook/:userId`       | DELETE | Remove Outlook account              |

### Friends Routes

| ID          | Test Case                        | Endpoint                         | Method | Expected Result                                 |
| ----------- | -------------------------------- | -------------------------------- | ------ | ----------------------------------------------- |
| API-FRD-001 | Add friend                       | `/api/friends`                   | POST   | Create friend connection                        |
| API-FRD-002 | Add friend - invalid email       | `/api/friends`                   | POST   | 400 error: "Invalid email format"               |
| API-FRD-003 | Add self as friend               | `/api/friends`                   | POST   | 400 error: "Cannot add yourself"                |
| API-FRD-004 | Add duplicate friend             | `/api/friends`                   | POST   | 409 Conflict                                    |
| API-FRD-005 | Add friend - user exists         | `/api/friends`                   | POST   | Status "requested", creates incoming for friend |
| API-FRD-006 | Add friend - user not exists     | `/api/friends`                   | POST   | Status "pending"                                |
| API-FRD-007 | Get friends list                 | `/api/friends`                   | GET    | Array of friends with colors                    |
| API-FRD-008 | Sync pending connections         | `/api/friends/sync-pending`      | POST   | Update pending→requested when user signs up     |
| API-FRD-009 | Delete friend                    | `/api/friends/:friendId`         | DELETE | Remove bidirectional connection                 |
| API-FRD-010 | Delete friend - not found        | `/api/friends/:friendId`         | DELETE | 404 Not Found                                   |
| API-FRD-011 | Get incoming requests            | `/api/friends/requests/incoming` | GET    | Array of incoming requests                      |
| API-FRD-012 | Accept friend request            | `/api/friends/:friendId/accept`  | POST   | Update status to accepted                       |
| API-FRD-013 | Accept - not found               | `/api/friends/:friendId/accept`  | POST   | 404 Not Found                                   |
| API-FRD-014 | Reject friend request            | `/api/friends/:friendId/reject`  | POST   | Delete both connection records                  |
| API-FRD-015 | Get friend events                | `/api/friends/:friendId/events`  | GET    | Friend's calendar events                        |
| API-FRD-016 | Get friend events - not accepted | `/api/friends/:friendId/events`  | GET    | 404 Not Found                                   |
| API-FRD-017 | Get friend events - not mutual   | `/api/friends/:friendId/events`  | GET    | 404 Not Found                                   |

### User Routes

| ID          | Test Case            | Endpoint         | Method | Expected Result     |
| ----------- | -------------------- | ---------------- | ------ | ------------------- |
| API-USR-001 | Get user by ID       | `/api/users/:id` | GET    | Return user profile |
| API-USR-002 | Get user - not found | `/api/users/:id` | GET    | 404 Not Found       |

### AI Routes

| ID         | Test Case                        | Endpoint                   | Method | Expected Result           |
| ---------- | -------------------------------- | -------------------------- | ------ | ------------------------- |
| API-AI-001 | Generate invitation draft        | `/api/ai/draft-invitation` | POST   | Return AI-generated draft |
| API-AI-002 | Generate draft - missing title   | `/api/ai/draft-invitation` | POST   | 400 validation error      |
| API-AI-003 | Generate draft - with tone       | `/api/ai/draft-invitation` | POST   | Draft in specified tone   |
| API-AI-004 | Generate draft - with attendees  | `/api/ai/draft-invitation` | POST   | Draft mentions attendees  |
| API-AI-005 | Generate draft - invalid API key | `/api/ai/draft-invitation` | POST   | Error response            |

---

## Backend Storage Test Cases

### Calendar Account Repository

| ID         | Test Case                                  | Operation                      | Expected Result                      |
| ---------- | ------------------------------------------ | ------------------------------ | ------------------------------------ |
| DB-CAL-001 | Find by user ID                            | `findByUserId`                 | Return account or undefined          |
| DB-CAL-002 | Find by user ID and provider               | `findByUserIdAndProvider`      | Return specific provider account     |
| DB-CAL-003 | Find by primary user ID                    | `findByPrimaryUserId`          | Return all linked accounts           |
| DB-CAL-004 | Find by external email                     | `findByExternalEmail`          | Case-insensitive email lookup        |
| DB-CAL-005 | Find by provider and primary user          | `findByProviderAndPrimaryUser` | Return linked provider account       |
| DB-CAL-006 | Upsert Google account - create             | `upsertGoogleAccount`          | New account created                  |
| DB-CAL-007 | Upsert Google account - update             | `upsertGoogleAccount`          | Existing account updated             |
| DB-CAL-008 | Upsert Google - preserve refresh token     | `upsertGoogleAccount`          | Null refresh token doesn't overwrite |
| DB-CAL-009 | Upsert iCloud account                      | `upsertICloudAccount`          | Create with encrypted password       |
| DB-CAL-010 | Upsert Outlook account                     | `upsertOutlookAccount`         | Create with OneCal account ID        |
| DB-CAL-011 | Update access token                        | `updateAccessToken`            | Token and timestamp updated          |
| DB-CAL-012 | Update refresh token                       | `updateRefreshToken`           | Token and timestamp updated          |
| DB-CAL-013 | Delete by user ID and provider             | `deleteByUserIdAndProvider`    | Return true if deleted               |
| DB-CAL-014 | Delete by user ID and provider - not found | `deleteByUserIdAndProvider`    | Return false                         |
| DB-CAL-015 | Find all emails by primary user            | `findAllEmailsByPrimaryUserId` | Array of normalized emails           |
| DB-CAL-016 | Delete by user ID                          | `deleteByUserId`               | Delete single account                |
| DB-CAL-017 | Delete all by primary user ID              | `deleteAllByPrimaryUserId`     | Delete account and all linked        |
| DB-CAL-018 | Health check                               | `healthCheck`                  | Return true if DB accessible         |

### User Connection Repository

| ID         | Test Case                             | Operation                                | Expected Result                |
| ---------- | ------------------------------------- | ---------------------------------------- | ------------------------------ |
| DB-CON-001 | Find by ID                            | `findById`                               | Return connection or undefined |
| DB-CON-002 | Find by ID and user ID                | `findByIdAndUserId`                      | Verify ownership               |
| DB-CON-003 | Find by ID, user ID, and status       | `findByIdUserIdAndStatus`                | Filter by status               |
| DB-CON-004 | Find by user ID and friend email      | `findByUserIdAndFriendEmail`             | Case-insensitive email         |
| DB-CON-005 | Find all by user ID                   | `findAllByUserId`                        | Exclude incoming requests      |
| DB-CON-006 | Find all by user ID - with metadata   | `findAllByUserId`                        | Include friend metadata        |
| DB-CON-007 | Find incoming requests                | `findIncomingRequests`                   | Only status='incoming'         |
| DB-CON-008 | Find pending without friend user ID   | `findPendingWithoutFriendUserId`         | For sync-pending               |
| DB-CON-009 | Find by user ID and friend user ID    | `findByUserIdAndFriendUserId`            | Optional status filter         |
| DB-CON-010 | Create connection                     | `create`                                 | Return inserted ID             |
| DB-CON-011 | Create connection - duplicate         | `create`                                 | Throw UNIQUE constraint error  |
| DB-CON-012 | Create or ignore                      | `createOrIgnore`                         | Return false if exists         |
| DB-CON-013 | Update status                         | `updateStatus`                           | Update status and timestamp    |
| DB-CON-014 | Update friend user ID and status      | `updateFriendUserIdAndStatus`            | Update both fields             |
| DB-CON-015 | Update status by user and friend user | `updateStatusByUserIdAndFriendUserId`    | Conditional update             |
| DB-CON-016 | Delete by ID                          | `deleteById`                             | Return true if deleted         |
| DB-CON-017 | Delete by user ID and friend email    | `deleteByUserIdAndFriendEmail`           | Case-insensitive               |
| DB-CON-018 | Delete by user, friend user, status   | `deleteByUserIdAndFriendUserIdAndStatus` | Conditional delete             |
| DB-CON-019 | Find pending requests by friend email | `findPendingRequestsByFriendEmail`       | For new user sign up            |
| DB-CON-020 | Delete all by user ID                 | `deleteAllByUserId`                      | Delete as user or friend       |

### Database Operations

| ID        | Test Case                       | Operation           | Expected Result              |
| --------- | ------------------------------- | ------------------- | ---------------------------- |
| DB-OP-001 | Initialize database             | `getDb`             | Schema created if not exists |
| DB-OP-002 | Concurrent initialization       | `getDb` (multiple)  | Single initialization        |
| DB-OP-003 | Create indexes                  | Schema init         | All indexes created          |
| DB-OP-004 | Health check - success          | `healthCheck`       | Return true                  |
| DB-OP-005 | Health check - connection error | `healthCheck`       | Return false                 |
| DB-OP-006 | Close database                  | `closeDb`           | Connection closed            |
| DB-OP-007 | Reopen after close              | `closeDb` → `getDb` | New connection established   |

---

## Integration Test Cases

| ID      | Test Case               | Description                               | Expected Result                          |
| ------- | ----------------------- | ----------------------------------------- | ---------------------------------------- |
| INT-001 | Full auth flow          | Sign in → Create event → Sign out         | All operations complete successfully     |
| INT-002 | Friend connection flow  | Add friend → Accept request → View events | Events visible to both users             |
| INT-003 | Multi-provider calendar | Connect Google + iCloud + Outlook         | All events aggregated correctly          |
| INT-004 | Event streaming         | Connect providers → Load calendar         | Events stream progressively              |
| INT-005 | Optimistic updates      | Add friend → Network delay → Success      | UI updates immediately, persists         |
| INT-006 | Optimistic rollback     | Add friend → Server error                 | UI reverts to previous state             |
| INT-007 | Session restore         | Sign in → Close browser → Reopen          | Session restored from JWT cookie         |
| INT-008 | Account deletion        | Delete account                            | All data removed (accounts, connections) |
| INT-009 | Dark mode persistence   | Toggle dark mode → Refresh                | Setting persists                         |
| INT-010 | API key persistence     | Save Gemini key → Refresh                 | Key available for AI features            |

---

## Error Handling Test Cases

| ID      | Test Case             | Scenario             | Expected Result                   |
| ------- | --------------------- | -------------------- | --------------------------------- |
| ERR-001 | Network timeout       | API call times out   | Error toast, graceful degradation |
| ERR-002 | 401 Unauthorized      | Token expired        | Redirect to sign in               |
| ERR-003 | 403 Forbidden         | Access denied        | Error message displayed           |
| ERR-004 | 404 Not Found         | Resource missing     | Error message displayed           |
| ERR-005 | 500 Server Error      | Internal error       | Generic error message             |
| ERR-006 | Provider auth expired | Google token revoked | "Please re-authenticate" message  |
| ERR-007 | SSE connection lost   | Network interruption | Automatic reconnection            |
| ERR-008 | Invalid form data     | Validation failure   | Field-level error messages        |

---

## Performance Test Cases

| ID       | Test Case               | Scenario              | Expected Result          |
| -------- | ----------------------- | --------------------- | ------------------------ |
| PERF-001 | Event loading time      | Load 100+ events      | < 2 seconds              |
| PERF-002 | SSE progressive loading | Load from 3 providers | First events < 1 second  |
| PERF-003 | Auto-refresh interval   | Window visible        | Refresh every 60 seconds |
| PERF-004 | Auto-refresh pause      | Window hidden         | No refresh while hidden  |
| PERF-005 | Calendar navigation     | Navigate weeks        | < 100ms response         |
| PERF-006 | Large friends list      | 50+ friends           | Smooth scrolling         |

---

## Accessibility Test Cases

| ID       | Test Case            | Scenario          | Expected Result                    |
| -------- | -------------------- | ----------------- | ---------------------------------- |
| A11Y-001 | Keyboard navigation  | Tab through app   | All interactive elements focusable |
| A11Y-002 | Screen reader labels | Use screen reader | All buttons/inputs labeled         |
| A11Y-003 | Color contrast       | Dark/light modes  | WCAG AA contrast ratios            |
| A11Y-004 | Focus indicators     | Keyboard focus    | Visible focus ring                 |
| A11Y-005 | ARIA labels          | Dialog components | Proper roles and labels            |
