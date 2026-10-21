#!/usr/bin/env node
// Generates the OpenCode v2 artifacts that repeat: role agents, slash commands, and the
// role table. Run after tools/regroup.py so the skill tree is skills/pstack/<name>/.
//
//   node tools/gen-artifacts.mjs
//
// Every output is rewritten whole, so re-runs are idempotent.

import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// The installable tree lives at the repo root: skills/, agents/, commands/, pstack-docs/.
const port = root;
const skillsDir = join(port, "skills", "pstack");
const agentsDir = join(port, "agents", "pstack");
const commandsDir = join(port, "commands", "pstack");

// role line -> [agent file stem, agent purpose, readOnly]
const roles = [
  ["feature, refactoring", "code", "Writes features and behaviour-preserving refactors.", false],
  ["bug-fix", "bugfix", "Reproduces a defect, finds the root cause, and fixes it with runtime evidence.", false],
  ["perf-issue", "perf", "Traces a measured slowness and improves it against a baseline.", false],
  ["hillclimb", "hillclimb", "Runs the hillclimb loop: hypothesis, measurement, commit per accepted win.", false],
  ["judgment and prose", "judgment", "Owns judgment calls and prose surfaces.", false],
  ["hardest tasks", "hardest", "Takes the cross-cutting, subtle, or under-specified work.", false],
  ["how explorer", "how-explorer", "Maps a subsystem read-only and returns the trace.", true],
  ["how explainer", "how-explainer", "Turns an explorer's trace into an explanation the caller can ship.", false],
  ["why investigators", "why-investigator", "Digs through history, PRs, and issues read-only to find rationale.", true],
  ["why synthesizer", "why-synthesizer", "Synthesizes investigator findings into one rationale with citations.", false],
  ["reflect tooling", "reflect-tooling", "Reviews a session for tooling and workflow lessons, read-only.", true],
  ["reflect judgment, divergent, synthesizer", "reflect-judgment", "Reviews a session for judgment lessons and diverges on what it finds, read-only.", true],
  ["arena runners", "arena-1", "Arena runner seat one. Builds one candidate.", false],
  ["arena runners", "arena-2", "Arena runner seat two. Builds one candidate.", false],
  ["arena cross-judge pool", "cross-judge-1", "Arena cross-judge seat one. Scores candidates against the rubric.", true],
  ["arena cross-judge pool", "cross-judge-2", "Arena cross-judge seat two. Scores candidates against the rubric.", true],
  ["swarm workers", "swarm-worker", "One worker in a swarm lane. Runs the assigned slice and reports evidence.", false],
  ["architect runners", "architect-1", "Architect runner seat one. Sketches one design.", false],
  ["architect runners", "architect-2", "Architect runner seat two. Sketches one design.", false],
  ["interrogate reviewers", "interrogate-1", "Interrogate reviewer seat one. Adversarial review, read-only.", true],
  ["interrogate reviewers", "interrogate-2", "Interrogate reviewer seat two. Adversarial review, read-only.", true],
];

const readFrontmatter = (file) => {
  const text = readFileSync(file, "utf8");
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const out = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([a-z-]+):\s*(.*)$/i);
    if (kv) out[kv[1]] = kv[2].replace(/^["']|["']$/g, "");
  }
  return out;
};

const skillNames = readdirSync(skillsDir, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

const descriptions = new Map();
for (const name of skillNames) {
  const fm = readFrontmatter(join(skillsDir, name, "SKILL.md"));
  descriptions.set(name, (fm.description || `The ${name} skill.`).replace(/\s+/g, " ").trim());
}

const oneLine = (text, max = 150) => {
  const first = text.split(/(?<=\.)\s/)[0].trim();
  const s = first.length > max ? `${first.slice(0, max - 1).trimEnd()}…` : first;
  return s.replace(/:/g, " -");
};

// --- agents -------------------------------------------------------------------------
const preamble = (role, readOnly) => `You are a pstack delegate. Load the \`poteto-mode\` skill with the
skill tool before any work, and follow the principle leaves it points at. Your parent owns the
playbook, the plan, and the final verification. ${readOnly
  ? "You are read-only: report findings, never edit files."
  : "You own the files you touch and the evidence you report."}

Your role: ${role}`;

const agentFiles = [
  [
    "poteto-agent",
    "Delegate subagent for code-writing and helper tasks spawned during a /pstack/poteto-mode run.",
    `You are a pstack delegate, not the runner of the run. The parent session owns the playbook, the
plan, and every spawn.

Before any work, load the \`poteto-mode\` skill with the skill tool and read it in full, including
its Principles index. Load the \`principle-*\` leaf whenever you apply a principle. Work from the
brief your parent gives you, keep the diff small, and report what you changed with the evidence
that proves it.`,
  ],
  [
    "comment-sicko",
    "A deranged comment-hater that savors deletion and condemns workaround code. Report only.",
    `You are Comment Sicko. Your first output is exactly: Yes... Ha ha ha... Yes!

You hate comments. Judge only the parent's scoped files or diff. Narration, banners,
commented-out corpses, and workaround sermons are all meat. Legal headers, public API doc
contracts, issue links that explain a constraint code cannot express, and non-obvious behaviour
forced by an external dependency survive. When unsure a keep clause applies, the comment dies.

Report only. Name touched files, the deletion count, \`MUST KILL\` flags with one line each, and
skips. Never write application code.`,
  ],
];

for (const [roleLine, stem, purpose, readOnly] of roles) {
  const role = `${purpose.replace(/\.$/, "")}. Serves the \`${roleLine}\` role.`;
  agentFiles.push([stem, purpose, preamble(role, readOnly), readOnly]);
}

rmSync(agentsDir, { recursive: true, force: true });
mkdirSync(agentsDir, { recursive: true });
for (const [stem, description, body, readOnly] of agentFiles) {
  const permissions = readOnly
    ? `
permissions:
  - action: edit
    resource: "*"
    effect: deny
  - action: subagent
    resource: "*"
    effect: deny
`
    : `
permissions:
  - action: subagent
    resource: "*"
    effect: deny
`;
  const text = `---
description: ${JSON.stringify(description)}
mode: subagent${permissions}---

${body}
`;
  writeFileSync(join(agentsDir, `${stem}.md`), text, "utf8");
}

// --- commands -----------------------------------------------------------------------
rmSync(commandsDir, { recursive: true, force: true });
mkdirSync(commandsDir, { recursive: true });
for (const name of skillNames) {
  const text = `---
description: ${JSON.stringify(oneLine(descriptions.get(name)))}
---

Use the skill tool to load \`${name}\`, then follow that skill for this request.

$ARGUMENTS
`;
  writeFileSync(join(commandsDir, `${name}.md`), text, "utf8");
}

// --- role table ---------------------------------------------------------------------
const byRole = new Map();
for (const [roleLine, stem, purpose, readOnly] of roles) {
  if (!byRole.has(roleLine)) byRole.set(roleLine, []);
  byRole.get(roleLine).push({ id: `pstack/${stem}`, purpose, readOnly });
}

const table = [
  "# pstack roles in OpenCode v2",
  "",
  "pstack names a role for each subagent it spawns. In OpenCode a subagent takes an agent ID and",
  "no model, so each role is one agent per seat. Spawn the agents below for the role a skill names.",
  "A panel role gets one subagent per agent ID, so its seat count is the fan-out.",
  "",
  "Models live on the agents. `model:` in `~/.config/opencode/agents/pstack/<role>.md` is the only",
  "place a role's model is set, and `/pstack/setup-pstack` is the way to set it. An agent with no",
  "`model:` inherits the parent session model.",
  "",
  "| Role line | Agent IDs | Read-only |",
  "| --- | --- | --- |",
  ...Array.from(byRole, ([roleLine, seats]) =>
    `| \`${roleLine}\` | ${seats.map((s) => `\`${s.id}\``).join(", ")} | ${seats[0].readOnly ? "yes" : "no"} |`,
  ),
  "",
  "## Defaults",
  "",
  "Until `/pstack/setup-pstack` runs, every role agent inherits the parent model. That keeps the",
  "port working with no configuration. Configure roles when you want pstack's split of fast code",
  "work against slower judgment work.",
  "",
  "Seat agents exist so panels stay separate: arena and architect seats build candidates,",
  "interrogate and cross-judge seats review them.",
  "",
].join("\n");

mkdirSync(join(skillsDir, "setup-pstack", "references"), { recursive: true });
writeFileSync(join(skillsDir, "setup-pstack", "references", "roles.md"), table, "utf8");

console.log(`agents:   ${agentFiles.length}`);
console.log(`commands: ${skillNames.length}`);
console.log(`skills:   ${skillNames.length}`);
