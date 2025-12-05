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

// Requested gif - for friend request notifications
const REQUESTED_GIFS = [
  "https://media0.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif", // Cat Working
  "https://media1.giphy.com/media/HYpZKsyLOn1ks/giphy.gif", // Cat Hello
];

// Accepted gif - for friend request accepted notifications
const ACCEPTED_GIFS = [
  "https://media4.giphy.com/media/yoJC2GnSClbPOkV0eA/giphy.gif", // Excited Happy Birthday
  "https://media3.giphy.com/media/ZJPSFNLmADueHvzoZ8/giphy.gif", // Party Raccoon
];

/**
 * Get a random gif URL for friend request emails
 */
function getRandomRequestedGif(): string {
  return REQUESTED_GIFS[Math.floor(Math.random() * REQUESTED_GIFS.length)];
}

/**
 * Get a random gif URL for accepted emails
 */
function getRandomAcceptedGif(): string {
  return ACCEPTED_GIFS[Math.floor(Math.random() * ACCEPTED_GIFS.length)];
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
 * Sanitize string for use in email subject to prevent SMTP header injection
 * Removes newline characters that could inject additional headers
 */
function sanitizeForSubject(str: string): string {
  return str.replace(/[\r\n]/g, " ").trim();
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
  }

  /**
   * Check if email service is configured and ready
   */
  isConfigured(): boolean {
    return this.transporter !== null && this.config !== null;
  }

  /**
   * Send an email
   * @param options - Email options (to, subject, text, html)
   * @returns Promise with result of the operation
   */
  async sendEmail(options: SendEmailOptions): Promise<EmailResult> {
    if (!this.transporter || !this.config) {
      console.warn(
        "Email service not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD environment variables.",
      );
      return {
        success: false,
        error: "Email service not configured",
      };
    }

    try {
      // IMPORTANT: Always await in serverless functions
      // This ensures the email is sent before the function terminates
      const info = await this.transporter.sendMail({
        from: `"Shared Calendar" <${this.config.user}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      console.log("Email sent successfully:", info.messageId);
      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Failed to send email:", errorMessage);
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
    // Escape user-provided data to prevent XSS
    const safeSenderName = escapeHtml(senderName);
    const safeSenderEmail = escapeHtml(senderEmail);

    const subject = `${sanitizeForSubject(senderName)} wants to connect on Shared Calendar`;
    const gifUrl = getRandomRequestedGif();

    const text = `
New Friend Request

${senderName} (${senderEmail}) wants to connect with you on Shared Calendar.

Log in to accept or decline.

- Shared Calendar Team
    `.trim();

    const html = `
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
          <h1 style="font-size: 22px; font-weight: normal; margin: 0 0 8px 0; line-height: 1.3;">New friend request</h1>
          <p style="color: #666; font-size: 12px; margin: 0 0 24px 0; text-transform: uppercase; letter-spacing: 1px;">Shared Calendar</p>
        </td>
        <td style="vertical-align: top; text-align: right; width: 120px;">
          <img src="${gifUrl}" alt="" style="width: 100px; height: 100px; object-fit: cover; border-radius: 4px;">
        </td>
      </tr>
    </table>
    <p style="font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
      <strong>${safeSenderName}</strong> (${safeSenderEmail}) wants to connect with you.
    </p>
    <p style="font-size: 14px; line-height: 1.6; color: #555; margin: 0 0 24px 0;">
      Once connected, you'll see each other's calendar availability.
    </p>
    <p style="font-size: 13px; color: #888; margin: 0;">
      Log in to your account to respond.
    </p>
  </div>
</body>
</html>
    `.trim();

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
    // Escape user-provided data to prevent XSS
    const safeAccepterName = escapeHtml(accepterName);
    const safeAccepterEmail = escapeHtml(accepterEmail);

    const subject = `${sanitizeForSubject(accepterName)} accepted your friend request`;
    const gifUrl = getRandomAcceptedGif();

    const text = `
Friend Request Accepted!

${accepterName} (${accepterEmail}) accepted your friend request on Shared Calendar.

You can now see each other's calendar availability.

- Shared Calendar Team
    `.trim();

    const html = `
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
          <h1 style="font-size: 22px; font-weight: normal; margin: 0 0 8px 0; line-height: 1.3;">You're now connected! 🎉</h1>
          <p style="color: #666; font-size: 12px; margin: 0 0 24px 0; text-transform: uppercase; letter-spacing: 1px;">Shared Calendar</p>
        </td>
        <td style="vertical-align: top; text-align: right; width: 120px;">
          <img src="${gifUrl}" alt="" style="width: 100px; height: 100px; object-fit: cover; border-radius: 4px;">
        </td>
      </tr>
    </table>
    <p style="font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
      <strong>${safeAccepterName}</strong> (${safeAccepterEmail}) accepted your request.
    </p>
    <p style="font-size: 14px; line-height: 1.6; color: #555; margin: 0;">
      You can now see each other's calendar availability and coordinate schedules.
    </p>
  </div>
</body>
</html>
    `.trim();

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
      console.log("Email service connection verified");
      return true;
    } catch (error) {
      console.error("Email service verification failed:", error);
      return false;
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();
