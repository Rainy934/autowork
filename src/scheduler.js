const cron = require('node-cron');
const { getHotTopics } = require('./hotspot');
const { generateArticle } = require('./writer');
const XianyuPlatform = require('./platforms/xianyu');
const { loadConfig, saveConfig } = require('./config');

const platformMap = {
  xianyu: new XianyuPlatform()
};

// 运行中的 cron 任务 map: taskId -> cronTask
const runningTasks = new Map();

/**
 * 执行一次完整的：热点收集 -> AI写文 -> 发布
 */
async function runTask(task) {
  const config = loadConfig();
  const sep = '─'.repeat(50);

  console.log(`\n${sep}`);
  console.log(`[scheduler] 🚀 开始执行  任务: ${task.id}  平台: ${task.platform}  时间: ${new Date().toLocaleString('zh-CN')}`);
  console.log(sep);

  try {
    // 1. 收集热点
    console.log('\n[1/3] 📡 抓取热点...');
    const topics = await getHotTopics();
    console.log(`      获取到 ${topics.length} 条热点：`);
    topics.forEach((t, i) => console.log(`      ${i + 1}. [${t.source}] ${t.title}`));

    // 2. AI 生成软文 + 配图
    console.log('\n[2/3] ✍️  调用 AI 生成软文...');
    console.log(`      模型: ${process.env.OPENAI_MODEL || 'gpt-4o-mini'}`);
    console.log(`      推广链接: ${config.promoUrl}`);
    const article = await generateArticle(
      topics,
      config.promoUrl,
      config.promoDesc,
      task.platform
    );
    console.log(`\n      ── 标题 ──`);
    console.log(`      ${article.title}`);
    console.log(`\n      ── 正文 ──`);
    article.content.split('\n').forEach(line => console.log(`      ${line}`));
    console.log(`\n      ── 配图 ──`);
    console.log(`      共 ${article.imagePaths.length} 张: ${article.imagePaths.join(', ') || '无'}`);

    // 3. 发布
    console.log('\n[3/3] 📤 发布到平台...');
    const platform = platformMap[task.platform];
    if (!platform) throw new Error(`未知平台: ${task.platform}`);

    const platformConfig = config.platforms?.[task.platform] || {};
    const cookiePreview = platformConfig.cookie
      ? platformConfig.cookie.slice(0, 40) + '...'
      : '（未配置）';
    console.log(`      平台: ${task.platform}`);
    console.log(`      Cookie: ${cookiePreview}`);

    const result = await platform.publish(article, platformConfig);
    console.log(`      结果: ${result.success ? '✅' : '❌'} ${result.message}`);

    // 4. 记录日志
    const log = {
      taskId: task.id,
      platform: task.platform,
      time: new Date().toISOString(),
      success: result.success,
      message: result.message,
      articlePreview: article.content.slice(0, 100)
    };
    config.logs = config.logs || [];
    config.logs.unshift(log);
    config.logs = config.logs.slice(0, 100);
    saveConfig(config);

    console.log(`\n${sep}`);
    console.log(`[scheduler] 任务结束: ${result.success ? '✅ 成功' : '❌ 失败'}`);
    console.log(`${sep}\n`);
    return log;
  } catch (e) {
    console.error(`\n[scheduler] ❌ 任务异常: ${e.message}`);
    console.log(`${sep}\n`);
    return { success: false, message: e.message };
  }
}

/**
 * 注册所有任务到 cron
 */
function initScheduler() {
  const config = loadConfig();
  (config.tasks || []).forEach(task => {
    if (task.enabled) scheduleTask(task);
  });
  console.log(`[scheduler] 已加载 ${config.tasks?.length || 0} 个任务`);
}

function scheduleTask(task) {
  if (runningTasks.has(task.id)) {
    runningTasks.get(task.id).stop();
  }
  if (!task.enabled || !task.cron) return;

  const job = cron.schedule(task.cron, () => runTask(task), { timezone: 'Asia/Shanghai' });
  runningTasks.set(task.id, job);
  console.log(`[scheduler] 任务 ${task.id} 已调度: ${task.cron}`);
}

function unscheduleTask(taskId) {
  if (runningTasks.has(taskId)) {
    runningTasks.get(taskId).stop();
    runningTasks.delete(taskId);
  }
}

module.exports = { initScheduler, scheduleTask, unscheduleTask, runTask };
