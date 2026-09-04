const EXPECTED_PROJECT_ID = "prj_O97BqIkagZFLqyUvuoeUbgOQYu6F";

const actualProjectId = process.env.VERCEL_PROJECT_ID;

if (!actualProjectId) {
  console.log("[vercel-project-guard] VERCEL_PROJECT_ID unavailable; continuing deployment.");
  process.exit(1);
}

if (actualProjectId !== EXPECTED_PROJECT_ID) {
  console.log("[vercel-project-guard] Ignoring deployment: repository is not running in canonical MALEK project.");
  process.exit(0);
}

console.log("[vercel-project-guard] Canonical MALEK project verified; continuing deployment.");
process.exit(1);
