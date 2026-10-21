# pstack roles in OpenCode v2

pstack names a role for each subagent it spawns. In OpenCode a subagent takes an agent ID and
no model, so each role is one agent per seat. Spawn the agents below for the role a skill names.
A panel role gets one subagent per agent ID, so its seat count is the fan-out.

Models live on the agents. `model:` in `~/.config/opencode/agents/pstack/<role>.md` is the only
place a role's model is set, and `/pstack/setup-pstack` is the way to set it. An agent with no
`model:` inherits the parent session model.

| Role line | Agent IDs | Read-only |
| --- | --- | --- |
| `feature, refactoring` | `pstack/code` | no |
| `bug-fix` | `pstack/bugfix` | no |
| `perf-issue` | `pstack/perf` | no |
| `hillclimb` | `pstack/hillclimb` | no |
| `judgment and prose` | `pstack/judgment` | no |
| `hardest tasks` | `pstack/hardest` | no |
| `how explorer` | `pstack/how-explorer` | yes |
| `how explainer` | `pstack/how-explainer` | no |
| `why investigators` | `pstack/why-investigator` | yes |
| `why synthesizer` | `pstack/why-synthesizer` | no |
| `reflect tooling` | `pstack/reflect-tooling` | yes |
| `reflect judgment, divergent, synthesizer` | `pstack/reflect-judgment` | yes |
| `arena runners` | `pstack/arena-1`, `pstack/arena-2` | no |
| `arena cross-judge pool` | `pstack/cross-judge-1`, `pstack/cross-judge-2` | yes |
| `swarm workers` | `pstack/swarm-worker` | no |
| `architect runners` | `pstack/architect-1`, `pstack/architect-2` | no |
| `interrogate reviewers` | `pstack/interrogate-1`, `pstack/interrogate-2` | yes |

## Defaults

Until `/pstack/setup-pstack` runs, every role agent inherits the parent model. That keeps the
port working with no configuration. Configure roles when you want pstack's split of fast code
work against slower judgment work.

Seat agents exist so panels stay separate: arena and architect seats build candidates,
interrogate and cross-judge seats review them.
