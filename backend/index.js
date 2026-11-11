const express = require('express');
const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Hàm mã hóa mật khẩu đơn giản
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// 1. Giao diện Web HTML (Tích hợp Đăng nhập / Đăng ký & Dashboard)
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cloud Task Manager - Auth Multi-user</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-slate-900 text-slate-100 min-h-screen font-sans">
    <div class="max-w-5xl mx-auto px-4 py-8">
        <!-- Header -->
        <header class="flex justify-between items-center pb-6 border-b border-slate-800">
            <div>
                <h1 class="text-2xl font-bold text-blue-400">Cloud Task Manager</h1>
                <p class="text-slate-400 text-xs mt-1">Hệ thống phân quyền Multi-user (Render + Neon PostgreSQL)</p>
            </div>
            <div class="flex items-center gap-3">
                <span id="user-display" class="text-xs text-slate-300 font-medium"></span>
                <button id="btn-auth" onclick="handleAuthAction()" class="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg">Đăng nhập</button>
            </div>
        </header>

        <!-- Auth Modal / View -->
        <div id="auth-box" class="max-w-md mx-auto my-12 bg-slate-800/60 border border-slate-700 p-6 rounded-2xl shadow-xl">
            <h2 id="auth-title" class="text-lg font-bold text-center text-white mb-4">Đăng Nhập Hệ Thống</h2>
            <form onsubmit="submitAuth(event)" class="space-y-4">
                <div>
                    <label class="block text-xs font-medium text-slate-300 mb-1">Tên tài khoản</label>
                    <input type="text" id="auth-username" required placeholder="Nhập username..." class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white">
                </div>
                <div>
                    <label class="block text-xs font-medium text-slate-300 mb-1">Mật khẩu</label>
                    <input type="password" id="auth-password" required placeholder="Nhập mật khẩu..." class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white">
                </div>
                <button type="submit" id="auth-btn-submit" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs py-2.5 rounded-lg transition-all">
                    Đăng Nhập
                </button>
            </form>
            <div class="mt-4 text-center">
                <button onclick="toggleAuthMode()" id="auth-toggle-btn" class="text-xs text-blue-400 hover:underline">
                    Chưa có tài khoản? Đăng ký ngay
                </button>
            </div>
        </div>

        <!-- Dashboard View (Ẩn khi chưa đăng nhập) -->
        <div id="dashboard-box" class="hidden space-y-6 my-6">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="bg-slate-800/60 p-4 rounded-xl border border-slate-700">
                    <p class="text-slate-400 text-xs">Công việc của bạn</p>
                    <h3 id="stat-total" class="text-2xl font-bold text-white mt-1">0</h3>
                </div>
                <div class="bg-slate-800/60 p-4 rounded-xl border border-slate-700">
                    <p class="text-slate-400 text-xs">Đang thực hiện</p>
                    <h3 id="stat-pending" class="text-2xl font-bold text-amber-400 mt-1">0</h3>
                </div>
                <div class="bg-slate-800/60 p-4 rounded-xl border border-slate-700">
                    <p class="text-slate-400 text-xs">Hoàn thành</p>
                    <h3 id="stat-completed" class="text-2xl font-bold text-emerald-400 mt-1">0</h3>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="bg-slate-800/40 p-5 rounded-xl border border-slate-800 h-fit">
                    <h2 class="text-sm font-semibold text-white mb-3">Tạo công việc cá nhân</h2>
                    <form onsubmit="createTask(event)" class="space-y-3">
                        <input type="text" id="task-title" required placeholder="Tiêu đề..." class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white">
                        <textarea id="task-desc" rows="3" placeholder="Mô tả..." class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white"></textarea>
                        <button type="submit" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium py-2 rounded">Thêm công việc</button>
                    </form>
                </div>

                <div class="md:col-span-2 space-y-3">
                    <h2 class="text-sm font-semibold text-white">Danh sách công việc của riêng bạn</h2>
                    <div id="tasks-container" class="space-y-2"></div>
                </div>
            </div>
        </div>
    </div>

    <script>
        const API_URL = window.location.origin;
        let currentUser = JSON.parse(localStorage.getItem('cloud_user')) || null;
        let isRegisterMode = false;

        function updateUI() {
            if (currentUser) {
                document.getElementById('auth-box').classList.add('hidden');
                document.getElementById('dashboard-box').classList.remove('hidden');
                document.getElementById('user-display').innerText = 'Xin chào, ' + currentUser.username;
                document.getElementById('btn-auth').innerText = 'Đăng xuất';
                document.getElementById('btn-auth').className = 'px-3 py-1.5 bg-rose-600 text-white text-xs rounded-lg';
                fetchTasks();
            } else {
                document.getElementById('auth-box').classList.remove('hidden');
                document.getElementById('dashboard-box').classList.add('hidden');
                document.getElementById('user-display').innerText = '';
                document.getElementById('btn-auth').innerText = 'Đăng nhập';
                document.getElementById('btn-auth').className = 'px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg';
            }
        }

        function toggleAuthMode() {
            isRegisterMode = !isRegisterMode;
            document.getElementById('auth-title').innerText = isRegisterMode ? 'Đăng Ký Tài Khoản' : 'Đăng Nhập Hệ Thống';
            document.getElementById('auth-btn-submit').innerText = isRegisterMode ? 'Đăng Ký Mới' : 'Đăng Nhập';
            document.getElementById('auth-toggle-btn').innerText = isRegisterMode ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký ngay';
        }

        function handleAuthAction() {
            if (currentUser) {
                localStorage.removeItem('cloud_user');
                currentUser = null;
                updateUI();
            }
        }

        async function submitAuth(e) {
            e.preventDefault();
            const username = document.getElementById('auth-username').value;
            const password = document.getElementById('auth-password').value;
            const endpoint = isRegisterMode ? '/api/register' : '/api/login';

            try {
                const res = await fetch(API_URL + endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Lỗi xác thực');

                if (isRegisterMode) {
                    alert('Đăng ký thành công! Hãy đăng nhập.');
                    toggleAuthMode();
                } else {
                    currentUser = data.user;
                    localStorage.setItem('cloud_user', JSON.stringify(currentUser));
                    updateUI();
                }
            } catch (err) { alert(err.message); }
        }

        async function fetchTasks() {
            if (!currentUser) return;
            try {
                const res = await fetch(API_URL + '/tasks?userId=' + currentUser.id);
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
                container.innerHTML = '<div class="text-slate-500 text-xs text-center py-6">Bạn chưa tạo công việc nào.</div>';
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
                body: JSON.stringify({ title, description, status: 'Pending', userId: currentUser.id })
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

        // Tự động khởi tạo DB bảng users và tasks nếu chưa có
        fetch(API_URL + '/init');
        updateUI();
    </script>
</body>
</html>`);
});

// 2. Khởi tạo Database với bảng Users & Tasks
app.get('/init', async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'Pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    res.send('Database initialized with users and tasks tables');
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// 3. API Đăng ký tài khoản
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const hashedPassword = hashPassword(password);
    const result = await pool.query(
      'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username',
      [username, hashedPassword]
    );
    res.status(201).json({ message: 'Tạo tài khoản thành công', user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Tên tài khoản đã tồn tại!' });
    }
    res.status(500).json({ error: err.message });
  }
});

// 4. API Đăng nhập
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const hashedPassword = hashPassword(password);
    const result = await pool.query(
      'SELECT id, username FROM users WHERE username = $1 AND password = $2',
      [username, hashedPassword]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Tài khoản hoặc mật khẩu không đúng!' });
    }
    res.json({ message: 'Đăng nhập thành công', user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. API Lấy danh sách Task theo User ID
app.get('/tasks', async (req, res) => {
  const { userId } = req.query;
  try {
    const result = await pool.query(
      'SELECT * FROM tasks WHERE user_id = $1 ORDER BY id DESC',
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. API Tạo Task cho User
app.post('/tasks', async (req, res) => {
  const { title, description, status, userId } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO tasks (title, description, status, user_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [title, description, status || 'Pending', userId]
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

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'UP', database: 'CONNECTED', timestamp: new Date() });
  } catch (err) {
    res.status(500).json({ status: 'DOWN', database: err.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
