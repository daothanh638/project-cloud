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

// 1. Route trang chủ (/): Hiển thị trực tiếp giao diện Quản lý công việc
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cloud Task Manager - VJU Cloud Project</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-slate-900 text-slate-100 min-h-screen font-sans">
    <div class="max-w-6xl mx-auto px-4 py-8">
        <!-- Header -->
        <header class="flex flex-col md:flex-row justify-between items-start md:items-center pb-6 border-b border-slate-800 gap-4">
            <div>
                <h1 class="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
                    <i class="fa-solid to-cloud mr-2"></i>Cloud Task Manager
                </h1>
                <p class="text-slate-400 text-sm mt-1">Đề tài Cloud Computing - Render.com & Neon.tech PostgreSQL</p>
            </div>
            <div class="flex items-center gap-3">
                <span id="health-status" class="px-3 py-1 text-xs font-semibold rounded-full bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-slate-500 animate-pulse"></span> Connecting...
                </span>
                <button onclick="initDB()" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-all shadow-lg shadow-blue-500/20">
                    <i class="fa-solid fa-database mr-1"></i> Init DB (/init)
                </button>
            </div>
        </header>

        <!-- Thống kê -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
            <div class="bg-slate-800/60 p-4 rounded-xl border border-slate-700/50 flex justify-between items-center">
                <div>
                    <p class="text-slate-400 text-xs font-medium uppercase">Tổng công việc</p>
                    <h3 id="stat-total" class="text-2xl font-bold text-white mt-1">0</h3>
                </div>
                <div class="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center text-lg">
                    <i class="fa-solid fa-list-check"></i>
                </div>
            </div>
            <div class="bg-slate-800/60 p-4 rounded-xl border border-slate-700/50 flex justify-between items-center">
                <div>
                    <p class="text-slate-400 text-xs font-medium uppercase">Đang thực hiện</p>
                    <h3 id="stat-pending" class="text-2xl font-bold text-amber-400 mt-1">0</h3>
                </div>
                <div class="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center text-lg">
                    <i class="fa-solid fa-spinner"></i>
                </div>
            </div>
            <div class="bg-slate-800/60 p-4 rounded-xl border border-slate-700/50 flex justify-between items-center">
                <div>
                    <p class="text-slate-400 text-xs font-medium uppercase">Đã hoàn thành</p>
                    <h3 id="stat-completed" class="text-2xl font-bold text-emerald-400 mt-1">0</h3>
                </div>
                <div class="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-lg">
                    <i class="fa-solid fa-circle-check"></i>
                </div>
            </div>
        </div>

        <!-- Form tạo task & Danh sách -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <!-- Form -->
            <div class="bg-slate-800/40 p-6 rounded-2xl border border-slate-800 h-fit">
                <h2 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <i class="fa-solid fa-square-plus text-blue-400"></i> Thêm công việc mới
                </h2>
                <form id="task-form" onsubmit="createTask(event)" class="space-y-4">
                    <div>
                        <label class="block text-xs font-medium text-slate-300 mb-1">Tiêu đề công việc (*)</label>
                        <input type="text" id="task-title" required placeholder="Nhập tiêu đề..." 
                            class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-slate-300 mb-1">Mô tả chi tiết</label>
                        <textarea id="task-desc" rows="3" placeholder="Nhập nội dung ghi chú..." 
                            class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"></textarea>
                    </div>
                    <button type="submit" class="w-full bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-medium py-2.5 rounded-lg text-sm transition-all shadow-lg shadow-blue-500/10">
                        Tạo công việc
                    </button>
                </form>
            </div>

            <!-- List -->
            <div class="lg:col-span-2 space-y-4">
                <div
