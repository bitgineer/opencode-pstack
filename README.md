# pstack for OpenCode v2

pstack is an engineering style for agents: playbooks for the work, principles that settle
tradeoffs, and verification against the real artifact. This repository is a native OpenCode v2
port of [cursor/plugins `pstack`](https://github.com/cursor/plugins/tree/main/pstack) (v0.15.29,
upstream `190d287`). It is expressed in OpenCode's own primitives: skills, agents, commands, and
config. There is no OpenCode fork, no vendored runtime, and no plugin shim; the files are the
port.

## What you get

- **56 skills** under `skills/pstack/<name>/SKILL.md`, with their playbooks, references, and
  scripts.
- **23 subagents** under `agents/pstack/<role>.md`: 21 role seats plus `poteto-agent` and
  `comment-sicko`.
- **56 commands**, one per skill, under `commands/pstack/<name>.md`, typed as `/pstack/<name>`.
- `pstack-docs/`, the installed guide and the OpenCode adapter.

## Install

```bash
git clone https://github.com/bitgineer/opencode-pstack opencode-pstack
cd opencode-pstack

node scripts/install.mjs --dry-run   # print the plan, write nothing
node scripts/install.mjs             # -> ~/.config/opencode
node scripts/install.mjs --project   # -> ./.opencode in the current directory
node scripts/install.mjs --check     # exit 0 only if the install matches this tree
```

Add `--dest <dir>` to target an explicit config directory. Add `--project` or `--dest` to
`--check` as well, so the check reads the same destination the install wrote.

Installing through an agent? [`docs/AGENT-INSTALL.md`](docs/AGENT-INSTALL.md) is the same
procedure written as a runbook: preconditions, the destination decision, the exact output each
step should print, and the failure table. It also covers the two traps in this install — a v1
binary shadowing v2 on `PATH`, and running `verify-port.mjs` without the destination flag, which
makes it inspect a directory with no install and still exit 0.

The installer owns four paths and replaces each whole: `skills/pstack`, `agents/pstack`,
`commands/pstack`, and `pstack-docs`. Nothing else in the config directory is touched, and
nothing this port does not own is removed. A re-run after an update converges, so a skill
deleted upstream does not survive in the installed copy.

If the OpenCode server was already running, restart it so the new skills, agents, and commands
are registered:

```bash
opencode service restart
```

## Use

```
/pstack/setup-pstack    # optional: pick a model for each role
/pstack/poteto-mode     # start work that needs rigor
/pstack/poteto-help     # which skill fits this request
/pstack/<name>          # any skill directly, e.g. /pstack/unslop
```

A skill's ID is its directory name, so `skills/pstack/unslop/` is the skill `unslop`. The model
loads a skill with the `skill` tool by that bare ID; there is no `@` prefix. Slash commands are
the path you type, and each one loads its skill and passes the rest of the line through.

`poteto-mode` sets `disable-model-invocation: true`, so it never appears in the model's skill
list and starts only when you type `/pstack/poteto-mode`. Every other skill is advertised by ID,
which is what lets the model choose `unslop`, `how`, `why`, `tdd`, or a `principle-*` skill on
its own. The gate fails if any other skill hides.

## How it maps to OpenCode

| Piece | Location | ID or invocation |
| --- | --- | --- |
| Skill | `~/.config/opencode/skills/pstack/<name>/SKILL.md`, or `.opencode/skills/pstack/<name>/` | directory name, e.g. `unslop` |
| Agent | `~/.config/opencode/agents/pstack/<role>.md`, or `.opencode/agents/pstack/<role>.md` | path under `agents/`, e.g. `pstack/code` |
| Command | `~/.config/opencode/commands/pstack/<name>.md` | `/pstack/<name>` |
| Model | the `model:` line in each agent file | one model per role; no line inherits the parent session |
| Docs | `~/.config/opencode/pstack-docs/`, or `.opencode/pstack-docs/` | `guide/`, `harness/opencode.md` |

## What is different from Cursor pstack

- **Role models are agent files, not a rules file.** `~/.cursor/rules/pstack-models.mdc` becomes
  the `model:` line of each `agents/pstack/<role>.md`, written by `/pstack/setup-pstack` from
  `opencode models`. The agent is the unit of model choice, so the old reasoning-level guidance
  ("raise the effort a step, drop `-fast`") has no target and is gone.
- **No todo tool.** OpenCode v2 has none, so the plan lives at the top of the reply and is
  updated as each step lands.
- **Cursor-only features skip with a substitute.** Automations, Bugbot-as-a-service, cloud
  agents, Custom Modes, `/loop`, and `cursor-team-kit` do not exist here. A step that needs one
  writes `Skipped in OpenCode: <step>. <reason>.` and continues. Review threads become ordinary
  GitHub review threads, and cloud agents become worktrees.
- **`opencode run` does not expand slash commands.** The TUI sends
  `POST /api/session/<id>/command`, and the server writes the command's expanded text into the
  prompt. `opencode run "/pstack/bro ..."` passes the string through as ordinary text, so use it
  for prose prompts and the TUI or the command endpoint for `/pstack/<name>`.

The full mapping, including every tool name and skip line, is `pstack-docs/harness/opencode.md`
in the installed copy.

## Verification

`node scripts/verify-port.mjs` is the static gate. It checks, and exits non-zero on any failure:

| Check | What it proves |
| --- | --- |
| `skill` | every skill has frontmatter, its ID matches its directory, it has a description |
| `discovery` | only `poteto-mode` hides from the model; 55 skills are advertised |
| `description` | no advertised description exceeds 300 characters |
| `command` | 56 commands, each loading a skill that exists |
| `roles` | the role table in `setup-pstack/references/roles.md` names only agents that exist |
| `agent` | 23 agents, all `mode: subagent`, all with descriptions |
| `cursor-name` | no Cursor paths, tool names, model slugs, or stale `pstack-` prefixes in prose |
| `link` | every relative markdown link resolves |
| `install` | the installed copy has all 56 skills, 23 agents, 56 commands |
| `collision` | no other installed skill claims a pstack skill ID |

`node scripts/check-private.mjs` is the publish gate, separate from the checks above. It scans
the tree with 11 rules — home paths, emails, session ids, credential prefixes, a provider account
alias, vendor model ids, hostnames, tailnet names, private IPs and personal handles — prints every
hit as `path:line  [rule]  what`, and exits 1 on any hit. False positives live in
`scripts/private-allowlist.txt`, one entry per quoted string with the reason it is evidence rather
than private data. It skips `cursor-plugins/`, `bin-v2/`, `node_modules/` and `.git/`, so it means
the same thing on a fresh clone.

Proven live on OpenCode v2.1.1 with the standalone binary, not inferred from the files:

- `opencode debug agents` reports 23 `pstack/` IDs, all `subagent`, and no flat `pstack-*` IDs.
- The model loads a skill by bare ID: `→ Skill "unslop"`.
- `/pstack/bro` reaches the `bro` skill through the command endpoint.
- `pstack/poteto-agent` spawns a real child session, recorded in the session store.
- A `model:` line on a role agent routes the child run to that provider/model.

The static gate reported `10 checks passed, 0 failed` and `install.mjs --check` reported
`check: install matches the port` after a clean install. The ported scripts match the upstream
test baseline, 63 pass / 5 fail: five `Store` tests fail the same way upstream, two by timeout and
three because the test machine has a real `gh` and no `origin` executable.

Evidence and method: [`docs/VERIFICATION.md`](docs/VERIFICATION.md) has the raw runs,
[`docs/METHODOLOGY.md`](docs/METHODOLOGY.md) has the porting and review process.

## Updating from upstream

The pipeline is mechanical first, prose second, and it runs in this order:

1. Copy the upstream skills flat and prefixed, `pstack-<name>/`, as the rewrite input.
2. Run `tools/port-rewrite.py`: paths, tool names, subagent fields, and skill IDs. It prints
   what it could not decide.
3. Run `tools/regroup.py`: `pstack-<name>/` becomes `skills/pstack/<name>/`, and the prefix
   drops from every ID and reference.
4. Run `node tools/gen-artifacts.mjs`: regenerate the role agents, the 56 commands, and the role
   table. Outputs are rewritten whole, so re-runs are idempotent.
5. Rewrite the prose the mechanical pass left behind, following `tools/rewrite-brief.md`.
6. Reinstall and gate:

   ```bash
   node scripts/install.mjs
   node scripts/verify-port.mjs
   node scripts/install.mjs --check
   ```

Anything the rewrite reports as leftover is a prose decision, not a script fix. The `cursor-name`
check exists to catch what step 5 misses.

## Provenance

Upstream pstack is by Lauren Tan (poteto), MIT licensed, at `cursor/plugins/pstack`, tag
v0.15.29, commit `190d287`. This port keeps the MIT license and keeps the original skill text
wherever OpenCode has an equivalent; the edits are names, locations, and the passages that
describe Cursor-only mechanisms. `pstack-docs/` is the upstream guide, adapted to the OpenCode
adapter in `pstack-docs/harness/opencode.md`.

## License

MIT. See [LICENSE](LICENSE). Copyright (c) 2026 Lauren Tan.
