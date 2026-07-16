import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toAbsoluteAppUrl } from "../utils/project-browse.js";

function buildPopupAppUrl(rawUrl) {
  const normalizedUrl = toAbsoluteAppUrl(rawUrl);
  if (!normalizedUrl) return "";

  try {
    const url = new URL(normalizedUrl, window.location.origin);
    url.searchParams.set("card", "1");
    url.searchParams.set("popup", "1");
    return url.toString();
  } catch {
    const separator = normalizedUrl.includes("?") ? "&" : "?";
    return `${normalizedUrl}${separator}card=1&popup=1`;
  }
}

export function useProjectPopup(fallbackTitle) {
  const [popupApp, setPopupApp] = useState(null);
  const [popupSize, setPopupSize] = useState(null);
  const popupFrameRef = useRef(null);
  const popupOverlayRef = useRef(null);

  const closeAppPopup = useCallback(() => setPopupApp(null), []);
  const openAppPopup = useCallback(
    (event, project) => {
      event.preventDefault();
      const url = buildPopupAppUrl(project?.appPath);
      if (!url) return;

      setPopupApp({
        title: project?.title || fallbackTitle,
        url,
      });
    },
    [fallbackTitle]
  );
  const requestPopupFit = useCallback(() => {
    const frameWindow = popupFrameRef.current?.contentWindow;
    if (!frameWindow) return;

    try {
      frameWindow.postMessage({ type: "card-fit-request" }, "*");
    } catch {
      // Cross-origin previews can reject messaging during navigation.
    }
  }, []);

  useEffect(() => {
    if (!popupApp) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("projects-popup-open");
    setPopupSize(null);

    const onKeyDown = event => {
      if (event.key === "Escape") closeAppPopup();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.classList.remove("projects-popup-open");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeAppPopup, popupApp]);

  useEffect(() => {
    if (!popupApp) return;

    const onMessage = event => {
      const payload = event.data;
      if (!payload || payload.type !== "card-fit-size") return;

      const frameWindow = popupFrameRef.current?.contentWindow;
      if (frameWindow && event.source !== frameWindow) return;

      const width = Number(payload.width);
      const height = Number(payload.height);
      if (!Number.isFinite(width) || !Number.isFinite(height)) return;

      setPopupSize({
        width: Math.max(320, Math.min(1600, Math.round(width))),
        height: Math.max(240, Math.min(1200, Math.round(height))),
      });
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [popupApp]);

  useEffect(() => {
    const overlay = popupOverlayRef.current;
    if (!overlay) return;
    const frameId = requestAnimationFrame(() => overlay.classList.add("is-active"));
    return () => cancelAnimationFrame(frameId);
  }, [popupApp]);

  useEffect(() => {
    if (!popupApp) return;

    const requestFit = () => requestAnimationFrame(requestPopupFit);
    const resizeTimer = window.setTimeout(requestFit, 120);
    const lateTimer = window.setTimeout(requestFit, 420);
    window.addEventListener("resize", requestFit, { passive: true });

    return () => {
      window.clearTimeout(resizeTimer);
      window.clearTimeout(lateTimer);
      window.removeEventListener("resize", requestFit);
    };
  }, [popupApp, requestPopupFit]);

  const popupPanelStyle = useMemo(
    () =>
      popupSize
        ? {
            width: `min(calc(100vw - 1rem), ${Math.max(420, popupSize.width + 36)}px)`,
            height: `min(calc(var(--viewport-height, 100vh) - 1rem), ${Math.max(
              380,
              popupSize.height + 86
            )}px)`,
          }
        : null,
    [popupSize]
  );

  return {
    popupApp,
    popupFrameRef,
    popupOverlayRef,
    popupPanelStyle,
    closeAppPopup,
    openAppPopup,
    requestPopupFit,
  };
}
