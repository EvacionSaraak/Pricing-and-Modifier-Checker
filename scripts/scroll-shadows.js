document.addEventListener('DOMContentLoaded', function() {
    const scrollContainers = document.querySelectorAll('.table-responsive');
    scrollContainers.forEach(container => {
        container.addEventListener('scroll', function() {
            const scrollTop = this.scrollTop;
            const scrollHeight = this.scrollHeight;
            const clientHeight = this.clientHeight;
            if (scrollTop > 10) {
                this.classList.add('scrolled-top');
            } else {
                this.classList.remove('scrolled-top');
            }
            if (scrollTop + clientHeight < scrollHeight - 10) {
                this.classList.remove('scrolled-bottom');
            } else {
                this.classList.add('scrolled-bottom');
            }
        });
    });
});
