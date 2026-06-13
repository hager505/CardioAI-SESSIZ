// chatHistoryRoutes.js — Chat History API Routes

import { Router } from "express";
import {
  createChatSession,
  getChatSessions,
  getChatSession,
  updateChatSessionTitle,
  deleteChatSession,
  addChatMessage,
  getChatMessages,
  getChatSessionWithMessages,
  getAllUserChats,
  getMessageCount,
  deleteChatMessage
} from "../models/chatModel.js";

const router = Router();

// ── Get all chat sessions for a user ─────────────────────────
// GET /api/chat-history/sessions?userId=1&userType=patient
router.get("/sessions", async (req, res) => {
  try {
    const { userId, userType } = req.query;
    
    if (!userId || !userType) {
      return res.status(400).json({ error: "userId and userType are required" });
    }
    
    const sessions = await getChatSessions(parseInt(userId), userType);
    res.json({ sessions });
  } catch (err) {
    console.error("Error fetching chat sessions:", err);
    res.status(500).json({ error: "Failed to fetch chat sessions" });
  }
});

// ── Get all chats with messages for a user ──────────────────
// GET /api/chat-history/chats?userId=1&userType=patient
router.get("/chats", async (req, res) => {
  try {
    const { userId, userType } = req.query;
    
    if (!userId || !userType) {
      return res.status(400).json({ error: "userId and userType are required" });
    }
    
    const chats = await getAllUserChats(parseInt(userId), userType);
    res.json({ chats });
  } catch (err) {
    console.error("Error fetching chats:", err);
    res.status(500).json({ error: "Failed to fetch chats" });
  }
});

// ── Get a specific chat session with messages ────────────────
// GET /api/chat-history/session/:sessionId
router.get("/session/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await getChatSessionWithMessages(parseInt(sessionId));
    
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    
    res.json({ session });
  } catch (err) {
    console.error("Error fetching session:", err);
    res.status(500).json({ error: "Failed to fetch session" });
  }
});

// ── Create a new chat session ────────────────────────────────
// POST /api/chat-history/session
// Body: { userId, userType, title? }
router.post("/session", async (req, res) => {
  try {
    const { userId, userType, title } = req.body;
    
    if (!userId || !userType) {
      return res.status(400).json({ error: "userId and userType are required" });
    }
    
    const sessionId = await createChatSession(parseInt(userId), userType, title);
    const session = await getChatSessionWithMessages(sessionId);
    
    res.status(201).json({ session });
  } catch (err) {
    console.error("Error creating session:", err);
    res.status(500).json({ error: "Failed to create session" });
  }
});

// ── Update chat session title ────────────────────────────────
// PUT /api/chat-history/session/:sessionId
// Body: { title }
router.put("/session/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { title } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: "title is required" });
    }
    
    await updateChatSessionTitle(parseInt(sessionId), title);
    const session = await getChatSessionWithMessages(parseInt(sessionId));
    
    res.json({ session });
  } catch (err) {
    console.error("Error updating session:", err);
    res.status(500).json({ error: "Failed to update session" });
  }
});

// ── Delete a chat session ────────────────────────────────────
// DELETE /api/chat-history/session/:sessionId
router.delete("/session/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    await deleteChatSession(parseInt(sessionId));
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting session:", err);
    res.status(500).json({ error: "Failed to delete session" });
  }
});

// ── Get messages for a session ──────────────────────────────
// GET /api/chat-history/messages/:sessionId
router.get("/messages/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const messages = await getChatMessages(parseInt(sessionId));
    res.json({ messages });
  } catch (err) {
    console.error("Error fetching messages:", err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// ── Add a message to a session ──────────────────────────────
// POST /api/chat-history/message
// Body: { sessionId, role, content, userId?, userType? }
router.post("/message", async (req, res) => {
  try {
    const { sessionId, role, content, userId, userType } = req.body;
    
    if (!sessionId || !role || !content) {
      return res.status(400).json({ error: "sessionId, role, and content are required" });
    }
    
    const result = await addChatMessage(parseInt(sessionId), role, content, userId, userType);
    
    if (result === null) {
      // Session doesn't exist and couldn't be auto-created (missing userId/userType)
      return res.status(404).json({
        error: "Session does not exist",
        requiresUser: true,
        message: "Session not found. Provide userId and userType to auto-create."
      });
    }
    
    // Return both messageId and sessionId (in case session was recreated)
    res.status(201).json({
      messageId: result.messageId,
      sessionId: result.sessionId,
      wasRecreated: result.wasRecreated || false
    });
  } catch (err) {
    console.error("Error adding message:", err);
    res.status(500).json({ error: "Failed to add message" });
  }
});


// Delete a specific message from a session
// DELETE /api/chat-history/session/:sessionId/message/:messageId
router.delete("/session/:sessionId/message/:messageId", async (req, res) => {
  try {
    const { sessionId, messageId } = req.params;
    await deleteChatMessage(parseInt(messageId));
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting message:", err);
    res.status(500).json({ error: "Failed to delete message" });
  }
});

export default router;
