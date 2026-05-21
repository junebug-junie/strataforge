from pathlib import Path

import typer

from strataforge import __version__

app = typer.Typer(no_args_is_help=True, name="strata")


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
