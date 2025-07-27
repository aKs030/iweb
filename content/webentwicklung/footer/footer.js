document.addEventListener('DOMContentLoaded', () => {
  fetch('/content/webentwicklung/footer/footer.html')
    .then(response => {
      if (!response.ok) throw new Error('Fehler beim Laden des Footers');
      return response.text();
    })
    .then(html => {
      const container = document.getElementById('footer-container');
      if (container) container.innerHTML = html;
    })
    .catch(err => {
      console.error('[Footer] Fehler beim Laden:', err.message);
    });
});