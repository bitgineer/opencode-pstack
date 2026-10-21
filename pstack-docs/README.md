# pstack

pstack is poteto's engineering style for agents: rigorous playbooks, principles that decide
tradeoffs, and verification against the real artifact. This copy runs on OpenCode v2.

Start here:

1. `/pstack/setup-pstack` picks a model for each role.
2. `/pstack/poteto-mode` starts any task that needs rigor.
3. `/pstack/poteto-help` answers which skill fits a request.

The [guide](./guide/README.md) walks a first real task, from setup and prompting through
verification and overnight runs. [opencode.md](./harness/opencode.md) is the adapter: every
Cursor name pstack uses, and what it maps to here.

## What is installed

| Piece | Where |
| --- | --- |
| Skills | `skills/pstack/<name>/SKILL.md` |
| Agents | `agents/pstack/<role>.md` |
| Commands | `commands/pstack/<name>.md` |
| This documentation | `pstack-docs/` |

A skill's ID is its directory name, so `skills/pstack/unslop/` loads as `unslop`: through the
`skill` tool, or an `@unslop` mention. An agent's ID is its path under `agents/`, so
`agents/pstack/code.md` is `pstack/code`. A command is `/pstack/<name>`.

## Models

Each role pstack spawns is an agent file. Its `model:` line is the role's model, and an agent
with no `model:` inherits the parent session. `/pstack/setup-pstack` writes those lines from the
models `opencode models` reports. The role-to-agent table is
`../skills/pstack/setup-pstack/references/roles.md`.

## License

MIT, by Lauren Tan. Ported from `cursor/plugins/pstack`.
