# Set up pstack

In this page you install the port, pick which models pstack uses, and run your first task. Setup is one command plus a short conversation.

## Install pstack

From the port root, run:

```bash
node scripts/install.mjs
```

That copies `skills/pstack/`, `agents/pstack/`, `commands/pstack/`, and `pstack-docs/` into `~/.config/opencode/`. For a project-local install, run `node scripts/install.mjs --project`, which writes `.opencode/` in the current directory. `--dry-run` prints the plan without writing, and `--check` exits non-zero when an install is out of date. A re-run replaces every pstack-owned path whole, so an update leaves no stale skill, agent, or command behind.

Skills install under `skills/pstack/<name>/`, and the directory name is the skill ID: `unslop` lives at `skills/pstack/unslop/`, loads as `unslop` (or `@unslop`), and you type `/pstack/unslop`. Agents install under `agents/pstack/<role>.md`, and the path under `agents/` is the agent ID: `agents/pstack/code.md` is `pstack/code`. Commands live under `commands/pstack/`, so every command in this guide is `/pstack/<name>`.

## Pick your models

Run:

```text
/pstack/setup-pstack
```

[`/pstack/setup-pstack`](../../skills/pstack/setup-pstack/SKILL.md) detects the models OpenCode reports, asks for a reasoning budget, shows you each role (code delegates, judgment, the review panels), and asks what you want. Answer the questions. It writes the `model:` line of each role agent, `~/.config/opencode/agents/pstack/<role>.md`. That line is the only place a role's model is set.

A role is one or more agents, one per seat, and the seats are listed in `references/roles.md` in the `setup-pstack` skill. A subagent takes an agent ID and no model, so pstack spawns the agent that carries the model you picked. Never pass a model to the `subagent` tool.

The budget sets the reasoning effort every role runs at: `unlimited`, `large`, `medium`, or `small`. `large` matches the defaults, and `small` spends the fewest tokens.

You only override what you care about. A role agent with no `model:` line inherits the parent session model. To restore a default, delete that role's `model:` line. A rerun of `/pstack/setup-pstack` keeps any role you changed. When a default changes, an agent file written before the change still pins the old choice, so delete those `model:` lines and run `/pstack/setup-pstack` again.

You might be wondering what happens if you use Auto. Leave a role's `model:` line out and its agent runs on the parent session model, which is how Auto users stay on Auto. For a panel role, the number of role agents sets the panel size: one subagent per agent ID. Setup also sets `pstack/swarm-worker`, the model for every `/pstack/swarm` worker.

## Accept the verification offers, or don't

At the end of setup, `/pstack/setup-pstack` looks for a way to prove app behavior in your project, either a `verify-*` skill or an existing harness. If it finds neither, it offers once to generate one with [`/pstack/create-verification-skill`](../../skills/pstack/create-verification-skill/SKILL.md).

Say yes and it writes `.opencode/skills/verify-<app>/`, a project-local skill that teaches agents to drive your app the way a user does. It proves the skill works once before handing it over. Say no and setup moves on. You can run `/pstack/create-verification-skill` yourself any time. [Verify and ship](./06-verify-and-ship.md#create-a-project-verification-skill) covers it in depth.

If you're new to pstack, say yes. An agent that can check its own work keeps going until the check passes. An agent that can't hands every result back to you to check by hand. Of everything in this guide, the verification skill pays off the most.

Then setup offers once to generate a formal verification skill with [`/pstack/create-formal-verification-skill`](../../skills/pstack/create-formal-verification-skill/SKILL.md), unless the project already has one. Tests check the cases someone thought to write. A formal verification skill checks one key property of your code, such as "a job never runs twice at once", in every case within a stated scope. Say yes when your code has concurrency, retries, a state machine, or a parser, where a bug is costly and tests rarely reach the case that breaks. Otherwise say no, and run it later if that changes. [Verify and ship](./06-verify-and-ship.md#prove-a-property-with-a-formal-verification-skill) covers it.

After setup, start a new session so the agent files reload.

## Keep the cost in check

pstack spends extra tokens on subagents and review panels. That's the price of the rigor. To spend fewer:

- Rerun `/pstack/setup-pstack` and pick a smaller reasoning budget or cheaper models. A strong model in the main session with cheaper, faster models in the code roles is a good split.
- Delete a role's `model:` line so it runs on the session's own model.
- Ask for fewer seats. A panel spawns one subagent per role agent, and the role table sets how many there are.
- Save `/pstack/poteto-mode` for work that needs rigor. A small, obvious edit doesn't.

## Run your first task

Pick something real but small, and describe it the way you'd describe it to a colleague:

```text
/pstack/poteto-mode add a --json flag to this command. text output stays byte-identical. verify both.
```

Watch the plan at the top of the reply. Its first items are the matched playbook's steps copied in, the Feature playbook for this prompt. If `/pstack/poteto-mode` skips a step, the step stays in the plan with `skip: <reason>`, so you can see what it chose not to do.

From here you can type normal follow-ups. Plain Enter attaches `/pstack/poteto-mode` to one message, and the skill fades as the session moves on. To keep the routing on every turn, keep the session on one task and type the command again when a new step needs it.

Next: [Route work through `/pstack/poteto-mode`](./02-poteto-mode.md).
