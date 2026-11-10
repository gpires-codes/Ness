import inspect
from collections.abc import Callable
from typing import get_type_hints

from pydantic import create_model


def build_parameters_schema(fn: Callable) -> dict:
    """Generates a JSON Schema from a function's signature and type hints."""
    sig = inspect.signature(fn)
    hints = get_type_hints(fn, include_extras=True)

    fields = {}
    for param_name, param in sig.parameters.items():
        annotation = hints.get(param_name, str)
        default = ... if param.default is inspect.Parameter.empty else param.default
        fields[param_name] = (annotation, default)

    model = create_model(f"{fn.__name__}Params", **fields)
    return model.model_json_schema()
