/**
 * 闲鱼发布流程调试脚本
 * 运行：node scripts/test-xianyu.js
 *
 * 会打开真实浏览器窗口，方便观察每一步操作
 * 截图保存在 scripts/screenshots/
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { loadConfig } = require('../src/config');

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR);

// ── 测试用软文（不需要跑 AI）──────────────────────────────
const TEST_ARTICLE = {
  title: '【测试】流量卡推广测试文章',
  content: '这是一篇测试软文，用于调试闲鱼发布流程。\n超值流量卡，全国通用，月租低至9.9元，感兴趣的朋友点击了解：https://your-promo-link.com',
  imagePaths: [] // 如需测试图片上传，填入本地图片绝对路径，如 ['/tmp/test.jpg']
};

async function shot(page, name) {
  const file = path.join(SCREENSHOT_DIR, `${Date.now()}-${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  📸 截图: ${file}`);
}

async function main() {
  const config = loadConfig();
  const cookie = config.platforms?.xianyu?.cookie || process.env.XIANYU_COOKIE;

  console.log('\n══════════════════════════════════════════════');
  console.log('  闲鱼发布流程调试');
  console.log('══════════════════════════════════════════════');

  if (!cookie) {
    console.error('❌ 未找到 cookie，请先在管理面板保存闲鱼 Cookie');
    process.exit(1);
  }
  console.log(`✅ Cookie 已读取: ${cookie.slice(0, 50)}...`);
  console.log(`📝 测试标题: ${TEST_ARTICLE.title}`);
  console.log(`🖼  测试图片: ${TEST_ARTICLE.imagePaths.length} 张`);

  // headless: false 打开真实浏览器
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });

  // 注入 cookie
  const cookies = cookie.split(';').map(pair => {
    const [name, ...rest] = pair.trim().split('=');
    return { name: name.trim(), value: rest.join('=').trim(), domain: '.goofish.com', path: '/' };
  }).filter(c => c.name);
  await context.addCookies(cookies);
  console.log(`\n🍪 注入 ${cookies.length} 个 cookie`);

  const page = await context.newPage();

  try {
    // ── Step 1: 打开首页，检查登录态 ──────────────────────
    console.log('\n[Step 1] 打开闲鱼首页，检查登录态...');
    await page.goto('https://www.goofish.com/', { waitUntil: 'networkidle', timeout: 30000 });
    const loginCheck = await page.$('[class*="user-order-container"]');
    await shot(page, '01-homepage');
    if (!loginCheck) {
      await shot(page, '01-login-fail');
      console.error('❌ 登录态检测失败：未找到 user-order-container');
      console.log('   请重新从 https://www.goofish.com/ 获取 Cookie');
      await browser.close();
      process.exit(1);
    }
    console.log('✅ 登录态正常（找到 user-order-container）');

    // ── Step 2: 打开发布页 ────────────────────────────────
    console.log('\n[Step 2] 打开发布页...');
    await page.goto('https://www.goofish.com/publish', { waitUntil: 'networkidle', timeout: 30000 });
    await shot(page, '02-publish-page');
    console.log(`   当前 URL: ${page.url()}`);

    // ── Step 3: 上传图片 ──────────────────────────────────
    if (TEST_ARTICLE.imagePaths.length > 0) {
      console.log('\n[Step 3] 上传图片...');
      const fileInput = await page.$('input[type="file"][accept*="image"], input[type="file"]');
      if (fileInput) {
        await fileInput.setInputFiles(TEST_ARTICLE.imagePaths.slice(0, 9));
        await page.waitForTimeout(3000);
        await shot(page, '03-after-upload');
        console.log(`✅ 图片上传完成`);
      } else {
        console.warn('⚠️  未找到图片上传 input，跳过');
        await shot(page, '03-no-file-input');
      }
    } else {
      console.log('\n[Step 3] 跳过图片上传（imagePaths 为空）');
    }

    // ── Step 4: 填写标题 ──────────────────────────────────
    console.log('\n[Step 4] 填写标题...');
    const titleSelectors = ['input[name="title"]', '.publish-title input', '[placeholder*="标题"]', 'input[placeholder*="title"]'];
    let titleFilled = false;
    for (const sel of titleSelectors) {
      const el = await page.$(sel);
      if (el) {
        await page.fill(sel, TEST_ARTICLE.title.slice(0, 30));
        titleFilled = true;
        console.log(`✅ 标题已填写（选择器: ${sel}）`);
        break;
      }
    }
    if (!titleFilled) {
      console.warn('⚠️  未找到标题输入框');
      // 打印页面所有 input 帮助调试
      const inputs = await page.$$eval('input', els => els.map(e => ({ name: e.name, placeholder: e.placeholder, class: e.className })));
      console.log('   页面 input 列表:', JSON.stringify(inputs, null, 2));
    }
    await shot(page, '04-title-filled');

    // ── Step 5: 填写描述 ──────────────────────────────────
    console.log('\n[Step 5] 填写描述...');
    const descSelectors = ['textarea[name="desc"]', '.publish-desc textarea', '[placeholder*="描述"]', 'textarea'];
    let descFilled = false;
    for (const sel of descSelectors) {
      const el = await page.$(sel);
      if (el) {
        await page.fill(sel, TEST_ARTICLE.content);
        descFilled = true;
        console.log(`✅ 描述已填写（选择器: ${sel}）`);
        break;
      }
    }
    if (!descFilled) {
      console.warn('⚠️  未找到描述输入框');
      const textareas = await page.$$eval('textarea', els => els.map(e => ({ name: e.name, placeholder: e.placeholder, class: e.className })));
      console.log('   页面 textarea 列表:', JSON.stringify(textareas, null, 2));
    }
    await shot(page, '05-desc-filled');

    // ── Step 6: 提交 ─────────────────────────────────────
    console.log('\n[Step 6] 点击提交...');
    const submitSelectors = ['button[type="submit"]', '.publish-submit', '[class*="submitBtn"]', '[class*="submit"]'];
    let submitted = false;
    for (const sel of submitSelectors) {
      const el = await page.$(sel);
      if (el) {
        await el.click();
        submitted = true;
        console.log(`✅ 已点击提交（选择器: ${sel}）`);
        break;
      }
    }
    if (!submitted) {
      console.warn('⚠️  未找到提交按钮');
      const buttons = await page.$$eval('button', els => els.map(e => ({ type: e.type, text: e.textContent?.trim(), class: e.className })));
      console.log('   页面 button 列表:', JSON.stringify(buttons, null, 2));
    }

    await page.waitForTimeout(3000);
    await shot(page, '06-after-submit');
    console.log(`   提交后 URL: ${page.url()}`);

    console.log('\n══════════════════════════════════════════════');
    console.log('  调试完成，浏览器将在 10 秒后关闭');
    console.log(`  截图保存在: ${SCREENSHOT_DIR}`);
    console.log('══════════════════════════════════════════════\n');

    await page.waitForTimeout(10000);
  } catch (e) {
    console.error('\n❌ 异常:', e.message);
    await shot(page, 'error');
  } finally {
    await browser.close();
  }
}

main();
