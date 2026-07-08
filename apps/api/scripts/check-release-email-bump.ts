import { isMinorOrMajorBump } from "../src/lib/release-email-semver.js";

const currentArg = process.argv.find((a) => a.startsWith("--current="))?.split("=")[1]?.trim();
const previousArg = process.argv.find((a) => a.startsWith("--previous="))?.split("=")[1]?.trim();

if (!currentArg) {
  console.error("Usage: check-release-email-bump.ts --current=X.Y.Z [--previous=X.Y.Z]");
  process.exit(1);
}

const decision = isMinorOrMajorBump(currentArg, previousArg || null);
console.log(JSON.stringify(decision));
