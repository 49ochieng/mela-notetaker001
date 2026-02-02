export const CREATE_TASK_SCHEMA = {
  type: "object" as const,
  properties: {
    title: {
      type: "string" as const,
      description: "Title of the task",
    },
    plan_id: {
      type: "string" as const,
      description: "ID of the Planner plan to add the task to",
    },
    bucket_id: {
      type: "string" as const,
      description: "Optional bucket ID within the plan",
    },
    assignee_emails: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "Email addresses of people to assign the task to",
    },
    due_date: {
      type: "string" as const,
      description: "Due date in ISO format (YYYY-MM-DD)",
    },
    priority: {
      type: "number" as const,
      enum: [1, 3, 5, 9],
      description: "Priority: 1=Urgent, 3=Important, 5=Medium, 9=Low",
    },
    description: {
      type: "string" as const,
      description: "Additional details about the task",
    },
  },
  required: ["title", "plan_id"] as string[],
};

export interface CreateTaskArgs {
  title: string;
  plan_id: string;
  bucket_id?: string;
  assignee_emails?: string[];
  due_date?: string;
  priority?: number;
  description?: string;
}

export const BULK_CREATE_TASKS_SCHEMA = {
  type: "object" as const,
  properties: {
    tasks: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          title: { type: "string" as const },
          assignee_email: { type: "string" as const },
          due_date: { type: "string" as const },
          priority: { type: "number" as const },
        },
        required: ["title"] as string[],
      },
      description: "Array of tasks to create",
    },
    plan_id: {
      type: "string" as const,
      description: "Plan ID for all tasks",
    },
    bucket_id: {
      type: "string" as const,
      description: "Optional bucket ID for all tasks",
    },
  },
  required: ["tasks", "plan_id"] as string[],
};

export interface BulkCreateTasksArgs {
  tasks: Array<{
    title: string;
    assignee_email?: string;
    due_date?: string;
    priority?: number;
  }>;
  plan_id: string;
  bucket_id?: string;
}

export const LIST_TASKS_SCHEMA = {
  type: "object" as const,
  properties: {
    plan_id: {
      type: "string" as const,
      description: "ID of the plan to list tasks from",
    },
    filter_assignee: {
      type: "string" as const,
      description: "Filter tasks by assignee email",
    },
    filter_status: {
      type: "string" as const,
      enum: ["not_started", "in_progress", "completed"],
      description: "Filter by task status",
    },
  },
  required: [] as string[],
};

export interface ListTasksArgs {
  plan_id?: string;
  filter_assignee?: string;
  filter_status?: string;
}

export const UPDATE_TASK_SCHEMA = {
  type: "object" as const,
  properties: {
    task_id: {
      type: "string" as const,
      description: "ID of the task to update",
    },
    title: {
      type: "string" as const,
      description: "New title for the task",
    },
    percent_complete: {
      type: "number" as const,
      enum: [0, 50, 100],
      description: "Completion percentage: 0=Not started, 50=In progress, 100=Complete",
    },
    due_date: {
      type: "string" as const,
      description: "New due date in ISO format",
    },
    priority: {
      type: "number" as const,
      enum: [1, 3, 5, 9],
      description: "New priority level",
    },
  },
  required: ["task_id"] as string[],
};

export interface UpdateTaskArgs {
  task_id: string;
  title?: string;
  percent_complete?: number;
  due_date?: string;
  priority?: number;
}
