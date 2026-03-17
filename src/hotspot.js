const axios = require('axios');
const cheerio = require('cheerio');

/**
 * 从微博热搜抓取热点
 */
async function fetchWeiboHot() {
  try {
    const res = await axios.get('https://weibo.com/ajax/side/hotSearch', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      timeout: 8000
    });
    const list = res.data?.data?.realtime || [];
    return list.slice(0, 10).map(item => ({
      title: item.note || item.word,
      hot: item.num,
      source: 'weibo'
    }));
  } catch (e) {
    console.error('[hotspot] 微博热搜失败:', e.message);
    return [];
  }
}

/**
 * 从百度热搜抓取热点
 */
async function fetchBaiduHot() {
  try {
    const res = await axios.get('https://top.baidu.com/board?tab=realtime', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      timeout: 8000
    });
    const $ = cheerio.load(res.data);
    const items = [];
    $('.c-single-text-ellipsis').each((i, el) => {
      if (i < 10) items.push({ title: $(el).text().trim(), source: 'baidu' });
    });
    return items;
  } catch (e) {
    console.error('[hotspot] 百度热搜失败:', e.message);
    return [];
  }
}

/**
 * 聚合热点，去重后返回前10条
 */
async function getHotTopics() {
  const [weibo, baidu] = await Promise.allSettled([fetchWeiboHot(), fetchBaiduHot()]);
  const all = [
    ...(weibo.status === 'fulfilled' ? weibo.value : []),
    ...(baidu.status === 'fulfilled' ? baidu.value : [])
  ];
  // 简单去重
  const seen = new Set();
  const unique = all.filter(item => {
    if (seen.has(item.title)) return false;
    seen.add(item.title);
    return true;
  });
  return unique.slice(0, 10);
}

module.exports = { getHotTopics };
