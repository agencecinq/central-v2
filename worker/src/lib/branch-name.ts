const MAX_SLUG_LEN = 40;

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LEN)
    .replace(/-+$/g, "");
}

export function makeBranchName(ticketId: number, ticketTitle: string): string {
  const slug = slugify(ticketTitle) || "ticket";
  return `cinq/ticket-${ticketId}-${slug}`;
}

export function getRepoFullNameFromUrl(repoUrl: string): string {
  try {
    const u = new URL(repoUrl);
    return u.pathname.replace(/^\/+/, "").replace(/\.git$/, "");
  } catch {
    return repoUrl;
  }
}
