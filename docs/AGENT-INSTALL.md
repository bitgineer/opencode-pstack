# Install and verify this port (agent runbook)

This page is written for a coding agent that has just cloned the repository and been asked to
install pstack for OpenCode v2, prove the install, and report back. It assumes no prior knowledge
of the repository. Follow the steps in order, compare each command's output to the line quoted
for it, and stop at the first mismatch. The failure table at the end says what to do; do not
improvise a different layout, and do not hand-edit installed files.

## Success criterion

The task is done when **both** of these commands exit 0 and their output is pasted in the report:

```bash
node scripts/verify-port.mjs            # + the destination flag from step 3
node scripts/install.mjs --check        # + the same destination flag
```

Their final lines must be exactly:

```
10 checks passed, 0 failed
```

```
check: install matches the port
```

Installer output is not verification. A file listing is not verification. A run from an earlier
session is not verification. If you cannot produce those two lines, report the install as failed
and say where it stopped.

## 1. Preconditions

```bash
node --version
```

Expected: `v20` or newer (checked against `v24.13.0`). The scripts import only Node core modules;
there is nothing to `npm install`.

Next, find an **OpenCode v2** binary. Set a shell variable so every later command uses the same
one:

```bash
OC=opencode                          # if `opencode` on PATH is already v2
OC=/path/to/opencode                 # otherwise, absolute path to a v2 binary
"$OC" --version
```

Expected: a line beginning `opencode v2.` — for example `opencode v2.1.1`.

**This check is not optional.** A v1 install commonly sits earlier on `PATH` and shadows v2. A v1
binary prints a bare version such as `1.15.10`, with no `opencode v` prefix, and it does not read
the namespaced `skills/pstack/`, `agents/pstack/`, `commands/pstack/` layout this port installs.
If you see a bare version, do not install: locate a v2 binary, re-run `--version` on it, and record
in the report which path you used and that PATH was shadowed.

Notes:

- **Global destination on Windows** is `%USERPROFILE%\.config\opencode`, not `%APPDATA%`. The
  installer builds it from the home directory on every platform.
- **git-bash / MSYS on Windows:** a native OpenCode binary can reject an MSYS working directory.
  If a subcommand fails with a path or cwd error, re-run it from the directory with a
  Windows-style `PWD`:

  ```bash
  cd <repo>
  env PWD='<repo>' "$OC" debug agents
  ```

- Paths in this page: `<repo>` is the clone root, `<config>` is the OpenCode config directory the
  install targets, `~/` is your home directory.

## 2. Get the tree

```bash
git clone https://github.com/bitgineer/opencode-pstack opencode-pstack
cd opencode-pstack
ls scripts/install.mjs scripts/verify-port.mjs
```

Expected: both paths printed, exit 0.

The installable tree is at the repo root: `skills/pstack/<name>/SKILL.md`,
`agents/pstack/<role>.md`, `commands/pstack/<name>.md`, and `pstack-docs/`. `bin-v2/` and
`cursor-plugins/` are gitignored working directories; a fresh clone will not have them and
nothing below needs them.

The scripts resolve the repo root from their own location, so they work from any working
directory. Only `--project` depends on where you are: it targets `./.opencode` in the **current**
directory.

## 3. Choose the destination (decision point)

| Situation | Install flag | Destination |
| --- | --- | --- |
| pstack should be available in every project on the machine | none | `~/.config/opencode` |
| The user named a repository to configure | `--project` | `./.opencode` under the current directory |
| The user named a config directory | `--dest <dir>` | that directory |

Use `--project` whenever the user points at a repo: a global install changes every project on the
machine, which is a bigger change than they asked for.

The two scripts do not take the same flags. Pass the destination accordingly:

| Script | Flags it accepts |
| --- | --- |
| `scripts/install.mjs` | `--project`, `--dest <dir>`, `--dry-run`, `--check` |
| `scripts/verify-port.mjs` | `--dest <dir>` only |

`verify-port.mjs` has **no** `--project` flag; an unknown flag is ignored and it falls back to the
global destination. For a project install, give it `--dest .opencode` explicitly. This is the most
common way to get a green gate that inspected the wrong directory.

**If the destination already contains `skills/pstack`**, check before installing:

```bash
node scripts/install.mjs --check          # add --project or --dest <dir> to match step 3
```

- `check: install matches the port` (exit 0): already current. Continue to step 7 to confirm with
  the gates; you do not need to rewrite anything, but re-running the installer is harmless.
- `check: out of date <path>` (exit 1): install with step 5.

Both are safe. The installer replaces its four folders whole, so it cannot leave a stale skill
behind and cannot half-merge.

## 4. Read the plan before writing

```bash
node scripts/install.mjs --dry-run        # add --project or --dest <dir>
```

Expected, six lines and exit 0 (`<config>` stands for the resolved destination):

```
pstack -> <config>
  skills    56 entries -> <config>/skills/pstack
  agents    23 entries -> <config>/agents/pstack
  commands  56 entries -> <config>/commands/pstack
  docs      3 entries -> <config>/pstack-docs
dry run: nothing written
```

If the counts are not 56 / 23 / 56 / 3, the checkout is incomplete or mid-rewrite. Stop, report
the counts, and re-clone. Do not install a partial tree.

## 5. Install

```bash
node scripts/install.mjs                  # global
node scripts/install.mjs --project        # project
node scripts/install.mjs --dest <dir>     # explicit
```

Expected: the six plan lines above, then this tail, exit 0:

```
installed
  skills   56
  agents   23
  commands 56
restart the OpenCode server if it was already running: opencode service restart
```

The installer writes only `skills/pstack`, `agents/pstack`, `commands/pstack`, and `pstack-docs`.
It removes nothing outside those, except flat `pstack-<name>` skill and agent directories that
older revisions of this port installed and that this port owns by name.

## 6. Restart the server only if it was running

```bash
"$OC" service status
```

A line like `http://127.0.0.1:<port>` with exit 0 means a background server is up:

```bash
"$OC" service restart
```

Expected: exit 0. If no server was running, skip this; the next start reads the new files. Do not
start a server you do not need.

## 7. Gate A — static verification (blocking)

Run the one that matches your install from step 5, then echo the status:

```bash
node scripts/verify-port.mjs                    # global install
node scripts/verify-port.mjs --dest .opencode   # project install
node scripts/verify-port.mjs --dest <dir>       # explicit
echo "exit=$?"
```

Expected: ten `ok` lines, a blank line, `10 checks passed, 0 failed`, then `exit=0`. The counts
and the destination on the `install` line are the parts that matter:

```
ok   skill: 56 skills have frontmatter, matching IDs, descriptions
ok   discovery: only poteto-mode hides; 55 skills are advertised
ok   description: all descriptions <= 300 chars; <N> chars advertised
ok   command: 56 commands each load their skill
ok   roles: 21 role agents mapped
ok   agent: 23 subagent-mode agents with descriptions
ok   cursor-name: no Cursor-era names or stale prefixes in skills or docs
ok   link: every relative markdown link resolves
ok   install: 56 skills, 23 agents, 56 commands under <config>
ok   collision: no other skill claims a pstack skill ID

10 checks passed, 0 failed
```

Read the `install` line, not just the total. **`9 checks passed, 0 failed` means the gate never
saw an install** at the destination it checked: it prints
`ok   install: no install at <path> (skipped)` and cannot run the collision check, which only
exists when the install is present. Nine is a failure for this task even though the exit code is
0. Fix the destination flag, or install if you have not, then re-run.

`<N> chars advertised` tracks the skill text; treat it as informational.

## 8. Gate B — the install matches the tree, byte for byte (blocking)

```bash
node scripts/install.mjs --check                 # add --project or --dest <dir> to match step 5
echo "exit=$?"
```

Expected: the six plan lines, then `check: install matches the port`, then `exit=0`.

`--check` prints the plan header before its verdict, so the last line is the one to compare. It
hashes file contents, not just names: a stale install or a hand-edited file prints
`check: out of date <path>` and exits 1, one line per stale top-level folder.

This gate is what makes Gate A meaningful. Gate A can pass with no install present; Gate B cannot.

## 9. Live smoke checks

These prove the runtime, not the files. Run them after both gates. S1 and S3 need no model
credentials; S2 calls a model. If the machine has no model configured, mark S2 skipped and say
so — the two gates, S1, and S3 stay mandatory, and a skipped smoke check is acceptable only when
the report says it was skipped and why.

**S1 — the agents are namespaced subagents.**

```bash
"$OC" debug agents | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const a=JSON.parse(s);const p=a.filter(x=>x.id.startsWith('pstack/'));console.log('total '+a.length);console.log('pstack '+p.length);console.log('modes '+[...new Set(p.map(x=>x.mode))].join(','));})"
```

Expected:

```
pstack 23
modes subagent
```

`total` varies with the built-in agents; ignore it. `pstack 0`, or a mode other than `subagent`,
means the server was not restarted or the config directory is not the one you installed into.

**S2 — a skill loads by its bare ID.**

```bash
MODEL=$("$OC" models | head -1)
"$OC" run --standalone --model "$MODEL" "Call the skill tool with id 'unslop'. Reply with the first rule line only."
```

Expected: a line containing `→ Skill "unslop"`, followed by that skill's first rule,
`Edit text to remove AI patterns.` Any listed model works — `models` prints one
`<provider>/<model>` per line — because the skill, not the model, is under test.

**S3 — `/pstack/<name>` expands on the command path.**

```bash
"$OC" session list                                  # first field of the first row is the id
"$OC" api POST /api/session/<session-id>/command \
  --data '{"name":"pstack/bro","text":"the installer replaces only the pstack folders"}'
echo "exit=$?"
```

Expected: **no output**, then `exit=0`. The endpoint answers HTTP `204 No Content` and the CLI
prints nothing on success, so a blank line here is the pass, not a hang. A failure prints an error
and exits non-zero.

Confirm the expansion by reading the session back:

```bash
"$OC" session export <session-id>
```

Expected: a `"messages"` entry whose `"text"` begins

```
Use the skill tool to load `bro`, then follow that skill for this request.
```

followed by the text you sent — not the raw `/pstack/bro` string. The command endpoint only
queues the user message (cost and tokens stay 0); no model is called, so this check needs no
credentials.

**Known gotcha, do not fight it.** `/pstack/<name>` expands in the TUI and through
`POST /api/session/<id>/command`. It does **not** expand in `"$OC" run "/pstack/bro ..."`: `run`
submits the message as literal text by design, so the model sees the slash string and has to go
find the file. A `run` call that failed to expand is not a defect and is not evidence that the
command is missing. Check the command registry instead if you need a cheap read-only signal:

```bash
"$OC" api GET /api/command | grep -o '"pstack/' | wc -l
```

Expected: `56`. The response arrives on one line, so count occurrences with `grep -o`, not lines
with `grep -c`; `grep -c` prints `1` and means nothing here.

## 10. Decision points

| Question | Answer |
| --- | --- |
| Global or project? | Project if the user named a repo; global if they asked for the machine. Never both for one target. |
| Destination already has pstack files? | Run `--check` first. Exit 0 means current, exit 1 means install. |
| Is a server already running? | `service status`. Restart it after installing, or the new agents may not register. |
| `--dry-run` counts are not 56 / 23 / 56 / 3? | Stop. Incomplete checkout, not an install problem. |
| Gate A says `9 checks passed`? | It checked a destination with no install. Pass the same destination flag you installed with. |
| Gates pass but S1 shows `pstack 0`? | Wrong config directory, or no restart. Fix the flag, restart, re-run. |
| No model available? | Mark S2 skipped with the reason; S1 and S3 still run. Never invent output. |

## 11. Failure handling

| Step | Symptom | Action |
| --- | --- | --- |
| 1 | `--version` prints a bare `1.x` | Wrong binary, likely a v1 install shadowing v2 on PATH. Find a v2 binary, set `$OC`, re-check. Do not install with v1. |
| 1 | OpenCode rejects the cwd on Windows | Re-run from the directory with `env PWD='<repo>' "$OC" <args>`. |
| 4 | Counts other than 56 / 23 / 56 / 3 | Incomplete checkout. Re-clone; do not install. |
| 5 | `node: command not found`, or `ERR_MODULE_NOT_FOUND` | Node missing, or you ran a script path that does not exist. Confirm with `node --version` and `ls scripts/`. |
| 5 | Permission denied writing the destination | Use `--project`, or a `--dest` the user owns. Never `sudo`. |
| 7 | `FAIL skill` / `FAIL command` / `FAIL agent` / `FAIL roles` | The port content is inconsistent with itself. Do not hand-edit the installed copy. Capture the FAIL lines and report; a re-clone fixes a truncated checkout. |
| 7 | `FAIL install: missing skills=… agents=… commands=…` | The gate checked a different destination than step 5 wrote. Re-run with the same `--project` or `--dest`. |
| 7 | `FAIL collision: another skill at <path> uses ID <name>` | Another skill outside `skills/pstack` claims a pstack ID. Report the path. Do not delete the other skill; that is the user's call. |
| 7 | `9 checks passed, 0 failed` | No install at the checked destination. Same fix as the mismatch row. |
| 8 | `check: out of date <path>` right after installing | Destination mismatch, or a process rewrote the files. Confirm the flag, reinstall, re-check. |
| 9 S1 | `pstack 0` | Server not restarted, or global-vs-project mismatch. Restart, re-check. |
| 9 S2 | model or provider error | Run `"$OC" models`, pick a listed `<provider>/<model>`. No credentials: report and skip. Do not retry blindly. |
| 9 S3 | `run` did not expand `/pstack/bro` | Expected behaviour. Use the TUI or the command endpoint. Not a defect. |
| 9 S3 | `404` from the command endpoint | The session id is stale, or the server predates the install. Take a fresh id from `session list`; restart the server if needed. |

## 12. Rules

- **Never claim success without pasting the two gate outputs.** Installer output, a directory
  listing, or a green run from an earlier session is not evidence.
- Never edit files under the installed `skills/pstack`, `agents/pstack`, `commands/pstack`, or
  `pstack-docs` by hand. The installer replaces those folders whole, so the edit is lost on the
  next run and Gate B fails in the meantime.
- To update, `git pull` in the clone, re-run the installer, then both gates. That is the entire
  update path; there is no separate upgrade command.
- Do not copy skills into `skills/` outside `skills/pstack`. The collision check owns that
  namespace, and a second skill with a pstack ID is a hard failure.
- Do not add `disable-model-invocation` to any skill except `poteto-mode`. Gate A fails when
  another skill hides itself, because the model can then no longer choose it.
- Do not report a smoke check as passed from install output or from a prior run. Paste what the
  command printed, or report it skipped with the reason.
- Do not print or commit credentials, model keys, or a full OpenCode config file if it contains
  them. Refer to models as `<provider>/<model>`.

## 13. Report template

Fill this in and return it. Every placeholder is a command's real output, not a paraphrase.

```
pstack OpenCode v2 install

- Source: <repo path> @ <commit>
- OpenCode: <"$OC" --version output> at <path used> (PATH shadowed by v1: <yes/no>)
- Node: <node --version>
- Destination: <path> (<global | --project | --dest>)
- Dry run: skills 56, agents 23, commands 56, docs 3 | mismatch: <none | detail>
- Pre-check: <check: install matches the port | check: out of date | not run>
- Server: <restarted | was not running | not checked>

Gate A: node scripts/verify-port.mjs <flags>
<full output, all ten ok lines>
exit=0

Gate B: node scripts/install.mjs --check <flags>
<full output, plan header included>
exit=0

Smoke:
- S1 agents: pstack 23, modes subagent | <actual>
- S2 skill unslop: <the → Skill "unslop" line and the reply> | skipped: <reason>
- S3 /pstack/bro via command API: <no output, exit=0; export shows the template> | skipped: <reason>

Skipped: <steps and why, or none>
Unresolved: <anything that failed, what you tried, or none>
```

If any field is a failure, lead the report with it. A partial install with an honest failure
report is a better result than a claimed success.
