const express = require('express');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
app.use(express.json());

// Cấu hình kết nối PostgreSQL (bắt buộc cấu hình SSL cho Neon.tech)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// 1. Route trang chủ (/): Hiển thị trực tiếp giao diện Web Quản lý công việc
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cloud Task Manager</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-slate-900 text-slate-100 min-h-screen font-sans">
    <div class="max-w-5xl mx-auto px-4 py-8">
        <header class="flex justify-between items-center pb-6 border-b border-slate-800">
            <div>
                <h1 class="text-2xl font-bold text-blue-400">Cloud Task Manager</h1>
                <p class="text-slate-400 text-xs mt-1">Render.com & Neon.tech PostgreSQL</p>
            </div>
            <div class="flex items-center gap-3">
                <span id="health-status" class="px-3 py-1 text-xs rounded-full bg-slate-800 text-slate-400">Connecting...</span>
                <button onclick="initDB()" class="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg">Init DB</button>
            </div>
        </header>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 my-6">
            <div class="bg-slate-800/60 p-4 rounded-xl border border-slate-700">
                <p class="text-slate-400 text-xs">Tổng công việc</p>
                <h3 id="stat-total" class="text-2xl font-bold text-white mt-1">0</h3>
            </div>
            <div class="bg-slate-800/60 p-4 rounded-xl border border-slate-700">
                <p class="text-slate-400 text-xs">Đang làm</p>
                <h3 id="stat-pending" class="text-2xl font-bold text-amber-400 mt-1">0</h3>
            </div>
            <div class="bg-slate-800/60 p-4 rounded-xl border border-slate-700">
                <p class="text-slate-400 text-xs">Hoàn thành</p>
                <h3 id="stat-completed" class="text-2xl font-bold text-emerald-400 mt-1">0</h3>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div class="bg-slate-800/40 p-5 rounded-xl border border-slate-800 h-fit">
                <h2 class="text-sm font-semibold text-white mb-3">Thêm công việc</h2>
                <form onsubmit="createTask(event)" class="space-y-3">
                    <input type="text" id="task-title" required placeholder="Tiêu đề..." class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white">
                    <textarea id="task-desc" rows="3" placeholder="Mô tả..." class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white"></textarea>
                    <button type="submit" class="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium py-2 rounded">Thêm mới</button>
                </form>
            </div>

            <div class="md:col-span-2 space-y-3">
                <h2 class="text-sm font-semibold text-white">Danh sách</h2>
                <div id="tasks-container" class="space-y-2"></div>
            </div>
        </div>
    </div>

    <script>
        const API_URL = window.location.origin;

        async function checkHealth() {
            try {
                const res = await fetch(API_URL + '/health');
                const data = await res.json();
                const el = document.getElementById('health-status');
                if(data.status === 'UP') {
                    el.className = 'px-3 py-1 text-xs rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
                    el.innerText = 'Connected to DB';
                }
            } catch(e) {}
        }

        async function initDB() {
            try {
                const res = await fetch(API_URL + '/init');
                alert(await res.text());
                fetchTasks();
            } catch(e) { alert('Lỗi: ' + e.message); }
        }

        async function fetchTasks() {
            try {
                const res = await fetch(API_URL + '/tasks');
                const tasks = await res.json();
                renderTasks(tasks);
            } catch(e) {}
        }

        function renderTasks(tasks) {
            const container = document.getElementById('tasks-container');
            document.getElementById('stat-total').innerText = tasks.length || 0;
            document.getElementById('stat-pending').innerText = tasks.filter(t => t.status !== 'Completed').length || 0;
            document.getElementById('stat-completed').innerText = tasks.filter(t => t.status === 'Completed').length || 0;

            if(!tasks || tasks.length === 0) {
                container.innerHTML = '<div class="text-slate-500 text-xs text-center py-6">Chưa có dữ liệu</div>';
                return;
            }

            container.innerHTML = tasks.map(t => \`
                <div class="bg-slate-800/40 border border-slate-700/50 p-3 rounded-lg flex justify-between items-center">
                    <div>
                        <span class="font-medium text-xs \${t.status === 'Completed' ? 'line-through text-slate-500' : 'text-white'}">\${t.title}</span>
                        <p class="text-slate-400 text-[11px] mt-0.5">\${t.description || ''}</p>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="toggleTask(\${t.id}, '\${t.status === 'Completed' ? 'Pending' : 'Completed'}')" class="px-2 py-1 bg-slate-700 text-xs text-slate-300 rounded">
                            \${t.status === 'Completed' ? 'Hoàn tác' : 'Xong'}
                        </button>
                        <button onclick="deleteTask(\${t.id})" class="px-2 py-1 bg-rose-500/10 text-xs text-rose-400 rounded">Xóa</button>
                    </div>
                </div>
            \`).join('');
        }

        async function createTask(e) {
            e.preventDefault();
            const title = document.getElementById('task-title').value;
            const description = document.getElementById('task-desc').value;
            await fetch(API_URL + '/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, description, status: 'Pending' })
            });
            document.getElementById('task-title').value = '';
            document.getElementById('task-desc').value = '';
            fetchTasks();
        }

        async function toggleTask(id, status) {
            await fetch(API_URL + '/tasks/' + id, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            fetchTasks();
        }

        async function deleteTask(id) {
            if(confirm('Xóa công việc này?')) {
                await fetch(API_URL + '/tasks/' + id, { method: 'DELETE' });
                fetchTasks();
            }
        }

        checkHealth();
        fetchTasks();
    </script>
</body>
</html>`);
});

// 2. Các API Endpoint
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'UP', database: 'CONNECTED', timestamp: new Date() });
  } catch (err) {
    res.status(500).json({ status: 'DOWN', database: err.message });
  }
});

app.get('/init', async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'Pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    res.send('Database initialized with tasks table');
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get('/tasks', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tasks ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/tasks', async (req, res) => {
  const { title, description, status } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO tasks (title, description, status) VALUES ($1, $2, $3) RETURNING *',
      [title, description, status || 'Pending']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const result = await pool.query(
      'UPDATE tasks SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/tasks/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
