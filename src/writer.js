const OpenAI = require('openai');
require('dotenv').config();
const { fetchImages, translateKeywords } = require('./images');

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
});

const platformStyle = {
  xianyu:      '闲鱼风格：口语化、接地气、像朋友推荐，标题吸引眼球，结尾自然带出产品链接',
  xiaohongshu: '小红书风格：emoji丰富、种草感强、分点列举、标题带#话题标签',
  douyin:      '抖音风格：短句、节奏感强、开头抓眼球、适合配视频文案',
  juejin:      '掘金风格：技术感、数据说话、理性分析、适合程序员群体'
};

/**
 * 生成图文内容
 * @returns {{ title: string, content: string, imagePaths: string[] }}
 */
async function generateArticle(topics, promoUrl, promoDesc, platform = 'xianyu') {
  const topicText = topics.slice(0, 3).map(t => t.title).join('、');
  const style = platformStyle[platform] || platformStyle.xianyu;

  const prompt = `你是一个擅长写软文的自媒体运营。

当前热点话题：${topicText}
产品信息：${promoDesc}
推广链接：${promoUrl}
平台风格：${style}

任务：结合热点写一篇推广流量卡的软文，并给出配图搜索关键词。

严格按以下 JSON 格式输出，不要有任何多余内容：
{
  "title": "文章标题（30字以内）",
  "content": "正文内容（200-400字，结尾自然植入推广链接）",
  "imageKeywords": ["英文关键词1", "英文关键词2", "英文关键词3"]
}

imageKeywords 要求：3个英文词组，与文章场景相关，适合在图库搜索（如 mobile data、travel phone、save money）。`;

  const res = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.8,
    response_format: { type: 'json_object' }
  });

  let parsed;
  try {
    parsed = JSON.parse(res.choices[0].message.content);
  } catch {
    // 兜底：AI 没按格式输出时降级处理
    const raw = res.choices[0].message.content.trim();
    parsed = { title: raw.split('\n')[0].slice(0, 30), content: raw, imageKeywords: ['mobile data', 'smartphone', 'internet'] };
  }

  const { title, content, imageKeywords = [] } = parsed;

  // 并行获取图片
  const imagePaths = await fetchImages(imageKeywords, 3);

  return { title, content, imagePaths };
}

module.exports = { generateArticle };
