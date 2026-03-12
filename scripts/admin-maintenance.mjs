function parseArgs(argv) {
  const args = {};

  for (const rawArg of argv) {
    if (!rawArg.startsWith("--")) continue;
    const [rawKey, ...rawValue] = rawArg.slice(2).split("=");
    const key = String(rawKey || "").trim();
    if (!key) continue;
    args[key] = rawValue.length > 0 ? rawValue.join("=").trim() : "true";
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const siteUrl = String(
    args.url ||
      process.env.PRODUCTION_SITE_URL ||
      "https://www.abdulkerimsesli.de",
  ).trim();
  const adminToken = String(args.token || process.env.ADMIN_TOKEN || "").trim();
  const limit = Math.max(1, Math.min(500, Number(args.limit) || 100));

  if (!adminToken) {
    throw new Error("ADMIN_TOKEN fehlt fuer admin-maintenance.");
  }

  const endpoint = new URL("/api/admin/users", siteUrl).toString();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      action: "purge-expired-archives",
      limit,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    throw new Error(
      payload?.text ||
        payload?.error ||
        `admin-maintenance failed with status ${response.status}`,
    );
  }

  const count = Number(payload?.count) || 0;
  const userIds = Array.isArray(payload?.userIds) ? payload.userIds : [];
  console.log(
    JSON.stringify(
      {
        ok: true,
        url: endpoint,
        count,
        userIds,
        text: payload?.text || "",
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    `[admin-maintenance] ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
