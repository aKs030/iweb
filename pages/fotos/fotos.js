
document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    const ANIMATION_DELAY_BASE = 50; // ms per item

    // --- DOM Elements ---
    const filterButtons = document.querySelectorAll('.filter-btn');
    const photoCards = document.querySelectorAll('.photo-card');
    const lightbox = document.getElementById('lightbox');
    const lightboxContent = document.getElementById('lightbox-content');
    const lightboxClose = document.getElementById('lightbox-close');
    const lightboxTitle = document.getElementById('lightbox-title');
    const lightboxMeta = document.getElementById('lightbox-meta');

    // --- Filtering Logic ---
    function filterPhotos(category) {
        let visibleCount = 0;

        photoCards.forEach(card => {
            const cardCategory = card.dataset.category;
            const shouldShow = category === 'all' || cardCategory === category;

            if (shouldShow) {
                card.classList.remove('hidden');
                // Staggered animation for showing items
                card.style.animation = 'none';
                card.offsetHeight; /* trigger reflow */
                card.style.animation = `fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards ${visibleCount * 50}ms`;
                visibleCount++;
            } else {
                card.classList.add('hidden');
            }
        });

        // Update active state of buttons
        filterButtons.forEach(btn => {
            if (btn.dataset.filter === category) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    // Attach Event Listeners to Filter Buttons
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const category = btn.dataset.filter;
            filterPhotos(category);
        });
    });

    // --- Lightbox Logic ---
    function openLightbox(card) {
        // Clone the placeholder icon or get the image
        const placeholder = card.querySelector('.photo-placeholder').cloneNode(true);
        const title = card.querySelector('.card-title').textContent;
        const meta = card.querySelector('.card-meta').textContent;

        // Clear previous content
        lightboxContent.innerHTML = '';
        lightboxContent.appendChild(placeholder);

        // Set text
        lightboxTitle.textContent = title;
        lightboxMeta.textContent = meta;

        // Show lightbox
        lightbox.classList.add('visible');
        document.body.style.overflow = 'hidden'; // Prevent scrolling
    }

    function closeLightbox() {
        lightbox.classList.remove('visible');
        document.body.style.overflow = ''; // Restore scrolling
    }

    // Attach Event Listeners to Cards
    photoCards.forEach(card => {
        card.addEventListener('click', (e) => {
            // Check if it was a keypress (Enter) or click
            if (e.type === 'click' || (e.type === 'keydown' && e.key === 'Enter')) {
                openLightbox(card);
            }
        });

        // Accessibility: Allow opening with Enter key
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                openLightbox(card);
            }
        });
    });

    // Lightbox Controls
    if (lightboxClose) {
        lightboxClose.addEventListener('click', closeLightbox);
    }

    if (lightbox) {
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) {
                closeLightbox();
            }
        });
    }

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && lightbox && lightbox.classList.contains('visible')) {
            closeLightbox();
        }
    });

    // --- Initial Entry Animation ---
    // Trigger the initial "all" filter to set animations
    filterPhotos('all');
});
