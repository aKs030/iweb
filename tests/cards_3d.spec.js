<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <title>AKS Icon Generator</title>
    <style>
        body { font-family: sans-serif; background: #222; color: #fff; padding: 20px; text-align: center; }
        .preview { display: flex; flex-wrap: wrap; gap: 20px; justify-content: center; margin-top: 20px; }
        .card { background: #333; padding: 10px; border-radius: 8px; }
        canvas { border: 1px solid #555; background: repeating-linear-gradient(45deg, #333 0, #333 10px, #444 10px, #444 20px); }
        button { display: block; width: 100%; margin-top: 10px; padding: 10px; background: #07a1ff; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: bold; }
        button:hover { background: #0077cc; }
        h3 { margin: 0 0 10px 0; font-size: 14px; color: #aaa; }
    </style>
</head>
<body>
    <h1>Icon Generator</h1>
    <p>Klicke auf die Buttons, um deine neuen Icons herunterzuladen.</p>

    <div class="preview" id="container"></div>

    <svg id="sourceSvg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" style="display:none;">
        <defs>
            <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#07a1ff;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#0077cc;stop-opacity:1" />
            </linearGradient>
        </defs>
        <path fill="url(#grad1)" d="M256 64L64 448h96l48-112h96l48 112h96L256 64zm-56 208l56-128 56 128h-112z"/>
        <circle cx="256" cy="380" r="24" fill="#ffffff" />
    </svg>

    <script>
        const configs = [
            { name: "icon-192.png", size: 192, bg: "#0d0d0d", scale: 0.8 },
            { name: "icon-512.png", size: 512, bg: "#0d0d0d", scale: 0.8 },
            { name: "icon-maskable-512.png", size: 512, bg: "#0d0d0d", scale: 0.6 }, /* Kleiner skaliert für Safe-Zone */
            { name: "apple-touch-icon.png", size: 180, bg: "#0d0d0d", scale: 0.7 }
        ];

        const svgData = new XMLSerializer().serializeToString(document.getElementById("sourceSvg"));
        const img = new Image();
        img.src = "data:image/svg+xml;base64," + btoa(svgData);

        img.onload = () => {
            const container = document.getElementById("container");

            configs.forEach(conf => {
                const card = document.createElement("div");
                card.className = "card";

                const h3 = document.createElement("h3");
                h3.textContent = `${conf.name} (${conf.size}x${conf.size})`;

                const canvas = document.createElement("canvas");
                canvas.width = conf.size;
                canvas.height = conf.size;

                const ctx = canvas.getContext("2d");

                // 1. Hintergrund zeichnen
                if (conf.bg) {
                    ctx.fillStyle = conf.bg;
                    ctx.fillRect(0, 0, conf.size, conf.size);
                }

                // 2. SVG zentriert zeichnen
                const logoSize = conf.size * conf.scale;
                const offset = (conf.size - logoSize) / 2;
                ctx.drawImage(img, offset, offset, logoSize, logoSize);

                const btn = document.createElement("button");
                btn.textContent = "Download";
                btn.onclick = () => {
                    const link = document.createElement('a');
                    link.download = conf.name;
                    link.href = canvas.toDataURL("image/png");
                    link.click();
                };

                card.appendChild(h3);
                card.appendChild(canvas);
                card.appendChild(btn);
                container.appendChild(card);
            });
        };
    </script>
</body>
</html>
