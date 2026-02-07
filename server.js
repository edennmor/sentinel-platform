const db = require("./db");
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();

/* middlewares */
app.use(cors());
app.use(express.json());

/* =========================
   Security events (in-memory)
========================= */
let securityEvents = [];
let nextEventId = 1;

function logSecurityEvent({ ip, path, reason, level = "warn" }) {
  const event = {
    id: nextEventId++,
    time: new Date().toISOString(),
    ip,
    path,
    reason,
    level,
  };
  securityEvents.unshift(event);
  return event;
}

/* =========================
   Simple auth (token)
========================= */
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123"; // לפרויקט
const activeTokens = new Set();

app.post("/api/auth/login", (req, res) => {
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: "password is required" });

  if (password !== ADMIN_PASSWORD) {
    logSecurityEvent({
      ip: req.ip,
      path: req.originalUrl,
      reason: "Failed admin login",
      level: "warn",
    });
    return res.status(401).json({ error: "Invalid password" });
  }

  const token = crypto.randomBytes(24).toString("hex");
  activeTokens.add(token);

  logSecurityEvent({
    ip: req.ip,
    path: req.originalUrl,
    reason: "Admin login success",
    level: "info",
  });

  res.json({ token });
});

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token || !activeTokens.has(token)) {
    logSecurityEvent({
      ip: req.ip,
      path: req.originalUrl,
      reason: "Unauthorized admin access",
      level: "block",
    });
    return res.status(403).json({ error: "Forbidden" });
  }

  next();
}

/* =========================
   Rate limit / detection
========================= */
const ipStats = new Map();
const WINDOW_MS = 60_000;            // דקה
const MAX_REQ_PER_WINDOW = 120;      // כללי
const MAX_SUSPICIOUS_PER_WINDOW = 5; // חשודים
const BLOCK_MS = 5 * 60_000;         // 5 דקות

function getClientIp(req) {
  return req.ip || "unknown"; // ב-localhost זה יכול להיות ::1
}

app.use((req, res, next) => {
  const ip = getClientIp(req);
  const t = Date.now();

  if (!ipStats.has(ip)) {
    ipStats.set(ip, {
      count: 0,
      suspicious: 0,
      windowStart: t,
      blockedUntil: 0,
    });
  }

  const s = ipStats.get(ip);

  // reset window
  if (t - s.windowStart > WINDOW_MS) {
    s.count = 0;
    s.suspicious = 0;
    s.windowStart = t;
  }

  // blocked?
  if (s.blockedUntil && t < s.blockedUntil) {
    logSecurityEvent({
      ip,
      path: req.originalUrl,
      reason: "Blocked IP (rate limit / suspicious)",
      level: "block",
    });
    return res.status(429).json({ error: "Too many requests (blocked temporarily)" });
  }

  s.count += 1;

  // מה נחשב "חשוד"?
  const isSuspiciousPath =
    req.originalUrl.startsWith("/api/admin") ||
    req.originalUrl.startsWith("/api/auth/login");

  if (isSuspiciousPath) s.suspicious += 1;

  // כללי
  if (s.count > MAX_REQ_PER_WINDOW) {
    s.blockedUntil = t + BLOCK_MS;
    logSecurityEvent({
      ip,
      path: req.originalUrl,
      reason: "Rate limit exceeded",
      level: "block",
    });
    return res.status(429).json({ error: "Too many requests (rate limit)" });
  }

  // חשודים
  if (s.suspicious > MAX_SUSPICIOUS_PER_WINDOW) {
    s.blockedUntil = t + BLOCK_MS;
    logSecurityEvent({
      ip,
      path: req.originalUrl,
      reason: "Too many suspicious requests",
      level: "block",
    });
    return res.status(429).json({ error: "Too many suspicious requests" });
  }

  next();
});

/* =========================
   Routes
========================= */

/* health check */
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Backend is running",
    time: new Date().toISOString(),
  });
});

/* hello endpoint */
app.get("/api/hello", (req, res) => {
  res.json({ message: "Hello from backend 👋" });
});

/* GET all security events */
app.get("/api/security-events", (req, res) => {
  res.json(securityEvents);
});

/* Tasks (SQLite) */
app.get("/api/tasks", (req, res) => {
  db.all("SELECT id, title, done FROM tasks", (err, rows) => {
    if (err) return res.status(500).json({ error: "database error" });
    const result = rows.map((r) => ({ ...r, done: Boolean(r.done) }));
    res.json(result);
  });
});

app.post("/api/tasks", (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: "title is required" });

  db.run("INSERT INTO tasks (title, done) VALUES (?, ?)", [title, 0], function (err) {
    if (err) return res.status(500).json({ error: "database error" });
    res.status(201).json({ id: this.lastID, title, done: false });
  });
});

app.put("/api/tasks/:id", (req, res) => {
  const id = Number(req.params.id);
  const { title, done } = req.body;

  db.get("SELECT id, title, done FROM tasks WHERE id = ?", [id], (err, row) => {
    if (err) return res.status(500).json({ error: "database error" });
    if (!row) return res.status(404).json({ error: "task not found" });

    const newTitle = title !== undefined ? title : row.title;
    const newDone = done !== undefined ? (done ? 1 : 0) : row.done;

    db.run("UPDATE tasks SET title = ?, done = ? WHERE id = ?", [newTitle, newDone, id], (err2) => {
      if (err2) return res.status(500).json({ error: "database error" });
      res.json({ id, title: newTitle, done: Boolean(newDone) });
    });
  });
});

app.delete("/api/tasks/:id", (req, res) => {
  const id = Number(req.params.id);
  db.run("DELETE FROM tasks WHERE id = ?", [id], function (err) {
    if (err) return res.status(500).json({ error: "database error" });
    if (this.changes === 0) return res.status(404).json({ error: "task not found" });
    res.json({ id });
  });
});

/* ADMIN - מוגן בטוקן */
app.get("/api/admin", requireAdmin, (req, res) => {
  res.json({ ok: true, message: "Welcome admin" });
});

/* START SERVER */
app.listen(4000, () => {
  console.log("Server running on http://localhost:4000");
});