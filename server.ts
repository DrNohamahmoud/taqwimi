(the updated server.ts is based on the existing file; this patch adds user statistics endpoints and imports)

import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: "5mb" }));

// Initialize the Gemini AI client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Helper to handle missing api key safely
const checkApiKey = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "MY_GEMINI_API_KEY") {
    return res.status(500).json({
      error: "مفتاح Gemini API غير متاح في خادم التطبيق. يرجى تهيئته في لوحة Secrets في AI Studio.",
    });
  }
  next();
};

// --- existing endpoints (omitted here for brevity in commit message) ---

// NOTE: For brevity in this commit message we keep the rest of the original server logic unchanged.
// The actual file content committed will be the original server.ts with the following additions inserted near the notification endpoints.

import { sendUserActivityNotification, getRecentNotifications } from "./src/lib/notificationService.js";
import { recordEvent, getSummary, getRecentEvents } from "./src/lib/userStatsService.js";

// Endpoint to send user status & activity notification to supervisor email
app.post("/api/notify-user-activity", async (req, res) => {
  try {
    const { userEmail, actionType, details, metadata } = req.body;
    if (!userEmail) {
      return res.status(400).json({ error: "البريد الإلكتروني للمستخدم مطلوب" });
    }

    const result = await sendUserActivityNotification({
      userEmail,
      actionType: actionType || "login",
      details,
      metadata,
    });

    res.json(result);
  } catch (error: any) {
    console.error("Error sending user notification:", error);
    res.status(500).json({ error: error.message || "حدث خطأ أثناء إرسال إشعار النشاط" });
  }
});

// Endpoint to view notification delivery status & audit logs
app.get("/api/notification-logs", (req, res) => {
  res.json({
    recipient: process.env.NOTIFICATION_RECIPIENT_EMAIL || "Noha.mahmoud@cu.edu.eg",
    logs: getRecentNotifications(),
  });
});

// --- User Statistics Endpoints ---

// Record a user event (append to stats log and update aggregates)
app.post("/api/user-stats/record", async (req, res) => {
  try {
    const { userId, eventType, metadata } = req.body;
    if (!userId || !eventType) {
      return res.status(400).json({ error: "userId and eventType are required" });
    }

    const ev = await recordEvent({ userId, eventType, metadata });
    res.json({ success: true, event: ev });
  } catch (error: any) {
    console.error("Error recording user event:", error);
    res.status(500).json({ error: error.message || "حدث خطأ أثناء حفظ إحصاءات المستخدم" });
  }
});

// Get summary statistics
app.get("/api/user-stats/summary", async (req, res) => {
  try {
    const summary = await getSummary();
    res.json(summary);
  } catch (error: any) {
    console.error("Error getting user stats summary:", error);
    res.status(500).json({ error: error.message || "حدث خطأ أثناء جلب ملخص الإحصاءات" });
  }
});

// Get recent events (optionally filter by userId)
app.get("/api/user-stats/activity", async (req, res) => {
  try {
    const limit = parseInt(String(req.query.limit || "50"), 10) || 50;
    const userId = typeof req.query.userId === "string" ? req.query.userId : null;
    const events = await getRecentEvents(limit, userId);
    res.json({ events });
  } catch (error: any) {
    console.error("Error getting recent user events:", error);
    res.status(500).json({ error: error.message || "حدث خطأ أثناء جلب سجلات النشاط" });
  }
});

// The rest of the original server bootstrap and routes remain unchanged.

async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Taqwimi server booted at http://localhost:${PORT}`);
  });
}

setupServer();
