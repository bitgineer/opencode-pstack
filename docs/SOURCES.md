# Sources

Every source this port relies on, what it settled, and where it lives. Upstream code was read
from a local clone; docs were read at the URLs below. Anything that could not be opened is listed
as unverified at the end rather than guessed at.

## Upstream pstack

| Source | Where | Used for |
| --- | --- | --- |
| pstack plugin directory | <https://github.com/cursor/plugins/tree/main/pstack> | The whole ported tree: 56 skills, 2 agents (`poteto-agent`, `comment-sicko`), the guide, the automation pack. Local clone at `cursor-plugins/` (gitignored) |
| Pinned commit `190d287` | <https://github.com/cursor/plugins/commit/190d28736eff128ec94f502a22c7fe0c4b56cd37> | The version this port was built against. The local clone's `HEAD` is `190d287`; the commit exists upstream with that full SHA |
| `pstack/plugin.json` | `cursor-plugins/pstack/plugin.json` | `version: 0.15.29`, `license: MIT`, `author: Lauren Tan`. The version, license and attribution claims in the README |
| `pstack/skills/setup-pstack/SKILL.md` | `cursor-plugins/pstack/skills/setup-pstack/SKILL.md` | The thing being replaced: it writes `~/.cursor/rules/pstack-models.mdc` with `alwaysApply: true` and 17 role lines of real model slugs, plus a budget-to-effort ladder (`max`/`xhigh`/`high`/`medium`). Read to derive the 17 roles, the panel-as-list fan-out, and the `inherit-parent` / `auto` aliases that became "no `model:` line" |
| `pstack/docs/harness/claude-code.md` | `cursor-plugins/pstack/docs/harness/claude-code.md` | Precedent and shape for `pstack-docs/harness/opencode.md`: upstream already adapts itself to a second host with a two-column table per area, and the port follows that form |
| `pstack/docs/guide/` | `cursor-plugins/pstack/docs/guide/` | Source of the ported guide (10 pages plus `README.md`), rewritten in place for OpenCode paths and commands |
| `pstack/automations/`, and the skills' frontmatter | `cursor-plugins/pstack/` | The 59 `disable-model-invocation: true` lines across 58 files (55 of the 56 skills, plus 3 under `automations/benny`), and the skip lines for Automations. The flag appears nowhere in upstream's README or `docs/` — 0 hits — which is why the port had to decide what it meant |

## OpenCode v2 documentation

All v2 pages live under `/v2/docs/`. The older `/docs/` tree answers at the same slugs for most of
these, but it serves v1 content, and `migrate-v1` exists only under `/v2/docs/`.

| Page | URL | Used for |
| --- | --- | --- |
| Skills | <https://opencode.ai/v2/docs/skills/> | `SKILL.md` per directory; `name` / `description` frontmatter; the ID is the path; the model-facing list carries only ID, name and description; `skill` is called with the exact ID; `metadata.opencode/autoinvoke: false` and `disable-model-invocation: true` are documented equivalents, and a hidden skill stays loadable by ID. This is the rule behind "only `poteto-mode` hides" |
| Agents | <https://opencode.ai/v2/docs/agents/> | `agents/<name>.md` global and `.opencode/agents/`, `mode: subagent`, and the line that settles the agent-ID decision: a nested path becomes part of the ID (`agents/team/reviewer.md` → `team/reviewer`). Also the frontmatter `permissions:` list shape (`action` / `resource` / `effect`) that `gen-artifacts.mjs` emits, and `model:` in `provider/model[/#variant]` form |
| Commands | <https://opencode.ai/v2/docs/commands/> | `commands/*.md`, nested paths becoming `/pstack/<name>`, the body as the prompt template, `$ARGUMENTS`, and frontmatter `description`. The "one thin command per skill" decision rests on the body being the template |
| Tools | <https://opencode.ai/v2/docs/tools/> | The built-in tool list, which is what the Cursor tool names were mapped onto: `question` for `AskQuestion`, `grep` / `glob` for `Grep` / `Glob`, and no todo tool at all — hence "keep the plan in your reply" |
| Plugins | <https://opencode.ai/v2/docs/plugins/> | What a v2 plugin is (packages or `.ts`/`.js` files under `plugins/`, loaded from a `plugins` array in `opencode.jsonc`) and what it costs. Read to decide against a shim |
| Config | <https://opencode.ai/v2/docs/config/> | Where config lives and how it merges, JSON/JSONC, and the `provider/model` model string format. Confirms the port can be delivered as files in the config directory with no schema changes |
| Migrate from v1 | <https://opencode.ai/v2/docs/migrate-v1/> | The three v2 breaking changes (plugin API, server API and clients, terminal client config) and the statement that existing agents, commands, skills and file-based definitions keep working. This is why the port ships files and no code |

Checked, not assumed: `https://opencode.ai/docs/migrate-v1/` returns 404 and
`https://opencode.ai/v2/docs/migrate-v1/` returns the page, so the doc links above are the v2 ones
on purpose.

## Runtime and probes

| Source | Where | Used for |
| --- | --- | --- |
| OpenCode v2.1.1 binary | `bin-v2/opencode.exe` (gitignored); `./bin-v2/opencode.exe --version` → `opencode v2.1.1` | Every live check: `debug agents`, `run --standalone`, `api POST`, and the `sqlite3` cross-checks against `~/.local/share/opencode/opencode.db` |
| Model provider `<provider>` | A provider entry in the test machine's global `~/.config/opencode/opencode.json`, offering `<model>` | The probe model, `<provider>/<model>`, used for the skill-load, command, subagent and model-routing checks. The model-routing result is about the mechanism, not about that provider |
| Node 24.13.0 / Bun 1.3.14 | Test machine | `scripts/*.mjs` (node, no dependencies beyond `node:fs`), and `bun install --frozen-lockfile` + `bun test` in `poteto-mode/scripts` |

## This repo's own documents

| Source | Where | Used for |
| --- | --- | --- |
| The adapter | `pstack-docs/harness/opencode.md` | The single mapping every prose rewrite deferred to: tools, subagent fields, roles and models, paths, and the Cursor-only skip rule |
| The rewrite brief | `tools/rewrite-brief.md` | Canonical phrasings, the hard rules, and the grep a writer had to run before reporting |
| The verification log | [`docs/VERIFICATION.md`](./VERIFICATION.md) | Every number quoted in [`METHODOLOGY.md`](./METHODOLOGY.md): discovery (§1), skill load (§2), command (§3), subagent spawn (§4), model routing (§5), static gates (§6), script tests (§7), the discovery defect and command expansion (§8) |

## How to re-verify

From the repo root:

```bash
node scripts/verify-port.mjs        # static gate; exits 1 on any failure
node scripts/install.mjs --check    # hashes the installed copy against the tree
node scripts/install.mjs --dry-run  # what would be written, and where
```

`verify-port.mjs` needs no dependencies and no OpenCode install; with no install present it says
so and skips that one check rather than failing. `install.mjs --check` compares tree hashes, so it
proves content, not just file names.

For the runtime checks, the procedure and the exact commands are in
[`docs/VERIFICATION.md`](./VERIFICATION.md) §1–§8: which CLI call proves discovery, which proves a
skill load, which proves a spawned child, how model routing was proven against the session store,
and how the two gate checks were made to fail on purpose before being trusted.

Script tests, if you want them:

```bash
cd skills/pstack/poteto-mode/scripts
bun install --frozen-lockfile
bun test
```

Expect 63 pass / 5 fail. That is the upstream baseline (§7), not a clean run. `bun install` writes
a `node_modules/` tree into the skill directory; it is gitignored and both the installer and the
verifier skip it.

## Not opened, not relied on

- **OpenCode source code.** Not read. Every behavioural claim here comes from the v2.1.1 binary's
  output, the server API, or the session store — not from reading the implementation.
- **The v2 plugin migration guide** (`/v2/docs/plugins/migrate-v1`), referenced from the migrate
  page. Not opened; the port ships no plugin, so only the existence of the API change mattered.
- **Cursor's own documentation** for the `Task` tool, Bugbot, cloud agents, or Custom Modes. Not
  opened. The evidence for those names is upstream pstack's own text, which is what had to be
  rewritten.
- **The v2.1.1 release notes.** Not read; version pinning rests on `--version` output and the
  behaviour recorded in the verification log.
- **Any other host's port of pstack.** No comparison was made, and none is claimed.
