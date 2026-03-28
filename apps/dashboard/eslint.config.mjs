/**
 * Re-export the repo ESLint flat config so `next build` picks up the Next.js plugin
 * (it looks for a config file in this directory).
 */
export { default } from "../../eslint.config.mjs";
