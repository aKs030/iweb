// share-dialog.js
// Einfacher Fallback-Share-Dialog für Social Media

function showShareDialog(title = document.title, text = '', url = window.location.href) {
  // Prüfe, ob Dialog schon existiert
  if (document.getElementById('custom-share-dialog')) {
    document.getElementById('custom-share-dialog').style.display = 'flex';
    return;
  }

  // Dialog-HTML
  const dialog = document.createElement('div');
  dialog.id = 'custom-share-dialog';
  dialog.innerHTML = `
    <div class="share-dialog-content">
      <h3>Teilen</h3>
      <a href="https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}" target="_blank" rel="noopener" title="WhatsApp"><img src="img/icon-96.png" alt="WhatsApp" /></a>
      <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}" target="_blank" rel="noopener" title="Facebook"><img src="img/icon-96.png" alt="Facebook" /></a>
      <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}" target="_blank" rel="noopener" title="X/Twitter"><img src="img/icon-96.png" alt="X/Twitter" /></a>
      <a href="mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text + '\n' + url)}" title="E-Mail"><img src="img/icon-96.png" alt="E-Mail" /></a>
      <button id="close-share-dialog">Schließen</button>
    </div>
  `;
  
  // CSS für Overlay und Dialog
  const style = document.createElement('style');
  style.textContent = `
    #custom-share-dialog {
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 9999;
    }
    .share-dialog-content {
      background: #fff; padding: 2em 1.5em; border-radius: 12px; box-shadow: 0 2px 16px rgba(0,0,0,0.2); text-align: center;
    }
    .share-dialog-content h3 { margin-top: 0; }
    .share-dialog-content a { margin: 0 0.5em; display: inline-block; }
    .share-dialog-content img { width: 32px; height: 32px; }
    #close-share-dialog { margin-top: 1em; padding: 0.5em 1.5em; border: none; background: #eee; border-radius: 6px; cursor: pointer; }
    #close-share-dialog:hover { background: #ddd; }
  `;
  document.head.appendChild(style);

  // Dialog einfügen
  document.body.appendChild(dialog);

  // Schließen-Button
  document.getElementById('close-share-dialog').onclick = () => {
    dialog.style.display = 'none';
  };
}

// Optional: Export für Module
if (typeof window !== 'undefined') {
  window.showShareDialog = showShareDialog;
}
