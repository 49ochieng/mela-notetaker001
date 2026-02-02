import { ChatPrompt } from "@microsoft/teams.ai";
import { ILogger } from "@microsoft/teams.common";
import { OpenAIChatModel } from "@microsoft/teams.openai";
import { getGraphClient, EmailMessage } from "../../services/graphClient";
import { MessageContext } from "../../utils/messageContext";
import { BaseCapability, CapabilityDefinition } from "../capability";
import { EMAIL_SENDER_PROMPT } from "./prompt";
import {
  SEND_EMAIL_SCHEMA,
  SendEmailArgs,
  COMPOSE_EMAIL_SCHEMA,
  ComposeEmailArgs,
  SEND_MEETING_SUMMARY_SCHEMA,
  SendMeetingSummaryArgs,
} from "./schema";

/**
 * Email Sender Capability
 * 
 * Handles email operations including:
 * - Sending emails via Microsoft Graph
 * - Composing professional emails
 * - Sending meeting summaries
 * - Sending action item reminders
 */
export class EmailSenderCapability extends BaseCapability {
  readonly name = "email_sender";

  // Store pending email for confirmation (reserved for future confirmation workflow)
  private _pendingEmail: EmailMessage | null = null;
  private _pendingRecipients: string[] = [];

  createPrompt(context: MessageContext): ChatPrompt {
    const modelConfig = this.getModelConfig("email_sender");
    const graphClient = getGraphClient(this.logger);

    const prompt = new ChatPrompt({
      instructions: EMAIL_SENDER_PROMPT,
      model: new OpenAIChatModel({
        model: modelConfig.model,
        apiKey: modelConfig.apiKey,
        endpoint: modelConfig.endpoint,
        apiVersion: modelConfig.apiVersion,
      }),
    })
      .function(
        "compose_email",
        "Compose a professional email based on purpose and content requirements",
        COMPOSE_EMAIL_SCHEMA,
        async (args: ComposeEmailArgs) => {
          this.logger.debug(`✉️ Composing email with purpose:`, args.purpose);

          try {
            let emailTemplate = "";
            const tone = args.tone || "professional";

            // Build email based on purpose
            switch (args.purpose.toLowerCase()) {
              case "meeting summary":
                emailTemplate = this.composeMeetingSummaryTemplate(args);
                break;
              case "follow-up":
                emailTemplate = this.composeFollowUpTemplate(args);
                break;
              case "action items":
                emailTemplate = this.composeActionItemsTemplate(args);
                break;
              default:
                emailTemplate = this.composeGeneralTemplate(args);
            }

            return JSON.stringify({
              success: true,
              draft: emailTemplate,
              tone: tone,
              message: "Email draft created. Please review and provide recipients to send.",
            });
          } catch (error) {
            this.logger.error("Error composing email:", error);
            return JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }
      )
      .function(
        "send_email",
        "Send an email to specified recipients",
        SEND_EMAIL_SCHEMA,
        async (args: SendEmailArgs) => {
          this.logger.debug(`📧 Sending email to:`, args.recipients);

          try {
            // Validate recipients
            if (!args.recipients || args.recipients.length === 0) {
              return JSON.stringify({
                success: false,
                error: "No recipients specified. Please provide at least one email address.",
              });
            }

            // Validate email format
            const invalidEmails = args.recipients.filter(
              email => !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
            );
            if (invalidEmails.length > 0) {
              return JSON.stringify({
                success: false,
                error: `Invalid email format: ${invalidEmails.join(", ")}`,
              });
            }

            // Build email message
            const emailMessage: EmailMessage = {
              subject: args.subject,
              body: {
                contentType: args.is_html ? "HTML" : "Text",
                content: args.body,
              },
              toRecipients: args.recipients.map(email => ({
                emailAddress: { address: email },
              })),
            };

            if (args.cc_recipients && args.cc_recipients.length > 0) {
              emailMessage.ccRecipients = args.cc_recipients.map(email => ({
                emailAddress: { address: email },
              }));
            }

            // Send email using bot's email address (ai.solutions@armely.com)
            const botEmail = graphClient.getBotEmail();
            this.logger.debug(`📧 Sending email from bot address: ${botEmail}`);

            const result = await graphClient.sendEmail(emailMessage);

            if (result) {
              return JSON.stringify({
                success: true,
                message: `Email sent successfully from ${botEmail} to: ${args.recipients.join(", ")}`,
                sentFrom: botEmail,
                sentAt: new Date().toISOString(),
              });
            } else {
              return JSON.stringify({
                success: false,
                error: "Failed to send email. Please check Graph API permissions for Mail.Send.",
              });
            }
          } catch (error) {
            this.logger.error("Error sending email:", error);
            return JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }
      )
      .function(
        "send_meeting_summary_email",
        "Send a formatted meeting summary email to participants",
        SEND_MEETING_SUMMARY_SCHEMA,
        async (args: SendMeetingSummaryArgs) => {
          this.logger.debug(`📋 Sending meeting summary email for:`, args.meeting_subject);

          try {
            // Build HTML email content
            const actionItemsHtml = args.action_items && args.action_items.length > 0
              ? `
                <h3 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 5px;">📋 Action Items</h3>
                <ul style="list-style-type: none; padding-left: 0;">
                  ${args.action_items.map(item => `
                    <li style="padding: 8px 0; border-bottom: 1px solid #eee;">
                      ☐ ${item}
                    </li>
                  `).join("")}
                </ul>
              `
              : "";

            const nextStepsHtml = args.include_next_steps
              ? `
                <h3 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 5px;">🎯 Next Steps</h3>
                <p>Please review the action items above and complete your assigned tasks by the specified deadlines.</p>
              `
              : "";

            const emailBody = `
              <html>
                <body style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <div style="background: linear-gradient(135deg, #6264A7, #464775); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; font-size: 24px;">Meeting Summary</h1>
                    <p style="margin: 5px 0 0 0; opacity: 0.9;">${args.meeting_subject}</p>
                  </div>
                  
                  <div style="background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none;">
                    <h3 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 5px;">📝 Summary</h3>
                    <div style="background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #6264A7;">
                      ${args.summary.replace(/\n/g, "<br/>")}
                    </div>
                    
                    ${actionItemsHtml}
                    ${nextStepsHtml}
                  </div>
                  
                  <div style="background: #464775; color: white; padding: 15px; border-radius: 0 0 8px 8px; text-align: center;">
                    <p style="margin: 0; font-size: 12px;">
                      Generated by <strong>Collaborator Agent</strong> for Armely
                    </p>
                  </div>
                </body>
              </html>
            `;

            const emailMessage: EmailMessage = {
              subject: `📋 Meeting Summary: ${args.meeting_subject}`,
              body: {
                contentType: "HTML",
                content: emailBody,
              },
              toRecipients: args.recipients.map(email => ({
                emailAddress: { address: email },
              })),
            };

            // Send email using bot's email address (ai.solutions@armely.com)
            const botEmail = graphClient.getBotEmail();
            this.logger.debug(`📧 Sending meeting summary from bot address: ${botEmail}`);

            const result = await graphClient.sendEmail(emailMessage);

            if (result) {
              return JSON.stringify({
                success: true,
                message: `Meeting summary email sent successfully from ${botEmail} to: ${args.recipients.join(", ")}`,
                sentFrom: botEmail,
                preview: {
                  subject: emailMessage.subject,
                  recipients: args.recipients,
                  hasActionItems: (args.action_items?.length || 0) > 0,
                  actionItemCount: args.action_items?.length || 0,
                },
                sentAt: new Date().toISOString(),
              });
            } else {
              return JSON.stringify({
                success: false,
                error: "Failed to send meeting summary email. Please check Graph API permissions.",
              });
            }
          } catch (error) {
            this.logger.error("Error sending meeting summary email:", error);
            return JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }
      )
      .function(
        "get_email_recipients_from_context",
        "Extract potential email recipients from the conversation context",
        {
          type: "object",
          properties: {},
        },
        async () => {
          this.logger.debug("🔍 Getting email recipients from context");

          try {
            // Get members from context
            const members = context.members || [];
            
            const recipients = members.map((member: any) => ({
              name: member.name || member.displayName,
              email: member.email || member.mail || `${member.name}@unknown.com`,
            }));

            return JSON.stringify({
              success: true,
              recipients: recipients,
              count: recipients.length,
              note: "These are the participants in the current conversation.",
            });
          } catch (error) {
            this.logger.error("Error getting recipients:", error);
            return JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }
      );

    this.logger.debug("✅ Initialized Email Sender Capability!");
    return prompt;
  }

  private composeMeetingSummaryTemplate(args: ComposeEmailArgs): string {
    const keyPoints = args.key_points || [];
    const meetingSubject = args.meeting_subject || "Recent Meeting";

    return `
Subject: Meeting Summary - ${meetingSubject}

Hi Team,

Thank you for attending today's meeting. Here's a summary of our discussion:

📋 Key Points:
${keyPoints.map(point => `• ${point}`).join("\n")}

Please let me know if I missed anything or if you have any questions.

Best regards
    `.trim();
  }

  private composeFollowUpTemplate(args: ComposeEmailArgs): string {
    const keyPoints = args.key_points || [];

    return `
Subject: Follow-up: ${args.meeting_subject || "Our Discussion"}

Hi,

I wanted to follow up on our recent conversation.

${keyPoints.length > 0 ? `Key items to address:\n${keyPoints.map(point => `• ${point}`).join("\n")}` : ""}

Please let me know if you need any additional information.

Best regards
    `.trim();
  }

  private composeActionItemsTemplate(args: ComposeEmailArgs): string {
    const keyPoints = args.key_points || [];

    return `
Subject: Action Items from ${args.meeting_subject || "Meeting"}

Hi Team,

Following our meeting, here are the assigned action items:

${keyPoints.map((point, index) => `${index + 1}. ${point}`).join("\n")}

Please confirm receipt and let me know if you have any questions about your assignments.

Best regards
    `.trim();
  }

  private composeGeneralTemplate(args: ComposeEmailArgs): string {
    const keyPoints = args.key_points || [];
    const tone = args.tone || "professional";

    const greeting = tone === "formal" ? "Dear Colleague," : "Hi,";
    const closing = tone === "formal" ? "Sincerely," : "Best regards,";

    return `
Subject: ${args.purpose}

${greeting}

${keyPoints.length > 0 ? keyPoints.map(point => `• ${point}`).join("\n") : "I wanted to reach out regarding " + args.purpose + "."}

Please let me know if you have any questions.

${closing}
    `.trim();
  }
}

// Capability definition for manager registration
export const EMAIL_SENDER_CAPABILITY_DEFINITION: CapabilityDefinition = {
  name: "email_sender",
  manager_desc: `**Email Sender**: Use for requests about:
- "send email", "email the team", "send meeting summary"
- "email action items", "send follow-up", "compose email"
- "notify participants", "send reminder", "email recipients"`,
  handler: async (context: MessageContext, logger: ILogger) => {
    const emailCapability = new EmailSenderCapability(logger);
    const result = await emailCapability.processRequest(context);
    if (result.error) {
      logger.error(`❌ Error in Email Sender Capability: ${result.error}`);
      return `Error in Email Sender Capability: ${result.error}`;
    }
    return result.response || "No response from Email Sender Capability";
  },
};
