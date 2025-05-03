document.addEventListener('DOMContentLoaded', () => {
  const footerContainer = document.getElementById('footer-container');
  if (!footerContainer) return;
  fetch('/pages/komponente/footer.html')
    .then(res => res.text())
    .then(data => {
      footerContainer.innerHTML = data;
    })
    .catch(err => console.error('Footer konnte nicht geladen werden:', err));
});
