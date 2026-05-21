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
