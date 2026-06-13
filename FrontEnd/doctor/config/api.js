// doctor/config/api.js --- API configuration for Doctor Frontend
/**
 * Cardio AI - Shared API Configuration (ES Module)
 * Use this for pages with <script type="module">
 */

const API_BASE = "http://localhost:5000";

function apiUrl(path) {
  return API_BASE + (path.startsWith("/") ? path : "/" + path);
}

export { API_BASE, apiUrl };

console.log("✅ API config (module) loaded - using", API_BASE);
