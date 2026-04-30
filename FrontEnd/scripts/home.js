// Simple script for smooth scroll and button effects
document.addEventListener('DOMContentLoaded', function() {
    // Add ripple effect to all buttons
    const buttons = document.querySelectorAll('.btn-primary, .btn-secondary, .cta-btn');
    
    buttons.forEach(button => {
        button.addEventListener('click', function(e) {
            // Remove existing ripples
            const existingRipples = this.querySelectorAll('.ripple');
            existingRipples.forEach(ripple => ripple.remove());
            
            // Create new ripple
            const ripple = document.createElement('span');
            ripple.classList.add('ripple');
            
            // Calculate position and size
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            // Style the ripple
            ripple.style.cssText = `
                position: absolute;
                width: ${size}px;
                height: ${size}px;
                top: ${y}px;
                left: ${x}px;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.6);
                transform: scale(0);
                animation: ripple 0.6s linear;
                pointer-events: none;
            `;
            
            this.appendChild(ripple);
            
            // Remove ripple after animation
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });
    
    // Mobile menu toggle (optional for future)
    const mobileMenuBtn = document.createElement('button');
    mobileMenuBtn.innerHTML = '<i class="fas fa-bars"></i>';
    mobileMenuBtn.className = 'mobile-menu-btn';
    document.querySelector('.header-content').appendChild(mobileMenuBtn);
    
    mobileMenuBtn.addEventListener('click', function() {
        document.querySelector('.nav-menu').classList.toggle('show');
    });
    
    // Close mobile menu when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.header-content')) {
            document.querySelector('.nav-menu').classList.remove('show');
        }
    });
    
    // Add animation to CTA section when it comes into view
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animated');
            }
        });
    }, { threshold: 0.3 });
    
    const ctaSection = document.querySelector('.cta-section');
    if (ctaSection) observer.observe(ctaSection);
    
    // Smooth scroll for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            
            // Skip if it's not an ID
            if (href === '#') return;
            
            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                
                const headerHeight = document.querySelector('.header').offsetHeight;
                const targetPosition = target.offsetTop - headerHeight - 20;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
                
                // Close mobile menu if open
                document.querySelector('.nav-menu').classList.remove('show');
            }
        });
    });
});

// Add CSS for mobile menu
const mobileMenuCSS = `
    .mobile-menu-btn {
        display: none;
        background: none;
        border: none;
        color: #004b92;
        font-size: 24px;
        cursor: pointer;
        padding: 10px;
    }
    
    @media (max-width: 768px) {
        .mobile-menu-btn {
            display: block;
            position: absolute;
            right: 20px;
            top: 20px;
        }
        
        .nav-menu {
            display: none;
            width: 100%;
            flex-direction: column;
            position: absolute;
            top: 100%;
            left: 0;
            background: white;
            box-shadow: 0 10px 20px rgba(0,0,0,0.1);
            padding: 20px;
            z-index: 1000;
        }
        
        .nav-menu.show {
            display: flex;
        }
        
        .nav-item {
            width: 100%;
            text-align: center;
            padding: 15px 0;
            border-bottom: 1px solid #eee;
        }
        
        .nav-item:last-child {
            border-bottom: none;
        }
    }
    
    .cta-section.animated {
        animation: fadeInUp 1s ease;
    }
    
    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateY(50px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;

// Inject mobile menu CSS
const style = document.createElement('style');
style.textContent = mobileMenuCSS;
document.head.appendChild(style);