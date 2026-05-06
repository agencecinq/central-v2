export function makeWorkdirSlug(ticketId: number, runId: string): string {
  return `ticket-${ticketId}-${runId.slice(0, 8)}`;
}
