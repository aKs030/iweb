// js/scroll-dots.js
document.addEventListener('DOMContentLoaded', () => {
    const sections = document.querySelectorAll('.snap-section');
    const dots = Array.from(document.querySelectorAll('.dots-nav .dot'));
    const viewportBox = document.querySelector('.viewport-box');

    let isScrolling = false;
    let lastActiveSection = null;

    function updateActiveDot() {
        const scrollPosition = viewportBox.scrollTop;
        let currentActiveIndex = -1;

        sections.forEach((section, index) => {
            const sectionTop = section.offsetTop - viewportBox.offsetTop;
            const sectionHeight = section.offsetHeight;

            if (currentActiveIndex === -1 &&
                scrollPosition >= sectionTop - 100 &&
                scrollPosition < sectionTop + sectionHeight - 100) {
                currentActiveIndex = index;

                if (lastActiveSection !== section.id && !isScrolling) {
                    lastActiveSection = section.id;
                    document.dispatchEvent(new CustomEvent('scrollToSection', {
                        detail: { sectionId: section.id }
                    }));
                }
                lastActiveSection = section.id;
            }
        });

        dots.forEach((dot, index) => {
            const isActive = index === currentActiveIndex;
            dot.classList.toggle('active', isActive);
            dot.setAttribute('aria-selected', isActive.toString());
            dot.setAttribute('tabindex', isActive ? '0' : '-1');
        });
    }

    dots.forEach(clickedDot => {
        clickedDot.addEventListener('click', () => {
            const targetSectionId = clickedDot.getAttribute('data-target');
            const targetSection = document.getElementById(targetSectionId);

            if (targetSection) {
                isScrolling = true;

                viewportBox.scrollTo({
                    top: targetSection.offsetTop - viewportBox.offsetTop,
                    behavior: 'smooth'
                });

                dots.forEach(dot => {
                    const isClicked = dot === clickedDot;
                    dot.classList.toggle('active', isClicked);
                    dot.setAttribute('aria-selected', isClicked.toString());
                    dot.setAttribute('tabindex', isClicked ? '0' : '-1');
                });
                if (document.activeElement !== clickedDot) {
                    clickedDot.focus();
                }

                document.dispatchEvent(new CustomEvent('scrollToSection', {
                    detail: { sectionId: targetSectionId }
                }));

                setTimeout(() => {
                    isScrolling = false;
                    updateActiveDot();
                }, 600);
            }
        });

        clickedDot.addEventListener('keydown', (event) => {
            let currentIndex = dots.indexOf(event.target);
            let newIndex = currentIndex;

            if (event.key === 'ArrowDown') {
                event.preventDefault();
                newIndex = (currentIndex + 1) % dots.length;
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                newIndex = (currentIndex - 1 + dots.length) % dots.length;
            } else if (event.key === 'Home') {
                event.preventDefault();
                newIndex = 0;
            } else if (event.key === 'End') {
                event.preventDefault();
                newIndex = dots.length - 1;
            }

            if (newIndex !== currentIndex) {
                dots[newIndex].focus();
                dots[newIndex].click();
            }
        });
    });

    let scrollTimeout;
    viewportBox.addEventListener('scroll', () => {
        isScrolling = true;
        updateActiveDot();
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            isScrolling = false;
            updateActiveDot();
        }, 150);
    });

    updateActiveDot();
});