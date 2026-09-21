export const GROUPING_POLL_MS = 2500;

export type GroupingPollStatus = "joining" | "proposed" | "published" | "closed" | string | null | undefined;

export function groupingPollShouldRun(input: {
  live: boolean;
  hasSession: boolean;
  status: GroupingPollStatus;
  hidden: boolean;
}): boolean {
  if (!input.live || !input.hasSession) return false;
  if (!input.status || input.status === "closed") return false;
  if (input.hidden) return false;
  return true;
}
