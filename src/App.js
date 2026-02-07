import { useEffect, useState } from "react";

const API = "http://localhost:4000/api";

function App() {
  const [health, setHealth] = useState(null);

  const [tasks, setTasks] = useState([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const [securityEvents, setSecurityEvents] = useState([]);
  const [error, setError] = useState("");

  async function loadAll() {
    try {
      setError("");

      const h = await fetch(`${API}/health`).then((r) => r.json());
      setHealth(h);

      const t = await fetch(`${API}/tasks`).then((r) => r.json());
      setTasks(t);

      const s = await fetch(`${API}/security-events`).then((r) => r.json());
      setSecurityEvents(s);
    } catch (e) {
      setError("לא הצלחתי להתחבר לשרת (Backend). תוודאי שהוא רץ על 4000");
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function addTask() {
    const title = newTaskTitle.trim();
    if (!title) return;

    try {
      setError("");
      const res = await fetch(`${API}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Failed to add task");
      }

      setNewTaskTitle("");
      await loadAll();
    } catch (e) {
      setError("לא הצלחתי להוסיף משימה. בדקי שהשרת רץ.");
    }
  }

  async function toggleTask(task) {
    try {
      setError("");
      const res = await fetch(`${API}/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: !task.done }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Failed to update task");
      }

      await loadAll();
    } catch (e) {
      setError("לא הצלחתי לעדכן משימה.");
    }
  }

  return (
    <div style={{ padding: 20, fontFamily: "Arial" }}>
      <h1>🛡️ Security Dashboard</h1>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <h2>✅ Health</h2>
      <pre>{health ? JSON.stringify(health, null, 2) : "Loading..."}</pre>

      <hr />

      <h2>📋 Tasks</h2>

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          placeholder="משימה חדשה..."
          style={{ padding: 8, width: 260 }}
        />
        <button onClick={addTask} style={{ padding: "8px 12px" }}>
          Add
        </button>
        <button onClick={loadAll} style={{ padding: "8px 12px" }}>
          Refresh
        </button>
      </div>

      {tasks.length === 0 ? (
        <p style={{ opacity: 0.7 }}>אין משימות עדיין — תוסיפי אחת למעלה 👆</p>
      ) : (
        <ul>
          {tasks.map((t) => (
            <li key={t.id} style={{ marginBottom: 6 }}>
              <label style={{ cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={() => toggleTask(t)}
                  style={{ marginRight: 8 }}
                />
                {t.title}
              </label>
            </li>
          ))}
        </ul>
      )}

      <hr />

      <h2>🚨 Security Events</h2>
      {securityEvents.length === 0 ? (
        <p style={{ opacity: 0.7 }}>
          עדיין אין אירועי אבטחה. עוד רגע ניצור בכוונה 🙂
        </p>
      ) : (
        <ul>
          {securityEvents.map((e) => (
            <li key={e.id}>
              [{e.time}] {e.ip} → {e.path} ({e.reason}) [{e.level}]
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default App;