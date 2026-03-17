const { chromium } = require('playwright');
const BasePlatform = require('./base');

class ZhihuPlatform extends BasePlatform {
  constructor() {
    super('zhihu');
  }

  /**
   * 知乎发布回答/文章
   * 策略：发布为「想法」（知乎 Moment），适合短软文
   * @param {{ title: string, content: string, imagePaths: string[] }} article
   * @param {object} config
   */
  async publish(article, config) {
    const cookie = config?.cookie || process.env.ZHIHU_COOKIE;
    if (!cookie) return { success: false, message: '知乎 cookie 未配置' };

    const { title, content, imagePaths = [] } = article;

    let browser;
    try {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
      });
      await context.addCookies(this._parseCookies(cookie, '.zhihu.com'));

      const page = await context.newPage();

      // ── 检查登录态 ────────────────────────────────────────
      await page.goto('https://www.zhihu.com/', { waitUntil: 'networkidle', timeout: 30000 });
      const isLogin = await page.$('[class*="AppHeader-profileAvatar"]');
      if (!isLogin) return { success: false, message: '知乎 Cookie 已失效，请重新获取' };

      // ── 点击「写文章」，可能在新 tab 打开 ────────────────
      const writeBtn = await page.$('button:has-text("写文章"), a:has-text("写文章"), [class*="WriteArticle"]');
      if (writeBtn) {
        await writeBtn.click();
        await page.waitForTimeout(2000);
      } else {
        await page.goto('https://zhuanlan.zhihu.com/write', { waitUntil: 'networkidle', timeout: 30000 });
      }

      // 切换到最新 tab（写文章可能新开 tab）
      const pages = context.pages();
      const editorPage = pages[pages.length - 1];
      if (editorPage !== page) await editorPage.waitForLoadState('networkidle');
      const ep = editorPage;

      // ── 填写标题 ──────────────────────────────────────────
      const titleEl = await ep.$('[placeholder*="请输入标题"], [placeholder*="标题"], .WriteIndex-titleInput');
      if (titleEl) {
        await titleEl.click();
        await titleEl.fill(title.slice(0, 100));
      }

      // ── 填写正文 ──────────────────────────────────────────
      const editorEl = await ep.$('[placeholder*="请输入正文"], [placeholder*="正文"], .DraftEditor-editorContainer, [contenteditable="true"]');
      if (editorEl) {
        await editorEl.click();
        await ep.waitForTimeout(300);
        await ep.keyboard.type(content, { delay: 15 });
      }

      // ── 上传图片 ──────────────────────────────────────────
      if (imagePaths.length > 0) {
        const fileInput = await ep.$('input[type="file"]');
        if (fileInput) {
          await fileInput.setInputFiles(imagePaths.slice(0, 9));
          await ep.waitForTimeout(3000);
        }
      }

      // ── 点击发布 ──────────────────────────────────────────
      // 精确匹配 <button type="button">发布</button>，排除「发布设置」等按钮
      const publishBtn = await ep.$('button[type="button"]:has-text("发布"):not(:has-text("设置")):not(:has-text("文章"))');
      if (!publishBtn) return { success: false, message: '未找到发布按钮' };

      await publishBtn.click();      await ep.waitForTimeout(3000);

      return { success: true, message: `知乎文章发布成功，含 ${imagePaths.length} 张图片` };
    } catch (e) {
      return { success: false, message: `发布失败: ${e.message}` };
    } finally {
      if (browser) await browser.close();
    }
  }

  _parseCookies(cookieStr, domain = '.zhihu.com') {
    return cookieStr.split(';').map(pair => {
      const [name, ...rest] = pair.trim().split('=');
      return { name: name.trim(), value: rest.join('=').trim(), domain, path: '/' };
    }).filter(c => c.name);
  }
}

module.exports = ZhihuPlatform;
