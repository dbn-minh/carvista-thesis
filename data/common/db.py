import os
from contextlib import contextmanager
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

import mysql.connector
from dotenv import load_dotenv

load_dotenv()


def to_bool(value, default=False):
    if value is None or str(value).strip() == "":
        return default
    normalized = str(value).strip().lower()
    if normalized in {"1", "true", "yes", "on", "required"}:
        return True
    if normalized in {"0", "false", "no", "off", "disabled"}:
        return False
    return default


def parse_database_url():
    raw = (
        os.getenv("DATABASE_URL")
        or os.getenv("MYSQL_URL")
        or os.getenv("MYSQL_PUBLIC_URL")
        or os.getenv("RAILWAY_DATABASE_URL")
    )
    if not raw:
        return {}

    parsed = urlparse(raw)
    query = parse_qs(parsed.query)
    ssl_mode = (query.get("ssl-mode") or query.get("ssl_mode") or [None])[0]

    return {
        "host": parsed.hostname or None,
        "port": parsed.port or None,
        "user": unquote(parsed.username) if parsed.username else None,
        "password": unquote(parsed.password) if parsed.password else None,
        "database": parsed.path.lstrip("/") or None,
        "ssl_required": ssl_mode in {"REQUIRED", "required", "VERIFY_CA", "verify_ca", "VERIFY_IDENTITY", "verify_identity"},
    }


def get_db_config():
    url_config = parse_database_url()
    ssl_required = to_bool(os.getenv("DB_SSL"), url_config.get("ssl_required", False))
    ssl_ca_path = os.getenv("DB_SSL_CA_PATH") or os.getenv("MYSQL_SSL_CA") or os.getenv("SSL_CA")
    ssl_verify_cert = to_bool(os.getenv("DB_SSL_VERIFY_CERT"), bool(ssl_ca_path))
    ssl_verify_identity = to_bool(os.getenv("DB_SSL_VERIFY_IDENTITY"), False)

    config = {
        "host": os.getenv("DB_HOST") or url_config.get("host") or "localhost",
        "port": int(os.getenv("DB_PORT") or url_config.get("port") or "3308"),
        "user": os.getenv("DB_USER") or url_config.get("user") or "user",
        "password": os.getenv("DB_PASSWORD") or url_config.get("password") or "password",
        "database": os.getenv("DB_NAME") or url_config.get("database") or "carvista",
    }

    if ssl_required:
        config["ssl_disabled"] = False
        if ssl_ca_path:
            config["ssl_ca"] = str(Path(ssl_ca_path).expanduser())
            config["ssl_verify_cert"] = ssl_verify_cert
            config["ssl_verify_identity"] = ssl_verify_identity

    return config


def connect_db():
    return mysql.connector.connect(autocommit=False, **get_db_config())


@contextmanager
def db_cursor(dictionary=False):
    conn = connect_db()
    cursor = conn.cursor(dictionary=dictionary)
    try:
        yield conn, cursor
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()
