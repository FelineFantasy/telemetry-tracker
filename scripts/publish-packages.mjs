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

function runOptional(cmd, cwd = root) {
  try {
    execSync(cmd, { cwd, stdio: "inherit" });
    return true;
  } catch {
    return false;
  }
}

const dryRun = process.argv.includes("--dry-run");
const otpArg = process.argv.find((a) => a.startsWith("--otp="));
const otpFlag = otpArg ? ` ${otpArg}` : "";

// 1. Get core version
const corePkgPath = join(packagesDir, coreName, "package.json");
const coreVersion = readJson(corePkgPath).version;
console.log(`\n${coreName} version: ${coreVersion}\n`);

// 2. Publish telemetry-core (continue if already published)
const publishFlags = [
  "--access public",
  dryRun ? "--dry-run" : "",
  "--no-git-checks",
].filter(Boolean).join(" ") + otpFlag;
const corePublished = runOptional(`pnpm publish ${publishFlags}`, join(packagesDir, coreName));
if (!corePublished) {
  console.log(`\n(${coreName} publish failed or skipped, continuing with dependents…)\n`);
}

// 3. Publish dependents (patch deps, publish, restore)
for (const name of dependents) {
  const pkgPath = join(packagesDir, name, "package.json");
  const pkg = readJson(pkgPath);
  const original = { ...pkg, dependencies: { ...pkg.dependencies } };
  if (pkg.dependencies && typeof pkg.dependencies[coreDep] === "string") {
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
