import { ConfidentialClientApplication } from "@azure/msal-node";
import { ILogger } from "@microsoft/teams.common";

/**
 * Microsoft Graph API Client for Meeting Intelligence
 * Handles authentication and API calls to Microsoft Graph
 */

export interface GraphConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string;
}

export interface MeetingTranscript {
  id: string;
  meetingId: string;
  content: string;
  createdDateTime: string;
}

export interface TranscriptContent {
  speakerName: string;
  text: string;
  timestamp: string;
}

export interface MeetingDetails {
  id: string;
  subject: string;
  startDateTime: string;
  endDateTime: string;
  organizer: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  participants: {
    attendees: Array<{
      emailAddress: {
        name: string;
        address: string;
      };
    }>;
  };
  joinWebUrl?: string;
}

export interface PlannerTask {
  id?: string;
  planId: string;
  bucketId?: string;
  title: string;
  assignments?: Record<string, { "@odata.type": string; orderHint: string }>;
  dueDateTime?: string;
  percentComplete?: number;
  priority?: number;
}

export interface EmailMessage {
  subject: string;
  body: {
    contentType: "Text" | "HTML";
    content: string;
  };
  toRecipients: Array<{
    emailAddress: {
      address: string;
      name?: string;
    };
  }>;
  ccRecipients?: Array<{
    emailAddress: {
      address: string;
      name?: string;
    };
  }>;
}

export class GraphClient {
  private msalClient: ConfidentialClientApplication;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private logger: ILogger;

  constructor(config: GraphConfig, logger: ILogger) {
    this.logger = logger;
    this.msalClient = new ConfidentialClientApplication({
      auth: {
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        authority: `https://login.microsoftonline.com/${config.tenantId}`,
      },
    });
  }

  /**
   * Get access token for Microsoft Graph API
   */
  private async getAccessToken(): Promise<string> {
    // Check if we have a valid cached token
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const result = await this.msalClient.acquireTokenByClientCredential({
        scopes: ["https://graph.microsoft.com/.default"],
      });

      if (!result?.accessToken) {
        throw new Error("Failed to acquire access token");
      }

      this.accessToken = result.accessToken;
      // Set expiry to 5 minutes before actual expiry for safety
      this.tokenExpiry = new Date(Date.now() + (result.expiresOn?.getTime() || 3600000) - 300000);

      this.logger.debug("✅ Successfully acquired Graph API access token");
      return this.accessToken;
    } catch (error) {
      this.logger.error("❌ Failed to acquire Graph API access token:", error);
      throw error;
    }
  }

  /**
   * Make a GET request to Microsoft Graph API
   */
  private async graphGet<T>(endpoint: string): Promise<T> {
    const token = await this.getAccessToken();
    const response = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Graph API GET error: ${response.status} - ${errorText}`);
      throw new Error(`Graph API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Make a POST request to Microsoft Graph API
   */
  private async graphPost<T>(endpoint: string, body: any): Promise<T> {
    const token = await this.getAccessToken();
    const response = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Graph API POST error: ${response.status} - ${errorText}`);
      throw new Error(`Graph API error: ${response.status} - ${errorText}`);
    }

    // Handle 204 No Content responses
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  /**
   * Make a PATCH request to Microsoft Graph API (reserved for future use)
   */
  private async _graphPatch<T>(endpoint: string, body: any): Promise<T> {
    const token = await this.getAccessToken();
    const response = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Graph API PATCH error: ${response.status} - ${errorText}`);
      throw new Error(`Graph API error: ${response.status} - ${errorText}`);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  // ==================== MEETING OPERATIONS ====================

  /**
   * Get online meeting details by join URL or meeting ID
   */
  async getMeetingByJoinUrl(joinUrl: string, userId: string): Promise<MeetingDetails | null> {
    try {
      // Extract meeting ID from join URL
      const meetingIdMatch = joinUrl.match(/19:meeting_([^@]+)@thread/);
      if (!meetingIdMatch) {
        this.logger.warn("Could not extract meeting ID from join URL");
        return null;
      }

      const response = await this.graphGet<MeetingDetails>(
        `/users/${userId}/onlineMeetings?$filter=JoinWebUrl eq '${encodeURIComponent(joinUrl)}'`
      );
      return response;
    } catch (error) {
      this.logger.error("Error getting meeting:", error);
      return null;
    }
  }

  /**
   * Get meeting transcripts
   */
  async getMeetingTranscripts(
    userId: string,
    meetingId: string
  ): Promise<MeetingTranscript[]> {
    try {
      const response = await this.graphGet<{ value: MeetingTranscript[] }>(
        `/users/${userId}/onlineMeetings/${meetingId}/transcripts`
      );
      return response.value || [];
    } catch (error) {
      this.logger.error("Error getting meeting transcripts:", error);
      return [];
    }
  }

  /**
   * Get transcript content
   */
  async getTranscriptContent(
    userId: string,
    meetingId: string,
    transcriptId: string
  ): Promise<string> {
    try {
      const token = await this.getAccessToken();
      const response = await fetch(
        `https://graph.microsoft.com/v1.0/users/${userId}/onlineMeetings/${meetingId}/transcripts/${transcriptId}/content?$format=text/vtt`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get transcript content: ${response.status}`);
      }

      return await response.text();
    } catch (error) {
      this.logger.error("Error getting transcript content:", error);
      return "";
    }
  }

  /**
   * Parse VTT transcript content to extract speakers and text
   */
  parseVttTranscript(vttContent: string): TranscriptContent[] {
    const lines = vttContent.split("\n");
    const transcriptEntries: TranscriptContent[] = [];
    let currentSpeaker = "";
    let currentText = "";
    let currentTimestamp = "";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip WEBVTT header and empty lines
      if (line === "WEBVTT" || line === "") continue;

      // Check for timestamp line (e.g., "00:00:00.000 --> 00:00:05.000")
      if (line.includes("-->")) {
        currentTimestamp = line.split("-->")[0].trim();
        continue;
      }

      // Check for speaker line (e.g., "<v Speaker Name>text</v>")
      const speakerMatch = line.match(/<v ([^>]+)>(.+?)(?:<\/v>)?$/);
      if (speakerMatch) {
        if (currentText && currentSpeaker) {
          transcriptEntries.push({
            speakerName: currentSpeaker,
            text: currentText,
            timestamp: currentTimestamp,
          });
        }
        currentSpeaker = speakerMatch[1];
        currentText = speakerMatch[2].replace(/<\/v>$/, "");
      } else if (line && !line.match(/^\d+$/)) {
        // Continuation of text
        currentText += " " + line;
      }
    }

    // Add last entry
    if (currentText && currentSpeaker) {
      transcriptEntries.push({
        speakerName: currentSpeaker,
        text: currentText,
        timestamp: currentTimestamp,
      });
    }

    return transcriptEntries;
  }

  /**
   * Get user's recent meetings
   */
  async getUserMeetings(userId: string, startDateTime?: string): Promise<MeetingDetails[]> {
    try {
      const start = startDateTime || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const response = await this.graphGet<{ value: MeetingDetails[] }>(
        `/users/${userId}/calendar/events?$filter=start/dateTime ge '${start}'&$orderby=start/dateTime desc&$top=50`
      );
      return response.value || [];
    } catch (error) {
      this.logger.error("Error getting user meetings:", error);
      return [];
    }
  }

  // ==================== EMAIL OPERATIONS ====================

  /**
   * Get the bot's email address for sending emails
   * Uses the configured BOT_EMAIL_ADDRESS environment variable
   */
  getBotEmail(): string {
    return process.env.BOT_EMAIL_ADDRESS || "ai.solutions@armely.com";
  }

  /**
   * Send an email from the bot's email address
   * Uses: POST /users/{botEmail}/sendMail
   * @param message The email message to send
   * @param fromEmail Optional override for sender email (defaults to BOT_EMAIL_ADDRESS)
   */
  async sendEmail(message: EmailMessage, fromEmail?: string): Promise<boolean> {
    try {
      const senderEmail = fromEmail || this.getBotEmail();
      
      this.logger.debug(`📧 Sending email from ${senderEmail} to ${message.toRecipients.map(r => r.emailAddress.address).join(", ")}`);
      
      await this.graphPost(`/users/${senderEmail}/sendMail`, {
        message: message,
        saveToSentItems: true,
      });
      
      this.logger.debug(`✅ Email sent successfully from ${senderEmail}`);
      return true;
    } catch (error) {
      this.logger.error("Error sending email:", error);
      return false;
    }
  }

  /**
   * Send meeting summary email from the bot's email address
   * @param recipients Array of recipient email addresses (UPNs)
   * @param meetingSubject The meeting subject line
   * @param summary The meeting summary text
   * @param actionItems Array of action item strings
   */
  async sendMeetingSummaryEmail(
    recipients: string[],
    meetingSubject: string,
    summary: string,
    actionItems: string[]
  ): Promise<boolean> {
    const actionItemsHtml = actionItems.length > 0
      ? `<h3>Action Items:</h3><ul>${actionItems.map(item => `<li>${item}</li>`).join("")}</ul>`
      : "";

    const emailMessage: EmailMessage = {
      subject: `Meeting Summary: ${meetingSubject}`,
      body: {
        contentType: "HTML",
        content: `
          <html>
            <body style="font-family: 'Segoe UI', Arial, sans-serif;">
              <h2>Meeting Summary: ${meetingSubject}</h2>
              <hr/>
              <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px;">
                ${summary.replace(/\n/g, "<br/>")}
              </div>
              ${actionItemsHtml}
              <hr/>
              <p style="color: #666; font-size: 12px;">
                Generated by Collaborator Agent for Armely
              </p>
            </body>
          </html>
        `,
      },
      toRecipients: recipients.map(email => ({
        emailAddress: { address: email },
      })),
    };

    return this.sendEmail(emailMessage);
  }

  // ==================== PLANNER OPERATIONS ====================

  /**
   * Get user's Planner plans
   */
  async getUserPlans(userId: string): Promise<any[]> {
    try {
      const response = await this.graphGet<{ value: any[] }>(`/users/${userId}/planner/plans`);
      return response.value || [];
    } catch (error) {
      this.logger.error("Error getting user plans:", error);
      return [];
    }
  }

  /**
   * Get plan buckets
   */
  async getPlanBuckets(planId: string): Promise<any[]> {
    try {
      const response = await this.graphGet<{ value: any[] }>(`/planner/plans/${planId}/buckets`);
      return response.value || [];
    } catch (error) {
      this.logger.error("Error getting plan buckets:", error);
      return [];
    }
  }

  /**
   * Create a Planner task
   */
  async createPlannerTask(task: PlannerTask): Promise<PlannerTask | null> {
    try {
      const response = await this.graphPost<PlannerTask>("/planner/tasks", task);
      this.logger.debug(`✅ Created Planner task: ${task.title}`);
      return response;
    } catch (error) {
      this.logger.error("Error creating Planner task:", error);
      return null;
    }
  }

  /**
   * Update a Planner task
   */
  async updatePlannerTask(
    taskId: string,
    updates: Partial<PlannerTask>,
    etag: string
  ): Promise<boolean> {
    try {
      const token = await this.getAccessToken();
      const response = await fetch(`https://graph.microsoft.com/v1.0/planner/tasks/${taskId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "If-Match": etag,
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`Failed to update task: ${response.status}`);
      }

      this.logger.debug(`✅ Updated Planner task: ${taskId}`);
      return true;
    } catch (error) {
      this.logger.error("Error updating Planner task:", error);
      return false;
    }
  }

  /**
   * Get tasks from a plan
   */
  async getPlanTasks(planId: string): Promise<PlannerTask[]> {
    try {
      const response = await this.graphGet<{ value: PlannerTask[] }>(
        `/planner/plans/${planId}/tasks`
      );
      return response.value || [];
    } catch (error) {
      this.logger.error("Error getting plan tasks:", error);
      return [];
    }
  }

  // ==================== USER OPERATIONS ====================

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<any | null> {
    try {
      const response = await this.graphGet<any>(`/users/${email}`);
      return response;
    } catch (error) {
      this.logger.error("Error getting user by email:", error);
      return null;
    }
  }

  /**
   * Get current user profile
   */
  async getCurrentUser(): Promise<any | null> {
    try {
      const response = await this.graphGet<any>("/me");
      return response;
    } catch (error) {
      this.logger.error("Error getting current user:", error);
      return null;
    }
  }

  /**
   * Search users by display name
   */
  async searchUsers(query: string): Promise<any[]> {
    try {
      const response = await this.graphGet<{ value: any[] }>(
        `/users?$filter=startswith(displayName,'${query}') or startswith(mail,'${query}')&$top=10`
      );
      return response.value || [];
    } catch (error) {
      this.logger.error("Error searching users:", error);
      return [];
    }
  }

  // ==================== TEAMS/CHAT OPERATIONS ====================

  /**
   * Get chat details
   */
  async getChatDetails(chatId: string): Promise<any | null> {
    try {
      const response = await this.graphGet<any>(`/chats/${chatId}`);
      return response;
    } catch (error) {
      this.logger.error("Error getting chat details:", error);
      return null;
    }
  }

  /**
   * Get chat members
   */
  async getChatMembers(chatId: string): Promise<any[]> {
    try {
      const response = await this.graphGet<{ value: any[] }>(`/chats/${chatId}/members`);
      return response.value || [];
    } catch (error) {
      this.logger.error("Error getting chat members:", error);
      return [];
    }
  }

  /**
   * Get online meeting associated with a chat
   */
  async getChatOnlineMeeting(chatId: string): Promise<any | null> {
    try {
      // For meeting chats, the chatId contains meeting info
      const chatDetails = await this.getChatDetails(chatId);
      if (chatDetails?.onlineMeetingInfo?.joinWebUrl) {
        return chatDetails.onlineMeetingInfo;
      }
      return null;
    } catch (error) {
      this.logger.error("Error getting chat online meeting:", error);
      return null;
    }
  }
}

// Singleton instance
let graphClientInstance: GraphClient | null = null;

export function getGraphClient(logger: ILogger): GraphClient {
  if (!graphClientInstance) {
    const config: GraphConfig = {
      clientId: process.env.AAD_APP_CLIENT_ID || "",
      clientSecret: process.env.SECRET_AAD_APP_CLIENT_SECRET || "",
      tenantId: process.env.AAD_APP_TENANT_ID || "",
    };

    if (!config.clientId || !config.clientSecret || !config.tenantId) {
      logger.warn("⚠️ Graph API configuration incomplete - some features may not work");
    }

    graphClientInstance = new GraphClient(config, logger);
  }

  return graphClientInstance;
}
