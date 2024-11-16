"""Configuration for the application."""

from os import environ
from pathlib import Path
from dotenv import dotenv_values

# Check if `.env` file exists
env_path = Path(".") / ".env"

LOCAL_ENV_FILE = env_path.exists()

# Load environment variables from .env
config = dotenv_values(".env")

def get_env(key):
    """Return environment variable from .env or native environment."""
    return config.get(key) if LOCAL_ENV_FILE else environ.get(key)

