-- The in-app OpenRouter assistant was removed (2026-10-22). Undo 20261026090000_assistant.
DROP TABLE IF EXISTS "AssistantMessage";
DROP TABLE IF EXISTS "AssistantConversation";
DROP TABLE IF EXISTS "AssistantConnection";
ALTER TABLE "Workspace" DROP COLUMN IF EXISTS "assistantEnabled";
