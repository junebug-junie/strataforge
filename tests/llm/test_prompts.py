from pathlib import Path

from strataforge.core.manifest import init_project
from strataforge.core.paths import ProjectPaths
from strataforge.core.topic_store import create_topic_scaffold
from strataforge.llm.prompts import build_expansion_prompt, build_reconciliation_prompt


def test_expansion_prompt_includes_topic_and_parent(tmp_path: Path):
    paths = ProjectPaths(tmp_path / "p")
    init_project(paths.root, "P")
    parent = create_topic_scaffold(
        paths,
        topic_id="topic:runtime",
        title="Runtime",
        area_slug="01-runtime",
        parent_id=None,
        level="area",
    )
    child = create_topic_scaffold(
        paths,
        topic_id="topic:runtime.gates",
        title="Gates",
        area_slug="01-runtime",
        parent_id=parent.id,
        level="leaf",
    )
    prompt = build_expansion_prompt(paths, child.id)
    assert "topic:runtime.gates" in prompt
    assert "topic:runtime" in prompt
    assert "Do not redesign unrelated areas" in prompt
