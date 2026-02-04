const db = require('./db');
const express = require('express');
const cors = require('cors');

const app = express();

/* middlewares */
app.use(cors());
app.use(express.json());



function logSecurityEvent({ ip, path, reason }) {
  const event = {
    id: nextEventId++,
    time: new Date().toISOString(),
    ip,
    path,
    reason
  };
  securityEvents.unshift(event); // newest first
  return event;
}


/* health check */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Backend is running',
    time: new Date().toISOString()
  });
});

/* hello endpoint */
app.get('/api/hello', (req, res) => {
  res.json({
    message: 'Hello from backend 👋'
  });
});

/* GET all security events */
app.get('/api/security-events', (req, res) => {
  res.json(securityEvents);
});

app.get('/api/tasks', (req, res) => {
  db.all('SELECT id, title, done FROM tasks', (err, rows) => {
    if (err) return res.status(500).json({ error: 'database error' });

    // done ב-SQLite נשמר כ-0/1, נהפוך ל-true/false
    const result = rows.map(r => ({
      ...r,
      done: Boolean(r.done),
    }));

    res.json(result);
  });
});

/* CREATE task */
app.post('/api/tasks', (req, res) => {
  const { title } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'title is required' });
  }

  const newTask = {
    id: tasks.length ? tasks[tasks.length - 1].id + 1 : 1,
    title,
    done: false
  };

  tasks.push(newTask);
  res.status(201).json(newTask);
});

/* UPDATE task */
app.put('/api/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const { title, done } = req.body;

  const task = tasks.find(t => t.id === id);
  if (!task) return res.status(404).json({ error: 'task not found' });

  if (title !== undefined) task.title = title;
  if (done !== undefined) task.done = done;

  res.json(task);
});

/* DELETE task */
app.delete('/api/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const index = tasks.findIndex(t => t.id === id);

  if (index === -1) return res.status(404).json({ error: 'task not found' });

  const deleted = tasks.splice(index, 1)[0];
  res.json(deleted);
});

/* CANARY ENDPOINT */
app.get('/api/admin', (req, res) => {
  return res.status(403).json({
    error: 'Forbidden'
  });
});


/* START SERVER */
app.listen(4000, () => {
  console.log('Server running on http://localhost:4000');
});