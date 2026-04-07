/**
 * robots2-ask endpoint — Node.js boilerplate
 * ============================================
 * Drop-in middleware for the robots2.txt Ask Protocol.
 * Handles HEAD/GET requests to /.well-known/robots2-ask
 *
 * Works with: Express, Fastify, or standalone (zero dependencies).
 * This file runs standalone with Node.js 18+ and nothing else.
 *
 * Usage:
 *   node robots2-ask-node.js                    # runs on port 8100
 *   PORT=9000 node robots2-ask-node.js          # custom port
 *
 * Or import the handler into Express:
 *   const { expressMiddleware } = require('./robots2-ask-node');
 *   app.use(expressMiddleware);
 *
 * Configuration:
 *   Edit the POLICY object below to match your robots2.txt directives.
 *   That's it. That's the whole setup.
 *
 * Spec: https://robotsv2.org
 * Authors: Matthew, Claude & Gemini — 2026
 */

// ═══════════════════════════════════════════
// CONFIGURATION — edit this to match your site
// ═══════════════════════════════════════════

const POLICY = {
  // Default decisions for each directive when an agent asks.
  // If a directive isn't listed here, the response is "deny".
  //
  // Each entry can be:
  //   "allow"       — yes, globally
  //   "deny"        — no
  //   "allow-once"  — yes, but ask again next time
  //   An object with "decision" and "scopes" for path-specific control

  crawl: "allow",

  read: "allow",

  summarise: {
    decision: "allow",
    scopes: ["/blog/*", "/docs/public/*"],
    // Only allow summarisation of blog posts and public docs.
  },

  quote: "allow", // short-only is enforced by the spec, not the endpoint

  derivative: {
    decision: "allow",
    scopes: ["/blog/*"],
    // Derivatives allowed for blog content only.
  },

  train: "deny",
  // Hard no. This is the default for most sites.

  store: "deny",
  // session-only is in the robots2.txt; if they're asking, say no.

  monetise: "deny",
};

// Agents you want to explicitly block regardless of directive.
const BLOCKED_AGENTS = [
  // "BadBot/1.0",
  // "SketchyScraper/2.3",
];

// Agents you want to always allow (override all policy).
const TRUSTED_AGENTS = [
  // "GoogleBot/2.1 (search-indexer)",
  // "ClaudeBot/2.0 (ai-assistant)",
];

// Log requests to stdout?
const LOG_REQUESTS = true;

// ═══════════════════════════════════════════
// HANDLER — you probably don't need to edit below here
// ═══════════════════════════════════════════

function handleRobots2Ask(directive, agent) {
  const headers = {};

  // Check blocked agents first
  if (agent && BLOCKED_AGENTS.some((b) => agent.toLowerCase().includes(b.toLowerCase()))) {
    headers["X-Robots2-Decision"] = "deny";
    if (LOG_REQUESTS) log(`BLOCKED agent=${agent} directive=${directive}`);
    return { status: 200, headers };
  }

  // Check trusted agents
  if (agent && TRUSTED_AGENTS.some((t) => agent.toLowerCase().includes(t.toLowerCase()))) {
    headers["X-Robots2-Decision"] = "allow";
    if (LOG_REQUESTS) log(`TRUSTED agent=${agent} directive=${directive}`);
    return { status: 200, headers };
  }

  // Look up policy
  const policy = POLICY[directive];

  if (policy === undefined) {
    headers["X-Robots2-Decision"] = "deny";
    if (LOG_REQUESTS) log(`DENY (no policy) agent=${agent} directive=${directive}`);
    return { status: 200, headers };
  }

  if (typeof policy === "string") {
    headers["X-Robots2-Decision"] = policy;
    if (LOG_REQUESTS) log(`${policy.toUpperCase()} agent=${agent} directive=${directive}`);
    return { status: 200, headers };
  }

  if (typeof policy === "object") {
    const decision = policy.decision || "deny";
    const scopes = policy.scopes || [];

    headers["X-Robots2-Decision"] = decision;
    if (scopes.length > 0) {
      // Multiple scope values — stored as array for multi-header output
      headers["X-Robots2-Scope"] = scopes;
    }

    if (LOG_REQUESTS) {
      const scopeStr = scopes.length ? scopes.join(", ") : "site-wide";
      log(`${decision.toUpperCase()} agent=${agent} directive=${directive} scopes=[${scopeStr}]`);
    }
    return { status: 200, headers };
  }

  headers["X-Robots2-Decision"] = "deny";
  return { status: 200, headers };
}

function log(message) {
  const ts = new Date().toISOString().replace("T", " ").replace(/\.\d+Z/, " UTC");
  console.log(`[robots2-ask] ${ts} ${message}`);
}

// ═══════════════════════════════════════════
// EXPRESS MIDDLEWARE (optional export)
// ═══════════════════════════════════════════

function expressMiddleware(req, res, next) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname !== "/.well-known/robots2-ask") {
    return next();
  }

  const directive = url.searchParams.get("directive");
  const agent = url.searchParams.get("agent") || req.headers["x-agent-identity"] || "unknown";

  if (!directive) {
    res.status(400).set("X-Robots2-Error", "missing directive parameter").end();
    return;
  }

  const { status, headers } = handleRobots2Ask(directive, agent);

  res.status(status);
  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      value.forEach((v) => res.append(key, v));
    } else {
      res.set(key, value);
    }
  }
  res.set("Cache-Control", "public, max-age=86400");
  res.set("X-Robots2-Spec", "https://robotsv2.org");
  res.end();
}

// ═══════════════════════════════════════════
// STANDALONE SERVER (zero dependencies)
// ═══════════════════════════════════════════

if (require.main === module) {
  const http = require("http");
  const { URL } = require("url");

  const port = process.env.PORT || 8100;

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    if (url.pathname !== "/.well-known/robots2-ask") {
      res.writeHead(404);
      res.end();
      return;
    }

    const directive = url.searchParams.get("directive");
    const agent = url.searchParams.get("agent") || req.headers["x-agent-identity"] || "unknown";

    if (!directive) {
      res.writeHead(400, { "X-Robots2-Error": "missing directive parameter" });
      res.end();
      return;
    }

    const { status, headers } = handleRobots2Ask(directive, agent);

    // Build raw headers (supporting multiple values for Scope)
    const rawHeaders = {};
    for (const [key, value] of Object.entries(headers)) {
      if (Array.isArray(value)) {
        // Node's writeHead handles arrays as multiple headers
        rawHeaders[key] = value;
      } else {
        rawHeaders[key] = value;
      }
    }
    rawHeaders["Cache-Control"] = "public, max-age=86400";
    rawHeaders["X-Robots2-Spec"] = "https://robotsv2.org";

    res.writeHead(status, rawHeaders);
    res.end();
  });

  server.listen(port, () => {
    console.log(`[robots2-ask] Listening on port ${port}`);
    console.log(`[robots2-ask] Test: curl -I 'http://localhost:${port}/.well-known/robots2-ask?directive=train&agent=TestBot'`);
    console.log(`[robots2-ask] Spec: https://robotsv2.org`);
    console.log();
  });
}

// ═══════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════

module.exports = { handleRobots2Ask, expressMiddleware };
