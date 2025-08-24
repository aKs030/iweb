# iweb – Digital Portfolio

A modular, static, and accessible digital portfolio.  
Built with **vanilla HTML, CSS, and JavaScript (ESM)** – no build tools required.

---

## ✨ Features

- **Lazy Section Loading** via `SectionLoader` (`data-section-src`)
- **Dynamic Particle System** with adaptive FPS scaling
- **Accessible by Design**: skip-links, ARIA live regions, reduced-motion support
- **Responsive UI** with CSS Tokens (`root.css`) and `clamp()`
- **Zero Build Step**: runs directly in the browser
- **Modular Components**:
  - `menu/` – dynamic navigation
  - `footer/` – auto-measured height
  - `particles/` – canvas particle system
  - `animations/` – intersection-based animations
  - `utils/` – common utilities (debounce, throttle, logger)

---

## 🚀 Getting Started

Clone the repository and open it in a browser – no build step required.

```bash
git clone https://github.com/aKs030/iweb.git
cd iweb

Use a local dev server for easy iteration (e.g., live-server):

npm install -g live-server
live-server


⸻

📂 Project Structure

iweb/
│── content/webentwicklung/   # Core reusable components
│   ├── menu/                 # Dynamic navigation
│   ├── particles/            # Particle system
│   ├── footer/               # Footer
│   ├── animations/           # Intersection animations
│   ├── utils/                # Utilities (logger, throttle, cache)
│   └── root.css              # Design tokens
│
│── pages/                    # Page-specific modules
│   ├── home/                 # Hero, greeting text
│   ├── about/                # About section
│   └── card/                 # Feature cards
│
│── scripts/                  # Maintenance scripts (tokens, checks)
│── tests/                    # Vitest unit tests
│── index.html                # Main entry


⸻

🛠 Development

Run Tests

npm test          # Single run
npm run test:watch
npm run test:cov  # Coverage

Lint & Validate

npm run lint:html     # HTML validation
npm run check:css     # CSS token consistency
npm run consolidate:css


⸻

🔒 Security
	•	Only actively maintained versions receive security updates.
	•	Please report vulnerabilities via SECURITY.md (not via public issues).

⸻

📜 License

This project is licensed under the MIT License – see LICENSE for details.
