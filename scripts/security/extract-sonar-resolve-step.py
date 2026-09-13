#!/usr/bin/env python3
"""Extract the "Resolve SONAR_TOKEN" step script from a SonarCloud workflow file.

Used by verify-sonar-token-source.sh to execute the *shipped* logic instead of a
reimplementation, so the test cannot drift from the workflow it claims to cover.

Usage: extract-sonar-resolve-step.py <path-to-sonar.yml> [step name substring]
"""
import re
import sys

try:
    import yaml  # type: ignore
except ImportError:  # pragma: no cover - exercised on machines without PyYAML
    yaml = None


def from_yaml(path: str, needle: str) -> str:
    with open(path, encoding="utf-8") as fh:
        doc = yaml.safe_load(fh)
    for job in doc["jobs"].values():
        for step in job.get("steps", []):
            if needle.lower() in (step.get("name") or "").lower():
                return step["run"]
    raise SystemExit(f"step matching {needle!r} not found in {path}")


def from_text(path: str, needle: str) -> str:
    """Fallback parser: pull the block scalar under `- name: <needle>`."""
    with open(path, encoding="utf-8") as fh:
        lines = fh.read().splitlines()
    out: list[str] = []
    collecting = False
    run_indent = None
    for line in lines:
        if not collecting and needle.lower() in line.lower() and line.lstrip().startswith("- name:"):
            collecting = True
            continue
        if collecting:
            if re.match(r"^\s*run:\s*\|", line):
                run_indent = len(line) - len(line.lstrip())
                continue
            if run_indent is None:
                if line.strip() == "" or re.match(r"^\s*(env|with|id):", line):
                    continue
                continue
            stripped = line.strip()
            if stripped == "":
                out.append("")
                continue
            indent = len(line) - len(line.lstrip())
            if indent <= run_indent:
                break
            out.append(line[run_indent + 2 :] if indent > run_indent else line.lstrip())
    if not out:
        raise SystemExit(f"step matching {needle!r} not parseable from {path}")
    return "\n".join(out)


def main() -> int:
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    path = sys.argv[1]
    needle = sys.argv[2] if len(sys.argv) > 2 else "Resolve SONAR_TOKEN"
    script = from_yaml(path, needle) if yaml else from_text(path, needle)
    sys.stdout.write(script if script.endswith("\n") else script + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
