/**
 * =============================================================================
 * CardioAI - Authentication Manager
 * =============================================================================
 *
 * A shared authentication module that handles conditional login/signup vs
 * dashboard buttons across all pages.
 *
 * Design Philosophy:
 * - Single source of truth for auth state across all pages
 * - Consistent button rendering and navigation
 * - Automatic auth state detection and UI updates
 * - Works across landing, patient, doctor, chatbot, and auth pages
 *
 * localStorage Keys:
 * - 'token'       : Auth token (if applicable)
 * - 'userType'    : 'patient' | 'doctor' | null
 * - 'userName'    : User's display name
 * - 'userAvatar'  : User's avatar URL (optional)
 * - 'isLoggedIn'  : 'true' | 'false'
 *
 * sessionStorage Keys (set by login.js):
 * - 'user_role'   : 'patient' | 'doctor'
 * - 'user_id'     : User's ID
 * - 'user_name'   : User's full name
 * - 'user_data'   : JSON string of full user data
 *
 * Usage:
 *   <script src="/js/auth-manager.js"></script>
 *   <script>
 *     document.addEventListener('DOMContentLoaded', () => {
 *       AuthManager.initAuth();
 *     });
 *   </script>
 *
 * =============================================================================
 */

const AuthManager = (() => {
    'use strict';

    // ══════════════════════════════════════════════════════════════════════════
    // CONFIGURATION
    // ══════════════════════════════════════════════════════════════════════════

    const CONFIG = {
        // localStorage keys
        STORAGE_KEYS: {
            TOKEN: 'token',
            USER_ID: 'userId',
            USER_TYPE: 'userType',
            USER_NAME: 'userName',
            USER_DATA: 'userData',
            USER_AVATAR: 'userAvatar',
            USER_AVATAR_BUST: 'userAvatarBust',
            USER_EMAIL: 'userEmail',
            IS_LOGGED_IN: 'isLoggedIn',
            LOGIN_TIME: 'loginTime',
        },
        // sessionStorage keys (set by login.js)
        SESSION_KEYS: {
            USER_ROLE: 'user_role',
            USER_ID: 'user_id',
            USER_NAME: 'user_name',
            USER_DATA: 'user_data',
        },
        // Dashboard URLs by user type
        DASHBOARD_URLS: {
            patient: '/patient/dashboard/dashboard.html',
            doctor: '/doctor/dashboard/dashboard.html',
        },
        // Auth page URLs
        AUTH_URLS: {
            login: '/auth/login.html',
            patientSignup: '/auth/patient/RegisterPatient.html',
            doctorSignup: '/auth/doctor/RegisterDoctor.html',
            logout: '/auth/logout.html',
        },
        // Home URL
        HOME_URL: '/index.html',
        // Token expiration time (24 hours in milliseconds)
        TOKEN_EXPIRATION: 24 * 60 * 60 * 1000,
    };

    // ══════════════════════════════════════════════════════════════════════════
    // AUTH STATE METHODS
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Check if user is logged in.
     *
     * The source of truth is localStorage (shared across tabs). sessionStorage
     * is allowed as a fallback for backwards compatibility with sessions that
     * pre-date the localStorage mirror, but is no longer required — this lets
     * a dashboard link opened in a new tab recognise the user as logged in
     * instead of bouncing them back to /auth/login.html.
     *
     * Also checks token expiration if applicable.
     * @returns {boolean}
     */
    function isLoggedIn() {
        const loggedInFlag = localStorage.getItem(CONFIG.STORAGE_KEYS.IS_LOGGED_IN) === 'true';

        // Primary check: localStorage flag. If it's not set, the user is
        // not (or no longer) logged in — full stop.
        if (!loggedInFlag) return false;

        // Token expiration check.
        const loginTime = localStorage.getItem(CONFIG.STORAGE_KEYS.LOGIN_TIME);
        if (loginTime) {
            const elapsed = Date.now() - new Date(loginTime).getTime();
            if (elapsed > CONFIG.TOKEN_EXPIRATION) {
                // Token expired - clear auth data
                clearAuthData();
                return false;
            }
        }

        return true;
    }

    /**
     * Get user data from localStorage and sessionStorage
     * @returns {Object} User data object
     */
    function getUserData() {
        const sessionData = sessionStorage.getItem(CONFIG.SESSION_KEYS.USER_DATA);
        let parsedData = null;

        try {
            parsedData = sessionData ? JSON.parse(sessionData) : null;
        } catch (e) {
            console.warn('AuthManager: Failed to parse user_data from sessionStorage', e);
        }

        // The avatar can live in a few places. We walk them in the SAME
        // order `initDoctorAvatar` does on the dashboard, so the landing
        // page navbar and the dashboard sidebar always agree on which
        // photo to show:
        //   1. sessionStorage.user_data.avatar_url — most up-to-date;
        //      refreshed by every dashboard / profile page that calls
        //      the API and by the upload handlers on every successful
        //      POST /:id/avatar.
        //   2. localStorage.avatar_${role}_${id} — the per-role cache
        //      the profile pages maintain and that the upload handlers
        //      also write after a successful upload. Used as a fallback
        //      for fresh tabs (where sessionStorage is empty) and as a
        //      belt-and-braces backup if sessionStorage.user_data is
        //      somehow stale.
        //   3. localStorage.userAvatar — set on login by setAuthData;
        //      mostly useful as a last-ditch fallback when nothing else
        //      has populated yet.
        const role  = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_TYPE) || sessionStorage.getItem(CONFIG.SESSION_KEYS.USER_ROLE) || 'patient';
        const uId   = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_ID) || sessionStorage.getItem(CONFIG.SESSION_KEYS.USER_ID);
        const cachedPerRole = uId ? localStorage.getItem(`avatar_${role}_${uId}`) : null;
        const sessionAvatar = parsedData && parsedData.avatar_url ? parsedData.avatar_url : null;

        return {
            token: localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN) || null,
            userType: localStorage.getItem(CONFIG.STORAGE_KEYS.USER_TYPE) || sessionStorage.getItem(CONFIG.SESSION_KEYS.USER_ROLE) || null,
            userId: uId || null,
            name: localStorage.getItem(CONFIG.STORAGE_KEYS.USER_NAME) || sessionStorage.getItem(CONFIG.SESSION_KEYS.USER_NAME) || (parsedData?.full_name) || null,
            avatar: sessionAvatar || cachedPerRole || localStorage.getItem(CONFIG.STORAGE_KEYS.USER_AVATAR) || null,
            email: parsedData?.email || null,
            data: parsedData,
        };
    }

    /**
     * Get user type
     * @returns {'patient' | 'doctor' | null}
     */
    function getUserType() {
        if (!isLoggedIn()) return null;
        return localStorage.getItem(CONFIG.STORAGE_KEYS.USER_TYPE) || sessionStorage.getItem(CONFIG.SESSION_KEYS.USER_ROLE) || null;
    }

    /**
     * Mirror the cross-tab auth data (localStorage) into sessionStorage
     * when the latter is empty. This lets a dashboard link opened in a new
     * tab from the landing page (or the navbar dropdown) work without a
     * second login, because the per-tab sessionStorage was the only thing
     * `isLoggedIn()` used to require.
     *
     * Mirrors user_id, user_role, user_name AND the full `user_data` blob
     * (when one is present in localStorage). The blob is what the doctor /
     * patient dashboard session guards require before they let the page
     * render — if it's missing they redirect to login.html, which then
     * bounces the user right back to the dashboard (because
     * `isLoggedIn()` is true in localStorage), creating an infinite
     * redirect loop. Mirroring the blob here is the single fix that
     * breaks that loop.
     */
    function bootstrapSessionFromLocal() {
        if (!isLoggedIn()) return;
        const role  = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_TYPE);
        const uId   = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_ID);
        const name  = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_NAME);
        const blob  = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_DATA);
        try {
            if (role && !sessionStorage.getItem(CONFIG.SESSION_KEYS.USER_ROLE)) {
                sessionStorage.setItem(CONFIG.SESSION_KEYS.USER_ROLE, role);
            }
            if (uId && !sessionStorage.getItem(CONFIG.SESSION_KEYS.USER_ID)) {
                sessionStorage.setItem(CONFIG.SESSION_KEYS.USER_ID, uId);
            }
            if (name && !sessionStorage.getItem(CONFIG.SESSION_KEYS.USER_NAME)) {
                sessionStorage.setItem(CONFIG.SESSION_KEYS.USER_NAME, name);
            }
            if (blob && !sessionStorage.getItem(CONFIG.SESSION_KEYS.USER_DATA)) {
                sessionStorage.setItem(CONFIG.SESSION_KEYS.USER_DATA, blob);
            }
        } catch (_) { /* sessionStorage may be disabled — ignore */ }
    }

    /**
     * Get the appropriate dashboard URL based on user type
     * @returns {string} Dashboard URL
     */
    function getDashboardUrl() {
        const userType = getUserType();
        return CONFIG.DASHBOARD_URLS[userType] || CONFIG.HOME_URL;
    }

    /**
     * Get the login page URL
     * @returns {string}
     */
    function getLoginUrl() {
        return CONFIG.AUTH_URLS.login;
    }

    /**
     * Get signup URLs
     * @returns {Object} Object with patient and doctor signup URLs
     */
    function getSignupUrls() {
        return {
            patient: CONFIG.AUTH_URLS.patientSignup,
            doctor: CONFIG.AUTH_URLS.doctorSignup,
        };
    }

    // ══════════════════════════════════════════════════════════════════════════
    // BUTTON RENDERING
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Get initials from a name
     * @param {string} name
     * @returns {string} Up to 2 characters
     */
    function getInitials(name) {
        if (!name) return '?';
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return (parts[0][0] + (parts[0][1] || '')).toUpperCase();
    }

    /**
     * Render login/signup buttons (for non-authenticated users)
     * @param {HTMLElement} container
     */
    function renderLoggedOutButtons(container) {
        const signupUrls = getSignupUrls();

        container.innerHTML = `
            <a href="${CONFIG.AUTH_URLS.login}" class="btn btn-outline btn-nav">
                <i class="fas fa-sign-in-alt"></i> Login
            </a>
            <div class="dropdown-signup">
                <button class="btn btn-primary btn-nav" id="signupDropdownBtn" aria-haspopup="true" aria-expanded="false">
                    <i class="fas fa-user-plus"></i> Sign Up <i class="fas fa-chevron-down" style="font-size: 0.7em; margin-left: 4px;"></i>
                </button>
                <div class="dropdown-menu signup-dropdown" id="signupDropdownMenu">
                    <a href="${signupUrls.patient}" class="dropdown-item">
                        <i class="fas fa-user"></i> Sign up as Patient
                    </a>
                    <a href="${signupUrls.doctor}" class="dropdown-item">
                        <i class="fas fa-user-md"></i> Sign up as Doctor
                    </a>
                </div>
            </div>
        `;

        // Setup signup dropdown toggle
        const signupBtn = container.querySelector('#signupDropdownBtn');
        const signupMenu = container.querySelector('#signupDropdownMenu');

        if (signupBtn && signupMenu) {
            signupBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = signupMenu.classList.contains('show');
                closeAllDropdowns();
                if (!isOpen) {
                    signupMenu.classList.add('show');
                    signupBtn.setAttribute('aria-expanded', 'true');
                }
            });
        }
    }

    /**
     * Render dashboard button with user menu (for authenticated users)
     * @param {HTMLElement} container
     */
    function renderLoggedInButtons(container) {
        const userData = getUserData();
        const dashboardUrl = getDashboardUrl();
        const initials = getInitials(userData.name);
        // Resolve relative avatar paths against the API origin so the
        // <img> works from any page (landing page is served from a
        // different origin than the backend where uploads live).
        const avatarSrc = userData.avatar ? resolveUrl(userData.avatar) : null;
        // Cache-bust: a token that changes every time the avatar URL is
        // written (setAuthData on login, syncUser on re-upload). Without
        // this the browser happily serves the old image from its HTTP
        // cache when the underlying file is replaced in place.
        const avatarBust = avatarSrc
            ? (localStorage.getItem(CONFIG.STORAGE_KEYS.USER_AVATAR_BUST) || Date.now().toString())
            : null;
        const avatarSrcWithBust = avatarSrc
            ? (avatarSrc.includes('?') ? `${avatarSrc}&v=${avatarBust}` : `${avatarSrc}?v=${avatarBust}`)
            : null;
        const avatarHtml = avatarSrcWithBust
            ? `<img src="${avatarSrcWithBust}" alt="${userData.name}" class="avatar-img">`
            : `<span class="avatar-initials">${initials}</span>`;

        container.innerHTML = `
            <div class="user-menu" id="authUserMenu">
                <div class="user-avatar" id="authAvatar" tabindex="0" role="button" aria-haspopup="true" aria-expanded="false" aria-label="User menu">
                    ${avatarHtml}
                </div>
                <div class="dropdown-menu" id="authUserDropdown">
                    <div class="dropdown-header">
                        <div class="user-name">${userData.name || 'User'}</div>
                        <div class="user-email">${userData.email || (userData.userType ? userData.userType.charAt(0).toUpperCase() + userData.userType.slice(1) : '')}</div>
                    </div>
                    <div class="dropdown-divider"></div>
                    <a href="${dashboardUrl}" class="dropdown-item">
                        <i class="fas fa-th-large"></i> Dashboard
                    </a>
                    <a href="${userData.userType === 'patient' ? '/patient/profile/profile.html' : '/doctor/dashboard/dashboard.html'}" class="dropdown-item">
                        <i class="fas fa-user-cog"></i> Profile Settings
                    </a>
                    <div class="dropdown-divider"></div>
                    <a href="#" class="dropdown-item danger" id="authLogoutBtn">
                        <i class="fas fa-sign-out-alt"></i> Logout
                    </a>
                </div>
            </div>
        `;

        // Setup user menu dropdown
        const userMenu = container.querySelector('#authUserMenu');
        const avatar = container.querySelector('#authAvatar');
        const dropdown = container.querySelector('#authUserDropdown');

        if (avatar && dropdown) {
            avatar.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = dropdown.classList.contains('show');
                closeAllDropdowns();
                if (!isOpen) {
                    dropdown.classList.add('show');
                    avatar.setAttribute('aria-expanded', 'true');
                }
            });

            // Keyboard accessibility
            avatar.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    avatar.click();
                }
            });
        }

        // Setup logout button
        const logoutBtn = container.querySelector('#authLogoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                handleLogout();
            });
        }
    }

    /**
     * Render auth buttons in the specified container
     * Shows login/signup or dashboard button based on auth state
     * @param {string} containerId - The ID of the container element
     */
    function renderAuthButtons(containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.warn(`AuthManager: Container "${containerId}" not found`);
            return;
        }

        if (isLoggedIn()) {
            renderLoggedInButtons(container);
        } else {
            renderLoggedOutButtons(container);
        }
    }

    /**
     * Close all open dropdowns
     */
    function closeAllDropdowns() {
        document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
            menu.classList.remove('show');
        });
        document.querySelectorAll('[aria-expanded="true"]').forEach(el => {
            el.setAttribute('aria-expanded', 'false');
        });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // HEADER / NAVBAR INITIALIZATION
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Initialize the unified header/navbar
     * Adds logo, navigation links, auth buttons, and mobile menu toggle
     * @param {string} headerSelector - CSS selector for the header element
     */
    function initHeader(headerSelector) {
        const header = document.querySelector(headerSelector);
        if (!header) {
            console.warn(`AuthManager: Header "${headerSelector}" not found`);
            return;
        }

        // Add scrolled class on scroll
        initScrollEffect(header);

        // Setup mobile menu toggle
        initMobileMenu();

        // Setup user menu dropdown toggle
        initUserMenuToggle();

        // Render auth buttons if navbar-actions exists
        const actionsContainer = header.querySelector('.navbar-actions') || document.getElementById('navbarActions');
        if (actionsContainer) {
            // Check if actions container already has auth buttons rendered
            // (some pages have their own user menu, so we only add if empty)
            if (!actionsContainer.querySelector('.user-menu') && !actionsContainer.querySelector('.btn-nav')) {
                renderAuthButtonsFromElement(actionsContainer);
            }
        }
    }

    /**
     * Render auth buttons directly into an element
     * @param {HTMLElement} element
     */
    function renderAuthButtonsFromElement(element) {
        if (isLoggedIn()) {
            renderLoggedInButtons(element);
        } else {
            renderLoggedOutButtons(element);
        }
    }

    /**
     * Initialize scroll effect for navbar
     * @param {HTMLElement} navbar
     */
    function initScrollEffect(navbar) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 10) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        });
    }

    /**
     * Initialize dashboard sidebar toggle (chatbot-style: open/close, with a
     * close button INSIDE the sidebar itself, plus a backdrop overlay).
     *
     * Idempotent: `initAuth()` and `initSidebarFooterPanel()` both call this,
     * and patient pages also call it indirectly via initSidebarFooterPanel.
     * The very first call wires the click handlers; subsequent calls are a
     * no-op so the click doesn't fire twice and toggle itself back off.
     */
    let _dashboardSidebarWired = false;
    function initDashboardSidebar() {
        if (_dashboardSidebarWired) return;
        const toggle      = document.getElementById('sidebarToggle');
        const closeBtn    = document.getElementById('sidebarCloseBtn');
        const sidebar     = document.getElementById('dashboardSidebar');
        const overlay     = document.getElementById('sidebarOverlay');

        if (!sidebar) return;

        const openSidebar = () => {
            sidebar.classList.add('active');
            if (toggle) toggle.classList.add('active');
            if (overlay) overlay.classList.add('active');
            // Lock body scroll on narrow viewports only — on desktop the
            // sidebar is a fixed left rail and the main content is
            // already laid out beside it, so locking scroll is wrong.
            if (window.innerWidth <= 1024) document.body.style.overflow = 'hidden';
        };

        const closeSidebar = () => {
            sidebar.classList.remove('active');
            if (toggle) toggle.classList.remove('active');
            if (overlay) overlay.classList.remove('active');
            document.body.style.overflow = '';
        };

        const toggleSidebar = () => {
            if (sidebar.classList.contains('active')) closeSidebar();
            else                                       openSidebar();
        };

        if (toggle)   toggle.addEventListener('click', toggleSidebar);
        if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
        if (overlay)  overlay.addEventListener('click', closeSidebar);

        // ESC closes the sidebar (consistent with the auth dropdowns above).
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && sidebar.classList.contains('active')) {
                closeSidebar();
            }
        });

        _dashboardSidebarWired = true;
    }

    /**
     * Initialize user menu dropdown toggle
     */
    function initUserMenuToggle() {
        const avatar = document.querySelector('.user-avatar');
        if (avatar) {
            avatar.addEventListener('click', (e) => {
                e.stopPropagation();
                const dropdown = document.getElementById('userDropdown');
                if (dropdown) {
                    dropdown.classList.toggle('show');
                }
            });
            document.addEventListener('click', () => {
                const dropdown = document.getElementById('userDropdown');
                if (dropdown) dropdown.classList.remove('show');
            });
        }
    }

    /**
     * Generate a role-namespaced localStorage key for avatar caching
     * Prevents collision between doctor and patient with same numeric ID
     */
    function avatarStorageKey(role, userId) {
      return `avatar_${role || 'user'}_${userId}`;
    }

    function resolveUrl(url) {
      if (!url) return url;
      if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
      if (url.startsWith('/')) return 'http://localhost:5000' + url;
      return 'http://localhost:5000/' + url;
    }

    /**
     * Refresh all avatar elements on the page using current sessionStorage data
     */
    function refreshAllAvatars() {
      const els = document.querySelectorAll('#doctorAvatar, #footerAvatar, #profileAvatar, #userAvatarLarge');
      const role = getUserType() || 'doctor';
      const userId = sessionStorage.getItem('user_id');
      const raw = sessionStorage.getItem('user_data');
      let name = role === 'patient' ? 'Patient' : 'Doctor';
      if (raw) { try { name = JSON.parse(raw).full_name || name; } catch (_) {} }
      els.forEach(el => { if (el) initDoctorAvatar(el, userId, name, role); });
    }

    function initDoctorAvatar(avatarEl, userId, fullName, role) {
        if (!avatarEl) return;
        if (!role) role = getUserType() || 'doctor';
        const cacheKey = avatarStorageKey(role, userId);
        // 1. Try sessionStorage user_data.avatar_url (set from DB on login / after upload)
        try {
            const raw = sessionStorage.getItem('user_data');
            if (raw) {
                const user = JSON.parse(raw);
                if (user.avatar_url) {
                    const url = resolveUrl(user.avatar_url);
                    avatarEl.style.backgroundImage = `url(${url})`;
                    avatarEl.style.backgroundSize = 'cover';
                    avatarEl.style.backgroundPosition = 'center';
                    avatarEl.textContent = '';
                    localStorage.setItem(cacheKey, url);
                    return;
                }
            }
        } catch (_) { /* ignore */ }
        // 2. Fallback: try localStorage cache (namespaced by role)
        const saved = localStorage.getItem(cacheKey);
        if (saved) {
            avatarEl.style.backgroundImage = `url(${resolveUrl(saved)})`;
            avatarEl.style.backgroundSize = 'cover';
            avatarEl.style.backgroundPosition = 'center';
            avatarEl.textContent = '';
            return;
        }
        // 3. Final fallback: render initials
        const fallbackName = role === 'patient' ? 'Patient' : 'Doctor';
        const parts = (fullName || fallbackName).trim().split(/\s+/);
        const first = parts[0]?.[0] || fallbackName[0];
        const second = parts[1]?.[0] || parts[0]?.[1] || (fallbackName.length > 1 ? fallbackName[1] : '');
        const initials = (first + second).toUpperCase();
        avatarEl.textContent = initials;
        avatarEl.style.backgroundImage = '';
    }

    /**
     * Initialize sidebar footer slide-out panel
     * Toggles the footer menu open/closed and sets up doctor avatar + name
     */
    function initSidebarFooterPanel() {
        initDashboardSidebar();
        const trigger = document.getElementById('footerPanelTrigger');
        const menu = document.getElementById('footerPanelMenu');
        const chevron = document.querySelector('.sidebar-footer-chevron');
        if (trigger && menu) {
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                menu.classList.toggle('open');
                if (chevron) chevron.classList.toggle('open');
            });
            document.addEventListener('click', (e) => {
                if (!trigger.contains(e.target) && !menu.contains(e.target)) {
                    menu.classList.remove('open');
                    if (chevron) chevron.classList.remove('open');
                }
            });
        }
        // Populate user name and avatar from sessionStorage
        const nameEl = document.getElementById('footerDoctorName') || document.getElementById('footerPatientName');
        const role = sessionStorage.getItem('user_role') || 'doctor';
        const avatarEl = document.getElementById('footerAvatar');
        try {
            const raw = sessionStorage.getItem('user_data');
            const userId = sessionStorage.getItem('user_id');
            if (raw) {
                const user = JSON.parse(raw);
                if (nameEl) nameEl.textContent = user.full_name || (role === 'doctor' ? 'Doctor' : 'Patient');
                if (avatarEl && userId) {
                    initDoctorAvatar(avatarEl, userId, user.full_name, role);
                }
            }
        } catch (_) { /* ignore */ }

        // Wire sidebar logout button
        const logoutBtn = document.getElementById('sidebarLogoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                handleLogout();
            });
        }

        // Refresh all avatar elements on the page
        refreshAllAvatars();
    }

    /**
     * Initialize mobile menu toggle
     */
    function initMobileMenu() {
        const hamburger = document.getElementById('hamburgerBtn');
        const nav = document.getElementById('navbarNav');
        const overlay = document.getElementById('mobileOverlay');

        if (hamburger && nav) {
            hamburger.addEventListener('click', () => {
                hamburger.classList.toggle('active');
                nav.classList.toggle('active');
                if (overlay) overlay.classList.toggle('active');
                document.body.style.overflow = nav.classList.contains('active') ? 'hidden' : '';
            });
        }

        if (overlay && nav) {
            overlay.addEventListener('click', () => {
                const hamburgerBtn = document.getElementById('hamburgerBtn');
                if (hamburgerBtn) hamburgerBtn.classList.remove('active');
                nav.classList.remove('active');
                overlay.classList.remove('active');
                document.body.style.overflow = '';
            });
        }

        // Close mobile menu when clicking a nav link
        if (nav) {
            nav.querySelectorAll('.nav-link').forEach(link => {
                link.addEventListener('click', () => {
                    const hamburgerBtn = document.getElementById('hamburgerBtn');
                    const overlayEl = document.getElementById('mobileOverlay');
                    if (nav.classList.contains('active')) {
                        if (hamburgerBtn) hamburgerBtn.classList.remove('active');
                        nav.classList.remove('active');
                        if (overlayEl) overlayEl.classList.remove('active');
                        document.body.style.overflow = '';
                    }
                });
            });
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // AUTH ACTIONS
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Store auth data after successful login
     * This should be called from the login page after successful authentication
     * @param {Object} authData - Auth data from login response
     * @param {string} authData.token - Auth token
     * @param {string|number} [authData.userId] - User ID (required for cross-tab auth)
     * @param {'patient' | 'doctor'} authData.userType - User type
     * @param {string} authData.name - User's display name
     * @param {string} [authData.avatar] - User's avatar URL
     * @param {Object} [authData.data] - Full login response object. Mirrored
     *   to localStorage so a dashboard link opened in a new tab can rebuild
     *   its per-tab sessionStorage.user_data via bootstrapSessionFromLocal().
     *   Without this, the dashboard's session guard (which checks
     *   sessionStorage.user_data) redirects to login.html even though the
     *   user is authenticated — and login.html bounces them right back.
     */
    function setAuthData(authData) {
        if (authData.token) {
            localStorage.setItem(CONFIG.STORAGE_KEYS.TOKEN, authData.token);
        }
        if (authData.userId !== undefined && authData.userId !== null) {
            localStorage.setItem(CONFIG.STORAGE_KEYS.USER_ID, String(authData.userId));
        }
        if (authData.userType) {
            localStorage.setItem(CONFIG.STORAGE_KEYS.USER_TYPE, authData.userType);
        }
        if (authData.name) {
            localStorage.setItem(CONFIG.STORAGE_KEYS.USER_NAME, authData.name);
        }
        if (authData.avatar) {
            localStorage.setItem(CONFIG.STORAGE_KEYS.USER_AVATAR, authData.avatar);
            // New avatar URL means a re-upload — bump the cache-bust token
            // so every <img src> that includes it forces a fresh fetch.
            try { localStorage.setItem(CONFIG.STORAGE_KEYS.USER_AVATAR_BUST, String(Date.now())); } catch (_) {}
        }
        // Mirror the full login response to localStorage so the
        // bootstrapSessionFromLocal() call on every protected page can
        // rebuild the per-tab sessionStorage.user_data. This is what
        // breaks the dashboard<->login redirect loop when a logged-in
        // user opens a dashboard URL in a new tab.
        if (authData.data && typeof authData.data === 'object') {
            try {
                localStorage.setItem(CONFIG.STORAGE_KEYS.USER_DATA, JSON.stringify(authData.data));
            } catch (_) { /* quota / disabled storage — non-fatal */ }
        }
        localStorage.setItem(CONFIG.STORAGE_KEYS.IS_LOGGED_IN, 'true');
        localStorage.setItem(CONFIG.STORAGE_KEYS.LOGIN_TIME, new Date().toISOString());
    }

    /**
     * Clear all auth data from storage
     */
    function clearAuthData() {
        // Clear localStorage auth keys
        Object.values(CONFIG.STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
        // Clear sessionStorage
        sessionStorage.clear();
    }

    /**
     * Show a styled logout confirmation modal
     * @returns {Promise<boolean>} resolves true if user confirmed
     */
    function showLogoutModal() {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.id = 'logoutModalOverlay';
            overlay.style.cssText = `
                position:fixed;inset:0;background:rgba(0,0,0,0.45);
                display:flex;align-items:center;justify-content:center;
                z-index:99999;animation:fadeIn .2s ease;`;

            const modal = document.createElement('div');
            modal.style.cssText = `
                background:#fff;border-radius:16px;padding:32px;
                max-width:380px;width:92%;text-align:center;
                box-shadow:0 20px 60px rgba(0,0,0,0.2);
                animation:slideUp .25s ease;`;

            modal.innerHTML = `
                <div style="width:56px;height:56px;border-radius:50%;
                    background:#fee2e2;display:flex;align-items:center;
                    justify-content:center;margin:0 auto 16px;">
                    <i class="fas fa-sign-out-alt" style="font-size:22px;color:#dc2626;"></i>
                </div>
                <h3 style="font-size:18px;color:#1f2937;margin:0 0 8px;font-weight:600;">Log out</h3>
                <p style="font-size:14px;color:#6b7280;margin:0 0 24px;line-height:1.5;">
                    Are you sure you want to log out? You will be redirected to the home page.
                </p>
                <div style="display:flex;gap:10px;">
                    <button id="logoutCancelBtn" style="flex:1;padding:10px 16px;border:1px solid #d1d5db;
                        background:#fff;color:#374151;border-radius:10px;font-size:14px;font-weight:500;
                        cursor:pointer;">Cancel</button>
                    <button id="logoutConfirmBtn" style="flex:1;padding:10px 16px;border:none;
                        background:#dc2626;color:#fff;border-radius:10px;font-size:14px;font-weight:600;
                        cursor:pointer;">Log out</button>
                </div>`;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            // Add keyframe styles if not already present
            if (!document.getElementById('logoutModalStyles')) {
                const style = document.createElement('style');
                style.id = 'logoutModalStyles';
                style.textContent = `
                    @keyframes fadeIn { from{opacity:0} to{opacity:1} }
                    @keyframes slideUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }`;
                document.head.appendChild(style);
            }

            const cleanup = () => {
                overlay.remove();
                document.removeEventListener('keydown', keyHandler);
            };

            const keyHandler = (e) => {
                if (e.key === 'Escape') { cleanup(); resolve(false); }
            };
            document.addEventListener('keydown', keyHandler);

            document.getElementById('logoutCancelBtn').addEventListener('click', () => { cleanup(); resolve(false); });
            document.getElementById('logoutConfirmBtn').addEventListener('click', () => { cleanup(); resolve(true); });
            overlay.addEventListener('click', (e) => { if (e.target === overlay) { cleanup(); resolve(false); } });
        });
    }

    /**
     * Handle logout
     * Shows confirmation modal, then clears auth data and redirects
     */
    async function handleLogout() {
        const confirmed = await showLogoutModal();
        if (!confirmed) return;
        clearAuthData();
        window.location.href = CONFIG.HOME_URL;
    }

    /**
     * Redirect to login if not authenticated
     * Use this on protected pages
     * @param {'patient' | 'doctor'} [requiredRole] - Optional required role
     * @returns {boolean} True if authenticated (and role matches if specified)
     */
    function requireAuth(requiredRole = null) {
        if (!isLoggedIn()) {
            window.location.href = CONFIG.AUTH_URLS.login;
            return false;
        }

        if (requiredRole && getUserType() !== requiredRole) {
            // Wrong role - redirect to appropriate dashboard
            window.location.href = getDashboardUrl();
            return false;
        }

        return true;
    }

    /**
     * Redirect to dashboard if already authenticated
     * Use this on login/signup pages
     */
    function redirectIfAuthenticated() {
        if (isLoggedIn()) {
            window.location.href = getDashboardUrl();
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Initialize auth state on page load
     * Checks auth state, renders appropriate buttons, sets up event listeners
     * @param {Object} [options] - Initialization options
     * @param {string} [options.containerId] - Container ID for auth buttons (default: 'navbarActions')
     * @param {string} [options.headerSelector] - Header/navbar selector (default: '.navbar')
     * @param {boolean} [options.requireAuth] - Whether this page requires authentication
     * @param {'patient' | 'doctor'} [options.requiredRole] - Required role for this page
     * @param {boolean} [options.redirectIfAuth] - Redirect to dashboard if already authenticated (for login/signup pages)
     */
    function initAuth(options = {}) {
        const {
            containerId = 'navbarActions',
            headerSelector = '.navbar',
            requireAuth: requireAuthFlag = false,
            requiredRole = null,
            redirectIfAuth = false,
        } = options;

        // Handle redirect-if-authenticated (for login/signup pages)
        if (redirectIfAuth) {
            redirectIfAuthenticated();
        }

        // Handle require-auth (for protected pages)
        if (requireAuthFlag) {
            if (!requireAuth(requiredRole)) {
                return; // Stop initialization if not authenticated
            }
        }

        // Cross-tab bootstrap: when this page is opened in a new tab while
        // the user is already logged in elsewhere, sessionStorage is empty
        // but localStorage isn't. Mirror the localStorage fields the
        // dashboard pages read (user_id, user_role, user_name) into
        // sessionStorage so they can fetch their data and render. This is
        // a no-op on the tab that originally logged in.
        bootstrapSessionFromLocal();

        // Initialize header if present
        initHeader(headerSelector);

        // Setup dashboard sidebar toggle (#sidebarToggle → #dashboardSidebar).
        // This must run for dashboard pages too, which use <header class="dashboard-header">
        // and therefore don't match the default `.navbar` headerSelector, so
        // initHeader() above bails out before its own sidebar wiring.
        initDashboardSidebar();

        // Render auth buttons
        renderAuthButtons(containerId);

        // Close dropdowns when clicking outside
        document.addEventListener('click', () => {
            closeAllDropdowns();
        });

        // Handle escape key to close dropdowns
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeAllDropdowns();
            }
        });

        // Dispatch custom event for other scripts to listen to
        document.dispatchEvent(new CustomEvent('authManager:ready', {
            detail: { isLoggedIn: isLoggedIn(), userType: getUserType(), userData: getUserData() }
        }));

        // Cross-tab sync: when another tab updates the avatar / name in
        // localStorage (e.g. the user uploads a new photo in their profile
        // tab, then navigates this tab to the landing page), re-render the
        // navbar so the change is visible without a manual refresh.
        initStorageSync(containerId);
    }

    /**
     * Listen for cross-tab localStorage changes and re-render the navbar
     * when the user avatar / name is updated from another tab, AND
     * invalidate this tab's sessionStorage + redirect to home when the
     * user logs out in another tab.
     *
     * The `storage` event fires in OTHER tabs (not the tab that made
     * the change), so this is the standard way to react to logout
     * happening elsewhere: clearAuthData() removes localStorage keys in
     * Tab A, the browser fires `storage` events in Tab B for each
     * removed key, and this listener picks up the IS_LOGGED_IN one.
     */
    function initStorageSync(containerId) {
        const watchedKeys = new Set([
            CONFIG.STORAGE_KEYS.USER_AVATAR,
            CONFIG.STORAGE_KEYS.USER_NAME,
            CONFIG.STORAGE_KEYS.USER_TYPE,
            CONFIG.STORAGE_KEYS.IS_LOGGED_IN,
        ]);
        window.addEventListener('storage', (e) => {
            if (!e.key || !watchedKeys.has(e.key)) return;

            // Cross-tab logout. When another tab calls clearAuthData(),
            // localStorage.isLoggedIn is removed and this listener fires
            // here. sessionStorage is per-tab and is NOT cleared by
            // clearAuthData() in the other tab — so without this, this
            // tab would keep showing the logged-in dashboard (or any
            // page that trusts sessionStorage) even though the user
            // has logged out. Clear the stale sessionStorage and
            // redirect to home unless we're already on a public page.
            if (e.key === CONFIG.STORAGE_KEYS.IS_LOGGED_IN) {
                const stillLoggedIn = e.newValue === 'true';
                if (!stillLoggedIn) {
                    try { sessionStorage.clear(); } catch (_) {}
                    if (containerId) renderAuthButtons(containerId);
                    const path = window.location.pathname;
                    const onPublicPage =
                        path.endsWith('/index.html') ||
                        path === '/' ||
                        path.endsWith('/auth/login.html') ||
                        path.endsWith('/auth/logout.html') ||
                        path.endsWith('/auth/patient/RegisterPatient.html') ||
                        path.endsWith('/auth/doctor/RegisterDoctor.html');
                    if (!onPublicPage) {
                        window.location.href = CONFIG.HOME_URL;
                    }
                    document.dispatchEvent(new CustomEvent('authManager:signedOut', {
                        detail: { reason: 'cross-tab-logout' }
                    }));
                    return;
                }
            }

            // Avatar / name / type updated in another tab.
            // Only re-render if the user is logged in (otherwise the
            // logged-out markup should be shown instead).
            if (!isLoggedIn()) return;
            renderAuthButtons(containerId);
            // Refresh any avatar/name spots the dashboards manage.
            refreshAllAvatars();
            // Let page-specific scripts react too.
            document.dispatchEvent(new CustomEvent('authManager:userUpdated', {
                detail: { key: e.key, newValue: e.newValue, userData: getUserData() }
            }));
        });
    }

    /**
     * Install ONLY the cross-tab logout listener (no navbar re-render).
     * Use this on pages that don't call initAuth() — e.g. the doctor /
     * patient dashboard, which has its own session guard and doesn't
     * render the AuthManager navbar.
     */
    function installCrossTabLogoutGuard() {
        window.addEventListener('storage', (e) => {
            if (e.key !== CONFIG.STORAGE_KEYS.IS_LOGGED_IN) return;
            const stillLoggedIn = e.newValue === 'true';
            if (stillLoggedIn) return;
            // Another tab logged out. Our sessionStorage is stale.
            try { sessionStorage.clear(); } catch (_) {}
            const path = window.location.pathname;
            const onPublicPage =
                path.endsWith('/index.html') ||
                path === '/' ||
                path.endsWith('/auth/login.html') ||
                path.endsWith('/auth/logout.html') ||
                path.endsWith('/auth/patient/RegisterPatient.html') ||
                path.endsWith('/auth/doctor/RegisterDoctor.html');
            if (!onPublicPage) {
                window.location.href = CONFIG.HOME_URL;
            }
            document.dispatchEvent(new CustomEvent('authManager:signedOut', {
                detail: { reason: 'cross-tab-logout' }
            }));
        });
    }

    /**
     * Persist a user-data update (name / email / avatar) to BOTH the
     * localStorage keys the landing page reads (userName, userAvatar) AND
     * the sessionStorage.user_data the dashboards read, then re-render the
     * navbar so the change is visible without a refresh.
     *
     * @param {Object} patch - Partial user data to update
     * @param {string} [patch.name]   - New display name
     * @param {string} [patch.email]  - New email
     * @param {string} [patch.avatar] - New avatar URL (pass null to clear)
     */
    function syncUser(patch = {}) {
        if (!isLoggedIn()) return;

        // localStorage — read by the landing page's AuthManager.getUserData
        if (Object.prototype.hasOwnProperty.call(patch, 'name') && patch.name) {
            try { localStorage.setItem(CONFIG.STORAGE_KEYS.USER_NAME, patch.name); } catch (_) {}
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'email') && patch.email) {
            try { localStorage.setItem(CONFIG.STORAGE_KEYS.USER_EMAIL, patch.email); } catch (_) {}
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'avatar')) {
            try {
                if (patch.avatar) {
                    localStorage.setItem(CONFIG.STORAGE_KEYS.USER_AVATAR, patch.avatar);
                    // Force the next render of the avatar <img> to re-fetch
                    // by giving it a fresh query-string token.
                    localStorage.setItem(CONFIG.STORAGE_KEYS.USER_AVATAR_BUST, String(Date.now()));
                    // Keep the per-role cache (the one the dashboard's
                    // initDoctorAvatar / landing-page navbar / any
                    // cross-tab fresh-tab bootstrap all fall back to)
                    // in sync. Without this, opening a new tab on a
                    // device that hasn't yet visited the profile page
                    // would see a stale avatar.
                    const role = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_TYPE)
                              || sessionStorage.getItem(CONFIG.SESSION_KEYS.USER_ROLE)
                              || 'user';
                    const uid  = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_ID)
                              || sessionStorage.getItem(CONFIG.SESSION_KEYS.USER_ID);
                    if (uid) {
                        localStorage.setItem(avatarStorageKey(role, uid), patch.avatar);
                    }
                } else {
                    localStorage.removeItem(CONFIG.STORAGE_KEYS.USER_AVATAR);
                    localStorage.removeItem(CONFIG.STORAGE_KEYS.USER_AVATAR_BUST);
                    const role = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_TYPE)
                              || sessionStorage.getItem(CONFIG.SESSION_KEYS.USER_ROLE)
                              || 'user';
                    const uid  = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_ID)
                              || sessionStorage.getItem(CONFIG.SESSION_KEYS.USER_ID);
                    if (uid) {
                        localStorage.removeItem(avatarStorageKey(role, uid));
                    }
                }
            } catch (_) {}
        }

        // sessionStorage.user_data — read by every dashboard page
        try {
            const raw = sessionStorage.getItem(CONFIG.SESSION_KEYS.USER_DATA);
            if (raw) {
                const u = JSON.parse(raw);
                if (Object.prototype.hasOwnProperty.call(patch, 'name'))   u.full_name  = patch.name;
                if (Object.prototype.hasOwnProperty.call(patch, 'email'))  u.email      = patch.email;
                if (Object.prototype.hasOwnProperty.call(patch, 'avatar')) u.avatar_url = patch.avatar || null;
                sessionStorage.setItem(CONFIG.SESSION_KEYS.USER_DATA, JSON.stringify(u));
            }
        } catch (_) { /* ignore */ }

        // Re-render the navbar so the change shows up immediately on the
        // current page (same-tab navigation case).
        renderAuthButtons('navbarActions');
        refreshAllAvatars();

        // Notify page-specific scripts in the same tab that the user data
        // changed — the dashboards listen to this to refresh their own
        // sidebar / header / dropdowns without a full reload.
        document.dispatchEvent(new CustomEvent('authManager:userUpdated', {
            detail: { patch, userData: getUserData() }
        }));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PUBLIC API
    // ══════════════════════════════════════════════════════════════════════════

    return {
        // Auth state
        isLoggedIn,
        getUserData,
        getUserType,
        getDashboardUrl,
        getLoginUrl,
        getSignupUrls,
        bootstrapSessionFromLocal,

        // Button rendering
        renderAuthButtons,
        renderAuthButtonsFromElement,

        // Header
        initHeader,

        // Avatar helpers
        avatarStorageKey,
        resolveUrl,
        initDoctorAvatar,
        refreshAllAvatars,
        initSidebarFooterPanel,

        // Auth actions
        setAuthData,
        syncUser,
        clearAuthData,
        handleLogout,
        requireAuth,
        redirectIfAuthenticated,

        // Initialization
        initAuth,
        installCrossTabLogoutGuard,

        // Config (exposed for reference)
        CONFIG,
    };
})();

// ══════════════════════════════════════════════════════════════════════════════
// SYNCHRONOUS SESSION BOOTSTRAP (runs at script-parse time)
// ══════════════════════════════════════════════════════════════════════════════
//
// Patient page scripts (dashboard.js, profile/script.js, etc.) read
// sessionStorage.user_id / user_role at module-load time, BEFORE the
// DOMContentLoaded handler below fires. If we waited until then, a
// dashboard link opened in a fresh tab would briefly see empty
// sessionStorage and the page's module-level `const userId = ...` would
// be `null`, breaking the API call.
//
// Running the bootstrap synchronously here, right after the IIFE has
// defined AuthManager, guarantees the mirror is in place before any
// subsequent <script> tag executes.
AuthManager.bootstrapSessionFromLocal();

// ══════════════════════════════════════════════════════════════════════════════
// AUTO-INITIALIZE ON DOMContentLoaded
// ══════════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    // Auto-initialize with default settings
    // Pages can override by calling AuthManager.initAuth() with custom options
    // before DOMContentLoaded fires, or by calling it again after
    if (!AuthManager._manualInit) {
        AuthManager.initAuth();
    }
});

// Flag to allow manual initialization to override auto-init
AuthManager._manualInit = false;
