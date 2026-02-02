export const MEETING_MANAGER_SCHEMA = {
  type: "object" as const,
  properties: {
    meeting_query: {
      type: "string" as const,
      description: "Search query for finding specific meetings (e.g., meeting subject, date, participants)",
    },
    time_range: {
      type: "string" as const,
      description: "Time range for meeting search (e.g., 'today', 'yesterday', 'last week', 'past 3 days')",
    },
    include_transcript: {
      type: "boolean" as const,
      description: "Whether to include full transcript content",
    },
  },
  required: [] as string[],
};

export interface MeetingManagerArgs {
  meeting_query?: string;
  time_range?: string;
  include_transcript?: boolean;
}

export const LIST_MEETINGS_SCHEMA = {
  type: "object" as const,
  properties: {
    time_range: {
      type: "string" as const,
      description: "Time range for listing meetings (e.g., 'today', 'this week', 'past 7 days')",
    },
    limit: {
      type: "number" as const,
      description: "Maximum number of meetings to return",
    },
  },
  required: [] as string[],
};

export interface ListMeetingsArgs {
  time_range?: string;
  limit?: number;
}

export const ANALYZE_SPEAKERS_SCHEMA = {
  type: "object" as const,
  properties: {
    meeting_id: {
      type: "string" as const,
      description: "The ID of the meeting to analyze",
    },
    speaker_name: {
      type: "string" as const,
      description: "Optional: Filter to specific speaker",
    },
  },
  required: [] as string[],
};

export interface AnalyzeSpeakersArgs {
  meeting_id?: string;
  speaker_name?: string;
}
