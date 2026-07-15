-- Add a MANAGER role between ADMIN and MEMBER. Purely additive to the enum —
-- hand-authored only to keep it non-interactive, not because of destructive risk.
ALTER TYPE "Role" ADD VALUE 'MANAGER';
