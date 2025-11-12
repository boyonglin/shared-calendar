import { useEffect, useState, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'

// Read client ID from Vite env var
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

function decodeJwtResponse(token) {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(function (c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        })
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch (e) {
    return null
  }
}

export default function App() {
  const [user, setUser] = useState(null)
  const [events, setEvents] = useState([])
  const tokenClientRef = useRef(null)
  const accessTokenRef = useRef(null)
  const calendarRef = useRef(null)

  useEffect(() => {
    if (!window.google) return
    if (!CLIENT_ID) {
      console.warn('VITE_GOOGLE_CLIENT_ID not set in env')
      return
    }

    // initialize the Google Identity Services for Sign-In (ID token)
    window.google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: (response) => {
        const payload = decodeJwtResponse(response.credential)
        setUser({ idToken: response.credential, profile: payload })
      }
    })

    // Render the button into our placeholder
    window.google.accounts.id.renderButton(
      document.getElementById('g_id_signin'),
      { theme: 'outline', size: 'large' }
    )

    // Prepare an OAuth2 token client for requesting Calendar access tokens
    tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/calendar.readonly',
      callback: (tokenResponse) => {
        if (tokenResponse.error) {
          console.error('Token error', tokenResponse)
          return
        }
        accessTokenRef.current = tokenResponse.access_token
        fetchCalendarEvents(tokenResponse.access_token)
      }
    })
  }, [])

  async function fetchCalendarEvents(accessToken) {
    try {
      const timeMin = new Date().toISOString()
      const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
        timeMin
      )}&singleEvents=true&orderBy=startTime&maxResults=50`

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Calendar API error: ${res.status} ${text}`)
      }

      const data = await res.json()
      // store raw events
      setEvents(data.items || [])
    } catch (e) {
      console.error(e)
      alert('Failed to fetch calendar events: ' + e.message)
    }
  }

  function requestCalendarAccess() {
    if (!tokenClientRef.current) {
      alert('OAuth token client not initialized')
      return
    }
    // Request an access token. This will prompt the user if necessary.
    tokenClientRef.current.requestAccessToken({ prompt: 'consent' })
  }

  function signOut() {
    if (window.google && window.google.accounts && window.google.accounts.id) {
      window.google.accounts.id.disableAutoSelect()
    }
    setUser(null)
    setEvents([])
    accessTokenRef.current = null
  }

  return (
    <div className="container">
      <h1>Shared Calendar — Google OAuth Demo</h1>

      {!CLIENT_ID && (
        <div className="warning">
          VITE_GOOGLE_CLIENT_ID is not set. See README in web-react/ for setup steps.
        </div>
      )}

      {!user && (
        <div>
          <p>Click to sign in with Google:</p>
          <div id="g_id_signin"></div>
        </div>
      )}

      {user && (
        <div>
          <p>Signed in as <strong>{user.profile?.email}</strong></p>
          <pre className="payload">{JSON.stringify(user.profile, null, 2)}</pre>
          <div style={{ marginTop: 12 }}>
            <button onClick={requestCalendarAccess}>Load my Calendar events</button>
            <button style={{ marginLeft: 8 }} onClick={signOut}>Sign out</button>
          </div>

          <div style={{ marginTop: 18 }}>
            <h3>Upcoming events</h3>
            <div className="events-list">
              {events.length === 0 && <div className="empty">No events loaded yet.</div>}
              {events.map((ev) => {
                const start = ev.start?.dateTime || ev.start?.date || ''
                const isAllDay = !!ev.start?.date && !ev.start?.dateTime
                return (
                  <div
                    className="event-item"
                    key={ev.id}
                    onClick={() => {
                      // jump calendar to date
                      try {
                        const api = calendarRef.current?.getApi()
                        if (api && start) api.gotoDate(start)
                      } catch (e) {
                        // ignore
                      }
                    }}
                  >
                    <div className="event-title">{ev.summary || '(no title)'}</div>
                    <div className="event-meta">{isAllDay ? 'All day • ' + (ev.start?.date || '') : start}</div>
                  </div>
                )
              })}
            </div>

            <div className="calendar-wrapper">
              <FullCalendar
                ref={calendarRef}
                plugins={[dayGridPlugin, timeGridPlugin]}
                initialView="timeGridWeek"
                headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
                events={events.map((ev) => ({
                  id: ev.id,
                  title: ev.summary || '(no title)',
                  start: ev.start?.dateTime || ev.start?.date,
                  end: ev.end?.dateTime || ev.end?.date,
                  allDay: !!ev.start?.date && !ev.start?.dateTime
                }))}
                height={650}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
