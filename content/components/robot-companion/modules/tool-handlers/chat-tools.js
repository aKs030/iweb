import { fire } from "../../../../core/events.js";
import { ROBOT_EVENTS } from "../../constants/events.js";
import { getRobotAvatarButton, getRobotImageUploadInput } from "../tool-dom-utils.js";
import { buildToolResult } from "../tool-result.js";

function scheduleImageUploadTrigger(attemptsLeft = 30) {
  const input = getRobotImageUploadInput();
  if (input) {
    input.click();
    return true;
  }

  if (attemptsLeft <= 0) return false;

  globalThis.setTimeout(() => {
    scheduleImageUploadTrigger(attemptsLeft - 1);
  }, 90);

  return false;
}

export function executeOpenImageUpload() {
  const input = getRobotImageUploadInput();
  if (input) {
    input.click();
    return buildToolResult("openImageUpload", {}, true, "Bild-Upload geöffnet.", {
      summary: "Der Dateidialog für Bilder wurde geöffnet.",
    });
  }

  const avatar = getRobotAvatarButton();
  if (!avatar) {
    return buildToolResult("openImageUpload", {}, false, "Bild-Upload nicht gefunden.", {
      summary: "Das Upload-Feld ist auf dieser Seite nicht verfügbar.",
      accent: "error",
      cta: false,
    });
  }

  avatar.click();
  scheduleImageUploadTrigger();

  return buildToolResult("openImageUpload", {}, true, "Bild-Upload wird vorbereitet.", {
    summary: "Der Chat wird geöffnet, danach startet der Bilddialog automatisch.",
  });
}

export function executeClearChatHistory() {
  fire(ROBOT_EVENTS.CHAT_HISTORY_CLEARED, {}, document);
  return buildToolResult("clearChatHistory", {}, true, "Chatverlauf gelöscht.", {
    summary: "Die aktuelle Unterhaltung wurde zurückgesetzt.",
    cta: false,
  });
}
