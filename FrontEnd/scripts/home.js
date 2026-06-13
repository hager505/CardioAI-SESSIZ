// scripts/home.js
// CardioAI Landing Page Scripts
// Uses AuthManager from js/auth-manager.js for auth state

document.addEventListener('DOMContentLoaded', function() {
    // ==========================================
    // 1. Mobile Menu Functionality
    // ==========================================
    // The hamburger / overlay / nav-link close handlers are wired by
    // AuthManager.initHeader() (initMobileMenu), which runs in the
    // auth-manager.js auto-init on DOMContentLoaded. Wiring them again
    // here causes two click handlers to fire on the same click, with
    // the toggles cancelling each other out and the menu never opening
    // on narrow viewports.

    // ==========================================
    // 2. Navbar Scroll Effect
    // ==========================================

    const navbar = document.getElementById('navbar');

    window.addEventListener('scroll', function() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

        if (scrollTop > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    }, { passive: true });

    // ==========================================
    // 3. Smooth Scrolling for Navigation Links
    // ==========================================

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');

            if (href === '#') return;

            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();

                const headerHeight = navbar ? navbar.offsetHeight : 64;
                const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - headerHeight - 20;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });

                updateActiveNavLink(href);
            }
        });
    });

    function updateActiveNavLink(sectionId) {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === sectionId) {
                link.classList.add('active');
            }
        });
    }

    // ==========================================
    // 4. Active Nav Link on Scroll
    // ==========================================

    const sections = document.querySelectorAll('section[id]');

    window.addEventListener('scroll', function() {
        let current = '';

        sections.forEach(section => {
            const sectionTop = section.offsetTop - 100;
            const sectionHeight = section.offsetHeight;

            if (window.pageYOffset >= sectionTop && window.pageYOffset < sectionTop + sectionHeight) {
                current = '#' + section.getAttribute('id');
            }
        });

        if (current) {
            updateActiveNavLink(current);
        }
    }, { passive: true });

    // ==========================================
    // 5. Intersection Observer for Animations
    // ==========================================

    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animated');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('section').forEach(section => {
        observer.observe(section);
    });

    document.querySelectorAll('.feature-card').forEach((card, index) => {
        card.style.transitionDelay = `${index * 0.1}s`;
        observer.observe(card);
    });

    document.querySelectorAll('.portal-card').forEach((card, index) => {
        card.style.transitionDelay = `${index * 0.15}s`;
        observer.observe(card);
    });

    // ==========================================
    // 6. Auth Manager Integration
    // ==========================================
    // AuthManager.initAuth() is called automatically on DOMContentLoaded
    // from js/auth-manager.js. It renders login/signup or dashboard button
    // into #navbarActions based on auth state.

    // Listen for authManager:ready event if we need to do additional setup
    document.addEventListener('authManager:ready', function(e) {
        console.log('[Landing Page] AuthManager ready:', e.detail.isLoggedIn ? 'Logged in' : 'Not logged in');
    });

    console.log('CardioAI Landing Page initialized');
});
