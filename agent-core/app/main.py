from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.db import close_db_pool, init_db_pool
from app.scheduler import start_scheduler, stop_scheduler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db_pool()
    start_scheduler()
    try:
        yield
    finally:
        stop_scheduler()
        close_db_pool()


app = FastAPI(
    title="CachAI Agent Core",
    version="0.1.0",
    description="Autonomous multi-agent LLM security auditing & red-teaming backend.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(router)
