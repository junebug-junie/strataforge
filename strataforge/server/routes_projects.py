import json
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from strataforge.core.ids import slugify
from strataforge.core.manifest import init_project, load_manifest
from strataforge.core.paths import ProjectPaths
from strataforge.llm.coherence import scan_project
from strataforge.server.deps import list_project_dirs, resolve_project_paths, workspace_root

router = APIRouter(prefix="/api/projects", tags=["projects"])


class ProjectSummary(BaseModel):
    project_id: str
    title: str
    path: str
    status: str = "active"


class CreateProjectRequest(BaseModel):
    title: str
    slug: str | None = None


class CreateProjectResponse(BaseModel):
    project_id: str
    title: str
    path: str


@router.get("", response_model=list[ProjectSummary])
def list_projects() -> list[ProjectSummary]:
    summaries: list[ProjectSummary] = []
    for project_dir in list_project_dirs():
        paths = ProjectPaths(project_dir)
        manifest = load_manifest(paths)
        summaries.append(
            ProjectSummary(
                project_id=manifest.project_id,
                title=manifest.title,
                path=str(project_dir),
            )
        )
    return summaries


@router.post("", response_model=CreateProjectResponse, status_code=201)
def create_project(body: CreateProjectRequest) -> CreateProjectResponse:
    root = workspace_root()
    root.mkdir(parents=True, exist_ok=True)
    slug = body.slug or slugify(body.title)
    project_dir = root / slug
    if project_dir.exists() and (project_dir / "strata.yaml").exists():
        raise HTTPException(status_code=409, detail=f"Project already exists: {slug}")
    manifest = init_project(project_dir, body.title)
    return CreateProjectResponse(
        project_id=manifest.project_id,
        title=manifest.title,
        path=str(project_dir),
    )


def _radar_cache_path(paths: ProjectPaths) -> Path:
    return paths.strata_dir / "radar" / "latest.json"


def _load_cached_radar(paths: ProjectPaths) -> list[dict] | None:
    cache = _radar_cache_path(paths)
    if not cache.exists():
        return None
    return json.loads(cache.read_text())


def _save_radar_cache(paths: ProjectPaths, items: list) -> None:
    paths.strata_dir.mkdir(parents=True, exist_ok=True)
    radar_dir = paths.strata_dir / "radar"
    radar_dir.mkdir(exist_ok=True)
    payload = [item.model_dump(mode="json") for item in items]
    _radar_cache_path(paths).write_text(json.dumps(payload, indent=2, default=str))


@router.get("/{project_id}/radar")
def get_radar(project_id: str) -> list[dict]:
    paths = resolve_project_paths(project_id)
    cached = _load_cached_radar(paths)
    if cached is not None:
        return cached
    items = scan_project(paths)
    return [item.model_dump(mode="json") for item in items]


@router.post("/{project_id}/radar/scan")
def scan_radar(project_id: str) -> list[dict]:
    paths = resolve_project_paths(project_id)
    items = scan_project(paths)
    _save_radar_cache(paths, items)
    return [item.model_dump(mode="json") for item in items]
