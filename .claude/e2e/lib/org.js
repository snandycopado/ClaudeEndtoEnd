// sf CLI access for the E2E suite: the target alias (only the one in .claude/allowed-orgs), a front-door login
// URL, and read-only SOQL for back-end assertions. Nothing here writes or deletes org data.
const { spawnSync } = require("node:child_process");
const { readFileSync } = require("node:fs");
const { ALLOWED_ORGS } = require("./paths");

/** The only org the suite may touch: the first non-comment line of .claude/allowed-orgs. */
function targetAlias() {
  const alias = readFileSync(ALLOWED_ORGS, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith("#"));
  if (!alias) throw new Error("No org alias in .claude/allowed-orgs");
  if (process.env.E2E_ORG && process.env.E2E_ORG !== alias) {
    throw new Error(
      `E2E runs only against the alias in .claude/allowed-orgs (${alias}), not ${process.env.E2E_ORG}`
    );
  }
  return alias;
}

const quote = (a) =>
  /[\s"'<>|&^]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a;

function sf(args) {
  // shell:true so Windows resolves sf.cmd; the output is JSON and is never printed (the login URL holds a session).
  // Playwright sets FORCE_COLOR, which makes sf colour its --json output: drop it for the child process.
  const env = {
    ...process.env,
    NO_COLOR: "1",
    SF_DISABLE_AUTOUPDATE: "true",
    SF_SKIP_NEW_VERSION_CHECK: "true"
  };
  delete env.FORCE_COLOR;
  const command = ["sf", ...args, "--json"].map(quote).join(" ");
  const res = spawnSync(command, {
    shell: true,
    env,
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024
  });
  let out;
  try {
    out = JSON.parse(res.stdout);
  } catch {
    throw new Error(
      `sf ${args.slice(0, 2).join(" ")} failed: ${(res.stderr || "").slice(0, 400)}`
    );
  }
  if (out.status !== 0)
    throw new Error(`sf ${args.slice(0, 2).join(" ")} failed: ${out.message}`);
  return out.result;
}

/** Front-door URL that logs the browser in with the CLI's session. Secret — never log it. */
function frontdoorUrl(alias = targetAlias()) {
  return sf([
    "org",
    "open",
    "--target-org",
    alias,
    "--url-only",
    "--path",
    "lightning/page/home"
  ]).url;
}

/** Read-only SOQL against the target org; returns the records. */
function soql(query, alias = targetAlias()) {
  return sf(["data", "query", "--target-org", alias, "--query", query]).records;
}

module.exports = { targetAlias, frontdoorUrl, soql };
