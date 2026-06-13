// Backend API base URL — backend runs on port 5000, frontend on port 80 (nginx)
const API_BASE = 'http://localhost:5000';

// User info from session
const getUserInfo = () => {
    const userId = sessionStorage.getItem("user_id");
    const userRole = sessionStorage.getItem("user_role");
    const userType = userRole === 'doctor' ? 'doctor' : 'patient';
    return {
        userId: userId,
        userType: userType,
        patientId: userType === 'patient' ? userId : null,
        doctorId: userType === 'doctor' ? userId : null
    };
};

// ─── Avatar helpers ─────────────────────────────────────────────────────
// Source the user's photo from the same places the rest of the app does:
//  1. sessionStorage.user_data.avatar_url  (DB-backed, refreshed on login)
//  2. localStorage[`avatar_${role}_${id}`] (client cache)
// Returns an absolute URL (via the same resolver the profile page uses) or
// null when no photo is set.
function getCurrentUserAvatarUrl() {
    const role = sessionStorage.getItem('user_role') || 'patient';
    const userId = sessionStorage.getItem('user_id');
    const resolve = (u) => {
        if (!u) return null;
        if (typeof AuthManager !== 'undefined' && AuthManager.resolveUrl) return AuthManager.resolveUrl(u);
        if (u.startsWith('http') || u.startsWith('data:')) return u;
        if (u.startsWith('/')) return 'http://localhost:5000' + u;
        return 'http://localhost:5000/' + u;
    };

    try {
        const raw = sessionStorage.getItem('user_data');
        if (raw) {
            const u = JSON.parse(raw);
            if (u.avatar_url) {
                const resolved = resolve(u.avatar_url);
                if (resolved) {
                    localStorage.setItem(`avatar_${role}_${userId}`, resolved);
                    return resolved;
                }
            }
        }
    } catch (_) { /* ignore */ }

    try {
        const cached = localStorage.getItem(`avatar_${role}_${userId}`);
        if (cached) return resolve(cached);
    } catch (_) { /* ignore */ }

    return null;
}

function getCurrentUserName() {
    try {
        const raw = sessionStorage.getItem('user_data');
        if (raw) {
            const u = JSON.parse(raw);
            if (u.full_name) return u.full_name;
        }
    } catch (_) { /* ignore */ }
    return 'User';
}

function getUserInitials(name) {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] || 'U') + (parts[1]?.[0] || '')).toUpperCase();
}

// Build the avatar <div> for a message bubble. Uses the user's profile
// photo for user messages and the chatbot image for bot messages, with a
// graceful onerror fallback to initials / "AI".
function getMessageAvatar(sender) {
    if (sender === 'user') {
        const url   = getCurrentUserAvatarUrl();
        const name  = getCurrentUserName();
        const init  = getUserInitials(name);
        if (url) {
            return `<div class="message-avatar">` +
                   `<img src="${url.replace(/"/g, '&quot;')}" alt="${name.replace(/"/g, '&quot;')}" onerror="this.parentElement.textContent='${init}'">` +
                   `</div>`;
        }
        return `<div class="message-avatar">${init}</div>`;
    }
    // bot
    return `<div class="message-avatar">` +
           `<img src="chatbot.png" alt="CardioAI" onerror="this.parentElement.textContent='AI'">` +
           `</div>`;
}

// Application State
const state = {
    currentLanguage: 'en',
    darkMode: false,
    currentSessionId: null,
    chats: [],
    currentMessages: [],
    uploadedFiles: [],
    mediaRecorder: null,
    audioChunks: [],
    isRecording: false,
    recordingTimer: null,
    recordingStartTime: null,
    audioContext: null,
    analyser: null,
    animationFrameId: null,
    selectedModel: 'general-model',
    isLoadingChats: false,
    isGenerating: false,
    currentAbortController: null,
    isSending: false,
    isCreatingSession: false
};

// DOM Elements
const elements = {
    // Sidebar elements
    sidebar: document.querySelector('.sidebar'),
    sidebarOverlay: document.getElementById('sidebarOverlay'),
    backButton: document.getElementById('backButton'),
    sidebarCloseMobile: document.getElementById('sidebarCloseMobile'),
    hamburgerMenu: document.getElementById('hamburgerMenu'),
    menuButton: document.getElementById('menuButton'),
    menuDropdown: document.getElementById('menuDropdown'),
    menuClose: document.getElementById('menuClose'),
    newChatButton: document.getElementById('newChatButton'),
    newChatFab: document.getElementById('newChatFab'),
    searchInput: document.getElementById('searchInput'),
    chatsList: document.getElementById('chatsList'),
    settingsButton: document.getElementById('settingsButton'),
    logoContainer: document.getElementById('logoContainer'),
    pageTitleMain: document.getElementById('pageTitleMain'),

    // Main content elements
    exitButton: document.getElementById('exitButton'),
    modelSelector: document.getElementById('modelSelector'),
    modelSelectorButton: document.getElementById('modelSelectorButton'),
    modelSelectorMenu: document.getElementById('modelSelectorMenu'),
    selectedModelName: document.getElementById('selectedModelName'),

    // Chat area elements
    chatArea: document.getElementById('chatArea'),
    welcomeMessage: document.getElementById('welcomeMessage'),
    welcomeText: document.getElementById('welcomeText'),
    messagesContainer: document.getElementById('messagesContainer'),
    messageInput: document.getElementById('messageInput'),
    sendButton: document.getElementById('sendButton'),
    stopButton: document.getElementById('stopButton'),
    inputControls: document.querySelector('.input-controls'),

    // Modals
    settingsModal: document.getElementById('settingsModal'),
    profileSettingsModal: document.getElementById('profileSettingsModal'),
    vitalsModal: document.getElementById('vitalsModal'),
    vitalsPatientSelect: document.getElementById('vitalsPatientSelect'),
    vitalsLoadBtn: document.getElementById('vitalsLoadBtn'),
    vitalsNotice: document.getElementById('vitalsNotice'),

    // Settings modal elements
    closeSettings: document.getElementById('closeSettings'),
    darkModeToggle: document.getElementById('darkModeToggle'),
    languageSelect: document.getElementById('languageSelect'),
    soundToggle: document.getElementById('soundToggle'),
    notificationsToggle: document.getElementById('notificationsToggle'),
    settingsTitle: document.getElementById('settingsTitle'),
    darkModeLabel: document.getElementById('darkModeLabel'),
    languageLabel: document.getElementById('languageLabel'),

    // Profile Settings modal elements
    closeProfileSettings: document.getElementById('closeProfileSettings'),
    profileDarkModeToggle: document.getElementById('profileDarkModeToggle'),
    profileSettingsCancel: document.getElementById('profileSettingsCancel'),
    profileSettingsSave: document.getElementById('profileSettingsSave'),
    profileSettingsTitle: document.getElementById('profileSettingsTitle'),
    profileDarkModeLabel: document.getElementById('profileDarkModeLabel'),
    profileLanguageLabel: document.getElementById('profileLanguageLabel'),

    // Hidden inputs
    hiddenImageInput: document.getElementById('hiddenImageInput'),
    hiddenFileInput: document.getElementById('hiddenFileInput'),
    hiddenAudioInput: document.getElementById('hiddenAudioInput'),
    hiddenVideoInput: document.getElementById('hiddenVideoInput'),

    // Audio elements
    audioPlayer: document.getElementById('audioPlayer'),
    notificationSound: document.getElementById('notificationSound'),

    // User elements
    username: document.getElementById('username'),
    userStatus: document.getElementById('userStatus'),
    userAvatar: document.getElementById('userAvatar'),
    avatarPlaceholder: document.getElementById('avatarPlaceholder')
};

const chatModels = {
    'general-model': 'General Model',
    'cardioai-vitals': '🫀 CardioAI Vitals',
    'cardioai-ecg': '📊 CardioAI ECG'
};

// Text based on language
const texts = {
    en: {
        // Navigation
        menu: "Menu",
        chats: "Chats",
        newChat: "New Chat",
        search: "Search",
        back: "Back",
        exit: "Exit",
        
        // User status
        online: "Online",
        offline: "Offline",
        
        // Welcome
        welcome: "What can I help you today?",
        messagePlaceholder: "What can I help you today?",
        aiAssistant: "AI Assistant",
        emptyChat: "Start a conversation with CardioAI",
        
        // Suggestions
        heartDiseaseSymptoms: "Heart disease symptoms",
        heartHealthTips: "Heart health tips",
        medicalTests: "Medical tests",
        vitalsCheck: "Vitals Check",
        ecgAnalysis: "ECG Analysis",
        
        // Models
        selectModel: "Select Model",
        generalModel: "General Model",
        cardioaiVitals: "CardioAI Vitals",
        cardioaiECG: "CardioAI ECG",
        
        // Settings
        settings: "Settings",
        profileSettings: "Profile Settings",
        darkMode: "Dark Mode",
        language: "Language",
        notificationSound: "Notification Sound",
        desktopNotifications: "Desktop Notifications",
        
        // Menu
        help: "Help",
        about: "About",
        logout: "Logout",
        
        // Actions
        cancel: "Cancel",
        save: "Save",
        delete: "Delete",
        retry: "Retry",
        close: "Close",
        analyze: "Analyze",
        
        // Vitals
        systolicBP: "Systolic BP (mmHg)",
        diastolicBP: "Diastolic BP (mmHg)",
        heartRate: "Heart Rate (bpm)",
        temperature: "Temperature (°C)",
        respiratoryRate: "Respiratory Rate (/min)",
        oxygenSaturation: "Oxygen Saturation (%)",
        bmi: "BMI",
        selectPatient: "Select Patient",
        loadingPatients: "Loading patients…",
        loadLatestVitals: "Load Latest Vitals",

        // Messages
        send: "Send",
        typing: "CardioAI is typing...",
        recording: "Recording...",
        fileUploaded: "File uploaded",
        photoTaken: "Photo taken",
        noCamera: "Camera not available",
        noMicrophone: "Microphone not available",
        
        // Confirmations
        confirmExit: "Do you want to exit the chat?",
        confirmDelete: "Are you sure you want to delete this chat?",
        confirmLogout: "Are you sure you want to logout?",
        
        // Help & About
        helpMessage: "For help, please visit the support page",
        aboutMessage: "CardioAI v1.0\nAI-Powered Cardiac Health Assistant"
    },
    ar: {
        // Navigation
        menu: "القائمة",
        chats: "المحادثات",
        newChat: "محادثة جديدة",
        search: "بحث",
        back: "رجوع",
        exit: "خروج",
        
        // User status
        online: "متصل",
        offline: "غير متصل",
        
        // Welcome
        welcome: "كيف يمكنني مساعدتك اليوم؟",
        messagePlaceholder: "كيف يمكنني مساعدتك اليوم؟",
        aiAssistant: "مساعد الذكاء الاصطناعي",
        emptyChat: "ابدأ محادثة مع CardioAI",
        
        // Suggestions
        heartDiseaseSymptoms: "أعراض أمراض القلب",
        heartHealthTips: "نصائح لصحة القلب",
        medicalTests: "الفحوصات الطبية",
        vitalsCheck: "فحص العلامات الحيوية",
        ecgAnalysis: "تحليل تخطيط القلب",
        
        // Models
        selectModel: "اختر النموذج",
        generalModel: "النموذج العام",
        cardioaiVitals: "CardioAI العلامات الحيوية",
        cardioaiECG: "CardioAI تخطيط القلب",
        
        // Settings
        settings: "الإعدادات",
        profileSettings: "إعدادات الملف الشخصي",
        darkMode: "الوضع الداكن",
        language: "اللغة",
        notificationSound: "صوت الإشعارات",
        desktopNotifications: "إشعارات سطح المكتب",
        
        // Menu
        help: "المساعدة",
        about: "حول",
        logout: "تسجيل الخروج",
        
        // Actions
        cancel: "إلغاء",
        save: "حفظ",
        delete: "حذف",
        retry: "إعادة المحاولة",
        close: "إغلاق",
        analyze: "تحليل",
        
        // Vitals
        systolicBP: "ضغط الدم الانقباضي (مم زئبق)",
        diastolicBP: "ضغط الدم الانبساطي (مم زئبق)",
        heartRate: "معدل ضربات القلب (نبضة/دقيقة)",
        temperature: "درجة الحرارة (°م)",
        respiratoryRate: "معدل التنفس (/دقيقة)",
        oxygenSaturation: "تشبع الأكسجين (%)",
        bmi: "مؤشر كتلة الجسم",
        selectPatient: "اختر المريض",
        loadingPatients: "جارٍ تحميل المرضى…",
        loadLatestVitals: "تحميل آخر العلامات الحيوية",

        // Messages
        send: "إرسال",
        typing: "CardioAI يكتب...",
        recording: "جاري التسجيل...",
        fileUploaded: "تم رفع الملف",
        photoTaken: "تم التقاط الصورة",
        noCamera: "الكاميرا غير متاحة",
        noMicrophone: "الميكروفون غير متاح",
        
        // Confirmations
        confirmExit: "هل تريد الخروج من المحادثة؟",
        confirmDelete: "هل أنت متأكد من حذف هذه المحادثة؟",
        confirmLogout: "هل أنت متأكد من تسجيل الخروج؟",
        
        // Help & About
        helpMessage: "للمساعدة، يرجى زيارة صفحة الدعم الفني",
        aboutMessage: "CardioAI v1.0\nمساعد صحة القلب بالذكاء الاصطناعي"
    }
};

// Check Authentication - allows any logged-in user (patient or doctor)
function checkAuthentication() {
    const userId = sessionStorage.getItem("user_id");
    const userRole = sessionStorage.getItem("user_role");
    const userData = sessionStorage.getItem("user_data");
    
    // Check if user has valid session data
    if (!userId || !userRole || !userData) {
        // Not logged in - redirect to login
        window.location.href = "../auth/login.html";
        return false;
    }
    
    // Validate that userRole is either 'patient' or 'doctor'
    if (userRole !== 'patient' && userRole !== 'doctor') {
        // Invalid role - clear session and redirect
        sessionStorage.clear();
        window.location.href = "../auth/login.html";
        return false;
    }
    
    // User is logged in with valid role - allow access
    return true;
}

// Load User Data
function loadUserData() {
    const rawData = sessionStorage.getItem("user_data");
    const userId = sessionStorage.getItem("user_id");
    const userRole = sessionStorage.getItem("user_role");
    const t = texts[state.currentLanguage];
    
    let userName = t.online; // fallback
    let initials = "U";
    
    if (rawData) {
        try {
            const user = JSON.parse(rawData);
            userName = user.full_name || "User";
            
            // Update username display
            if (elements.username) {
                elements.username.textContent = userName;
            }
            
            // Calculate initials
            const name = userName;
            const parts = name.trim().split(/\s+/);
            initials = (parts[0]?.[0] || 'U').toUpperCase() + (parts[1]?.[0] || '').toUpperCase();
            
        } catch (e) {
            console.error("Chatbot user sync error:", e);
        }
    } else {
        // No user data - use fallback
        if (elements.username) {
            elements.username.textContent = "User";
        }
    }
    
    // Update avatar
    if (elements.userAvatar) {
        // Check for saved photo
        const savedPhoto = localStorage.getItem(`avatar_${userRole}_${userId}`);
        
        if (savedPhoto) {
            elements.userAvatar.innerHTML = `<img src="${savedPhoto}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
        } else {
            elements.userAvatar.innerHTML = `<div class="avatar-placeholder" style="display:flex;align-items:center;justify-content:center;background:var(--primary-blue);color:#fff;font-weight:700;border-radius:50%;width:100%;height:100%;">${initials}</div>`;
        }
    }
}

// Initialize Application
async function initApp() {
    // Check authentication first
    const isAuthenticated = checkAuthentication();
    if (!isAuthenticated) return;

    // Replace the native <select> dropdowns with custom wrappers
    // that match the #modelSelector design. The native <select>s
    // stay in the DOM (hidden) as the value source of truth, and
    // `change` events keep firing as before.
    enhanceSelect(document.getElementById('languageSelect'));
    enhanceSelect(document.getElementById('vitalsPatientSelect'));

    updateUIByLanguage();
    attachEventListeners();
    attachMenuListeners();

    // Check for saved settings
    const savedDarkMode = localStorage.getItem('darkMode') === 'true';
    const savedLanguage = localStorage.getItem('language') || 'en';
    const savedModel = localStorage.getItem('selectedChatModel');
    const validModels = ['general-model', 'cardioai-vitals', 'cardioai-ecg'];

    if (savedModel && validModels.includes(savedModel)) {
        state.selectedModel = savedModel;
    } else {
        state.selectedModel = 'general-model';
        localStorage.setItem('selectedChatModel', 'general-model');
    }
    updateSelectedModelUI();

    if (savedDarkMode) {
        toggleDarkMode(true);
        elements.darkModeToggle.checked = true;
        elements.profileDarkModeToggle.checked = true;
    }

    if (savedLanguage !== 'en') {
        state.currentLanguage = savedLanguage;
        elements.languageSelect.value = savedLanguage;
        
        // Set RTL direction for Arabic
        document.documentElement.lang = savedLanguage;
        document.documentElement.dir = savedLanguage === 'ar' ? 'rtl' : 'ltr';
        
        updateUIByLanguage();
        updateModalTexts();
    }

    // Load user data
    loadUserData();

    // Load chat history from database
    await loadChatHistory();
    
    // Clean up any empty sessions
    await cleanupEmptySessions();

    // Desktop Collapse Adapter: Sidebar active by default on Desktop monitors
    if (window.innerWidth > 1024) {
        openSidebar();
    }
}

// Load chat history - reuse empty session or create a new one
async function loadChatHistory() {
    const userInfo = getUserInfo();
    if (!userInfo.userId) return;

    state.isLoadingChats = true;
    
    try {
        // Fetch existing chats to display in sidebar
        const response = await fetch(`${API_BASE}/api/chat-history/chats?userId=${userInfo.userId}&userType=${userInfo.userType}`);
        if (response.ok) {
            const data = await response.json();
            state.chats = data.chats || [];
        }
    } catch (err) {
        console.error("Error loading chat history:", err);
    }
    
    // Check if there's already an empty session (0 messages) to reuse
    const emptySession = state.chats.find(session =>
        !session.messages || session.messages.length === 0
    );
    
    if (emptySession) {
        state.currentSessionId = emptySession.id;
        state.currentMessages = [];
    } else {
        const newSessionId = await createNewChatSession();
        if (newSessionId) {
            state.currentSessionId = newSessionId;
            state.currentMessages = [];
        }
    }
    
    state.isLoadingChats = false;
    renderChatsList();
}

// Create a new chat session
async function createNewChatSession() {
    const userInfo = getUserInfo();
    if (!userInfo.userId) return null;

    try {
        const response = await fetch(`${API_BASE}/api/chat-history/session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: userInfo.userId,
                userType: userInfo.userType,
                title: 'New Chat'
            })
        });

        if (response.ok) {
            const data = await response.json();
            const newSession = data.session;
            state.chats.unshift({
                id: newSession.id,
                title: newSession.title,
                messages: [],
                created_at: newSession.created_at
            });
            state.currentSessionId = newSession.id;
            state.currentMessages = [];
            
            renderChatsList();
            
            return newSession.id;
        }
    } catch (err) {
        console.error("Error creating new chat session:", err);
    }
    return null;
}

// Render Chats List
function renderChatsList() {
    elements.chatsList.innerHTML = '';

    state.chats.forEach(chat => {
        const chatItem = document.createElement('div');
        const isActive = chat.id === state.currentSessionId;
        chatItem.className = `chat-item ${isActive ? 'active' : ''}`;

        // Get last user message as preview
        const lastUserMsg = [...(chat.messages || [])].reverse().find(m => m.role === 'user');
        const preview = lastUserMsg
            ? (lastUserMsg.content.length > 35 ? lastUserMsg.content.substring(0, 35) + '...' : lastUserMsg.content)
            : '';

        chatItem.innerHTML = `
            <i class="fas fa-comment"></i>
            <div class="chat-item-info">
                <span class="chat-name">${chat.title || 'New Chat'}</span>
                ${preview ? `<span class="chat-preview">${preview}</span>` : ''}
            </div>
            <button class="chat-delete-btn" data-id="${chat.id}">
                <i class="fas fa-times"></i>
            </button>
        `;

        chatItem.addEventListener('click', (e) => {
            if (!e.target.closest('.chat-delete-btn')) switchChat(chat.id);
        });

        const deleteBtn = chatItem.querySelector('.chat-delete-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteChat(chat.id);
        });

        elements.chatsList.appendChild(chatItem);
    });
}

// Generate chat title from AI analysis result
async function generateTitleFromResult(data, modelType) {
    try {
        const riskLevel = data.risk_level || data.risk || 'unknown';
        
        let title;
        if (modelType === 'vitals') {
            if (riskLevel.toLowerCase().includes('high') || riskLevel.toLowerCase().includes('severe')) {
                title = '⚠️ High Risk Vitals';
            } else if (riskLevel.toLowerCase().includes('medium') || riskLevel.toLowerCase().includes('moderate')) {
                title = '⚡ Moderate Risk Vitals';
            } else if (riskLevel.toLowerCase().includes('low') || riskLevel.toLowerCase().includes('normal') || riskLevel.toLowerCase().includes('healthy')) {
                title = '✅ Healthy Vitals';
            } else {
                title = `📊 Vitals Analysis - ${riskLevel}`;
            }
        } else if (modelType === 'ecg') {
            if (riskLevel.toLowerCase().includes('high') || riskLevel.toLowerCase().includes('severe') || riskLevel.toLowerCase().includes('abnormal')) {
                title = '⚠️ Abnormal ECG Result';
            } else if (riskLevel.toLowerCase().includes('medium') || riskLevel.toLowerCase().includes('moderate')) {
                title = '⚡ Borderline ECG';
            } else if (riskLevel.toLowerCase().includes('low') || riskLevel.toLowerCase().includes('normal') || riskLevel.toLowerCase().includes('healthy')) {
                title = '✅ Normal ECG';
            } else {
                title = `📈 ECG Analysis - ${riskLevel}`;
            }
        }
        
        if (title && state.currentSessionId) {
            await fetch(`${API_BASE}/api/chat-history/session/${state.currentSessionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: title })
            });
            
            const currentChat = state.chats.find(c => c.id === state.currentSessionId);
            if (currentChat) {
                currentChat.title = title;
                renderChatsList();
            }
        }
    } catch (err) {
        console.error('Error generating title:', err);
    }
}

// Switch Chat - delete empty session when switching
async function switchChat(chatId) {
    if (chatId === state.currentSessionId) {
        return; 
    }

    const currentChat = state.chats.find(c => c.id === state.currentSessionId);
    if (currentChat && state.currentMessages.length === 0) {
        try {
            await fetch(`${API_BASE}/api/chat-history/session/${state.currentSessionId}`, {
                method: 'DELETE'
            });
        } catch (err) {
            console.error("Error deleting empty session:", err);
        }
        state.chats = state.chats.filter(c => c.id !== state.currentSessionId);
    }

    state.currentSessionId = chatId;
    renderChatsList();
    await loadCurrentChatMessagesFromDb();
}

// Delete Chat - always ensure at least one session exists
async function deleteChat(chatId) {
    if (confirm(getText('confirmDelete'))) {
        if (state.chats.length <= 1) {
            const newSessionId = await createNewChatSession();
            if (newSessionId) {
                try {
                    await fetch(`${API_BASE}/api/chat-history/session/${chatId}`, {
                        method: 'DELETE'
                    });
                } catch (err) {
                    console.error("Error deleting chat:", err);
                }
                
                state.chats = state.chats.filter(chat => chat.id !== chatId);
                state.currentSessionId = newSessionId;
                state.currentMessages = [];
            }
        } else {
            try {
                await fetch(`${API_BASE}/api/chat-history/session/${chatId}`, {
                    method: 'DELETE'
                });
            } catch (err) {
                console.error("Error deleting chat:", err);
            }

            state.chats = state.chats.filter(chat => chat.id !== chatId);

            if (state.currentSessionId === chatId) {
                state.currentSessionId = state.chats[0].id;
            }
        }

        renderChatsList();
        await loadCurrentChatMessagesFromDb();
    }
}

// Clean up empty chat sessions
async function cleanupEmptySessions() {
    const userInfo = getUserInfo();
    if (!userInfo.userId) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/chat-history/chats?userId=${userInfo.userId}&userType=${userInfo.userType}`);
        if (response.ok) {
            const data = await response.json();
            const chats = data.chats || [];
            
            const emptySessions = chats.filter(chat =>
                (!chat.messages || chat.messages.length === 0) &&
                chat.id !== state.currentSessionId
            );
            
            for (const session of emptySessions) {
                try {
                    await fetch(`${API_BASE}/api/chat-history/session/${session.id}`, {
                        method: 'DELETE'
                    });
                } catch (err) {
                    console.error('Error deleting empty session:', err);
                }
            }
            
            const emptyIds = new Set(emptySessions.map(s => s.id));
            state.chats = state.chats.filter(c => !emptyIds.has(c.id) || c.id === state.currentSessionId);
        }
    } catch (err) {
        console.error('Error cleaning up empty sessions:', err);
    }
}

// Load current chat messages from database
async function loadCurrentChatMessagesFromDb() {
    if (!state.currentSessionId) {
        state.currentMessages = [];
        elements.messagesContainer.innerHTML = '';
        elements.welcomeMessage.style.display = 'flex';
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/chat-history/messages/${state.currentSessionId}`);
        if (response.ok) {
            const data = await response.json();
            const messages = data.messages || [];
            
            state.currentMessages = messages.map(msg => {
                let timestamp;
                if (msg.created_at) {
                    timestamp = new Date(msg.created_at);
                    if (isNaN(timestamp.getTime())) {
                        timestamp = new Date();
                    }
                } else {
                    timestamp = new Date();
                }
                
                return {
                    id: msg.id,
                    text: msg.content || '',
                    sender: msg.role === 'assistant' ? 'bot' : 'user',
                    timestamp: timestamp,
                    type: 'text'
                };
            });
        } else {
            state.currentMessages = [];
        }
    } catch (err) {
        console.error("Error loading messages from DB:", err);
        state.currentMessages = [];
    }

    elements.messagesContainer.innerHTML = '';

    if (state.currentMessages.length === 0 && !state.isSending) {
        elements.welcomeMessage.style.display = 'flex';
    } else if (state.currentMessages.length > 0) {
        elements.welcomeMessage.style.display = 'none';
        state.currentMessages.forEach(msg => renderMessage(msg));
        scrollToBottom();
    }
}

// Load Current Chat Messages (fallback)
async function loadCurrentChatMessages() {
    const currentChat = state.chats.find(chat => chat.id === state.currentSessionId);
    if (!currentChat) {
        state.currentMessages = [];
        elements.messagesContainer.innerHTML = '';
        elements.welcomeMessage.style.display = 'flex';
        return;
    }

    state.currentMessages = (currentChat.messages || []).map(msg => {
        let timestamp;
        if (msg.created_at) {
            timestamp = new Date(msg.created_at);
            if (isNaN(timestamp.getTime())) {
                timestamp = new Date();
            }
        } else {
            timestamp = new Date(); 
        }
        
        return {
            id: msg.id,
            text: msg.content,
            sender: msg.role === 'assistant' ? 'bot' : (msg.role === 'user' ? 'user' : 'bot'),
            timestamp: timestamp,
            type: 'text'
        };
    });

    elements.messagesContainer.innerHTML = '';

    if (state.currentMessages.length === 0 && !state.isSending) {
        elements.welcomeMessage.style.display = 'flex';
    } else if (state.currentMessages.length > 0) {
        elements.welcomeMessage.style.display = 'none';
        state.currentMessages.forEach(msg => renderMessage(msg));
        scrollToBottom();
    }
}

// Update UI based on language
function updateUIByLanguage() {
    const t = texts[state.currentLanguage];

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) {
            if (el.classList.contains('suggestion-btn')) {
                const icon = el.querySelector('i');
                el.textContent = '';
                if (icon) el.appendChild(icon);
                el.appendChild(document.createTextNode(' ' + t[key]));
            } else {
                el.textContent = t[key];
            }
        }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (t[key]) {
            el.placeholder = t[key];
        }
    });

    if (elements.welcomeText) {
        elements.welcomeText.textContent = t.welcome;
    }

    if (elements.messageInput) {
        elements.messageInput.placeholder = t.messagePlaceholder;
    }

    if (elements.userStatus) {
        elements.userStatus.textContent = t.online;
    }

    updateSelectedModelUI();

    document.body.dir = state.currentLanguage === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = state.currentLanguage;

    renderChatsList();
}

// Get text by key
function getText(key) {
    return texts[state.currentLanguage][key] || key;
}

function updateSelectedModelUI() {
    if (elements.selectedModelName) {
        elements.selectedModelName.textContent = chatModels[state.selectedModel];
    }

    document.querySelectorAll('.model-option').forEach(option => {
        option.classList.toggle('active', option.dataset.model === state.selectedModel);
    });
}

function toggleModelSelector() {
    const isOpen = !elements.modelSelector.classList.contains('open');
    elements.modelSelector.classList.toggle('open', isOpen);
    elements.modelSelectorButton.setAttribute('aria-expanded', String(isOpen));

    if (isOpen) {
        if (elements.modelSelectorMenu.parentElement !== document.body) {
            document.body.appendChild(elements.modelSelectorMenu);
        }
        const btnRect = elements.modelSelectorButton.getBoundingClientRect();
        const menu = elements.modelSelectorMenu;
        menu.style.top = (btnRect.bottom + 6) + 'px';
        menu.style.left = Math.max(8, btnRect.right - 215) + 'px';
        menu.style.display = 'block';
    } else {
        elements.modelSelectorMenu.style.display = 'none';
    }
}

function closeModelSelector() {
    elements.modelSelector.classList.remove('open');
    elements.modelSelectorButton.setAttribute('aria-expanded', 'false');
    if (elements.modelSelectorMenu) {
        elements.modelSelectorMenu.style.display = 'none';
    }
}

function selectModel(modelKey) {
    if (!chatModels[modelKey]) return;
    state.selectedModel = modelKey;
    try { localStorage.setItem('selectedChatModel', modelKey); } catch { /* ignore */ }
    updateSelectedModelUI();
    closeModelSelector();

    if (modelKey === 'cardioai-vitals') {
        openVitalsModal();
    } else if (modelKey === 'cardioai-ecg') {
        elements.hiddenFileInput.click();
    }
}

// Attach Event Listeners
function attachEventListeners() {
    if (elements.hamburgerMenu) {
        elements.hamburgerMenu.addEventListener('click', openSidebar);
        elements.hamburgerMenu.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openSidebar();
            }
        });
    }

    if (elements.sidebarCloseMobile) {
        elements.sidebarCloseMobile.addEventListener('click', closeSidebar);
    }

    elements.backButton.addEventListener('click', () => {
        // Toggle/Collapse behavior depending on state & screen width
        if (elements.sidebar.classList.contains('active')) {
            closeSidebar();
        } else {
            openSidebar();
        }
    });
    
    elements.menuButton.addEventListener('click', toggleMenu);
    elements.newChatButton.addEventListener('click', createNewChat);
    elements.newChatFab.addEventListener('click', createNewChat);
    elements.settingsButton.addEventListener('click', openProfileSettings);

    if (elements.menuClose) {
        elements.menuClose.addEventListener('click', closeMenu);
    }

    elements.logoContainer.addEventListener('click', () => {
        window.location.href = '../../index.html';
    });
    elements.logoContainer.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            window.location.href = '../../index.html';
        }
    });

    if (elements.pageTitleMain) {
        elements.pageTitleMain.addEventListener('click', () => {
            window.location.href = '../../index.html';
        });
        elements.pageTitleMain.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                window.location.href = '../../index.html';
            }
        });
    }

    elements.sidebarOverlay.addEventListener('click', closeSidebar);
    elements.searchInput.addEventListener('input', filterChats);
    elements.exitButton.addEventListener('click', exitApp);
    
    elements.modelSelectorButton.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleModelSelector();
    });

    elements.sendButton.addEventListener('click', sendMessage);
    elements.stopButton?.addEventListener('click', stopGeneration);
    elements.messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    elements.hiddenImageInput.addEventListener('change', handleImageUpload);
    elements.hiddenFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.name.toLowerCase().endsWith('.csv')) {
                uploadAndPredictCSV(file);
            } else if (file.type.startsWith('image/')) {
                addFileToUploadList(file, 'image');
                openUploadModal('image');
            } else if (file.type.startsWith('video/')) {
                addFileToUploadList(file, 'video');
                openUploadModal('video');
            } else if (file.type.startsWith('audio/')) {
                addFileToUploadList(file, 'audio');
                openUploadModal('audio');
            }
        }
        e.target.value = '';
    });
    elements.hiddenAudioInput.addEventListener('change', handleAudioUpload);
    elements.hiddenVideoInput.addEventListener('change', handleVideoUpload);

    elements.closeSettings.addEventListener('click', closeSettings);
    elements.darkModeToggle.addEventListener('change', () => toggleDarkMode(elements.darkModeToggle.checked));
    elements.languageSelect.addEventListener('change', changeLanguage);

    elements.closeProfileSettings.addEventListener('click', closeProfileSettings);
    elements.profileSettingsCancel.addEventListener('click', closeProfileSettings);
    elements.profileSettingsSave.addEventListener('click', saveProfileSettings);

    document.addEventListener('click', handleProfileLanguageSelection);

    document.querySelectorAll('.suggestion-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const text = btn.getAttribute('data-text');
            if (text) {
                elements.messageInput.value = text;
                elements.messageInput.focus();
            }
        });
    });

    document.getElementById('quickVitalsCheck').addEventListener('click', openVitalsModal);
    document.getElementById('quickECGAnalysis').addEventListener('click', () => {
        elements.hiddenFileInput.click();
    });

    document.getElementById('closeVitals').addEventListener('click', closeVitalsModal);
    document.getElementById('vitalsCancel').addEventListener('click', closeVitalsModal);
    document.getElementById('vitalsAnalyze').addEventListener('click', submitVitalsAnalysis);
    document.getElementById('vitalsLoadBtn')?.addEventListener('click', () => {
        const role = getActiveUserRole();
        const sel  = document.getElementById('vitalsPatientSelect');
        const id   = role === 'doctor' ? (sel?.value || '') : sessionStorage.getItem('user_id');
        if (role === 'doctor' && !id) {
            setVitalsNotice('Select a patient first.');
            return;
        }
        loadLatestVitalsIntoModal(id);
    });
    document.getElementById('vitalsPatientSelect')?.addEventListener('change', (e) => {
        if (e.target.value) loadLatestVitalsIntoModal(e.target.value);
    });
    window.addEventListener('click', (e) => {
        if (e.target === document.getElementById('vitalsModal')) closeVitalsModal();
    });

    document.addEventListener('mousedown', (e) => {
        const inSelector = e.target.closest('#modelSelector') || (elements.modelSelectorMenu && elements.modelSelectorMenu.contains(e.target));
        if (!inSelector) closeModelSelector();
        
        if (!e.target.closest('#menuButton') && !e.target.closest('#menuDropdown')) {
            closeMenu();
        }
    });

    window.addEventListener('click', (e) => {
        if (e.target === elements.settingsModal) closeSettings();
        if (e.target === elements.profileSettingsModal) closeProfileSettings();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAllModals();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            if (elements.searchInput) elements.searchInput.focus();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            createNewChat();
        }
    });

    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            handleResize();
        }, 250);
    });

    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => e.preventDefault());
}

// Handle window resize
function handleResize() {
    const isMobile = window.innerWidth <= 1024;
    
    if (isMobile && elements.sidebar.classList.contains('active')) {
        closeSidebar();
    } else if (!isMobile && !elements.sidebar.classList.contains('active')) {
        openSidebar();
    }
    
    if (elements.modelSelector.classList.contains('open')) {
        closeModelSelector();
    }
}

// Sidebar Functions
function openSidebar() {
    elements.sidebar.classList.add('active');
    if (window.innerWidth <= 1024) {
        elements.sidebarOverlay.classList.add('active');
        document.body.style.overflow = 'hidden'; 
    }
    elements.sidebar.setAttribute('aria-hidden', 'false');
    if (elements.hamburgerMenu) {
        elements.hamburgerMenu.setAttribute('aria-expanded', 'true');
    }
}

function closeSidebar() {
    elements.sidebar.classList.remove('active');
    elements.sidebarOverlay.classList.remove('active');
    document.body.style.overflow = '';
    elements.sidebar.setAttribute('aria-hidden', 'true');
    if (elements.hamburgerMenu) {
        elements.hamburgerMenu.setAttribute('aria-expanded', 'false');
    }
}

function toggleSidebar() {
    if (elements.sidebar.classList.contains('active')) {
        closeSidebar();
    } else {
        openSidebar();
    }
}

// Menu Functions
function toggleMenu() {
    const isActive = elements.menuDropdown.classList.contains('active');
    if (isActive) {
        closeMenu();
    } else {
        openMenu();
    }
}

function openMenu() {
    elements.menuDropdown.classList.add('active');
    if (elements.menuButton) {
        elements.menuButton.setAttribute('aria-expanded', 'true');
    }
}

function closeMenu() {
    elements.menuDropdown.classList.remove('active');
    if (elements.menuButton) {
        elements.menuButton.setAttribute('aria-expanded', 'false');
    }
}

// Close all modals
function closeAllModals() {
    closeSidebar();
    closeMenu();
    closeSettings();
    closeProfileSettings();
    closeVitalsModal();
}

// Menu Event Listeners
function attachMenuListeners() {
    document.getElementById('menuSettings').addEventListener('click', () => {
        closeMenu();
        openSettings();
    });
    
    document.getElementById('menuHelp').addEventListener('click', () => {
        closeMenu();
        showToast(texts[state.currentLanguage].helpMessage, 'info');
    });
    
    document.getElementById('menuAbout').addEventListener('click', () => {
        closeMenu();
        showToast(texts[state.currentLanguage].aboutMessage, 'info');
    });
    
    document.getElementById('menuLogout').addEventListener('click', () => {
        closeMenu();
        handleLogout();
    });
}

// Toast Notification
function showToast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Logout Function
function handleLogout() {
    const t = texts[state.currentLanguage];
    
    if (confirm(t.confirmLogout)) {
        sessionStorage.clear();
        
        fetch(`${API_BASE}/api/auth/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }).catch(err => console.error('Logout error:', err));
        
        window.location.href = '../auth/login.html';
    }
}

// Filter Chats
function filterChats() {
    const searchTerm = elements.searchInput.value.toLowerCase();
    const chatItems = document.querySelectorAll('.chat-item');

    chatItems.forEach(item => {
        const chatName = item.querySelector('.chat-name').textContent.toLowerCase();
        if (chatName.includes(searchTerm)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// Create New Chat
async function createNewChat() {
    if (state.isCreatingSession) return;
    state.isCreatingSession = true;

    try {
        const existingEmpty = state.chats.find(c =>
            (!c.messages || c.messages.length === 0) && c.id !== state.currentSessionId
        );
        
        if (existingEmpty) {
            const currentChat = state.chats.find(c => c.id === state.currentSessionId);
            if (currentChat && state.currentMessages.length === 0) {
                try {
                    await fetch(`${API_BASE}/api/chat-history/session/${state.currentSessionId}`, {
                        method: 'DELETE'
                    });
                } catch (err) {
                    console.error("Error deleting empty session:", err);
                }
                state.chats = state.chats.filter(c => c.id !== state.currentSessionId);
            }
            
            state.currentSessionId = existingEmpty.id;
            state.currentMessages = [];
            renderChatsList();
            await loadCurrentChatMessagesFromDb();
        } else {
            const currentChat = state.chats.find(c => c.id === state.currentSessionId);
            if (currentChat && state.currentMessages.length === 0) {
                try {
                    await fetch(`${API_BASE}/api/chat-history/session/${state.currentSessionId}`, {
                        method: 'DELETE'
                    });
                } catch (err) {
                    console.error("Error deleting empty session:", err);
                }
                state.chats = state.chats.filter(c => c.id !== state.currentSessionId);
            }
            
            await createNewChatSession();
            await loadCurrentChatMessagesFromDb();
        }
        
        if (window.innerWidth <= 768) toggleSidebar();
        setTimeout(() => elements.messageInput.focus(), 300);
    } finally {
        state.isCreatingSession = false;
    }
}

// AI Analysis Detection
const AI_COMMANDS_EN = ["analyze", "predict", "check my heart", "run analysis", "ecg analysis", "vitals check", "upload data"];
const AI_COMMANDS_AR = ["حلل", "تحليل", "فحص", "حلل بياناتي", "تشخيص", "نتيجة", "ارفع ملف"];

function isAICommand(text) {
    const lower = text.toLowerCase().trim();
    return AI_COMMANDS_EN.some(cmd => lower.includes(cmd)) ||
           AI_COMMANDS_AR.some(cmd => lower.includes(cmd));
}

function buildConversationHistory(newUserText) {
    const systemPrompt = {
        role: 'system',
        content: `You are CardioAI, a medical AI assistant specialized in cardiac health. 
You help patients understand their heart health, ECG results, and vital signs. 
You can answer questions about heart disease, symptoms, medications, and lifestyle. 
Always recommend consulting a real doctor for serious concerns. 
You support both English and Arabic. Respond in the same language the user uses.`
    };

    const history = [systemPrompt];
    state.currentMessages.forEach(msg => {
        history.push({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text
        });
    });
    history.push({ role: 'user', content: newUserText });
    return history;
}

function getPatientId() {
    return sessionStorage.getItem("user_id") || null;
}

function getDoctorId() {
    return sessionStorage.getItem("doctor_id") || null;
}

// Send Message
async function sendMessage() {
    const text = elements.messageInput.value.trim();
    if (!text) return;

    state.isSending = true;
    
    let sid = state.currentSessionId;
    if (!sid) {
        sid = await createNewChatSession();
        if (!sid) {
            console.error("Failed to create session");
            state.isSending = false;
            return;
        }
    }

    elements.welcomeMessage.style.display = 'none';

    const userMessage = {
        id: Date.now(),
        text,
        sender: 'user',
        timestamp: new Date(),
        type: 'text'
    };
    state.currentMessages.push(userMessage);
    const currentChat = state.chats.find(chat => chat.id === sid);
    if (currentChat) {
        currentChat.messages = state.currentMessages;
    }
    
    renderMessage(userMessage);
    scrollToBottom();
    
    elements.messageInput.value = '';
    const userInfo = getUserInfo();

    if (isAICommand(text)) {
        const saveResult = await saveMessageToDb(userMessage, sid);
        if (!saveResult.success) {
            console.error("Failed to save message:", saveResult.error);
            state.currentMessages.pop();
            const el = document.querySelector(`[data-id="${userMessage.id}"]`);
            if (el) el.remove();
            state.isSending = false;
            if (state.currentMessages.length === 0) {
                elements.welcomeMessage.style.display = 'flex';
            }
            return;
        }
        
        if (saveResult.wasRecreated && saveResult.sessionId) {
            sid = saveResult.sessionId;
            state.currentSessionId = saveResult.sessionId;
        }

        const optionsMsg = state.currentLanguage === 'ar'
            ? `لقد طلبت تحليلاً طبياً. كيف تريد المتابعة؟
 
🔹 **العلامات الحيوية** — أدخل العلامات الحيوية (ضغط الدم، النبض، إلخ)
🔹 **رفع ملف CSV** — ارفع ملف بيانات (Vitals أو ECG)
   
👆 استخدم الأزرار أدناه للاختيار:`
            : `You've requested a medical analysis. How would you like to proceed?

🔹 **Vitals Check** — Enter vital signs (BP, heart rate, etc.)
🔹 **Upload CSV** — Upload a data file (Vitals or ECG data)

👆 Use the buttons below to choose:`;

        addMessage({ id: Date.now(), text: optionsMsg, sender: 'bot', timestamp: new Date(), type: 'text' });

        setTimeout(() => {
            const lastMsg = elements.messagesContainer.lastElementChild;
            if (lastMsg) {
                const actionDiv = document.createElement('div');
                actionDiv.className = 'inline-actions';
                actionDiv.innerHTML = `
                    <button class="inline-action-btn vitals-action" onclick="openVitalsModal()">
                        <i class="fas fa-chart-line"></i> ${state.currentLanguage === 'ar' ? 'العلامات الحيوية' : 'Vitals Check'}
                    </button>
                    <button class="inline-action-btn csv-action" onclick="document.getElementById('hiddenFileInput').click()">
                        <i class="fas fa-file-csv"></i> ${state.currentLanguage === 'ar' ? 'رفع ملف CSV' : 'Upload CSV'}
                    </button>
                `;
                lastMsg.appendChild(actionDiv);
            }
        }, 100);
        return;
    }

    state.selectedModel = 'general-model';
    updateSelectedModelUI();

    showTypingIndicator();

    if (state.isGenerating) return;
    state.isGenerating = true;
    
    const abortController = new AbortController();
    state.currentAbortController = abortController;
    
    try {
        await handleAIStream(text, userInfo, abortController, sid);
    } finally {
        state.isGenerating = false;
        state.currentAbortController = null;
        state.isSending = false;
    }
}

function getChatErrorMessage(error, statusCode) {
    const ar = state.currentLanguage === 'ar';
    const msg = error?.message || error || '';
    const status = statusCode || (error?.status) || 0;

    if (status === 503 || msg.includes('high demand') || msg.includes('unavailable')) {
        return ar
            ? 'خدمة الذكاء الاصطناعي تشهد ضغطًا عاليًا حاليًا. يرجى المحاولة مرة أخرى بعد قليل.'
            : 'The AI service is currently experiencing high demand. Please try again in a few moments.';
    }
    if (status === 404) {
        return ar
            ? 'الخدمة المطلوبة غير متوفرة حاليًا.'
            : 'The requested service is temporarily unavailable.';
    }
    if (status === 500 || msg.includes('internal server')) {
        return ar
            ? 'حدث خطأ في الخادم. تم إشعار الفريق الفني. يرجى المحاولة مرة أخرى.'
            : 'The server encountered an error. Our team has been notified. Please try again.';
    }
    if (msg.includes('fetch failed') || msg.includes('network') || msg.includes('Failed to fetch') || msg.includes('ENOTFOUND') || msg.includes('ERR_CONNECTION')) {
        return ar
            ? 'تعذر الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت الخاص بك.'
            : 'Unable to connect to the server. Please check your internet connection.';
    }
    if (msg.includes('abort') || msg.includes('AbortError')) {
        return null;
    }
    return ar
        ? 'عذرًا، حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.'
        : 'An unexpected error occurred. Please try again.';
}

// Stream handler
async function handleAIStream(text, userInfo, abortController, sessionId) {
    let fullContent = '';

    try {
        const response = await fetch(`${API_BASE}/api/chat/general`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: abortController?.signal,
            body: JSON.stringify({
                messages: [{ role: 'user', content: text }],
                patientId: userInfo.patientId,
                doctorId: userInfo.doctorId,
                sessionId: sessionId || state.currentSessionId,
                userType: userInfo.userType,
            }),
        });

        if (!response.ok || !response.body) {
            let errMsg = 'Chat API error';
            try {
                const errText = await response.text();
                try { errMsg = JSON.parse(errText).error || errMsg; } catch { errMsg = errText || errMsg; }
            } catch { /* ignore */ }
            const friendlyMsg = getChatErrorMessage(errMsg, response.status);
            throw new Error(friendlyMsg || errMsg);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let firstChunk = true;

        while (true) {
            try {
                const { value, done } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith('data:')) continue;

                    const dataStr = trimmed.slice(5).trim();
                    
                    if (dataStr === '[DONE]') continue;
                    
                    try {
                        const data = JSON.parse(dataStr);

                        if (data.done) {
                            if (data.sessionId) {
                                state.currentSessionId = data.sessionId;
                            }
                            if (data.title && state.currentSessionId) {
                                const currentChat = state.chats.find(c => c.id === state.currentSessionId);
                                if (currentChat) {
                                    currentChat.title = data.title;
                                    renderChatsList();
                                }
                            }
                            continue;
                        }

                        if (data.error) {
                            removeTypingIndicator();
                            const friendlyMsg = getChatErrorMessage(data.error, data.error?.status);
                            const errMsg = friendlyMsg || data.error || (state.currentLanguage === 'ar' ? 'حدث خطأ.' : 'An error occurred.');
                            const errorDiv = document.createElement('div');
                            errorDiv.className = 'message bot-message';
                            errorDiv.innerHTML = `
                                ${getMessageAvatar('bot')}
                                <div class="message-content">
                                    <div class="message-text" style="color: #dc3545;">${escapeHtml(errMsg)}</div>
                                    <div class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                </div>
                            `;
                            elements.messagesContainer.appendChild(errorDiv);
                            elements.welcomeMessage.style.display = 'none';
                            scrollToBottom();
                            showToast(errMsg, 'error');
                            rollbackFailedMessages();
                            return;
                        }

                        const deltaContent = data.choices?.[0]?.delta?.content;
                        if (deltaContent) {
                            fullContent += deltaContent;

                            if (firstChunk) {
                                firstChunk = false;
                                const typingEl = document.getElementById('typing-indicator');
                                if (typingEl) {
                                    typingEl.id = 'streaming-message';
                                    const contentDiv = typingEl.querySelector('.message-content');
                                    if (contentDiv) {
                                        contentDiv.innerHTML = `
                                            <div class="message-text"></div>
                                            <div class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                        `;
                                    }
                                }
                            }

                            const streamEl = document.getElementById('streaming-message');
                            if (streamEl) {
                                const textDiv = streamEl.querySelector('.message-text');
                                if (textDiv) textDiv.innerHTML = renderMarkdown(fullContent);
                            }
                            elements.chatArea.scrollTop = elements.chatArea.scrollHeight;
                        }
                    } catch { /* skip malformed chunks */ }
                }
            } catch (readError) {
                if (readError.name === 'AbortError' || (abortController && abortController.signal.aborted)) {
                    throw new DOMException('Aborted', 'AbortError');
                }
                console.error('Stream read error:', readError);
                break;
            }
        }

        const streamEl = document.getElementById('streaming-message');
        if (streamEl) streamEl.remove();
        removeTypingIndicator();

        // Save pending user message now that AI succeeded
        const pendingUserMsg = state.currentMessages.filter(m => m.sender === 'user').pop();
        if (pendingUserMsg) {
            const saveResult = await saveMessageToDb(pendingUserMsg, sessionId);
            if (saveResult && saveResult.wasRecreated && saveResult.sessionId) {
                state.currentSessionId = saveResult.sessionId;
                sessionId = saveResult.sessionId;
            }
        }

        if (fullContent) {
            addMessage({ id: Date.now(), text: fullContent, sender: 'bot', timestamp: new Date(), type: 'text' });
        } else {
            addMessage({
                id: Date.now(),
                text: state.currentLanguage === 'ar' ? 'لم يتم استلام رد.' : 'No response received.',
                sender: 'bot',
                timestamp: new Date(),
                type: 'text'
            });
        }

    } catch (error) {
        if (error.name === 'AbortError') {
            removeTypingIndicator();
            const streamEl = document.getElementById('streaming-message');
            if (streamEl) streamEl.remove();
            await rollbackFailedMessages();
            return;
        }
        
        console.error('AI stream error:', error);
        removeTypingIndicator();
        const streamEl = document.getElementById('streaming-message');
        if (streamEl) streamEl.remove();

        const friendlyMsg = getChatErrorMessage(error.message || error);
        const errMsg = friendlyMsg || (state.currentLanguage === 'ar'
            ? 'عذرًا، حدث خطأ. حاول مرة أخرى.'
            : 'Sorry, something went wrong. Please try again.');
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'message bot-message';
        errorDiv.innerHTML = `
            ${getMessageAvatar('bot')}
            <div class="message-content">
                <div class="message-text" style="color: #dc3545;">${escapeHtml(errMsg)}</div>
                <div class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
        `;
        elements.messagesContainer.appendChild(errorDiv);
        elements.welcomeMessage.style.display = 'none';
        scrollToBottom();
        showToast(errMsg, 'error');

        rollbackFailedMessages();
    }
}

// Nothing to rollback — user message is only saved to DB after AI succeeds
async function rollbackFailedMessages() {}

// Rollback user message from DB when AI fails (legacy)
async function rollbackUserMessage(messageId) {
    if (!state.currentSessionId || !messageId) return;
    try {
        await fetch(`${API_BASE}/api/chat-history/session/${state.currentSessionId}/message/${messageId}`, {
            method: 'DELETE'
        });
    } catch (err) {
        console.error('Error rolling back user message:', err);
    }
}

// Save message to database
async function saveMessageToDb(message, forceSessionId) {
    const sid = forceSessionId || state.currentSessionId;
    
    if (!sid) {
        console.error("No session ID available");
        return { success: false, error: 'no_session' };
    }
    
    const role = message.sender === 'user' ? 'user' : 'assistant';
    const msgContent = message.text || message.content || '';
    
    if (!msgContent.trim()) return { success: true };
    
    const userInfo = getUserInfo();
    
    try {
        const response = await fetch(`${API_BASE}/api/chat-history/message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: sid,
                role: role,
                content: msgContent,
                userId: userInfo.userId,
                userType: userInfo.userType
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error(`Failed to save message: HTTP ${response.status}`, errorData);
            return { success: false, error: 'http_error', status: response.status };
        }
        
        const data = await response.json();
        
        if (data.wasRecreated && data.sessionId) {
            console.log(`Session recreated: ${sid} -> ${data.sessionId}`);
            if (state.currentSessionId === sid) {
                state.currentSessionId = data.sessionId;
            }
            const chat = state.chats.find(c => c.id === sid);
            if (chat) {
                chat.id = data.sessionId;
            }
            return { success: true, sessionId: data.sessionId, wasRecreated: true };
        }
        
        return { success: true, sessionId: sid };
    } catch (err) {
        console.error("Error saving message to DB:", err);
        return { success: false, error: 'network_error' };
    }
}

// Add Message
async function addMessage(message) {
    if (state.currentMessages.length === 0) {
        elements.welcomeMessage.style.display = 'none';
    }

    if (!message.timestamp || message.timestamp === 'Invalid Date') {
        message.timestamp = new Date();
    }

    state.currentMessages.push(message);

    const currentChat = state.chats.find(chat => chat.id === state.currentSessionId);
    if (currentChat) {
        currentChat.messages = state.currentMessages;
    }

    const result = await saveMessageToDb(message);
    
    if (result && result.wasRecreated && result.sessionId) {
        state.currentSessionId = result.sessionId;
        const currentChat = state.chats.find(chat => chat.id === state.currentSessionId);
        if (currentChat) {
            currentChat.id = result.sessionId;
        }
    }

    renderMessage(message);
    scrollToBottom();

    if (elements.soundToggle.checked) playNotificationSound();
}

// Retry a user message
async function retryMessage(messageId) {
    const msgIndex = state.currentMessages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) return;
    
    const userMsg = state.currentMessages[msgIndex];
    if (userMsg.sender !== 'user') return;
    
    const msgsToRemove = state.currentMessages.slice(msgIndex);
    state.currentMessages = state.currentMessages.slice(0, msgIndex);
    
    msgsToRemove.forEach(m => {
        const el = document.querySelector(`[data-id="${m.id}"]`);
        if (el) el.remove();
    });
    
    const deletePromises = msgsToRemove.map(m =>
        fetch(`${API_BASE}/api/chat-history/session/${state.currentSessionId}/message/${m.id}`, {
            method: 'DELETE'
        }).catch(err => console.error('Error deleting message:', err))
    );
    await Promise.all(deletePromises);
    
    if (state.currentMessages.length === 0) {
        elements.welcomeMessage.style.display = 'flex';
    }
    
    elements.messageInput.value = userMsg.text;
    await sendMessage();
}

// Delete a message and its paired response
async function deleteMessage(messageId) {
    const msgIndex = state.currentMessages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) return;
    
    const msg = state.currentMessages[msgIndex];
    const msgsToDelete = [msg];
    
    if (msg.sender === 'user' && msgIndex + 1 < state.currentMessages.length) {
        const nextMsg = state.currentMessages[msgIndex + 1];
        if (nextMsg && nextMsg.sender === 'bot') {
            msgsToDelete.push(nextMsg);
        }
    }
    if (msg.sender === 'bot' && msgIndex - 1 >= 0) {
        const prevMsg = state.currentMessages[msgIndex - 1];
        if (prevMsg && prevMsg.sender === 'user') {
            msgsToDelete.unshift(prevMsg);
        }
    }
    
    const idsToDelete = new Set(msgsToDelete.map(m => m.id));
    state.currentMessages = state.currentMessages.filter(m => !idsToDelete.has(m.id));
    
    msgsToDelete.forEach(m => {
        const el = document.querySelector(`[data-id="${m.id}"]`);
        if (el) el.remove();
    });
    
    for (const m of msgsToDelete) {
        try {
            await fetch(`${API_BASE}/api/chat-history/session/${state.currentSessionId}/message/${m.id}`, {
                method: 'DELETE'
            });
        } catch (err) {
            console.error('Error deleting message:', err);
        }
    }
    
    if (state.currentMessages.length === 0) {
        elements.welcomeMessage.style.display = 'flex';
        await deleteEmptySessionAndCreateNew();
    }
}

// Delete empty session and create a new one
async function deleteEmptySessionAndCreateNew() {
    if (!state.currentSessionId) return;
    
    const oldSessionId = state.currentSessionId;
    state.chats = state.chats.filter(c => c.id !== oldSessionId);
    
    try {
        await fetch(`${API_BASE}/api/chat-history/session/${oldSessionId}`, {
            method: 'DELETE'
        });
    } catch (err) {
        console.error("Error deleting empty session:", err);
    }
    
    const newSessionId = await createNewChatSession();
    if (newSessionId) {
        state.currentSessionId = newSessionId;
        state.currentMessages = [];
    }
    
    renderChatsList();
}

// Render Message
function renderMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${message.sender}-message`;
    messageElement.dataset.id = message.id;

    let time;
    try {
        const date = new Date(message.timestamp);
        if (isNaN(date.getTime())) {
            time = '';
        } else {
            time = date.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    } catch {
        time = '';
    }

    const avatar = getMessageAvatar(message.sender);

    const actionButtons = `
        <div class="message-actions">
            ${message.sender === 'user' ? `<button class="message-action-btn retry-btn" data-message-id="${message.id}" title="Retry"><i class="fas fa-redo"></i></button>` : ''}
            <button class="message-action-btn delete-btn" data-message-id="${message.id}" title="Delete"><i class="fas fa-trash"></i></button>
        </div>
    `;

    let content = '';

    if (message.type === 'text') {
        const rendered = message.sender === 'bot' ? renderMarkdown(message.text) : escapeHtml(message.text);
        content = `
            <div class="message-content">
                <div class="message-text">${rendered}</div>
                <div class="message-time">${time}</div>
            </div>
            ${actionButtons}
        `;
    } else if (message.type === 'image') {
        content = `
            <div class="message-content">
                <div class="message-text">${message.text || '📷 Image'}</div>
                <div class="image-message">
                    <img src="${message.fileUrl}" alt="Uploaded image" style="max-width: 300px; border-radius: 8px;">
                </div>
                <div class="message-time">${time}</div>
            </div>
            ${actionButtons}
        `;
    } else if (message.type === 'file') {
        const fileSize = message.fileSize ? formatFileSize(message.fileSize) : '';
        content = `
            <div class="message-content">
                <div class="message-text">${message.text || '📎 File'}</div>
                <div class="file-message">
                    <i class="fas fa-file file-icon"></i>
                    <div class="file-info">
                        <div class="file-name">${message.fileName}</div>
                        ${fileSize ? `<div class="file-size">${fileSize}</div>` : ''}
                    </div>
                    <i class="fas fa-download file-download" onclick="downloadFile('${message.fileUrl}', '${message.fileName}')"></i>
                </div>
                <div class="message-time">${time}</div>
            </div>
            ${actionButtons}
        `;
    } else if (message.type === 'audio') {
        content = `
            <div class="message-content">
                <div class="message-text">${message.text || '🎤 Audio message'}</div>
                <div class="audio-message">
                    <div class="audio-control" onclick="playAudioMessage('${message.id}')">
                        <i class="fas fa-play"></i>
                    </div>
                    <div class="audio-info">
                        <div class="audio-progress">
                            <div class="audio-progress-bar" id="progress-${message.id}"></div>
                        </div>
                        <div class="audio-duration" id="duration-${message.id}">${message.duration || '00:00'}</div>
                    </div>
                </div>
                <div class="message-time">${time}</div>
            </div>
            ${actionButtons}
        `;
    } else if (message.type === 'video') {
        content = `
            <div class="message-content">
                <div class="message-text">${message.text || '🎬 Video'}</div>
                <div class="video-message">
                    <video src="${message.fileUrl}" controls style="max-width: 300px; border-radius: 8px;"></video>
                </div>
                <div class="message-time">${time}</div>
            </div>
            ${actionButtons}
        `;
    }

    messageElement.innerHTML = avatar + content;
    elements.messagesContainer.appendChild(messageElement);
    
    const retryBtn = messageElement.querySelector('.retry-btn');
    const deleteBtn = messageElement.querySelector('.delete-btn');
    
    if (retryBtn) {
        retryBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const msgId = parseInt(retryBtn.dataset.messageId);
            retryMessage(msgId);
        });
    }
    
    if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const msgId = parseInt(deleteBtn.dataset.messageId);
            deleteMessage(msgId);
        });
    }
}

// Show Typing Indicator
function showTypingIndicator() {
    const typingElement = document.createElement('div');
    typingElement.className = 'message bot-message';
    typingElement.id = 'typing-indicator';
    typingElement.innerHTML = `
        ${getMessageAvatar('bot')}
        <div class="message-content">
            <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
    `;
    elements.messagesContainer.appendChild(typingElement);
    scrollToBottom();
    elements.sendButton.style.display = 'none';
    if (elements.stopButton) elements.stopButton.style.display = 'flex';
    elements.messageInput.disabled = true;
}

// Stop Generation
function stopGeneration() {
    if (state.currentAbortController) {
        state.currentAbortController.abort();
    }
}

// Remove Typing Indicator
function removeTypingIndicator() {
    const typingElement = document.getElementById('typing-indicator');
    if (typingElement) {
        typingElement.remove();
    }
    elements.sendButton.style.display = 'flex';
    if (elements.stopButton) elements.stopButton.style.display = 'none';
    elements.messageInput.disabled = false;
    elements.messageInput.focus();
}

// Scroll to Bottom
function scrollToBottom() {
    elements.chatArea.scrollTop = elements.chatArea.scrollHeight;
    setTimeout(() => {
        elements.chatArea.scrollTop = elements.chatArea.scrollHeight;
    }, 100);
}

// Play Notification Sound
function playNotificationSound() {
    if (elements.notificationSound) {
        elements.notificationSound.currentTime = 0;
        elements.notificationSound.play().catch(err => {
            console.log("Could not play notification sound:", err);
        });
    }
}

// Handle Image Upload
function handleImageUpload(e) {
    const files = Array.from(e.target.files);
    files.forEach(file => {
        if (file.type.startsWith('image/')) {
            addFileToUploadList(file, 'image');
        } else {
            alert('Please select an image file');
        }
    });
}

// Handle File Upload
function handleFileUpload(e) {
    const files = Array.from(e.target.files);
    files.forEach(file => {
        addFileToUploadList(file, 'file');
    });
}

// Handle Audio Upload
function handleAudioUpload(e) {
    const files = Array.from(e.target.files);
    files.forEach(file => {
        if (file.type.startsWith('audio/')) {
            addFileToUploadList(file, 'audio');
        } else {
            alert('Please select an audio file');
        }
    });
}

// Handle Video Upload
function handleVideoUpload(e) {
    const files = Array.from(e.target.files);
    files.forEach(file => {
        if (file.type.startsWith('video/')) {
            addFileToUploadList(file, 'video');
        } else {
            alert('Please select a video file');
        }
    });
}

// Base64 helper
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Open Profile Settings - FIXED: Corrected translation keys (t.profileSettings, t.darkMode, t.language)
function openProfileSettings() {
    elements.profileSettingsModal.classList.add('active');

    elements.profileDarkModeToggle.checked = state.darkMode;

    document.querySelectorAll('.lang-btn').forEach(btn => {
        if (btn.dataset.lang === state.currentLanguage) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    const t = texts[state.currentLanguage];
    if (elements.profileSettingsTitle) {
        elements.profileSettingsTitle.textContent = t.profileSettings || "Profile Settings";
    }
    if (elements.profileDarkModeLabel) {
        elements.profileDarkModeLabel.textContent = t.darkMode || "Dark Mode";
    }
    if (elements.profileLanguageLabel) {
        elements.profileLanguageLabel.textContent = t.language || "Language";
    }
    if (elements.profileSettingsCancel) {
        elements.profileSettingsCancel.textContent = t.cancel;
    }
    if (elements.profileSettingsSave) {
        elements.profileSettingsSave.textContent = t.save;
    }

    // Vitals source block (patient selector + Load Latest Vitals button).
    const selLabel  = document.querySelector('#vitalsSourceSelectWrap label');
    const loadLabel = document.querySelector('#vitalsLoadBtn span');
    if (selLabel && t.selectPatient)     selLabel.textContent  = t.selectPatient;
    if (loadLabel && t.loadLatestVitals) loadLabel.textContent = t.loadLatestVitals;

    // Re-sync the custom dropdown wrapper so the "Loading patients…"
    // placeholder reflects the current language.
    const vitalsSel = document.getElementById('vitalsPatientSelect');
    const vitalsWrap = vitalsSel?.nextElementSibling;
    if (vitalsSel && vitalsWrap?.classList?.contains('custom-select') && vitalsWrap.syncOptions) {
        vitalsWrap.syncOptions();
    }
}

// Close Profile Settings
function closeProfileSettings() {
    elements.profileSettingsModal.classList.remove('active');
}

// Handle Language Selection in Profile Settings
function handleProfileLanguageSelection(e) {
    if (e.target.classList.contains('lang-btn')) {
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        e.target.classList.add('active');
    }
}

// Save Profile Settings
function saveProfileSettings() {
    const activeLangBtn = document.querySelector('.lang-btn.active');
    const selectedLanguage = activeLangBtn ? activeLangBtn.dataset.lang : state.currentLanguage;

    const darkModeEnabled = elements.profileDarkModeToggle.checked;

    if (selectedLanguage !== state.currentLanguage) {
        state.currentLanguage = selectedLanguage;
        elements.languageSelect.value = selectedLanguage;
        localStorage.setItem('language', selectedLanguage);
        
        document.documentElement.dir = selectedLanguage === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = selectedLanguage;
        
        updateUIByLanguage();
        updateModalTexts();
    }

    if (darkModeEnabled !== state.darkMode) {
        toggleDarkMode(darkModeEnabled);
        localStorage.setItem('darkMode', darkModeEnabled);
    }

    closeProfileSettings();
}

// Open Settings
function openSettings() {
    elements.settingsModal.classList.add('active');
}

// ─── Custom dropdown wrapper (mirrors .model-selector design) ──────────────
// Native <select> dropdowns are OS-rendered and can't be styled to
// match the rest of the chatbot UI. This helper hides the <select>
// and renders a custom trigger + menu next to it, while keeping the
// <select> in the DOM as the value source of truth. Values sync
// both ways:
//   • clicking a custom option → updates <select>.value + dispatches
//     a `change` event so existing listeners (changeLanguage,
//     loadLatestVitalsIntoModal, etc.) keep working.
//   • programmatic <select>.value = 'x'  →  the trigger text + active
//     option update automatically.
function enhanceSelect(selectEl) {
    if (!selectEl || selectEl.dataset.enhanced === '1') return null;
    selectEl.dataset.enhanced = '1';

    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'custom-select-trigger';
    trigger.setAttribute('aria-haspopup', 'true');
    trigger.setAttribute('aria-expanded', 'false');

    const triggerText = document.createElement('span');
    triggerText.className = 'custom-select-text';
    trigger.appendChild(triggerText);

    const chevron = document.createElement('i');
    chevron.className = 'fas fa-chevron-down custom-select-chevron';
    trigger.appendChild(chevron);

    const menu = document.createElement('div');
    menu.className = 'custom-select-menu';
    menu.setAttribute('role', 'menu');

    function paintTrigger() {
        const opt = selectEl.options[selectEl.selectedIndex];
        if (opt) triggerText.textContent = opt.textContent;
    }

    function syncOptions() {
        menu.innerHTML = '';
        Array.from(selectEl.options).forEach((opt) => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'custom-select-option';
            item.setAttribute('role', 'menuitem');
            item.dataset.value = opt.value;
            item.textContent = opt.textContent;
            if (opt.disabled) {
                item.disabled = true;
                item.classList.add('disabled');
            }
            if (opt.selected) item.classList.add('active');
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                if (opt.disabled || opt.value === selectEl.value) {
                    closeMenu();
                    return;
                }
                selectEl.value = opt.value;
                selectEl.dispatchEvent(new Event('change', { bubbles: true }));
                closeMenu();
            });
            menu.appendChild(item);
        });
        paintTrigger();
    }

    function openMenu() {
        // Close any other open custom dropdowns first so only one
        // menu is visible at a time (same behaviour as #modelSelector).
        document.querySelectorAll('.custom-select.open').forEach(el => {
            if (el !== wrapper) el.classList.remove('open');
        });
        wrapper.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
    }

    function closeMenu() {
        wrapper.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
    }

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        if (wrapper.classList.contains('open')) closeMenu();
        else openMenu();
    });

    // Close on outside click.
    document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target)) closeMenu();
    });

    // Close on Escape.
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && wrapper.classList.contains('open')) closeMenu();
    });

    // Keep trigger + active option in sync when <select> changes
    // programmatically (e.g. language change, or other code paths).
    selectEl.addEventListener('change', () => {
        paintTrigger();
        menu.querySelectorAll('.custom-select-option').forEach(item => {
            item.classList.toggle('active', item.dataset.value === selectEl.value);
        });
    });

    // Hide the native <select> but keep it in the DOM.
    selectEl.classList.add('custom-select-hidden');

    // Insert wrapper after the <select> so screen-readers / form
    // submission still see the <select> first.
    selectEl.parentNode.insertBefore(wrapper, selectEl.nextSibling);
    wrapper.appendChild(trigger);
    wrapper.appendChild(menu);

    // Initial paint.
    syncOptions();

    // Expose a way to re-sync after the <select>'s option list
    // changes (used by loadPatientListForDoctor + updateModalTexts).
    wrapper.syncOptions = syncOptions;
    return wrapper;
}

// ─── Directional icon swap (LTR ↔ RTL) ─────────────────────────────────────
// The two header buttons have opposite semantics:
//   • #backButton  — points BACK to the previous screen.
//     LTR → fa-arrow-left,  RTL → fa-arrow-right
//   • #exitButton  — points FORWARD / AWAY (exit chat) and is the
//     reverse of #backButton.
//     LTR → fa-arrow-right, RTL → fa-arrow-left
// We watch the `dir` attribute on <html> and <body> via a
// MutationObserver so any code path that flips the direction (initial
// setup, changeLanguage, saveProfileSettings) is picked up
// automatically.
function updateDirectionalIcons() {
    const isRTL = (document.documentElement.dir || document.body.dir || 'ltr') === 'rtl';

    // Back button: left-in-LTR, right-in-RTL
    document.querySelectorAll('.back-button i').forEach(icon => {
        icon.classList.toggle('fa-arrow-left',  !isRTL);
        icon.classList.toggle('fa-arrow-right',  isRTL);
    });

    // Exit button: REVERSED — right-in-LTR, left-in-RTL
    document.querySelectorAll('#exitButton i').forEach(icon => {
        icon.classList.toggle('fa-arrow-left',   isRTL);
        icon.classList.toggle('fa-arrow-right', !isRTL);
    });
}

// Wire the observer once, on script load.
(function setupDirectionalIconObserver() {
    const apply = () => updateDirectionalIcons();
    try {
        const obs = new MutationObserver(apply);
        obs.observe(document.documentElement, { attributes: true, attributeFilter: ['dir'] });
        obs.observe(document.body, { attributes: true, attributeFilter: ['dir'] });
    } catch (_) { /* MutationObserver unsupported — fall through to manual call */ }
    // Run once for the initial paint (LTR is the default; this also
    // covers the case where the observer failed to attach).
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', apply, { once: true });
    } else {
        apply();
    }
})();

// Close Settings
function closeSettings() {
    elements.settingsModal.classList.remove('active');
}

// Toggle Dark Mode
function toggleDarkMode(forceState = null) {
    if (forceState !== null) {
        state.darkMode = forceState;
    } else {
        state.darkMode = !state.darkMode;
    }

    if (state.darkMode) {
        document.body.classList.add('dark-mode');
        elements.darkModeToggle.checked = true;
        elements.profileDarkModeToggle.checked = true;
    } else {
        document.body.classList.remove('dark-mode');
        elements.darkModeToggle.checked = false;
        elements.profileDarkModeToggle.checked = false;
    }

    localStorage.setItem('darkMode', state.darkMode);
}

// Change Language
function changeLanguage() {
    const newLanguage = elements.languageSelect.value;
    state.currentLanguage = newLanguage;
    
    document.documentElement.lang = newLanguage;
    document.documentElement.dir = newLanguage === 'ar' ? 'rtl' : 'ltr';
    
    updateUIByLanguage();
    localStorage.setItem('language', newLanguage);
    renderChatsList();
    updateModalTexts();
}

// Update Modal Texts
function updateModalTexts() {
    const t = texts[state.currentLanguage];
    
    if (elements.settingsTitle) {
        elements.settingsTitle.textContent = t.settings;
    }
    if (elements.darkModeLabel) {
        elements.darkModeLabel.textContent = t.darkMode;
    }
    if (elements.languageLabel) {
        elements.languageLabel.textContent = t.language;
    }
    
    if (elements.profileSettingsTitle) {
        elements.profileSettingsTitle.textContent = t.profileSettings;
    }
    if (elements.profileDarkModeLabel) {
        elements.profileDarkModeLabel.textContent = t.darkMode;
    }
    if (elements.profileLanguageLabel) {
        elements.profileLanguageLabel.textContent = t.language;
    }
    if (elements.profileSettingsCancel) {
        elements.profileSettingsCancel.textContent = t.cancel;
    }
    if (elements.profileSettingsSave) {
        elements.profileSettingsSave.textContent = t.save;
    }

    // Vitals source block (patient selector + Load Latest Vitals button).
    const selLabel  = document.querySelector('#vitalsSourceSelectWrap label');
    const loadLabel = document.querySelector('#vitalsLoadBtn span');
    if (selLabel && t.selectPatient)     selLabel.textContent  = t.selectPatient;
    if (loadLabel && t.loadLatestVitals) loadLabel.textContent = t.loadLatestVitals;

    // Re-sync the custom dropdown wrapper so the "Loading patients…"
    // placeholder reflects the current language.
    const vitalsSel = document.getElementById('vitalsPatientSelect');
    const vitalsWrap = vitalsSel?.nextElementSibling;
    if (vitalsSel && vitalsWrap?.classList?.contains('custom-select') && vitalsWrap.syncOptions) {
        vitalsWrap.syncOptions();
    }
}

// Exit App
function exitApp() {
    const userRole = sessionStorage.getItem("user_role");
    const userId = sessionStorage.getItem("user_id");
    const userData = sessionStorage.getItem("user_data");
    const t = texts[state.currentLanguage];
    
    let redirectUrl;
    
    if (!userId || !userRole || !userData) {
        redirectUrl = '../../index.html';
    } else if (userRole === 'doctor') {
        redirectUrl = '../doctor/dashboard/dashboard.html';
    } else if (userRole === 'patient') {
        redirectUrl = '../patient/dashboard/dashboard.html';
    } else {
        redirectUrl = '../../index.html';
    }
    
    if (confirm(t.confirmExit)) {
        window.location.href = redirectUrl;
    }
}

// Markdown Rendering
function renderMarkdown(text) {
    if (!text) return '';
    if (typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
        marked.setOptions({
            breaks: true,
            gfm: true,
            highlight: function (code, lang) {
                if (lang && hljs && hljs.getLanguage(lang)) {
                    try { return hljs.highlight(code, { language: lang }).value; } catch (e) { }
                }
                return code;
            }
        });
        const raw = marked.parse(text);
        const clean = DOMPurify.sanitize(raw, { ADD_ATTR: ['target'] });
        return clean;
    }
    return escapeHtml(text);
}

// Vitals Modal Functions
// Returns the current user role from sessionStorage, defaulting to patient.
function getActiveUserRole() {
    return sessionStorage.getItem('user_role') === 'doctor' ? 'doctor' : 'patient';
}

// Convert the combined "120/80" BP string into {sys, dia}, or empty
// strings if it can't be parsed.
function splitBloodPressure(bp) {
    if (!bp) return { sys: '', dia: '' };
    const parts = String(bp).split('/');
    return { sys: parts[0] ?? '', dia: parts[1] ?? '' };
}

// Show / hide the small status notice above the vitals grid. Pass
// `kind` = 'info' (default amber) or 'success' (green).
function setVitalsNotice(message, kind = 'info') {
    const el = document.getElementById('vitalsNotice');
    if (!el) return;
    if (!message) {
        el.hidden = true;
        el.textContent = '';
        el.classList.remove('success');
        return;
    }
    el.hidden = false;
    el.classList.toggle('success', kind === 'success');
    el.innerHTML = `<i class="fas ${kind === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle'}"></i>` +
                   `<span>${message}</span>`;
}

// Fetch the latest vitals for `patientId` and fill the modal inputs.
// On success → green notice. On "no vitals" → amber notice for the
// doctor (the user asked for this explicitly), or a soft info notice
// for the patient.
async function loadLatestVitalsIntoModal(patientId) {
    if (!patientId) {
        setDefaultVitals();
        setVitalsNotice('');
        return;
    }
    const btn = document.getElementById('vitalsLoadBtn');
    if (btn) btn.disabled = true;
    setVitalsNotice('');

    try {
        const res = await fetch(`${API_BASE}/api/patients/${patientId}/vitals`);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const v = await res.json();

        const hasAny = v && (
            v.heart_rate != null || v.blood_pressure ||
            v.spo2 != null || v.body_temperature != null ||
            v.respiratory_rate != null || v.bmi != null
        );

        const { sys, dia } = splitBloodPressure(v?.blood_pressure);

        document.getElementById('vitals-bpsys').value = sys;
        document.getElementById('vitals-bpdia').value = dia;
        document.getElementById('vitals-hr').value    = v?.heart_rate        ?? '';
        document.getElementById('vitals-temp').value  = v?.body_temperature  ?? '';
        document.getElementById('vitals-rr').value    = v?.respiratory_rate  ?? '';
        document.getElementById('vitals-spo2').value  = v?.spo2              ?? '';
        document.getElementById('vitals-bmi').value   = v?.bmi               ?? '';

        if (hasAny) {
            setVitalsNotice('Latest vitals loaded. Adjust values if needed before running the check.', 'success');
        } else if (getActiveUserRole() === 'doctor') {
            setVitalsNotice('This patient has no recorded vitals yet.');
        } else {
            setVitalsNotice('No vitals recorded yet. Enter your values to run the check.');
        }
    } catch (err) {
        console.error('loadLatestVitalsIntoModal error:', err);
        setDefaultVitals();
        setVitalsNotice('Could not load vitals. Please try again.');
    } finally {
        if (btn) btn.disabled = false;
    }
}

// Populate the patient <select> for the doctor role. Called once per
// modal open (the list rarely changes between opens, but we re-fetch
// to be safe).
async function loadPatientListForDoctor() {
    const sel = document.getElementById('vitalsPatientSelect');
    if (!sel) return;
    sel.innerHTML = `<option value="">Loading…</option>`;
    // If the custom-dropdown wrapper exists, re-sync it once we've
    // (re)written the <option> list.
    const wrapper = sel.nextElementSibling?.classList?.contains('custom-select')
        ? sel.nextElementSibling
        : null;
    try {
        const res = await fetch(`${API_BASE}/api/patients`);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        const patients = data.patients || data.data || [];
        if (!patients.length) {
            sel.innerHTML = `<option value="">No patients found</option>`;
            if (wrapper?.syncOptions) wrapper.syncOptions();
            return;
        }
        sel.innerHTML =
            `<option value="">— Select a patient —</option>` +
            patients.map(p => {
                const id   = p.id;
                const name = p.full_name || `Patient #${id}`;
                return `<option value="${id}">${escapeHtml(name)}</option>`;
            }).join('');
        if (wrapper?.syncOptions) wrapper.syncOptions();
    } catch (err) {
        console.error('loadPatientListForDoctor error:', err);
        sel.innerHTML = `<option value="">Failed to load patients</option>`;
        if (wrapper?.syncOptions) wrapper.syncOptions();
    }
}

async function openVitalsModal() {
    const role = getActiveUserRole();
    const selectWrap = document.getElementById('vitalsSourceSelectWrap');
    const selectEl   = document.getElementById('vitalsPatientSelect');

    // Hide the patient selector for the patient role — the modal
    // auto-loads *their* vitals.
    if (selectWrap) selectWrap.hidden = (role !== 'doctor');

    setDefaultVitals();
    setVitalsNotice('');
    document.getElementById('vitalsModal').classList.add('active');

    if (role === 'doctor') {
        await loadPatientListForDoctor();
        if (selectEl && selectEl.value) {
            await loadLatestVitalsIntoModal(selectEl.value);
        } else {
            setVitalsNotice('Select a patient to load their latest vitals.');
        }
    } else {
        // Patient: auto-load their own latest vitals.
        const myId = sessionStorage.getItem('user_id');
        if (myId) {
            await loadLatestVitalsIntoModal(myId);
        } else {
            setVitalsNotice('Please sign in to load your vitals.');
        }
    }
}

function closeVitalsModal() {
    document.getElementById('vitalsModal').classList.remove('active');
}

function setDefaultVitals() {
    document.getElementById('vitals-bpsys').value = '';
    document.getElementById('vitals-bpdia').value = '';
    document.getElementById('vitals-hr').value = '';
    document.getElementById('vitals-temp').value = '';
    document.getElementById('vitals-rr').value = '';
    document.getElementById('vitals-spo2').value = '';
    document.getElementById('vitals-bmi').value = '';
}

function getVitalsData() {
    return {
        blood_pressure_systolic: parseFloat(document.getElementById('vitals-bpsys').value) || 0,
        blood_pressure_diastolic: parseFloat(document.getElementById('vitals-bpdia').value) || 0,
        heart_rate: parseFloat(document.getElementById('vitals-hr').value) || 0,
        temperature: parseFloat(document.getElementById('vitals-temp').value) || 0,
        respiratory_rate: parseFloat(document.getElementById('vitals-rr').value) || 0,
        oxygen_saturation: parseFloat(document.getElementById('vitals-spo2').value) || 0,
        bmi: parseFloat(document.getElementById('vitals-bmi').value) || 0,
    };
}

async function submitVitalsAnalysis() {
    const vitals = getVitalsData();

    const userText = `📊 Vitals Check:\n` +
        `- BP: ${vitals.blood_pressure_systolic}/${vitals.blood_pressure_diastolic} mmHg\n` +
        `- HR: ${vitals.heart_rate} bpm\n` +
        `- Temp: ${vitals.temperature}°C\n` +
        `- RR: ${vitals.respiratory_rate}/min\n` +
        `- SpO2: ${vitals.oxygen_saturation}%\n` +
        `- BMI: ${vitals.bmi}`;

    const userMessage = {
        id: Date.now(),
        text: userText,
        sender: 'user',
        timestamp: new Date(),
        type: 'text',
        model: 'vitals'
    };
    state.currentMessages.push(userMessage);
    const currentChat = state.chats.find(chat => chat.id === state.currentSessionId);
    if (currentChat) currentChat.messages = state.currentMessages;
    
    elements.welcomeMessage.style.display = 'none';
    
    await saveMessageToDb(userMessage);
    renderMessage(userMessage);
    scrollToBottom();

    closeVitalsModal();
    showTypingIndicator();

    try {
        const res = await fetch(`${API_BASE}/api/predict/vitals`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(vitals),
        });

        removeTypingIndicator();

        if (!res.ok) throw new Error('API error: ' + res.status);

        const data = await res.json();
        const resultMsg = formatAIResult(data);
        
        const aiMessage = { id: Date.now(), text: resultMsg, sender: 'bot', timestamp: new Date(), type: 'text', model: 'vitals' };
        state.currentMessages.push(aiMessage);
        if (currentChat) currentChat.messages = state.currentMessages;
        await saveMessageToDb(aiMessage);
        renderMessage(aiMessage);
        scrollToBottom();
        
        if (state.currentSessionId) {
            generateTitleFromResult(data, 'vitals');
        }
    } catch (err) {
        removeTypingIndicator();
        console.error('Vitals analysis error:', err);
        try {
            const directRes = await fetch('http://localhost:8000/predict-vitals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(vitals),
            });
            if (!directRes.ok) throw new Error('Direct API error');
            const data = await directRes.json();
            const resultMsg = formatAIResult(data);
            addMessage({ id: Date.now(), text: resultMsg, sender: 'bot', timestamp: new Date(), type: 'text' });
        } catch (directErr) {
            const errMsg = state.currentLanguage === 'ar'
                ? '❌ تعذر الاتصال بخادم التحليل. تأكد من تشغيل خادم Python.'
                : '❌ Could not connect to the AI analysis server. Make sure the Python API is running.';
            const errorDiv = document.createElement('div');
            errorDiv.className = 'message bot-message';
            errorDiv.innerHTML = `
                ${getMessageAvatar('bot')}
                <div class="message-content">
                    <div class="message-text" style="color: #dc3545;">${escapeHtml(errMsg)}</div>
                    <div class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
            `;
            elements.messagesContainer.appendChild(errorDiv);
            elements.welcomeMessage.style.display = 'none';
            scrollToBottom();
        }
    }
}

// CSV Upload Handler
async function uploadAndPredictCSV(file) {
    const userText = `📎 CSV Upload: ${file.name}`;
    
    const userMessage = {
        id: Date.now(),
        text: userText,
        sender: 'user',
        timestamp: new Date(),
        type: 'text',
        model: 'ecg'
    };
    state.currentMessages.push(userMessage);
    const currentChat = state.chats.find(chat => chat.id === state.currentSessionId);
    if (currentChat) currentChat.messages = state.currentMessages;
    await saveMessageToDb(userMessage);
    
    elements.welcomeMessage.style.display = 'none';
    
    renderMessage(userMessage);
    scrollToBottom();
    showTypingIndicator();

    try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch(`${API_BASE}/api/predict/upload`, {
            method: 'POST',
            body: formData,
        });

        removeTypingIndicator();

        if (!res.ok) throw new Error('Upload failed');

        const data = await res.json();

        if (data.error) {
            addMessage({ id: Date.now(), text: '❌ Error: ' + data.error, sender: 'bot', timestamp: new Date(), type: 'text' });
        } else {
            const resultMsg = formatAIResult(data);
            const aiMessage = { id: Date.now(), text: resultMsg, sender: 'bot', timestamp: new Date(), type: 'text', model: 'ecg' };
            state.currentMessages.push(aiMessage);
            const csvChat = state.chats.find(chat => chat.id === state.currentSessionId);
            if (csvChat) csvChat.messages = state.currentMessages;
            await saveMessageToDb(aiMessage);
            renderMessage(aiMessage);
            scrollToBottom();
            
            const hint = state.currentLanguage === 'ar'
                ? '💡 يمكنك رفع ملف CSV آخر أو إدخال العلامات الحيوية يدوياً.'
                : '💡 You can upload another CSV or enter vitals manually.';
            const hintMsg = { id: Date.now() + 1, text: hint, sender: 'bot', timestamp: new Date(), type: 'text' };
            state.currentMessages.push(hintMsg);
            if (csvChat) csvChat.messages = state.currentMessages;
            renderMessage(hintMsg);
            scrollToBottom();
            
            if (state.currentSessionId) {
                generateTitleFromResult(data, 'ecg');
            }
        }
    } catch (err) {
        removeTypingIndicator();
        console.error('CSV upload error:', err);
        const errMsg = state.currentLanguage === 'ar'
            ? '❌ فشل رفع الملف. حاول مرة أخرى.'
            : '❌ File upload failed. Please try again.';
        const errorDiv = document.createElement('div');
        errorDiv.className = 'message bot-message';
        errorDiv.innerHTML = `
            ${getMessageAvatar('bot')}
            <div class="message-content">
                <div class="message-text" style="color: #dc3545;">${escapeHtml(errMsg)}</div>
                <div class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
        `;
        elements.messagesContainer.appendChild(errorDiv);
        elements.welcomeMessage.style.display = 'none';
        scrollToBottom();
    }
}

// AI Result formatting
function formatAIResult(data) {
    const riskColor = data.risk_color || '#6b7280';
    const modelIcon = data.model_used === 'vitals' ? '🫀' : '📊';
    const modelName = data.model_used === 'vitals' ? 'Vitals Analysis' : 'ECG Analysis';
    const conf = data.confidence_pct ?? ((data.confidence || 0) * 100).toFixed(1);

    const lang = state.currentLanguage;
    const msg = lang === 'ar' ? data.message_ar : data.message_en;
    const rec = lang === 'ar' ? data.recommendation_ar : data.recommendation_en;

    return `## ${modelIcon} ${modelName}\n\n` +
        `| | |\n|---|---|\n` +
        `| **Result** | \`${data.label || '—'}\` |\n` +
        `| **Confidence** | **${conf}%** |\n` +
        `| **Risk Level** | <span style="color:${riskColor}">●</span> ${(data.risk_level || '—').toUpperCase()} |\n\n` +
        `---\n\n` +
        `⚠️ **${msg}**\n\n` +
        `📝 **Recommendation:** ${rec}`;
}

// Utility Functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function downloadFile(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function playAudioMessage(messageId) {
    const message = state.currentMessages.find(m => m.id === messageId);
    if (message && message.fileUrl) {
        elements.audioPlayer.src = message.fileUrl;
        elements.audioPlayer.play();

        elements.audioPlayer.ontimeupdate = () => {
            const progress = (elements.audioPlayer.currentTime / elements.audioPlayer.duration) * 100;
            const progressBar = document.getElementById(`progress-${messageId}`);
            if (progressBar) {
                progressBar.style.width = `${progress}%`;
            }

            const durationElement = document.getElementById(`duration-${messageId}`);
            if (durationElement) {
                const currentTime = formatTime(elements.audioPlayer.currentTime);
                const totalTime = formatTime(elements.audioPlayer.duration);
                durationElement.textContent = `${currentTime} / ${totalTime}`;
            }
        };

        elements.audioPlayer.onended = () => {
            const progressBar = document.getElementById(`progress-${messageId}`);
            if (progressBar) {
                progressBar.style.width = '0%';
            }
            const durationElement = document.getElementById(`duration-${messageId}`);
            if (durationElement && message.duration) {
                durationElement.textContent = message.duration;
            }
        };
    }
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);