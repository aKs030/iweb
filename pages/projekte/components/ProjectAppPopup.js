import { createElement as h } from "react";
import { createPortal } from "react-dom";

export function ProjectAppPopup({
  popupApp,
  panelStyle,
  frameRef,
  overlayRef,
  onClose,
  onRequestFit,
  t,
}) {
  if (!popupApp || typeof document === "undefined" || !document.body) return null;

  return createPortal(
    h(
      "div",
      {
        className: "app-popup",
        ref: overlayRef,
        role: "dialog",
        "aria-modal": "true",
        "aria-label": t("projects.app.popup_title", "App popup"),
        onClick: event => {
          if (event.target === event.currentTarget) onClose();
        },
      },
      h(
        "div",
        { className: "app-popup__panel", style: panelStyle },
        h(
          "div",
          { className: "app-popup__header" },
          h(
            "div",
            { className: "app-popup__title-wrap" },
            h(
              "span",
              { className: "app-popup__label" },
              t("projects.launch.source", "Curated app catalog")
            ),
            h("strong", { className: "app-popup__title" }, popupApp.title)
          ),
          h(
            "div",
            { className: "app-popup__actions" },
            h(
              "a",
              {
                href: popupApp.url,
                target: "_blank",
                rel: "noopener noreferrer",
                className: "btn btn-outline app-popup__action",
              },
              t("projects.app.open_tab", "Open in new tab")
            ),
            h(
              "button",
              {
                type: "button",
                className: "btn btn-primary app-popup__action",
                onClick: onClose,
              },
              t("projects.app.close", "Close")
            )
          )
        ),
        h(
          "div",
          { className: "app-popup__frame-wrap" },
          h("iframe", {
            className: "app-popup__frame",
            ref: frameRef,
            src: popupApp.url,
            title: popupApp.title,
            loading: "eager",
            allow: "clipboard-read; clipboard-write; fullscreen",
            referrerPolicy: "no-referrer-when-downgrade",
            onLoad: onRequestFit,
          })
        )
      )
    ),
    document.body
  );
}
