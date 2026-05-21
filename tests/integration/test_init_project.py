from pathlib import Path

import yaml
from typer.testing import CliRunner

from strataforge.cli import app

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
