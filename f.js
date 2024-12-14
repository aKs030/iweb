function animateOnScroll() {
  var animationElements = document.querySelectorAll('.scroll-animation, .scroll-animationD, .scroll-animationL, .scroll-animationR');


  function checkInView() {
    for (var i = 0; i < animationElements.length; i++) {
      var element = animationElements[i];
      var windowHeight = window.innerHeight;
      var scrollY = window.scrollY || window.pageYOffset;
      var elementOffsetTop = element.getBoundingClientRect().top + scrollY;
      
      if (scrollY + windowHeight > elementOffsetTop) {
        element.classList.add('show');
      }
    }
  }

  

  // Initial check
  checkInView();

  // Listen for scroll event
  window.addEventListener('scroll', checkInView);
}



// Start the animation when the DOM is ready
document.addEventListener('DOMContentLoaded', animateOnScroll);

