#!/usr/bin/env python3
"""Regroup the port: skills and agents under one pstack/ folder, IDs unchanged in spirit.

Before: skills/pstack-<name>/SKILL.md  (ID pstack-<name>)
        agents/pstack-<role>.md        (ID pstack-<role>)
After:  skills/pstack/<name>/SKILL.md  (ID <name>, the folder name)
        agents/pstack/<role>.md        (ID pstack/<role>, the nested path)

OpenCode derives a skill ID from its directory and an agent ID from its path under
agents/. Nesting the parent folder therefore costs the skill prefix, so every
`pstack-<name>` reference in prose becomes `<name>`, and every `pstack-<role>` agent
reference becomes `pstack/<role>`.

Run once, from the repo root:

    python tools/regroup.py
"""

from __future__ import annotations

import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# The installable tree lives at the repo root: skills/, agents/, commands/, pstack-docs/.
PORT = ROOT
SKILLS = PORT / "skills"
AGENTS = PORT / "agents"
COMMANDS = PORT / "commands"
DOCS = PORT / "pstack-docs"
TREES = [SKILLS, AGENTS, COMMANDS, DOCS]
REWRITE_SUFFIXES = {".md", ".json", ".mjs", ".ts", ".sh"}


def port_files(suffixes: set[str]):
    """Every file under the installable trees with one of `suffixes`."""
    for tree in TREES:
        if not tree.is_dir():
            continue
        for path in sorted(tree.rglob("*")):
            if path.is_file() and path.suffix in suffixes:
                yield path

ROLES = [
    "poteto-agent",
    "comment-sicko",
    "code",
    "bugfix",
    "perf",
    "hillclimb",
    "judgment",
    "hardest",
    "how-explorer",
    "how-explainer",
    "why-investigator",
    "why-synthesizer",
    "reflect-tooling",
    "reflect-judgment",
    "arena-1",
    "arena-2",
    "cross-judge-1",
    "cross-judge-2",
    "swarm-worker",
    "architect-1",
    "architect-2",
    "interrogate-1",
    "interrogate-2",
]

SKILL_NAMES = sorted(
    p.name
    for p in ((SKILLS / "pstack") if (SKILLS / "pstack").is_dir() else SKILLS).iterdir()
    if p.is_dir()
    and (p.name != "pstack")
    and (p.name.startswith("pstack-") or (SKILLS / "pstack").is_dir())
)
SKILL_NAMES = sorted(n.removeprefix("pstack-") for n in SKILL_NAMES)


def rewrite_text(text: str) -> str:
    text = text.replace("pstack-principle-*", "principle-*")
    # Agent file paths gain the pstack/ group.
    for role in ROLES:
        text = re.sub(
            rf"(?<=/)agents/pstack-{re.escape(role)}(?=\.md|/)",
            f"agents/pstack/{role}",
            text,
        )
    # Relative links to a sibling skill lose the prefix with the move.
    for name in SKILL_NAMES:
        text = re.sub(rf"\.\./pstack-{re.escape(name)}/", f"../{name}/", text)
    # Paths that point into the skill tree move under the pstack/ group.
    for name in SKILL_NAMES:
        text = re.sub(
            rf"(?<=/)(?<!pstack/)skills/pstack-{re.escape(name)}(?![\w-])",
            f"skills/pstack/{name}",
            text,
        )
    for role in ROLES:
        text = re.sub(rf"(?<![\w/.-])pstack-{re.escape(role)}(?![\w-])", f"pstack/{role}", text)
    for name in SKILL_NAMES:
        text = re.sub(rf"(?<![\w/.-])pstack-{re.escape(name)}(?![\w-])", name, text)
    return text


def main() -> int:
    # Move directories first so SKILL_NAMES stays stable for the text pass.
    skill_group = SKILLS / "pstack"
    skill_group.mkdir(exist_ok=True)
    for name in SKILL_NAMES:
        src = SKILLS / f"pstack-{name}"
        dst = skill_group / name
        if src.exists():
            shutil.move(str(src), str(dst))

    agent_group = AGENTS / "pstack"
    agent_group.mkdir(exist_ok=True)
    for file in sorted(AGENTS.glob("pstack-*.md")):
        role = file.name.removeprefix("pstack-").removesuffix(".md")
        shutil.move(str(file), str(agent_group / f"{role}.md"))

    touched = 0
    for path in port_files(REWRITE_SUFFIXES):
        old = path.read_text(encoding="utf-8")
        new = rewrite_text(old)
        # Frontmatter display name follows the ID.
        if path.name == "SKILL.md":
            name = path.parent.name
            new = re.sub(r"^name:.*$", f"name: {name}", new, count=1, flags=re.M)
        if new != old:
            path.write_text(new, encoding="utf-8")
            touched += 1

    for extra in [ROOT / "tools" / "rewrite-brief.md"]:
        if extra.exists():
            old = extra.read_text(encoding="utf-8")
            new = rewrite_text(old)
            if new != old:
                extra.write_text(new, encoding="utf-8")
                touched += 1

    print(f"moved {len(SKILL_NAMES)} skills, {len(ROLES)} agents; rewrote {touched} files")
    leftovers = []
    for path in port_files({".md"}):
        body = path.read_text(encoding="utf-8")
        for m in re.finditer(r"pstack-[a-z0-9-]+", body):
            if path.name == "opencode.md" and path.parent.name == "harness":
                continue
            leftovers.append(f"{path.relative_to(ROOT)}: {m.group(0)}")
    print(f"leftovers: {len(leftovers)}")
    for line in leftovers[:40]:
        print(f"  {line}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
