import uvicorn
from fastapi import FastAPI

app = FastAPI()


def start():
    """Input function that the pyproject.toml script will call."""
    uvicorn.run("ness_api.main:app", host="0.0.0.0", port=8000, reload=True)


if __name__ == "__main__":
    start()
