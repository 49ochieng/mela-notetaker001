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
   * Make a GET request to Microsoft Graph API with retry logic
   */
  private async graphGet<T>(endpoint: string, retries = 3): Promise<T> {
    const token = await this.getAccessToken();
    let lastError: any = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          lastError = new Error(`Graph API error: ${response.status}`);
          
          // Don't retry on 4xx errors except 429 (rate limit)
          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            const errorText = await response.text();
            this.logger.error(`Graph API GET error: ${response.status} - ${errorText}`);
            throw lastError;
          }
          
          // Retry on 429 (rate limit) or 5xx errors
          if (attempt < retries) {
            const delay = Math.pow(2, attempt - 1) * 1000; // exponential backoff
            this.logger.debug(`Rate limited or server error, retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }

        return response.json();
      } catch (error) {
        lastError = error;
        if (attempt < retries) {
          const delay = Math.pow(2, attempt - 1) * 1000;
          this.logger.debug(`Retry attempt ${attempt}/${retries} in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    this.logger.error(`Graph API GET failed after ${retries} retries:`, lastError);
    throw lastError;
  }

  /**
   * Make a POST request to Microsoft Graph API with retry logic
   */
  private async graphPost<T>(endpoint: string, body: any, retries = 3): Promise<T> {
    const token = await this.getAccessToken();
    let lastError: any = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          lastError = new Error(`Graph API error: ${response.status}`);
          
          // Don't retry on 4xx errors except 429 (rate limit)
          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            const errorText = await response.text();
            this.logger.error(`Graph API POST error: ${response.status} - ${errorText}`);
            throw lastError;
          }
          
          // Retry on 429 (rate limit) or 5xx errors
          if (attempt < retries) {
            const delay = Math.pow(2, attempt - 1) * 1000; // exponential backoff
            this.logger.debug(`Rate limited or server error, retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }

        // Handle 204 No Content responses
        if (response.status === 204) {
          return {} as T;
        }

        return response.json();
      } catch (error) {
        lastError = error;
        if (attempt < retries) {
          const delay = Math.pow(2, attempt - 1) * 1000;
          this.logger.debug(`Retry attempt ${attempt}/${retries} in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    this.logger.error(`Graph API POST failed after ${retries} retries:`, lastError);
    throw lastError;
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
   * Test Graph API connectivity and credentials
   */
  async testConnectivity(): Promise<{ success: boolean; message: string; userEmail?: string }> {
    try {
      this.logger.debug("🧪 Testing Graph API connectivity...");
      const user = await this.getCurrentUser();
      
      if (!user) {
        return {
          success: false,
          message: "❌ Failed to retrieve user information. Check credentials.",
        };
      }

      if (!user.mail) {
        this.logger.warn(`⚠️ User found but no email: ${user.displayName}`);
        return {
          success: false,
          message: `User found (${user.displayName}) but no email address configured.`,
        };
      }

      this.logger.info(`✅ Graph API connected! User: ${user.displayName} (${user.mail})`);
      return {
        success: true,
        message: `✅ Connected to Graph API as ${user.displayName}`,
        userEmail: user.mail,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      this.logger.error("❌ Graph API connectivity test failed:", error);
      return {
        success: false,
        message: `❌ Graph API test failed: ${errorMsg}`,
      };
    }
  }

  /**
   * Get the bot's email address
   */
  getBotEmail(): string {
    // Return configured bot email or use a default
    return process.env.BOT_EMAIL || "bot@company.onmicrosoft.com";
  }

  /**
   * Send a test email to verify email capabilities
   */
  async sendTestEmail(recipientEmail: string): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.debug(`🧪 Sending test email to: ${recipientEmail}`);

      // Validate email format
      if (!recipientEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        return {
          success: false,
          message: `❌ Invalid email format: ${recipientEmail}`,
        };
      }

      const testMessage: EmailMessage = {
        subject: "[TEST] Collaborator Bot - Email Integration Test",
        body: {
          contentType: "HTML",
          content: `
<html>
  <body>
    <h2>✅ Email Test Successful!</h2>
    <p>This is a test email from the Collaborator bot to verify email sending capabilities.</p>
    <hr>
    <p><strong>Test Details:</strong></p>
    <ul>
      <li>Sent at: ${new Date().toISOString()}</li>
      <li>From: Collaborator Bot</li>
      <li>Status: Email delivery working ✓</li>
    </ul>
    <hr>
    <p>If you received this, email integration is working correctly! The Collaborator bot can now:</p>
    <ul>
      <li>Send meeting summaries</li>
      <li>Share action items</li>
      <li>Send task assignments</li>
      <li>Compose professional emails</li>
    </ul>
  </body>
</html>
          `,
        },
        toRecipients: [
          {
            emailAddress: { address: recipientEmail },
          },
        ],
      };

      const result = await this.sendEmail(testMessage);
      if (result) {
        this.logger.info(`✅ Test email sent successfully to ${recipientEmail}`);
        return {
          success: true,
          message: `✅ Test email sent successfully to ${recipientEmail}!`,
        };
      } else {
        return {
          success: false,
          message: `❌ Failed to send test email. Check Mail.Send permissions in Graph API.`,
        };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      this.logger.error("❌ Test email failed:", error);
      return {
        success: false,
        message: `❌ Test email failed: ${errorMsg}`,
      };
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

  /**
   * Get meeting recording URL (requires permissions)
   */
  async getMeetingRecordingUrl(chatId: string): Promise<string | null> {
    try {
      this.logger.debug(`🎥 Getting meeting recording URL for chat: ${chatId}`);
      
      // Get the online meeting info
      const chatDetails = await this.getChatDetails(chatId);
      if (!chatDetails) return null;

      // Note: Recording URL would come from the onlineMeetingInfo
      // In real implementation, you'd need to check the call transcripts endpoint
      const recordingUrl = (chatDetails as any).recordingUrl;
      
      if (recordingUrl) {
        this.logger.debug(`✅ Found recording: ${recordingUrl}`);
        return recordingUrl;
      }
      
      return null;
    } catch (error) {
      this.logger.error("Error getting meeting recording:", error);
      return null;
    }
  }

  /**
   * List available transcripts for a meeting
   */
  async listMeetingTranscripts(userId: string, meetingId: string): Promise<any[]> {
    try {
      this.logger.debug(`📋 Listing transcripts for meeting: ${meetingId}`);
      
      const response = await this.graphGet<{ value: any[] }>(
        `/users/${userId}/onlineMeetings/${meetingId}/transcripts`
      );
      
      return response.value || [];
    } catch (error) {
      this.logger.error("Error listing meeting transcripts:", error);
      return [];
    }
  }

  /**
   * Get full transcript content with speaker attribution
   */
  async getFullMeetingTranscript(
    userId: string,
    meetingId: string,
    transcriptId: string
  ): Promise<{ success: boolean; transcript: TranscriptContent[]; rawText: string; message: string }> {
    try {
      this.logger.debug(`📋 Getting full meeting transcript content`);
      
      // Get VTT format transcript
      const vttContent = await this.getTranscriptContent(userId, meetingId, transcriptId);
      
      if (!vttContent) {
        return {
          success: false,
          transcript: [],
          rawText: "",
          message: "❌ Failed to fetch transcript content",
        };
      }

      // Parse VTT to structured format
      const parsedTranscript = this.parseVttTranscript(vttContent);
      
      this.logger.info(`✅ Successfully parsed transcript with ${parsedTranscript.length} segments`);

      return {
        success: true,
        transcript: parsedTranscript,
        rawText: vttContent,
        message: `✅ Retrieved transcript with ${parsedTranscript.length} speaker segments`,
      };
    } catch (error) {
      this.logger.error("Error getting full transcript:", error);
      return {
        success: false,
        transcript: [],
        rawText: "",
        message: `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Search within meeting transcript
   */
  searchTranscript(
    transcript: TranscriptContent[],
    searchQuery: string,
    _caseSensitive = false
  ): TranscriptContent[] {
    const query = _caseSensitive ? searchQuery : searchQuery.toLowerCase();
    
    return transcript.filter(entry => {
      const text = _caseSensitive ? entry.text : entry.text.toLowerCase();
      return text.includes(query);
    });
  }

  /**
   * Get transcript summary (speaker turns, timestamps)
   */
  getTranscriptSummary(transcript: TranscriptContent[]): {
    speakers: Map<string, number>;
    totalDuration: string;
    segments: number;
    speakerChangePoints: { speaker: string; timestamp: string; text: string }[];
  } {
    const speakers = new Map<string, number>();
    const speakerChangePoints: { speaker: string; timestamp: string; text: string }[] = [];
    let lastSpeaker = "";

    for (const entry of transcript) {
      if (entry.speakerName) {
        speakers.set(entry.speakerName, (speakers.get(entry.speakerName) || 0) + 1);
        
        // Track speaker changes
        if (entry.speakerName !== lastSpeaker) {
          speakerChangePoints.push({
            speaker: entry.speakerName,
            timestamp: entry.timestamp,
            text: entry.text.substring(0, 50) + "...",
          });
          lastSpeaker = entry.speakerName;
        }
      }
    }

    return {
      speakers,
      totalDuration: transcript.length > 0 ? `${Math.ceil(transcript.length / 2)} minutes (approx)` : "0 minutes",
      segments: transcript.length,
      speakerChangePoints: speakerChangePoints.slice(0, 10), // First 10 speaker changes
    };
  }

  /**
   * Test meeting transcript access
   */
  async testMeetingTranscriptAccess(userId: string): Promise<{
    success: boolean;
    message: string;
    recommendation: string;
  }> {
    try {
      this.logger.debug("🧪 Testing meeting transcript access");

      // Try to get user's recent meetings
      const meetings = await this.getUserMeetings(userId);

      if (meetings.length === 0) {
        return {
          success: false,
          message: "❌ No recent meetings found for this user",
          recommendation: "Join a Teams meeting and enable transcription to test this feature",
        };
      }

      // Check for transcripts in first meeting
      const firstMeeting = meetings[0];
      const transcripts = await this.listMeetingTranscripts(userId, firstMeeting.id!);

      if (transcripts.length > 0) {
        return {
          success: true,
          message: `✅ Found ${transcripts.length} transcript(s) for recent meeting: "${firstMeeting.subject}"`,
          recommendation: "Meeting transcripts are available and can be analyzed",
        };
      } else {
        return {
          success: true, // Permission is OK, just no transcripts yet
          message: `⚠️ No transcripts available for "${firstMeeting.subject}" (transcription may not have been enabled)`,
          recommendation: "Enable transcription in future meetings to capture transcripts",
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `❌ Cannot access meeting transcripts: ${error instanceof Error ? error.message : "Unknown error"}`,
        recommendation: "Ensure you have OnlineMeetings.Read.All permission in Azure Portal",
      };
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

    // Validate configuration
    const missingFields: string[] = [];
    if (!config.clientId) missingFields.push("AAD_APP_CLIENT_ID");
    if (!config.clientSecret) missingFields.push("SECRET_AAD_APP_CLIENT_SECRET");
    if (!config.tenantId) missingFields.push("AAD_APP_TENANT_ID");

    if (missingFields.length > 0) {
      logger.error(
        `⚠️ CRITICAL: Missing Graph API configuration. Required environment variables not set:\n${missingFields.map(f => `   - ${f}`).join("\n")}\n\nGraph API features will NOT work. Please configure these variables in your .env file.`
      );
    } else {
      logger.debug("✅ Graph API configuration loaded successfully");
    }

    graphClientInstance = new GraphClient(config, logger);
  }

  return graphClientInstance;
}
