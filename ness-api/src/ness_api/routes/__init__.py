from fastapi import APIRouter

from . import chat, keys

router = APIRouter()

router.include_router(chat.router)
router.include_router(keys.router)
