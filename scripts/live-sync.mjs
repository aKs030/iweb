import { execFile } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_SOURCE_URL = "https://www.abdulkerimsesli.de";
const DEFAULT_DATABASE = "portfolio-likes";
const CONTACT_PAGE_SIZE = 100;
const LIKE_EVENT_PAGE_SIZE = 200;
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS project_likes (
  project_id TEXT PRIMARY KEY,
  likes INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS blog_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comments_post_id ON blog_comments(post_id);

CREATE TABLE IF NOT EXISTS contact_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contact_created_at ON contact_messages(created_at);

CREATE TABLE IF NOT EXISTS project_like_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  source_ip TEXT DEFAULT '',
  user_agent TEXT DEFAULT '',
  request_id TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_like_events_project_id_created_at
ON project_like_events (project_id, created_at DESC);
`;

function parseArgs(argv) {
  const options = {
    source: process.env.MIGRATION_SOURCE_URL || process.env.SOURCE_URL || DEFAULT_SOURCE_URL,
    adminToken: process.env.ADMIN_TOKEN || "",
    database: process.env.MIGRATION_DATABASE || DEFAULT_DATABASE,
    apply: process.env.MIGRATION_APPLY === "1" || false,
    out: process.env.MIGRATION_OUT || "",
    remote: process.env.MIGRATION_REMOTE !== "0",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    switch (value) {
      case "--source":
        options.source = argv[++index] || options.source;
        break;
      case "--admin-token":
        options.adminToken = argv[++index] || options.adminToken;
        break;
      case "--database":
        options.database = argv[++index] || options.database;
        break;
      case "--out":
        options.out = argv[++index] || options.out;
        break;
      case "--apply":
        options.apply = true;
        break;
      case "--local":
        options.remote = false;
        break;
      case "--remote":
        options.remote = true;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
        break;
      default:
        if (value.startsWith("--source=")) options.source = value.slice("--source=".length);
        if (value.startsWith("--admin-token=")) options.adminToken = value.slice("--admin-token=".length);
        if (value.startsWith("--database=")) options.database = value.slice("--database=".length);
        if (value.startsWith("--out=")) options.out = value.slice("--out=".length);
        if (value === "--apply") options.apply = true;
        break;
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/live-sync.mjs [options]

Options:
  --source <url>        Live site base URL (default: ${DEFAULT_SOURCE_URL})
  --admin-token <tok>   Admin token for /api/admin actions
  --database <name>     Target D1 database name (default: ${DEFAULT_DATABASE})
  --out <file>          Write the generated SQL snapshot to a file
  --apply               Execute the snapshot against D1 via wrangler
  --local               Do not pass --remote to wrangler
  --remote              Force remote D1 execution
  -h, --help            Show this help
`);
}

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "") || DEFAULT_SOURCE_URL;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function escapeSqlString(value) {
  return String(value ?? "").replace(/'/g, "''");
}

function sqlValue(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${escapeSqlString(value)}'`;
}

function chunk(values, size) {
  const groups = [];
  for (let index = 0; index < values.length; index += size) {
    groups.push(values.slice(index, index + size));
  }
  return groups;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function discoverProjectIds() {
  const appsConfig = await readJson(path.join(ROOT_DIR, "pages/projekte/apps-config.json"));
  const appIds = (appsConfig?.apps || []).map(app => String(app?.name || "").trim());
  return unique(appIds);
}

async function discoverBlogPostIds() {
  const postsDir = path.join(ROOT_DIR, "pages/blog/posts");
  const entries = await readdir(postsDir, { withFileTypes: true });
  const ids = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;

    const raw = await readFile(path.join(postsDir, entry.name), "utf8");
    const frontmatterMatch = raw.match(/^---\n([\s\S]*?)\n---\n/);
    if (!frontmatterMatch) continue;

    const idMatch = frontmatterMatch[1].match(/^id:\s*(?:"([^"]+)"|'([^']+)'|(.+))\s*$/m);
    const id = String(idMatch?.[1] || idMatch?.[2] || idMatch?.[3] || "").trim();
    if (id) ids.push(id);
  }

  return unique(ids);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Request failed for ${url} (${response.status}): ${text.slice(0, 500)}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON from ${url}: ${text.slice(0, 500)}`);
  }
}

async function fetchProjectLikes(sourceUrl, projectIds) {
  const rows = [];

  for (const projectId of projectIds) {
    const payload = await fetchJson(`${sourceUrl}/api/likes?project_id=${encodeURIComponent(projectId)}`);
    rows.push({
      project_id: projectId,
      likes: Number(payload?.likes) || 0,
    });
  }

  return rows;
}

async function fetchBlogComments(sourceUrl, postIds) {
  const rows = [];

  for (const postId of postIds) {
    const payload = await fetchJson(`${sourceUrl}/api/comments?post_id=${encodeURIComponent(postId)}`);
    const comments = Array.isArray(payload?.comments) ? payload.comments : [];

    for (const comment of comments) {
      rows.push({
        id: Number(comment?.id) || null,
        post_id: postId,
        author_name: String(comment?.author_name || "").trim(),
        content: String(comment?.content || "").trim(),
        created_at: String(comment?.created_at || ""),
      });
    }
  }

  return rows;
}

async function fetchAdminAction(sourceUrl, adminToken, action, params = {}) {
  return fetchJson(`${sourceUrl}/api/admin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ action, ...params }),
  });
}

async function fetchDashboardStats(sourceUrl, adminToken) {
  try {
    const payload = await fetchAdminAction(sourceUrl, adminToken, "dashboard");
    return payload?.stats || {};
  } catch {
    return {};
  }
}

async function fetchContactMessages(sourceUrl, adminToken) {
  if (!adminToken) return [];

  const rows = [];
  const seen = new Set();
  let offset = 0;

  const stats = await fetchDashboardStats(sourceUrl, adminToken);
  const total = Number(stats?.contactMessages) || null;

  while (true) {
    const payload = await fetchAdminAction(sourceUrl, adminToken, "contact-messages", {
      limit: CONTACT_PAGE_SIZE,
      offset,
    });

    const messages = Array.isArray(payload?.messages) ? payload.messages : [];
    for (const message of messages) {
      const id = Number(message?.id) || null;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      rows.push({
        id,
        name: String(message?.name || "").trim(),
        email: String(message?.email || "").trim(),
        subject: String(message?.subject || "").trim(),
        message: String(message?.message || "").trim(),
        created_at: String(message?.created_at || ""),
      });
    }

    if (total !== null && rows.length >= total) break;
    if (messages.length < CONTACT_PAGE_SIZE) break;
    offset += CONTACT_PAGE_SIZE;
  }

  return rows;
}

async function fetchLikeEvents(sourceUrl, adminToken) {
  if (!adminToken) return [];

  const rows = [];
  const seen = new Set();
  let offset = 0;

  const stats = await fetchDashboardStats(sourceUrl, adminToken);
  const total = Number(stats?.likeEvents) || null;

  while (true) {
    const payload = await fetchAdminAction(sourceUrl, adminToken, "like-events", {
      limit: LIKE_EVENT_PAGE_SIZE,
      offset,
    });

    const events = Array.isArray(payload?.events) ? payload.events : [];
    for (const event of events) {
      const id = Number(event?.id) || null;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      rows.push({
        id,
        project_id: String(event?.project_id || "").trim(),
        source_ip: String(event?.source_ip || "").trim(),
        user_agent: String(event?.user_agent || "").trim(),
        request_id: String(event?.request_id || "").trim(),
        created_at: String(event?.created_at || ""),
      });
    }

    if (total !== null && rows.length >= total) break;
    if (events.length < LIKE_EVENT_PAGE_SIZE) break;
    offset += LIKE_EVENT_PAGE_SIZE;
  }

  return rows;
}

function buildInsertSql(table, columns, rows, chunkSize = 100) {
  if (!rows.length) return [];

  return chunk(rows, chunkSize).map(group => {
    const values = group
      .map(row => `(${columns.map(column => sqlValue(row[column])).join(", ")})`)
      .join(",\n  ");
    return `INSERT INTO ${table} (${columns.join(", ")})\nVALUES\n  ${values};`;
  });
}

async function buildSnapshotSql(data) {
  const statements = [
    SCHEMA_SQL.trim(),
    "BEGIN TRANSACTION;",
    "DELETE FROM project_likes;",
    "DELETE FROM blog_comments;",
    // contact_messages and project_like_events are admin-only; only include if provided
    ...(data.includeAdmin ? ["DELETE FROM contact_messages;", "DELETE FROM project_like_events;"] : []),
  ];

  statements.push(...buildInsertSql("project_likes", ["project_id", "likes"], data.projectLikes, 100));
  statements.push(
    ...buildInsertSql(
      "blog_comments",
      ["id", "post_id", "author_name", "content", "created_at"],
      data.blogComments,
      50
    )
  );
  if (data.includeAdmin) {
    statements.push(
      ...buildInsertSql(
        "contact_messages",
        ["id", "name", "email", "subject", "message", "created_at"],
        data.contactMessages,
        50
      )
    );
    statements.push(
      ...buildInsertSql(
        "project_like_events",
        ["id", "project_id", "source_ip", "user_agent", "request_id", "created_at"],
        data.likeEvents,
        50
      )
    );
  }
  statements.push("COMMIT;");

  return `${statements.join("\n\n")}\n`;
}

async function writeSnapshot(outPath, sql) {
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, sql, "utf8");
}

async function applySnapshot(database, sqlPath, useRemote) {
  await new Promise((resolve, reject) => {
    const args = [
      "--yes",
      "wrangler",
      "d1",
      "execute",
      database,
      ...(useRemote ? ["--remote"] : []),
      "--file",
      sqlPath,
    ];

    execFile("npx", args, { cwd: ROOT_DIR, stdio: "inherit" }, error => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const sourceUrl = normalizeBaseUrl(options.source);
  const projectIds = await discoverProjectIds();
  const blogPostIds = await discoverBlogPostIds();

  console.log(`Source: ${sourceUrl}`);
  console.log(`Projects: ${projectIds.length}, Blog posts: ${blogPostIds.length}`);

  // Safety: applying a snapshot can delete admin-only tables. Require admin token.
  if (options.apply && !options.adminToken) {
    console.error("Refusing to --apply without --admin-token. Provide ADMIN_TOKEN or use --out for a dry-run.");
    process.exit(2);
  }

  const [projectLikes, blogComments, contactMessages, likeEvents] = await Promise.all([
    fetchProjectLikes(sourceUrl, projectIds),
    fetchBlogComments(sourceUrl, blogPostIds),
    fetchContactMessages(sourceUrl, options.adminToken),
    fetchLikeEvents(sourceUrl, options.adminToken),
  ]);

  const includeAdmin = Boolean(options.adminToken);
  const sql = await buildSnapshotSql({ projectLikes, blogComments, contactMessages, likeEvents, includeAdmin });

  if (options.out) {
    const outPath = path.isAbsolute(options.out) ? options.out : path.resolve(ROOT_DIR, options.out);
    await writeSnapshot(outPath, sql);
    console.log(`Snapshot written to ${outPath}`);
  } else if (!options.apply) {
    process.stdout.write(sql);
  }

  if (options.apply) {
    const sqlPath = options.out
      ? path.isAbsolute(options.out)
        ? options.out
        : path.resolve(ROOT_DIR, options.out)
      : path.join(os.tmpdir(), `live-d1-snapshot-${Date.now()}.sql`);

    if (!options.out) {
      await writeSnapshot(sqlPath, sql);
    }

    await applySnapshot(options.database, sqlPath, options.remote);
    console.log(`Applied snapshot to ${options.database}${options.remote ? " (remote)" : ""}`);
  }
}

main().catch(error => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});