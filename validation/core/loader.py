from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Type

import yaml

from validation.models import MODEL_REGISTRY


def load_yaml(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle)
    if not isinstance(data, dict):
        raise ValueError(f"{path} must contain a YAML object at root")
    return data


def resolve_model(path: Path) -> Type[Any]:
    normalized = path.as_posix()
    if normalized not in MODEL_REGISTRY:
        raise KeyError(f"No model registered for {normalized}")
    return MODEL_REGISTRY[normalized]
