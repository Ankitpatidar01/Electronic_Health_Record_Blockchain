"""
Structured logging module for the Clinical AI Agent microservice.
Provides consistent, production-grade log output with timestamps.
"""

import logging
import sys

def get_logger(name: str) -> logging.Logger:
    """Configure and return a structured logger."""
    logger = logging.getLogger(name)
    if not logger.handlers:
        logger.setLevel(logging.INFO)
        formatter = logging.Formatter(
            fmt="%(asctime)s | %(levelname)-7s | [%(name)s] %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )
        stream_handler = logging.StreamHandler(sys.stdout)
        stream_handler.setFormatter(formatter)
        logger.addHandler(stream_handler)
    return logger
