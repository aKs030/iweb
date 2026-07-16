import React from "react";
import { AlertCircle, CheckCircle, Loader2, Send } from "lucide-react";
import { i18n } from "../../core/i18n.js";
import { createLogger } from "../../core/logger.js";

const log = createLogger("ContactForm");

const { createElement: h, Fragment } = React;

const COPY = Object.freeze({
  de: Object.freeze({
    eyebrow: "Kontakt & Zusammenarbeit",
    formTitle: "Erzähl mir von deiner Idee.",
    formSubtitle: "Ein paar klare Eckpunkte reichen für den Anfang.",
    nameLabel: "Dein Name",
    namePlaceholder: "Max Mustermann",
    emailFieldLabel: "Deine E-Mail",
    emailPlaceholder: "name@beispiel.de",
    subjectLabel: "Thema",
    subjectPlaceholder: "Projekt, Zusammenarbeit oder Frage",
    messageLabel: "Nachricht",
    messagePlaceholder: "Was möchtest du umsetzen, verbessern oder besprechen?",
    submitLabel: "Anfrage senden",
    submittingLabel: "Wird gesendet …",
    successTitle: "Deine Anfrage ist angekommen.",
    successText: "Danke! Ich melde mich so bald wie möglich bei dir.",
    newMessageLabel: "Neue Nachricht schreiben",
    errorNetwork: "Die Nachricht konnte gerade nicht gesendet werden.",
    errorFormat: "Die Antwort des Servers war nicht lesbar.",
    errorGeneric: "Beim Senden ist ein Fehler aufgetreten.",
    antiSpamLabel: "Spam-Schutzfeld",
    formNote: "Name, E-Mail und Nachricht sind erforderlich. Das Thema ist optional.",
  }),
  en: Object.freeze({
    eyebrow: "Contact & collaboration",
    formTitle: "Tell me about your idea.",
    formSubtitle: "A few clear details are enough to get started.",
    nameLabel: "Your name",
    namePlaceholder: "Alex Example",
    emailFieldLabel: "Your email",
    emailPlaceholder: "name@example.com",
    subjectLabel: "Subject",
    subjectPlaceholder: "Project, collaboration, or question",
    messageLabel: "Message",
    messagePlaceholder: "What would you like to build, improve, or discuss?",
    submitLabel: "Send inquiry",
    submittingLabel: "Sending …",
    successTitle: "Your inquiry has arrived.",
    successText: "Thank you! I will get back to you as soon as possible.",
    newMessageLabel: "Write another message",
    errorNetwork: "The message could not be sent right now.",
    errorFormat: "The server response could not be read.",
    errorGeneric: "Something went wrong while sending the message.",
    antiSpamLabel: "Spam protection field",
    formNote: "Name, email, and message are required. The subject is optional.",
  }),
});

function ContactForm() {
  const [lang, setLang] = React.useState(i18n.currentLang);
  const copy = COPY[lang] || COPY.de;
  const [formData, setFormData] = React.useState({
    name: "",
    email: "",
    subject: "",
    message: "",
    _gotcha: "",
  });

  const [status, setStatus] = React.useState("idle");
  const [errorMessage, setErrorMessage] = React.useState("");
  const successRef = React.useRef(null);

  React.useEffect(() => i18n.subscribe(setLang), []);

  React.useEffect(() => {
    if (status === "success" && successRef.current) {
      successRef.current.focus();
    }
  }, [status]);

  const handleChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (formData._gotcha) return;

    setStatus("submitting");
    setErrorMessage("");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error(copy.errorFormat);
      }

      if (!response.ok) {
        throw new Error(data.error || copy.errorGeneric);
      }

      setStatus("success");
      setFormData({
        name: "",
        email: "",
        subject: "",
        message: "",
        _gotcha: "",
      });
    } catch (err) {
      log.error("Form submission failed:", err);
      setStatus("error");
      setErrorMessage(err.message || copy.errorNetwork);
    }
  };

  if (status === "success") {
    return h("div", { className: "contact-page-content" }, [
      h("div", { className: "contact-form-card" }, [
        h(
          "div",
          {
            ref: successRef,
            tabIndex: -1,
            role: "status",
            "aria-live": "polite",
            className: "status-message status-success status-success-panel",
          },
          [
            h(CheckCircle, { size: 64, className: "contact-success-icon" }),
            h("h2", { className: "contact-success-title" }, copy.successTitle),
            h("p", { className: "contact-success-text" }, copy.successText),
            h(
              "button",
              {
                className: "btn-submit btn-submit-inline",
                onClick: () => setStatus("idle"),
              },
              copy.newMessageLabel
            ),
          ]
        ),
      ]),
    ]);
  }

  return h("div", { className: "contact-page-content" }, [
    h("div", { className: "contact-form-card" }, [
      h("div", { className: "contact-form-header" }, [
        h("p", { className: "contact-eyebrow text-eyebrow" }, copy.eyebrow),
        h("h1", null, copy.formTitle),
        h("p", null, copy.formSubtitle),
      ]),
      h("form", { onSubmit: handleSubmit, className: "contact-form" }, [
        h("div", { className: "form-group" }, [
          h("label", { htmlFor: "name", className: "form-label" }, copy.nameLabel),
          h("input", {
            type: "text",
            id: "name",
            name: "name",
            value: formData.name,
            onChange: handleChange,
            required: true,
            autoComplete: "name",
            className: "form-input",
            placeholder: copy.namePlaceholder,
          }),
        ]),
        h("div", { className: "form-group" }, [
          h("label", { htmlFor: "email", className: "form-label" }, copy.emailFieldLabel),
          h("input", {
            type: "email",
            id: "email",
            name: "email",
            value: formData.email,
            onChange: handleChange,
            required: true,
            autoComplete: "email",
            className: "form-input",
            placeholder: copy.emailPlaceholder,
          }),
        ]),
        h("div", { className: "form-group" }, [
          h("label", { htmlFor: "subject", className: "form-label" }, copy.subjectLabel),
          h("input", {
            type: "text",
            id: "subject",
            name: "subject",
            value: formData.subject,
            onChange: handleChange,
            className: "form-input",
            placeholder: copy.subjectPlaceholder,
          }),
        ]),
        h("div", { className: "form-group" }, [
          h("label", { htmlFor: "message", className: "form-label" }, copy.messageLabel),
          h("textarea", {
            id: "message",
            name: "message",
            value: formData.message,
            onChange: handleChange,
            required: true,
            className: "form-textarea",
            placeholder: copy.messagePlaceholder,
          }),
        ]),
        h("p", { className: "form-hint" }, copy.formNote),
        h("input", {
          type: "text",
          name: "_gotcha",
          value: formData._gotcha,
          onChange: handleChange,
          className: "hidden-field",
          tabIndex: -1,
          autoComplete: "off",
          "aria-hidden": "true",
          "aria-label": copy.antiSpamLabel,
        }),
        status === "error" &&
          h(
            "div",
            {
              className: "status-message status-error status-error-inline",
              role: "alert",
              "aria-live": "assertive",
            },
            [h(AlertCircle, { size: 20 }), h("span", null, errorMessage)]
          ),
        h("div", { className: "form-actions" }, [
          h(
            "button",
            {
              type: "submit",
              className: "btn-submit",
              disabled: status === "submitting",
            },
            status === "submitting"
              ? h(Fragment, null, [
                  h(Loader2, { className: "spinner", size: 18 }),
                  " " + copy.submittingLabel,
                ])
              : h(Fragment, null, [h(Send, { size: 18 }), " " + copy.submitLabel])
          ),
        ]),
      ]),
    ]),
  ]);
}

export default ContactForm;
