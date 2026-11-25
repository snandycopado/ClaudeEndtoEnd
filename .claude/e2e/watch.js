// Watch mode: visible browser + slow motion so a person can follow every click.
// Usage: npm run test:e2e:watch [-- -g "TC-04"]   (speed: set E2E_SLOWMO in ms, default 600)
const { spawnSync } = require("node:child_process");
const { join } = require("node:path");

const env = { ...process.env, E2E_SLOWMO: process.env.E2E_SLOWMO || "600" };
const args = [
  "playwright",
  "test",
  "-c",
  join(__dirname, "playwright.config.js"),
  "--headed",
  ...process.argv.slice(2)
].map((a) => (/\s/.test(a) ? `"${a}"` : a));
const res = spawnSync("npx", args, { stdio: "inherit", shell: true, env });
process.exit(res.status ?? 1);
