FROM python:3.11-slim
WORKDIR /app
COPY pyproject.toml .
COPY strataforge ./strataforge
RUN pip install .
ENV STRATA_WORKSPACE_ROOT=/app/workspaces
CMD ["uvicorn", "strataforge.server.app:create_app", "--factory", "--host", "0.0.0.0", "--port", "8787"]
