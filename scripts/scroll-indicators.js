document.addEventListener('DOMContentLoaded', function() {
    const scrollContainers = document.querySelectorAll('.table-responsive');
    
    scrollContainers.forEach(container => {
        // Create scroll indicator arrows
        const topArrow = document.createElement('div');
        topArrow.className = 'scroll-indicator scroll-indicator-top';
        
        const bottomArrow = document.createElement('div');
        bottomArrow.className = 'scroll-indicator scroll-indicator-bottom';
        
        // Prepend top arrow so it appears at the start (sticks to top)
        container.prepend(topArrow);
        // Append bottom arrow so it appears at the end (sticks to bottom)
        container.appendChild(bottomArrow);
        
        // Function to update arrow visibility
        function updateArrows() {
            const scrollTop = container.scrollTop;
            const scrollHeight = container.scrollHeight;
            const clientHeight = container.clientHeight;
            
            // Show top arrow if scrolled down
            if (scrollTop > 10) {
                topArrow.classList.add('show');
            } else {
                topArrow.classList.remove('show');
            }
            
            // Show bottom arrow if not at bottom
            if (scrollTop + clientHeight < scrollHeight - 10) {
                bottomArrow.classList.add('show');
            } else {
                bottomArrow.classList.remove('show');
            }
        }
        
        // Initial check
        updateArrows();
        
        // Update on scroll
        container.addEventListener('scroll', updateArrows);
        
        // Update on resize (in case content changes)
        const resizeObserver = new ResizeObserver(updateArrows);
        resizeObserver.observe(container);
    });
});
