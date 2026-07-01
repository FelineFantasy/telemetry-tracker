/**
 * Create a development API key on the default (or configured) project when none exist.
 *
 * Usage:
 *   cd apps/api && pnpm seed:dev-api-key
 *   SEED_PROJECT_ID=<uuid> SEED_API_KEY_NAME="My key" pnpm seed:dev-api-key
 *   pnpm seed:dev-api-key -- --force   # create even if active keys already exist
 */
import { prisma } from "../src/lib/db.js";
import { createProjectApiKey } from "../src/lib/create-project-api-key.js";
import { DEFAULT_LEGACY_PROJECT_ID } from "../src/lib/project-scope.js";

async function main() {
  const force = process.argv.includes("--force");
  const projectId = process.env.SEED_PROJECT_ID?.trim() || DEFAULT_LEGACY_PROJECT_ID;
  const name = process.env.SEED_API_KEY_NAME?.trim() || "Local development";

  const project = await prisma.project.findFirst({
    where: { id: projectId, deleted_at: null },
    select: { id: true, name: true, slug: true, organization: { select: { name: true } } },
  });

  if (!project) {
    console.error(`Project not found or deleted: ${projectId}`);
    process.exit(1);
  }

  const activeCount = await prisma.apiKey.count({
    where: { project_id: projectId, deleted_at: null, revoked_at: null },
  });

  if (activeCount > 0 && !force) {
    console.log(
      `Project "${project.name}" (${project.slug}) already has ${activeCount} active API key(s).`,
    );
    console.log("Nothing created. Pass --force to add another key.");
    return;
  }

  const result = await createProjectApiKey(prisma, projectId, { name });
  if (!result.ok) {
    console.error(`Failed to create API key: ${result.error}`);
    process.exit(1);
  }

  console.log("\n✓ API key created\n");
  console.log(`  Organization: ${project.organization.name}`);
  console.log(`  Project:      ${project.name} (${project.id})`);
  console.log(`  Label:        ${name}`);
  console.log(`  Public id:    ${result.key.publicId}`);
  console.log("\n  Copy this secret now — it will not be shown again:\n");
  console.log(`  ${result.key.fullKey}\n`);
  console.log("  Use in your SDK / curl as Authorization: Bearer <key> or X-API-Key: <key>\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
