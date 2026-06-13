// chatController.js — CardioAI AI Chat Integration
// General Model: Gemini via Google Generative Language API (text-only chat)

import db from "../config/db.js";
import { addChatMessage, createChatSession, getChatMessages, updateChatSessionTitle, getMessageCount } from "../models/chatModel.js";

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

// Gemini model - text only chat
const GEMINI_MODEL = "gemini-3.5-flash";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent`;

// Warn at startup if key is missing
if (!GOOGLE_API_KEY) {
  console.warn("WARNING: GOOGLE_API_KEY is not set");
}

// ── Patient Context ──────────────────────────────────────────────────────────

async function getPatientContext(patientId) {
  if (!patientId || isNaN(parseInt(patientId))) return "";

  try {
    const [patient] = await db.query(
      "SELECT p.*, pi.* FROM patients p LEFT JOIN patient_info pi ON p.id = pi.patient_id WHERE p.id = ?",
      [patientId]
    );
    if (!patient.length) return "";

    const p = patient[0];
    const age = p.date_of_birth
      ? Math.floor(
          (new Date() - new Date(p.date_of_birth)) / (365.25 * 24 * 60 * 60 * 1000)
        )
      : "N/A";

    const [vitals] = await db.query(
      "SELECT * FROM vital_signs WHERE patient_id = ? ORDER BY recorded_at DESC LIMIT 10",
      [patientId]
    );
    const [medications] = await db.query(
      "SELECT * FROM medications WHERE patient_id = ? AND status = 'active'",
      [patientId]
    );
    const [appointments] = await db.query(
      "SELECT * FROM appointments WHERE patient_id = ? ORDER BY appointment_date DESC LIMIT 5",
      [patientId]
    );
    const [records] = await db.query(
      "SELECT * FROM medical_records WHERE patient_id = ? ORDER BY record_date DESC LIMIT 5",
      [patientId]
    );

    return `
Patient Context (ID: ${patientId}):
- Name: ${p.full_name || "N/A"}
- Age: ${age}
- Gender: ${p.gender || "N/A"}
- Blood Type: ${p.blood_type || "N/A"}
- Chronic Diseases: ${p.chronic_diseases || "None"}
- Allergies: ${p.allergies || "None"}
- Previous Surgeries: ${p.previous_surgeries || "None"}

Latest Vitals (${vitals.length} records):
${vitals
  .map(
    (v) =>
      `- Heart Rate: ${v.heart_rate}, BP: ${v.blood_pressure}, SpO2: ${v.spo2}%, Temp: ${v.body_temperature}°C (${new Date(v.recorded_at).toLocaleDateString()})`
  )
  .join("\n") || "None"}

Current Medications (${medications.length}):
${medications.map((m) => `- ${m.medication_name} (${m.dosage})`).join("\n") || "None"}

Recent Appointments (${appointments.length}):
${appointments
  .map(
    (a) =>
      `- ${a.appointment_type} with Dr. ${a.doctor_name || "N/A"} on ${a.appointment_date}`
  )
  .join("\n") || "None"}

Medical Records (${records.length}):
${records.map((r) => `- ${r.record_type}: ${r.title} (${r.record_date})`).join("\n") || "None"}
    `.trim();
  } catch (err) {
    console.error("Error fetching patient context:", err.message);
    return "";
  }
}

// ── Doctor Context ────────────────────────────────────────────────────────────

async function getDoctorContext(doctorId) {
  if (!doctorId || isNaN(parseInt(doctorId))) return "";

  try {
    // Get doctor info
    const [doctor] = await db.query(
      "SELECT d.*, dd.* FROM doctors d LEFT JOIN doctor_details dd ON d.id = dd.doctor_id WHERE d.id = ?",
      [doctorId]
    );
    if (!doctor.length) return "";

    const d = doctor[0];

    // Get doctor's upcoming appointments
    const [appointments] = await db.query(
      `SELECT a.*, p.full_name as patient_name 
       FROM appointments a 
       JOIN patients p ON a.patient_id = p.id 
       WHERE a.doctor_id = ? 
       ORDER BY a.appointment_date ASC, a.appointment_time ASC 
       LIMIT 10`,
      [doctorId]
    );

    // Get doctor's patients (unique patients who have appointments)
    const [patients] = await db.query(
      `SELECT DISTINCT p.id, p.full_name, p.gender, p.date_of_birth,
              pi.blood_type, pi.chronic_diseases
       FROM appointments a 
       JOIN patients p ON a.patient_id = p.id 
       LEFT JOIN patient_info pi ON p.id = pi.patient_id
       WHERE a.doctor_id = ? 
       ORDER BY p.full_name 
       LIMIT 20`,
      [doctorId]
    );

    // Get pending doctor requests
    const [requests] = await db.query(
      `SELECT * FROM doctor_requests 
       WHERE doctor_id = ? AND status = 'pending' 
       ORDER BY created_at DESC 
       LIMIT 5`,
      [doctorId]
    );

    // Calculate patient ages
    const patientsWithAge = patients.map(p => {
      const age = p.date_of_birth
        ? Math.floor((new Date() - new Date(p.date_of_birth)) / (365.25 * 24 * 60 * 60 * 1000))
        : "N/A";
      return { ...p, age };
    });

    return `
Doctor Context (ID: ${doctorId}):
- Name: Dr. ${d.full_name || "N/A"}
- Specialty: ${d.specialty || d.role || "N/A"}
- Hospital: ${d.hospital_affiliation || "N/A"}
- Years of Experience: ${d.years_experience || "N/A"}
- Status: ${d.status || "N/A"}

Upcoming Appointments (${appointments.length}):
${appointments
  .map(
    (a) =>
      `- ${a.appointment_date} ${a.appointment_time || ""}: ${a.patient_name} (${a.appointment_type}) - Status: ${a.status}`
  )
  .join("\n") || "None scheduled"}

My Patients (${patientsWithAge.length}):
${patientsWithAge
  .map(
    (p) =>
      `- ${p.full_name} (Age: ${p.age}, Gender: ${p.gender || "N/A"}${p.blood_type ? `, Blood: ${p.blood_type}` : ""}${p.chronic_diseases ? `, Conditions: ${p.chronic_diseases}` : ""})`
  )
  .join("\n") || "No patients yet"}

Pending Requests (${requests.length}):
${requests
  .map(
    (r) =>
      `- ${r.patient_name}: ${r.message?.substring(0, 100) || "No message"}${r.message?.length > 100 ? "..." : ""}`
  )
  .join("\n") || "No pending requests"}
    `.trim();
  } catch (err) {
    console.error("Error fetching doctor context:", err.message);
    return "";
  }
}

// ── General Model: Gemini (Google AI API) ─────────────────────────────────────

export async function chatGeneral(req, res) {
  if (!GOOGLE_API_KEY) {
    return res.status(500).json({ error: "Google API key not configured" });
  }

  const { messages, patientId, doctorId, sessionId, userType } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages must be a non-empty array" });
  }

  // Require user identification
  if (!userType || (!patientId && !doctorId)) {
    return res.status(400).json({ error: "userType and either patientId or doctorId are required" });
  }

  const isDoctor = !!doctorId;
  const userId = isDoctor ? doctorId : patientId;

  // Get or create session
  let currentSessionId = sessionId;
  
  // Validate sessionId - must be a valid positive integer
  if (currentSessionId) {
    currentSessionId = parseInt(currentSessionId);
    if (isNaN(currentSessionId) || currentSessionId <= 0) {
      currentSessionId = null;
    }
  }
  
  if (!currentSessionId) {
    // Create new session
    const firstMessage = messages.find(m => m.role === "user");
    const sessionTitle = firstMessage
      ? (typeof firstMessage.content === "string" ? firstMessage.content : JSON.stringify(firstMessage.content)).substring(0, 50)
      : "New Chat";
    currentSessionId = await createChatSession(userId, userType || (isDoctor ? 'doctor' : 'patient'), sessionTitle);
  }
  
  // Ensure we have a valid session ID before proceeding
  if (!currentSessionId || isNaN(currentSessionId)) {
    return res.status(500).json({ error: "Failed to create or validate chat session" });
  }

  // Build Google API contents array
  const contents = [];

  // Fetch context based on who is chatting
  let context = "";
  if (isDoctor) {
    context = await getDoctorContext(doctorId);
  } else {
    context = await getPatientContext(patientId);
  }

  const userTypeLabel = isDoctor ? "Doctor" : "Patient";
  const systemPrompt =
    `You are CardioAI, a medical AI assistant specialized in cardiac health. ` +
    `You help ${isDoctor ? "doctors with their patient management, appointments, and medical decisions" : "patients understand heart health, ECG results, vital signs, medications, and lifestyle"}. ` +
    `Always recommend consulting a real doctor for serious concerns. ` +
    `Respond in the same language the user uses.` +
    (context ? `\n\n${userTypeLabel} Context:\n${context}` : "");

  // Add system context as first user message
  contents.push({
    role: "user",
    parts: [{ text: systemPrompt }],
  });
  contents.push({
    role: "model",
    parts: [{ text: "Understood. I am CardioAI, ready to assist." }],
  });

  // Get previous messages from database for context
  const previousMessages = await getChatMessages(currentSessionId);
  
  // Add previous conversation history (limit to last 20 messages to avoid token limits)
  const recentMessages = previousMessages.slice(-20);
  for (const msg of recentMessages) {
    if (msg.role === "system") continue;
    const role = msg.role === "assistant" ? "model" : "user";
    contents.push({
      role,
      parts: [{ text: msg.content }],
    });
  }

  // Add current new messages
  for (const msg of messages) {
    if (msg.role === "system") continue;
    const role = msg.role === "assistant" ? "model" : "user";
    
    let parts = [];
    if (Array.isArray(msg.content)) {
      parts = msg.content;
    } else {
      parts = [{ text: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content) }];
    }
    
    contents.push({
      role,
      parts
    });
  }

  // Note: User messages are already saved by the frontend before streaming starts
  // We only save the AI response after successful streaming

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Collect full AI response for saving to database
  let fullResponse = "";

  // ── Generate title algorithmically (BEFORE chat stream starts) ──
  // Only for new sessions (first message)
  let generatedTitle = null;
  const messageCountAtStart = await getMessageCount(currentSessionId);
  if (messageCountAtStart <= 2) {
    const firstUserMessage = messages.find(m => m.role === "user");
    const userMessageText = firstUserMessage
      ? (typeof firstUserMessage.content === "string"
          ? firstUserMessage.content
          : JSON.stringify(firstUserMessage.content))
      : "";
    
    if (userMessageText) {
      const title = generateChatTitle(userMessageText);
      if (title) {
        updateChatSessionTitle(currentSessionId, title).catch(() => {});
        generatedTitle = title;
      }
    }
  }

  try {
    const googleRes = await fetch(
      `${GEMINI_API_URL}?key=${GOOGLE_API_KEY}&alt=sse`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents,
          generationConfig: {
            maxOutputTokens: 8192,
            // Disable thinking mode
            thinkingConfig: {
              thinkingLevel: "MINIMAL",
            },
          },
        }),
      }
    );

    if (!googleRes.ok) {
      const errText = await googleRes.text();
      console.error("[chatGeneral] Google API error response:", errText);
      
      let errorDetails = errText;
      try {
        const errorJson = JSON.parse(errText);
        errorDetails = errorJson.error?.message || errorJson.message || errText;
      } catch { /* not JSON */ }
      
      res.write(
        `data: ${JSON.stringify({ error: "Google API request failed", details: errorDetails })}\n\n`
      );
      res.end();
      return;
    }

    // Stream Google SSE → client SSE, normalising to OpenAI delta format
    const reader = googleRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const dataStr = trimmed.slice(5).trim();
        if (!dataStr || dataStr === "[DONE]") continue;

        try {
          const parsed = JSON.parse(dataStr);
          
          // Check for errors in the stream
          if (parsed.error) {
            console.error("[chatGeneral] Google API stream error:", parsed.error);
            res.write(
              `data: ${JSON.stringify({ error: parsed.error.message || "API error" })}\n\n`
            );
            continue;
          }
          
          // Extract text from Google's response format
          const textPart = parsed?.candidates?.[0]?.content?.parts?.find(
            (p) => p.text !== undefined
          );
          if (textPart?.text) {
            fullResponse += textPart.text;
            res.write(
              `data: ${JSON.stringify({
                choices: [{ delta: { content: textPart.text } }],
                sessionId: currentSessionId,
              })}\n\n`
            );
          }
        } catch {
          // Skip malformed chunks
        }
      }
    }

    // Send final done event with session info AND title for immediate frontend update
    res.write(`data: ${JSON.stringify({ done: true, sessionId: currentSessionId, title: generatedTitle })}\n\n`);
    res.end();
  } catch (err) {
    console.error("[chatGeneral] General model error:", err.message);
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  }
}

// ── Generate Chat Title (Algorithmic) ──────────────────────────
function generateChatTitle(message) {
    if (!message || typeof message !== 'string') {
        return 'New Chat';
    }

    let text = message.trim();
    
    // Remove common question starters
    const questionStarters = [
        'how to ', 'how do i ', 'how can i ', 'how should i ',
        'what is ', 'what are ', 'what does ', 'what do ',
        'why is ', 'why are ', 'why does ', 'why do ',
        'when should i ', 'when can i ', 'when is ',
        'where can i ', 'where is ',
        'can i ', 'could i ', 'should i ', 'would i ',
        'do i need to ', 'is it okay to ', 'is it safe to ',
        'tell me about ', 'explain ', 'describe ',
        'i need help with ', 'i want to know about ',
        'help me understand ', 'i have a question about '
    ];
    
    let lowerText = text.toLowerCase();
    for (const starter of questionStarters) {
        if (lowerText.startsWith(starter)) {
            text = text.slice(starter.length);
            lowerText = text.toLowerCase();
            break;
        }
    }
    
    // Remove trailing question mark
    text = text.replace(/\?+$/, '').trim();
    
    // Remove leading articles
    text = text.replace(/^(a |an |the )/i, '').trim();
    
    // Convert "How to X" style to gerund "X-ing" style
    text = text.replace(/^(\w+) (to )?(\w+)/i, (match, p1, p2, p3) => {
        // "maintain heart health" -> "Maintaining heart health"
        if (p2 === 'to ') {
            const verbMap = {
                'maintain': 'Maintaining', 'manage': 'Managing',
                'understand': 'Understanding', 'learn': 'Learning',
                'find': 'Finding', 'get': 'Getting',
                'start': 'Starting', 'stop': 'Stopping',
                'prevent': 'Preventing', 'treat': 'Treating',
                'reduce': 'Reducing', 'increase': 'Increasing',
                'improve': 'Improving', 'lower': 'Lowering',
                'control': 'Controlling', 'check': 'Checking',
                'test': 'Testing', 'diagnose': 'Diagnosing'
            };
            const capitalized = verbMap[p1.toLowerCase()] || p1.charAt(0).toUpperCase() + p1.slice(1) + 'ing';
            return capitalized + ' ' + p3;
        }
        return match;
    });
    
    // Take first 5 words max
    const words = text.split(/\s+/).slice(0, 5);
    let title = words.join(' ');
    
    // Capitalize first letter only
    title = title.charAt(0).toUpperCase() + title.slice(1);
    
    // Fallback for edge cases
    if (!title || title.length < 2) {
        title = 'New Chat';
    }
    
    return title;
}

