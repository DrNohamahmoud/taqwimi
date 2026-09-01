import fs from "fs/promises";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "userStats.json");
const MAX_EVENTS = 5000;

async function ensureDataFile() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
      await fs.access(DATA_FILE);
    } catch (e) {
      const initial = { events: [], users: {} };
      await fs.writeFile(DATA_FILE, JSON.stringify(initial, null, 2), "utf8");
    }
  } catch (err) {
    console.error("Failed ensuring data file:", err);
  }
}

async function readData() {
  await ensureDataFile();
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("Error reading userStats.json:", err);
    return { events: [], users: {} };
  }
}

async function writeData(data) {
  await ensureDataFile();
  // keep events length bounded
  if (Array.isArray(data.events) && data.events.length > MAX_EVENTS) {
    data.events = data.events.slice(0, MAX_EVENTS);
  }
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

export async function recordEvent({ userId, eventType, metadata }) {
  if (!userId || !eventType) {
    throw new Error("userId and eventType are required");
  }

  const data = await readData();
  const now = new Date().toISOString();
  const event = {
    id: `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    userId,
    eventType,
    metadata: metadata || {},
    ts: now,
  };

  data.events.unshift(event);

  if (!data.users[userId]) {
    data.users[userId] = {
      firstSeen: now,
      lastSeen: now,
      events: 1,
    };
  } else {
    data.users[userId].lastSeen = now;
    data.users[userId].events = (data.users[userId].events || 0) + 1;
  }

  await writeData(data);
  return event;
}

export async function getRecentEvents(limit = 50, userId = null) {
  const data = await readData();
  let events = data.events || [];
  if (userId) {
    events = events.filter((e) => e.userId === userId);
  }
  return events.slice(0, limit);
}

export async function getSummary() {
  const data = await readData();
  const totalUsers = Object.keys(data.users || {}).length;
  const totalEvents = (data.events || []).length;

  // active users in last 30 days
  const THIRTY_DAYS = 1000 * 60 * 60 * 24 * 30;
  const now = Date.now();
  const activeUsers = Object.values(data.users || {}).filter((u) => {
    const last = new Date(u.lastSeen).getTime();
    return now - last <= THIRTY_DAYS;
  }).length;

  // simple breakdown by eventType
  const eventCounts = {};
  (data.events || []).forEach((e) => {
    eventCounts[e.eventType] = (eventCounts[e.eventType] || 0) + 1;
  });

  return {
    totalUsers,
    activeUsers,
    totalEvents,
    eventCounts,
    lastUpdated: data.events && data.events.length ? data.events[0].ts : null,
  };
}
