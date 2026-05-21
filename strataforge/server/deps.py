import os
from pathlib import Path

from fastapi import HTTPException

from strataforge.config import settings
from strataforge.core.manifest import load_manifest
from strataforge.core.paths import ProjectPaths


def workspace_root() -> Path:
    return Path(os.environ.get("STRATA_WORKSPACE_ROOT", settings.strata_workspace_root))


def list_project_dirs() -> list[Path]:
    root = workspace_root()
    if not root.exists():
        return []
    return sorted(
        p for p in root.iterdir() if p.is_dir() and (p / "strata.yaml").is_file()
    )


def resolve_project_paths(project_id: str) -> ProjectPaths:
    for project_dir in list_project_dirs():
        paths = ProjectPaths(project_dir)
        manifest = load_manifest(paths)
        if manifest.project_id == project_id or project_dir.name == project_id:
            return paths
    raise HTTPException(status_code=404, detail=f"Project not found: {project_id}")
