import { initializeSettings } from './components/settings/index.js';
import { initializeLogs } from './components/logs/index.js';
import { initializeTable } from './components/table/index.js';
import { logger } from './utils/logger.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 初始化表格组件
        await initializeTable();

        // 获取DOM元素
        const settingsBtn = document.getElementById('settingsBtn');
        const settingsContainer = document.getElementById('settingsContainer');
        let isSettingsLoaded = false;
        
        // 切换设置面板
        settingsBtn.addEventListener('click', async () => {
            try {
                settingsBtn.classList.toggle('active');
                settingsContainer.classList.toggle('show');
                
                // 首次加载设置面板
                if (!isSettingsLoaded) {
                    const response = await fetch(chrome.runtime.getURL('html/settings.html'));
                    const html = await response.text();
                    settingsContainer.innerHTML = html;
                    isSettingsLoaded = true;
                    
                    // 初始化设置面板
                    await initializeSettings();
                }
            } catch (error) {
                logger.error('popup', '加载设置面板失败', error);
            }
        });

        // 初始化日志面板
        await initializeLogs();

        logger.info('popup', '插件初始化成功');
    } catch (error) {
        logger.error('popup', '插件初始化失败', error);
    }
}); 