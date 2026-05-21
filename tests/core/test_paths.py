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
