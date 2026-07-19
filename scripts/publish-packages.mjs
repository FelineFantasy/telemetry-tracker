#!/usr/bin/env node
/**
 * Publish SDK packages to npm in order: telemetry-core first, then packages that depend on it.
 * Temporarily replaces workspace:* with ^version for telemetry-core so the published tarball resolves from npm.
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const packagesDir = join(root, "packages");

const coreName = "telemetry-core"; // folder name
const coreDep = "@telemetry-tracker/core"; // package name for dependency
const dependents = [
  "telemetry-next",
  "telemetry-node",
  "telemetry-react-native",
  "telemetry-vite-plugin",
];

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}
function writeJson(path, obj) {
  writeFileSync(path, JSON.stringify(obj, null, 2) + "\n");
}

function runOptional(file, args, cwd = root) {
  try {
    execFileSync(file, args, { cwd, stdio: "inherit" });
    return true;
  } catch {
    return false;
  }
}

const dryRun = process.argv.includes("--dry-run");
const otpArg = process.argv.find((a) => a.startsWith("--otp="));
const otp = otpArg?.slice("--otp=".length) ?? "";
if (otpArg && !/^\d{6,8}$/.test(otp)) {
  console.error("Invalid --otp= value (expected 6–8 digits)");
  process.exit(1);
}

function publishArgs() {
  const args = ["publish", "--access", "public", "--no-git-checks"];
  if (dryRun) args.push("--dry-run");
  if (otp) args.push(`--otp=${otp}`);
  return args;
}

function assertNpmAuth() {
  if (dryRun) return;
  try {
    execFileSync("npm", ["whoami"], { cwd: root, stdio: "pipe" });
  } catch {
    console.error(`
npm publish failed: not logged in to https://registry.npmjs.org/

  1. npm login
  2. Ensure your npm user can publish the @telemetry-tracker scope (create org at npmjs.com/org/create if needed)
  3. pnpm publish:packages -- --otp=123456   (if 2FA is enabled)

Dry run (no login): pnpm publish:dry
`);
    process.exit(1);
  }
}

assertNpmAuth();

// 1. Get core version
const corePkgPath = join(packagesDir, coreName, "package.json");
const coreVersion = readJson(corePkgPath).version;
console.log(`\n${coreName} version: ${coreVersion}\n`);

// 2. Publish telemetry-core (continue if already published)
const corePublished = runOptional("pnpm", publishArgs(), join(packagesDir, coreName));
if (!corePublished) {
  console.log(`\n(${coreName} publish failed or skipped, continuing with dependents…)\n`);
}

// 3. Publish dependents (patch deps, publish, restore); continue on failure (e.g. already published)
for (const name of dependents) {
  const pkgPath = join(packagesDir, name, "package.json");
  const pkg = readJson(pkgPath);
  const original = { ...pkg, dependencies: { ...pkg.dependencies } };
  if (pkg.dependencies && typeof pkg.dependencies[coreDep] === "string") {
    pkg.dependencies[coreDep] = `^${coreVersion}`;
    writeJson(pkgPath, pkg);
  }
  try {
    const ok = runOptional("pnpm", publishArgs(), join(packagesDir, name));
    if (!ok) console.log(`(${name} publish failed or skipped.)\n`);
  } finally {
    writeJson(pkgPath, original);
  }
}

console.log("\nDone.");
