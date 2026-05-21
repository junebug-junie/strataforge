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
