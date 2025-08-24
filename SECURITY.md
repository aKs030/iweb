# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 5.1.x   | ✅ |
| 5.0.x   | ❌ |
| 4.0.x   | ✅ |
| < 4.0   | ❌ |

Only the versions marked with ✅ receive security updates. Older releases (❌) are no longer maintained.

---

## Reporting a Vulnerability

If you discover a security vulnerability in **iweb**, please **do not report it publicly via Issues**.  
Instead, contact us directly at:

📧 mail@abdulkerimsesli.de

We will acknowledge receipt within **72 hours** and provide regular updates until the issue is resolved.  
Please do not publicly disclose the vulnerability until a fix has been released.  

---

## Scope

Since **iweb** is a static frontend project without a backend or database, relevant security concerns are mainly:

- **Cross-Site Scripting (XSS)**: Avoid unsafe usage of `innerHTML`  
- **Content Security Policy (CSP)**: Recommended to restrict external scripts and styles  
- **External Dependencies**: Regular checks via `npm audit` and GitHub Dependabot  
- **Accessibility & Security**: ARIA attributes and live regions must not be exploitable  

---

## Contributor Guidelines

When submitting code (Pull Requests), please ensure that:  
- No new unsafe inline scripts (`innerHTML`, `dangerouslySetInnerHTML`) are introduced  
- Accessibility is preserved (A11y features must not be broken)  
- External dependencies remain minimal and up to date  
- Logging (`utils/logger.js`) does not expose sensitive data  

---
