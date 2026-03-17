/**
 * 平台发布基类
 * 所有平台继承此类并实现 publish 方法
 */
class BasePlatform {
  constructor(name) {
    this.name = name;
  }

  /**
   * @param {{ title: string, content: string, imagePaths: string[] }} article
   * @param {object} config - 平台配置
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async publish(content, config) {
    throw new Error(`${this.name} 平台未实现 publish 方法`);
  }
}

module.exports = BasePlatform;
