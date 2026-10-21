# pstack in OpenCode v2

pstack skills use Cursor names. This file is the adapter for OpenCode v2. Read it once per
session, then map each Cursor name with the tables below. If a Cursor field has no row, drop it
and say so. Never pass a field or a value the tool schema rejects.

## Install layout

| Piece | Location |
| --- | --- |
| Skills | `~/.config/opencode/skills/pstack/<name>/SKILL.md`, or `.opencode/skills/pstack/<name>/` |
| Agents | `~/.config/opencode/agents/pstack/<role>.md`, or `.opencode/agents/pstack/<role>.md` |
| Commands | `~/.config/opencode/commands/pstack/<name>.md` |
| Role models | the `model:` line in each `~/.config/opencode/agents/pstack/<role>.md` |
| Docs | `~/.config/opencode/pstack-docs/` |

A skill's ID is its directory name, so `skills/pstack/unslop/` is the `unslop` skill and the
user types `/pstack/unslop`. An agent's ID is its path under `agents/`, so
`agents/pstack/code.md` is `pstack/code`. Commands keep their `/pstack/` namespace.

## Skill discovery

`poteto-mode` sets `disable-model-invocation: true`, so it never appears in the model's skill
list; it loads only when the user types `/pstack/poteto-mode`. Every other skill is advertised
by ID and loads with the `skill` tool, which is what lets the model choose `unslop`, `how`,
`why`, `tdd`, or a `principle-*` skill on its own. Only `poteto-mode` may hide itself: a hidden
skill cannot be picked by the model, so hiding the rest would make the skill system dead
weight. `node scripts/verify-port.mjs` enforces both rules.

## Tools

| Cursor | OpenCode v2 |
| --- | --- |
| `Task` tool | `subagent` tool. Its inputs are `agent`, `description`, `prompt`, `background`. |
| `AskQuestion` | `question` tool. It takes a header, a prompt, and choices; free text is always allowed. |
| Open a todolist | v2 has no todo tool. Keep the plan in your reply and update it as each step lands. |
| Run another pstack skill (`/name` or "the **name** skill") | Load the `<name>` skill with the `skill` tool. Every pstack skill except `poteto-mode` is advertised by ID, so you can pick one yourself. |
| `Grep`, `Glob` | `grep`, `glob`. |
| `SemanticSearch` | `grep` over the name, then `read` the hits. |

## Subagent fields

| Cursor | OpenCode v2 |
| --- | --- |
| `subagent_type: generalPurpose` | `agent: "general"` |
| `subagent_type: poteto-agent` | `agent: "pstack/poteto-agent"` |
| `subagent_type: comment-sicko` | `agent: "pstack/comment-sicko"` |
| `readonly: true` | `agent: "explore"`, the built-in read-only agent. It keeps read, glob, grep, webfetch, websearch and returns findings. |
| `readonly: false` | `agent: "pstack/poteto-agent"` for code work, `agent: "general"` for research. |
| `model: <slug>` | Omit. A subagent's model lives in its agent file. Spawn the role agent that carries the model you want. |
| `run_in_background: true` | `background: true` |
| `resume` on an agent | Pass the child's `sessionID` back to `subagent` to continue that conversation. |
| `environment: "cloud"` | `worktree_create` for an isolated checkout. There are no cloud agents. |
| `environment: "local"` | Omit. |
| `cloud_base_branch: <b>` | Tell the worker to check out `<b>` before it starts. |
| `file_attachments` | List the paths in the prompt. |

Nesting depth is one by default. Only `mode: subagent` agents can be spawned. The parent's
`subagent` permission decides which agents it may launch.

## Roles and models

pstack's per-role model choice is one agent per role. `setup-pstack` writes the
`model:` line of each role agent from the models OpenCode reports. A role agent with no
`model:` inherits the parent session model.

The role table lives in `../../skills/pstack/setup-pstack/references/roles.md`. When a skill
names a role (`arena runners`, `swarm workers`, `judgment and prose`), spawn the agents that
table assigns to it, one subagent per agent ID (`pstack/arena-1`, `pstack/arena-2`,
`pstack/swarm-worker`). Never invent a model slug, and never pass `model` to the `subagent`
tool: it does not accept one.

## Paths

| Cursor | OpenCode v2 |
| --- | --- |
| `.cursor/skills/`, `~/.cursor/skills/` | `.opencode/skills/pstack/`, `~/.config/opencode/skills/pstack/` |
| `~/.cursor/plugins/`, `.cursor-plugin/plugin.json` | `~/.config/opencode/`, `plugin.json` |
| `.cursor/rules/pstack-models.mdc` | `~/.config/opencode/agents/pstack/<role>.md` |
| `~/.cursor/projects/<slug>/agent-transcripts/` | `opencode session list`, then `opencode session export <sessionID>`. The database is `~/.local/share/opencode/opencode.db`. |
| `https://github.com/cursor/plugins/blob/main/pstack/skills/<name>/<path>` | `skills/pstack/<name>/<path>` in the installed port. Read the local copy; never fetch it. |
| `https://github.com/cursor/plugins/blob/main/pstack/docs/<path>` | `pstack-docs/<path>` in the installed port. |

## Cursor-only features

OpenCode has no Cursor Automations, Bugbot, cloud agents, Custom Modes, `/loop`, built-in
`create-skill`, or the `cursor-team-kit` plugin. When a step needs one, write one line,
`Skipped in OpenCode: <step>. <reason>.`, then continue with the next step. Do not stop, ask,
or retry. Substitute a native path where one exists:

| Cursor feature | OpenCode path |
| --- | --- |
| Cursor Automations, routines, `update_state`, `api2.cursor.sh` webhooks | Skip with the line. |
| Bugbot review threads | The PR's review threads are ordinary GitHub review threads. Triage them with `gh pr view --comments` and `gh api`. |
| Cursor cloud agents | `worktree_create`, then run the work in that directory. Skip steps that need the cloud dashboard or its VM. |
| `/loop until X` | A `background: true` subagent that polls, or a shell watcher script. There is no loop command. |
| `create-skill` | Use the `playbooks/authoring-a-skill.md` playbook in `poteto-mode`. |
| `cursor-team-kit` (`/deslop`, `control-cli`, `control-ui`) | Use the repo's verification skill (`/pstack/create-verification-skill` generates one). If the repo has none, drive the surface with the shell and say so. |
| Custom Modes | Select the primary agent in the TUI, or launch with `opencode run --agent <id>`. |
