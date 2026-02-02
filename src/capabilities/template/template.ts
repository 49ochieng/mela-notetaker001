import { ChatPrompt } from "@microsoft/teams.ai";
import { ILogger } from "@microsoft/teams.common";
import { OpenAIChatModel } from "@microsoft/teams.openai";
import { getGraphClient } from "../../services/graphClient";
import { MessageContext } from "../../utils/messageContext";
import { BaseCapability, CapabilityDefinition } from "../capability";
import { TEMPLATE_PROMPT } from "./prompt";
import {
  TEMPLATE_FUNCTION_SCHEMA,
  TemplateFunctionArgs,
  SECONDARY_FUNCTION_SCHEMA,
  SecondaryFunctionArgs,
} from "./schema";

/**
 * ============================================================================
 * TEMPLATE CAPABILITY - Collaborator Agent for Armely
 * ============================================================================
 * 
 * HOW TO CREATE A NEW CAPABILITY:
 * 
 * 1. COPY this entire 'template' folder and rename it (e.g., 'myFeature')
 * 
 * 2. RENAME all instances of:
 *    - "Template" → "MyFeature"
 *    - "template" → "myFeature" 
 *    - "TEMPLATE" → "MY_FEATURE"
 * 
 * 3. UPDATE the files:
 *    - schema.ts: Define your function parameters and interfaces
 *    - prompt.ts: Write AI instructions for your capability
 *    - [capability].ts: Implement your handler logic (this file)
 * 
 * 4. REGISTER in src/capabilities/registry.ts:
 *    ```typescript
 *    import { MY_FEATURE_CAPABILITY_DEFINITION } from "./myFeature/myFeature";
 *    
 *    export const CAPABILITY_DEFINITIONS = [
 *      // ... existing capabilities
 *      MY_FEATURE_CAPABILITY_DEFINITION,
 *    ];
 *    ```
 * 
 * 5. ADD model config in src/utils/config.ts (optional - uses DEFAULT if not set)
 * 
 * ============================================================================
 * 
 * AVAILABLE SERVICES:
 * - graphClient: Microsoft Graph API (users, mail, planner, meetings)
 * - context.memory: Conversation memory for this chat
 * - this.logger: Logging with debug/info/warn/error levels
 * 
 * CONTEXT AVAILABLE:
 * - context.text: User's message text
 * - context.userId: User's ID
 * - context.userUpn: User's email/UPN for Graph API calls
 * - context.userName: User's display name
 * - context.conversationId: Current conversation ID
 * - context.isPersonalChat: true if 1:1 chat
 * - context.members: Array of conversation participants with {name, id, email}
 * - context.startTime/endTime: Time range for queries
 */
export class TemplateCapability extends BaseCapability {
  readonly name = "template"; // CHANGE THIS to your capability name

  createPrompt(context: MessageContext): ChatPrompt {
    const modelConfig = this.getModelConfig("template"); // CHANGE "template" to your capability name
    const graphClient = getGraphClient(this.logger); // Microsoft Graph client for API calls

    const prompt = new ChatPrompt({
      instructions: TEMPLATE_PROMPT,
      model: new OpenAIChatModel({
        model: modelConfig.model,
        apiKey: modelConfig.apiKey,
        endpoint: modelConfig.endpoint,
        apiVersion: modelConfig.apiVersion,
      }),
    })
      // ========================================
      // PRIMARY FUNCTION - Main capability action
      // ========================================
      .function(
        "process_template_request", // CHANGE to descriptive function name
        "Process a template-specific request", // CHANGE to describe what this function does
        TEMPLATE_FUNCTION_SCHEMA,
        async (args: TemplateFunctionArgs) => {
          this.logger.debug(`🔧 Processing template request with args:`, args);

          try {
            // ============================================
            // YOUR IMPLEMENTATION GOES HERE
            // ============================================
            
            // Example: Get user info via Graph API
            // const user = await graphClient.getUserByEmail(context.userUpn || "");
            
            // Example: Get conversation memory
            // const recentMessages = await context.memory.values();
            
            // Example: Use the bot email for sending
            // const botEmail = graphClient.getBotEmail(); // ai.solutions@armely.com

            // Suppress unused variable warning for template
            void graphClient;
            
            // Build your response
            const result = {
              success: true,
              message: `Template processed for: ${args.query || "no query provided"}`,
              user: context.userName,
              chatType: context.isPersonalChat ? "personal" : "group",
              timestamp: new Date().toISOString(),
            };

            this.logger.debug(`✅ Template request completed successfully`);
            return JSON.stringify(result);

          } catch (error) {
            this.logger.error("Error in template capability:", error);
            return JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }
      )
      // ========================================
      // SECONDARY FUNCTION - Additional action
      // ========================================
      .function(
        "get_template_status", // CHANGE to your function name
        "Get status or additional information", // CHANGE description
        SECONDARY_FUNCTION_SCHEMA,
        async (args: SecondaryFunctionArgs) => {
          this.logger.debug(`📊 Getting template status with args:`, args);

          try {
            // Example: Return status information
            return JSON.stringify({
              success: true,
              status: "ready",
              capabilities: ["feature1", "feature2"],
              context: {
                user: context.userName,
                conversationId: context.conversationId,
                memberCount: context.members.length,
              },
            });

          } catch (error) {
            this.logger.error("Error getting status:", error);
            return JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }
      );

    // Add more functions as needed using .function() chaining

    this.logger.debug("✅ Initialized Template Capability!");
    return prompt;
  }
}

/**
 * ============================================================================
 * CAPABILITY DEFINITION - Required for Manager Registration
 * ============================================================================
 * 
 * The manager uses this definition to:
 * 1. Know when to delegate requests to this capability
 * 2. Display capability description in the manager prompt
 * 3. Route user requests appropriately
 * 
 * IMPORTANT: Update manager_desc with clear trigger words and use cases
 */
export const TEMPLATE_CAPABILITY_DEFINITION: CapabilityDefinition = {
  name: "template", // CHANGE to match class name property
  
  // This description tells the manager WHEN to use this capability
  // Be specific about trigger words and use cases
  manager_desc: `**Template Capability**: Use when the user wants to:
- Process template-specific requests
- Handle [YOUR SPECIFIC USE CASE 1]
- Manage [YOUR SPECIFIC USE CASE 2]
- Keywords: "template", "process", "[your keywords]"

Examples:
- "process this template"
- "[your example request 1]"
- "[your example request 2]"`,

  handler: async (context: MessageContext, logger: ILogger) => {
    const capability = new TemplateCapability(logger);
    const result = await capability.processRequest(context);
    
    if (result.error) {
      logger.error(`❌ Error in Template Capability: ${result.error}`);
      return `Error in Template Capability: ${result.error}`;
    }
    
    return result.response || "No response from Template Capability";
  },
};
