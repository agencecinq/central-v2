import { describe, it, expect } from "vitest";
import {
  buildUserPrompt,
  classifierResultSchema,
  extractJson,
} from "../src/jobs/classifier.js";
import type { AutoResolveContext } from "../src/clients/cinqcentral.js";

const baseContext: AutoResolveContext = {
  ticket: {
    id: 1234,
    title: "Ajouter lien Instagram dans le footer",
    description: "Footer doit pointer vers @milia.matcha",
    labels: ["frontend"],
    assignee_email: "joachim@agencecinq.com",
    created_at: "2026-05-06T12:00:00.000Z",
  },
  project: {
    id: 1,
    name: "Milia Matcha",
    repo_url: "https://github.com/agencecinq/milia-matcha",
    repo_name: "milia-matcha",
    repo_default_branch: "main",
    slack_channel_id: "C04ABCD1234",
    auto_resolve_enabled: true,
    detected_stack: { shopify: true, tailwind: true },
    detected_stack_at: null,
  },
};

describe("classifier prompt", () => {
  it("renders detected stack flags as a comma-separated list", () => {
    const prompt = buildUserPrompt(baseContext);
    expect(prompt).toContain("TITRE: Ajouter lien Instagram dans le footer");
    expect(prompt).toContain("(stack: shopify, tailwind)");
  });

  it("falls back to 'inconnue' when no stack is detected", () => {
    const prompt = buildUserPrompt({
      ...baseContext,
      project: { ...baseContext.project, detected_stack: null },
    });
    expect(prompt).toContain("(stack: inconnue)");
  });

  it("renders empty fields without crashing", () => {
    const prompt = buildUserPrompt({
      ...baseContext,
      ticket: {
        ...baseContext.ticket,
        description: null,
        labels: [],
      },
    });
    expect(prompt).toContain("DESCRIPTION: (vide)");
    expect(prompt).toContain("LABELS: (aucun)");
  });
});

describe("classifier output parsing", () => {
  it("parses a clean JSON answer", () => {
    const raw = '{"codable": true, "confidence": 0.9, "reason": "simple copy"}';
    const result = classifierResultSchema.parse(extractJson(raw));
    expect(result.codable).toBe(true);
    expect(result.confidence).toBeCloseTo(0.9);
  });

  it("extracts JSON when the model adds chatter around it", () => {
    const raw = "Sure, here you go:\n{\"codable\": false, \"confidence\": 0.4, \"reason\": \"ambigu\"}\n";
    const result = classifierResultSchema.parse(extractJson(raw));
    expect(result.codable).toBe(false);
    expect(result.reason).toBe("ambigu");
  });

  it("rejects payloads that fail the schema", () => {
    const raw = '{"codable": "yes", "confidence": 2, "reason": ""}';
    expect(() => classifierResultSchema.parse(extractJson(raw))).toThrow();
  });

  it("throws when no JSON object is present", () => {
    expect(() => extractJson("no json here")).toThrow();
  });
});
