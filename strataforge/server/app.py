from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from strataforge.server.routes_projects import router as projects_router
from strataforge.server.routes_proposals import router as proposals_router
from strataforge.server.routes_sessions import router as sessions_router
from strataforge.server.routes_topics import router as topics_router


def create_app() -> FastAPI:
    app = FastAPI(title="StrataForge API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(projects_router)
    app.include_router(topics_router)
    app.include_router(sessions_router)
    app.include_router(proposals_router)
    return app
