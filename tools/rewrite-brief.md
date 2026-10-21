# Rewrite brief: Cursor pstack -> OpenCode v2

Read `pstack-docs/harness/opencode.md` first. It is the adapter and the source of truth for every
name. Then rewrite only the files your task lists. Do not touch anything else.

## Goal

A skill body must read as if it was written for OpenCode v2. An agent reading it should never
have to translate a Cursor name. Mechanical path and command renames are already done. What is
left is prose that names Cursor tools, Cursor models, or Cursor-only features.

## Voice

Match the file you are editing. Terse, imperative, one thought per sentence. No new sections, no
summaries, no "in OpenCode you would" narration. Keep every step, caveat, and exception that is
there; change names, not substance. If a Cursor feature has no equivalent, keep the step and give
it the OpenCode path, or the skip line the adapter defines. Never delete a step because it is
Cursor-only.

## Canonical phrasings

Use these exact forms so the port stays consistent.

| Instead of | Write |
| --- | --- |
| `Task` tool | `subagent` tool |
| `subagent_type: "poteto-agent"` | `agent: "pstack/poteto-agent"` |
| `subagent_type: generalPurpose` | `agent: "general"` |
| `readonly: true` | a read-only agent (`agent: "explore"`), or the read-only role agent |
| `model: <cursor slug>` | nothing. Models live on the role agent. Prose: "Do not pass a model. Each role agent carries its own." |
| `run_in_background: true` | `background: true` |
| `AskQuestion` | the `question` tool |
| "Open a todolist" | "Open the plan at the top of your reply and update it as each step lands. v2 has no todo tool." |
| the `X` line in `pstack-models.mdc` | the agents for the `X` role, one subagent per agent ID, from `references/roles.md` in the `setup-pstack` skill |
| `/setup-pstack` | `/pstack/setup-pstack` (already rewritten; keep) |
| Cursor cloud agents | a worktree: `worktree_create`, then work in that directory |
| `agent-transcripts/` | `opencode session list`, then `opencode session export <sessionID>` |
| `/loop until X` | a `background: true` subagent that polls, or a shell watcher |
| Bugbot | the PR's review threads, read with `gh pr view --comments` |
| `cursor-team-kit`, `/deslop`, `control-ui`, `control-cli` | the repo's verification skill; `/pstack/create-verification-skill` generates one |
| Cursor's built-in `create-skill` | the Authoring a skill playbook (`playbooks/authoring-a-skill.md`) |
| Cursor Automations, routines, `update_state`, `api2.cursor.sh` | `Skipped in OpenCode: <step>. <reason>.` then continue |
| "Cursor" as the host product | "OpenCode" |

Reasoning-level and speed guidance about model slugs (xhigh, `-fast`, families, rejected slugs)
does not survive: a subagent takes an agent ID and no model. Replace that whole passage with one
or two sentences that say the role agents carry their models and the operator sets them with
`/pstack/setup-pstack`. Do not keep a shadow model table.

Skills are loaded with the `skill` tool by ID, for example `unslop`. The user types
`/pstack/unslop`. Never write `/unslop`.

## Hard rules

1. No `Cursor`, `~/.cursor`, `.cursor/`, `pstack-models.mdc`, `agent-transcripts`, `AskQuestion`,
   `subagent_type`, `run_in_background`, or a Cursor model slug (`claude-opus-5-5-xhigh`,
   `grok-4.7-xhigh-fast`, `composer-*`, `cursor-grok-*`) in your output.
2. Keep every `../<name>/` and `references/...` path valid.
3. Keep the file's existing structure: same headings, same step numbers, same order.
4. Never invent an OpenCode feature. If the adapter has no row, ask yourself whether the step is
   Cursor-only; if it is, use the skip line.
5. Do not edit `agents`, `commands`, `skills/pstack/setup-pstack/references/roles.md`,
   or `pstack-docs/harness/opencode.md`. A generator owns those.

## Before you report

Run this on your files and paste the output in your report:

```bash
grep -nE 'Cursor|cursor|pstack-models|agent-transcripts|AskQuestion|subagent_type|run_in_background|claude-opus-5|grok-4\.7|composer-|/loop|Bugbot|deslop|control-ui|control-cli|create-skill' <your files>
```

Exit code 1 with no output is the pass. Report every file you changed and any step you had to
skip or reinterpret, in one line each.
