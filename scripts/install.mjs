#!/usr/bin/env node
// Installs the pstack port into an OpenCode config directory.
//
//   node scripts/install.mjs                 # global: ~/.config/opencode
//   node scripts/install.mjs --project       # ./.opencode in the current directory
//   node scripts/install.mjs --dest <dir>    # explicit target
//   node scripts/install.mjs --dry-run       # print the plan, write nothing
//   node scripts/install.mjs --check         # exit 1 unless the install matches the port
//
// The install converges. Each pstack folder is replaced whole, so a re-run after an
// upstream update leaves no stale skill, agent, or command behind. Nothing outside
// skills/pstack, agents/pstack, commands/pstack, and pstack-docs is touched.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// The installable tree lives at the repo root: skills/, agents/, commands/, pstack-docs/.
const port = root;

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};

const dest = resolve(
  value("--dest") ??
    (flag("--project") ? join(process.cwd(), ".opencode") : join(homedir(), ".config", "opencode")),
);
const dryRun = flag("--dry-run");
const check = flag("--check");

const plan = [
  ["skills/pstack", "skills/pstack", "skills"],
  ["agents/pstack", "agents/pstack", "agents"],
  ["commands/pstack", "commands/pstack", "commands"],
  ["pstack-docs", "pstack-docs", "docs"],
];

const entries = (dir) => (existsSync(dir) ? readdirSync(dir).sort() : []);
const skip = (rel) => rel.split(/[\\/]/).includes("node_modules");

// Hash a tree so --check proves content, not just names.
const treeHash = (dir) => {
  const hash = createHash("sha256");
  const walk = (current) => {
    const names = readdirSync(current, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    for (const entry of names) {
      const abs = join(current, entry.name);
      const rel = relative(dir, abs);
      if (skip(rel)) continue;
      if (entry.isDirectory()) walk(abs);
      else hash.update(rel).update(readFileSync(abs));
    }
  };
  walk(dir);
  return hash.digest("hex");
};

console.log(`pstack -> ${dest}`);
for (const [from, to, label] of plan) {
  console.log(`  ${label.padEnd(9)} ${entries(join(port, from)).length} entries -> ${join(dest, to)}`);
}
if (dryRun) {
  console.log("dry run: nothing written");
  process.exit(0);
}

if (check) {
  const stale = plan.filter(([from, to]) => {
    const src = join(port, from);
    const dst = join(dest, to);
    if (!existsSync(src) || !existsSync(dst)) return true;
    return treeHash(src) !== treeHash(dst);
  });
  if (!stale.length) {
    console.log("check: install matches the port");
    process.exit(0);
  }
  for (const [, to] of stale) console.log(`check: out of date ${join(dest, to)}`);
  process.exit(1);
}

for (const [, to] of plan) rmSync(join(dest, to), { recursive: true, force: true });

// Clean up the flat layout older revisions installed. Only names this port owns are
// removed, so a foreign pstack-named skill or agent the user keeps is left alone.
const ownedSkillFlat = new Set(
  entries(join(port, "skills", "pstack")).map((n) => `pstack-${n}`),
);
const ownedAgentFlat = new Set(
  entries(join(port, "agents", "pstack"))
    .filter((n) => n.endsWith(".md"))
    .map((n) => `pstack-${n}`),
);
// Only reach into the dest siblings when the port actually has content to share.
if (ownedSkillFlat.size) {
  for (const name of entries(join(dest, "skills"))) {
    if (ownedSkillFlat.has(name)) rmSync(join(dest, "skills", name), { recursive: true, force: true });
  }
}
if (ownedAgentFlat.size) {
  for (const name of entries(join(dest, "agents"))) {
    if (ownedAgentFlat.has(name)) rmSync(join(dest, "agents", name), { force: true });
  }
}

for (const [from, to] of plan) {
  const src = join(port, from);
  if (!existsSync(src)) continue;
  const dst = join(dest, to);
  mkdirSync(dirname(dst), { recursive: true });
  cpSync(src, dst, {
    recursive: true,
    filter: (path) => !path.split(/[\\/]/).includes("node_modules"),
  });
}

console.log("installed");
console.log(`  skills   ${entries(join(dest, "skills", "pstack")).length}`);
console.log(`  agents   ${entries(join(dest, "agents", "pstack")).length}`);
console.log(`  commands ${entries(join(dest, "commands", "pstack")).length}`);
console.log("restart the OpenCode server if it was already running: opencode service restart");
