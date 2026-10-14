"""Opt-in integration check against the disposable local category_test database."""
import os
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import uuid4

import pytest


@pytest.mark.skipif(not os.getenv("PHUB_CATEGORY_TEST_DSN"), reason="Requires disposable local PostgreSQL category_test")
def test_concurrent_reparenting_cannot_commit_a_cycle():
    psycopg2 = pytest.importorskip("psycopg2")
    dsn = os.environ["PHUB_CATEGORY_TEST_DSN"]
    settings = psycopg2.extensions.parse_dsn(dsn)
    assert settings.get("host") == "127.0.0.1" and settings.get("dbname") == "category_test"
    ids = ["category_test_" + uuid4().hex for _ in range(2)]
    with psycopg2.connect(dsn) as connection:
        with connection.cursor() as cursor:
            for id in ids:
                cursor.execute('INSERT INTO public."LOAI_SP" (ma_loai_sp, ten_loai_sp) VALUES (%s, %s)', (id, id))
    barrier = Barrier(2)

    def change(index):
        try:
            with psycopg2.connect(dsn) as connection:
                with connection.cursor() as cursor:
                    cursor.execute("SET statement_timeout = '10s'")
                    barrier.wait(timeout=10)
                    cursor.execute('UPDATE public."LOAI_SP" SET ma_loai_cha=%s WHERE ma_loai_sp=%s', (ids[1-index], ids[index]))
            return "committed"
        except psycopg2.Error as error:
            return error.pgcode

    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(change, [0, 1]))
        assert results.count("committed") == 1, results
        assert any(result in {"23514", "40P01"} for result in results), results
    finally:
        with psycopg2.connect(dsn) as connection:
            with connection.cursor() as cursor:
                cursor.execute('UPDATE public."LOAI_SP" SET ma_loai_cha=NULL WHERE ma_loai_sp=ANY(%s)', (ids,))
                cursor.execute('DELETE FROM public."LOAI_SP" WHERE ma_loai_sp=ANY(%s)', (ids,))
