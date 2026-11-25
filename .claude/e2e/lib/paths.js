// Fixed locations used by the E2E suite. Everything under .auth/ and results/ is git-ignored:
// the session state and the traces contain a live Salesforce session — never commit or share them.
const { join } = require("node:path");

const E2E_DIR = join(__dirname, "..");
const PROJECT_DIR = join(E2E_DIR, "..", "..");
const ALLOWED_ORGS = join(PROJECT_DIR, ".claude", "allowed-orgs");
const AUTH_DIR = join(E2E_DIR, ".auth");
const STATE_FILE = join(AUTH_DIR, "storage-state.json");
const ORG_FILE = join(AUTH_DIR, "org.json");
const RESULTS_DIR = join(E2E_DIR, "results");

module.exports = {
  E2E_DIR,
  PROJECT_DIR,
  ALLOWED_ORGS,
  AUTH_DIR,
  STATE_FILE,
  ORG_FILE,
  RESULTS_DIR
};
