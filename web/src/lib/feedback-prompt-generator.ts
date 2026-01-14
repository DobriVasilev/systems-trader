/**
 * AI Prompt Generation Engine for Feedback
 * Generates context-rich prompts for Claude Code to fix issues
 */

interface FeedbackData {
  id: string;
  type: string;
  title?: string | null;
  textContent?: string | null;
  voiceTranscription?: string | null;
  stepsToReproduce?: string | null;
  expectedBehavior?: string | null;
  actualBehavior?: string | null;
  pageUrl?: string | null;
  pagePath?: string | null;
  userAgent?: string | null;
  screenResolution?: string | null;
  viewport?: string | null;
  createdAt: string;
  user: {
    name: string | null;
    email: string | null;
  };
  attachments?: Array<{
    url: string;
    filename: string;
    category: string;
  }>;
}

const FEEDBACK_TYPE_LABELS: Record<string, string> = {
  BUG_REPORT: "Bug Report",
  FEATURE_REQUEST: "Feature Request",
  UI_UX_ISSUE: "UI/UX Issue",
  PERFORMANCE_ISSUE: "Performance Issue",
  QUESTION: "Question",
  OTHER: "Other",
};

const FEEDBACK_TYPE_EMOJIS: Record<string, string> = {
  BUG_REPORT: "🐛",
  FEATURE_REQUEST: "✨",
  UI_UX_ISSUE: "🎨",
  PERFORMANCE_ISSUE: "⚡",
  QUESTION: "❓",
  OTHER: "💬",
};

export function generateFeedbackPrompt(feedback: FeedbackData): string {
  const typeLabel = FEEDBACK_TYPE_LABELS[feedback.type] || feedback.type;
  const emoji = FEEDBACK_TYPE_EMOJIS[feedback.type] || "📝";

  let prompt = `# ${emoji} ${typeLabel}`;

  if (feedback.title) {
    prompt += `: ${feedback.title}`;
  }

  prompt += `\n\n`;

  // User Information
  prompt += `**Reported by:** ${feedback.user.name || "User"} (${feedback.user.email})\n`;
  prompt += `**Date:** ${new Date(feedback.createdAt).toLocaleString()}\n`;
  prompt += `**Feedback ID:** ${feedback.id}\n\n`;

  // Context Section
  prompt += `## 📍 Context\n\n`;

  if (feedback.pageUrl) {
    prompt += `- **Page URL:** ${feedback.pageUrl}\n`;
  }

  if (feedback.pagePath) {
    prompt += `- **Page Path:** ${feedback.pagePath}\n`;
  }

  if (feedback.screenResolution) {
    prompt += `- **Screen Resolution:** ${feedback.screenResolution}\n`;
  }

  if (feedback.viewport) {
    prompt += `- **Viewport:** ${feedback.viewport}\n`;
  }

  if (feedback.userAgent) {
    // Parse user agent for key info
    const browserInfo = parseBrowserInfo(feedback.userAgent);
    prompt += `- **Browser:** ${browserInfo}\n`;
  }

  prompt += `\n`;

  // Description Section
  prompt += `## 📝 Description\n\n`;

  if (feedback.voiceTranscription) {
    prompt += `**Voice Transcription:**\n\n`;
    prompt += `> ${feedback.voiceTranscription}\n\n`;
  }

  if (feedback.textContent) {
    prompt += `${feedback.textContent}\n\n`;
  }

  // Bug-specific sections
  if (feedback.type === "BUG_REPORT") {
    if (feedback.stepsToReproduce) {
      prompt += `## 🔄 Steps to Reproduce\n\n`;
      prompt += `${feedback.stepsToReproduce}\n\n`;
    }

    if (feedback.expectedBehavior || feedback.actualBehavior) {
      prompt += `## ⚖️ Expected vs Actual Behavior\n\n`;

      if (feedback.expectedBehavior) {
        prompt += `**Expected:**\n${feedback.expectedBehavior}\n\n`;
      }

      if (feedback.actualBehavior) {
        prompt += `**Actual:**\n${feedback.actualBehavior}\n\n`;
      }
    }
  }

  // Feature Request specific
  if (feedback.type === "FEATURE_REQUEST") {
    if (feedback.expectedBehavior) {
      prompt += `## 💡 Proposed Solution\n\n`;
      prompt += `${feedback.expectedBehavior}\n\n`;
    }
  }

  // Attachments
  if (feedback.attachments && feedback.attachments.length > 0) {
    prompt += `## 📎 Attachments\n\n`;

    const screenshots = feedback.attachments.filter(a => a.category === "image");
    const videos = feedback.attachments.filter(a => a.category === "video");
    const other = feedback.attachments.filter(a => !["image", "video"].includes(a.category));

    if (screenshots.length > 0) {
      prompt += `**Screenshots:**\n`;
      screenshots.forEach((att, i) => {
        prompt += `${i + 1}. [${att.filename}](${att.url})\n`;
      });
      prompt += `\n`;
    }

    if (videos.length > 0) {
      prompt += `**Videos:**\n`;
      videos.forEach((att, i) => {
        prompt += `${i + 1}. [${att.filename}](${att.url})\n`;
      });
      prompt += `\n`;
    }

    if (other.length > 0) {
      prompt += `**Other Files:**\n`;
      other.forEach((att, i) => {
        prompt += `${i + 1}. [${att.filename}](${att.url})\n`;
      });
      prompt += `\n`;
    }
  }

  // Task Section
  prompt += `## 🎯 Task\n\n`;

  switch (feedback.type) {
    case "BUG_REPORT":
      prompt += `Please investigate and fix this bug. `;
      if (feedback.stepsToReproduce) {
        prompt += `Follow the reproduction steps above to verify the issue, then implement a fix. `;
      }
      prompt += `Ensure the fix handles edge cases and doesn't introduce regressions.\n`;
      break;

    case "FEATURE_REQUEST":
      prompt += `Please implement this feature request. Consider the user's needs and design a solution that fits well with the existing architecture. `;
      prompt += `Think about edge cases, performance implications, and user experience.\n`;
      break;

    case "UI_UX_ISSUE":
      prompt += `Please improve the UI/UX based on this feedback. Consider accessibility, responsiveness, and consistency with the rest of the application.\n`;
      break;

    case "PERFORMANCE_ISSUE":
      prompt += `Please investigate and optimize the performance issue. Use profiling tools if needed, and ensure any optimizations don't compromise functionality.\n`;
      break;

    case "QUESTION":
      prompt += `Please investigate this question and provide clarification. If this reveals a usability issue, consider improving documentation or the UI.\n`;
      break;

    default:
      prompt += `Please address this feedback appropriately based on its nature and context.\n`;
  }

  return prompt;
}

function parseBrowserInfo(userAgent: string): string {
  // Simple browser detection
  if (userAgent.includes("Chrome") && !userAgent.includes("Edg")) {
    const match = userAgent.match(/Chrome\/(\d+\.\d+)/);
    return match ? `Chrome ${match[1]}` : "Chrome";
  }

  if (userAgent.includes("Firefox")) {
    const match = userAgent.match(/Firefox\/(\d+\.\d+)/);
    return match ? `Firefox ${match[1]}` : "Firefox";
  }

  if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) {
    const match = userAgent.match(/Version\/(\d+\.\d+)/);
    return match ? `Safari ${match[1]}` : "Safari";
  }

  if (userAgent.includes("Edg")) {
    const match = userAgent.match(/Edg\/(\d+\.\d+)/);
    return match ? `Edge ${match[1]}` : "Edge";
  }

  return "Unknown Browser";
}

/**
 * Generate a shorter prompt for quick copy
 */
export function generateQuickPrompt(feedback: FeedbackData): string {
  const typeLabel = FEEDBACK_TYPE_LABELS[feedback.type] || feedback.type;
  const emoji = FEEDBACK_TYPE_EMOJIS[feedback.type] || "📝";

  let prompt = `${emoji} ${typeLabel}`;

  if (feedback.title) {
    prompt += `: ${feedback.title}`;
  }

  prompt += `\n\n`;

  if (feedback.voiceTranscription) {
    prompt += `${feedback.voiceTranscription}\n\n`;
  } else if (feedback.textContent) {
    prompt += `${feedback.textContent}\n\n`;
  }

  if (feedback.pageUrl) {
    prompt += `Page: ${feedback.pageUrl}\n`;
  }

  return prompt;
}

/**
 * Generate an email-friendly format
 */
export function generateEmailFormat(feedback: FeedbackData): {
  subject: string;
  body: string;
} {
  const typeLabel = FEEDBACK_TYPE_LABELS[feedback.type] || feedback.type;

  const subject = feedback.title
    ? `${typeLabel}: ${feedback.title}`
    : `New ${typeLabel} from ${feedback.user.name || feedback.user.email}`;

  const body = generateFeedbackPrompt(feedback);

  return { subject, body };
}
