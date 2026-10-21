---
name: reflect
description: Spawn three parallel review subagents over the active transcript, surface learnings, and route each to a concrete edit on an existing skill. Use when the user says reflect.

---

# Reflect

Mine the current conversation for durable learnings, then route them into skill edits.

Invoke when the user says "reflect" or "/pstack/reflect". Skip when the conversation is trivial, off-topic, or already covered by an existing skill the parent followed correctly. One-offs are not learnings.

## 1. Locate the active transcript

Before fanning out, find this conversation in the session store. `opencode session list` prints recent sessions with their IDs and working directories. Take the one whose directory matches this workspace and whose opening user prompt is this conversation's. Export it to read it. Do not list or export sessions from other projects. That crosses workspace boundaries and reads private chats from unrelated projects.

```bash
opencode session list
opencode session export <sessionID>
```

The database behind both is `~/.local/share/opencode/opencode.db`. For each candidate, match the first user message against the conversation's opening prompt. If none matches, pass a tight digest of the session instead.

## 2. Spawn three reviewers in parallel

One message, three `subagent` calls, on the role agents below. Reviewers need MCP access to look up the tickets, chat threads, and observability traces the transcript references, so spawn the role agents, not the built-in `explore` agent.

Each reviewer and the synthesizer names a role. Spawn the agents for that role, one subagent per agent ID, from `references/roles.md` in the `setup-pstack` skill. Do not pass a model. Each role agent carries its own; the operator sets them with `/pstack/setup-pstack`.

| Lens | Role | Prompt template |
|---|---|---|
| Judgment | `reflect judgment, divergent, synthesizer` | `references/judgment-reviewer.md` |
| Tooling | `reflect tooling` | `references/tooling-reviewer.md` |
| Divergent | `reflect judgment, divergent, synthesizer` | `references/divergent-reviewer.md` |

Pass each template verbatim, substituting the transcript path or digest where marked. Reviewers return findings in the `subagent` response body.

## 3. Synthesize

One `subagent` call on the `reflect judgment, divergent, synthesizer` role agent, from `references/roles.md` in the `setup-pstack` skill. Do not pass a model. It spot-verifies citations through MCP, so spawn the role agent, not the built-in `explore` agent. Pass `references/synthesizer.md` verbatim, with each reviewer's full output inlined where marked. It returns an Accepted / Rejected / Backlog list.

## 4. Structural enforcement check

Move any Accepted item that a lint rule, script, metadata flag, or runtime check would enforce more reliably to Backlog. See the **encode-lessons-in-structure** principle skill.

## 5. Apply

Present the synthesizer's full Accepted / Rejected / Backlog output and wait for explicit approval before applying any Accepted edit. The user picks the subset and may redirect routings. Skill changes affect every future agent in the org. Do not auto-apply.

File each Backlog item to your team's devex or backlog tracker without waiting. Only the Accepted list waits for approval.

Follow each approved row's Routing exactly:

- Trivial existing-skill edit (a one-line bullet, a tightened sentence, a stale fact corrected): the parent does it directly.
- Substantive existing-skill edit (a new section, a new pattern table, more than ~10 lines): hand to the Authoring a skill playbook (`playbooks/authoring-a-skill.md`) in the **poteto-mode** skill and run its draft / test / iterate loop.
- `tune description: <skill path>` (the skill exists but didn't trigger when it should have): hand to that playbook and run its description-optimization loop.
- `new skill via the authoring playbook: <kebab-name>`: hand creation to that playbook. Do not invent the shape ad hoc.

If your environment ships a SKILL.md validator, run it on every touched skill before declaring done.

## 6. Summarize for the user

Short list, no preamble:

- Edits applied: `<skill path>`. What changed, one line each.
- New skills created: `<skill path>`. One line each (rare).
- Backlog filed to the devex tracker: `<issue title>` (`<tags>`). One line each.
- Dropped: one line per rejected finding + reason from the synthesizer.
