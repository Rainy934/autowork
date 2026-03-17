# 自动发布工具

## 快速开始

1. 配置 `.env`
   - 填入 `OPENAI_API_KEY`（支持任何 OpenAI 兼容接口，改 `OPENAI_BASE_URL` 即可）

2. 安装依赖 & 启动
   ```bash
   npm install
   npx playwright install chromium  # 首次需要下载浏览器
   npm start
   ```

3. 打开管理面板：http://localhost:3000

## 使用流程

1. 在「推广配置」填入你的推广链接和产品描述
2. 在「平台配置」粘贴闲鱼 Cookie（浏览器登录闲鱼后，F12 → Network → 复制 Cookie 请求头）
3. 在「定时任务」新增任务，填写 Cron 表达式（如每天9点：`0 9 * * *`）
4. 点「立即执行」可手动测试一次

## 扩展新平台

在 `src/platforms/` 新建文件，继承 `BasePlatform` 实现 `publish` 方法，然后在 `scheduler.js` 的 `platformMap` 中注册即可。

## 注意

- 闲鱼 Cookie 有效期约7天，需定期更新
- 建议每天发布频率不超过3次，避免账号风控
