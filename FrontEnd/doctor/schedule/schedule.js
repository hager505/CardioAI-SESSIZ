/**
 * Schedule Page JavaScript
 * Handles tab switching and other interactions
 */

// Import API config
// import { apiUrl } from "../config/api.js";
const apiUrl = "http://localhost:5000";
// ==================== APPOINTMENTS API ====================

async function loadAppointments() {
    try {
        // Get today's appointments
        const apiUrl = "http://localhost:5000";
        const today = new Date().toISOString().split('T')[0];
        const url = `${apiUrl}/api/doctor/appointments?date=' + today`;

        const res = await fetch(url);
        if (!res.ok) {
            console.error('Failed to load appointments:', res.status);
            return;
        }

        const result = await res.json();
        if (!result.ok) {
            console.error('API error:', result.error);
            return;
        }

        const appointments = result.data || [];
        console.log('Loaded appointments:', appointments.length);

        // Update stats
        updateStats(appointments);

        // Render appointments in calendar
        renderAppointments(appointments);

    } catch (err) {
        console.error('Failed to load appointments:', err);
    }
}

function updateStats(appointments) {
    // Today's appointments
    const statCards = document.querySelectorAll('.stat-card');
    statCards.forEach(card => {
        const header = card.querySelector('.stat-header span');
        const valueEl = card.querySelector('.stat-value');
        if (header && header.textContent.includes("Today's") && valueEl) {
            valueEl.textContent = appointments.length;
        }
    });
}

function renderAppointments(appointments) {
    // Add appointments from API to calendar
    appointments.forEach(apt => {
        // Convert time to hour format for matching
        const timeHour = apt.time ? apt.time.split(':')[0] : '09';

        // Find matching time row
        const timeCells = document.querySelectorAll('.time-cell');
        timeCells.forEach(cell => {
            const cellTime = cell.textContent.trim().split(':')[0];
            if (cellTime === timeHour) {
                const td = cell.parentElement;
                if (td && td.children.length <= 1) { // Only time-cell, no appointments yet
                    const block = document.createElement('div');
                    block.className = 'appointment-block';
                    block.onclick = function () {
                        alert('Patient: ' + apt.patientName + '\nType: ' + apt.type + '\nTime: ' + apt.time);
                    };

                    const timeSpan = document.createElement('span');
                    timeSpan.className = 'app-time';
                    timeSpan.textContent = apt.time;

                    const nameSpan = document.createElement('span');
                    nameSpan.className = 'app-name';
                    nameSpan.textContent = apt.patientName;

                    block.appendChild(timeSpan);
                    block.appendChild(nameSpan);
                    td.appendChild(block);
                }
            }
        });
    });
}

function avatarUrl(name, bg = "003785") {
    const parts = (name ?? "X").trim().split(/\s+/);
    const f = encodeURIComponent((parts[0]?.[0] ?? "X").toUpperCase());
    const l = encodeURIComponent((parts[1]?.[0] ?? parts[0]?.[1] ?? "X").toUpperCase());
    return `https://ui-avatars.com/api/?name=${f}+${l}&background=${bg}&color=fff&size=128&bold=true`;
}

document.addEventListener('DOMContentLoaded', function () {
    const raw = sessionStorage.getItem("user_data");
    const role = sessionStorage.getItem("user_role");

    if (!raw || role !== "doctor") {
        window.location.href = "../../auth/login.html";
        return;
    }
    const user = JSON.parse(raw);

    const namePill = document.getElementById("doctorNamePill");
    if (namePill) namePill.textContent = user.full_name || "Doctor";

    const avatarPill = document.getElementById("doctorAvatarPill");
    if (avatarPill) {
        const photo = user.avatar_url || localStorage.getItem(`avatar_${user.id}`) || avatarUrl(user.full_name);
        avatarPill.src = photo;
    }

    // Load appointments from API
    loadAppointments();
    // Tab Switching
    const tabButtons = document.querySelectorAll('.tabs__btn');
    const viewSections = document.querySelectorAll('.view-section');

    tabButtons.forEach(button => {
        button.addEventListener('click', function () {
            const tabName = this.dataset.tab;

            // Remove active class from all buttons
            tabButtons.forEach(btn => btn.classList.remove('tabs__btn--active'));

            // Add active class to clicked button
            this.classList.add('tabs__btn--active');

            // Hide all view sections
            viewSections.forEach(section => section.classList.remove('view-section--active'));

            // Show selected view section
            const targetSection = document.getElementById(tabName + '-view');
            if (targetSection) {
                targetSection.classList.add('view-section--active');
            }
        });
    });

    // Date Picker (placeholder for future implementation)
    const datePicker = document.querySelector('.date-picker');
    if (datePicker) {
        datePicker.addEventListener('click', function () {
            // TODO: Implement date picker modal
            console.log('Date picker clicked');
        });
    }

    // New Appointment Button
    const newAppointmentBtns = document.querySelectorAll('.btn--primary');
    newAppointmentBtns.forEach(btn => {
        btn.addEventListener('click', function () {
            // Navigate to add schedule page
            window.location.href = './add-schedule.html';
        });
    });

    // Calendar Slot Click
    const slotCells = document.querySelectorAll('.slot-cell');
    slotCells.forEach(cell => {
        cell.addEventListener('click', function () {
            // TODO: Implement slot selection
            this.classList.toggle('slot-cell--selected');
            console.log('Slot clicked');
        });
    });

    // Load appointments when page loads
    loadAppointments();

    // Sidebar Navigation
    const navItems = document.querySelectorAll('.sidebar__nav-item');
    navItems.forEach(item => {
        item.style.cursor = 'pointer';
        item.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            // Get the text content to determine which page to navigate to
            const navText = this.querySelector('span')?.textContent.trim() || '';

            // Remove active from all
            navItems.forEach(nav => nav.classList.remove('sidebar__nav-item--active'));
            // Add active to clicked
            this.classList.add('sidebar__nav-item--active');

            // Navigate based on text
            if (navText === 'Dashboard') {
                window.location.href = '../dashboard/dashboard.html';
            } else if (navText === 'Patient Search') {
                window.location.href = '../patient-search/patient-search/patient-search.html';
            } else if (navText === 'My Patients') {
                window.location.href = '../my-patients/my-patients.html';
            } else if (navText === 'Requests') {
                window.location.href = '../my-requests/my-requests.html';
            } else if (navText === 'Schedule') {
                // Already on schedule page
                return;
            }
        });
    });
});
