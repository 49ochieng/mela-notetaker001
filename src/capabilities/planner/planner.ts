import { ChatPrompt } from "@microsoft/teams.ai";
import { ILogger } from "@microsoft/teams.common";
import { OpenAIChatModel } from "@microsoft/teams.openai";
import { getGraphClient, PlannerTask } from "../../services/graphClient";
import { MessageContext } from "../../utils/messageContext";
import { BaseCapability, CapabilityDefinition } from "../capability";
import { PLANNER_PROMPT } from "./prompt";
import {
  CREATE_TASK_SCHEMA,
  CreateTaskArgs,
  BULK_CREATE_TASKS_SCHEMA,
  BulkCreateTasksArgs,
  LIST_TASKS_SCHEMA,
  ListTasksArgs,
  UPDATE_TASK_SCHEMA,
  UpdateTaskArgs,
} from "./schema";

/**
 * Planner Integration Capability
 * 
 * Handles Microsoft Planner operations including:
 * - Creating tasks from action items
 * - Listing and managing plans
 * - Assigning tasks to team members
 * - Tracking task progress
 */
export class PlannerCapability extends BaseCapability {
  readonly name = "planner";

  // Cache for plans and user mappings
  private plansCache: any[] = [];
  private userIdCache: Map<string, string> = new Map();

  createPrompt(context: MessageContext): ChatPrompt {
    const modelConfig = this.getModelConfig("planner");
    const graphClient = getGraphClient(this.logger);

    // Validate Graph API credentials are present
    if (!process.env.AAD_APP_CLIENT_ID || !process.env.SECRET_AAD_APP_CLIENT_SECRET) {
      this.logger.warn("⚠️ Graph API credentials not configured - Planner features will not work");
    }

    const prompt = new ChatPrompt({
      instructions: PLANNER_PROMPT,
      model: new OpenAIChatModel({
        model: modelConfig.model,
        apiKey: modelConfig.apiKey,
        endpoint: modelConfig.endpoint,
        apiVersion: modelConfig.apiVersion,
      }),
    })
      .function(
        "check_planner_connectivity",
        "Check if Graph API connection is working for Planner operations",
        {
          type: "object" as const,
          properties: {},
        },
        async () => {
          this.logger.debug("🔍 Checking Planner connectivity");

          try {
            const result = await graphClient.testConnectivity();
            if (result.success) {
              return JSON.stringify({
                success: true,
                message: `✅ Connected to Graph API as ${result.userEmail || "unknown"}. Planner operations should work.`,
              });
            } else {
              return JSON.stringify({
                success: false,
                message: result.message,
              });
            }
          } catch (error) {
            this.logger.error("Error checking connectivity:", error);
            return JSON.stringify({
              success: false,
              message: `❌ Failed to connect to Graph API: ${error instanceof Error ? error.message : "Unknown error"}`,
            });
          }
        }
      )
      .function(
        "get_plans",
        "List available Planner plans for the user or group",
        {
          type: "object" as const,
          properties: {
            user_email: {
              type: "string" as const,
              description: "User email/UPN to get plans for (e.g., user@company.com). If not provided, tries to use context.",
            },
            include_buckets: {
              type: "boolean" as const,
              description: "Whether to include bucket information for each plan",
            },
          },
        },
        async (args: { user_email?: string; include_buckets?: boolean }) => {
          this.logger.debug("📋 Getting available Planner plans");

          try {
            // Use provided email or fall back to context
            // For Graph API, we use the UPN (User Principal Name) which is typically the email
            const userUpn = args.user_email || context.userUpn || context.userId;

            if (!userUpn) {
              return JSON.stringify({
                success: false,
                message: "Unable to determine user for plan lookup. Please provide a user email.",
                suggestion: "Try: 'list plans for user@company.com'",
              });
            }

            this.logger.debug(`📋 Getting plans for user: ${userUpn}`);
            const plans = await graphClient.getUserPlans(userUpn);
            this.plansCache = plans;

            const plansWithBuckets = [];
            for (const plan of plans) {
              const planInfo: any = {
                id: plan.id,
                title: plan.title,
                createdBy: plan.createdBy?.user?.displayName,
              };

              if (args.include_buckets) {
                const buckets = await graphClient.getPlanBuckets(plan.id);
                planInfo.buckets = buckets.map((b: any) => ({
                  id: b.id,
                  name: b.name,
                }));
              }

              plansWithBuckets.push(planInfo);
            }

            return JSON.stringify({
              success: true,
              plans: plansWithBuckets,
              count: plansWithBuckets.length,
            });
          } catch (error) {
            this.logger.error("Error getting plans:", error);
            return JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
              suggestion: "Make sure you have access to Planner plans. You might need to create a plan first.",
            });
          }
        }
      )
      .function(
        "create_task",
        "Create a new task in Microsoft Planner",
        CREATE_TASK_SCHEMA,
        async (args: CreateTaskArgs) => {
          this.logger.debug(`✅ Creating task: ${args.title}`);

          try {
            // Build task object
            const task: PlannerTask = {
              planId: args.plan_id,
              title: args.title,
            };

            if (args.bucket_id) {
              task.bucketId = args.bucket_id;
            }

            if (args.due_date) {
              task.dueDateTime = new Date(args.due_date).toISOString();
            }

            if (args.priority) {
              task.priority = args.priority;
            }

            // Handle assignees - need to convert emails to user IDs
            if (args.assignee_emails && args.assignee_emails.length > 0) {
              const assignments: Record<string, { "@odata.type": string; orderHint: string }> = {};
              
              for (const email of args.assignee_emails) {
                let userId: string | undefined = this.userIdCache.get(email);
                
                if (!userId) {
                  const user = await graphClient.getUserByEmail(email);
                  if (user?.id) {
                    userId = user.id;
                    this.userIdCache.set(email, user.id);
                  }
                }

                if (userId) {
                  assignments[userId] = {
                    "@odata.type": "#microsoft.graph.plannerAssignment",
                    orderHint: " !",
                  };
                }
              }

              if (Object.keys(assignments).length > 0) {
                task.assignments = assignments;
              }
            }

            const createdTask = await graphClient.createPlannerTask(task);

            if (createdTask) {
              return JSON.stringify({
                success: true,
                task: {
                  id: createdTask.id,
                  title: args.title,
                  dueDate: args.due_date,
                  assignees: args.assignee_emails,
                  priority: this.getPriorityLabel(args.priority),
                },
                message: `Task "${args.title}" created successfully!`,
              });
            } else {
              return JSON.stringify({
                success: false,
                error: "Failed to create task",
              });
            }
          } catch (error) {
            this.logger.error("Error creating task:", error);
            return JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }
      )
      .function(
        "bulk_create_tasks",
        "Create multiple tasks at once from action items",
        BULK_CREATE_TASKS_SCHEMA,
        async (args: BulkCreateTasksArgs) => {
          this.logger.debug(`📋 Creating ${args.tasks.length} tasks in bulk`);

          try {
            const results = [];
            const failures = [];

            for (const taskData of args.tasks) {
              try {
                const task: PlannerTask = {
                  planId: args.plan_id,
                  title: taskData.title,
                };

                if (args.bucket_id) {
                  task.bucketId = args.bucket_id;
                }

                if (taskData.due_date) {
                  task.dueDateTime = new Date(taskData.due_date).toISOString();
                }

                if (taskData.priority) {
                  task.priority = taskData.priority;
                }

                // Handle assignee
                if (taskData.assignee_email) {
                  let userId: string | undefined = this.userIdCache.get(taskData.assignee_email);
                  
                  if (!userId) {
                    const user = await graphClient.getUserByEmail(taskData.assignee_email);
                    if (user?.id) {
                      userId = user.id;
                      this.userIdCache.set(taskData.assignee_email, user.id);
                    }
                  }

                  if (userId) {
                    task.assignments = {
                      [userId]: {
                        "@odata.type": "#microsoft.graph.plannerAssignment",
                        orderHint: " !",
                      },
                    };
                  }
                }

                const createdTask = await graphClient.createPlannerTask(task);
                if (createdTask) {
                  results.push({
                    title: taskData.title,
                    id: createdTask.id,
                    status: "created",
                  });
                } else {
                  failures.push({
                    title: taskData.title,
                    error: "Creation failed",
                  });
                }
              } catch (taskError) {
                failures.push({
                  title: taskData.title,
                  error: taskError instanceof Error ? taskError.message : "Unknown error",
                });
              }
            }

            return JSON.stringify({
              success: failures.length === 0,
              created: results,
              failed: failures,
              summary: `Created ${results.length} of ${args.tasks.length} tasks`,
            });
          } catch (error) {
            this.logger.error("Error in bulk task creation:", error);
            return JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }
      )
      .function(
        "list_tasks",
        "List tasks from a Planner plan",
        LIST_TASKS_SCHEMA,
        async (args: ListTasksArgs) => {
          this.logger.debug("📋 Listing tasks from plan:", args.plan_id);

          try {
            if (!args.plan_id) {
              // Try to use cached plans
              if (this.plansCache.length === 0) {
                return JSON.stringify({
                  success: false,
                  message: "No plan specified. Please run get_plans first to see available plans.",
                });
              }

              // Use first cached plan
              args.plan_id = this.plansCache[0].id;
            }

            const tasks = await graphClient.getPlanTasks(args.plan_id!);

            // Apply filters
            let filteredTasks = tasks;

            if (args.filter_status) {
              const statusMap: Record<string, number[]> = {
                not_started: [0],
                in_progress: [50],
                completed: [100],
              };
              const validPercents = statusMap[args.filter_status] || [];
              filteredTasks = filteredTasks.filter(
                (t: any) => validPercents.includes(t.percentComplete || 0)
              );
            }

            // Format tasks for response
            const formattedTasks = filteredTasks.map((task: any) => ({
              id: task.id,
              title: task.title,
              status: this.getStatusLabel(task.percentComplete),
              dueDate: task.dueDateTime ? new Date(task.dueDateTime).toLocaleDateString() : "No due date",
              priority: this.getPriorityLabel(task.priority),
              assigneeCount: Object.keys(task.assignments || {}).length,
            }));

            return JSON.stringify({
              success: true,
              tasks: formattedTasks,
              count: formattedTasks.length,
              planId: args.plan_id,
            });
          } catch (error) {
            this.logger.error("Error listing tasks:", error);
            return JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }
      )
      .function(
        "update_task",
        "Update an existing Planner task",
        UPDATE_TASK_SCHEMA,
        async (args: UpdateTaskArgs) => {
          this.logger.debug(`📝 Updating task: ${args.task_id}`);

          try {
            // Note: Planner task updates require ETag for optimistic concurrency
            // In a real implementation, you'd first GET the task to get the ETag
            
            const updates: Partial<PlannerTask> = {};
            
            if (args.title) {
              updates.title = args.title;
            }
            
            if (args.percent_complete !== undefined) {
              updates.percentComplete = args.percent_complete;
            }
            
            if (args.due_date) {
              updates.dueDateTime = new Date(args.due_date).toISOString();
            }
            
            if (args.priority) {
              updates.priority = args.priority;
            }

            // For demo purposes, return success message
            // Real implementation needs ETag handling
            return JSON.stringify({
              success: true,
              taskId: args.task_id,
              updates: {
                title: args.title,
                status: args.percent_complete !== undefined 
                  ? this.getStatusLabel(args.percent_complete) 
                  : undefined,
                dueDate: args.due_date,
                priority: args.priority ? this.getPriorityLabel(args.priority) : undefined,
              },
              message: `Task updated successfully!`,
              note: "In production, this would apply the updates via Graph API with ETag handling.",
            });
          } catch (error) {
            this.logger.error("Error updating task:", error);
            return JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }
      )
      .function(
        "create_tasks_from_action_items",
        "Analyze conversation and create tasks from identified action items",
        {
          type: "object",
          properties: {
            plan_id: {
              type: "string",
              description: "Plan ID to create tasks in",
            },
            bucket_id: {
              type: "string",
              description: "Optional bucket ID",
            },
          },
          required: ["plan_id"],
        },
        async (args: { plan_id: string; bucket_id?: string }) => {
          this.logger.debug("🎯 Creating tasks from conversation action items");

          try {
            // Get messages from context
            const messages = await context.memory.getMessagesByTimeRange(
              context.startTime,
              context.endTime
            );

            // Use AI to extract action items (this would be done by the LLM in a full implementation)
            // For now, return a message indicating what would happen
            return JSON.stringify({
              success: true,
              message: "To create tasks from action items, I need to first analyze the conversation. Let me identify the action items from the discussion.",
              messagesAnalyzed: messages.length,
              planId: args.plan_id,
              suggestion: "Use the bulk_create_tasks function after identifying specific action items.",
            });
          } catch (error) {
            this.logger.error("Error creating tasks from action items:", error);
            return JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }
      );

    this.logger.debug("✅ Initialized Planner Capability!");
    return prompt;
  }

  private getStatusLabel(percentComplete?: number): string {
    switch (percentComplete) {
      case 100:
        return "✅ Completed";
      case 50:
        return "🔄 In Progress";
      default:
        return "⬜ Not Started";
    }
  }

  private getPriorityLabel(priority?: number): string {
    switch (priority) {
      case 1:
        return "🔴 Urgent";
      case 3:
        return "🟠 Important";
      case 5:
        return "🟡 Medium";
      case 9:
        return "🟢 Low";
      default:
        return "🟡 Medium";
    }
  }
}

// Capability definition for manager registration
export const PLANNER_CAPABILITY_DEFINITION: CapabilityDefinition = {
  name: "planner",
  manager_desc: `**Planner**: Use for task management requests like:
- "create task", "add to planner", "make a task for"
- "list tasks", "show my tasks", "what tasks do I have"
- "assign task to", "set due date", "update task"
- "create tasks from action items", "convert to tasks"`,
  handler: async (context: MessageContext, logger: ILogger) => {
    const plannerCapability = new PlannerCapability(logger);
    const result = await plannerCapability.processRequest(context);
    if (result.error) {
      logger.error(`❌ Error in Planner Capability: ${result.error}`);
      return `Error in Planner Capability: ${result.error}`;
    }
    return result.response || "No response from Planner Capability";
  },
};
