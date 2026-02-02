// Capabilities registry - imports all capability definitions for the manager

// TO ADD NEW CAPABILITIES
// import the capability definition you've defined in the main file of your capability and add to the list below
import { ACTION_ITEMS_CAPABILITY_DEFINITION } from "./actionItems/actionItems";
import { CapabilityDefinition } from "./capability";
import { EMAIL_SENDER_CAPABILITY_DEFINITION } from "./email/email";
import { MEETING_MANAGER_CAPABILITY_DEFINITION } from "./meetings/meetings";
import { PLANNER_CAPABILITY_DEFINITION } from "./planner/planner";
import { SEARCH_CAPABILITY_DEFINITION } from "./search/search";
import { SUMMARIZER_CAPABILITY_DEFINITION } from "./summarizer/summarize";

export const CAPABILITY_DEFINITIONS: CapabilityDefinition[] = [
  SUMMARIZER_CAPABILITY_DEFINITION,
  ACTION_ITEMS_CAPABILITY_DEFINITION,
  SEARCH_CAPABILITY_DEFINITION,
  MEETING_MANAGER_CAPABILITY_DEFINITION,
  EMAIL_SENDER_CAPABILITY_DEFINITION,
  PLANNER_CAPABILITY_DEFINITION,
];
