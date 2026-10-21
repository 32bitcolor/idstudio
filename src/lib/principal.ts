import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

// Who an MCP request acts as (docs/MCP.md). The MCP route authenticates the bearer
// token, then runs the request inside `runAsPrincipal`; getSession() reads it from
// here instead of the cookie. So every permission check and server action in the app
// applies to MCP exactly as it does in the browser, with no second copy to drift.
export type Principal = {
  userId: string;
  /** The one workspace the token was issued for. Access checks are limited to it. */
  workspaceId: string;
  tokenId: string;
  canWrite: boolean;
};

const store = new AsyncLocalStorage<Principal>();

export function runAsPrincipal<T>(principal: Principal, fn: () => Promise<T>): Promise<T> {
  return store.run(principal, fn);
}

export function currentPrincipal(): Principal | undefined {
  return store.getStore();
}
