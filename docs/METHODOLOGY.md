# How this port was built

pstack for OpenCode v2 carries the skills, playbooks and principles of
[`cursor/plugins` pstack](https://github.com/cursor/plugins/tree/main/pstack) v0.15.29
(commit `190d287`) onto a host that has none of Cursor's names. The skill text is upstream's;
every host-specific name in it is OpenCode's.

This document covers how that was done and why the result can be trusted. Runtime evidence is in
[`VERIFICATION.md`](./VERIFICATION.md); every source is listed in [`SOURCES.md`](./SOURCES.md).

## The problem

Upstream pstack is written for Cursor. Its bodies name Cursor's tools, its subagent fields, its
model slugs, and products OpenCode does not ship. A model reading those steps on OpenCode has to
translate at every step, and a wrong translation fails silently: the step still reads like a step.

What is actually in the upstream tree:

| Cursor-specific name | Where it appears upstream |
| --- | --- |
| `` `Task` `` tool, `subagent_type`, `readonly`, `run_in_background`, `environment: "cloud"` | the subagent-call shape in most skills: 10 `` `Task` `` references and 9 `subagent_type` references under `skills/**/*.md` |
| Per-role model slugs | `setup-pstack` writes `~/.cursor/rules/pstack-models.mdc`, an always-applied rule with **17 role lines** of real slugs. `claude-opus-5-5-xhigh` appears 22 times and `grok-4.7-xhigh-fast` 30 times across the skills |
| `AskQuestion`, "open a todolist" | the interaction and planning steps |
| `~/.cursor/projects/<slug>/agent-transcripts/` | session-handoff steps |
| Cursor Automations and routines, Bugbot, cloud agents, Custom Modes, `/loop`, built-in `create-skill`, `cursor-team-kit` | the shipping, overnight and cleanup playbooks |
| `disable-model-invocation: true` | 59 lines across 58 upstream files: 55 of the 56 skills, plus 3 files under `automations/benny` |

That last row is the one that bites hardest, and it is not a naming problem. The flag came over
from the Cursor copy without a decision being made about it. On OpenCode it removes the skill from
the model's available list, so a straight copy installs 56 skills of which **one** is selectable.
The ported tree would have looked complete and behaved like dead weight. The audit recorded in §8
of the verification log is what caught it.

## The approach

Native primitives only: skills, agents, commands and config. Nothing else.

- **No OpenCode source changes.** The repo contains the port, an installer and a verifier. There
  is no fork, no patched binary, and nothing to rebuild when OpenCode updates.
- **No plugin shim.** A v2 plugin is a JavaScript module with hooks; using one would mean
  re-implementing skill discovery, agent registration and command dispatch behind a second
  discovery path, and taking a dependency on the plugin API (which changed in v2 — see
  [`SOURCES.md`](./SOURCES.md)). The primitives already express everything pstack needs, so a
  plugin would only add a layer that can drift from the host.
- **One adapter document.** `pstack-docs/harness/opencode.md` is the single place that names both
  sides of the mapping. It follows the shape upstream already uses for its own second host,
  `pstack/docs/harness/claude-code.md`.

## The pipeline

Four stages, in order. Each one has a narrow contract, and the next stage assumes it ran.

| # | Stage | Input | What it does | What it refuses to do |
| --- | --- | --- | --- | --- |
| 1 | `tools/port-rewrite.py` | upstream skills copied flat as `pstack-<name>/` | Rewrites unambiguous Cursor names: paths, the `Task` tool, `subagent_type`, `readonly`/`run_in_background`, `AskQuestion`, `.cursor` paths, slash commands, sibling-skill paths. Drops `icon`, `color`, `is_background`. Prints a leftover report, counted by token. | Never renames files or directories; never touches prose that needs a decision |
| 2 | `tools/regroup.py` | the flat tree from stage 1 | Moves skills to `skills/pstack/<name>/` and agents to `agents/pstack/<role>.md`, then rewrites `pstack-<name>` → `<name>` and `pstack-<role>` → `pstack/<role>` everywhere, and syncs each `name:` to its directory. Prints leftovers. | Does not invent content; a reference it cannot resolve is reported, not guessed |
| 3 | `tools/gen-artifacts.mjs` | the grouped tree | Owns the repeated artifacts: 23 agents, 56 commands, and `setup-pstack/references/roles.md`. Deletes and rewrites each directory whole, so re-runs are idempotent. The role list is one array in this file. | Does not edit skill bodies |
| 4 | Prose pass | stage 1's leftover report | Hand rewrites of the steps the mechanical pass cannot decide, guided by `tools/rewrite-brief.md`: canonical phrasings, hard rules, and a grep the writer must paste into its report. | Never deletes a step because it is Cursor-only, and never invents an OpenCode feature |

Stage 4 is where Cursor-only features get a decision instead of a silent translation. The rule is
one line, `Skipped in OpenCode: <step>. <reason>.`, then continue — and where a native path exists,
substitute it: cloud agents become a `worktree_create` checkout, Bugbot threads become ordinary
GitHub review threads read with `gh pr view --comments`, `/loop` becomes a `background: true`
subagent or a shell watcher, `create-skill` becomes the `authoring-a-skill` playbook.

The built tree carries three skip lines, all in `make-bot-ui` (webhook routines); the convention
itself is stated once in `poteto-help`. The guide adds three more, on the two pages that describe
scheduled work (`06-verify-and-ship`, and `07-overnight` twice). Nothing else was dropped.

## Design decisions

| Decision | Why | Enforced by |
| --- | --- | --- |
| A skill's ID is its directory name: `skills/pstack/unslop/` → `unslop` | OpenCode derives the ID from the directory, so the ID is not a free choice. Keeping the group folder and dropping the prefix gives short IDs (`unslop`, `tdd`, `why`) for `@`-mentions and `skill` tool calls, while the folder still namespaces the pack. | `verify-port.mjs` compares each `name:` to its directory |
| An agent's ID is its path: `agents/pstack/code.md` → `pstack/code` | Same rule, one level up. The `pstack/` segment is what keeps 23 agents from colliding with a user's own, and it matches the command namespace. | `verify-port.mjs` builds the ID from the path and checks every ID `roles.md` names |
| Per-role model lives on the agent file, and defaults to inherit | A v2 subagent call takes an agent ID and no model, so a model passed at spawn time has nowhere to go. Putting `model:` in the agent file makes OpenCode's own registry the carrier, and leaving it out means the role inherits the parent model — which is why the port works before `/pstack/setup-pstack` ever runs. | `setup-pstack` writes the `model:` lines; §5 of the verification log proves the value reaches the child session |
| 21 role agents, not 17 roles | Upstream's panel roles are a list of models in one rule line; the fan-out is the list length. One agent per seat keeps that fan-out explicit and gives each seat its own model and permissions. | `gen-artifacts.mjs`'s role array; `roles.md` |
| `poteto-mode` is the only hidden skill | It is entered deliberately, by typing `/pstack/poteto-mode`. Every other skill exists to be *chosen* — by the user or by the model — so hiding one costs a capability. Hiding all but one costs the system. | `verify-port.mjs` fails if any other skill sets `disable-model-invocation` |
| Descriptions are short and uniform | An advertised description rides in the model's context on every step, so the 55 visible skills share one budget. The pass rewrote 35 descriptions to one sentence, and the longest is now 178 characters (§8). | `verify-port.mjs` fails above 300 characters and prints the total advertised |
| One thin command per skill | The command's whole body is "load `<name>` with the `skill` tool, then follow it". The skill body stays the only copy of the prose, so a command cannot drift from the skill it names. | `verify-port.mjs` checks each command names an existing skill ID |
| Cursor-only steps keep their place | Deleting a step changes the playbook; a skip line keeps the structure and says what happened. A reader can then see that the step exists and why it did not run. | `tools/rewrite-brief.md` rule 1; skip lines are visible in the tree |

## Verification

Four layers, weakest first. Each one catches what the one before it cannot.

| Layer | What it proves | Where |
| --- | --- | --- |
| Static gate: `node scripts/verify-port.mjs` | Structure and naming: 56 skills with frontmatter and matching IDs, 56 commands wired to their skills, 23 subagent-mode agents, the role table against the agent files, relative links, no Cursor-era names, no install collisions, discovery policy, description budget. **10 checks, 0 failed.** | §6, §8 |
| Real binary: OpenCode v2.1.1 | That the host agrees: agents discovered as 23 `pstack/*` subagents, a skill loaded by bare ID, a `/pstack/<name>` command submitted, a real child session spawned, and a `model:` line routing the child run. | §1–§5 |
| Server API and store cross-checks | Registry-level truth the CLI does not print: `GET /api/skill` for the advertised skill set, `GET /api/command` for 71 commands (56 under `pstack/`), the command endpoint for expansion, and `sqlite3` queries against `session_v2` / `session_message` for what was actually stored. | §5, §8 |
| Independent audit | A pass run apart from the build, which found the discovery defect: 55 of 56 skills hidden, descriptions under-counted by a folded YAML scalar. Both turned into gate checks that were then proven to fail on a deliberate break. | §8 |

The important property is that the audit's findings became **checks that bite**. §8 shows the gate
failing on purpose (`disable-model-invocation` on `tdd`, an over-long description) before it was
restored — a check that has never failed is not evidence.

## Limits

- **No TUI automation.** Every CLI check ran headless. The command path was exercised through the
  API (`POST /api/session/<id>/command`), which is what the TUI calls, not through keystrokes.
- **`opencode run` does not expand slash commands.** It passes the string through as text, which
  the session store confirms (§8). Commands are a TUI/API path; the README says so rather than
  implying `run` works.
- **Script tests match upstream, not green.** `bun test` in `poteto-mode/scripts` reports 63 pass /
  5 fail, the same five `Store` tests that fail upstream (§7): two time out, three fail because
  the test machine has a real `gh` on `PATH` and no `origin` executable. That is parity, not a pass;
  treat it as such.
- **Runtime was verified on one host.** Windows 11 with git-bash and a native v2.1.1 binary. No
  macOS or Linux run, and no discovery from a project-scoped `.opencode/`: an install into a clean
  destination was written and hash-checked (§6), which covers the files, not the two scopes.
- **One provider was probed.** Model routing was proven with a `<provider>/<model>` string
  on one agent. It shows the mechanism works with any `provider/model` string; it does not prove
  every provider's `#variant` suffixes behave the same.
- **Some upstream names survive on purpose.** The reference file `bugbot-triage.md` keeps its
  name so links stay valid, and the babysit playbook still names the `origin` CLI where upstream
  does. Those name a review source and a tool, not a Cursor-only step, so the gate does not ban
  them. They are leftovers a reader may want to change.
- **The gate is not a model.** It cannot tell whether a rewritten sentence means the same thing as
  the upstream one. That is what the prose brief and the audit were for.

## Where to look

- [`VERIFICATION.md`](./VERIFICATION.md) — the runtime log, with commands and their output.
- [`SOURCES.md`](./SOURCES.md) — every upstream, docs and tool source, and how to re-run the checks.
- `pstack-docs/harness/opencode.md` — the adapter: every Cursor name and its OpenCode value.
- `tools/rewrite-brief.md` — the rules the prose pass followed.
