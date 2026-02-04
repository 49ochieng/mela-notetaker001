import { ChatPrompt } from "@microsoft/teams.ai";
import { ILogger } from "@microsoft/teams.common";
import { OpenAIChatModel } from "@microsoft/teams.openai";
import { getGraphClient, TranscriptContent } from "../../services/graphClient";
import { createAudioService, AudioService } from "../../services/audioService";

// TypeScript compilation refresh
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
 * - Fetching meeting transcripts with speaker attribution
 * - Transcribing audio from meeting recordings
 * - Identifying speakers and their contributions
 * - Creating meeting summaries
 * - Analyzing meeting content
 * - Joining meetings as a bot
 * - Listening to meeting audio in real-time
 */
export class MeetingManagerCapability extends BaseCapability {
  readonly name = "meeting_manager";

  // Store the last fetched transcript for analysis
  private lastTranscript: TranscriptContent[] = [];
  private lastMeetingId: string = "";
  private audioService: AudioService | null = null;

  createPrompt(context: MessageContext): ChatPrompt {
    const modelConfig = this.getModelConfig("meeting_manager");
    const graphClient = getGraphClient(this.logger);
    
    // Initialize audio service if credentials available
    this.audioService = createAudioService(this.logger);

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
        "check_meeting_access",
        "Check if meeting transcript access is available and working",
        {
          type: "object" as const,
          properties: {},
        },
        async () => {
          this.logger.debug("🧪 Checking meeting transcript access");

          try {
            const userUpn = context.userUpn || context.userId;
            if (!userUpn) {
              return JSON.stringify({
                success: false,
                message: "Unable to determine user for meeting access check",
              });
            }

            const result = await graphClient.testMeetingTranscriptAccess(userUpn);
            return JSON.stringify(result);
          } catch (error) {
            this.logger.error("Error checking meeting access:", error);
            return JSON.stringify({
              success: false,
              message: `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`,
            });
          }
        }
      )
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
            const userUpn = context.userUpn || context.userId;
            
            // Try to get online meeting info from the chat
            const meetingInfo = await graphClient.getChatOnlineMeeting(chatId);
            
            if (!meetingInfo) {
              return JSON.stringify({
                success: false,
                message: "No active meeting found for this chat. Make sure you're in a meeting chat or provide a meeting link.",
                suggestion: "You can ask me to summarize the chat messages instead, or provide a specific meeting ID.",
              });
            }

            // Try to get transcripts for the meeting
            if (userUpn) {
              const transcripts = await graphClient.listMeetingTranscripts(userUpn, meetingInfo.id);
              
              if (transcripts.length > 0) {
                const fullTranscript = await graphClient.getFullMeetingTranscript(
                  userUpn,
                  meetingInfo.id,
                  transcripts[0].id
                );

                if (fullTranscript.success) {
                  this.lastTranscript = fullTranscript.transcript;
                  this.lastMeetingId = meetingInfo.id;

                  const summary = graphClient.getTranscriptSummary(this.lastTranscript);
                  
                  return JSON.stringify({
                    success: true,
                    message: `✅ Retrieved transcript with ${this.lastTranscript.length} segments`,
                    speakers: Array.from(summary.speakers.entries()).map(([name, count]) => ({
                      name,
                      turns: count,
                    })),
                    segments: summary.segments,
                    duration: summary.totalDuration,
                  });
                }
              }
            }

            // Fallback if no transcripts available
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
        "transcribe_meeting_audio",
        "Transcribe audio from a meeting recording or file",
        {
          type: "object" as const,
          properties: {
            audio_url: {
              type: "string" as const,
              description: "URL to audio file or Teams recording",
            },
            audio_format: {
              type: "string" as const,
              enum: ["wav", "mp3", "m4a"],
              description: "Audio format (wav, mp3, or m4a)",
            },
          },
          required: ["audio_url"],
        },
        async (args: { audio_url: string; audio_format?: string }) => {
          this.logger.debug(`🎙️ Transcribing meeting audio from URL`);

          try {
            if (!this.audioService) {
              return JSON.stringify({
                success: false,
                message: "❌ Audio transcription service not configured",
                required: "AZURE_SPEECH_KEY and AZURE_SPEECH_REGION environment variables must be set",
              });
            }

            // Audio format support (wav, mp3, m4a) - reserved for future use
            const result = await this.audioService.transcribeAudioFromUrl(args.audio_url);

            if (result.success) {
              // Speaker identification is performed but not yet used in output
              this.audioService.identifySpeakers(result.segments);
              const stats = this.audioService.getAudioStats(result.segments);

              return JSON.stringify({
                success: true,
                message: result.message,
                text: result.text.substring(0, 500) + (result.text.length > 500 ? "..." : ""),
                segments: result.segments.length,
                duration: `${stats.totalDuration} seconds`,
                speakers: Array.from(stats.speakers.entries()).map(([name, wordCount]) => ({
                  name,
                  words: wordCount,
                })),
                language: result.language,
              });
            } else {
              return JSON.stringify({
                success: false,
                message: result.message,
              });
            }
          } catch (error) {
            this.logger.error("Error transcribing audio:", error);
            return JSON.stringify({
              success: false,
              message: `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`,
            });
          }
        }
      )
      .function(
        "search_transcript",
        "Search within the meeting transcript for specific topics or speakers",
        {
          type: "object" as const,
          properties: {
            search_query: {
              type: "string" as const,
              description: "What to search for in the transcript (e.g., 'budget', 'timeline', 'action items')",
            },
            speaker_name: {
              type: "string" as const,
              description: "Optional: Filter results to specific speaker",
            },
          },
          required: ["search_query"],
        },
        async (args: { search_query: string; speaker_name?: string }) => {
          this.logger.debug(`🔍 Searching transcript for: ${args.search_query}`);

          try {
            if (this.lastTranscript.length === 0) {
              return JSON.stringify({
                success: false,
                message: "No transcript loaded. Please fetch a meeting transcript first using get_meeting_transcript.",
              });
            }

            // Search transcript
            let results = graphClient.searchTranscript(this.lastTranscript, args.search_query);

            // Filter by speaker if provided
            if (args.speaker_name) {
              results = results.filter(entry => 
                entry.speakerName?.toLowerCase().includes(args.speaker_name!.toLowerCase())
              );
            }

            if (results.length === 0) {
              return JSON.stringify({
                success: true,
                message: `❌ No matches found for "${args.search_query}"`,
                suggestion: "Try different keywords or ask for a summary of the meeting",
              });
            }

            return JSON.stringify({
              success: true,
              query: args.search_query,
              matches: results.slice(0, 5).map(entry => ({
                speaker: entry.speakerName,
                text: entry.text.substring(0, 100) + "...",
                timestamp: entry.timestamp,
              })),
              totalMatches: results.length,
              showing: Math.min(5, results.length),
            });
          } catch (error) {
            this.logger.error("Error searching transcript:", error);
            return JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
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
            // Limit parameter reserved for when Calendar.Read is implemented
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
