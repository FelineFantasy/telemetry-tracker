import { shouldSendProductUpdateEmail } from "../src/lib/release-email-semver.js";

const currentArg = process.argv.find((a) => a.startsWith("--current="))?.split("=")[1]?.trim();
const previousArg = process.argv.find((a) => a.startsWith("--previous="))?.split("=")[1]?.trim();
const LINE_CLOSE = process.argv.includes("--line-close");

if (!currentArg) {
  console.error(
    "Usage: check-release-email-bump.ts --current=X.Y.Z [--previous=X.Y.Z] [--line-close]"
  );
  process.exit(1);
}

const decision = shouldSendProductUpdateEmail(currentArg, previousArg || null, {
  lineClose: LINE_CLOSE,
});
console.log(JSON.stringify(decision));
