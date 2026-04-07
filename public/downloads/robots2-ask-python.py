"""
robots2-ask endpoint — Python boilerplate
==========================================
Drop-in middleware for the robots2.txt Ask Protocol.
Handles HEAD requests to /.well-known/robots2-ask

Works with: Flask, FastAPI (via ASGI), or standalone.
This file runs standalone with zero dependencies beyond Python 3.8+.

Usage:
  python robots2-ask-python.py                    # runs on port 8100
  python robots2-ask-python.py --port 9000        # custom port

Or import the handler into your existing app:
  from robots2_ask import handle_robots2_ask      # returns (status, headers)

Configuration:
  Edit the POLICY dict below to match your robots2.txt directives.
  That's it. That's the whole setup.

Spec: https://robotsv2.org
Authors: Matthew, Claude & Gemini — 2026
"""

import json
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from datetime import datetime

# ═══════════════════════════════════════════
# CONFIGURATION — edit this to match your site
# ═══════════════════════════════════════════

POLICY = {
    # Default decisions for each directive when an agent asks.
    # If a directive isn't listed here, the response is "deny".
    #
    # Each entry can be:
    #   "allow"       — yes, globally
    #   "deny"        — no
    #   "allow-once"  — yes, but ask again next time
    #   A dict with "decision" and "scopes" for path-specific control

    "crawl": "allow",

    "read": "allow",

    "summarise": {
        "decision": "allow",
        "scopes": ["/blog/*", "/docs/public/*"]
        # Only allow summarisation of blog posts and public docs.
        # Everything else (product pages, pricing, etc.) is denied.
    },

    "quote": "allow",  # short-only is enforced by the spec, not the endpoint

    "derivative": {
        "decision": "allow",
        "scopes": ["/blog/*"]
        # Derivatives allowed for blog content only.
    },

    "train": "deny",
    # Hard no. This is the default for most sites.

    "store": "deny",
    # session-only is in the robots2.txt; if they're asking, say no.

    "monetise": "deny",
}

# Agents you want to explicitly block regardless of directive.
# Use the identity string from X-Agent-Identity header.
BLOCKED_AGENTS = [
    # "BadBot/1.0",
    # "SketchyScraper/2.3",
]

# Agents you want to always allow (override all policy).
TRUSTED_AGENTS = [
    # "GoogleBot/2.1 (search-indexer)",
    # "ClaudeBot/2.0 (ai-assistant)",
]

# Log requests to stdout?
LOG_REQUESTS = True

# ═══════════════════════════════════════════
# HANDLER — you probably don't need to edit below here
# ═══════════════════════════════════════════

def handle_robots2_ask(directive, agent):
    """
    Core decision logic. Returns (status_code, headers_dict).
    Import this into your own app if you don't want the standalone server.

    Parameters:
        directive (str): The directive being asked about (e.g. "train", "summarise")
        agent (str): The agent's identity string from X-Agent-Identity

    Returns:
        tuple: (http_status_code, dict_of_response_headers)
    """
    headers = {}

    # Check blocked agents first
    if agent and any(blocked.lower() in agent.lower() for blocked in BLOCKED_AGENTS):
        headers["X-Robots2-Decision"] = "deny"
        if LOG_REQUESTS:
            _log(f"BLOCKED agent={agent} directive={directive}")
        return (200, headers)

    # Check trusted agents
    if agent and any(trusted.lower() in agent.lower() for trusted in TRUSTED_AGENTS):
        headers["X-Robots2-Decision"] = "allow"
        if LOG_REQUESTS:
            _log(f"TRUSTED agent={agent} directive={directive}")
        return (200, headers)

    # Look up policy
    policy = POLICY.get(directive)

    if policy is None:
        # Directive not in our policy = deny (safe default)
        headers["X-Robots2-Decision"] = "deny"
        if LOG_REQUESTS:
            _log(f"DENY (no policy) agent={agent} directive={directive}")
        return (200, headers)

    if isinstance(policy, str):
        # Simple string decision
        headers["X-Robots2-Decision"] = policy
        if LOG_REQUESTS:
            _log(f"{policy.upper()} agent={agent} directive={directive}")
        return (200, headers)

    if isinstance(policy, dict):
        # Scoped decision
        decision = policy.get("decision", "deny")
        scopes = policy.get("scopes", [])

        headers["X-Robots2-Decision"] = decision
        for scope in scopes:
            # Multiple scope headers — append as list
            # In raw HTTP these become multiple X-Robots2-Scope headers
            headers.setdefault("X-Robots2-Scope", [])
            headers["X-Robots2-Scope"].append(scope)

        if LOG_REQUESTS:
            scope_str = ", ".join(scopes) if scopes else "site-wide"
            _log(f"{decision.upper()} agent={agent} directive={directive} scopes=[{scope_str}]")
        return (200, headers)

    # Fallback
    headers["X-Robots2-Decision"] = "deny"
    return (200, headers)


def _log(message):
    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    print(f"[robots2-ask] {timestamp} {message}")


class Robots2AskHandler(BaseHTTPRequestHandler):
    """Standalone HTTP handler for the ask endpoint."""

    def do_HEAD(self):
        self._handle()

    def do_GET(self):
        # Some agents might GET instead of HEAD — handle it gracefully
        self._handle()

    def _handle(self):
        parsed = urlparse(self.path)

        # Only respond to the well-known path
        if parsed.path != "/.well-known/robots2-ask":
            self.send_response(404)
            self.end_headers()
            return

        params = parse_qs(parsed.query)
        directive = params.get("directive", [None])[0]
        agent = (
            params.get("agent", [None])[0]
            or self.headers.get("X-Agent-Identity", "unknown")
        )

        if not directive:
            self.send_response(400)
            self.send_header("X-Robots2-Error", "missing directive parameter")
            self.end_headers()
            return

        status, headers = handle_robots2_ask(directive, agent)

        self.send_response(status)
        for key, value in headers.items():
            if isinstance(value, list):
                for v in value:
                    self.send_header(key, v)
            else:
                self.send_header(key, value)

        # Always include these
        self.send_header("Cache-Control", "public, max-age=86400")
        self.send_header("X-Robots2-Spec", "https://robotsv2.org")
        self.end_headers()

    def log_message(self, format, *args):
        # Suppress default logging — we do our own
        pass


def main():
    port = 8100
    if "--port" in sys.argv:
        idx = sys.argv.index("--port")
        if idx + 1 < len(sys.argv):
            port = int(sys.argv[idx + 1])

    server = HTTPServer(("0.0.0.0", port), Robots2AskHandler)
    print(f"[robots2-ask] Listening on port {port}")
    print(f"[robots2-ask] Test: curl -I 'http://localhost:{port}/.well-known/robots2-ask?directive=train&agent=TestBot'")
    print(f"[robots2-ask] Spec: https://robotsv2.org")
    print()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[robots2-ask] Shutting down.")
        server.server_close()


if __name__ == "__main__":
    main()
