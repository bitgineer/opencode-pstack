#!/usr/bin/env python3
"""Rewrite the Cursor pstack tree into the OpenCode v2 port.

Run from the repo root after copying and renaming skill directories:

    python tools/port-rewrite.py

It rewrites unambiguous Cursor names (paths, tools, subagent fields, slash commands,
skill IDs) and prints a report of what is left for semantic review. It never touches
file names or directory structure; renaming happens in the copy step.
"""

from __future__ import annotations

import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKILLS = ROOT / "skills"
# Skill directories: nested pstack/<name>/ after regroup, or the older flat pstack-<name>/.
GROUP = SKILLS / "pstack"
NAMES = sorted(
    p.name.removeprefix("pstack-")
    for p in (GROUP if GROUP.is_dir() else SKILLS).iterdir()
    if p.is_dir() and p.name != "pstack"
)

counts: Counter[str] = Counter()


def sub(text: str, pattern: str, repl: str, label: str, flags: int = 0) -> str:
    new, n = re.subn(pattern, repl, text, flags=flags)
    if n:
        counts[label] += n
    return new


def rewrite(text: str) -> str:
    # Frontmatter: OpenCode ignores icon/color, and is_background is a Cursor field.
    text = sub(text, r"^icon:.*\n", "", "frontmatter: drop icon", re.M)
    text = sub(text, r"^color:.*\n", "", "frontmatter: drop color", re.M)
    text = sub(text, r"^is_background:.*\n", "", "frontmatter: drop is_background", re.M)

    # Relative paths to sibling skills, now prefixed.
    for name in NAMES:
        text = sub(text, rf"\.\./{re.escape(name)}/", f"../pstack-{name}/", "path: sibling skill")
        text = sub(text, rf"<pstack>/skills/{re.escape(name)}/", f"<pstack>/skills/pstack-{name}/", "path: <pstack> skill")

    # Slash commands. Skip ones already namespaced.
    for name in NAMES:
        text = sub(text, rf"(?<!pstack)(?<![\w/])/({re.escape(name)})\b", rf"/pstack/{name}", "command: namespaced")

    # Bold skill mentions become IDs so a reader can load them.
    for name in NAMES:
        text = sub(text, rf"\*\*{re.escape(name)}\*\*", f"**pstack-{name}**", "skill: bold id")

    # Cursor paths.
    text = sub(text, r"~/\.cursor/rules/pstack-models\.mdc", "~/.config/opencode/agents/pstack-<role>.md", "path: models rule")
    text = sub(text, r"~/\.cursor/(plugins|skills)/", r"~/.config/opencode/\1/", "path: ~/.cursor")
    text = sub(text, r"~/\.cursor/", "~/.config/opencode/", "path: other ~/.cursor")
    text = sub(text, r"(?<![\w.])\.cursor/skills/", ".opencode/skills/", "path: project skills")
    text = sub(text, r"\.cursor-plugin/plugin\.json", "plugin.json", "path: plugin manifest")

    # Tools and subagent fields.
    text = sub(text, r"`Task` tool", "`subagent` tool", "tool: Task")
    text = sub(text, r"Task tool", "subagent tool", "tool: Task tool")
    text = sub(text, r"\bTask subagent\b", "subagent", "tool: Task subagent")
    text = sub(text, r"`Task` call", "`subagent` call", "tool: Task call")
    text = sub(text, r"\bTask call\b", "subagent call", "tool: Task call")
    text = sub(text, r"\bTask`", "subagent`", "tool: bare Task")
    text = sub(text, r"\bthe Task\b", "the subagent", "tool: the Task")
    text = sub(text, r"\bTask ", "subagent ", "tool: Task word")
    text = sub(text, r"AskQuestion", "question", "tool: AskQuestion")
    text = sub(text, r"run_in_background: true", "background: true", "field: background")
    text = sub(text, r'subagent_type: "?poteto-agent"?', 'agent: "pstack-poteto-agent"', "field: poteto-agent")
    text = sub(text, r'subagent_type: "?comment-sicko"?', 'agent: "pstack-comment-sicko"', "field: comment-sicko")
    text = sub(text, r'subagent_type: "?(generalPurpose|general-purpose)"?', 'agent: "general"', "field: generalPurpose")
    text = sub(text, r"subagent_type", "agent", "field: subagent_type")
    text = sub(text, r'environment: "cloud"', 'a worktree (`worktree_create`)', "field: cloud env")

    return text


def main() -> int:
    # One-shot migration tool: the port has already been regrouped into skills/pstack/<name>/,
    # so a re-run would rewrite finished prose backwards. Refuse instead of damaging it.
    if GROUP.is_dir() and not any(p.is_dir() and p.name.startswith("pstack-") for p in SKILLS.iterdir()):
        print("skills/pstack/<name>/ layout detected; already regrouped, nothing to rewrite")
        return 0

    touched = 0
    for path in sorted(SKILLS.rglob("*.md")):
        old = path.read_text(encoding="utf-8")
        new = rewrite(old)
        name = path.parent.name if path.name == "SKILL.md" else None
        if name and name.startswith("pstack-") and "name:" in new:
            new = re.sub(r"^name:.*$", f"name: {name}", new, count=1, flags=re.M)
        if new != old:
            path.write_text(new, encoding="utf-8")
            touched += 1

    print(f"rewrote {touched} markdown files")
    for label, n in sorted(counts.items()):
        print(f"  {label:34} {n}")

    # What still needs a human or a subagent.
    leftovers = Counter()
    for path in sorted(SKILLS.rglob("*")):
        if path.suffix not in {".md", ".mjs", ".ts", ".sh"} or not path.is_file():
            continue
        body = path.read_text(encoding="utf-8", errors="replace")
        for token in CURSOR_TOKENS:
            if token in body:
                leftovers[token] += 1
    print("\nleftover Cursor tokens by file count")
    for token, n in sorted(leftovers.items()):
        print(f"  {token:34} {n}")
    return 0


CURSOR_TOKENS = [
    "Cursor",
    "cursor",
    "sandbox",
    "AskQuestion",
    "subagent_type",
    "pstack-models",
    "agent-transcripts",
    "/loop",
    "Bugbot",
    "create-skill",
    "deslop",
    "control-ui",
    "control-cli",
    "run_in_background",
    "readonly",
    "cloud agent",
]

if __name__ == "__main__":
    sys.exit(main())
