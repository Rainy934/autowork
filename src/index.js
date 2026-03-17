require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { loadConfig, saveConfig } = require('./config');
const { initScheduler, scheduleTask, unscheduleTask, runTask } = require('./scheduler');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ─── 配置接口 ───────────────────────────────────────────

// 获取全部配置
app.get('/api/config', (req, res) => {
  res.json(loadConfig());
});

// 更新推广链接和描述
app.post('/api/config/promo', (req, res) => {
  const { promoUrl, promoDesc } = req.body;
  const config = loadConfig();
  if (promoUrl !== undefined) config.promoUrl = promoUrl;
  if (promoDesc !== undefined) config.promoDesc = promoDesc;
  saveConfig(config);
  res.json({ ok: true });
});

// 更新平台配置（如 cookie）
app.post('/api/config/platform/:name', (req, res) => {
  const config = loadConfig();
  config.platforms = config.platforms || {};
  config.platforms[req.params.name] = { ...config.platforms[req.params.name], ...req.body };
  saveConfig(config);
  res.json({ ok: true });
});

// ─── 任务接口 ───────────────────────────────────────────

// 获取任务列表
app.get('/api/tasks', (req, res) => {
  res.json(loadConfig().tasks || []);
});

// 新增任务
app.post('/api/tasks', (req, res) => {
  const { platform, cron, enabled = true, label } = req.body;
  if (!platform || !cron) return res.status(400).json({ error: '缺少 platform 或 cron' });

  const config = loadConfig();
  const task = { id: Date.now().toString(), platform, cron, enabled, label: label || platform };
  config.tasks = config.tasks || [];
  config.tasks.push(task);
  saveConfig(config);

  if (enabled) scheduleTask(task);
  res.json(task);
});

// 更新任务
app.put('/api/tasks/:id', (req, res) => {
  const config = loadConfig();
  const idx = config.tasks.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '任务不存在' });

  config.tasks[idx] = { ...config.tasks[idx], ...req.body };
  saveConfig(config);

  unscheduleTask(req.params.id);
  if (config.tasks[idx].enabled) scheduleTask(config.tasks[idx]);
  res.json(config.tasks[idx]);
});

// 删除任务
app.delete('/api/tasks/:id', (req, res) => {
  const config = loadConfig();
  config.tasks = config.tasks.filter(t => t.id !== req.params.id);
  saveConfig(config);
  unscheduleTask(req.params.id);
  res.json({ ok: true });
});

// 立即手动执行任务
app.post('/api/tasks/:id/run', async (req, res) => {
  const config = loadConfig();
  const task = config.tasks.find(t => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: '任务不存在' });
  const result = await runTask(task);
  res.json(result);
});

// 手动触发（不依赖已有任务）
app.post('/api/run', async (req, res) => {
  const { platform = 'xianyu' } = req.body;
  const result = await runTask({ id: 'manual', platform, label: '手动触发' });
  res.json(result);
});

// ─── 日志接口 ───────────────────────────────────────────

app.get('/api/logs', (req, res) => {
  res.json(loadConfig().logs || []);
});

// ─── 启动 ───────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ 管理面板运行在 http://localhost:${PORT}`);
  initScheduler();
});
