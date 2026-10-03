/**
 * AI Assistant Tools — stable barrel (deferred-splits cleanup).
 * Schemas/definitions, executors, and session-memory helpers live in ./tools/*.
 * @module backend/ai/tools
 */

export {
  TERMINAL_TOOL,
  TOOL_DEFINITIONS,
  buildToolDefinitions,
  type ToolDefinition,
  type ToolContext,
} from './tools/definitions'
export { executeTool, LOOKUP_TOOL_NAMES } from './tools/executors'
export {
  getRecentBookings,
  formatBookingsMemory,
  summarizeSession,
  deriveSessionTitle,
  generateSessionTitle,
  getRecentSessionSummaries,
  formatSessionMemory,
  type RecentBooking,
  type SessionSummary,
} from './tools/memory'
