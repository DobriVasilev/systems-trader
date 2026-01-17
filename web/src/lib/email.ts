/**
 * Email Service for Claude Execution Notifications
 *
 * Sends email alerts for:
 * - Execution failures
 * - Claude logout detection
 * - Repeated failures (3+ in a row)
 * - Critical errors
 */

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// Email templates
export const emailTemplates = {
  executionFailed: (data: {
    workspaceName: string;
    patternType: string;
    error: string;
    executionId: string;
    retryCount: number;
  }) => ({
    subject: `🚨 Claude Execution Failed: ${data.workspaceName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ef4444;">Claude Code Execution Failed</h2>
        <p>An execution failed for workspace <strong>${data.workspaceName}</strong>.</p>

        <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #991b1b;">Error Details</h3>
          <p style="margin: 5px 0;"><strong>Pattern:</strong> ${data.patternType}</p>
          <p style="margin: 5px 0;"><strong>Retry Count:</strong> ${data.retryCount}</p>
          <p style="margin: 10px 0 0; color: #7f1d1d; font-family: monospace; font-size: 14px; white-space: pre-wrap;">${data.error}</p>
        </div>

        <p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/workspace/${data.patternType}/execution/${data.executionId}"
             style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
            View Execution Details
          </a>
        </p>

        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 12px;">
          This is an automated alert from your Claude Code autonomous system.
        </p>
      </div>
    `,
    text: `Claude Code Execution Failed\n\nWorkspace: ${data.workspaceName}\nPattern: ${data.patternType}\nRetry Count: ${data.retryCount}\n\nError:\n${data.error}\n\nView details: ${process.env.NEXT_PUBLIC_APP_URL}/workspace/${data.patternType}/execution/${data.executionId}`,
  }),

  claudeLogout: () => ({
    subject: "🔐 Claude Code Authentication Required",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f59e0b;">Claude Code Logged Out</h2>
        <p>Claude Code has been logged out and requires re-authentication.</p>

        <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #92400e;">Action Required</h3>
          <p>SSH into your server and run:</p>
          <pre style="background: #1f2937; color: #10b981; padding: 10px; border-radius: 5px; overflow-x: auto;">claude config</pre>
          <p style="margin-top: 10px;">Then complete the OAuth flow to restore autonomous operation.</p>
        </div>

        <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
          This typically happens every few weeks. Once re-authenticated, all pending executions will resume automatically.
        </p>

        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 12px;">
          This is an automated alert from your Claude Code autonomous system.
        </p>
      </div>
    `,
    text: `Claude Code Logged Out\n\nAction Required:\nSSH into your server and run: claude config\nThen complete the OAuth flow to restore autonomous operation.\n\nThis typically happens every few weeks. Once re-authenticated, all pending executions will resume automatically.`,
  }),

  repeatedFailures: (data: {
    failureCount: number;
    recentFailures: Array<{
      workspaceName: string;
      error: string;
      failedAt: string;
    }>;
  }) => ({
    subject: `⚠️ Critical: ${data.failureCount} Consecutive Execution Failures`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Critical: Multiple Consecutive Failures</h2>
        <p>Your Claude Code system has experienced <strong>${data.failureCount} consecutive failures</strong>.</p>

        <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #991b1b;">Recent Failures</h3>
          ${data.recentFailures
            .map(
              (failure) => `
            <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #fee2e2;">
              <p style="margin: 5px 0;"><strong>${failure.workspaceName}</strong></p>
              <p style="margin: 5px 0; font-size: 12px; color: #7f1d1d;">${new Date(failure.failedAt).toLocaleString()}</p>
              <p style="margin: 5px 0; font-family: monospace; font-size: 13px; color: #991b1b;">${failure.error}</p>
            </div>
          `
            )
            .join("")}
        </div>

        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #92400e;">Possible Causes</h3>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li>Claude Code logged out (check authentication)</li>
            <li>Server resource issues (check disk space, memory)</li>
            <li>Network connectivity problems</li>
            <li>Code or environment issues</li>
          </ul>
        </div>

        <p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/admin"
             style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
            View Admin Dashboard
          </a>
        </p>

        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 12px;">
          This is an automated alert from your Claude Code autonomous system.
        </p>
      </div>
    `,
    text: `Critical: Multiple Consecutive Failures\n\nYour Claude Code system has experienced ${data.failureCount} consecutive failures.\n\nRecent Failures:\n${data.recentFailures.map((f) => `- ${f.workspaceName} at ${new Date(f.failedAt).toLocaleString()}\n  ${f.error}`).join("\n")}\n\nPossible causes:\n- Claude Code logged out\n- Server resource issues\n- Network problems\n- Code/environment issues\n\nView admin dashboard: ${process.env.NEXT_PUBLIC_APP_URL}/admin`,
  }),
};

/**
 * Send email using configured provider
 *
 * Supports:
 * - Resend (RESEND_API_KEY)
 * - SendGrid (SENDGRID_API_KEY)
 * - NodeMailer (SMTP_* env vars)
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const { to, subject, html, text } = options;

  // Check if email is enabled
  if (!process.env.EMAIL_ENABLED || process.env.EMAIL_ENABLED !== "true") {
    console.log("[EMAIL] Email notifications disabled. Would send:", subject);
    return false;
  }

  try {
    // Resend (recommended for Next.js)
    if (process.env.RESEND_API_KEY) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "noreply@yourdomain.com",
          to,
          subject,
          html,
          text: text || html.replace(/<[^>]*>/g, ""),
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("[EMAIL] Resend API error:", error);
        return false;
      }

      console.log("[EMAIL] Sent via Resend:", subject);
      return true;
    }

    // SendGrid
    if (process.env.SENDGRID_API_KEY) {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: process.env.EMAIL_FROM || "noreply@yourdomain.com" },
          subject,
          content: [
            { type: "text/html", value: html },
            { type: "text/plain", value: text || html.replace(/<[^>]*>/g, "") },
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("[EMAIL] SendGrid API error:", error);
        return false;
      }

      console.log("[EMAIL] Sent via SendGrid:", subject);
      return true;
    }

    // Fallback: Log to console
    console.log("[EMAIL] No email provider configured. Would send:", {
      to,
      subject,
      preview: html.substring(0, 200),
    });
    return false;
  } catch (error) {
    console.error("[EMAIL] Failed to send email:", error);
    return false;
  }
}

/**
 * Send execution failure notification
 */
export async function notifyExecutionFailure(data: {
  workspaceName: string;
  patternType: string;
  error: string;
  executionId: string;
  retryCount: number;
}): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.warn("[EMAIL] ADMIN_EMAIL not configured, skipping notification");
    return;
  }

  const template = emailTemplates.executionFailed(data);
  await sendEmail({
    to: adminEmail,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
}

/**
 * Send Claude logout notification
 */
export async function notifyClaudeLogout(): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.warn("[EMAIL] ADMIN_EMAIL not configured, skipping notification");
    return;
  }

  const template = emailTemplates.claudeLogout();
  await sendEmail({
    to: adminEmail,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
}

/**
 * Send repeated failures notification
 */
export async function notifyRepeatedFailures(data: {
  failureCount: number;
  recentFailures: Array<{
    workspaceName: string;
    error: string;
    failedAt: string;
  }>;
}): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.warn("[EMAIL] ADMIN_EMAIL not configured, skipping notification");
    return;
  }

  const template = emailTemplates.repeatedFailures(data);
  await sendEmail({
    to: adminEmail,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
}
