#!/usr/bin/env node
// Privacy gate for a repo that is about to be published.
//
//   node scripts/check-private.mjs [--root <dir>]
//
// Scans the tree for home paths, emails, session ids, credentials, provider aliases,
// vendor model ids, hostnames, private IPs and personal handles. Prints every hit as
// `path:line  [rule]  hint`, exits 1 if anything matched, exits 0 and prints
// `no private data found` otherwise. No dependencies beyond node:fs.
//
// A hit is a real finding unless the allowlist says otherwise. Add an entry only for a
// false positive, and say why in the comment above it:
//
//   <path> :: <rule> :: <exact text that matched>   # suppress one literal
//   <path> :: <rule>                                # suppress that rule for that file
//
// `~` is the portable home prefix and never fires; `<provider>/<model>`, `<repo>`,
// `<config>` and `ses_…` are the placeholders these rules are tuned to accept.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(
  (() => {
    const i = process.argv.indexOf("--root");
    return i === -1 ? join(dirname(fileURLToPath(import.meta.url)), "..") : process.argv[i + 1];
  })(),
);

// Owner-specific literals are assembled so this file never contains them in plaintext;
// otherwise the gate would flag its own rule table.
const JOIN = (...parts) => parts.join("");
const OWNER = {
  alias: JOIN("cheaper", "-inference"),
  handle: JOIN("bit", "gineer"),
  first: JOIN("Ja", "ck"),
};

const RULES = [
  {
    name: "home-path",
    // A Windows drive profile path, /home/<name>, /Users/<name>.
    // `~/` is the portable form and is fine.
    re: /(?:[A-Za-z]:[\\/]+Users[\\/]+[^\\/\s"'`)]+|(?:^|[\s"'`(=[])\/(?:home|Users)\/[A-Za-z][\w.-]*)/g,
    why: "absolute home path",
  },
  {
    name: "email",
    re: /\b[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}\b/g,
    why: "email address",
  },
  {
    name: "session-id",
    // A real OpenCode session id; `ses_…` (the placeholder) has no alphanumerics after it.
    re: /\bses_[A-Za-z0-9]{6,}/g,
    why: "session id",
  },
  {
    name: "token",
    re: /\b(?:sk|rk|pk)-[A-Za-z0-9_-]{16,}|\b(?:ghp|gho|ghs|ghu|ghr)_[A-Za-z0-9]{10,}|\bgithub_pat_[A-Za-z0-9_]{10,}|\bxox[abprs]-[A-Za-z0-9-]{10,}|\bAKIA[0-9A-Z]{12,}|\bctx7sk[A-Za-z0-9_-]{6,}/g,
    why: "credential",
  },
  {
    name: "bearer",
    // `Bearer <token>` with a real value; `Bearer <token>` as a placeholder does not match.
    re: /\bBearer\s+(?!<|[A-Z_]+>)[A-Za-z0-9._~+/-]{16,}=*/g,
    why: "bearer token",
  },
  {
    name: "provider-alias",
    re: new RegExp(`\\b${OWNER.alias}\\b`, "gi"),
    why: "provider account alias",
  },
  {
    name: "model-id",
    // Vendor model ids. Cursor-era slugs quoted as evidence match on purpose: they are
    // allowlisted one by one, so a new one still bites.
    re: /\b(?:claude-(?:opus|sonnet|haiku)-[\d][\w.-]*|gpt-[\d][\w.-]*|gemini-[\d][\w.-]*|deepseek-[a-z][\w.-]*|grok-[\d][\w.-]*|llama-[\d][\w.-]*|qwen[\d][\w.-]*|o[134][-_][\w.-]+)/g,
    why: "vendor model id",
  },
  {
    name: "hostname",
    re: /\b(?:DESKTOP|LAPTOP|WIN|PC)-[A-Z0-9]{6,}\b/g,
    why: "machine hostname",
  },
  {
    name: "tailnet",
    re: /\b[a-z0-9-]+\.ts\.net\b/g,
    why: "tailnet hostname",
  },
  {
    name: "private-ip",
    re: /\b(?:10\.\d{1,3}|192\.168|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}\b/g,
    why: "private IP address",
  },
  {
    name: "handle",
    re: new RegExp(`\\b(?:${OWNER.handle}|${OWNER.first})\\b`, "gi"),
    why: "personal handle",
  },
];

const SKIP_DIRS = new Set([".git", "node_modules", "cursor-plugins", "bin-v2"]);
const SKIP_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".ico", ".pdf", ".exe", ".zip", ".woff", ".woff2"]);

const rel = (p) => p.slice(root.length + 1).split(sep).join("/");

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.isDirectory()) return SKIP_DIRS.has(e.name) ? [] : walk(join(dir, e.name));
    const dot = e.name.lastIndexOf(".");
    const ext = dot === -1 ? "" : e.name.slice(dot).toLowerCase();
    return SKIP_EXT.has(ext) ? [] : [join(dir, e.name)];
  });

// Allowlist: `<path> :: <rule> [:: <literal>]`, `#` starts a comment.
const allowPath = join(root, "scripts", "private-allowlist.txt");
const allow = [];
if (existsSync(allowPath)) {
  for (const raw of readFileSync(allowPath, "utf8").split(/\r?\n/)) {
    const line = raw.split("#")[0].trim();
    if (!line) continue;
    const [path, rule, literal] = line.split("::").map((s) => s.trim());
    if (path && rule) allow.push({ path, rule, literal });
  }
}
const allowed = (path, rule, text) =>
  allow.some(
    (a) => a.path === path && a.rule === rule && (a.literal === undefined || a.literal === text),
  );

const hint = (text) => (text.length <= 8 ? text : `${text.slice(0, 8)}…`);

const hits = [];
for (const file of walk(root)) {
  const path = rel(file);
  if (path === "scripts/private-allowlist.txt") continue;
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  if (text.includes("\u0000")) continue; // binary that slipped past the extension list
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    for (const rule of RULES) {
      rule.re.lastIndex = 0;
      for (const m of lines[i].matchAll(rule.re)) {
        if (allowed(path, rule.name, m[0])) continue;
        hits.push({ path, line: i + 1, rule: rule.name, why: rule.why, text: m[0] });
      }
    }
  }
}

if (hits.length) {
  for (const h of hits) {
    console.log(`${h.path}:${h.line}  [${h.rule}]  ${h.why}: ${hint(h.text)}`);
  }
  const files = new Set(hits.map((h) => h.path)).size;
  console.log(`\n${hits.length} hits in ${files} files`);
  process.exit(1);
}

console.log(`no private data found (${RULES.length} rules, ${allow.length} allowlist entries)`);
process.exit(0);
