"""Shared pagination for PostgREST query factories."""
from postgrest.exceptions import APIError

BATCH_SIZE = 500


def rows(query_factory):
    start = 0
    while True:
        try:
            batch = query_factory().range(start, start + BATCH_SIZE - 1).execute().data
        except APIError as exc:
            if exc.code == "PGRST103" and start > 0:
                return
            raise
        yield from batch
        if len(batch) < BATCH_SIZE:
            return
        start += BATCH_SIZE
