const fs = require("fs");
const path = require("path");
const pkg = require("../package.json");
const out = path.join(__dirname, "../src/version.ts");
fs.writeFileSync(
  out,
  `/** Injected at build time from package.json. Do not edit manually. */\nexport const SDK_VERSION = "${pkg.version}";\n`,
  "utf8"
);
