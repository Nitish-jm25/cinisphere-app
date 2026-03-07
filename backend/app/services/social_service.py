from datetime import datetime, timezone


def time_ago(value: datetime) -> str:
    now = datetime.now(timezone.utc)
    target = value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)
    seconds = int((now - target).total_seconds())

    if seconds < 60:
        return "now"
    if seconds < 3600:
        return f"{seconds // 60}m"
    if seconds < 86400:
        return f"{seconds // 3600}h"
    return f"{seconds // 86400}d"
