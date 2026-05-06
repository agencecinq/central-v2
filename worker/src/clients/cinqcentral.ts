import { getEnv } from "../config/env.js";

export type AutoResolveContext = {
  ticket: {
    id: number;
    title: string;
    description: string | null;
    labels: string[];
    assignee_email: string | null;
    created_at: string | null;
  };
  project: {
    id: number;
    name: string;
    repo_url: string | null;
    repo_name: string | null;
    repo_default_branch: string;
    slack_channel_id: string | null;
    auto_resolve_enabled: boolean;
    detected_stack: Record<string, unknown> | null;
    detected_stack_at: string | null;
  };
};

export type RunStatus =
  | "classifying"
  | "running"
  | "pr_opened"
  | "skipped"
  | "failed";

export type RunByBranch = {
  id: string;
  ticket_id: number;
  ticket_title: string;
  branch_name: string | null;
  pr_number: number | null;
  pr_url: string | null;
  commit_sha: string | null;
  slack_ts: string | null;
  status: string;
  project: {
    id: number;
    name: string;
    slack_channel_id: string | null;
    repo_url: string | null;
    repo_name: string | null;
  };
};

export type RunReport = {
  ticket_id: number;
  run_id: string;
  status: RunStatus;
  pr_url?: string | null;
  pr_number?: number | null;
  branch_name?: string | null;
  commit_sha?: string | null;
  slack_ts?: string | null;
  agent_summary?: string | null;
  skip_reason?: string | null;
  error?: string | null;
  tokens_input?: number | null;
  tokens_output?: number | null;
  cost_usd?: number | null;
  started_at?: string | null;
  finished_at?: string | null;
};

export class CinqCentralClient {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor() {
    const env = getEnv();
    this.baseUrl = env.CINQCENTRAL_BASE_URL.replace(/\/$/, "");
    this.token = env.AUTORESOLVE_INTERNAL_TOKEN;
  }

  async getAutoResolveContext(ticketId: number): Promise<AutoResolveContext> {
    const res = await this.request(
      `/api/internal/tickets/${ticketId}/auto-resolve-context`,
    );
    if (!res.ok) {
      throw new Error(
        `auto-resolve-context fetch failed: ${res.status} ${await res.text()}`,
      );
    }
    return (await res.json()) as AutoResolveContext;
  }

  async reportRun(report: RunReport): Promise<void> {
    const res = await this.request("/api/internal/auto-resolve/runs", {
      method: "POST",
      body: JSON.stringify(report),
    });
    if (!res.ok) {
      throw new Error(
        `run report failed: ${res.status} ${await res.text()}`,
      );
    }
  }

  async findRunByBranch(branch: string): Promise<RunByBranch | null> {
    const res = await this.request(
      `/api/internal/auto-resolve/runs/by-branch?branch=${encodeURIComponent(branch)}`,
    );
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(
        `findRunByBranch failed: ${res.status} ${await res.text()}`,
      );
    }
    const body = (await res.json()) as { run: RunByBranch };
    return body.run;
  }

  async putDetectedStack(
    projectId: number,
    detectedStack: Record<string, unknown>,
  ): Promise<void> {
    const res = await this.request(
      `/api/internal/projects/${projectId}/detected-stack`,
      {
        method: "PUT",
        body: JSON.stringify({ detected_stack: detectedStack }),
      },
    );
    if (!res.ok) {
      throw new Error(
        `detected-stack put failed: ${res.status} ${await res.text()}`,
      );
    }
  }

  private request(path: string, init: RequestInit = {}): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${this.token}`,
        "content-type": "application/json",
        ...(init.headers ?? {}),
      },
    });
  }
}
