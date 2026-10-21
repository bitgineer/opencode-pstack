---
name: swarm
description: "Fan out N parallel workers, drain them, and return one report. Use for /pstack/swarm, 'swarm this', or parallel coverage, races, gauntlets, and exploration."

---

# Swarm

## Start

Open the plan at the top of your reply and update it as each step lands. v2 has no todo tool.

1. Frame
2. Fan out
3. Aggregate
4. Report

## Phase A: Frame

1. State the done predicate and the artifact or report the swarm must return.
2. Choose the shape. Partition into slices, race N workers on identical briefs, or mix both. For a race or mixed shape, declare `first pass`, `rank all`, or `best-of` before spawning.
4. Pick the workers. Spawn the agents for the `swarm workers` role, one subagent per agent ID, from `references/roles.md` in the `setup-pstack` skill. One default worker agent. Do not pass a model. Each role agent carries its own; the operator sets them with `/pstack/setup-pstack`. For a race, that same worker agent runs every arm, so name each arm's scope up front.
5. Give each worker its own writable output when it writes. When workers verify or measure commits, each brief names the exact SHAs. A measurement brief also names the method (sample count, what one sample is, order). The worker records both in its result.

## Phase B: Fan out

Spawn all N workers in one message on the `swarm workers` role agent, with `background: true` and `worktree_create` for each worker that writes. Run a worker in the working tree directly only when it needs access to something on the user's computer.

When a worker must start from a non-default pushed branch, tell it to check out that branch before it starts.

Every brief stands alone. Include the goal, scope, exact slice or race arm, how to verify, and what to report. Reports use `PASS`, `ISSUES`, or `BLOCKED` with evidence. A worker that can prove a defect reports `ISSUES` and lists every issue it can prove, not only the first.

If a worker drops out, proceed with N-1 and note it.

## Phase C: Aggregate

Read the terminal results. Drop a result that does not record the SHAs and method its brief names, and respawn that worker once. After a second miss, record a gap. A gap does not count as a pass. For coverage, every required slice needs a result. For a race, apply the selection rule declared up front. Use first pass, rank all, or best-of. Do not paste raw worker dumps.

## Phase D: Report

Return one consolidated in-chat report with the table, issue one-liners, gaps or dropouts, and the race rule when used.
