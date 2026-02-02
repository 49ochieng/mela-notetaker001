/**
 * ============================================================================
 * TEMPLATE CAPABILITY SCHEMA - Collaborator Agent for Armely
 * ============================================================================
 * 
 * This file defines:
 * 1. TypeScript interfaces for function arguments
 * 2. JSON Schema definitions for AI function calling
 * 
 * IMPORTANT NOTES:
 * - Use "as const" for type literals to satisfy TypeScript
 * - Keep interfaces in sync with schemas
 * - Mark optional fields with ? in interfaces and exclude from "required" array
 * - Provide clear descriptions - the AI uses these to understand parameters
 */

// ============================================================================
// PRIMARY FUNCTION - Arguments Interface
// ============================================================================

/**
 * Arguments for the main template processing function
 * RENAME: TemplateFunctionArgs → YourFeatureFunctionArgs
 */
export interface TemplateFunctionArgs {
  /** The user's query or request text */
  query?: string;
  
  /** Type of action to perform */
  action_type?: "analyze" | "process" | "generate" | "validate";
  
  /** Whether to include extended details in response */
  include_details?: boolean;
  
  /** Optional filter parameters */
  filters?: {
    date_range?: string;
    category?: string;
    limit?: number;
  };
}

/**
 * JSON Schema for the primary function
 * RENAME: TEMPLATE_FUNCTION_SCHEMA → YOUR_FEATURE_FUNCTION_SCHEMA
 * 
 * NOTE: Use "as const" after string literals to satisfy TypeScript's strict typing
 */
export const TEMPLATE_FUNCTION_SCHEMA = {
  type: "object" as const,
  properties: {
    query: {
      type: "string" as const,
      description: "The user's query or request to process",
    },
    action_type: {
      type: "string" as const,
      enum: ["analyze", "process", "generate", "validate"],
      description: "Type of action to perform: analyze (examine data), process (transform data), generate (create output), validate (check correctness)",
    },
    include_details: {
      type: "boolean" as const,
      description: "Set to true to include extended information in the response",
    },
    filters: {
      type: "object" as const,
      properties: {
        date_range: {
          type: "string" as const,
          description: "Date range filter (e.g., 'today', 'this week', 'last 7 days')",
        },
        category: {
          type: "string" as const,
          description: "Category to filter by",
        },
        limit: {
          type: "number" as const,
          description: "Maximum number of results to return",
        },
      },
      description: "Optional filters to narrow down results",
    },
  },
  required: [] as string[], // Add required field names here, e.g., ["query"]
};

// ============================================================================
// SECONDARY FUNCTION - Arguments Interface
// ============================================================================

/**
 * Arguments for the secondary/status function
 * RENAME: SecondaryFunctionArgs → YourStatusFunctionArgs
 */
export interface SecondaryFunctionArgs {
  /** What type of status to retrieve */
  status_type?: "full" | "summary" | "health";
  
  /** Whether to include system information */
  include_system_info?: boolean;
}

/**
 * JSON Schema for the secondary function
 * RENAME: SECONDARY_FUNCTION_SCHEMA → YOUR_STATUS_FUNCTION_SCHEMA
 */
export const SECONDARY_FUNCTION_SCHEMA = {
  type: "object" as const,
  properties: {
    status_type: {
      type: "string" as const,
      enum: ["full", "summary", "health"],
      description: "Type of status report: full (all details), summary (key metrics), health (system health check)",
    },
    include_system_info: {
      type: "boolean" as const,
      description: "Include system-level information in the status report",
    },
  },
  required: [] as string[],
};

// ============================================================================
// ADDITIONAL SCHEMAS - Add more as needed
// ============================================================================

/**
 * Example: Schema for a list/search function
 * Uncomment and customize as needed
 */
/*
export interface ListItemsArgs {
  search_query?: string;
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

export const LIST_ITEMS_SCHEMA = {
  type: "object" as const,
  properties: {
    search_query: {
      type: "string" as const,
      description: "Text to search for in items",
    },
    page: {
      type: "number" as const,
      description: "Page number for pagination (starts at 1)",
    },
    page_size: {
      type: "number" as const,
      description: "Number of items per page (default: 10, max: 50)",
    },
    sort_by: {
      type: "string" as const,
      description: "Field to sort results by",
    },
    sort_order: {
      type: "string" as const,
      enum: ["asc", "desc"],
      description: "Sort direction: ascending or descending",
    },
  },
  required: [] as string[],
};
*/

/**
 * Example: Schema for a create/update function
 * Uncomment and customize as needed
 */
/*
export interface CreateItemArgs {
  title: string;
  description?: string;
  category: string;
  priority?: "low" | "medium" | "high" | "urgent";
  assignee_email?: string;
  due_date?: string;
}

export const CREATE_ITEM_SCHEMA = {
  type: "object" as const,
  properties: {
    title: {
      type: "string" as const,
      description: "Title of the item to create",
    },
    description: {
      type: "string" as const,
      description: "Detailed description of the item",
    },
    category: {
      type: "string" as const,
      description: "Category to assign the item to",
    },
    priority: {
      type: "string" as const,
      enum: ["low", "medium", "high", "urgent"],
      description: "Priority level of the item",
    },
    assignee_email: {
      type: "string" as const,
      description: "Email address (UPN) of the person to assign this to",
    },
    due_date: {
      type: "string" as const,
      description: "Due date in ISO format (YYYY-MM-DD)",
    },
  },
  required: ["title", "category"] as string[],
};
*/
