const axios = require('axios');
const fs = require('fs');
const path = require('path');
const https = require('https');

const CACHE_DIR = path.join(__dirname, '../data/images');
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

/**
 * 用 Unsplash 搜索图片，返回本地缓存路径列表
 * @param {string[]} keywords - 英文关键词数组
 * @param {number} count - 需要几张
 */
async function fetchImages(keywords, count = 3) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key || key === 'your_unsplash_access_key_here') {
    console.warn('[images] 未配置 UNSPLASH_ACCESS_KEY，跳过图片获取');
    return [];
  }

  const query = keywords.join(' ');
  try {
    const res = await axios.get('https://api.unsplash.com/search/photos', {
      params: { query, per_page: count, orientation: 'landscape' },
      headers: { Authorization: `Client-ID ${key}` },
      timeout: 10000
    });

    const photos = res.data?.results || [];
    const localPaths = [];

    for (const photo of photos.slice(0, count)) {
      const url = photo.urls.regular;
      const filePath = path.join(CACHE_DIR, `${photo.id}.jpg`);
      // 已缓存则直接用
      if (!fs.existsSync(filePath)) {
        await downloadFile(url, filePath);
      }
      localPaths.push(filePath);
    }

    return localPaths;
  } catch (e) {
    console.error('[images] 获取图片失败:', e.message);
    return [];
  }
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, res => {
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', err => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

/**
 * 将 AI 返回的中文关键词翻译成英文（简单映射 + 透传）
 * 也可以直接让 AI 输出英文关键词，这里做个兜底
 */
function translateKeywords(cnKeywords) {
  const map = {
    '流量卡': 'sim card mobile data',
    '手机': 'smartphone',
    '网络': 'internet network',
    '省钱': 'save money',
    '优惠': 'discount deal',
    '旅行': 'travel',
    '出行': 'commute travel',
    '学生': 'student',
    '上网': 'internet browsing',
    '5G': '5G network'
  };
  return cnKeywords.map(k => map[k] || k).join(' ');
}

module.exports = { fetchImages, translateKeywords };
