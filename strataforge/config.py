from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    strata_workspace_root: str = "/mnt/scripts/strataforge/workspaces"
    strata_db_path: str = "/mnt/scripts/strataforge/.strata/strata.db"
    strata_host: str = "127.0.0.1"
    strata_port: int = 8787
    strata_llm_provider: str = "manual"
    strata_require_human_gate_for_writes: bool = True


settings = Settings()
