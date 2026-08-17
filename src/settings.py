import os

from dotenv import load_dotenv
from pydantic import BaseModel

REQUIRED = ("ADZUNA_APP_ID", "ADZUNA_APP_KEY", "GOOGLE_API_KEY")


class Settings(BaseModel):
    adzuna_app_id: str
    adzuna_app_key: str
    google_api_key: str
    tavily_api_key: str = ""
    rapidapi_key: str = ""


def load_settings(required: tuple[str, ...] = REQUIRED) -> Settings:
    load_dotenv()
    missing = [k for k in required if not os.getenv(k)]
    if missing:
        raise SystemExit(
            f"Missing required keys in .env: {', '.join(missing)}. "
            f"Copy .env.example to .env and fill them in.")
    return Settings(
        adzuna_app_id=os.getenv("ADZUNA_APP_ID", ""),
        adzuna_app_key=os.getenv("ADZUNA_APP_KEY", ""),
        google_api_key=os.getenv("GOOGLE_API_KEY", ""),
        tavily_api_key=os.getenv("TAVILY_API_KEY", ""),
        rapidapi_key=os.getenv("RAPIDAPI_KEY", ""),
    )
