/* =================================================================
   State
   ================================================================= */
let adminToken = sessionStorage.getItem("admin_token") || "";
let viewDataLoaded = {};

// Base URL for API
const API_BASE = "/api/admin";

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
  const data = await res.json();
  if (!res.ok && res.status === 401) {
    sessionStorage.removeItem("admin_token");
    adminToken = "";
    showLogin();
    throw new Error("Nicht autorisiert");
  }
  return data;
}

/* =================================================================
   Toast
   ================================================================= */
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("is-leaving");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/* =================================================================
   Confirm Dialog
   ================================================================= */
function showConfirm(title, message) {
  return new Promise(resolve => {
    const container = document.getElementById("confirm-container");
    container.innerHTML = `
      <div class="confirm-overlay" id="confirm-overlay">
        <div class="confirm-dialog">
          <h3>${title}</h3>
          <p>${message}</p>
          <div class="confirm-actions">
            <button class="btn" id="confirm-cancel">Abbrechen</button>
            <button class="btn btn--danger" id="confirm-ok">Löschen</button>
          </div>
        </div>
      </div>`;
    document.getElementById("confirm-cancel").onclick = () => {
      container.innerHTML = "";
      resolve(false);
    };
    document.getElementById("confirm-ok").onclick = () => {
      container.innerHTML = "";
      resolve(true);
    };
  });
}

/* =================================================================
   Helpers
   ================================================================= */
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
    const date = new Date(typeof d === "number" ? d : d);
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

/* =================================================================
   Login
   ================================================================= */
function showLogin() {
  document.getElementById("login-overlay").classList.remove("hidden");
  document.getElementById("app").classList.remove("active");
}

function hideLogin() {
  document.getElementById("login-overlay").classList.add("hidden");
  document.getElementById("app").classList.add("active");
}

document.getElementById("login-btn").addEventListener("click", async () => {
  const token = document.getElementById("login-token").value.trim();
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
    document.getElementById("login-error").textContent = "Token ungültig oder Server-Fehler.";
    adminToken = "";
  }
});

document.getElementById("login-token").addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("login-btn").click();
});

document.getElementById("logout-btn").addEventListener("click", () => {
  sessionStorage.removeItem("admin_token");
  adminToken = "";
  viewDataLoaded = {};
  showLogin();
});

/* =================================================================
   Navigation
   ================================================================= */
document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => {
    const view = btn.dataset.view;
    switchView(view);
    // Close mobile sidebar
    document.getElementById("sidebar").classList.remove("open");
  });
});

document.getElementById("mobile-toggle").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("open");
});

document.addEventListener("click", event => {
  const clickedElement = event.target instanceof Element ? event.target : null;
  if (!clickedElement) return;

  const actionTarget = clickedElement.closest("[data-action]");
  if (!(actionTarget instanceof HTMLElement)) return;

  const getNumber = name => {
    const value = Number.parseInt(actionTarget.dataset[name] || "", 10);
    return Number.isFinite(value) ? value : null;
  };

  switch (actionTarget.dataset.action) {
    case "delete-contact": {
      const id = getNumber("id");
      if (id !== null) void deleteContact(id);
      break;
    }
    case "load-contacts": {
      const offset = getNumber("offset");
      if (offset !== null) void loadContacts(offset);
      break;
    }
    case "delete-comment": {
      const id = getNumber("id");
      if (id !== null) void deleteComment(id);
      break;
    }
    case "load-comments": {
      const offset = getNumber("offset");
      if (offset !== null) void loadComments(offset, currentCommentsPostId);
      break;
    }
    case "select-user": {
      const userId = decodeDataValue(actionTarget.dataset.userId);
      if (userId) void selectUser(userId);
      break;
    }
    case "refresh-user": {
      const userId = decodeDataValue(actionTarget.dataset.userId);
      if (userId) void selectUser(userId);
      break;
    }
    case "delete-user-profile": {
      const userId = decodeDataValue(actionTarget.dataset.userId);
      if (userId) void deleteUserProfileAction(userId);
      break;
    }
    case "toggle-memory-edit": {
      const index = getNumber("index");
      if (index !== null) toggleEditMemory(index);
      break;
    }
    case "save-memory-edit": {
      const index = getNumber("index");
      const userId = decodeDataValue(actionTarget.dataset.userId);
      const key = decodeDataValue(actionTarget.dataset.key);
      const previousValue = decodeDataValue(actionTarget.dataset.previousValue);
      if (index !== null && userId && key) {
        void saveMemoryEdit(userId, key, previousValue, index);
      }
      break;
    }
    case "delete-memory": {
      const userId = decodeDataValue(actionTarget.dataset.userId);
      const key = decodeDataValue(actionTarget.dataset.key);
      const value = decodeDataValue(actionTarget.dataset.value);
      if (userId && key) void deleteMemory(userId, key, value);
      break;
    }
    case "load-kv": {
      const namespace = actionTarget.dataset.namespace || "";
      if (namespace) void loadKv(namespace);
      break;
    }
    case "clear-cache":
      void clearCacheAction();
      break;
  }
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
  document.getElementById(`view-${view}`)?.classList.add("active");
  if (!viewDataLoaded[view]) loadViewData(view);
}

async function loadViewData(view) {
  try {
    switch (view) {
      case "dashboard":
        renderDashboard(await apiCall("dashboard"));
        break;
      case "contacts":
        await loadContacts();
        break;
      case "comments":
        await loadComments();
        break;
      case "likes":
        await loadLikes();
        break;
      case "memories":
        await loadMemories();
        break;
      case "gallery":
        await loadGallery();
        break;
      case "kv":
        await loadKv("memory");
        break;
    }
    viewDataLoaded[view] = true;
  } catch (err) {
    showToast("Fehler beim Laden: " + err.message, "error");
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

  document.getElementById("stats-grid").innerHTML = items
    .map(
      (item, i) => `
    <div class="stat-card ${getStaggerClass(i, "06", 7)}">
      <div class="stat-icon">${item.icon}</div>
      <div class="stat-value">${item.value}</div>
      <div class="stat-label">${item.label}</div>
    </div>`
    )
    .join("");
}

/* =================================================================
   Contacts
   ================================================================= */
let contactsOffset = 0;
const CONTACTS_LIMIT = 20;

async function loadContacts(offset = 0) {
  contactsOffset = offset;
  const data = await apiCall("contact-messages", { limit: CONTACTS_LIMIT, offset });
  renderContacts(data);
}

function renderContacts(data) {
  const messages = data.messages || [];
  const total = data.total || 0;

  if (messages.length === 0) {
    document.getElementById("contacts-content").innerHTML = `
      <div class="empty-state"><div class="empty-state-icon">✉️</div>
      <div class="empty-state-text">Keine Kontakt-Nachrichten vorhanden.</div></div>`;
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

  document.getElementById("contacts-content").innerHTML = `
    <div class="table-container">
      <div class="table-header">
        <div class="table-title">Nachrichten (${total})</div>
      </div>
      <div class="table-scroll">
        <table>
          <thead><tr><th>ID</th><th>Name</th><th>E-Mail</th><th>Betreff</th><th>Nachricht</th><th>Datum</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="table-footer">
        <span>${contactsOffset + 1}–${Math.min(contactsOffset + CONTACTS_LIMIT, total)} von ${total}</span>
        <div class="pagination">
          ${contactsOffset > 0 ? `<button class="btn btn--sm" type="button" data-action="load-contacts" data-offset="${contactsOffset - CONTACTS_LIMIT}">← Zurück</button>` : ""}
          ${contactsOffset + CONTACTS_LIMIT < total ? `<button class="btn btn--sm" type="button" data-action="load-contacts" data-offset="${contactsOffset + CONTACTS_LIMIT}">Weiter →</button>` : ""}
        </div>
      </div>
    </div>`;
}

async function deleteContact(id) {
  if (!(await showConfirm("Nachricht löschen", `Kontaktnachricht #${id} wirklich löschen?`)))
    return;
  try {
    await apiCall("delete-contact", { id });
    showToast(`Nachricht #${id} gelöscht.`);
    await loadContacts(contactsOffset);
  } catch (e) {
    showToast("Fehler: " + e.message, "error");
  }
}

/* =================================================================
   Comments
   ================================================================= */
let commentsOffset = 0;
const COMMENTS_LIMIT = 20;
let currentCommentsPostId = null;

async function loadComments(offset = 0, postId = currentCommentsPostId) {
  commentsOffset = offset;
  currentCommentsPostId =
    typeof postId === "string" && postId.trim() ? postId.trim() : postId || null;
  const params = { limit: COMMENTS_LIMIT, offset };
  if (currentCommentsPostId) params.postId = currentCommentsPostId;
  const data = await apiCall("blog-comments", params);
  renderComments(data);
}

function renderComments(data) {
  const comments = data.comments || [];
  const total = data.total || 0;

  if (comments.length === 0) {
    document.getElementById("comments-content").innerHTML = `
      <div class="empty-state"><div class="empty-state-icon">💬</div>
      <div class="empty-state-text">Keine Kommentare vorhanden.</div></div>`;
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

  document.getElementById("comments-content").innerHTML = `
    <div class="table-container">
      <div class="table-header">
        <div class="table-title">Kommentare (${total})</div>
        <div class="table-actions">
          <input class="search-input" id="comment-filter" placeholder="Nach Post-ID filtern…" value="${esc(currentCommentsPostId || "")}" />
        </div>
      </div>
      <div class="table-scroll">
        <table>
          <thead><tr><th>ID</th><th>Post</th><th>Autor</th><th>Inhalt</th><th>Datum</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="table-footer">
        <span>${commentsOffset + 1}–${Math.min(commentsOffset + COMMENTS_LIMIT, total)} von ${total}</span>
        <div class="pagination">
          ${commentsOffset > 0 ? `<button class="btn btn--sm" type="button" data-action="load-comments" data-offset="${commentsOffset - COMMENTS_LIMIT}">← Zurück</button>` : ""}
          ${commentsOffset + COMMENTS_LIMIT < total ? `<button class="btn btn--sm" type="button" data-action="load-comments" data-offset="${commentsOffset + COMMENTS_LIMIT}">Weiter →</button>` : ""}
        </div>
      </div>
    </div>`;
}

async function deleteComment(id) {
  if (!(await showConfirm("Kommentar löschen", `Kommentar #${id} wirklich löschen?`))) return;
  try {
    await apiCall("delete-comment", { id });
    showToast(`Kommentar #${id} gelöscht.`);
    await loadComments(commentsOffset, currentCommentsPostId);
  } catch (e) {
    showToast("Fehler: " + e.message, "error");
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

  document.getElementById("likes-content").innerHTML = `
    <div class="table-container table-container--spaced">
      <div class="table-header"><div class="table-title">Projekt-Likes (${likes.length})</div></div>
      <div class="table-scroll">
        <table>
          <thead><tr><th>Projekt</th><th>Likes</th></tr></thead>
          <tbody>${likesRows || '<tr><td colspan="2" class="table-empty-cell">Keine Likes</td></tr>'}</tbody>
        </table>
      </div>
    </div>
    <div class="table-container">
      <div class="table-header"><div class="table-title">Letzte Like-Events</div></div>
      <div class="table-scroll">
        <table>
          <thead><tr><th>ID</th><th>Projekt</th><th>IP</th><th>Datum</th></tr></thead>
          <tbody>${eventsRows || '<tr><td colspan="4" class="table-empty-cell">Keine Events</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
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
    document.getElementById("memories-content").innerHTML = `
      <div class="empty-state"><div class="empty-state-icon">🧠</div>
      <div class="empty-state-text">Keine Benutzer-Profile gefunden.</div></div>`;
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

  document.getElementById("memories-content").innerHTML = `
    <div class="user-list">${cards}</div>
    <div id="memory-detail-area"></div>`;
}

async function selectUser(userId) {
  const encodedUserId = encodeDataValue(userId);

  // Highlight
  document
    .querySelectorAll(".user-card")
    .forEach(card => card.classList.toggle("selected", card.dataset.userId === encodedUserId));

  const area = document.getElementById("memory-detail-area");
  area.innerHTML =
    '<div class="loading-center"><span class="spinner"></span> Lade Erinnerungen…</div>';

  try {
    const data = await apiCall("user-memory-detail", { userId });
    renderMemoryDetail(data, userId);
  } catch (e) {
    area.innerHTML = `<div class="empty-state"><div class="empty-state-text">Fehler: ${esc(e.message)}</div></div>`;
  }
}

function renderMemoryDetail(data, userId) {
  const memories = data.memories || [];
  const profile = data.profile || {};
  const area = document.getElementById("memory-detail-area");

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
    area.innerHTML =
      profileHtml +
      `<div class="empty-state"><div class="empty-state-text">Keine Erinnerungen gespeichert.</div></div>`;
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
  const form = document.getElementById(`edit-form-${index}`);
  form?.classList.toggle("active");
}

async function saveMemoryEdit(userId, key, previousValue, index) {
  const newValue = document.getElementById(`edit-val-${index}`)?.value?.trim();
  if (!newValue) return showToast("Wert darf nicht leer sein.", "error");

  try {
    await apiCall("update-user-memory", { userId, key, value: newValue, previousValue });
    showToast(`${key} aktualisiert.`);
    await selectUser(userId);
  } catch (e) {
    showToast("Fehler: " + e.message, "error");
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
    showToast("Fehler: " + e.message, "error");
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
    showToast("Fehler: " + e.message, "error");
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
    document.getElementById("gallery-content").innerHTML = `
      <div class="empty-state"><div class="empty-state-icon">🖼️</div>
      <div class="empty-state-text">Keine Objekte im R2-Bucket.</div></div>`;
    return;
  }

  function getFileIcon(key) {
    const ext = key.split(".").pop().toLowerCase();
    if (["jpg", "jpeg", "png", "webp", "avif", "gif"].includes(ext)) return "🖼️";
    if (["mp4", "webm", "mov"].includes(ext)) return "🎬";
    if (["svg"].includes(ext)) return "🎨";
    return "📄";
  }

  const cards = items
    .map(
      (item, i) => `
      <div class="gallery-item ${getStaggerClass(i, "03")}">
        <div class="gallery-thumb">${getFileIcon(item.key)}</div>
        <div class="gallery-info">
          <div class="gallery-name" title="${esc(item.key)}">${esc(item.key.split("/").pop())}</div>
          <div class="gallery-size">${formatBytes(item.size)} · ${item.httpMetadata?.contentType || "—"}</div>
        </div>
      </div>`
    )
    .join("");

  document.getElementById("gallery-content").innerHTML = `
    <div class="gallery-summary">${items.length} Objekte im Bucket</div>
    <div class="gallery-grid">${cards}</div>`;
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

  document.getElementById("kv-content").innerHTML = `
    <div class="kv-tabs">${tabsHtml}</div>
    <div class="table-container">
      <div class="table-header">
        <div class="table-title">${data.total || 0} Keys${data.listComplete ? "" : " (weitere vorhanden)"}</div>
        <div class="table-actions">${cacheActions}</div>
      </div>
      <div class="table-scroll">
        <table>
          <thead><tr><th>Key</th><th>Ablauf</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="2" class="table-empty-cell">Keine Keys</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
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
    showToast("Fehler: " + e.message, "error");
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
