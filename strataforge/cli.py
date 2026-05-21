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
