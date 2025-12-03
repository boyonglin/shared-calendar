/**
 * Shared iCloud Auth Service
 *
 * Handles iCloud CalDAV authentication and calendar operations.
 */
import { DAVClient } from "tsdav";
import * as ical from "node-ical";
import { v4 as uuidv4 } from "uuid";
import { calendarAccountRepository } from "../repositories/index.js";
import { encrypt, decrypt } from "../utils/encryption.js";
import { ICLOUD_CALDAV_URL } from "../constants/index.js";

export const icloudAuthService = {
  /**
   * Verify iCloud credentials and store in database
   */
  verifyCredentials: async (
    email: string,
    appSpecificPassword: string,
    primaryUserId?: string,
  ) => {
    const client = new DAVClient({
      serverUrl: ICLOUD_CALDAV_URL,
      credentials: {
        username: email,
        password: appSpecificPassword,
      },
      authMethod: "Basic",
      defaultAccountType: "caldav",
    });

    try {
      await client.login();
      await client.fetchCalendars();

      // Store in DB
      const userId = `icloud_${uuidv4()}`;
      const encryptedPassword = encrypt(appSpecificPassword);

      await calendarAccountRepository.upsertICloudAccount({
        userId,
        email,
        encryptedPassword,
        metadata: JSON.stringify({ name: email }),
        primaryUserId: primaryUserId || null,
      });

      return {
        success: true,
        user: {
          id: userId,
          email: email,
          name: email,
          provider: "icloud",
        },
      };
    } catch (error) {
      console.error("iCloud verification failed:", error);
      throw new Error(
        "Failed to verify iCloud credentials. Please check your Apple ID and App-Specific Password.",
      );
    }
  },

  /**
   * Get calendar events from iCloud
   */
  getCalendarEvents: async (userId: string, timeMin?: Date, timeMax?: Date) => {
    const account = await calendarAccountRepository.findByUserIdAndProvider(
      userId,
      "icloud",
    );

    if (!account) {
      throw new Error("iCloud account not found");
    }

    if (!account.encrypted_password) {
      throw new Error("iCloud account missing credentials");
    }

    let password;
    try {
      password = decrypt(account.encrypted_password);
    } catch (e) {
      console.error("Failed to decrypt password", e);
      throw new Error("Authentication error");
    }

    const client = new DAVClient({
      serverUrl: ICLOUD_CALDAV_URL,
      credentials: {
        username: account.external_email ?? undefined,
        password: password,
      },
      authMethod: "Basic",
      defaultAccountType: "caldav",
    });

    try {
      await client.login();
      const calendars = await client.fetchCalendars();

      const allEvents: Array<{
        id: string;
        summary: string;
        start: { dateTime: string };
        end: { dateTime: string };
      }> = [];

      const now = timeMin || new Date();
      const fourWeeksLater =
        timeMax || new Date(new Date().setDate(new Date().getDate() + 28));

      for (const calendar of calendars) {
        const objects = await client.fetchCalendarObjects({
          calendar,
        });

        for (const obj of objects) {
          if (obj.data) {
            try {
              const parsed = ical.sync.parseICS(obj.data);

              for (const key in parsed) {
                const event = parsed[key];
                if (event.type === "VEVENT") {
                  const startDate = event.start;
                  const endDate = event.end;

                  if (
                    startDate &&
                    startDate >= now &&
                    startDate <= fourWeeksLater
                  ) {
                    allEvents.push({
                      id: event.uid || key,
                      summary: event.summary || "Untitled Event",
                      start: { dateTime: startDate.toISOString() },
                      end: {
                        dateTime: endDate
                          ? endDate.toISOString()
                          : startDate.toISOString(),
                      },
                    });
                  }
                }
              }
            } catch (parseErr) {
              console.error("Error parsing iCloud calendar object:", parseErr);
            }
          }
        }
      }

      return allEvents;
    } catch (error) {
      console.error("Error fetching iCloud events:", error);
      if (error instanceof Error && error.message.includes("401")) {
        throw new Error("Unauthorized");
      }
      throw error;
    }
  },
};
