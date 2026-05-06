import { describe, expect, it } from "vitest";
import { parsePrSummary } from "../src/jobs/pr-summary.js";

describe("parsePrSummary", () => {
  it("extracts title and body from a clean response", () => {
    const raw = `TITRE: feat(footer): ajoute lien Instagram

DESCRIPTION:
## Résumé
Ajout du lien Instagram dans le footer.

## Modifications
- sections/footer.liquid : nouvelle icône SVG Instagram
- locales/fr.default.json : ajout de la clé footer.instagram

## À tester
- Lien fonctionne en desktop
- Lien fonctionne en mobile`;
    const out = parsePrSummary(raw, "Ajouter un lien Instagram");
    expect(out.title).toBe("feat(footer): ajoute lien Instagram");
    expect(out.body).toContain("## Résumé");
    expect(out.body).toContain("## Modifications");
    expect(out.body).toContain("## À tester");
  });

  it("strips trailing punctuation from the title", () => {
    const raw = "TITRE: fix(button): corrige le hover du bouton CTA.\n\nDESCRIPTION:\n## Résumé\nx";
    expect(parsePrSummary(raw, "x").title).toBe(
      "fix(button): corrige le hover du bouton CTA",
    );
  });

  it("truncates titles longer than 70 chars", () => {
    const longTitle = "feat(scope): " + "a".repeat(100);
    const raw = `TITRE: ${longTitle}\n\nDESCRIPTION:\n## Résumé\nx`;
    const out = parsePrSummary(raw, "fallback");
    expect(out.title.length).toBeLessThanOrEqual(70);
  });

  it("falls back to a chore title when title is missing", () => {
    const raw = `DESCRIPTION:\n## Résumé\nNothing here.`;
    const out = parsePrSummary(raw, "Improve the footer");
    expect(out.title).toBe("chore(auto): Improve the footer");
  });

  it("falls back to a placeholder body when description is missing", () => {
    const raw = `TITRE: feat(x): y`;
    const out = parsePrSummary(raw, "fallback");
    expect(out.body).toContain("## Résumé");
  });

  it("survives leading code fences", () => {
    const raw = "```\nTITRE: chore: ok\n\nDESCRIPTION:\n## Résumé\ndone\n```";
    const out = parsePrSummary(raw, "fallback");
    expect(out.title).toBe("chore: ok");
    expect(out.body).toContain("## Résumé");
  });
});
