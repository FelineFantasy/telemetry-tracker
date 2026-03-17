#!/usr/bin/env node
/**
 * Publish SDK packages to npm in order: telemetry-core first, then packages that depend on it.
 * Temporarily replaces workspace:* with ^version for telemetry-core so the published tarball resolves from npm.
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const packagesDir = join(root, "packages");

const coreName = "telemetry-core"; // folder name
const coreDep = "@tacko/telemetry-core"; // package name for dependency
const dependents = ["telemetry-next", "telemetry-node", "telemetry-react-native"];

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}
function writeJson(path, obj) {
  writeFileSync(path, JSON.stringify(obj, null, 2) + "\n");
}

function run(cmd, cwd = root) {
  execSync(cmd, { cwd, stdio: "inherit" });
}

const dryRun = process.argv.includes("--dry-run");

// 1. Get core version
const corePkgPath = join(packagesDir, coreName, "package.json");
const coreVersion = readJson(corePkgPath).version;
console.log(`\n${coreName} version: ${coreVersion}\n`);

// 2. Publish telemetry-core
const publishFlags = [
  "--access public",
  dryRun ? "--dry-run" : "",
  dryRun ? "--no-git-checks" : "",
].filter(Boolean).join(" ");
run(`pnpm publish ${publishFlags}`, join(packagesDir, coreName));

// 3. Publish dependents (patch deps, publish, restore)
for (const name of dependents) {
  const pkgPath = join(packagesDir, name, "package.json");
  const pkg = readJson(pkgPath);
  const original = { ...pkg, dependencies: { ...pkg.dependencies } };
  if (pkg.dependencies && pkg.dependencies[coreDep] === "workspace:*") {
    pkg.dependencies[coreDep] = `^${coreVersion}`;
    writeJson(pkgPath, pkg);
  }
  try {
    run(`pnpm publish ${publishFlags}`, join(packagesDir, name));
  } finally {
    writeJson(pkgPath, original);
  }
}

console.log("\nDone.");
