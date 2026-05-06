import { randomUUID } from "crypto";

export function newRunId(): string {
  return randomUUID();
}
