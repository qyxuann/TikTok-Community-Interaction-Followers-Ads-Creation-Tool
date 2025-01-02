/**
 * 日志工具类
 */

// 日志级别
const LogLevel = {
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR'
};

// 内存中保存最近的日志
let logHistory = [];
const MAX_LOG_HISTORY = 1000;

// 敏感信息处理
function maskSensitiveInfo(data) {
    if (typeof data === 'string') {
        if (data.length > 8) {
            return data.substring(0, 4) + '*'.repeat(data.length - 8) + data.substring(data.length - 4);
        }
        return '*'.repeat(data.length);
    }
    return data;
}

// 格式化日志内容
function formatLog(level, module, message, data = null) {
    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] [${level}] [${module}] ${message}`;
    
    if (data) {
        if (typeof data === 'object') {
            // 深拷贝对象以避免修改原始数据
            const maskedData = JSON.parse(JSON.stringify(data));
            // 敏感字段脱敏
            if (maskedData.app_secret) maskedData.app_secret = maskSensitiveInfo(maskedData.app_secret);
            if (maskedData.appSecret) maskedData.appSecret = maskSensitiveInfo(maskedData.appSecret);
            logMessage += `\nData: ${JSON.stringify(maskedData, null, 2)}`;
        } else {
            logMessage += `\nData: ${data}`;
        }
    }
    
    return logMessage;
}

// 添加日志到历史记录
function addToHistory(level, module, message, data) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        level,
        module,
        message,
        data: data ? JSON.parse(JSON.stringify(data)) : null
    };

    logHistory.push(logEntry);
    if (logHistory.length > MAX_LOG_HISTORY) {
        logHistory.shift();
    }

    // 如果日志面板存在，更新显示
    updateLogDisplay();
}

// 更新日志显示
function updateLogDisplay() {
    const logsContent = document.getElementById('logsContent');
    if (!logsContent) return;

    const logHtml = logHistory.map(entry => {
        const logMessage = formatLog(entry.level, entry.module, entry.message, entry.data);
        return `<div class="log-item ${entry.level.toLowerCase()}">${logMessage}</div>`;
    }).join('');

    logsContent.innerHTML = logHtml;
    logsContent.scrollTop = logsContent.scrollHeight;
}

// 清除日志
export function clearLogs() {
    logHistory = [];
    updateLogDisplay();
}

// 导出日志
export function exportLogs() {
    const logText = logHistory.map(entry => 
        formatLog(entry.level, entry.module, entry.message, entry.data)
    ).join('\n\n');

    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// 日志输出
function log(level, module, message, data = null) {
    const logMessage = formatLog(level, module, message, data);
    
    switch (level) {
        case LogLevel.DEBUG:
            console.debug(logMessage);
            break;
        case LogLevel.INFO:
            console.info(logMessage);
            break;
        case LogLevel.WARN:
            console.warn(logMessage);
            break;
        case LogLevel.ERROR:
            console.error(logMessage);
            break;
    }

    // 添加到历史记录
    addToHistory(level, module, message, data);
}

// 导出日志函数
export const logger = {
    debug: (module, message, data) => log(LogLevel.DEBUG, module, message, data),
    info: (module, message, data) => log(LogLevel.INFO, module, message, data),
    warn: (module, message, data) => log(LogLevel.WARN, module, message, data),
    error: (module, message, data) => log(LogLevel.ERROR, module, message, data)
}; 