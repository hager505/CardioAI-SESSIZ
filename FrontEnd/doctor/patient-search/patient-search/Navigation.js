// ========================================
// PATIENT SEARCH - JAVASCRIPT
// ========================================
// This file handles all functionality for the Patient Search page
// Including: search functionality, navigation, and results display
// ========================================

// قاعدة بيانات المرضى
const patients = [
    {
        name: "Sarah Johnson",
        age: 40,
        gender: "Female",
        bloodType: "O+",
        email: "sarah.johnson@email.com",
        phone: "+1-555-123-4567",
        address: "123 Main St, Anytown, ST 12345",
        lastVisit: "2024-01-10",
        condition: "Hypertension",
        status: "Active"
    },
    {
        name: "Ahmed Mohamed",
        age: 35,
        gender: "Male",
        bloodType: "A+",
        email: "ahmed.mohamed@email.com",
        phone: "+1-555-234-5678",
        address: "456 Oak Ave, Cairo, EG 11511",
        lastVisit: "2024-02-15",
        condition: "Diabetes",
        status: "Active"
    },
    {
        name: "Fatima Ali",
        age: 28,
        gender: "Female",
        bloodType: "B+",
        email: "fatima.ali@email.com",
        phone: "+1-555-345-6789",
        address: "789 Pine Rd, Alexandria, EG 21500",
        lastVisit: "2024-03-20",
        condition: "Asthma",
        status: "Active"
    }
];

// تحويل الـ textbox إلى input فعلي
function initializeSearchBox() {
    const textbox = document.querySelector('.patient-search__textbox');
    const textContent = document.querySelector('.patient-search__sarah-johnson');
    
    if (textbox && textContent) {
        // التحقق من أن textContent ليس input بالفعل
        if (textContent.tagName === 'INPUT') {
            console.log('Input already exists');
            return;
        }
        
        // إنشاء input element
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Enter patient name...';
        input.className = 'patient-search__sarah-johnson';
        input.id = 'patientSearchInput';
        input.style.cssText = `
            width: 100%;
            border: none;
            outline: none;
            background: transparent;
            color: #171a1f;
            font-family: "Manrope", sans-serif;
            font-size: 14px;
            line-height: 22px;
        `;
        
        // استبدال النص بـ input
        textContent.replaceWith(input);
        
        // إضافة event listener للبحث عند الضغط على Enter
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                searchPatients();
            }
        });
        
        // إضافة event listener للبحث عند تغيير النص (debounced)
        let searchTimeout;
        input.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            // يمكن إضافة بحث تلقائي هنا إذا لزم الأمر
        });
        
        console.log('Search box initialized successfully');
    } else {
        console.warn('Search box elements not found:', {
            textbox: !!textbox,
            textContent: !!textContent
        });
    }
}

// وظيفة البحث
function searchPatients() {
    // البحث عن input بعدة طرق للتأكد
    let searchInput = document.querySelector('.patient-search__textbox input');
    if (!searchInput) {
        // محاولة أخرى
        searchInput = document.querySelector('.patient-search__sarah-johnson');
    }
    
    const searchValue = searchInput ? (searchInput.value || searchInput.textContent || '').trim().toLowerCase() : '';
    
    if (!searchValue || searchValue === 'enter patient name...') {
        showNoResults('Please enter a search term');
        return;
    }
    
    // البحث في قاعدة البيانات
    const results = patients.filter(patient => 
        patient.name.toLowerCase().includes(searchValue) ||
        patient.email.toLowerCase().includes(searchValue) ||
        patient.phone.includes(searchValue) ||
        patient.condition.toLowerCase().includes(searchValue)
    );
    
    // عرض النتائج
    if (results.length > 0) {
        displayResults(results);
    } else {
        showNoResults('No patients found matching your search');
    }
}

// عرض النتائج
function displayResults(results) {
    // البحث عن container الرئيسي
    const mainFrame = document.querySelector('.patient-search__frame-1');
    if (!mainFrame) {
        console.error('Main frame not found');
        return;
    }
    
    // إنشاء container للنتائج
    let resultsContainer = document.getElementById('searchResults');
    
    if (!resultsContainer) {
        resultsContainer = document.createElement('div');
        resultsContainer.id = 'searchResults';
        resultsContainer.style.cssText = `
            position: absolute;
            left: 306px;
            top: 660px;
            width: 1100px;
            max-width: calc(100% - 350px);
            background: #f2f6fd;
            border-radius: 8px;
            border: 1px solid #dee1e6;
            padding: 24px;
            box-shadow: 0px 0px 1px 0px rgba(23, 26, 31, 0.15),
                0px 0px 2px 0px rgba(23, 26, 31, 0.2);
            z-index: 10;
        `;
        mainFrame.appendChild(resultsContainer);
    }
    
    // بناء HTML للنتائج
    let html = `
        <div style="margin-bottom: 20px;">
            <h2 style="color: #171a1f; font-family: 'Poppins', sans-serif; font-size: 24px; font-weight: 700; margin-bottom: 5px;">
                Search Results
            </h2>
            <p style="color: #565e6c; font-size: 16px;">
                Found ${results.length} patient(s)
            </p>
        </div>
    `;
    
    results.forEach(patient => {
        html += `
            <div style="
                background: #ffffff;
                border-radius: 8px;
                padding: 24px;
                margin-bottom: 15px;
                box-shadow: 0px 0px 1px 0px rgba(23, 26, 31, 0.15), 0px 0px 2px 0px rgba(23, 26, 31, 0.2);
                transition: all 0.3s ease;
                cursor: pointer;
            " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0px 4px 12px rgba(0, 0, 0, 0.1)'"
               onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0px 0px 1px 0px rgba(23, 26, 31, 0.15), 0px 0px 2px 0px rgba(23, 26, 31, 0.2)'">
                
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <h3 style="color: #171a1f; font-family: 'Poppins', sans-serif; font-size: 18px; font-weight: 700;">
                            ${patient.name}
                        </h3>
                        <span style="
                            background: #dcfce7;
                            color: #166534;
                            padding: 2px 10px;
                            border-radius: 11px;
                            font-size: 12px;
                            font-weight: 600;
                        ">${patient.status}</span>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button class="view-records-btn" data-patient="${patient.name}" style="
                            background: #ffffff;
                            border: 1px solid #dee1e6;
                            border-radius: 6px;
                            padding: 6px 16px;
                            font-size: 12px;
                            font-weight: 500;
                            cursor: pointer;
                            transition: all 0.3s ease;
                        " onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 4px 8px rgba(0, 0, 0, 0.1)'"
                           onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                            View Records
                        </button>
                        <button class="open-chart-btn" data-patient="${patient.name}" style="
                            background: #779f00;
                            color: #ffffff;
                            border: none;
                            border-radius: 6px;
                            padding: 6px 16px;
                            font-size: 12px;
                            font-weight: 500;
                            cursor: pointer;
                            transition: all 0.3s ease;
                        " onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 4px 8px rgba(0, 0, 0, 0.1)'; this.style.background='#5a7800'"
                           onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'; this.style.background='#779f00'">
                            Open Chart
                        </button>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
                    <div style="display: flex; align-items: center; gap: 10px; color: #565e6c; font-size: 14px;">
                        <span>👤</span>
                        <span>Age: ${patient.age}, ${patient.gender}, ${patient.bloodType}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px; color: #565e6c; font-size: 14px;">
                        <span>✉️</span>
                        <span>${patient.email}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px; color: #565e6c; font-size: 14px;">
                        <span>📞</span>
                        <span>${patient.phone}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px; color: #565e6c; font-size: 14px;">
                        <span>📍</span>
                        <span>${patient.address}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px; color: #565e6c; font-size: 14px;">
                        <span>📅</span>
                        <span>Last Visit: ${patient.lastVisit}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px; color: #565e6c; font-size: 14px;">
                        <span>❤️</span>
                        <span style="
                            background: #dbeafe;
                            color: #3371db;
                            padding: 2px 10px;
                            border-radius: 11px;
                            font-size: 12px;
                            font-weight: 600;
                            border: 1px solid #3371db;
                        ">${patient.condition}</span>
                    </div>
                </div>
            </div>
        `;
    });
    
    resultsContainer.innerHTML = html;
    
    // Add click handlers for View Records and Open Chart buttons
    resultsContainer.querySelectorAll('.view-records-btn, .open-chart-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            window.location.href = '../view-patient-hisoty/index.html';
        });
    });
}

// عرض رسالة عدم وجود نتائج
function showNoResults(message) {
    // البحث عن container الرئيسي
    const mainFrame = document.querySelector('.patient-search__frame-1');
    if (!mainFrame) {
        console.error('Main frame not found');
        return;
    }
    
    let resultsContainer = document.getElementById('searchResults');
    
    if (!resultsContainer) {
        resultsContainer = document.createElement('div');
        resultsContainer.id = 'searchResults';
        resultsContainer.style.cssText = `
            position: absolute;
            left: 306px;
            top: 660px;
            width: 1100px;
            max-width: calc(100% - 350px);
            background: #f2f6fd;
            border-radius: 8px;
            border: 1px solid #dee1e6;
            padding: 40px;
            box-shadow: 0px 0px 1px 0px rgba(23, 26, 31, 0.15),
                0px 0px 2px 0px rgba(23, 26, 31, 0.2);
            text-align: center;
            z-index: 10;
        `;
        mainFrame.appendChild(resultsContainer);
    }
    
    resultsContainer.innerHTML = `
        <div style="color: #565e6c; font-size: 16px; font-family: 'Poppins', sans-serif;">
            <svg style="width: 64px; height: 64px; margin-bottom: 20px; opacity: 0.5;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <p style="font-size: 18px; font-weight: 600; margin-bottom: 10px;">${message}</p>
            <p style="font-size: 14px;">Try searching with a different term or check the spelling</p>
        </div>
    `;
}

// إضافة event listener لزر البحث
function initializeSearchButton() {
    const searchButton = document.querySelector('.patient-search__button');
    if (searchButton) {
        // إزالة أي event listeners سابقة
        const newButton = searchButton.cloneNode(true);
        searchButton.parentNode.replaceChild(newButton, searchButton);
        
        // إضافة event listener جديد
        newButton.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Search button clicked');
            searchPatients();
        });
        
        // إضافة cursor pointer
        newButton.style.cursor = 'pointer';
        newButton.style.userSelect = 'none';
        
        // تعطيل pointer events على العناصر الداخلية
        newButton.querySelectorAll('*').forEach(child => {
            child.style.pointerEvents = 'none';
        });
        
        console.log('Search button initialized successfully');
    } else {
        console.warn('Search button not found');
    }
}

// Navigation handlers
function initNavigation() {
    console.log('Initializing navigation...');
    
    // Helper function to setup navigation button
    function setupNavButton(selector, url) {
        const btn = document.querySelector(selector);
        if (btn) {
            console.log('Found button:', selector);
            
            // Set styles
            btn.style.cursor = 'pointer';
            btn.style.userSelect = 'none';
            btn.style.webkitUserSelect = 'none';
            btn.style.mozUserSelect = 'none';
            btn.style.msUserSelect = 'none';
            
            // Remove all existing event listeners by removing and re-adding
            const btnClone = btn.cloneNode(true);
            btn.parentNode.replaceChild(btnClone, btn);
            
            // Add click event with multiple methods
            function navigate(e) {
                if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.cancelBubble = true;
                }
                console.log('Navigating to:', url);
                window.location.href = url;
                return false;
            }
            
            btnClone.addEventListener('click', navigate, true);
            btnClone.addEventListener('mousedown', function(e) {
                e.preventDefault();
                navigate(e);
            }, true);
            
            // Disable pointer events on children to ensure click works on parent
            btnClone.querySelectorAll('*').forEach(child => {
                child.style.pointerEvents = 'none';
                child.style.userSelect = 'none';
                child.style.webkitUserSelect = 'none';
            });
            
            // Also add onclick as fallback
            btnClone.onclick = navigate;
            
            return btnClone;
        } else {
            console.warn('Button not found:', selector);
            return null;
        }
    }

    // Wait a bit to ensure DOM is fully ready
    setTimeout(function() {
        // Setup all navigation buttons
        const dashboardBtn = setupNavButton('.patient-search__button6', '../../dashboard/dashboard.html');
        const myPatientsBtn = setupNavButton('.patient-search__button3', '../../my-patients/my-patients.html');
        const requestsBtn = setupNavButton('.patient-search__button4', '../../my-requests/my-requests.html');
        const scheduleBtn = setupNavButton('.patient-search__button5', '../../schedule/schedule.html');

        // Patient Search Button (current page - no navigation needed)
        const patientSearchBtn = document.querySelector('.patient-search__button2');
        if (patientSearchBtn) {
            patientSearchBtn.style.cursor = 'default';
            patientSearchBtn.querySelectorAll('*').forEach(child => {
                child.style.pointerEvents = 'none';
            });
        }

        console.log('Navigation buttons setup:', {
            dashboard: !!dashboardBtn,
            myPatients: !!myPatientsBtn,
            requests: !!requestsBtn,
            schedule: !!scheduleBtn
        });
    }, 100);
}

// وظيفة التهيئة الرئيسية
function initializePatientSearch() {
    console.log('Initializing Patient Search System...');
    console.log('DOM Ready State:', document.readyState);
    
    try {
        // تهيئة صندوق البحث
        initializeSearchBox();
        
        // تهيئة زر البحث
        initializeSearchButton();
        
        // تهيئة التنقل
        initNavigation();
        
        console.log('✅ Patient Search System Initialized Successfully');
        console.log('📊 Available patients:', patients.length);
        console.log('🔍 Search functionality ready');
    } catch (error) {
        console.error('❌ Error initializing Patient Search:', error);
        console.error('Error details:', error.stack);
    }
}

// تشغيل عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM Content Loaded - Initializing Patient Search');
    initializePatientSearch();
});

// Also try to initialize if DOM is already loaded
if (document.readyState === 'loading') {
    // DOM hasn't finished loading yet, wait for DOMContentLoaded
    console.log('⏳ Waiting for DOM to load...');
} else {
    // DOM is already loaded, initialize immediately
    console.log('✅ DOM already loaded - Initializing immediately');
    setTimeout(initializePatientSearch, 50); // تأخير بسيط للتأكد من تحميل كل شيء
}

// إضافة وظيفة البحث كـ global function
window.searchPatients = searchPatients;