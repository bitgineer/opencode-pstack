---
name: setup-pstack
description: "Configure which model each pstack role runs on by writing the model line of each role agent. Use for setup pstack, configure pstack models, or pstack budget."
---

# Setup pstack

Set the `model:` line of each role agent, `~/.config/opencode/agents/pstack/<role>.md`. One file per role seat, listed in [`references/roles.md`](references/roles.md). Those files are the only place a role's model lives, so this skill writes nothing else. An agent with no `model:` line inherits the parent session model.

## Steps

### 1. Detect available models

Run `opencode models`. Each line is a model string, `provider/model`, sometimes with a `#variant` suffix. That output is the only dependable source and the only thing you may write. If it fails or prints nothing, ask the user to paste its output. `inherit` is always available too, even though it is not on the list: it means no `model:` line, so the agent runs on the parent session model.

### 2. Load current state

Read the agent files that [`references/roles.md`](references/roles.md) lists and note each `model:` value. A role with no `model:` line is unconfigured. This skill stores no budget, so infer it from the spread: one model on every agent reads as `medium` or `small`, a cheaper code model split from a stronger judgment model reads as `large`. An agent file under `~/.config/opencode/agents/pstack/` that `references/roles.md` does not list is not a pstack role. Leave it alone.

### 3. Budget, map, and confirm

**(a) Ask for a budget.** Use the `question` tool. Offer these four options with these exact labels, and name the current budget when step 2 inferred one. With nothing configured, say that `large` matches the pstack split.

- `unlimited — the best model you have for every role`
- `large — a strong model for judgment and review, a faster one for code`
- `medium — one mid-tier model for every role`
- `small — the cheapest model that still works`

**(b) Pick the models.** The budget sets how many slots you need: `unlimited` and `large` need a code model, a judgment model, and a review model; `medium` and `small` need one. Ask for each slot with the `question` tool, offering the `opencode models` lines plus `inherit`, and take free text only to name a string from that list. Default every slot to the model this session runs on, and say so.

**(c) Show the roles and confirm.** Show one row per role line: the role, its agent IDs, and the model each agent will get. Mark any string that is not on the detected list as needing a choice, and name the slot the row shares. Then ask whether to accept as-is or change specific roles, offering the same choices as (b). Use the `question` tool.

Roles map to slots as follows:

- code: `feature, refactoring`, `bug-fix`, `perf-issue`, `hillclimb`, `arena runners`, `architect runners`, `swarm workers`
- judgment: `judgment and prose`, `hardest tasks`, `how explainer`, `why synthesizer`
- review: every row whose Read-only column says yes, so `how explorer`, `why investigators`, `reflect tooling`, `reflect judgment, divergent, synthesizer`, `arena cross-judge pool`, `interrogate reviewers`

A panel role gets one subagent per agent ID, so its fan-out is the number of agent IDs on its row and every seat runs. `swarm workers` is a single agent, so every worker in a run takes its model.

### 4. Validate

Every `model:` string you write must match a line from `opencode models`, character for character, `#variant` suffix included. `inherit` always passes and writes no line. If a chosen string is not on the list, stop and ask again with the list in front of the user. Do not substitute a similar model.

### 5. Write the agents

Edit each agent file on a role row whose model changed. Change only the `model:` line, inserted after `mode: subagent`. Leave every other line byte-identical; a whole-file rewrite is fine when that holds. `inherit` removes the line. Re-runs converge: the same choices produce the same files, and a role already on that string is left untouched. Shape, for one agent:

```
---
description: "Writes features and behaviour-preserving refactors."
mode: subagent
model: <provider>/<model>
permissions:
  - action: subagent
    resource: "*"
    effect: deny
---
```

The model string is exactly what `opencode models` printed.

### 6. Confirm

Tell the user which agent files changed and which role each serves. Every subagent spawned from now on uses the new model, in this session and in new ones; a subagent already running keeps the model it started on. Re-running this skill edits the same lines.

### 7. Offer a verification skill (optional)

Check whether the project has a way to drive the real app for proof (a `verify-*` skill, or an existing harness). If not, offer once: "want a project-local verification skill, so agents can drive the app the way a user does and prove changes work? I can generate one with /pstack/create-verification-skill." On yes, invoke `/pstack/create-verification-skill` (resolves wherever pstack is installed: workspace, user, or plugin). On no, move on without pushing.

### 8. Offer a formal verification skill (optional)

Check whether the project already has a formal verification skill (a project skill that runs a model checker, a proof, or another verifier against the code). If not, offer once: "want a formal verification skill, so agents can prove a key property of your code holds in every case in scope, not only the cases tests reach? I can generate one with /pstack/create-formal-verification-skill." On yes, invoke `/pstack/create-formal-verification-skill` (resolves wherever pstack is installed: workspace, user, or plugin). On no, move on without pushing.
