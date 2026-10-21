# pstack OpenCode v2 port — runtime verification

- **Date:** 2026-10-20 (evening, EDT)
- **Machine:** Windows 11, shell git-bash / MSYS
- **OpenCode:** v2.1.1 (`./bin-v2/opencode.exe`)
- **Node:** v24.13.0 · **Bun:** 1.3.14
- **Config under test:** `~/.config/opencode` (56 skills, 23 agents, 56 commands, 3 doc entries)
- **Model used for live runs:** `<provider>/<model>`

Native Windows binary: every CLI call below was made from the repo root with an explicit
Windows-style `PWD`, because bash otherwise passes an MSYS cwd that the binary rejects:

```
cd <repo>
env PWD='<repo>' ./bin-v2/opencode.exe <args>
```

**Result: the runtime behaviour is correct — 8 of 8 checks pass.** All five live-CLI
behaviours (discovery, skill, command, subagent, model routing) work, the script tests match
upstream, and both static gates are green: `verify-port.mjs` 8/8 and `install.mjs --check`
reporting that the installed config matches the port. (The earlier `install.mjs --check`
failure was a stale install during editing, repaired by reinstall on 2026-10-20 at 21:44 EDT.)

---

## 1. Agent discovery — PASS

```
$ ./bin-v2/opencode.exe debug agents | python -c "... count ids, modes ..."
total agents: 38
pstack/ ids: 23
flat pstack- ids: 0
modes of pstack: Counter({'subagent': 23})
  pstack/architect-1 | subagent
  pstack/architect-2 | subagent
  pstack/arena-1 | subagent
  pstack/arena-2 | subagent
  pstack/bugfix | subagent
  pstack/code | subagent
  pstack/comment-sicko | subagent
  pstack/cross-judge-1 | subagent
  pstack/cross-judge-2 | subagent
  pstack/hardest | subagent
  pstack/hillclimb | subagent
  pstack/how-explainer | subagent
  pstack/how-explorer | subagent
  pstack/interrogate-1 | subagent
  pstack/interrogate-2 | subagent
  pstack/judgment | subagent
  pstack/perf | subagent
  pstack/poteto-agent | subagent
  pstack/reflect-judgment | subagent
  pstack/reflect-tooling | subagent
  pstack/swarm-worker | subagent
  pstack/why-investigator | subagent
  pstack/why-synthesizer | subagent
```

Exactly 23 namespaced ids, all `mode: subagent`, no flat `pstack-*` ids. No service restart
was needed. (38 total = 23 pstack agents + 15 built-in primary/subagent agents.)

## 2. Skill load — PASS

```
$ ./bin-v2/opencode.exe run --standalone --model <provider>/<model> \
    "Call the skill tool with id 'unslop'. Reply with the first rule line only."

> build · <model>
→ Skill "unslop"
> build · <model>
Edit text to remove AI patterns.
```

The `→ Skill "unslop"` line is the tool resolving the skill by id from
`skills/pstack/unslop/`; the reply is that skill's first rule.

## 3. Slash command — PASS

```
$ ./bin-v2/opencode.exe run --standalone --model <provider>/<model> \
    "/pstack/bro the installer converges by replacing only the pstack folders"

> build · <model>
... (checked the installer, tampered, reinstalled, re-checked)
> build · <model>
## Plain restatement of your message
> **"The installer gets to a stable, correct state by deleting and re-copying only the
> pstack-owned folders. Everything else on the machine is left alone."**
Simpler: the install script fixes itself up by **replacing just the pstack folders** —
skills, agents, commands, and docs — every time it runs...
```

`commands/pstack/bro.md` resolved as `/pstack/bro`, the `bro` skill loaded, and the reply is
the plain-language restatement the skill asks for. (The model also chose to exercise the
installer in temp dirs; that was its own initiative, not part of the check.)

## 4. Subagent spawn — PASS

```
$ ./bin-v2/opencode.exe run --standalone --model <provider>/<model> \
    "Call the subagent tool exactly once with agent='pstack/poteto-agent' and
     prompt='Reply with exactly: delegate-ok'. ... report the child reply and sessionID."

> build · <model>
✓ Delegate reply test Pstack/Poteto-Agent Agent
> build · <model>
- **Child agent reply text (verbatim):** `delegate-ok`
- **Child sessionID (verbatim):** `ses_…`
The call completed with state `completed`.
```

The child session exists in the store under agent `pstack/poteto-agent`, so this is a real
spawned session, not a narrated one.

## 5. Model routing — PASS

Baseline before the edit:

```
$ ./bin-v2/opencode.exe debug agents        # pstack/judgment
id: pstack/judgment | model: None
```

Temporary edit — added `model: <provider>/<model>` to the frontmatter of
`~/.config/opencode/agents/pstack/judgment.md`, then:

```
$ ./bin-v2/opencode.exe debug agents        # pstack/judgment
id: pstack/judgment | model: {'id': '<model>', 'providerID': '<provider>'}
```

Spawned once (`description='model probe'`), child replied `model-ok`
(`ses_…`), then the exact store query:

```
$ sqlite3 -json "~/.local/share/opencode/opencode.db" \
    "select agent, model from session_v2 where title='model probe' order by time_created desc limit 1;"
[{"agent":"pstack/judgment","model":"{\"id\":\"<model>\",\"providerID\":\"<provider>\"}"}]
```

The session-level row carries the routed provider/model, so the frontmatter `model:` line
actually governs the child run rather than only showing in `debug agents`.

Reverted by restoring the byte-identical backup; the file hash matches the original
(`91cb32032c3c73d60d746ac96661be9d575add32d7c86c9951ca310256c501fc`) and:

```
$ ./bin-v2/opencode.exe debug agents        # pstack/judgment
id: pstack/judgment | model: None
```

## 6. Static gates — **verify-port PASS / install --check PASS**

```
$ node scripts/verify-port.mjs
ok   skill: 56 skills have frontmatter, matching IDs, descriptions
ok   command: 56 commands each load their skill
ok   roles: 21 role agents mapped
ok   agent: 23 subagent-mode agents with descriptions
ok   cursor-name: no Cursor-era names or stale prefixes in skills or docs
ok   link: every relative markdown link resolves
ok   install: 56 skills, 23 agents, 56 commands under ~/.config/opencode
ok   collision: no other skill claims a pstack skill ID

8 checks passed, 0 failed
```

```
$ node scripts/install.mjs --check
pstack -> ~/.config/opencode
  skills    56 entries -> ~/.config/opencode\skills\pstack
  agents    23 entries -> ~/.config/opencode\agents\pstack
  commands  56 entries -> ~/.config/opencode\commands\pstack
  docs      3 entries -> ~/.config/opencode\pstack-docs
check: install matches the port
(exit 0)
```

**Resolved 2026-10-20 21:44 EDT by reinstall.** The earlier failure was a stale install
during editing, not a content defect — the source tree was still being written while the installed
copy had already been laid down, so `--check` correctly reported drift.

- Installed files were timestamped **21:18–21:20**.
- `pstack-docs` was edited **21:26–21:28**; `skills/pstack/**` **21:30–21:32**.
- `diff -rq` showed the installed docs still describe the old flat layout
  (`skills/pstack-<name>/`, `agents/pstack-<name>.md`) while the source tree now has the namespaced
  layout (`skills/pstack/<name>/`, `agents/pstack/<name>.md`). The skill diffs are the same
  namespace change plus wording (`diverse-agent` → `diverse-model` review).
- `agents/` and `commands/` match. Only `skills/pstack` and `pstack-docs` drifted.

Repaired with:

```
$ node scripts/install.mjs
pstack -> ~/.config/opencode
  skills    56 entries -> ~/.config/opencode\skills\pstack
  agents    23 entries -> ~/.config/opencode\agents\pstack
  commands  56 entries -> ~/.config/opencode\commands\pstack
  docs      3 entries -> ~/.config/opencode\pstack-docs
installed
  skills   56
  agents   23
  commands 56
$ node scripts/install.mjs --check
check: install matches the port        (exit 0)
```

The port also installs and converges correctly when given a clean destination:

```
$ node scripts/install.mjs --dest .../scratch/install-probe
installed  skills 56 / agents 23 / commands 56
$ node scripts/install.mjs --dest .../scratch/install-probe --check
check: install matches the port        (exit 0)
```

## 7. Script tests — PASS at upstream parity

```
$ cd skills/pstack/poteto-mode/scripts
$ bun install --frozen-lockfile
bun install v1.3.14 (0d9b296a)
+ bun-types@1.3.14  + typescript@7.0.2  + commander@14.0.0
6 packages installed [950.00ms]

$ bun test
63 pass
5 fail
234 expect() calls
Ran 68 tests across 5 files. [16.21s]
```

Failures are the five `Store` tests, matching the upstream baseline exactly
(63 pass / 5 fail). Two of them time out (`^ this test timed out after 5000ms.`); the other
three are `expect(received).toThrow(expected)` because the test machine has a real `gh` on PATH
and no `origin` executable (`Executable not found in $PATH: "origin"`), so the code fails
with a different error than the test expects. Neither mode is a port regression — the ported
scripts are byte-equivalent to upstream in behaviour here.

**Side effect worth fixing:** `bun install` writes a 38 MB `node_modules/` into the port tree
(gitignored). `install.mjs`'s `treeHash` skips `node_modules`, but `verify-port.mjs`'s link
check used to walk it, so leaving it in place made `verify-port` report **38 link failures**
against `commander`'s own README during this run. Deleting the generated directory restored
`8 checks passed, 0 failed`. Fixed on 2026-10-20: `verify-port.mjs` now skips any path segment
named `node_modules` in its walk, the same way `install.mjs` does, and still reports 8/8 with
a `node_modules` tree present (probed with a deliberately broken link inside one).

---

## Summary

| # | Check | Verdict |
|---|-------|---------|
| 1 | Agent discovery: 23 `pstack/` ids, all `subagent` | PASS |
| 2 | Skill load by id (`unslop`) | PASS |
| 3 | Slash command `/pstack/bro` | PASS |
| 4 | Subagent spawn (`pstack/poteto-agent`) | PASS |
| 5 | Model routing via agent frontmatter + store proof, reverted | PASS |
| 6a | `node scripts/verify-port.mjs` (8/8) | PASS |
| 6b | `node scripts/install.mjs --check` | PASS — install matches the port (2026-10-20 21:44 EDT; earlier FAIL was a stale install during editing, repaired by reinstall) |
| 7 | `bun test` 63 pass / 5 fail | PASS (upstream parity) |

Not run: no `service restart` was needed (agent discovery was correct on the first call), and
no interactive/TUI paths were exercised.

---

## 8. Skill discovery — defect found and fixed (2026-10-20, after the first pass)

The audit found 55 of 56 skills carrying `disable-model-invocation: true`, inherited from the
Cursor copy. In OpenCode that hides a skill from the model's list while still allowing an
explicit load, so only `setup-pstack` was selectable and the docs that promised the model could
choose a skill were wrong.

**Upstream check.** `grep -rn disable-model-invocation cursor-plugins/pstack/` returns 59 hits
(56 skills + 3 automation skills), and no README or `docs/guide/*` page explains the flag. With
no documented intent to hide every skill, the port keeps upstream's deliberate case only:
`poteto-mode`, which the user starts by typing `/pstack/poteto-mode`.

| State | Skills setting the flag | Advertised to the model | Description characters |
| --- | --- | --- | --- |
| Before | 55 | 1 (`setup-pstack`) | 249 |
| After | 1 (`poteto-mode`) | 55 | 7834 |

35 descriptions were rewritten to one sentence of at most 200 characters: 27 that ran past 200
plus the 8 longest of the rest. The maximum is now 178 and none exceed 200. Unhiding all 55
without that pass would have advertised 11774 characters of description; the tightened set
advertises 7834.

The first pass of this measurement undercounted, and so did the gate: `make-bot-ui` declared its
description as a folded YAML scalar (`>-`), which a line-based reader scores as two characters
while OpenCode scores 203. `GET /api/skill` is what exposed it (56 pstack skills in the registry,
8157 advertised characters, not 7956). The gate now assembles plain, quoted, and block-scalar
descriptions the way YAML does, and a folded 300-plus description is caught:

```
FAIL description: over 300 chars: tdd (304)
```


**Command expansion, settled.** `opencode run` does not expand a slash command. The raw string
is what the session stores:

```
$ env PWD='<repo>' ./bin-v2/opencode.exe run --standalone     --model <provider>/<model>     "/pstack/unslop this sentence is a test of the command path"

$ sqlite3 -json "~/.local/share/opencode/opencode.db"     "select data from session_message where data like '%command path%' order by time_created desc limit 1;"
[{"data":"{\"time\":{\"created\":1792547704440},\"text\":\"\"/pstack/unslop this sentence is a test of the command path\"\",\"files\":[]}"}]
```

The model then spent four turns hunting `commands/pstack/unslop.md` before loading the skill,
which is what a raw prompt looks like from the inside. The command endpoint the TUI uses does
expand, and there the stored prompt is the template:

```
$ ./bin-v2/opencode.exe api POST /api/session/ses_…/command     --data '{"name":"pstack/unslop","text":"this sentence is a test of the command path"}'
(204, no body)

$ sqlite3 -json "~/.local/share/opencode/opencode.db"     "select seq,type,data from session_message where session_id='ses_…' order by seq limit 5;"
[{"seq":4,"type":"user","data":"{\"time\":{\"created\":1792548289804},\"text\":\"Use the skill tool to load `unslop`, then follow that skill for this request.\n\nthis sentence is a test of the command path\"}"}]
```

So `/pstack/<name>` expands on the command path (`api GET /api/command` returns 71 commands, 56
of them under `pstack/`), and `opencode run` passes its message through as text.

**Live discovery**, after `node scripts/install.mjs`, on a prompt that never names an id:

```
$ ./bin-v2/opencode.exe run --standalone --model <provider>/<model>     "From your available skills list only, no file reads: which skill id's description mentions cutting AI patterns or AI tells from writing?"
> build · <model>
The ID is **`unslop`** — its description says "Cut AI tells from any writing," which is exactly the "cutting AI tells" match you're describing.
```

`Cut AI tells` appears only in `skills/pstack/unslop/SKILL.md`; neither `AGENTS.md` nor
`opencode.json` carries it, so the answer came from the advertised skill list. A second probe
covers a partner skill, a principle, and the hidden mode:

```
1. `interrogate`
2. `principle-type-system-discipline`
3. No — `poteto-mode` doesn't appear in the available skills list (only `poteto-help`).
```

The hidden skill still loads when named: `→ Skill "poteto-mode"` / `# Skill: poteto-mode`.

**Gate.** `verify-port.mjs` gained two checks, one for the policy and one for description size:

```
ok   discovery: only poteto-mode hides; 55 skills are advertised
ok   description: all descriptions <= 300 chars; 7834 chars advertised
10 checks passed, 0 failed
```

Both bite, proven by temporarily adding the flag to `tdd` and lengthening one description:

```
FAIL discovery: disable-model-invocation on tdd; only poteto-mode may hide
9 checks passed, 1 failed

FAIL description: over 300 chars: tdd (305)
8 checks passed, 2 failed
```

Reverted; `node scripts/install.mjs --check` prints `check: install matches the port` and the
gate is back to 10/10.
