import express from "express";
import { OAuth2Client } from "google-auth-library";
import { env } from "../config/env";
import logger from "../utils/logger";
import { calendarAccountRepository } from "../../../shared/core/repositories/calendarAccountRepository";

const router = express.Router();
const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);

// Middleware to handle Content-Type: application/secevent+jwt
// This is needed because express.json() only handles application/json
// We need to read the body as text for verification
const secEventParser = express.text({ type: "application/secevent+jwt" });

router.post("/receiver", secEventParser, async (req, res) => {
  try {
    const token = req.body;

    if (!token || typeof token !== "string") {
      logger.warn("Received empty or invalid RISC token body");
      res.status(400).send("Invalid request body");
      return;
    }

    // Verify the token
    // https://developers.google.com/identity/protocols/risc#verify_the_token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new Error("Invalid payload");
    }

    // Check issuer
    if (payload.iss !== "https://accounts.google.com") {
      throw new Error("Invalid issuer");
    }

    // Handle events
    // The payload contains 'events' object where keys are event types
    // https://developers.google.com/identity/protocols/risc#event_types
    const events =
      (
        payload as unknown as {
          events: Record<string, Record<string, unknown>>;
        }
      ).events || {};

    // The subject of the event (Google User ID)
    const subject = payload.sub;
    if (!subject) {
      logger.warn("RISC event received without subject");
      res.status(400).send("Missing subject");
      return;
    }

    logger.info({ subject, events }, "Received RISC event");

    for (const eventType in events) {
      await handleEvent(eventType, subject, events[eventType]);
    }

    res.status(202).send("Accepted");
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Error processing RISC token",
    );
    res.status(400).send("Invalid token");
  }
});

async function handleEvent(
  eventType: string,
  userId: string,
  _eventData: Record<string, unknown>,
) {
  logger.info({ eventType, userId }, "Handling RISC event");

  // Note: userId here is the Google User ID (sub).
  // Our calendar_accounts table stores this in 'user_id' for Google provider.
  // We need to make sure we are matching the correct user.
  // In calendarAccountRepository, upsertGoogleAccount uses params.userId which comes from Google sub.
  // So we can directly use userId to find/delete the account.

  switch (eventType) {
    case "https://schemas.openid.net/secevent/risc/event-type/account-credential-change-required":
      // Force re-authentication
      // We'll clear the tokens to force the user to re-login
      await calendarAccountRepository.updateAccessToken(userId, "");
      await calendarAccountRepository.updateRefreshToken(userId, "");
      break;
    case "https://schemas.openid.net/secevent/risc/event-type/account-disabled":
      // Account disabled
      await calendarAccountRepository.deleteByUserId(userId);
      break;
    case "https://schemas.openid.net/secevent/risc/event-type/account-purged":
      // Account deleted
      await calendarAccountRepository.deleteByUserId(userId);
      break;
    case "https://schemas.openid.net/secevent/risc/event-type/sessions-revoked":
      // Revoke sessions
      await calendarAccountRepository.updateAccessToken(userId, "");
      await calendarAccountRepository.updateRefreshToken(userId, "");
      break;
    case "https://schemas.openid.net/secevent/risc/event-type/tokens-revoked":
      // Revoke tokens
      await calendarAccountRepository.updateAccessToken(userId, "");
      await calendarAccountRepository.updateRefreshToken(userId, "");
      break;
    case "https://schemas.openid.net/secevent/risc/event-type/verification":
      logger.info("RISC verification event received");
      break;
    default:
      logger.warn({ eventType }, "Unhandled RISC event type");
  }
}

export default router;
