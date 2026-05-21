from pathlib import Path

import yaml

from strataforge.core.ids import make_project_id
from strataforge.core.paths import ProjectPaths
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
    for d in [
        paths.areas_dir,
        paths.sessions_dir,
        paths.decisions_dir,
        paths.links_dir,
        paths.strata_dir,
    ]:
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
