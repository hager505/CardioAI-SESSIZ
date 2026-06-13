// doctor/config/api-global.js --- Shared API Configuration for Doctor Frontend (Global Script)
/**
 * Cardio AI - Shared API Configuration (Global Script)
 * Use this for pages with regular <script src="...">
 */

const API_BASE = "http://localhost:5000";

function apiUrl(path) {
  return API_BASE + (path.startsWith("/") ? path : "/" + path);
}

// Expose globally for non-module pages
window.API_BASE = API_BASE;
window.apiUrl = apiUrl;

console.log("✅ API config (global) loaded - using", API_BASE);
