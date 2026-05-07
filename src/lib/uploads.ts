import path from "path";

/**
 * Racine où sont stockés les fichiers uploadés (ressources projet, etc.).
 *
 * En production sur Render : monter un disque persistant et définir
 *   UPLOADS_DIR=/var/data/uploads
 *
 * En dev (variable absente), on retombe sur public/uploads à la racine du
 * projet — ce qui permet de servir aussi les fichiers en statique pour
 * débugger.
 */
export function getUploadsBaseDir(): string {
  if (process.env.UPLOADS_DIR) return process.env.UPLOADS_DIR;
  return path.join(process.cwd(), "public", "uploads");
}

/**
 * Convertit un filepath stocké en base en chemin absolu sur disque.
 *
 * Tolère deux formats pour rester compatible avec les enregistrements
 * historiques :
 *   - "projects/28/resources/foo.html"            (nouveau format, relatif)
 *   - "/uploads/projects/28/resources/foo.html"   (ancien format, depuis l'URL public)
 */
export function resolveUploadPath(filepath: string): string {
  let rel = filepath.replace(/^\/+/, "");
  if (rel.startsWith("uploads/")) rel = rel.slice("uploads/".length);
  if (rel.includes("..")) throw new Error("Chemin invalide");
  return path.join(getUploadsBaseDir(), rel);
}
