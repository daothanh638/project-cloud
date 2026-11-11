const express = require('express');
const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
app.use(express.json());

// Kết nối PostgreSQL (Bắt buộc rejectUnauthorized: false cho Neon DB)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Route trang chủ API & thông tin hệ thống
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head><title>Cloud Task API</title></head>
      <body style="font-family: sans-serif; padding: 40px; background: #0f172a; color: #f8fafc;">
        <h2>🚀 Cloud Task Manager API Backend is Live!</h2>
        <p>Hệ thống Backend đã kết nối với PostgreSQL Neon.tech thành công.</p>
        <ul>
          <li><a style="color: #38bdf8;" href="/health">GET /health</a> - Kiểm tra kết nối DB</li>
          <li><a style="color: #38bdf8;" href="/init">GET /init</a> - Khởi tạo bảng dữ liệu</li>
          <li><a style="color: #38bdf8;" href="/tasks">GET /tasks</a> - Lấy danh sách công việc</li>
        </ul>
      </body>
    </html>
  `);
});

// 1. API Khởi tạo bảng DB
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
        due_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    res.send('Database initialized with users and tasks tables');
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// 2. API Health Check
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'UP', database: 'CONNECTED', timestamp: new Date() });
  } catch (err) {
    res.status(500).json({ status: 'DOWN', database: err.message });
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

// 5. API CRUD Tasks
app.get('/tasks', async (req, res) => {
  const { userId } = req.query;
  try {
    let query = 'SELECT * FROM tasks ORDER BY id DESC';
    let params = [];
    if (userId) {
      query = 'SELECT * FROM tasks WHERE user_id = $1 ORDER BY id DESC';
      params = [userId];
    }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/tasks', async (req, res) => {
  const { title, description, status, dueDate, userId } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO tasks (title, description, status, due_date, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [title, description, status || 'Pending', dueDate || null, userId || null]
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
