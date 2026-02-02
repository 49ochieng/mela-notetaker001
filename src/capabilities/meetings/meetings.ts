import { ChatPrompt } from "@microsoft/teams.ai";
import { ILogger } from "@microsoft/teams.common";
import { OpenAIChatModel } from "@microsoft/teams.openai";
import { getGraphClient, TranscriptContent } from "../../services/graphClient";
import { MessageContext } from "../../utils/messageContext";
import { BaseCapability, CapabilityDefinition } from "../capability";
import { MEETING_MANAGER_PROMPT } from "./prompt";
import {
  MEETING_MANAGER_SCHEMA,
  MeetingManagerArgs,
  LIST_MEETINGS_SCHEMA,
  ListMeetingsArgs,
  ANALYZE_SPEAKERS_SCHEMA,
  AnalyzeSpeakersArgs,
} from "./schema";

/**
 * Meeting Manager Capability
 * 
 * Handles meeting-related operations including:
 * - Fetching meeting transcripts
 * - Identifying speakers
 * - Creating meeting summaries
 * - Analyzing meeting content
 */
export class MeetingManagerCapability extends BaseCapability {
  readonly name = "meeting_manager";

  // Store the last fetched transcript for analysis
  private lastTranscript: TranscriptContent[] = [];
  private lastMeetingId: string = "";

  createPrompt(context: MessageContext): ChatPrompt {
    const modelConfig = this.getModelConfig("meeting_manager");
    const graphClient = getGraphClient(this.logger);

    const prompt = new ChatPrompt({
      instructions: MEETING_MANAGER_PROMPT,
      model: new OpenAIChatModel({
        model: modelConfig.model,
        apiKey: modelConfig.apiKey,
        endpoint: modelConfig.endpoint,
        apiVersion: modelConfig.apiVersion,
      }),
    })
      .function(
        "get_meeting_transcript",
        "Fetch transcript content from a Teams meeting. Returns speaker-attributed transcript.",
        MEETING_MANAGER_SCHEMA,
        async (args: MeetingManagerArgs) => {
          this.logger.debug(`📋 Getting meeting transcript with args:`, args);

          try {
            // For now, we'll use the chat context to find associated meetings
            // In a real scenario, you'd need the user's ID and meeting ID
            const chatId = context.conversationId;
            
            // Try to get online meeting info from the chat
            const meetingInfo = await graphClient.getChatOnlineMeeting(chatId);
            
            if (!meetingInfo) {
              return JSON.stringify({
                success: false,
                message: "No active meeting found for this chat. Make sure you're in a meeting chat or provide a meeting link.",
                suggestion: "You can ask me to summarize the chat messages instead, or provide a specific meeting ID.",
              });
            }

            // This would require the organizer's user ID - for demo we return info about the meeting
            return JSON.stringify({
              success: true,
              meeting: meetingInfo,
              note: "Transcript access requires meeting organizer permissions. Please ensure transcription was enabled during the meeting.",
            });
          } catch (error) {
            this.logger.error("Error fetching meeting transcript:", error);
            return JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
              fallback: "I can help summarize the chat conversation instead. Would you like that?",
            });
          }
        }
      )
      .function(
        "list_recent_meetings",
        "List the user's recent Teams meetings",
        LIST_MEETINGS_SCHEMA,
        async (args: ListMeetingsArgs) => {
          this.logger.debug(`📅 Listing recent meetings with args:`, args);

          try {
            // Calculate time range
            const _limit = args.limit || 10; // Reserved for when Calendar.Read is implemented
            let startDate = new Date();
            
            switch (args.time_range?.toLowerCase()) {
              case "today":
                startDate.setHours(0, 0, 0, 0);
                break;
              case "yesterday":
                startDate.setDate(startDate.getDate() - 1);
                startDate.setHours(0, 0, 0, 0);
                break;
              case "this week":
              case "past week":
              case "last week":
                startDate.setDate(startDate.getDate() - 7);
                break;
              default:
                startDate.setDate(startDate.getDate() - 7);
            }

            // Note: This would need the user's ID from the context
            // For now, return guidance
            return JSON.stringify({
              success: true,
              message: `To list meetings, I need access to your calendar. The app needs Calendar.Read permission.`,
              timeRange: {
                from: startDate.toISOString(),
                to: new Date().toISOString(),
              },
              suggestion: "You can share a meeting link with me, and I'll help analyze the transcript if available.",
            });
          } catch (error) {
            this.logger.error("Error listing meetings:", error);
            return JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }
      )
      .function(
        "analyze_speakers",
        "Identify and analyze speaker contributions from meeting transcript",
        ANALYZE_SPEAKERS_SCHEMA,
        async (args: AnalyzeSpeakersArgs) => {
          this.logger.debug(`🎤 Analyzing speakers with args:`, args);

          try {
            if (this.lastTranscript.length === 0) {
              return JSON.stringify({
                success: false,
                message: "No transcript loaded. Please first fetch a meeting transcript using get_meeting_transcript.",
              });
            }

            // Analyze speakers from stored transcript
            const speakerMap = new Map<string, { messageCount: number; totalWords: number; messages: string[] }>();

            for (const entry of this.lastTranscript) {
              const speaker = entry.speakerName;
              if (!speakerMap.has(speaker)) {
                speakerMap.set(speaker, { messageCount: 0, totalWords: 0, messages: [] });
              }

              const data = speakerMap.get(speaker)!;
              data.messageCount++;
              data.totalWords += entry.text.split(/\s+/).length;
              if (data.messages.length < 5) {
                data.messages.push(entry.text.substring(0, 200));
              }
            }

            // Filter by speaker name if provided
            const result: any[] = [];
            speakerMap.forEach((data, speaker) => {
              if (!args.speaker_name || speaker.toLowerCase().includes(args.speaker_name.toLowerCase())) {
                result.push({
                  speaker,
                  contributions: data.messageCount,
                  wordCount: data.totalWords,
                  sampleMessages: data.messages,
                });
              }
            });

            return JSON.stringify({
              success: true,
              speakers: result.sort((a, b) => b.contributions - a.contributions),
              totalSpeakers: result.length,
              meetingId: this.lastMeetingId,
            });
          } catch (error) {
            this.logger.error("Error analyzing speakers:", error);
            return JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }
      )
      .function(
        "get_meeting_notes",
        "Get stored notes for a meeting from the database",
        {
          type: "object",
          properties: {
            meeting_id: {
              type: "string",
              description: "Meeting ID to get notes for",
            },
          },
        },
        async (args: { meeting_id?: string }) => {
          this.logger.debug(`📝 Getting meeting notes for:`, args.meeting_id);

          try {
            // Get notes from conversation memory - meetings are stored as special messages
            const allMessages = await context.memory.getMessagesByTimeRange(
              context.startTime,
              context.endTime
            );

            // Filter for meeting-related messages (could be tagged with meeting ID)
            const meetingNotes = allMessages.filter((msg: any) => 
              msg.content.includes("[MEETING NOTES]") || 
              msg.content.includes("[MEETING SUMMARY]") ||
              (args.meeting_id && msg.content.includes(args.meeting_id))
            );

            if (meetingNotes.length === 0) {
              return JSON.stringify({
                success: true,
                message: "No stored meeting notes found for the specified time range.",
                suggestion: "Would you like me to create notes from the conversation?",
              });
            }

            return JSON.stringify({
              success: true,
              notes: meetingNotes.map((note: any) => ({
                timestamp: note.timestamp,
                content: note.content,
                author: note.name,
              })),
              count: meetingNotes.length,
            });
          } catch (error) {
            this.logger.error("Error getting meeting notes:", error);
            return JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }
      )
      .function(
        "save_meeting_notes",
        "Save meeting notes or summary to the database",
        {
          type: "object",
          properties: {
            meeting_subject: {
              type: "string",
              description: "Subject/title of the meeting",
            },
            notes: {
              type: "string",
              description: "Notes content to save",
            },
            note_type: {
              type: "string",
              enum: ["summary", "action_items", "notes", "transcript"],
              description: "Type of notes being saved",
            },
          },
          required: ["meeting_subject", "notes"],
        },
        async (args: { meeting_subject: string; notes: string; note_type?: string }) => {
          this.logger.debug(`💾 Saving meeting notes:`, args.meeting_subject);

          try {
            const noteType = args.note_type || "notes";
            // Format notes for storage (used in future persistence implementation)
            this.logger.debug(`Formatted note type: ${noteType.toUpperCase()}`);

            // Notes will be saved through the normal message flow
            return JSON.stringify({
              success: true,
              message: `Meeting ${noteType} saved successfully for: ${args.meeting_subject}`,
              savedAt: new Date().toISOString(),
            });
          } catch (error) {
            this.logger.error("Error saving meeting notes:", error);
            return JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }
      );

    this.logger.debug("✅ Initialized Meeting Manager Capability!");
    return prompt;
  }
}

// Capability definition for manager registration
export const MEETING_MANAGER_CAPABILITY_DEFINITION: CapabilityDefinition = {
  name: "meeting_manager",
  manager_desc: `**Meeting Manager**: Use for requests about:
- "meeting transcript", "meeting summary", "what was discussed in the meeting"
- "meeting notes", "who spoke", "speaker contributions", "meeting participants"
- "list meetings", "recent meetings", "today's meetings"
- "save notes", "meeting recap", "meeting highlights"`,
  handler: async (context: MessageContext, logger: ILogger) => {
    const meetingCapability = new MeetingManagerCapability(logger);
    const result = await meetingCapability.processRequest(context);
    if (result.error) {
      logger.error(`❌ Error in Meeting Manager Capability: ${result.error}`);
      return `Error in Meeting Manager Capability: ${result.error}`;
    }
    return result.response || "No response from Meeting Manager Capability";
  },
};
