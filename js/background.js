/**
 * 后台脚本
 */
import { logger } from './utils/logger.js';

// 监听扩展图标点击事件
chrome.action.onClicked.addListener((tab) => {
    // 在新标签页中打开页面
    chrome.tabs.create({
        url: chrome.runtime.getURL('html/popup.html')
    });
}); 