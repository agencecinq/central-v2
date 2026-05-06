import { describe, expect, it } from "vitest";
import { buildAgentPrompt } from "../src/jobs/agent-runner.js";
import type { AutoResolveContext } from "../src/clients/cinqcentral.js";
import type { DetectedStack } from "../src/jobs/detect-stack.js";

const ctx: AutoResolveContext = {
  ticket: {
    id: 1234,
    title: "Ajouter un lien Instagram dans le footer",
    description: "Le footer doit pointer vers @milia.matcha.",
    labels: [],
    assignee_email: null,
    created_at: null,
  },
  project: {
    id: 1,
    name: "Milia Matcha",
    repo_url: "https://github.com/agencecinq/milia-matcha",
    repo_name: "milia-matcha",
    repo_default_branch: "main",
    slack_channel_id: "C04ABCD1234",
    auto_resolve_enabled: true,
    detected_stack: null,
    detected_stack_at: null,
  },
};

const stack: DetectedStack = {
  detected_at: "2026-05-06T12:00:00.000Z",
  shopify: true,
  tailwind: true,
  wordpress: false,
  next: false,
  primary_runtime: "node",
  node_version: ">=20",
  php_version: null,
  package_manager: "pnpm",
  flags: ["shopify", "tailwind"],
};

describe("buildAgentPrompt", () => {
  it("includes ticket title, description and detected stack details", () => {
    const prompt = buildAgentPrompt({
      context: ctx,
      detectedStack: stack,
      repoPath: "/tmp/x",
    });
    expect(prompt).toContain("TITRE: Ajouter un lien Instagram dans le footer");
    expect(prompt).toContain("Le footer doit pointer vers @milia.matcha.");
    expect(prompt).toContain("runtime=node");
    expect(prompt).toContain("package_manager=pnpm");
    expect(prompt).toContain("node=>=20");
    expect(prompt).toContain("flags=shopify, tailwind");
  });

  it("falls back to 'stack non détectée' when no stack is provided", () => {
    const prompt = buildAgentPrompt({
      context: ctx,
      detectedStack: null,
      repoPath: "/tmp/x",
    });
    expect(prompt).toContain("stack non détectée");
  });

  it("renders empty description as '(vide)'", () => {
    const prompt = buildAgentPrompt({
      context: { ...ctx, ticket: { ...ctx.ticket, description: null } },
      detectedStack: stack,
      repoPath: "/tmp/x",
    });
    expect(prompt).toContain("DESCRIPTION:");
    expect(prompt).toContain("(vide)");
  });
});
