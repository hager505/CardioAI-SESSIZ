// doctor/patient-search/patient-search/script.js
// Patient Search script
const API = "http://localhost:5000/api";

function avatarUrl(name, bg = "003785") {
    const parts = (name ?? "X").trim().split(/\s+/);
    const f = encodeURIComponent((parts[0]?.[0] ?? "X").toUpperCase());
    const l = encodeURIComponent((parts[1]?.[0] ?? parts[0]?.[1] ?? "X").toUpperCase());
    return `https://ui-avatars.com/api/?name=${f}+${l}&background=${bg}&color=fff&size=128&bold=true`;
}

function resolvePatientUrl(url) {
    if (!url) return url;
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
    if (url.startsWith('/')) return 'http://localhost:5000' + url;
    return 'http://localhost:5000/' + url;
}

document.addEventListener("DOMContentLoaded", async () => {
    const raw = sessionStorage.getItem("user_data");
    if (!raw) {
        window.location.href = "../../../auth/login.html";
        return;
    }
    let user;
    try { user = JSON.parse(raw); } catch (e) { return; }

    // 1. Setup Doctor Info
    const namePill = document.getElementById("doctorNamePill");
    if (namePill) namePill.textContent = user.full_name || "Doctor";

    const dropName = document.getElementById("dropdownDoctorName");
    if (dropName) dropName.textContent = user.full_name || "Doctor";

    const dropSpec = document.getElementById("dropdownDoctorSpecialty");
    if (dropSpec) dropSpec.textContent = user.specialty || "—";

    if (typeof AuthManager !== "undefined") {
        AuthManager.initDoctorAvatar(document.getElementById("doctorAvatar"), user.id, user.full_name);
    }

    // 2. Fetch Patients Data
    try {
        const res = await fetch(`${API}/patients`);
        if (res.ok) {
            const data = await res.json();
            window.patients = (data.patients || []).map(p => ({
                name: p.full_name || "Unknown",
                id: p.serial || `P-${p.id}`,
                backendId: p.id,                       // real DB id, used to open the profile
                email: p.email || "",
                phone: p.phone || "—",
                status: "Active", // For demonstration
                gender: (p.gender || "").toLowerCase(),
                lastVisit: p.created_at ? p.created_at.split("T")[0] : "Unknown",
                avatar_url: p.avatar_url || (p.files && p.files.length ? p.files[0].file_path : null)
            }));
            if (typeof performSearch === "function") performSearch();
        }
    } catch (e) { console.error("Could not fetch patients:", e); }
});

// 3. Open patient profile in the View Patient History page
window.openPatientProfile = function (backendId) {
    if (!backendId) return;
    sessionStorage.setItem("view_patient_id", String(backendId));
    window.location.href = "../view-patient-history/index.html";
};