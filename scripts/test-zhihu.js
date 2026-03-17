/**
 * 知乎发布流程调试脚本
 * 运行：node scripts/test-zhihu.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { loadConfig } = require('../src/config');

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR);

const TEST_ARTICLE = {
  title: '【测试】手机流量不够用？分享我的省钱方案',
  content: '最近很多朋友问我流量不够用怎么办，今天分享一个我一直在用的方案。\n\n现在有一款全国通用流量卡，月租低至9.9元，无合约期随时可退，信号覆盖全国。对于经常出差或者流量消耗大的朋友来说非常实用。\n\n感兴趣可以了解一下：https://your-promo-link.com',
  imagePaths: []
};

async function shot(page, name) {
  const file = path.join(SCREENSHOT_DIR, `zhihu-${Date.now()}-${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  📸 截图: ${file}`);
}

async function printElements(page, tag, label) {
  const els = await page.$$eval(tag, nodes => nodes.map(e => ({
    tag: e.tagName,
    type: e.type,
    name: e.name,
    placeholder: e.placeholder,
    class: e.className?.slice(0, 80),
    text: e.textContent?.trim().slice(0, 30)
  })));
  if (els.length) {
    console.log(`   页面 ${label} 列表:`);
    els.forEach((e, i) => console.log(`     [${i}]`, JSON.stringify(e)));
  } else {
    console.log(`   未找到任何 ${label}`);
  }
}

async function runEditorFlow(page) {
  await shot(page, '03-editor');
  console.log(`\n[Step 3] 编辑器已打开，URL: ${page.url()}`);

  // ── 填写标题 ──────────────────────────────────────────
  console.log('\n[Step 3a] 填写标题...');
  const titleSelectors = [
    '[placeholder*="请输入标题"]',
    '[placeholder*="标题"]',
    '.WriteIndex-titleInput',
    'textarea[data-slate-editor]'
  ];
  let titleFilled = false;
  for (const sel of titleSelectors) {
    const el = await page.$(sel);
    if (el) {
      await el.click();
      await el.fill(TEST_ARTICLE.title.slice(0, 100));
      titleFilled = true;
      console.log(`✅ 标题已填写 (${sel})`);
      break;
    }
  }
  if (!titleFilled) {
    console.warn('⚠️  未找到标题框');
    await printElements(page, 'input', 'input');
    await printElements(page, 'textarea', 'textarea');
  }
  await shot(page, '03b-title-filled');

  // ── 填写正文 ──────────────────────────────────────────
  console.log('\n[Step 3b] 填写正文...');
  const editorSelectors = [
    '[placeholder*="请输入正文"]',
    '[placeholder*="正文"]',
    '.DraftEditor-editorContainer',
    '[contenteditable="true"]'
  ];
  let editorFilled = false;
  for (const sel of editorSelectors) {
    const el = await page.$(sel);
    if (el) {
      await el.click();
      await page.waitForTimeout(300);
      await page.keyboard.type(TEST_ARTICLE.content, { delay: 15 });
      editorFilled = true;
      console.log(`✅ 正文已填写 (${sel})`);
      break;
    }
  }
  if (!editorFilled) {
    console.warn('⚠️  未找到正文编辑器');
    const editables = await page.$$eval('[contenteditable]', els =>
      els.map(e => ({ class: e.className?.slice(0, 80), placeholder: e.getAttribute('placeholder') }))
    );
    console.log('   contenteditable 元素:', JSON.stringify(editables, null, 2));
  }
  await shot(page, '03c-content-filled');

  // ── 上传图片 ──────────────────────────────────────────
  if (TEST_ARTICLE.imagePaths.length > 0) {
    console.log('\n[Step 3c] 上传图片...');
    const fileInput = await page.$('input[type="file"]');
    if (fileInput) {
      await fileInput.setInputFiles(TEST_ARTICLE.imagePaths.slice(0, 9));
      await page.waitForTimeout(3000);
      await shot(page, '03d-images-uploaded');
      console.log('✅ 图片已上传');
    } else {
      console.warn('⚠️  未找到图片上传 input');
    }
  }

  // ── 点击发布 ──────────────────────────────────────────
  console.log('\n[Step 4] 查找发布按钮...');
  const publishSelectors = [
    'button[type="button"]:has-text("发布"):not(:has-text("设置")):not(:has-text("文章"))',
    'button:has-text("发布文章")',
    '[class*="PublishButton"]'
  ];
  let publishBtn = null;
  for (const sel of publishSelectors) {
    publishBtn = await page.$(sel);
    if (publishBtn) { console.log(`✅ 找到发布按钮: ${sel}`); break; }
  }
  if (!publishBtn) {
    console.warn('⚠️  未找到发布按钮');
    await printElements(page, 'button', 'button');
  }
  await shot(page, '04-before-submit');

  if (publishBtn) {
    await publishBtn.click();
    await page.waitForTimeout(3000);
    await shot(page, '05-after-submit');
    console.log(`✅ 已点击发布，当前 URL: ${page.url()}`);
  }
}

async function main() {
  const config = loadConfig();
  const cookie = config.platforms?.zhihu?.cookie || process.env.ZHIHU_COOKIE;

  console.log('\n══════════════════════════════════════════════');
  console.log('  知乎发布流程调试');
  console.log('══════════════════════════════════════════════');

  if (!cookie) {
    console.error('❌ 未找到知乎 cookie，请先在管理面板保存知乎 Cookie');
    process.exit(1);
  }
  console.log(`✅ Cookie 已读取: ${cookie.slice(0, 60)}...`);

  const browser = await chromium.launch({ headless: false, slowMo: 600 });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
  });

  // 注入 cookie
  const cookies = cookie.split(';').map(pair => {
    const [name, ...rest] = pair.trim().split('=');
    return { name: name.trim(), value: rest.join('=').trim(), domain: '.zhihu.com', path: '/' };
  }).filter(c => c.name);
  await context.addCookies(cookies);
  console.log(`🍪 注入 ${cookies.length} 个 cookie`);

  const page = await context.newPage();

  try {
    // ── Step 1: 打开首页，检查登录态 ──────────────────────
    console.log('\n[Step 1] 打开知乎首页，检查登录态...');
    await page.goto('https://www.zhihu.com/', { waitUntil: 'networkidle', timeout: 30000 });
    await shot(page, '01-homepage');

    const loginCheck = await page.$('[class*="AppHeader-profileAvatar"]');
    if (!loginCheck) {
      console.error('❌ 登录态检测失败，Cookie 可能已失效');
      // 打印页面上所有带 user/avatar/profile 的 class 帮助定位
      const candidates = await page.$$eval('*', els =>
        els.filter(e => /user|avatar|profile|login/i.test(e.className))
           .slice(0, 10)
           .map(e => ({ tag: e.tagName, class: e.className?.slice(0, 80) }))
      );
      console.log('   候选登录态元素:', JSON.stringify(candidates, null, 2));
      await browser.close();
      process.exit(1);
    }
    console.log('✅ 登录态正常');

    // ── Step 2: 点击「写文章」按钮 ───────────────────────
    console.log('\n[Step 2] 查找并点击「写文章」按钮...');
    const writeArticleSelectors = [
      'button:has-text("写文章")',
      'a:has-text("写文章")',
      '[class*="WriteArticle"]',
      '[data-za-detail-view-element_name*="写文章"]'
    ];
    let writeBtn = null;
    for (const sel of writeArticleSelectors) {
      writeBtn = await page.$(sel);
      if (writeBtn) { console.log(`✅ 找到写文章按钮: ${sel}`); break; }
    }
    if (!writeBtn) {
      console.warn('⚠️  未找到写文章按钮，打印页面所有 button/a：');
      await printElements(page, 'button', 'button');
      await printElements(page, 'a[href*="write"], a[href*="article"]', 'write links');
    }
    await shot(page, '02-homepage');

    if (writeBtn) {
      await writeBtn.click();
      await page.waitForTimeout(2000);
      // 可能在新 tab 打开
      const pages = context.pages();
      const editorPage = pages[pages.length - 1];
      if (editorPage !== page) {
        console.log('   编辑器在新 tab 打开，切换过去');
        await editorPage.waitForLoadState('networkidle');
        await runEditorFlow(editorPage);
      } else {
        await page.waitForLoadState('networkidle');
        await runEditorFlow(page);
      }
    } else {
      // 直接导航到写文章页
      console.log('   直接导航到 https://zhuanlan.zhihu.com/write');
      await page.goto('https://zhuanlan.zhihu.com/write', { waitUntil: 'networkidle', timeout: 30000 });
      await runEditorFlow(page);
    }

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
