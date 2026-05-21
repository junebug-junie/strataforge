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
