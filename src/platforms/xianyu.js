const { chromium } = require('playwright');
const path = require('path');
const BasePlatform = require('./base');

class XianyuPlatform extends BasePlatform {
  constructor() {
    super('xianyu');
  }

  /**
   * @param {{ title: string, content: string, imagePaths: string[] }} article
   * @param {object} config
   */
  async publish(article, config) {
    const cookie = config?.cookie || process.env.XIANYU_COOKIE;
    if (!cookie) return { success: false, message: '闲鱼 cookie 未配置' };

    const { title, content, imagePaths = [] } = article;

    let browser;
    try {
      browser = await chromium.launch({ headless: false });
      const context = await browser.newContext();
      await context.addCookies(this._parseCookies(cookie, '.goofish.com'));

      const page = await context.newPage();

      // 打开闲鱼首页检查登录态
      await page.goto('https://www.goofish.com/', { waitUntil: 'networkidle', timeout: 30000 });

      // 检查页面是否存在 user-order-container（登录后才有）
      const isLogin = await page.$('[class*="user-order-container"]');
      if (!isLogin) return { success: false, message: 'Cookie 已失效，请重新获取' };

      // 打开发布页
      await page.goto('https://www.goofish.com/publish', { waitUntil: 'networkidle', timeout: 30000 });

      // ── 上传图片 ──────────────────────────────────────────
      if (imagePaths.length > 0) {
        // 闲鱼图片上传 input（隐藏的 file input）
        const fileInputSelector = 'input[type="file"][accept*="image"], input[type="file"]';
        const fileInput = await page.$(fileInputSelector);
        if (fileInput) {
          await fileInput.setInputFiles(imagePaths.slice(0, 9)); // 最多9张
          // 等待图片上传完成（等缩略图出现）
          await page.waitForSelector('[class*="imgItem"], [class*="upload-list"] img', {
            timeout: 20000
          }).catch(() => console.warn('[xianyu] 图片上传缩略图未检测到，继续'));
        }
      }

      // ── 填写标题 ──────────────────────────────────────────
      const titleSelector = 'input[name="title"], .publish-title input, [placeholder*="标题"]';
      const titleEl = await page.$(titleSelector);
      if (titleEl) await page.fill(titleSelector, title.slice(0, 30));

      // ── 填写描述 ──────────────────────────────────────────
      const descSelector = 'textarea[name="desc"], .publish-desc textarea, [placeholder*="描述"]';
      await page.waitForSelector(descSelector, { timeout: 10000 });
      await page.fill(descSelector, content);

      // ── 提交 ─────────────────────────────────────────────
      const submitBtn = await page.$('button[type="submit"], .publish-submit, [class*="submit"]');
      if (submitBtn) {
        await submitBtn.click();
        await page.waitForTimeout(3000);
      }

      return { success: true, message: `闲鱼发布成功，含 ${imagePaths.length} 张图片` };
    } catch (e) {
      return { success: false, message: `发布失败: ${e.message}` };
    } finally {
      if (browser) await browser.close();
    }
  }

  _parseCookies(cookieStr, domain = '.goofish.com') {
    return cookieStr.split(';').map(pair => {
      const [name, ...rest] = pair.trim().split('=');
      return { name: name.trim(), value: rest.join('=').trim(), domain, path: '/' };
    }).filter(c => c.name);
  }
}

module.exports = XianyuPlatform;
