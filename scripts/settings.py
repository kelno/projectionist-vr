"""The scripts' settings, read from config.toml (config.toml.example describes each one)."""

from __future__ import annotations

import tomllib
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    # [library]: where the videos are, where their thumbnails and media info are kept, and the text cut
    # from the start of file names to make their labels.
    videos_path: Path
    thumbnails_path: Path
    name_prefixes: tuple[str, ...] = ()
    # [web]: where the web server serves the site, and the videos and thumbnails below it.
    site_url_prefix: str = "/"
    videos_url_prefix: str = "/media"
    thumbnails_url_prefix: str = "/thumbnails"


def load_settings(config_path: Path) -> Settings:
    """Read and check config.toml."""
    try:
        with config_path.open("rb") as file:
            config = tomllib.load(file)
    except FileNotFoundError:
        raise FileNotFoundError(f"Configuration file not found: {config_path}") from None
    library = config.get("library")
    if not isinstance(library, dict):
        raise ValueError("Configuration must contain a [library] table.")
    web = config.get("web", {})
    if not isinstance(web, dict):
        raise ValueError("[web] must be a table.")

    def text(table: dict, section: str, key: str, default: str | None = None) -> str:
        value = table.get(key, default)
        if not isinstance(value, str) or not value:
            raise ValueError(f"[{section}] {key} must be a non-empty string.")
        return value

    prefixes = library.get("name_prefixes", [])
    if not isinstance(prefixes, list) or not all(isinstance(prefix, str) and prefix for prefix in prefixes):
        raise ValueError("[library] name_prefixes must be a list of non-empty strings.")
    return Settings(
        videos_path=Path(text(library, "library", "videos_path")),
        thumbnails_path=Path(text(library, "library", "thumbnails_path")),
        name_prefixes=tuple(prefixes),
        site_url_prefix=text(web, "web", "site_url_prefix", "/"),
        videos_url_prefix=text(web, "web", "videos_url_prefix", "/media"),
        thumbnails_url_prefix=text(web, "web", "thumbnails_url_prefix", "/thumbnails"),
    )
