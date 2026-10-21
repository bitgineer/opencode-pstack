#!/usr/bin/env node
// Static verification for the pstack OpenCode v2 port.
//
//   node scripts/verify-port.mjs [--dest <opencode config dir>]
//
// Checks the port, then the installed copy. Exits 1 on any failure, so it can gate a
// commit. No dependencies beyond node:fs.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// The installable tree lives at the repo root: skills/, agents/, commands/, pstack-docs/.
const port = root;
const args = process.argv.slice(2);
const destIndex = args.indexOf("--dest");
const dest = resolve(
  destIndex === -1 ? join(homedir(), ".config", "opencode") : args[destIndex + 1],
);

const failures = [];
const checks = [];
const fail = (check, detail) => failures.push(`${check}: ${detail}`);
const pass = (check, detail) => checks.push(`${check}: ${detail}`);
const read = (path) => readFileSync(path, "utf8");

const frontmatter = (text) => {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const out = {};
  let key = null;
  for (const raw of m[1].split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const top = raw.match(/^([A-Za-z0-9_/-]+):\s*(.*)$/);
    if (top) {
      key = top[1];
      out[key] = top[2].replace(/^["']|["']$/g, "");
    } else if (/^\s+-/.test(raw) && key) {
      out[key] = `${out[key] ?? ""}\n${raw}`.trim();
    }
  }
  return out;
};

// A description may be a plain line, a quoted line, or a block scalar (`>-`, `|`). Assemble
// it the way YAML would, so a multi-line description cannot hide behind a two-character marker.
const description = (text) => {
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return "";
  const lines = fm[1].split(/\r?\n/);
  const start = lines.findIndex((line) => /^description:/.test(line));
  if (start === -1) return "";
  const parts = [];
  const inline = lines[start].replace(/^description:\s*/, "").trim();
  if (inline && !/^[>|][-+]?$/.test(inline)) parts.push(inline);
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^[A-Za-z0-9_/-]+:/.test(line)) break;
    if (line.trim()) parts.push(line.trim());
  }
  return parts.join(" ").replace(/^["']|["']$/g, "");
};

// Skip node_modules the way install.mjs does: `bun install` drops a gitignored tree
// under poteto-mode/scripts whose third-party READMEs are not port prose.
const skipDir = (name) => name === "node_modules";
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? skipDir(e.name)
        ? []
        : walk(join(dir, e.name))
      : [join(dir, e.name)],
  );

// 1. Skills: one level under skills/pstack, directory name is the ID.
const skillsRoot = join(port, "skills", "pstack");
const skills = existsSync(skillsRoot)
  ? readdirSync(skillsRoot, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort()
  : [];
if (!skills.length) fail("skill", "no skills under skills/pstack");
let skillIssues = 0;
const hidden = []; // skills that hide themselves from the model's list
const longDescriptions = [];
let visibleChars = 0;
for (const name of skills) {
  const file = join(skillsRoot, name, "SKILL.md");
  if (!existsSync(file)) {
    fail("skill", `${name} has no SKILL.md`);
    skillIssues++;
    continue;
  }
  const fm = frontmatter(read(file));
  if (!fm) {
    fail("skill", `${name}/SKILL.md has no frontmatter`);
    skillIssues++;
    continue;
  }
  if (fm.name !== name) fail("skill", `${name}/SKILL.md name is ${fm.name}`);
  const desc = description(read(file));
  if (!desc) fail("skill", `${name}/SKILL.md has no description`);
  if ("disable-model-invocation" in fm) hidden.push(name);
  else visibleChars += desc.length;
  if (desc.length > 300) longDescriptions.push(`${name} (${desc.length})`);
}
if (!skillIssues && skills.length) {
  pass("skill", `${skills.length} skills have frontmatter, matching IDs, descriptions`);
}

// 1b. Discovery policy. A skill that sets disable-model-invocation disappears from the
// model's available list and loads only when the user names it. poteto-mode is invoked
// deliberately as /pstack/poteto-mode; every other skill must stay advertised, or the
// model cannot pick unslop, how, why, tdd, or any principle on its own.
const hiddenByDesign = ["poteto-mode"];
const wrongHidden = hidden.filter((name) => !hiddenByDesign.includes(name));
const missingHidden = hiddenByDesign.filter((name) => !hidden.includes(name));
if (wrongHidden.length) {
  fail("discovery", `disable-model-invocation on ${wrongHidden.join(", ")}; only poteto-mode may hide`);
} else if (missingHidden.length) {
  fail("discovery", `poteto-mode must set disable-model-invocation: true`);
} else {
  pass("discovery", `only poteto-mode hides; ${skills.length - hidden.length} skills are advertised`);
}

// 1c. Every advertised description rides in the model's context, so keep them short.
if (longDescriptions.length) {
  fail("description", `over 300 chars: ${longDescriptions.join(", ")}`);
} else {
  pass("description", `all descriptions <= 300 chars; ${visibleChars} chars advertised`);
}

// 2. Commands: one per skill, body loads an existing skill ID.
const commandDir = join(port, "commands", "pstack");
const commands = existsSync(commandDir) ? readdirSync(commandDir).filter((n) => n.endsWith(".md")) : [];
if (commands.length !== skills.length) {
  fail("command", `${commands.length} commands for ${skills.length} skills`);
}
for (const file of commands) {
  const text = read(join(commandDir, file));
  const fm = frontmatter(text);
  const label = file.replace(/\.md$/, "");
  if (!fm?.description) fail("command", `${file} has no description`);
  if (!text.includes(`\`${label}\``)) fail("command", `${file} does not load ${label}`);
  if (!skills.includes(label)) fail("command", `${file} points at missing skill ${label}`);
}
if (commands.length && commands.length === skills.length) {
  pass("command", `${commands.length} commands each load their skill`);
}

// 3. Agents: subagent mode under agents/pstack, ID is pstack/<stem>.
const agentsRoot = join(port, "agents", "pstack");
const agents = existsSync(agentsRoot) ? readdirSync(agentsRoot).filter((n) => n.endsWith(".md")) : [];
for (const file of agents) {
  const fm = frontmatter(read(join(agentsRoot, file)));
  if (!fm) fail("agent", `${file} has no frontmatter`);
  else {
    if (fm.mode !== "subagent") fail("agent", `${file} mode is ${fm.mode}`);
    if (!fm.description) fail("agent", `${file} has no description`);
  }
}
const agentIds = agents.map((f) => `pstack/${f.replace(/\.md$/, "")}`);
const rolesFile = join(skillsRoot, "setup-pstack", "references", "roles.md");
if (!existsSync(rolesFile)) fail("roles", "setup-pstack/references/roles.md is missing");
else {
  const ids = [...new Set([...read(rolesFile).matchAll(/`(pstack\/[a-z0-9-]+)`/g)].map((m) => m[1]))];
  for (const id of ids) {
    if (!agentIds.includes(id)) fail("roles", `roles.md names ${id} with no agent file`);
  }
  if (ids.length < 10) fail("roles", `roles.md maps only ${ids.length} agents`);
  pass("roles", `${ids.length} role agents mapped`);
}
if (agents.length) pass("agent", `${agents.length} subagent-mode agents with descriptions`);

// 4. No Cursor-era names, and no stale pstack- skill prefix, in prose.
const banned = [
  [/(^|[^\w])~\/\.cursor/g, "~/.cursor path"],
  [/(^|[^\w])\.cursor\//g, ".cursor path"],
  [/pstack-models\.mdc/g, "pstack-models.mdc"],
  [/AskQuestion/g, "AskQuestion"],
  [/subagent_type/g, "subagent_type"],
  [/run_in_background/g, "run_in_background"],
  [/claude-opus-5-5-xhigh/g, "Cursor model slug"],
  [/grok-4\.7-xhigh-fast/g, "Cursor model slug"],
  [/\bcursor-grok|composer-\d/g, "Cursor model slug"],
  [new RegExp(`(?<![\\w/.-])pstack-(${skills.join("|")})(?![\\w-])`), "stale pstack- skill prefix"],
];
const proseRoots = [join(port, "skills"), join(port, "pstack-docs")];
let bannedHits = 0;
for (const dir of proseRoots) {
  if (!existsSync(dir)) continue;
  for (const file of walk(dir)) {
    if (!file.endsWith(".md")) continue;
    const rel = file.slice(root.length + 1).replace(/\\/g, "/");
    if (rel === "pstack-docs/harness/opencode.md") continue; // the adapter names the Cursor side
    const text = read(file);
    for (const [re, label] of banned) {
      const m = text.match(re);
      if (m) {
        const line = text.slice(0, m.index).split("\n").length;
        fail("cursor-name", `${rel}:${line} has ${label}`);
        bannedHits++;
      }
    }
  }
}
if (!bannedHits) pass("cursor-name", "no Cursor-era names or stale prefixes in skills or docs");

// 5. Relative links resolve.
let brokenLinks = 0;
for (const dir of proseRoots) {
  if (!existsSync(dir)) continue;
  for (const file of walk(dir)) {
    if (!file.endsWith(".md")) continue;
    const text = read(file);
    for (const m of text.matchAll(/\]\(([^)#\s]+)(#[^)]*)?\)/g)) {
      const target = m[1];
      if (/^(https?:|mailto:|url$)/.test(target)) continue;
      if (!target.includes("/") && !target.includes(".")) continue;
      const abs = resolve(dirname(file), target);
      if (!existsSync(abs)) {
        fail("link", `${file.slice(root.length + 1)} -> ${target}`);
        brokenLinks++;
      }
    }
  }
}
if (!brokenLinks) pass("link", "every relative markdown link resolves");

// 6. Installed copy: presence, content, and skill-ID collisions.
const installedSkills = join(dest, "skills", "pstack");
if (existsSync(installedSkills)) {
  const missing = skills.filter((name) => !existsSync(join(installedSkills, name, "SKILL.md")));
  const missingAgents = agentIds.filter((id) =>
    !existsSync(join(dest, "agents", "pstack", `${id.split("/")[1]}.md`)),
  );
  const missingCommands = commands.filter((file) => !existsSync(join(dest, "commands", "pstack", file)));
  const collisions = skills.filter((name) => existsSync(join(dest, "skills", name, "SKILL.md")));
  if (missing.length || missingAgents.length || missingCommands.length) {
    fail(
      "install",
      `missing skills=${missing.length} agents=${missingAgents.length} commands=${missingCommands.length} under ${dest}`,
    );
  } else {
    pass("install", `${skills.length} skills, ${agents.length} agents, ${commands.length} commands under ${dest}`);
  }
  for (const name of collisions) {
    fail("collision", `another skill at ${join(dest, "skills", name)} uses ID ${name}`);
  }
  if (!collisions.length) pass("collision", "no other skill claims a pstack skill ID");
} else {
  pass("install", `no install at ${installedSkills} (skipped)`);
}

for (const line of checks) console.log(`ok   ${line}`);
for (const line of failures) console.log(`FAIL ${line}`);
console.log(`\n${checks.length} checks passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
