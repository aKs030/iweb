/* =================================================================
   State
   ================================================================= */
let adminToken = sessionStorage.getItem("admin_token") || "";
let viewDataLoaded = {};

// Base URL for API
const API_BASE = "/api/admin";
const PAGE_LIMIT = 20;
const FILE_ICONS = {
  jpg: "🖼️",
  jpeg: "🖼️",
  png: "🖼️",
  webp: "🖼️",
  avif: "🖼️",
  gif: "🖼️",
  mp4: "🎬",
  webm: "🎬",
  mov: "🎬",
  svg: "🎨",
};

/* =================================================================
   API Client
   ================================================================= */
async function apiCall(action, params = {}) {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ action, ...params }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) {
      sessionStorage.removeItem("admin_token");
      adminToken = "";
      showLogin();
    }
    throw new Error(data?.error || data?.message || data?.text || `HTTP ${res.status}`);
  }
  return data;
}

/* =================================================================
   Toast
   ================================================================= */
function showToast(message, type = "success") {
  const toast = el("div", { className: `toast toast--${type}`, text: message });
  byId("toast-container").appendChild(toast);
  setTimeout(() => {
    toast.classList.add("is-leaving");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function errorMessage(error, prefix = "Fehler") {
  return `${prefix}: ${error?.message || String(error)}`;
}

function showError(error, prefix) {
  showToast(errorMessage(error, prefix), "error");
}

/* =================================================================
   Confirm Dialog
   ================================================================= */
function showConfirm(title, message) {
  return new Promise(resolve => {
    const container = byId("confirm-container");
    const cancelButton = el("button", {
      className: "btn",
      type: "button",
      text: "Abbrechen",
    });
    const okButton = el("button", {
      className: "btn btn--danger",
      type: "button",
      text: "Löschen",
    });

    container.replaceChildren(
      el(
        "div",
        { className: "confirm-overlay" },
        el(
          "div",
          { className: "confirm-dialog" },
          el("h3", { text: title }),
          el("p", { text: message }),
          el("div", { className: "confirm-actions" }, cancelButton, okButton)
        )
      )
    );

    const close = result => {
      container.replaceChildren();
      resolve(result);
    };
    cancelButton.onclick = () => close(false);
    okButton.onclick = () => close(true);
  });
}

/* =================================================================
   Helpers
   ================================================================= */
const byId = id => document.getElementById(id);

const setHtml = (id, html) => {
  byId(id).innerHTML = html;
};

function el(tag, { text, ...props } = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  if (text !== undefined) node.textContent = text;
  node.append(...children);
  return node;
}

function esc(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function encodeDataValue(value) {
  return encodeURIComponent(String(value ?? ""));
}

function decodeDataValue(value) {
  try {
    return decodeURIComponent(String(value ?? ""));
  } catch {
    return String(value ?? "");
  }
}

function getStaggerClass(index, scale, maxIndex = 12) {
  const normalizedIndex = Number.isFinite(index) ? index : Number(index) || 0;
  const clampedIndex = Math.max(0, Math.min(maxIndex, normalizedIndex));
  return `stagger-${scale}-${clampedIndex}`;
}

function formatDate(d) {
  if (!d) return "—";
  try {
    const date = new Date(d);
    return date.toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(d);
  }
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function truncate(str, max = 60) {
  if (!str) return "";
  return str.length > max ? str.slice(0, max) + "…" : str;
}

function emptyState(text, icon = "") {
  const iconHtml = icon ? `<div class="empty-state-icon">${icon}</div>` : "";
  return `<div class="empty-state">${iconHtml}<div class="empty-state-text">${esc(text)}</div></div>`;
}

function paginationFooter({ action, limit, offset, total }) {
  return `<div class="table-footer">
    <span>${offset + 1}–${Math.min(offset + limit, total)} von ${total}</span>
    <div class="pagination">
      ${offset > 0 ? `<button class="btn btn--sm" type="button" data-action="${action}" data-offset="${offset - limit}">← Zurück</button>` : ""}
      ${offset + limit < total ? `<button class="btn btn--sm" type="button" data-action="${action}" data-offset="${offset + limit}">Weiter →</button>` : ""}
    </div>
  </div>`;
}

function tableEmpty(colspan, text = "") {
  return `<tr><td colspan="${colspan}" class="table-empty-cell">${esc(text)}</td></tr>`;
}

function tableHtml({
  title,
  headers,
  rows,
  emptyText,
  actions = "",
  footer = "",
  extraClass = "",
}) {
  const className = extraClass ? `table-container ${extraClass}` : "table-container";
  const body = rows || (emptyText ? tableEmpty(headers.length, emptyText) : "");
  const actionsHtml = actions ? `<div class="table-actions">${actions}</div>` : "";

  return `<div class="${className}">
    <div class="table-header">
      <div class="table-title">${esc(title)}</div>
      ${actionsHtml}
    </div>
    <div class="table-scroll">
      <table>
        <thead><tr>${headers.map(header => `<th>${esc(header)}</th>`).join("")}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
    ${footer}
  </div>`;
}

function fileIcon(key) {
  const ext = String(key || "")
    .split(".")
    .pop()
    .toLowerCase();
  return FILE_ICONS[ext] || "📄";
}

function fileName(key) {
  return (
    String(key || "")
      .split("/")
      .pop() || "—"
  );
}

function closestTarget(event, selector) {
  const target = event.target instanceof Element ? event.target.closest(selector) : null;
  return target instanceof HTMLElement ? target : null;
}

/* =================================================================
   Login
   ================================================================= */
function showLogin() {
  byId("login-overlay").classList.remove("hidden");
  byId("app").classList.remove("active");
}

function hideLogin() {
  byId("login-overlay").classList.add("hidden");
  byId("app").classList.add("active");
}

byId("login-btn").addEventListener("click", async () => {
  const token = byId("login-token").value.trim();
  if (!token) return;

  adminToken = token;
  try {
    const data = await apiCall("dashboard");
    if (data.success) {
      sessionStorage.setItem("admin_token", token);
      hideLogin();
      renderDashboard(data);
      viewDataLoaded.dashboard = true;
    } else {
      throw new Error();
    }
  } catch {
    byId("login-error").textContent = "Token ungültig oder Server-Fehler.";
    adminToken = "";
  }
});

byId("login-token").addEventListener("keydown", e => {
  if (e.key === "Enter") byId("login-btn").click();
});

byId("logout-btn").addEventListener("click", () => {
  sessionStorage.removeItem("admin_token");
  adminToken = "";
  viewDataLoaded = {};
  showLogin();
});

byId("mobile-toggle").addEventListener("click", () => {
  byId("sidebar").classList.toggle("open");
});

const actionNumber = (target, name) => {
  const value = Number.parseInt(target.dataset[name] || "", 10);
  return Number.isFinite(value) ? value : null;
};
const actionValue = (target, name) => decodeDataValue(target.dataset[name]);
const withUserId = (target, handler) => {
  const userId = actionValue(target, "userId");
  if (userId) return handler(userId);
};

const ACTION_HANDLERS = {
  "delete-contact": target => {
    const id = actionNumber(target, "id");
    if (id !== null) return deleteContact(id);
  },
  "load-contacts": target => {
    const offset = actionNumber(target, "offset");
    if (offset !== null) return loadContacts(offset);
  },
  "delete-comment": target => {
    const id = actionNumber(target, "id");
    if (id !== null) return deleteComment(id);
  },
  "load-comments": target => {
    const offset = actionNumber(target, "offset");
    if (offset !== null) return loadComments(offset, currentCommentsPostId);
  },
  "select-user": target => withUserId(target, selectUser),
  "refresh-user": target => withUserId(target, selectUser),
  "delete-user-profile": target => withUserId(target, deleteUserProfileAction),
  "toggle-memory-edit": target => {
    const index = actionNumber(target, "index");
    if (index !== null) return toggleEditMemory(index);
  },
  "save-memory-edit": target => {
    const index = actionNumber(target, "index");
    const userId = actionValue(target, "userId");
    const key = actionValue(target, "key");
    const previousValue = actionValue(target, "previousValue");
    if (index !== null && userId && key) {
      return saveMemoryEdit(userId, key, previousValue, index);
    }
  },
  "delete-memory": target => {
    const userId = actionValue(target, "userId");
    const key = actionValue(target, "key");
    if (userId && key) return deleteMemory(userId, key, actionValue(target, "value"));
  },
  "load-kv": target => {
    const namespace = target.dataset.namespace || "";
    if (namespace) return loadKv(namespace);
  },
  "clear-cache": clearCacheAction,
};

document.addEventListener("click", event => {
  const navButton = closestTarget(event, ".nav-item[data-view]");
  if (navButton) {
    switchView(navButton.dataset.view);
    byId("sidebar").classList.remove("open");
    return;
  }

  const target = closestTarget(event, "[data-action]");
  if (!target) return;

  const handler = ACTION_HANDLERS[target.dataset.action];
  if (handler) void handler(target);
});

document.addEventListener("keydown", event => {
  const filterInput =
    event.target instanceof HTMLInputElement && event.target.id === "comment-filter"
      ? event.target
      : null;
  if (!filterInput || event.key !== "Enter") return;
  event.preventDefault();
  void loadComments(0, filterInput.value || null);
});

function switchView(view) {
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  document.querySelector(`.nav-item[data-view="${view}"]`)?.classList.add("active");
  document.querySelectorAll(".section-view").forEach(s => s.classList.remove("active"));
  byId(`view-${view}`)?.classList.add("active");
  if (!viewDataLoaded[view]) loadViewData(view);
}

const VIEW_LOADERS = {
  dashboard: async () => renderDashboard(await apiCall("dashboard")),
  contacts: loadContacts,
  comments: loadComments,
  likes: loadLikes,
  memories: loadMemories,
  gallery: loadGallery,
  kv: () => loadKv("memory"),
};

async function loadViewData(view) {
  try {
    const load = VIEW_LOADERS[view];
    if (!load) return;
    await load();
    viewDataLoaded[view] = true;
  } catch (err) {
    showError(err, "Fehler beim Laden");
  }
}

/* =================================================================
   Dashboard
   ================================================================= */
function renderDashboard(data) {
  const s = data.stats || {};
  const items = [
    { icon: "✉️", value: s.contactMessages, label: "Kontakt-Nachrichten" },
    { icon: "💬", value: s.blogComments, label: "Blog-Kommentare" },
    { icon: "❤️", value: s.projectLikes, label: "Projekte mit Likes" },
    { icon: "👆", value: s.likeEvents, label: "Like-Events" },
    { icon: "🧠", value: s.userMemories, label: "User-Profile" },
    { icon: "🖼️", value: s.galleryItems, label: "Galerie-Objekte" },
  ];

  setHtml(
    "stats-grid",
    items
      .map(
        (item, i) => `
    <div class="stat-card ${getStaggerClass(i, "06", 7)}">
      <div class="stat-icon">${item.icon}</div>
      <div class="stat-value">${item.value}</div>
      <div class="stat-label">${item.label}</div>
    </div>`
      )
      .join("")
  );
}

/* =================================================================
   Contacts
   ================================================================= */
let contactsOffset = 0;

async function loadContacts(offset = 0) {
  contactsOffset = offset;
  const data = await apiCall("contact-messages", { limit: PAGE_LIMIT, offset });
  renderContacts(data);
}

function renderContacts(data) {
  const messages = data.messages || [];
  const total = data.total || 0;

  if (messages.length === 0) {
    setHtml("contacts-content", emptyState("Keine Kontakt-Nachrichten vorhanden.", "✉️"));
    return;
  }

  const rows = messages
    .map(
      m => `<tr>
      <td>${m.id}</td>
      <td>${esc(m.name)}</td>
      <td>${esc(m.email)}</td>
      <td title="${esc(m.subject || "")}">${esc(truncate(m.subject || "—", 30))}</td>
      <td title="${esc(m.message)}">${esc(truncate(m.message, 50))}</td>
      <td>${formatDate(m.created_at)}</td>
      <td>
        <button class="btn btn--danger btn--sm" type="button" data-action="delete-contact" data-id="${m.id}">
          🗑️
        </button>
      </td>
    </tr>`
    )
    .join("");

  setHtml(
    "contacts-content",
    tableHtml({
      title: `Nachrichten (${total})`,
      headers: ["ID", "Name", "E-Mail", "Betreff", "Nachricht", "Datum", ""],
      rows,
      footer: paginationFooter({
        action: "load-contacts",
        limit: PAGE_LIMIT,
        offset: contactsOffset,
        total,
      }),
    })
  );
}

async function deleteContact(id) {
  if (!(await showConfirm("Nachricht löschen", `Kontaktnachricht #${id} wirklich löschen?`)))
    return;
  try {
    await apiCall("delete-contact", { id });
    showToast(`Nachricht #${id} gelöscht.`);
    await loadContacts(contactsOffset);
  } catch (e) {
    showError(e);
  }
}

/* =================================================================
   Comments
   ================================================================= */
let commentsOffset = 0;
let currentCommentsPostId = null;

async function loadComments(offset = 0, postId = currentCommentsPostId) {
  commentsOffset = offset;
  currentCommentsPostId =
    typeof postId === "string" && postId.trim() ? postId.trim() : postId || null;
  const params = { limit: PAGE_LIMIT, offset };
  if (currentCommentsPostId) params.postId = currentCommentsPostId;
  const data = await apiCall("blog-comments", params);
  renderComments(data);
}

function renderComments(data) {
  const comments = data.comments || [];
  const total = data.total || 0;

  if (comments.length === 0) {
    setHtml("comments-content", emptyState("Keine Kommentare vorhanden.", "💬"));
    return;
  }

  const rows = comments
    .map(
      c => `<tr>
      <td>${c.id}</td>
      <td title="${esc(c.post_id)}">${esc(truncate(c.post_id, 25))}</td>
      <td>${esc(c.author_name)}</td>
      <td title="${esc(c.content)}">${esc(truncate(c.content, 60))}</td>
      <td>${formatDate(c.created_at)}</td>
      <td>
        <button class="btn btn--danger btn--sm" type="button" data-action="delete-comment" data-id="${c.id}">
          🗑️
        </button>
      </td>
    </tr>`
    )
    .join("");

  setHtml(
    "comments-content",
    tableHtml({
      title: `Kommentare (${total})`,
      headers: ["ID", "Post", "Autor", "Inhalt", "Datum", ""],
      rows,
      actions: `<input class="search-input" id="comment-filter" placeholder="Nach Post-ID filtern…" value="${esc(currentCommentsPostId || "")}" />`,
      footer: paginationFooter({
        action: "load-comments",
        limit: PAGE_LIMIT,
        offset: commentsOffset,
        total,
      }),
    })
  );
}

async function deleteComment(id) {
  if (!(await showConfirm("Kommentar löschen", `Kommentar #${id} wirklich löschen?`))) return;
  try {
    await apiCall("delete-comment", { id });
    showToast(`Kommentar #${id} gelöscht.`);
    await loadComments(commentsOffset, currentCommentsPostId);
  } catch (e) {
    showError(e);
  }
}

/* =================================================================
   Likes
   ================================================================= */
async function loadLikes() {
  const [likesData, eventsData] = await Promise.all([
    apiCall("project-likes"),
    apiCall("like-events", { limit: 30 }),
  ]);
  renderLikes(likesData, eventsData);
}

function renderLikes(likesData, eventsData) {
  const likes = likesData.likes || [];
  const events = eventsData.events || [];

  const likesRows = likes
    .map(
      l => `<tr>
      <td class="cell-primary">${esc(l.project_id)}</td>
      <td><span class="metric-value">${l.likes}</span></td>
    </tr>`
    )
    .join("");

  const eventsRows = events
    .map(
      e => `<tr>
      <td>${e.id}</td>
      <td>${esc(e.project_id)}</td>
      <td>${esc(truncate(e.source_ip || "—", 20))}</td>
      <td>${formatDate(e.created_at)}</td>
    </tr>`
    )
    .join("");

  setHtml(
    "likes-content",
    tableHtml({
      title: `Projekt-Likes (${likes.length})`,
      headers: ["Projekt", "Likes"],
      rows: likesRows,
      emptyText: "Keine Likes",
      extraClass: "table-container--spaced",
    }) +
      tableHtml({
        title: "Letzte Like-Events",
        headers: ["ID", "Projekt", "IP", "Datum"],
        rows: eventsRows,
        emptyText: "Keine Events",
      })
  );
}

/* =================================================================
   User Memories
   ================================================================= */
async function loadMemories() {
  const data = await apiCall("user-memories");
  renderUserList(data);
}

function renderUserList(data) {
  const users = data.users || [];

  if (users.length === 0) {
    setHtml("memories-content", emptyState("Keine Benutzer-Profile gefunden.", "🧠"));
    return;
  }

  const cards = users
    .map(
      (u, i) => `
      <div class="user-card ${getStaggerClass(i, "04")}" data-user-id="${encodeDataValue(u.userId)}" data-action="select-user">
        <div class="user-avatar">${esc(u.userId.charAt(0).toUpperCase())}</div>
        <div class="user-info">
          <div class="user-id">${esc(u.userId)}</div>
          <div class="user-label">Zum Anzeigen klicken</div>
        </div>
      </div>`
    )
    .join("");

  setHtml(
    "memories-content",
    `
    <div class="user-list">${cards}</div>
    <div id="memory-detail-area"></div>`
  );
}

async function selectUser(userId) {
  const encodedUserId = encodeDataValue(userId);

  // Highlight
  document
    .querySelectorAll(".user-card")
    .forEach(card => card.classList.toggle("selected", card.dataset.userId === encodedUserId));

  const area = byId("memory-detail-area");
  area.innerHTML =
    '<div class="loading-center"><span class="spinner"></span> Lade Erinnerungen…</div>';

  try {
    const data = await apiCall("user-memory-detail", { userId });
    renderMemoryDetail(data, userId);
  } catch (e) {
    area.innerHTML = emptyState(errorMessage(e));
  }
}

function renderMemoryDetail(data, userId) {
  const memories = data.memories || [];
  const profile = data.profile || {};
  const area = byId("memory-detail-area");

  const profileHtml = `
    <div class="profile-header">
      <div>
        <span class="profile-label">${esc(profile.label || userId)}</span>
        <span class="profile-status">${esc(profile.status || "unknown")}</span>
      </div>
      <div class="inline-actions">
        <button class="btn btn--sm" type="button" data-action="refresh-user" data-user-id="${encodeDataValue(userId)}">🔄 Neu laden</button>
        <button class="btn btn--danger btn--sm" type="button" data-action="delete-user-profile" data-user-id="${encodeDataValue(userId)}">🗑️ Profil löschen</button>
      </div>
    </div>`;

  if (memories.length === 0) {
    area.innerHTML = profileHtml + emptyState("Keine Erinnerungen gespeichert.");
    return;
  }

  const cards = memories
    .map(
      (m, i) => `
      <div class="memory-card ${getStaggerClass(i, "04")}" id="mem-${i}">
        <div class="memory-card-header">
          <span class="memory-key">${esc(m.key)}</span>
          <span class="memory-category">${esc(m.category)}</span>
        </div>
        <div class="memory-value">${esc(m.value)}</div>
        <div class="memory-meta">
          <span>Priorität: ${m.priority} · ${formatDate(m.timestamp)}</span>
        </div>
        <div class="memory-actions">
          <button class="btn btn--sm" type="button" data-action="toggle-memory-edit" data-index="${i}">✏️ Bearbeiten</button>
          <button class="btn btn--danger btn--sm" type="button" data-action="delete-memory" data-user-id="${encodeDataValue(userId)}" data-key="${encodeDataValue(m.key)}" data-value="${encodeDataValue(m.value)}">🗑️</button>
        </div>
        <div class="memory-edit-form" id="edit-form-${i}">
          <input type="text" value="${esc(m.key)}" id="edit-key-${i}" placeholder="Key" readonly
            class="memory-readonly-input" />
          <textarea rows="2" id="edit-val-${i}" placeholder="Neuer Wert">${esc(m.value)}</textarea>
          <div class="inline-actions">
            <button class="btn btn--accent btn--sm" type="button" data-action="save-memory-edit" data-user-id="${encodeDataValue(userId)}" data-key="${encodeDataValue(m.key)}" data-previous-value="${encodeDataValue(m.value)}" data-index="${i}">💾 Speichern</button>
            <button class="btn btn--sm" type="button" data-action="toggle-memory-edit" data-index="${i}">Abbrechen</button>
          </div>
        </div>
      </div>`
    )
    .join("");

  area.innerHTML = profileHtml + `<div class="memory-grid">${cards}</div>`;
}

function toggleEditMemory(index) {
  const form = byId(`edit-form-${index}`);
  form?.classList.toggle("active");
}

async function saveMemoryEdit(userId, key, previousValue, index) {
  const newValue = byId(`edit-val-${index}`)?.value?.trim();
  if (!newValue) return showToast("Wert darf nicht leer sein.", "error");

  try {
    await apiCall("update-user-memory", { userId, key, value: newValue, previousValue });
    showToast(`${key} aktualisiert.`);
    await selectUser(userId);
  } catch (e) {
    showError(e);
  }
}

async function deleteMemory(userId, key, value) {
  if (
    !(await showConfirm("Erinnerung löschen", `"${key}: ${truncate(value, 40)}" wirklich löschen?`))
  )
    return;
  try {
    await apiCall("delete-user-memory", { userId, key, value });
    showToast(`${key} gelöscht.`);
    await selectUser(userId);
  } catch (e) {
    showError(e);
  }
}

async function deleteUserProfileAction(userId) {
  if (
    !(await showConfirm(
      "Profil löschen",
      `Das gesamte Profil "${userId}" wird gelöscht (KV + Vectorize). Fortfahren?`
    ))
  )
    return;
  try {
    await apiCall("delete-user-profile", { userId });
    showToast("Profil gelöscht.");
    viewDataLoaded.memories = false;
    await loadMemories();
  } catch (e) {
    showError(e);
  }
}

/* =================================================================
   Gallery
   ================================================================= */
async function loadGallery() {
  const data = await apiCall("gallery-list");
  renderGallery(data);
}

function renderGallery(data) {
  const items = data.items || [];

  if (items.length === 0) {
    setHtml("gallery-content", emptyState("Keine Objekte im R2-Bucket.", "🖼️"));
    return;
  }

  const cards = items
    .map((item, i) => {
      const key = String(item.key || "");
      return `
      <div class="gallery-item ${getStaggerClass(i, "03")}">
          <div class="gallery-thumb">${fileIcon(key)}</div>
        <div class="gallery-info">
          <div class="gallery-name" title="${esc(key)}">${esc(fileName(key))}</div>
          <div class="gallery-size">${formatBytes(item.size)} · ${esc(item.httpMetadata?.contentType || "—")}</div>
        </div>
      </div>`;
    })
    .join("");

  setHtml(
    "gallery-content",
    `
    <div class="gallery-summary">${items.length} Objekte im Bucket</div>
    <div class="gallery-grid">${cards}</div>`
  );
}

/* =================================================================
   KV / Cache
   ================================================================= */
async function loadKv(namespace) {
  const data = await apiCall("kv-overview", { namespace });
  renderKv(data, namespace);
}

function renderKv(data, namespace) {
  const keys = data.keys || [];
  const tabs = [
    { id: "memory", label: "🧠 Memory KV", active: namespace === "memory" },
    { id: "ratelimit", label: "⏱️ Rate Limit KV", active: namespace === "ratelimit" },
    { id: "cache", label: "🗃️ Cache KV", active: namespace === "cache" },
  ];

  const tabsHtml = tabs
    .map(
      t =>
        `<button class="kv-tab ${t.active ? "active" : ""}" type="button" data-action="load-kv" data-namespace="${t.id}">${t.label}</button>`
    )
    .join("");

  const rows = keys
    .map(
      k => `<tr>
      <td class="cell-primary--truncate" title="${esc(k.name)}">${esc(truncate(k.name, 70))}</td>
      <td>${k.expiration ? formatDate(k.expiration * 1000) : "—"}</td>
    </tr>`
    )
    .join("");

  const cacheActions =
    namespace === "cache"
      ? `<button class="btn btn--danger btn--sm" type="button" data-action="clear-cache">🧹 Cache leeren</button>`
      : "";

  setHtml(
    "kv-content",
    `<div class="kv-tabs">${tabsHtml}</div>` +
      tableHtml({
        title: `${data.total || 0} Keys${data.listComplete ? "" : " (weitere vorhanden)"}`,
        headers: ["Key", "Ablauf"],
        rows,
        emptyText: "Keine Keys",
        actions: cacheActions,
      })
  );
}

async function clearCacheAction() {
  if (
    !(await showConfirm(
      "Cache leeren",
      "Alle Einträge im Sitemap/Template-Cache werden gelöscht. Fortfahren?"
    ))
  )
    return;
  try {
    const data = await apiCall("clear-cache");
    showToast(data.text || "Cache geleert.");
    await loadKv("cache");
  } catch (e) {
    showError(e);
  }
}

/* =================================================================
   Init
   ================================================================= */
(async function init() {
  if (adminToken) {
    try {
      const data = await apiCall("dashboard");
      if (data.success) {
        hideLogin();
        renderDashboard(data);
        viewDataLoaded.dashboard = true;
        return;
      }
    } catch {
      /* token invalid */
    }
  }
  showLogin();
})();
