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

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// 1. Giao diện Web HTML Dashboard Hiện Đại
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cloud Task Pro - Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <style>
        .glass { background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(12px); }
    </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen font-sans">
    <div class="max-w-6xl mx-auto px-4 py-8">
        <!-- Header -->
        <header class="flex justify-between items-center pb-6 border-b border-slate-800/80">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xl shadow-lg shadow-indigo-500/20">
                    <i class="fa-solid fa-list-check"></i>
                </div>
                <div>
                    <h1 class="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">Cloud Task Pro</h1>
                    <p class="text-slate-400 text-xs mt-0.5">Hệ thống quản lý công việc trên Render & Neon DB</p>
                </div>
            </div>
            <div class="flex items-center gap-3">
                <span id="user-display" class="text-xs text-slate-300 font-medium"></span>
                <button id="btn-auth" onclick="handleAuthAction()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-all shadow-lg shadow-indigo-600/20">
                    Đăng nhập
                </button>
            </div>
        </header>

        <!-- Form Auth -->
        <div id="auth-box" class="max-w-md mx-auto my-12 glass border border-slate-800 p-8 rounded-2xl shadow-2xl">
            <h2 id="auth-title" class="text-xl font-bold text-center text-white mb-6">Đăng Nhập Hệ Thống</h2>
            <form onsubmit="submitAuth(event)" class="space-y-4">
                <div>
                    <label class="block text-xs font-medium text-slate-300
