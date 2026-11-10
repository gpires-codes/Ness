from typing import Annotated

from pydantic import Field

from ness_api.actions.decorators import backend_action
from ness_api.actions.exceptions import ActionError
from ness_api.actions.registry import Action, ActionResult, action_register
from ness_api.settings.plugins import get_plugin_settings, save_plugin_settings

__all__ = [
    "Action",
    "ActionError",
    "ActionResult",
    "Annotated",
    "Field",
    "action_register",
    "backend_action",
    "get_plugin_settings",
    "save_plugin_settings",
]

# ### Minimum documentation/example of "how to create an action":
# from ness_plugin_sdk import backend_action, action_register, Action, ActionError
# from typing import Annotated
# from pydantic import Field


# @backend_action
# def my_automation(
#     parameter: Annotated[str, Field(description="Explain what that is.")]
# ) -> str:
#     """Description of what this automation does."""
#     if something_went_wrong:
#         raise ActionError("Clear error message")
#     return "result"


# action_register(Action(executor=my_automation))
