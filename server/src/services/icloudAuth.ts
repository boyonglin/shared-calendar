import { DAVClient } from "tsdav";
import { db } from "../db";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import * as ical from "node-ical";
import { env } from "../config/env";

const IV_LENGTH = 16;

// Get encryption key from validated environment
const getEncryptionKey = (): Buffer => {
  const encryptionKey = env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error(
      "ENCRYPTION_KEY is required for iCloud integration. Please set it in your environment.",
    );
  }

  // If the key is a hex string (64 characters), decode it
  if (encryptionKey.length === 64 && /^[0-9a-fA-F]+$/.test(encryptionKey)) {
    return Buffer.from(encryptionKey, "hex");
  }

  // Otherwise treat as raw string
  return Buffer.from(encryptionKey);
};

const encrypt = (text: string): string => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", getEncryptionKey(), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
};

const decrypt = (text: string): string => {
  const textParts = text.split(":");
  const iv = Buffer.from(textParts.shift()!, "hex");
  const encryptedText = Buffer.from(textParts.join(":"), "hex");
  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    getEncryptionKey(),
    iv,
  );
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
};

export const icloudAuthService = {
  verifyCredentials: async (
    email: string,
    appSpecificPassword: string,
    primaryUserId?: string,
  ) => {
    const client = new DAVClient({
      serverUrl: "https://caldav.icloud.com",
      credentials: {
        username: email,
        password: appSpecificPassword,
      },
      authMethod: "Basic",
      defaultAccountType: "caldav",
    });

    try {
      await client.login();
      const calendars = await client.fetchCalendars();

      if (calendars.length === 0) {
        // It's possible to have 0 calendars but valid auth, but usually there's at least one.
        // Let's assume valid if login didn't throw.
      }

      // Store in DB
      const userId = uuidv4(); // Generate a new ID for this connection
      const encryptedPassword = encrypt(appSpecificPassword);

      const stmt = db.prepare(`
                INSERT INTO calendar_accounts (
                    user_id, provider, external_email, access_token, refresh_token, metadata, primary_user_id, updated_at
                ) VALUES (?, 'icloud', ?, ?, NULL, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(user_id) DO UPDATE SET
                    access_token = excluded.access_token,
                    primary_user_id = excluded.primary_user_id,
                    updated_at = CURRENT_TIMESTAMP
            `);

      // We store the encrypted password in access_token field
      stmt.run(
        userId,
        email,
        encryptedPassword,
        JSON.stringify({ name: email }), // iCloud doesn't give us a name easily, use email
        primaryUserId || null,
      );

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

  getCalendarEvents: async (userId: string, timeMin?: Date, timeMax?: Date) => {
    const stmt = db.prepare(
      "SELECT * FROM calendar_accounts WHERE user_id = ? AND provider = 'icloud'",
    );
    const account = stmt.get(userId) as
      | { user_id: string; access_token: string; external_email: string }
      | undefined;

    if (!account) {
      throw new Error("iCloud account not found");
    }

    let password;
    try {
      password = decrypt(account.access_token);
    } catch (e) {
      console.error("Failed to decrypt password", e);
      throw new Error("Authentication error");
    }

    const client = new DAVClient({
      serverUrl: "https://caldav.icloud.com",
      credentials: {
        username: account.external_email,
        password: password,
      },
      authMethod: "Basic",
      defaultAccountType: "caldav",
    });

    try {
      await client.login();
      const calendars = await client.fetchCalendars();

      const allEvents = [];
      // Use provided dates or default to now + 4 weeks
      const now = timeMin || new Date();
      const fourWeeksLater =
        timeMax || new Date(new Date().setDate(new Date().getDate() + 28));

      for (const calendar of calendars) {
        // Fetch calendar objects from this calendar
        const objects = await client.fetchCalendarObjects({
          calendar,
        });

        for (const obj of objects) {
          if (obj.data) {
            // obj.data contains the iCal string, parse it with node-ical
            const parsed = ical.parseICS(obj.data);

            for (const key in parsed) {
              const event = parsed[key];
              if (event.type === "VEVENT") {
                const startDate = event.start;
                const endDate = event.end;

                // Filter to only events within our time range
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
          }
        }
      }

      return allEvents;
    } catch (error) {
      console.error("Error fetching iCloud events:", error);
      if (error instanceof Error && error.message.includes("401")) {
        throw new Error("Unauthorized"); // Signal to frontend to re-auth
      }
      throw error;
    }
  },
};
