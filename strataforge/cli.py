from pathlib import Path

import typer

from strataforge import __version__

app = typer.Typer(no_args_is_help=True, name="strata")
session_app = typer.Typer(no_args_is_help=True)
prompt_app = typer.Typer(no_args_is_help=True)
index_app = typer.Typer(no_args_is_help=True)
app.add_typer(session_app, name="session")
app.add_typer(prompt_app, name="prompt")
app.add_typer(index_app, name="index")


@app.callback(invoke_without_command=True)
def main(version: bool = typer.Option(False, "--version", help="Show version")):
    if version:
        typer.echo(f"strata {__version__}")
        raise typer.Exit()


@app.command("hello")
def hello():
    typer.echo("StrataForge CLI ready")


@app.command("init")
def init_cmd(
    path: str,
    title: str = typer.Option("Untitled Project", "--title"),
):
    from strataforge.core.manifest import init_project

    manifest = init_project(Path(path), title)
    typer.echo(f"Initialized {manifest.project_id} at {path}")


@app.command("list")
def list_cmd(path: str = "."):
    from strataforge.core.paths import ProjectPaths
    from strataforge.core.topic_store import list_topics

    paths = ProjectPaths(Path(path))
    for topic in list_topics(paths):
        typer.echo(
            f"{topic.id}\t{topic.title}\t{topic.status.value}\t{topic.review_state.value}"
        )


@app.command("show")
def show_cmd(topic_id: str, path: str = "."):
    from strataforge.core.paths import ProjectPaths
    from strataforge.core.topic_store import get_topic

    paths = ProjectPaths(Path(path))
    try:
        topic, _body = get_topic(paths, topic_id)
    except KeyError:
        typer.echo(f"Topic not found: {topic_id}", err=True)
        raise typer.Exit(1)
    typer.echo(f"id: {topic.id}")
    typer.echo(f"title: {topic.title}")
    typer.echo(f"level: {topic.level}")
    typer.echo(f"parent: {topic.parent}")
    typer.echo(f"path: {topic.path}")
    typer.echo(f"status: {topic.status.value}")
    typer.echo(f"review_state: {topic.review_state.value}")
    typer.echo(f"proposal_state: {topic.proposal_state.value}")


@app.command("validate")
def validate_cmd(path: str = "."):
    from strataforge.core.paths import ProjectPaths
    from strataforge.core.validation import validate_project

    paths = ProjectPaths(Path(path))
    issues = validate_project(paths)
    if not issues:
        typer.echo("No validation issues found.")
        return
    for issue in issues:
        topic = f" ({issue.topic_id})" if issue.topic_id else ""
        typer.echo(f"{issue.code}{topic}: {issue.message}", err=True)
    raise typer.Exit(1)


@session_app.command("start")
def session_start(
    project: Path = typer.Option(..., "--project", help="Project root path"),
    title: str = typer.Option(..., "--title", help="Session title"),
    mode: str = typer.Option("intake", "--mode", help="Session mode"),
):
    from datetime import datetime, timezone

    from strataforge.core.paths import ProjectPaths
    from strataforge.core.session_store import create_session

    paths = ProjectPaths(project)
    session = create_session(
        paths,
        title=title,
        mode=mode,
        created_at=datetime.now(timezone.utc),
    )
    typer.echo(f"Started {session.id}")


@session_app.command("import-proposals")
def session_import_proposals(
    session_id: str,
    file: Path = typer.Option(..., "--file", help="Proposal bundle JSON file"),
    project: Path = typer.Option(..., "--project", help="Project root path"),
):
    import json

    from strataforge.core.paths import ProjectPaths
    from strataforge.core.proposal_store import add_proposal
    from strataforge.llm.manual_import import parse_proposal_bundle

    paths = ProjectPaths(project)
    bundle = parse_proposal_bundle(json.loads(file.read_text()))
    count = 0
    for item in bundle["proposals"]:
        add_proposal(
            paths,
            session_id=session_id,
            kind=item["kind"],
            title=item["title"],
            summary=item.get("summary", ""),
            rationale=item.get("rationale", ""),
            proposed_changes=item.get("proposed_changes", {}),
            topic_id=item.get("topic_id"),
        )
        count += 1
    typer.echo(f"Imported {count} proposals into {session_id}")


@session_app.command("set-input")
def session_set_input(
    session_id: str,
    project: Path = typer.Option(..., "--project", help="Project root path"),
    prompt_file: Path = typer.Option(..., "--prompt-file", help="Intake prompt markdown file"),
):
    from datetime import datetime, timezone

    from strataforge.core.paths import ProjectPaths
    from strataforge.core.session_store import load_session, save_session

    paths = ProjectPaths(project)
    session = load_session(paths, session_id)
    session.inputs["source_prompt"] = prompt_file.read_text()
    session.updated_at = datetime.now(timezone.utc)
    save_session(paths, session)
    typer.echo(f"Stored source prompt on {session_id}")


@prompt_app.command("expand")
def prompt_expand(
    topic_id: str,
    project: Path = typer.Option(..., "--project", help="Project root path"),
):
    from strataforge.core.paths import ProjectPaths
    from strataforge.llm.prompts import build_expansion_prompt

    paths = ProjectPaths(project)
    try:
        typer.echo(build_expansion_prompt(paths, topic_id))
    except KeyError:
        typer.echo(f"Topic not found: {topic_id}", err=True)
        raise typer.Exit(1)


@prompt_app.command("reconcile-parent")
def prompt_reconcile_parent(
    topic_id: str,
    project: Path = typer.Option(..., "--project", help="Project root path"),
):
    from strataforge.core.paths import ProjectPaths
    from strataforge.llm.prompts import build_reconciliation_prompt

    paths = ProjectPaths(project)
    try:
        typer.echo(build_reconciliation_prompt(paths, topic_id))
    except KeyError:
        typer.echo(f"Topic not found: {topic_id}", err=True)
        raise typer.Exit(1)


@app.command("radar")
def radar_cmd(path: str = "."):
    from strataforge.core.paths import ProjectPaths
    from strataforge.llm.coherence import scan_project

    paths = ProjectPaths(Path(path))
    items = scan_project(paths)
    if not items:
        typer.echo("No coherence pressure detected.")
        return
    for item in items:
        reasons = ",".join(item.reason_codes)
        typer.echo(
            f"{item.score}\t{item.severity}\t{item.topic_id}\t{item.title}\t{reasons}"
        )


@app.command("status")
def status_cmd(path: str = "."):
    from strataforge.core.manifest import load_manifest
    from strataforge.core.paths import ProjectPaths
    from strataforge.llm.coherence import project_status_counts

    paths = ProjectPaths(Path(path))
    manifest = load_manifest(paths)
    typer.echo(f"project: {manifest.project_id}")
    typer.echo(f"title: {manifest.title}")
    counts = project_status_counts(paths)
    if not counts:
        typer.echo("topics: 0")
        return
    typer.echo(f"topics: {sum(counts.values())}")
    for status, count in sorted(counts.items()):
        typer.echo(f"  {status}: {count}")


@app.command("gaps")
def gaps_cmd(path: str = "."):
    from strataforge.core.paths import ProjectPaths
    from strataforge.llm.coherence import project_gaps

    paths = ProjectPaths(Path(path))
    gaps = project_gaps(paths)
    if not gaps:
        typer.echo("No design gaps flagged.")
        return
    for category, topic_ids in sorted(gaps.items()):
        typer.echo(f"{category}:")
        for topic_id in topic_ids:
            typer.echo(f"  - {topic_id}")


@index_app.command("rebuild")
def index_rebuild(
    project: Path = typer.Option(..., "--project", help="Project root path"),
):
    from strataforge.core.indexer import rebuild_index
    from strataforge.core.paths import ProjectPaths

    paths = ProjectPaths(project)
    rebuild_index(paths)
    typer.echo(f"Rebuilt index at {paths.db_path}")


@app.command("apply")
def apply_cmd(
    session_id: str,
    project: Path = typer.Option(..., "--project", help="Project root path"),
    force: bool = typer.Option(False, "--force", help="Overwrite non-scaffolded topics"),
):
    from strataforge.core.apply_engine import ApplyConflictError, apply_session
    from strataforge.core.paths import ProjectPaths

    paths = ProjectPaths(project)
    try:
        created = apply_session(paths, session_id, force=force)
    except ApplyConflictError as exc:
        typer.echo(str(exc), err=True)
        raise typer.Exit(1)
    for topic in created:
        typer.echo(f"Created scaffold {topic.id} at {topic.path}")
    if not created:
        typer.echo("No accepted create_component proposals to apply.")
