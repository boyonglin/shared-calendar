/**
 * Email Service - Gmail SMTP via Nodemailer
 *
 * Uses Gmail SMTP for sending notification emails.
 * Requires Gmail App Password for authentication.
 * See: https://support.google.com/accounts/answer/185833
 *
 * Important for Vercel: Always `await` the sendMail call to ensure
 * the email is sent before the serverless function terminates.
 * See: https://vercel.com/kb/guide/serverless-functions-and-smtp
 */
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { createServiceLogger } from "../utils/logger.js";

const logger = createServiceLogger("email");

// Email configuration interface
interface EmailConfig {
  user: string;
  appPassword: string;
}

// Email sending options
interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

// Result of email operation
interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Email template content
interface EmailTemplateContent {
  heading: string;
  personName: string;
  personEmail: string;
  bodyText: string;
  gifUrl: string;
  footerText?: string; // Optional custom footer text
  ctaButton?: {
    // Optional call-to-action button
    text: string;
    url: string;
  };
}

// GIF collections for different notification types
const NOTIFICATION_GIFS = {
  friendRequest: [
    "https://media0.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif", // Cat Working
    "https://media1.giphy.com/media/HYpZKsyLOn1ks/giphy.gif", // Cat Hello
  ],
  friendAccepted: [
    "https://media4.giphy.com/media/yoJC2GnSClbPOkV0eA/giphy.gif", // Excited Happy Birthday
    "https://media3.giphy.com/media/ZJPSFNLmADueHvzoZ8/giphy.gif", // Party Raccoon
  ],
  inviteToJoin: [
    "https://media2.giphy.com/media/dejnMJxTg72pY9ConE/giphy.gif", // Good Morning Hello
    "https://media1.giphy.com/media/fHr6SanEdFx8LBF4Dv/giphy.gif", // Best Friends Love
  ],
} as const;

/**
 * Get a random gif URL from a collection
 */
function getRandomGif(collection: readonly string[]): string {
  return collection[Math.floor(Math.random() * collection.length)];
}

/**
 * Escape HTML special characters to prevent XSS attacks
 * Used for user-provided data in email templates
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Sanitize string for plain text and subject lines
 * Removes newline characters that could inject additional headers
 */
function sanitizeText(str: string): string {
  return str.replace(/[\r\n]/g, " ").trim();
}

/**
 * Build HTML email from template content
 */
function buildEmailHtml(content: EmailTemplateContent): string {
  const footerText =
    content.footerText ?? "You can now see each other's calendar availability.";

  const ctaHtml = content.ctaButton
    ? `<a href="${escapeHtml(content.ctaButton.url)}" style="display: inline-block; background: #1a1a1a; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-size: 16px; margin-top: 16px;">${escapeHtml(content.ctaButton.text)}</a>`
    : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; max-width: 500px; margin: 0 auto; padding: 40px 20px; background: #fafafa;">
  <div style="background: #fff; padding: 40px; border-radius: 4px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="vertical-align: top;">
          <h1 style="font-size: 22px; font-weight: normal; margin: 0 0 8px 0; line-height: 1.3;">${content.heading}</h1>
          <p style="color: #666; font-size: 12px; margin: 0 0 24px 0; text-transform: uppercase; letter-spacing: 1px;">Shared Calendar</p>
        </td>
        <td style="vertical-align: top; text-align: right; width: 120px;">
          <img src="${content.gifUrl}" alt="" style="width: 100px; height: 100px; object-fit: cover; border-radius: 4px;">
        </td>
      </tr>
    </table>
    <p style="font-size: 16px; line-height: 1.6; margin: 24px 0 16px 0;">
      <strong>${content.personName}</strong> (${content.personEmail}) ${content.bodyText}
    </p>
    <p style="font-size: 14px; line-height: 1.6; color: #555; margin: 0;">
      ${escapeHtml(footerText)}
    </p>
    ${ctaHtml}
  </div>
</body>
</html>
  `.trim();
}

/**
 * Email Service Class
 * Handles sending emails via Gmail SMTP using nodemailer
 */
class EmailService {
  private transporter: Transporter | null = null;
  private config: EmailConfig | null = null;

  /**
   * Initialize the email service with Gmail credentials
   * Call this once during app startup if email functionality is needed
   */
  initialize(config: EmailConfig): void {
    this.config = config;

    // Create reusable transporter using Gmail SMTP
    // Gmail SMTP uses port 465 with SSL
    this.transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true, // use SSL
      auth: {
        user: config.user,
        pass: config.appPassword,
      },
    });

    logger.info("Email service initialized with Gmail SMTP");
  }

  /**
   * Check if email service is configured and ready
   */
  isConfigured(): boolean {
    return this.transporter !== null && this.config !== null;
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Send an email
   * @param options - Email options (to, subject, text, html)
   * @returns Promise with result of the operation
   */
  async sendEmail(options: SendEmailOptions): Promise<EmailResult> {
    if (!this.transporter || !this.config) {
      logger.warn(
        "Email service not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD environment variables.",
      );
      return {
        success: false,
        error: "Email service not configured",
      };
    }

    // Validate recipient email
    if (!this.isValidEmail(options.to)) {
      logger.warn({ to: options.to }, "Invalid recipient email address");
      return {
        success: false,
        error: "Invalid recipient email address",
      };
    }

    try {
      const info = await this.transporter.sendMail({
        from: `"Shared Calendar" <${this.config.user}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      logger.info({ messageId: info.messageId }, "Email sent successfully");
      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error({ error: errorMessage }, "Failed to send email");
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Send friend request notification email
   */
  async sendFriendRequestNotification(
    recipientEmail: string,
    senderName: string,
    senderEmail: string,
  ): Promise<EmailResult> {
    // Sanitize user-provided data
    const safeSenderName = escapeHtml(sanitizeText(senderName));
    const safeSenderEmail = escapeHtml(sanitizeText(senderEmail));

    const subject = `${sanitizeText(senderName)} wants to connect on Shared Calendar`;
    const gifUrl = getRandomGif(NOTIFICATION_GIFS.friendRequest);

    const text = `
New Friend Request

${sanitizeText(senderName)} (${sanitizeText(senderEmail)}) wants to connect with you on Shared Calendar.

Log in to accept or decline.

- Shared Calendar Team
    `.trim();

    const html = buildEmailHtml({
      heading: "New friend request",
      personName: safeSenderName,
      personEmail: safeSenderEmail,
      bodyText: "wants to connect with you.",
      gifUrl,
      footerText: "Log in to accept or decline this request.",
    });

    return this.sendEmail({
      to: recipientEmail,
      subject,
      text,
      html,
    });
  }

  /**
   * Send notification when friend request is accepted
   */
  async sendFriendRequestAcceptedNotification(
    recipientEmail: string,
    accepterName: string,
    accepterEmail: string,
  ): Promise<EmailResult> {
    // Sanitize user-provided data
    const safeAccepterName = escapeHtml(sanitizeText(accepterName));
    const safeAccepterEmail = escapeHtml(sanitizeText(accepterEmail));

    const subject = `${sanitizeText(accepterName)} accepted your friend request`;
    const gifUrl = getRandomGif(NOTIFICATION_GIFS.friendAccepted);

    const text = `
Friend Request Accepted!

${sanitizeText(accepterName)} (${sanitizeText(accepterEmail)}) accepted your friend request on Shared Calendar.

You can now see each other's calendar availability.

- Shared Calendar Team
    `.trim();

    const html = buildEmailHtml({
      heading: "You're now connected!",
      personName: safeAccepterName,
      personEmail: safeAccepterEmail,
      bodyText: "accepted your request.",
      gifUrl,
    });

    return this.sendEmail({
      to: recipientEmail,
      subject,
      text,
      html,
    });
  }

  /**
   * Send invitation email to someone who hasn't signed up yet
   */
  async sendInviteToJoin(
    recipientEmail: string,
    inviterName: string,
    inviterEmail: string,
    appUrl: string = "https://shared-calendar-vibe.vercel.app",
  ): Promise<EmailResult> {
    // Sanitize user-provided data
    const safeInviterName = escapeHtml(sanitizeText(inviterName));
    const safeInviterEmail = escapeHtml(sanitizeText(inviterEmail));
    const safeAppUrl = escapeHtml(sanitizeText(appUrl));

    const subject = `${sanitizeText(inviterName)} invited you to Shared Calendar`;
    const gifUrl = getRandomGif(NOTIFICATION_GIFS.inviteToJoin);

    const text = `
You've been invited!

${sanitizeText(inviterName)} (${sanitizeText(inviterEmail)}) wants to share their calendar with you on Shared Calendar.

Join now to see each other's availability and schedule meetings effortlessly.

Sign up here: ${appUrl}

- Shared Calendar Team
    `.trim();

    const html = buildEmailHtml({
      heading: "You're invited!",
      personName: safeInviterName,
      personEmail: safeInviterEmail,
      bodyText: "wants to share their calendar with you.",
      gifUrl,
      footerText:
        "Join to see each other's availability and schedule meetings effortlessly.",
      ctaButton: {
        text: "Join Now",
        url: safeAppUrl,
      },
    });

    return this.sendEmail({
      to: recipientEmail,
      subject,
      text,
      html,
    });
  }

  /**
   * Verify the SMTP connection is working
   * Useful for testing configuration
   */
  async verifyConnection(): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      logger.info("Email service connection verified");
      return true;
    } catch (error) {
      logger.error({ error }, "Email service verification failed");
      return false;
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();
