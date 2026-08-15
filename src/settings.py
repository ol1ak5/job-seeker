import os

from dotenv import load_dotenv
from pydantic import BaseModel

REQUIRED = ("ADZUNA_APP_ID", "ADZUNA_APP_KEY", "GOOGLE_API_KEY")


class Settings(BaseModel):
    adzuna_app_id: str
    adzuna_app_key: str
    google_api_key: str


def load_settings() -> Settings:
    load_dotenv()
    missing = [k for k in REQUIRED if not os.getenv(k)]
    if missing:
        raise SystemExit(
            f"Missing required keys in .env: {', '.join(missing)}. "
            f"Copy .env.example to .env and fill them in."
        )
    return Settings(
        adzuna_app_id=os.environ["ADZUNA_APP_ID"],
        adzuna_app_key=os.environ["ADZUNA_APP_KEY"],
        google_api_key=os.environ["GOOGLE_API_KEY"],
    )
