import { clearLogs, exportLogs } from '../../utils/logger.js';
import { logger } from '../../utils/logger.js';
import { handleError } from '../../utils/error.js';

// 初始化日志面板
export async function initializeLogs() {
    try {
        const logsBtn = document.getElementById('logsBtn');
        const logsContainer = document.getElementById('logsContainer');
        let isLogsLoaded = false;
        
        // 切换日志面板
        logsBtn.addEventListener('click', async () => {
            try {
                logsBtn.classList.toggle('active');
                logsContainer.classList.toggle('show');
                
                // 首次加载日志面板内容
                if (!isLogsLoaded) {
                    const response = await fetch(chrome.runtime.getURL('html/logs.html'));
                    const html = await response.text();
                    logsContainer.innerHTML = html;
                    isLogsLoaded = true;
                    
                    // 初始化日志面板的事件监听
                    initializeLogEvents();
                    
                    logger.info('logs', '日志面板初始化成功');
                }
            } catch (error) {
                logger.error('logs', '加载日志面板失败', error);
            }
        });
    } catch (error) {
        logger.error('logs', '日志面板初始化失败', error);
    }
}

// 初始化日志面板的事件监听
function initializeLogEvents() {
    try {
        const clearLogsBtn = document.getElementById('clearLogs');
        const exportLogsBtn = document.getElementById('exportLogs');
        
        // 清除日志
        clearLogsBtn.addEventListener('click', () => {
            if (confirm('确定要清除所有日志吗？')) {
                try {
                    clearLogs();
                    logger.info('logs', '日志已清除');
                } catch (error) {
                    logger.error('logs', '清除日志失败', error);
                }
            }
        });
        
        // 导出日志
        exportLogsBtn.addEventListener('click', () => {
            try {
                exportLogs();
                logger.info('logs', '日志导出成功');
            } catch (error) {
                logger.error('logs', '导出日志失败', error);
            }
        });
    } catch (error) {
        logger.error('logs', '初始化日志事件失败', error);
    }
} 