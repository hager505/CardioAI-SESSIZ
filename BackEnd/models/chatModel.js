// chatModel.js — Chat History Database Operations

import db from "../config/db.js";

// ── Chat Sessions ────────────────────────────────────────────

export async function createChatSession(userId, userType, title = 'New Chat') {
  const [result] = await db.query(
    'INSERT INTO chat_sessions (user_id, user_type, title) VALUES (?, ?, ?)',
    [userId, userType, title]
  );
  return result.insertId;
}

export async function getChatSessions(userId, userType) {
  const [rows] = await db.query(
    'SELECT * FROM chat_sessions WHERE user_id = ? AND user_type = ? ORDER BY updated_at DESC',
    [userId, userType]
  );
  return rows;
}

export async function getChatSession(sessionId) {
  const [rows] = await db.query(
    'SELECT * FROM chat_sessions WHERE id = ?',
    [sessionId]
  );
  return rows[0] || null;
}

export async function updateChatSessionTitle(sessionId, title) {
  await db.query(
    'UPDATE chat_sessions SET title = ? WHERE id = ?',
    [title, sessionId]
  );
}

export async function deleteChatSession(sessionId) {
  await db.query(
    'DELETE FROM chat_sessions WHERE id = ?',
    [sessionId]
  );
}

// ── Chat Messages ────────────────────────────────────────────

export async function addChatMessage(sessionId, role, content, userId = null, userType = null) {
  // Validate sessionId
  const validSessionId = parseInt(sessionId);
  if (isNaN(validSessionId) || validSessionId <= 0) {
    throw new Error(`Invalid session_id: ${sessionId}`);
  }
  
  // Verify session exists before adding message
  const [sessions] = await db.query('SELECT id, user_id, user_type FROM chat_sessions WHERE id = ?', [validSessionId]);
  if (sessions.length === 0) {
    // Session doesn't exist - auto-create it if userId and userType are provided
    if (userId && userType) {
      console.warn(`Session ${validSessionId} does not exist, auto-creating new session for user ${userId} (${userType})`);
      const [result] = await db.query(
        'INSERT INTO chat_sessions (user_id, user_type, title) VALUES (?, ?, ?)',
        [userId, userType, 'New Chat']
      );
      const newSessionId = result.insertId;
      
      // Add the message to the new session
      const [msgResult] = await db.query(
        'INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)',
        [newSessionId, role, content]
      );
      
      // Update session's updated_at timestamp
      await db.query(
        'UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newSessionId]
      );
      
      return { messageId: msgResult.insertId, sessionId: newSessionId, wasRecreated: true };
    }
    
    // Cannot auto-create without user info
    console.warn(`Session ${validSessionId} does not exist, cannot save message`);
    return null;
  }
  
  const [result] = await db.query(
    'INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)',
    [validSessionId, role, content]
  );
  
  // Update session's updated_at timestamp
  await db.query(
    'UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [validSessionId]
  );
  
  return { messageId: result.insertId, sessionId: validSessionId, wasRecreated: false };
}

export async function getChatMessages(sessionId) {
  const [rows] = await db.query(
    'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC',
    [sessionId]
  );
  return rows;
}

export async function deleteChatMessage(messageId) {
  await db.query(
    'DELETE FROM chat_messages WHERE id = ?',
    [messageId]
  );
}

export async function getMessageCount(sessionId) {
  const validSessionId = parseInt(sessionId);
  if (isNaN(validSessionId) || validSessionId <= 0) {
    return 0;
  }
  const [rows] = await db.query(
    'SELECT COUNT(*) as count FROM chat_messages WHERE session_id = ?',
    [validSessionId]
  );
  return rows[0]?.count || 0;
}

// ── Combined Operations ──────────────────────────────────────

export async function getChatSessionWithMessages(sessionId) {
  const session = await getChatSession(sessionId);
  if (!session) return null;
  
  const messages = await getChatMessages(sessionId);
  return {
    ...session,
    messages
  };
}

export async function getAllUserChats(userId, userType) {
  const sessions = await getChatSessions(userId, userType);
  
  const chatsWithMessages = await Promise.all(
    sessions.map(async (session) => {
      const messages = await getChatMessages(session.id);
      return {
        ...session,
        messages
      };
    })
  );
  
  return chatsWithMessages;
}
