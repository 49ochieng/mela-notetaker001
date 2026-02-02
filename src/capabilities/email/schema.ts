export const SEND_EMAIL_SCHEMA = {
  type: "object" as const,
  properties: {
    recipients: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "List of email addresses to send to",
    },
    subject: {
      type: "string" as const,
      description: "Email subject line",
    },
    body: {
      type: "string" as const,
      description: "Email body content (supports HTML)",
    },
    cc_recipients: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "Optional list of CC recipients",
    },
    is_html: {
      type: "boolean" as const,
      description: "Whether the body is HTML formatted",
    },
  },
  required: ["recipients", "subject", "body"] as string[],
};

export interface SendEmailArgs {
  recipients: string[];
  subject: string;
  body: string;
  cc_recipients?: string[];
  is_html?: boolean;
}

export const COMPOSE_EMAIL_SCHEMA = {
  type: "object" as const,
  properties: {
    purpose: {
      type: "string" as const,
      description: "Purpose of the email (e.g., 'meeting summary', 'follow-up', 'action items')",
    },
    tone: {
      type: "string" as const,
      enum: ["formal", "friendly", "urgent", "informative"],
      description: "Tone of the email",
    },
    key_points: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "Key points to include in the email",
    },
    meeting_subject: {
      type: "string" as const,
      description: "If related to a meeting, the meeting subject",
    },
  },
  required: ["purpose"] as string[],
};

export interface ComposeEmailArgs {
  purpose: string;
  tone?: string;
  key_points?: string[];
  meeting_subject?: string;
}

export const SEND_MEETING_SUMMARY_SCHEMA = {
  type: "object" as const,
  properties: {
    meeting_subject: {
      type: "string" as const,
      description: "Subject of the meeting",
    },
    recipients: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "Email addresses of meeting participants",
    },
    summary: {
      type: "string" as const,
      description: "Meeting summary content",
    },
    action_items: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "List of action items from the meeting",
    },
    include_next_steps: {
      type: "boolean" as const,
      description: "Whether to include next steps section",
    },
  },
  required: ["meeting_subject", "recipients", "summary"] as string[],
};

export interface SendMeetingSummaryArgs {
  meeting_subject: string;
  recipients: string[];
  summary: string;
  action_items?: string[];
  include_next_steps?: boolean;
}
