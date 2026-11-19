import time
from collections import defaultdict, deque
from typing import Deque, Dict, Optional, Tuple

import redis

from app.core.config import get_settings


class RateLimiter:
    """Sliding-window rate limiter backed by Redis with safe in-memory fallback."""

    def __init__(self) -> None:
        settings = get_settings()
        self._redis: Optional[redis.Redis] = None
        self._memory_windows: Dict[str, Deque[float]] = defaultdict(deque)
        try:
            client = redis.Redis.from_url(
                settings.redis_url,
                socket_connect_timeout=1,
                socket_timeout=1,
                decode_responses=True,
            )
            client.ping()
            self._redis = client
        except Exception:
            self._redis = None

    def check_rate_limit(
        self,
        key: str,
        limit: int,
        window_seconds: int = 60,
    ) -> Tuple[bool, int]:
        """Returns (allowed, remaining)."""
        now = time.time()
        if self._redis is not None:
            try:
                redis_key = f"rl:{key}"
                pipe = self._redis.pipeline()
                pipe.zremrangebyscore(redis_key, 0, now - window_seconds)
                pipe.zcard(redis_key)
                pipe.zadd(redis_key, {f"{now}": now})
                pipe.expire(redis_key, window_seconds + 5)
                _, current_count, _, _ = pipe.execute()
                if current_count >= limit:
                    return False, 0
                return True, max(0, limit - current_count - 1)
            except Exception:
                pass

        # In-memory fallback (for local tests or Redis unavailability)
        q = self._memory_windows[key]
        cutoff = now - window_seconds
        while q and q[0] <= cutoff:
            q.popleft()
        if len(q) >= limit:
            return False, 0
        q.append(now)
        return True, max(0, limit - len(q))


rate_limiter = RateLimiter()
