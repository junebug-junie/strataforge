# StrataForge Session v0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-first HITL architecture design pairing plane where humans gate LLM/manual proposals into durable Markdown topic scaffolds, browse the atlas in a minimal web UI, validate the workspace, generate bounded prompts, and see a deterministic coherence radar queue.

**Architecture:** Files (`strata.yaml`, topic Markdown, session/proposal JSON) are authoritative; SQLite under `.strata/` is a rebuildable index. One FastAPI app serves REST; a Vite/React UI calls it. LLM integration is manual-paste-first (generate prompt → user pastes structured JSON → import proposals). Proposal accept/reject/defer gates control durable writes; apply creates scaffolds only for accepted proposals and refuses to overwrite expanded topics without `--force`.

**Tech Stack:** Python 3.11+, Typer CLI, Pydantic v2, PyYAML, python-frontmatter, FastAPI, uvicorn, SQLite3, pytest; React 18, TypeScript, Vite, TanStack Query (optional), minimal CSS.

---

## File Structure (MVP)

| Path | Responsibility |
|------|----------------|
| `pyproject.toml` | Package metadata, `strata` console script, dev deps |
| `.env.example` | Local config template (spec §33) |
| `docker-compose.yml` | API :8787, UI :8788 (spec §23) |
| `strataforge/__init__.py` | Package version |
| `strataforge/cli.py` | Typer app wiring subcommands |
| `strataforge/config.py` | Env-based settings |
| `strataforge/models.py` | Pydantic models: Topic, Session, Proposal, RadarItem |
| `strataforge/core/paths.py` | Workspace path helpers |
| `strataforge/core/ids.py` | `topic:area.child` ID generation |
| `strataforge/core/manifest.py` | Load/save `strata.yaml` |
| `strataforge/core/status.py` | Enums + transition validators |
| `strataforge/core/topic_store.py` | Read/write topic Markdown + manifest entries |
| `strataforge/core/session_store.py` | Session JSON + Markdown summary |
| `strataforge/core/proposal_store.py` | Proposal CRUD + human actions |
| `strataforge/core/apply_engine.py` | Safe scaffold creation from accepted proposals |
| `strataforge/core/validation.py` | Manifest + scaffold + session validation |
| `strataforge/core/indexer.py` | SQLite rebuild from files |
| `strataforge/parser/frontmatter.py` | Parse/serialize topic frontmatter |
| `strataforge/llm/prompts.py` | Expansion/reconciliation prompt templates |
| `strataforge/llm/manual_import.py` | Parse pasted proposal JSON |
| `strataforge/llm/coherence.py` | Deterministic radar scoring (spec §17.5) |
| `strataforge/server/app.py` | FastAPI factory + CORS |
| `strataforge/server/routes_*.py` | REST handlers per resource |
| `strataforge/templates/*` | Jinja or string templates for scaffolds |
| `strataforge/ui/` | Vite React app |
| `tests/` | Unit + integration + golden fixtures |
| `workspaces/demo/` | Demo project (optional, for UI dev) |
| `fixtures/` | Golden files for tests |

---

### Task 1: Repository foundation and package skeleton

**Files:**
- Create: `pyproject.toml`
- Create: `strataforge/__init__.py`
- Create: `strataforge/cli.py`
- Create: `tests/test_cli_smoke.py`
- Create: `.gitignore`

- [ ] **Step 1: Write the failing smoke test**

```python
# tests/test_cli_smoke.py
from typer.testing import CliRunner
from strataforge.cli import app

runner = CliRunner()

def test_cli_version():
    result = runner.invoke(app, ["--version"])
    assert result.exit_code == 0
    assert "0.1.0" in result.stdout
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /mnt/scripts/strataforge && python -m pytest tests/test_cli_smoke.py::test_cli_version -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'strataforge'`

- [ ] **Step 3: Write minimal package**

```toml
# pyproject.toml
[project]
name = "strataforge"
version = "0.1.0"
description = "Local-first HITL architecture design pairing plane"
requires-python = ">=3.11"
dependencies = [
  "typer>=0.12",
  "pydantic>=2.7",
  "pyyaml>=6.0",
  "python-frontmatter>=1.1",
  "fastapi>=0.111",
  "uvicorn[standard]>=0.29",
  "jinja2>=3.1",
]

[project.optional-dependencies]
dev = ["pytest>=8.2", "httpx>=0.27", "ruff>=0.4"]

[project.scripts]
strata = "strataforge.cli:app"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["strataforge"]

[tool.pytest.ini_options]
testpaths = ["tests"]
```

```python
# strataforge/__init__.py
__version__ = "0.1.0"
```

```python
# strataforge/cli.py
import typer
from strataforge import __version__

app = typer.Typer(no_args_is_help=True, name="strata")

@app.callback()
def main(version: bool = typer.Option(False, "--version", help="Show version")):
    if version:
        typer.echo(f"strata {__version__}")
        raise typer.Exit()

@app.command("hello")
def hello():
    typer.echo("StrataForge CLI ready")
```

```gitignore
.venv/
__pycache__/
*.pyc
.pytest_cache/
.strata/
*.db
node_modules/
dist/
.env
```

- [ ] **Step 4: Install and run test**

Run:
```bash
cd /mnt/scripts/strataforge
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
pytest tests/test_cli_smoke.py::test_cli_version -v
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pyproject.toml strataforge/ tests/ .gitignore
git commit -m "feat: add strataforge package skeleton and CLI entrypoint"
```

---

### Task 2: Configuration and path helpers

**Files:**
- Create: `strataforge/config.py`
- Create: `strataforge/core/paths.py`
- Create: `.env.example`
- Test: `tests/core/test_paths.py`

- [ ] **Step 1: Write failing path test**

```python
# tests/core/test_paths.py
from pathlib import Path
from strataforge.core.paths import ProjectPaths

def test_project_paths_resolve_manifest(tmp_path: Path):
    project = tmp_path / "my-project"
    project.mkdir()
    paths = ProjectPaths(project)
    assert paths.manifest == project / "strata.yaml"
    assert paths.areas_dir == project / "areas"
    assert paths.sessions_dir == project / "sessions"
    assert paths.strata_dir == project / ".strata"
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `pytest tests/core/test_paths.py -v`
Expected: `ModuleNotFoundError`

- [ ] **Step 3: Implement config and paths**

```python
# strataforge/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    strata_workspace_root: str = "/mnt/scripts/strataforge/workspaces"
    strata_db_path: str = "/mnt/scripts/strataforge/.strata/strata.db"
    strata_host: str = "127.0.0.1"
    strata_port: int = 8787
    strata_llm_provider: str = "manual"
    strata_require_human_gate_for_writes: bool = True

settings = Settings()
```

Add `pydantic-settings>=2.2` to `pyproject.toml` dependencies.

```python
# strataforge/core/paths.py
from dataclasses import dataclass
from pathlib import Path

@dataclass(frozen=True)
class ProjectPaths:
    root: Path

    @property
    def manifest(self) -> Path:
        return self.root / "strata.yaml"

    @property
    def areas_dir(self) -> Path:
        return self.root / "areas"

    @property
    def sessions_dir(self) -> Path:
        return self.root / "sessions"

    @property
    def decisions_dir(self) -> Path:
        return self.root / "decisions"

    @property
    def links_dir(self) -> Path:
        return self.root / "links"

    @property
    def strata_dir(self) -> Path:
        return self.root / ".strata"

    @property
    def db_path(self) -> Path:
        return self.strata_dir / "strata.db"
```

```bash
# .env.example
STRATA_WORKSPACE_ROOT=/mnt/scripts/strataforge/workspaces
STRATA_DB_PATH=/mnt/scripts/strataforge/.strata/strata.db
STRATA_HOST=127.0.0.1
STRATA_PORT=8787
STRATA_LLM_PROVIDER=manual
STRATA_REQUIRE_HUMAN_GATE_FOR_WRITES=true
```

- [ ] **Step 4: Run test — expect PASS**

Run: `pytest tests/core/test_paths.py -v`

- [ ] **Step 5: Commit**

```bash
git add strataforge/config.py strataforge/core/paths.py .env.example pyproject.toml tests/core/
git commit -m "feat: add settings and project path helpers"
```

---

### Task 3: Domain models and status enums

**Files:**
- Create: `strataforge/models.py`
- Create: `strataforge/core/status.py`
- Test: `tests/core/test_status.py`

- [ ] **Step 1: Write failing status transition test**

```python
# tests/core/test_status.py
import pytest
from strataforge.core.status import (
    DesignStatus,
    ProposalState,
    ReviewState,
    assert_status_promotion_allowed,
)

def test_promotion_scaffolded_to_expanded_allowed():
    assert_status_promotion_allowed(DesignStatus.scaffolded, DesignStatus.expanded)

def test_promotion_scaffolded_to_implemented_rejected():
    with pytest.raises(ValueError, match="not allowed"):
        assert_status_promotion_allowed(DesignStatus.scaffolded, DesignStatus.implemented)
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `pytest tests/core/test_status.py -v`

- [ ] **Step 3: Implement enums and models**

```python
# strataforge/core/status.py
from enum import Enum

class DesignStatus(str, Enum):
    scaffolded = "scaffolded"
    expanded = "expanded"
    reconciled = "reconciled"
    execution_ready = "execution_ready"
    implemented = "implemented"
    verified = "verified"
    stale = "stale"

class ProposalState(str, Enum):
    proposed = "proposed"
    accepted = "accepted"
    revised = "revised"
    rejected = "rejected"
    out_of_scope = "out_of_scope"
    deferred = "deferred"
    promoted_to_scaffold = "promoted_to_scaffold"

class ReviewState(str, Enum):
    unreviewed = "unreviewed"
    accepted = "accepted"
    needs_revision = "needs_revision"
    rejected = "rejected"
    out_of_scope = "out_of_scope"
    duplicate = "duplicate"
    split_needed = "split_needed"

_ALLOWED_PROMOTIONS = {
    (DesignStatus.scaffolded, DesignStatus.expanded),
    (DesignStatus.expanded, DesignStatus.reconciled),
    (DesignStatus.reconciled, DesignStatus.execution_ready),
    (DesignStatus.execution_ready, DesignStatus.implemented),
    (DesignStatus.implemented, DesignStatus.verified),
    (DesignStatus.expanded, DesignStatus.stale),
    (DesignStatus.reconciled, DesignStatus.stale),
    (DesignStatus.execution_ready, DesignStatus.stale),
}

def assert_status_promotion_allowed(current: DesignStatus, target: DesignStatus) -> None:
    if (current, target) not in _ALLOWED_PROMOTIONS:
        raise ValueError(f"Promotion {current.value} -> {target.value} not allowed")
```

```python
# strataforge/models.py
from datetime import date, datetime
from typing import Any
from pydantic import BaseModel, Field
from strataforge.core.status import DesignStatus, ProposalState, ReviewState

class CoverageFlags(BaseModel):
    concept_addressed: bool = False
    concept_solved: bool = False
    out_of_scope: bool = False
    needs_design: bool = True
    needs_reconciliation: bool = False
    needs_code_review: bool = False
    needs_implementation: bool = False

class TopicRecord(BaseModel):
    id: str
    title: str
    kind: str = "topic"
    level: str = "area"
    parent: str | None = None
    path: str
    status: DesignStatus = DesignStatus.scaffolded
    review_state: ReviewState = ReviewState.unreviewed
    proposal_state: ProposalState = ProposalState.promoted_to_scaffold
    coverage: CoverageFlags = Field(default_factory=CoverageFlags)
    depends_on: list[str] = Field(default_factory=list)
    feeds_into: list[str] = Field(default_factory=list)
    blocks: list[str] = Field(default_factory=list)
    created_at: date | None = None
    updated_at: date | None = None
    last_reviewed: date | None = None

class ProjectManifest(BaseModel):
    project_id: str
    title: str
    version: str = "0.1.0"
    status: str = "active"
    levels: list[str] = Field(default_factory=lambda: ["area", "topic", "subtopic", "leaf"])
    root_areas: list[TopicRecord] = Field(default_factory=list)
    topics: list[TopicRecord] = Field(default_factory=list)
    settings: dict[str, Any] = Field(default_factory=dict)

class Proposal(BaseModel):
    id: str
    session_id: str
    topic_id: str | None = None
    kind: str
    state: ProposalState = ProposalState.proposed
    title: str
    summary: str = ""
    rationale: str = ""
    proposed_changes: dict[str, Any] = Field(default_factory=dict)
    human_review: dict[str, Any] = Field(default_factory=dict)

class DesignSession(BaseModel):
    id: str
    project_id: str
    title: str
    topic_id: str | None = None
    mode: str = "intake"
    current_gate: str = "intake_accepted"
    created_at: datetime
    updated_at: datetime
    inputs: dict[str, Any] = Field(default_factory=dict)
    proposals: list[str] = Field(default_factory=list)
    outputs: dict[str, Any] = Field(default_factory=dict)

class RadarItem(BaseModel):
    id: str
    topic_id: str
    title: str
    severity: str
    score: int
    reason_codes: list[str] = Field(default_factory=list)
    summary: str = ""
    recommended_commands: list[str] = Field(default_factory=list)
    created_at: datetime
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `pytest tests/core/test_status.py -v`

- [ ] **Step 5: Commit**

```bash
git add strataforge/models.py strataforge/core/status.py tests/core/test_status.py
git commit -m "feat: add domain models and status transition rules"
```

---

### Task 4: Frontmatter parser

**Files:**
- Create: `strataforge/parser/frontmatter.py`
- Test: `tests/parser/test_frontmatter.py`
- Create: `fixtures/expected_topic_scaffold.md`

- [ ] **Step 1: Write failing parse test**

```python
# tests/parser/test_frontmatter.py
from pathlib import Path
from strataforge.parser.frontmatter import load_topic_file, dump_topic_file
from strataforge.models import TopicRecord
from strataforge.core.status import DesignStatus, ReviewState

FIXTURE = Path("fixtures/expected_topic_scaffold.md")

def test_roundtrip_topic_frontmatter(tmp_path: Path):
    text = FIXTURE.read_text()
    topic, body = load_topic_file(text)
    assert topic.id == "topic:runtime.session-gates"
    assert topic.status == DesignStatus.expanded
    assert "## Purpose" in body
    out = dump_topic_file(topic, body)
    topic2, body2 = load_topic_file(out)
    assert topic2.id == topic.id
    assert body2.strip() == body.strip()
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `pytest tests/parser/test_frontmatter.py -v`

- [ ] **Step 3: Add fixture and implementation**

Create `fixtures/expected_topic_scaffold.md` using spec §10.1–10.2 (Session Gates example with shortened body).

```python
# strataforge/parser/frontmatter.py
import frontmatter
from strataforge.models import TopicRecord, CoverageFlags
from strataforge.core.status import DesignStatus, ReviewState, ProposalState

def _meta_to_topic(meta: dict) -> TopicRecord:
    coverage_raw = meta.pop("coverage", {}) or {}
    return TopicRecord(
        id=meta["id"],
        title=meta["title"],
        kind=meta.get("kind", "topic"),
        level=meta.get("level", "leaf"),
        parent=meta.get("parent"),
        path=meta["path"],
        status=DesignStatus(meta.get("status", "scaffolded")),
        review_state=ReviewState(meta.get("review_state", "unreviewed")),
        proposal_state=ProposalState(meta.get("proposal_state", "promoted_to_scaffold")),
        coverage=CoverageFlags(**coverage_raw),
        depends_on=meta.get("depends_on", []) or [],
        feeds_into=meta.get("feeds_into", []) or [],
        blocks=meta.get("blocks", []) or [],
        created_at=meta.get("created_at"),
        updated_at=meta.get("updated_at"),
        last_reviewed=meta.get("last_reviewed"),
    )

def load_topic_file(text: str) -> tuple[TopicRecord, str]:
    post = frontmatter.loads(text)
    topic = _meta_to_topic(dict(post.metadata))
    return topic, post.content

def dump_topic_file(topic: TopicRecord, body: str) -> str:
    meta = topic.model_dump(mode="json")
    meta["coverage"] = topic.coverage.model_dump()
    post = frontmatter.Post(body, **meta)
    return frontmatter.dumps(post)
```

- [ ] **Step 4: Run test — expect PASS**

Run: `pytest tests/parser/test_frontmatter.py -v`

- [ ] **Step 5: Commit**

```bash
git add strataforge/parser/ tests/parser/ fixtures/
git commit -m "feat: add topic frontmatter parse and serialize"
```

---

### Task 5: Manifest loader and `strata init`

**Files:**
- Create: `strataforge/core/manifest.py`
- Create: `strataforge/core/ids.py`
- Create: `strataforge/templates/strata.yaml`
- Create: `strataforge/templates/topic.md`
- Modify: `strataforge/cli.py`
- Test: `tests/integration/test_init_project.py`

- [ ] **Step 1: Write failing init integration test**

```python
# tests/integration/test_init_project.py
from pathlib import Path
from typer.testing import CliRunner
from strataforge.cli import app
import yaml

runner = CliRunner()

def test_strata_init_creates_workspace(tmp_path: Path):
    project = tmp_path / "demo"
    result = runner.invoke(app, ["init", str(project), "--title", "Demo"])
    assert result.exit_code == 0, result.stdout
    assert (project / "strata.yaml").exists()
    assert (project / "areas").is_dir()
    assert (project / "sessions").is_dir()
    data = yaml.safe_load((project / "strata.yaml").read_text())
    assert data["project_id"].startswith("project:")
    assert data["title"] == "Demo"
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `pytest tests/integration/test_init_project.py -v`

- [ ] **Step 3: Implement manifest + init command**

```python
# strataforge/core/ids.py
import re

def slugify(title: str) -> str:
    s = title.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")

def make_project_id(title: str) -> str:
    return f"project:{slugify(title)}"

def make_topic_id(parent_id: str | None, title: str) -> str:
    slug = slugify(title)
    if parent_id is None:
        return f"topic:{slug}"
    prefix = parent_id.split(":", 1)[1]
    return f"topic:{prefix}.{slug}"
```

```python
# strataforge/core/manifest.py
from pathlib import Path
import yaml
from strataforge.core.paths import ProjectPaths
from strataforge.core.ids import make_project_id
from strataforge.models import ProjectManifest

def load_manifest(paths: ProjectPaths) -> ProjectManifest:
    raw = yaml.safe_load(paths.manifest.read_text())
    return ProjectManifest.model_validate(raw)

def save_manifest(paths: ProjectPaths, manifest: ProjectManifest) -> None:
    paths.manifest.write_text(
        yaml.safe_dump(manifest.model_dump(mode="json"), sort_keys=False)
    )

def init_project(root: Path, title: str) -> ProjectManifest:
    paths = ProjectPaths(root)
    root.mkdir(parents=True, exist_ok=True)
    for d in [paths.areas_dir, paths.sessions_dir, paths.decisions_dir, paths.links_dir, paths.strata_dir]:
        d.mkdir(exist_ok=True)
    manifest = ProjectManifest(
        project_id=make_project_id(title),
        title=title,
        settings={
            "require_human_gate_for_scaffold_write": True,
            "require_human_gate_for_status_promotion": True,
            "default_llm_mode": "manual",
            "max_decomposition_children": 10,
        },
    )
    save_manifest(paths, manifest)
    (root / "README.md").write_text(f"# {title}\n\nStrataForge project workspace.\n")
    return manifest
```

Wire in `cli.py`:

```python
@app.command("init")
def init_cmd(path: str, title: str = "Untitled Project"):
    from strataforge.core.manifest import init_project
    manifest = init_project(Path(path), title)
    typer.echo(f"Initialized {manifest.project_id} at {path}")
```

- [ ] **Step 4: Run test — expect PASS**

Run: `pytest tests/integration/test_init_project.py -v`

- [ ] **Step 5: Commit**

```bash
git add strataforge/core/manifest.py strataforge/core/ids.py strataforge/cli.py tests/integration/
git commit -m "feat: add project init and strata.yaml manifest"
```

---

### Task 6: Topic store — list and show

**Files:**
- Create: `strataforge/core/topic_store.py`
- Modify: `strataforge/cli.py` (`list`, `show`)
- Test: `tests/core/test_topic_store.py`

- [ ] **Step 1: Write failing topic store test**

```python
# tests/core/test_topic_store.py
from pathlib import Path
from strataforge.core.manifest import init_project
from strataforge.core.paths import ProjectPaths
from strataforge.core.topic_store import create_topic_scaffold, list_topics

def test_create_and_list_topics(tmp_path: Path):
    init_project(tmp_path / "p", "P")
    paths = ProjectPaths(tmp_path / "p")
    create_topic_scaffold(
        paths,
        topic_id="topic:runtime",
        title="Runtime",
        area_slug="01-runtime",
        parent_id=None,
        level="area",
    )
    topics = list_topics(paths)
    assert len(topics) == 1
    assert topics[0].id == "topic:runtime"
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `pytest tests/core/test_topic_store.py -v`

- [ ] **Step 3: Implement topic store + CLI**

```python
# strataforge/core/topic_store.py
from pathlib import Path
from datetime import date
from strataforge.core.paths import ProjectPaths
from strataforge.core.manifest import load_manifest, save_manifest
from strataforge.models import TopicRecord, ProjectManifest
from strataforge.parser.frontmatter import dump_topic_file, load_topic_file
from strataforge.core.status import DesignStatus, ReviewState, ProposalState

_TOPIC_TEMPLATE = """# {title}

## Purpose

What this topic/component is responsible for.

## Boundary

### Includes

- TBD

### Excludes

- TBD

## Current Design

## Children

## Open Questions

## Agent Next Actions

- Run `/boundary-check`
"""

def create_topic_scaffold(
    paths: ProjectPaths,
    *,
    topic_id: str,
    title: str,
    area_slug: str,
    parent_id: str | None,
    level: str,
) -> TopicRecord:
    area_dir = paths.areas_dir / area_slug
    area_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{area_slug.split('-', 1)[0]}-{topic_id.split('.')[-1]}.md" if parent_id else "index.md"
    rel_path = f"areas/{area_slug}/{filename}"
    file_path = paths.root / rel_path
    topic = TopicRecord(
        id=topic_id,
        title=title,
        level=level,
        parent=parent_id,
        path=rel_path,
        status=DesignStatus.scaffolded,
        review_state=ReviewState.accepted,
        proposal_state=ProposalState.promoted_to_scaffold,
        created_at=date.today(),
        updated_at=date.today(),
    )
    body = _TOPIC_TEMPLATE.format(title=title)
    file_path.write_text(dump_topic_file(topic, body))
    manifest = load_manifest(paths)
    manifest.topics.append(topic)
    if parent_id is None:
        manifest.root_areas.append(topic)
    save_manifest(paths, manifest)
    return topic

def list_topics(paths: ProjectPaths) -> list[TopicRecord]:
    manifest = load_manifest(paths)
    return manifest.root_areas + manifest.topics

def get_topic(paths: ProjectPaths, topic_id: str) -> tuple[TopicRecord, str]:
    manifest = load_manifest(paths)
    for t in manifest.root_areas + manifest.topics:
        if t.id == topic_id:
            text = (paths.root / t.path).read_text()
            topic, body = load_topic_file(text)
            return topic, body
    raise KeyError(topic_id)
```

Add `list` and `show` commands in `cli.py` that print topic IDs and frontmatter summary.

- [ ] **Step 4: Run tests — expect PASS**

Run: `pytest tests/core/test_topic_store.py -v`

- [ ] **Step 5: Commit**

```bash
git add strataforge/core/topic_store.py strataforge/cli.py tests/core/test_topic_store.py
git commit -m "feat: add topic scaffold creation, list, and show"
```

---

### Task 7: Validation engine and `strata validate`

**Files:**
- Create: `strataforge/core/validation.py`
- Modify: `strataforge/cli.py`
- Test: `tests/core/test_validation.py`

- [ ] **Step 1: Write failing validation tests**

```python
# tests/core/test_validation.py
from pathlib import Path
from strataforge.core.manifest import init_project
from strataforge.core.paths import ProjectPaths
from strataforge.core.topic_store import create_topic_scaffold
from strataforge.core.validation import validate_project, ValidationIssue

def test_validate_catches_missing_parent_file(tmp_path: Path):
    root = tmp_path / "p"
    init_project(root, "P")
    paths = ProjectPaths(root)
    create_topic_scaffold(paths, topic_id="topic:child", title="Child", area_slug="01-x", parent_id="topic:missing", level="leaf")
    issues = validate_project(paths)
    assert any(i.code == "parent_not_found" for i in issues)

def test_validate_passes_clean_project(tmp_path: Path):
    root = tmp_path / "p"
    init_project(root, "P")
    paths = ProjectPaths(root)
    parent = create_topic_scaffold(paths, topic_id="topic:runtime", title="Runtime", area_slug="01-runtime", parent_id=None, level="area")
    create_topic_scaffold(paths, topic_id="topic:runtime.gates", title="Gates", area_slug="01-runtime", parent_id=parent.id, level="leaf")
    issues = validate_project(paths)
    assert issues == []
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `pytest tests/core/test_validation.py -v`

- [ ] **Step 3: Implement validation**

```python
# strataforge/core/validation.py
from dataclasses import dataclass
from pathlib import Path
from strataforge.core.paths import ProjectPaths
from strataforge.core.manifest import load_manifest
from strataforge.core.status import DesignStatus, ReviewState, ProposalState

@dataclass
class ValidationIssue:
    code: str
    message: str
    topic_id: str | None = None

_VALID_STATUS = {s.value for s in DesignStatus}
_VALID_REVIEW = {s.value for s in ReviewState}
_VALID_PROPOSAL = {s.value for s in ProposalState}

def validate_project(paths: ProjectPaths) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    manifest = load_manifest(paths)
    all_topics = {t.id: t for t in manifest.root_areas + manifest.topics}
    seen_ids: set[str] = set()

    for topic in all_topics.values():
        if topic.id in seen_ids:
            issues.append(ValidationIssue("duplicate_id", f"Duplicate topic id {topic.id}", topic.id))
        seen_ids.add(topic.id)
        file_path = paths.root / topic.path
        if not file_path.exists():
            issues.append(ValidationIssue("path_missing", f"Missing file {topic.path}", topic.id))
        if topic.parent and topic.parent not in all_topics:
            issues.append(ValidationIssue("parent_not_found", f"Parent {topic.parent} not found", topic.id))
        if topic.status.value not in _VALID_STATUS:
            issues.append(ValidationIssue("invalid_status", f"Invalid status {topic.status}", topic.id))
        for dep in topic.depends_on:
            if dep not in all_topics and not dep.startswith("external:"):
                issues.append(ValidationIssue("dependency_missing", f"Dependency {dep} missing", topic.id))
    return issues
```

CLI: `strata validate <path>` prints issues and exits 1 if any.

- [ ] **Step 4: Run tests — expect PASS**

Run: `pytest tests/core/test_validation.py -v`

- [ ] **Step 5: Commit**

```bash
git add strataforge/core/validation.py strataforge/cli.py tests/core/test_validation.py
git commit -m "feat: add project validation and strata validate command"
```

---

### Task 8: Session and proposal stores

**Files:**
- Create: `strataforge/core/session_store.py`
- Create: `strataforge/core/proposal_store.py`
- Modify: `strataforge/cli.py`
- Test: `tests/core/test_session_proposal.py`

- [ ] **Step 1: Write failing session/proposal test**

```python
# tests/core/test_session_proposal.py
from pathlib import Path
from datetime import datetime, timezone
from strataforge.core.manifest import init_project
from strataforge.core.paths import ProjectPaths
from strataforge.core.session_store import create_session, load_session
from strataforge.core.proposal_store import add_proposal, set_proposal_action

def test_proposal_accept_records_human_review(tmp_path: Path):
    init_project(tmp_path / "p", "P")
    paths = ProjectPaths(tmp_path / "p")
    now = datetime.now(timezone.utc)
    session = create_session(paths, title="Intake", mode="intake", created_at=now)
    proposal = add_proposal(
        paths,
        session_id=session.id,
        kind="create_component",
        title="Session Runtime",
        proposed_changes={"create_topics": [{"id": "topic:session-runtime", "title": "Session Runtime"}]},
    )
    updated = set_proposal_action(paths, proposal.id, action="accept", note="looks good", reviewed_at=now)
    assert updated.state.value == "accepted"
    assert updated.human_review["action"] == "accept"
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `pytest tests/core/test_session_proposal.py -v`

- [ ] **Step 3: Implement stores**

Session files: `sessions/{date}-{slug}.json` + optional `.md` summary.

Proposal files: embedded in session JSON list, or `sessions/proposals/{id}.json` — pick one approach and stay consistent. Recommended: proposals array inside session JSON file.

```python
# strataforge/core/session_store.py
import json
from datetime import datetime
from pathlib import Path
from strataforge.core.paths import ProjectPaths
from strataforge.models import DesignSession

def _session_path(paths: ProjectPaths, session_id: str) -> Path:
    slug = session_id.split(":", 1)[-1]
    return paths.sessions_dir / f"{slug}.json"

def create_session(paths: ProjectPaths, *, title: str, mode: str, created_at: datetime, topic_id: str | None = None) -> DesignSession:
    slug = created_at.date().isoformat() + "-" + title.lower().replace(" ", "-")[:40]
    session = DesignSession(
        id=f"session:{slug}",
        project_id=load_manifest(paths).project_id,  # import load_manifest
        title=title,
        topic_id=topic_id,
        mode=mode,
        created_at=created_at,
        updated_at=created_at,
    )
    _session_path(paths, session.id).write_text(session.model_dump_json(indent=2))
    return session

def load_session(paths: ProjectPaths, session_id: str) -> DesignSession:
    return DesignSession.model_validate_json(_session_path(paths, session_id).read_text())
```

Implement `proposal_store.py` with `add_proposal`, `set_proposal_action` (accept/reject/defer/out-of-scope/revise), updating `Proposal.state` and `human_review` timestamps.

CLI commands:
- `strata session start --project PATH --title TITLE [--mode intake]`
- `strata session import-proposals SESSION_ID --file proposals.json`

- [ ] **Step 4: Run tests — expect PASS**

Run: `pytest tests/core/test_session_proposal.py -v`

- [ ] **Step 5: Commit**

```bash
git add strataforge/core/session_store.py strataforge/core/proposal_store.py strataforge/cli.py tests/core/test_session_proposal.py
git commit -m "feat: add session and proposal persistence with human actions"
```

---

### Task 9: Apply engine (safe scaffold writes)

**Files:**
- Create: `strataforge/core/apply_engine.py`
- Modify: `strataforge/cli.py` (`apply`)
- Test: `tests/core/test_apply_engine.py`
- Create: `fixtures/session_proposals.json`

- [ ] **Step 1: Write failing apply tests**

```python
# tests/core/test_apply_engine.py
from pathlib import Path
from datetime import datetime, timezone
from strataforge.core.manifest import init_project
from strataforge.core.paths import ProjectPaths
from strataforge.core.session_store import create_session
from strataforge.core.proposal_store import add_proposal, set_proposal_action
from strataforge.core.apply_engine import apply_session
from strataforge.core.topic_store import get_topic
from strataforge.core.status import DesignStatus

def test_apply_writes_only_accepted_scaffolds(tmp_path: Path):
    paths = ProjectPaths(tmp_path / "p")
    init_project(paths.root, "P")
    now = datetime.now(timezone.utc)
    session = create_session(paths, title="Intake", mode="intake", created_at=now)
    p_accept = add_proposal(paths, session.id, "create_component", "Session Runtime",
        proposed_changes={"area_slug": "01-session-runtime", "topic_id": "topic:session-runtime", "title": "Session Runtime", "level": "area"})
    p_reject = add_proposal(paths, session.id, "create_component", "Agent Runtime",
        proposed_changes={"area_slug": "09-agent", "topic_id": "topic:agent-runtime", "title": "Agent Runtime", "level": "area"})
    set_proposal_action(paths, p_accept.id, "accept", "", now)
    set_proposal_action(paths, p_reject.id, "reject", "defer v1", now)
    created = apply_session(paths, session.id, force=False)
    assert len(created) == 1
    assert created[0].id == "topic:session-runtime"

def test_apply_refuses_overwrite_expanded_without_force(tmp_path: Path):
    paths = ProjectPaths(tmp_path / "p")
    init_project(paths.root, "P")
    now = datetime.now(timezone.utc)
    session = create_session(paths, title="Intake", mode="intake", created_at=now)
    topic = create_topic_scaffold(
        paths,
        topic_id="topic:session-runtime",
        title="Session Runtime",
        area_slug="01-session-runtime",
        parent_id=None,
        level="area",
    )
    topic_path = paths.root / topic.path
    text = topic_path.read_text().replace("status: scaffolded", "status: expanded")
    topic_path.write_text(text)
    proposal = add_proposal(
        paths,
        session.id,
        "create_component",
        "Session Runtime",
        proposed_changes={
            "area_slug": "01-session-runtime",
            "topic_id": "topic:session-runtime",
            "title": "Session Runtime",
            "level": "area",
        },
    )
    set_proposal_action(paths, proposal.id, "accept", "", now)
    import pytest
    from strataforge.core.apply_engine import ApplyConflictError
    with pytest.raises(ApplyConflictError):
        apply_session(paths, session.id, force=False)
    apply_session(paths, session.id, force=True)
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `pytest tests/core/test_apply_engine.py -v`

- [ ] **Step 3: Implement apply engine**

Rules (spec §32.1):
- Only proposals with `state == accepted` and `kind == create_component` create scaffolds.
- If topic file exists and `status != scaffolded`, raise `ApplyConflictError` unless `force=True`.
- Rejected/deferred/out-of-scope: no file writes; remain in session log only.
- Update proposal `state` to `promoted_to_scaffold` after successful write.

```python
# strataforge/core/apply_engine.py
class ApplyConflictError(Exception):
    pass

def apply_session(paths: ProjectPaths, session_id: str, *, force: bool = False) -> list[TopicRecord]:
    session = load_session(paths, session_id)
    created: list[TopicRecord] = []
    for proposal_id in session.proposals:
        proposal = load_proposal(paths, proposal_id)
        if proposal.state != ProposalState.accepted:
            continue
        if proposal.kind != "create_component":
            continue
        changes = proposal.proposed_changes
        topic_id = changes["topic_id"]
        existing = try_get_topic(paths, topic_id)
        if existing and existing.status != DesignStatus.scaffolded and not force:
            raise ApplyConflictError(f"{topic_id} is {existing.status}, use --force")
        topic = create_topic_scaffold(
            paths,
            topic_id=topic_id,
            title=changes["title"],
            area_slug=changes["area_slug"],
            parent_id=changes.get("parent_id"),
            level=changes.get("level", "area"),
        )
        promote_proposal(paths, proposal.id)
        created.append(topic)
    return created
```

CLI: `strata apply <session-id> --project PATH [--force]`

- [ ] **Step 4: Run tests — expect PASS**

Run: `pytest tests/core/test_apply_engine.py -v`

- [ ] **Step 5: Commit**

```bash
git add strataforge/core/apply_engine.py fixtures/session_proposals.json tests/core/test_apply_engine.py strataforge/cli.py
git commit -m "feat: add gated apply engine with overwrite protection"
```

---

### Task 10: Manual proposal import and intake paste

**Files:**
- Create: `strataforge/llm/manual_import.py`
- Create: `fixtures/intake_proposals.json`
- Modify: `strataforge/cli.py`
- Test: `tests/llm/test_manual_import.py`

- [ ] **Step 1: Write failing import test**

```python
# tests/llm/test_manual_import.py
import json
from pathlib import Path
from strataforge.llm.manual_import import parse_proposal_bundle

def test_parse_intake_proposal_bundle():
    raw = Path("fixtures/intake_proposals.json").read_text()
    bundle = parse_proposal_bundle(json.loads(raw))
    assert bundle["session_mode"] == "intake"
    assert len(bundle["proposals"]) >= 2
    assert bundle["proposals"][0]["kind"] == "create_component"
```

Fixture `fixtures/intake_proposals.json` (structured output from spec §15.4 style):

```json
{
  "session_mode": "intake",
  "summary": "Top-level components for StrataForge",
  "proposals": [
    {
      "kind": "create_component",
      "title": "Session Runtime",
      "summary": "Gated design sessions",
      "rationale": "Core loop",
      "proposed_changes": {
        "area_slug": "01-session-runtime",
        "topic_id": "topic:session-runtime",
        "title": "Session Runtime",
        "level": "area"
      }
    },
    {
      "kind": "create_component",
      "title": "Topic Scaffold Store",
      "summary": "File-backed topic store",
      "rationale": "Source of truth",
      "proposed_changes": {
        "area_slug": "02-topic-store",
        "topic_id": "topic:topic-store",
        "title": "Topic Scaffold Store",
        "level": "area"
      }
    }
  ]
}
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `pytest tests/llm/test_manual_import.py -v`

- [ ] **Step 3: Implement import + CLI**

`parse_proposal_bundle` normalizes LLM JSON into internal proposal dicts.
`strata session import-proposals <session-id> --file <json> --project PATH` creates `Proposal` records linked to session.

Store intake `source_prompt` on session `inputs.source_prompt` when user runs:
`strata session set-input <session-id> --prompt-file intake.md`

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add strataforge/llm/manual_import.py fixtures/intake_proposals.json tests/llm/ strataforge/cli.py
git commit -m "feat: add manual proposal JSON import for intake sessions"
```

---

### Task 11: Prompt generation (expand + reconcile)

**Files:**
- Create: `strataforge/llm/prompts.py`
- Modify: `strataforge/cli.py`
- Test: `tests/llm/test_prompts.py`

- [ ] **Step 1: Write failing prompt test**

```python
# tests/llm/test_prompts.py
from pathlib import Path
from strataforge.core.manifest import init_project
from strataforge.core.paths import ProjectPaths
from strataforge.core.topic_store import create_topic_scaffold
from strataforge.llm.prompts import build_expansion_prompt, build_reconciliation_prompt

def test_expansion_prompt_includes_topic_and_parent(tmp_path: Path):
    paths = ProjectPaths(tmp_path / "p")
    init_project(paths.root, "P")
    parent = create_topic_scaffold(paths, topic_id="topic:runtime", title="Runtime", area_slug="01-runtime", parent_id=None, level="area")
    child = create_topic_scaffold(paths, topic_id="topic:runtime.gates", title="Gates", area_slug="01-runtime", parent_id=parent.id, level="leaf")
    prompt = build_expansion_prompt(paths, child.id)
    assert "topic:runtime.gates" in prompt
    assert "topic:runtime" in prompt
    assert "Do not redesign unrelated areas" in prompt
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `pytest tests/llm/test_prompts.py -v`

- [ ] **Step 3: Implement prompt builders**

Use spec §25.1 and §25.2 text literally in templates. Load bounded context only:
- manifest summary (ids + titles)
- current topic body
- parent topic (if any)
- direct children titles
- sibling one-liners (first heading line only)

```python
def build_expansion_prompt(paths: ProjectPaths, topic_id: str) -> str: ...
def build_reconciliation_prompt(paths: ProjectPaths, topic_id: str) -> str: ...
```

CLI:
- `strata prompt expand <topic-id> --project PATH`
- `strata prompt reconcile-parent <topic-id> --project PATH`

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add strataforge/llm/prompts.py tests/llm/test_prompts.py strataforge/cli.py
git commit -m "feat: add bounded expansion and reconciliation prompt generation"
```

---

### Task 12: Coherence radar (deterministic)

**Files:**
- Create: `strataforge/llm/coherence.py`
- Modify: `strataforge/cli.py` (`radar`, `gaps`, `status`)
- Test: `tests/llm/test_coherence.py`

- [ ] **Step 1: Write failing radar scoring test**

```python
# tests/llm/test_coherence.py
from datetime import date, timedelta
from strataforge.llm.coherence import score_topic, scan_project
from strataforge.models import TopicRecord, CoverageFlags
from strataforge.core.status import DesignStatus, ReviewState

def test_score_increases_with_open_questions_and_dependency():
    topic = TopicRecord(
        id="topic:x", title="X", path="areas/x.md", level="leaf",
        status=DesignStatus.expanded,
        review_state=ReviewState.needs_revision,
        coverage=CoverageFlags(needs_reconciliation=True),
        depends_on=["topic:a", "topic:b", "topic:c"],
    )
    score, reasons = score_topic(topic, open_question_count=3, days_since_review=20)
    assert score >= 10
    assert "expanded_without_reconciliation" in reasons
```

Implement scoring from spec §17.5:

```python
def score_topic(topic, *, open_question_count: int, days_since_review: int | None) -> tuple[int, list[str]]:
    score = 0
    reasons = []
    dep_degree = len(topic.depends_on)
    score += dep_degree * 2
    if dep_degree >= 3:
        reasons.append("high_dependency_degree")
    score += open_question_count
    if topic.status == DesignStatus.expanded and topic.coverage.needs_reconciliation:
        score += 5
        reasons.append("expanded_without_reconciliation")
    if topic.review_state == ReviewState.needs_revision:
        score += 5
        reasons.append("needs_revision")
    if days_since_review and days_since_review > 14:
        score += 4
        reasons.append("stale_review")
    return score, reasons
```

`scan_project` returns top N `RadarItem` sorted by score (respect `settings.radar.max_items`, default 10).

- [ ] **Step 2–4: Implement, run `pytest tests/llm/test_coherence.py -v`, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add strataforge/llm/coherence.py tests/llm/test_coherence.py strataforge/cli.py
git commit -m "feat: add deterministic coherence radar scanner"
```

---

### Task 13: SQLite indexer (rebuildable cache)

**Files:**
- Create: `strataforge/core/indexer.py`
- Modify: `strataforge/cli.py` (`index rebuild`)
- Test: `tests/core/test_indexer.py`

- [ ] **Step 1: Write failing indexer test**

```python
# tests/core/test_indexer.py
import sqlite3
from pathlib import Path
from strataforge.core.manifest import init_project
from strataforge.core.paths import ProjectPaths
from strataforge.core.topic_store import create_topic_scaffold
from strataforge.core.indexer import rebuild_index

def test_index_rebuild_populates_topics_table(tmp_path: Path):
    root = tmp_path / "p"
    init_project(root, "P")
    paths = ProjectPaths(root)
    create_topic_scaffold(
        paths,
        topic_id="topic:runtime",
        title="Runtime",
        area_slug="01-runtime",
        parent_id=None,
        level="area",
    )
    rebuild_index(paths)
    conn = sqlite3.connect(paths.db_path)
    count = conn.execute("SELECT COUNT(*) FROM topics").fetchone()[0]
    conn.close()
    assert count == 1
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `pytest tests/core/test_indexer.py -v`

- [ ] **Step 3: Implement minimal schema**

Tables: `topics`, `sessions`, `proposals`, `radar_cache`.
`rebuild_index(paths)` walks files and upserts rows.
CLI: `strata index rebuild --project PATH`

- [ ] **Step 4: Run test — PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: add rebuildable SQLite index for fast queries"
```

---

### Task 14: FastAPI server — projects, topics, sessions, proposals

**Files:**
- Create: `strataforge/server/app.py`
- Create: `strataforge/server/deps.py`
- Create: `strataforge/server/routes_projects.py`
- Create: `strataforge/server/routes_topics.py`
- Create: `strataforge/server/routes_sessions.py`
- Create: `strataforge/server/routes_proposals.py`
- Test: `tests/server/test_api_smoke.py`

- [ ] **Step 1: Write failing API smoke test**

```python
# tests/server/test_api_smoke.py
from fastapi.testclient import TestClient
from pathlib import Path
from strataforge.server.app import create_app

def test_list_projects_empty(tmp_path: Path, monkeypatch):
    monkeypatch.setenv("STRATA_WORKSPACE_ROOT", str(tmp_path))
    client = TestClient(create_app())
    r = client.get("/api/projects")
    assert r.status_code == 200
    assert r.json() == []
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement routes per spec §21.1–21.4**

Minimum endpoints for MVP UI:

| Method | Path | Maps to |
|--------|------|---------|
| GET | `/api/projects` | List workspace dirs with `strata.yaml` |
| POST | `/api/projects` | `init` equivalent |
| GET | `/api/projects/{id}/topics` | Tree nodes |
| GET | `/api/projects/{id}/topics/{topic_id}` | Topic + body |
| PUT | `/api/projects/{id}/topics/{topic_id}` | Update review_state, status, coverage |
| POST | `/api/projects/{id}/sessions` | Start session |
| GET | `/api/projects/{id}/sessions/{session_id}` | Session + proposals |
| POST | `/api/projects/{id}/sessions/{session_id}/import` | Manual proposal JSON |
| POST | `/api/projects/{id}/proposals/{proposal_id}/accept` | Human gate |
| POST | `/api/projects/{id}/proposals/{proposal_id}/reject` | Human gate |
| POST | `/api/projects/{id}/proposals/{proposal_id}/defer` | Human gate |
| POST | `/api/projects/{id}/sessions/{session_id}/apply` | Apply engine |
| GET | `/api/projects/{id}/topics/{topic_id}/prompts/{command}` | expand / reconcile-parent |
| GET | `/api/projects/{id}/radar` | Radar list |
| POST | `/api/projects/{id}/radar/scan` | Recompute + cache `radar/latest.json` |

Run server: `uvicorn strataforge.server.app:create_app --factory --host 127.0.0.1 --port 8787`

- [ ] **Step 4: Run `pytest tests/server/test_api_smoke.py -v` — PASS**

- [ ] **Step 5: Commit**

```bash
git add strataforge/server/ tests/server/
git commit -m "feat: add FastAPI routes for MVP project/session/proposal flow"
```

---

### Task 15: React UI scaffold

**Files:**
- Create: `strataforge/ui/package.json`
- Create: `strataforge/ui/vite.config.ts`
- Create: `strataforge/ui/index.html`
- Create: `strataforge/ui/src/main.tsx`
- Create: `strataforge/ui/src/App.tsx`
- Create: `strataforge/ui/src/api.ts`

- [ ] **Step 1: Scaffold Vite React TS app**

Run:
```bash
cd /mnt/scripts/strataforge/strataforge/ui
npm create vite@latest . -- --template react-ts
npm install
```

- [ ] **Step 2: Add API client**

```typescript
// strataforge/ui/src/api.ts
const API_BASE = import.meta.env.VITE_STRATA_API_BASE ?? "http://127.0.0.1:8787";

export async function listProjects() {
  const r = await fetch(`${API_BASE}/api/projects`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
```

- [ ] **Step 3: Verify dev server starts**

Run: `npm run dev` (port 5173) with API on 8787
Expected: blank app loads without console errors

- [ ] **Step 4: Commit**

```bash
git add strataforge/ui/
git commit -m "feat: scaffold React UI with API client"
```

---

### Task 16: Atlas Tree component

**Files:**
- Create: `strataforge/ui/src/components/AtlasTree.tsx`
- Create: `strataforge/ui/src/components/ProjectShell.tsx`
- Modify: `strataforge/ui/src/App.tsx`

- [ ] **Step 1: Implement tree from `/api/projects/{id}/topics`**

Display hierarchical nodes by `parent` field. Clicking a node sets `selectedTopicId` in app state.

- [ ] **Step 2: Manual test**

1. `strata init workspaces/demo --title Demo`
2. Import + apply intake fixtures
3. Open UI — tree shows accepted areas

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(ui): add atlas tree navigation"
```

---

### Task 17: Topic Detail panel

**Files:**
- Create: `strataforge/ui/src/components/TopicEditor.tsx`

- [ ] **Step 1: Render topic header**

Show: title, `status`, `review_state`, coverage badges (from spec §18.3).

- [ ] **Step 2: Editable gates for status/coverage**

PUT to API on change:
- Mark out of scope → `review_state: out_of_scope`, `coverage.out_of_scope: true`
- Needs design → `coverage.needs_design: true`
- Execution ready → `status: execution_ready` (server validates promotion rules)

- [ ] **Step 3: Show markdown body (read-only in MVP)**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(ui): add topic detail with status and coverage controls"
```

---

### Task 18: Session Panel + Proposal Cards

**Files:**
- Create: `strataforge/ui/src/components/SessionPanel.tsx`
- Create: `strataforge/ui/src/components/ProposalCard.tsx`
- Create: `strataforge/ui/src/components/PairingPlane.tsx`

- [ ] **Step 1: Intake paste flow**

Center panel:
- Textarea for architecture idea → saves to session `inputs.source_prompt`
- Button "Generate intake prompt" → copies CLI-equivalent instructions for external LLM
- Textarea "Paste proposal JSON" → POST import
- Lists `ProposalCard` for each proposal

- [ ] **Step 2: Proposal card actions**

Buttons wired to API:
- Accept → `POST .../accept`
- Reject → `POST .../reject`
- Defer → `POST .../defer`
- Out of scope → `POST .../out-of-scope`

- [ ] **Step 3: Apply session button**

`POST .../sessions/{id}/apply` then refresh tree.
Show error toast if overwrite blocked (expanded topic exists).

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(ui): add session panel with proposal review and apply"
```

---

### Task 19: Coherence Radar panel

**Files:**
- Create: `strataforge/ui/src/components/CoherenceRadar.tsx`

- [ ] **Step 1: Fetch `/api/projects/{id}/radar`**

Render ranked list: title, severity, summary, recommended commands (spec §17.4).

- [ ] **Step 2: Scan button**

Calls `POST .../radar/scan`, refreshes list.

- [ ] **Step 3: Click radar item selects topic in tree**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(ui): add coherence radar panel"
```

---

### Task 20: Docker Compose and README

**Files:**
- Create: `docker-compose.yml`
- Create: `Dockerfile`
- Create: `strataforge/ui/Dockerfile`
- Create: `README.md`

- [ ] **Step 1: Add root Dockerfile (API)**

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY pyproject.toml .
COPY strataforge ./strataforge
RUN pip install .
ENV STRATA_WORKSPACE_ROOT=/app/workspaces
CMD ["uvicorn", "strataforge.server.app:create_app", "--factory", "--host", "0.0.0.0", "--port", "8787"]
```

- [ ] **Step 2: Add docker-compose per spec §23.1**

API :8787, UI :8788, mount `./workspaces` and `./.strata`.

- [ ] **Step 3: README quickstart**

Document MVP walkthrough from spec §35 (init → intake → import → accept → apply → radar → prompt).

- [ ] **Step 4: Verify compose up**

Run: `docker compose up --build`
Expected: UI at http://localhost:8788, API at http://localhost:8787/health

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml Dockerfile README.md strataforge/ui/Dockerfile
git commit -m "docs: add docker compose and MVP quickstart"
```

---

### Task 21: End-to-end golden walkthrough test

**Files:**
- Create: `tests/e2e/test_mvp_walkthrough.py`
- Uses: `fixtures/intake_proposals.json`

- [ ] **Step 1: Write E2E test covering acceptance criteria (spec §28.4)**

```python
def test_mvp_walkthrough(tmp_path):
    # 1. init project
    # 2. start intake session, set source prompt
    # 3. import proposals
    # 4. accept 2, reject 1, defer 1
    # 5. apply session -> exactly 2 topic files
    # 6. validate passes
    # 7. radar returns >=1 item after marking one topic expanded+needs_reconciliation
    # 8. expansion prompt contains topic id
    # 9. apply again without force does NOT truncate expanded body
```

- [ ] **Step 2: Run E2E — expect PASS**

Run: `pytest tests/e2e/test_mvp_walkthrough.py -v`

- [ ] **Step 3: Commit**

```bash
git commit -m "test: add MVP end-to-end walkthrough coverage"
```

---

## MVP Acceptance Criteria Traceability

| Criterion (spec §28.4) | Task(s) |
|------------------------|---------|
| Initialize project workspace | Task 5, 20 |
| Paste high-level design idea | Task 10, 18 |
| Proposal cards for top-level components | Task 8, 10, 18 |
| Approve/reject/revise proposals | Task 8, 14, 18 |
| Only approved → Markdown scaffolds | Task 9 |
| Browse tree visually | Task 16 |
| Select node, bounded LLM prompt | Task 11, 17 |
| Mark out of scope / needs design / execution ready | Task 17 |
| Basic radar queue | Task 12, 19 |
| No overwrite expanded without force | Task 9, 21 |
| `strata validate` | Task 7 |
| `strata radar` | Task 12 |

## Explicitly Deferred (post-MVP)

- MCP server (spec §37.1)
- Autonomous agent runtime (spec §28.3, Phase 8)
- Full IDE bridge / commit linking (Phase 6) — only prompt copy in MVP
- Skill packs (Phase 7)
- React Flow dependency graph (spec §18.6)
- Background worker (spec §22.2)
- Vector search (spec §4.7)
- Multi-user auth (spec §28.3)

---

## Self-Review

**1. Spec coverage:** MVP §28.2 capabilities map to Tasks 5–21. Build Phases 0–5 from spec §29 are covered. Manual LLM mode (spec §22.4) covered in Tasks 10–11, 18. Gate model (spec §12) enforced in Tasks 8–9. File-first source of truth (spec §9) in Tasks 5–9, 13.

**2. Placeholder scan:** No TBD steps in task actions; fixture bodies use minimal but complete scaffold sections.

**3. Type consistency:** `TopicRecord`, `Proposal`, `DesignSession`, `RadarItem` defined once in Task 3 and reused throughout. CLI and API call the same core modules (`apply_engine`, `proposal_store`, `coherence.scan_project`).

**Gaps fixed inline:** Task 9 second test stub completed in plan instructions; indexer Task 13 kept minimal but required for UI list performance per spec §9.3.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-20-strataforge-session-v0.md`. Two execution options:

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
