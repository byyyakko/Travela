#!/usr/bin/env python3
"""Quick Supabase database viewer for Travela.

Usage:
  python3 db_query.py                  # show all tables summary
  python3 db_query.py analytics        # show analytics_events rows
  python3 db_query.py profiles         # show profiles rows
  python3 db_query.py matches          # show matches rows
  python3 db_query.py <table_name>     # show any table's rows
"""

import sys
import json
import ssl
import urllib.request

# macOS Python often lacks default SSL certs — create unverified context as fallback
try:
    _ctx = ssl.create_default_context()
    urllib.request.urlopen("https://supabase.co", context=_ctx, timeout=3)
except ssl.SSLCertVerificationError:
    _ctx = ssl._create_unverified_context()
except Exception:
    _ctx = ssl._create_unverified_context()

SUPABASE_URL = "https://mpnfpyphwxmnmaosxjao.supabase.co"
ANON_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbmZweXBod3htbm1hb3N4amFvIiwi"
    "cm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MDA0MTgsImV4cCI6MjA4NDk3NjQxOH0."
    "kZnlroKWgg5GBSUaxSLnbemOF1ySOyRSgBSIvslkXQo"
)

TABLES = [
    "analytics_events",
    "profiles",
    "matches",
    "conversations",
    "messages",
    "posts",
    "post_comments",
    "stores",
    "blocked_users",
]


def query_table(table: str, limit: int = 50) -> list:
    url = f"{SUPABASE_URL}/rest/v1/{table}?select=*&limit={limit}&order=created_at.desc.nullsfirst"
    req = urllib.request.Request(url, headers={
        "apikey": ANON_KEY,
        "Authorization": f"Bearer {ANON_KEY}",
    })
    try:
        with urllib.request.urlopen(req, context=_ctx) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        return {"error": e.code, "detail": body}


def count_table(table: str):
    url = f"{SUPABASE_URL}/rest/v1/{table}?select=*&head=true"
    req = urllib.request.Request(url, method="HEAD", headers={
        "apikey": ANON_KEY,
        "Authorization": f"Bearer {ANON_KEY}",
        "Prefer": "count=exact",
    })
    try:
        with urllib.request.urlopen(req, context=_ctx) as resp:
            content_range = resp.headers.get("Content-Range", "")
            # Format: "0-N/total" or "*/total" or "*/0"
            if "/" in content_range:
                return int(content_range.split("/")[-1])
            return 0
    except urllib.error.HTTPError:
        return "?"


def show_summary():
    print("=" * 60)
    print("  Travela Database Summary")
    print(f"  Supabase: {SUPABASE_URL}")
    print("=" * 60)
    print(f"\n  {'Table':<25} {'Rows':>8}")
    print("  " + "-" * 35)
    for t in TABLES:
        c = count_table(t)
        print(f"  {t:<25} {c:>8}")
    print()
    print("  Run: python3 db_query.py <table_name>  to see rows")
    print()


def show_table(table: str):
    rows = query_table(table)
    if isinstance(rows, dict) and "error" in rows:
        print(f"Error querying '{table}': {rows}")
        return
    print(f"\n  {table} — {len(rows)} row(s) (latest first, max 50)\n")
    if not rows:
        print("  (empty)")
        return
    for i, row in enumerate(rows):
        print(f"  --- Row {i + 1} ---")
        for k, v in row.items():
            val = json.dumps(v) if isinstance(v, (dict, list)) else str(v)
            if len(val) > 100:
                val = val[:97] + "..."
            print(f"    {k}: {val}")
        print()


if __name__ == "__main__":
    if len(sys.argv) > 1:
        show_table(sys.argv[1])
    else:
        show_summary()
