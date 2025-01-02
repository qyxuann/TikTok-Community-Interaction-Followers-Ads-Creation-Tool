/**
 * 获取当前UTC时间的ISO格式字符串
 * 先获取北京时间，然后转换为UTC时间
 * @returns {string} ISO 8601格式的UTC时间字符串
 */
export function getCurrentUTCTimeInISOFormat() {
    // 获取当前北京时间
    const beijingOffset = 8 * 60; // 北京时间偏移分钟数
    const now = new Date();
    
    // 获取当前时区的偏移分钟数
    const localOffset = now.getTimezoneOffset();
    
    // 计算北京时间
    const beijingTime = new Date(now.getTime() + (localOffset + beijingOffset) * 60000);
    
    // 转换为UTC时间
    const utcTime = new Date(beijingTime.getTime() - beijingOffset * 60000);
    
    // 格式化为ISO 8601格式
    return utcTime.toISOString().split('.')[0] + 'Z';
}

/**
 * 示例使用:
 * const utcTimeStr = getCurrentUTCTimeInISOFormat();
 * console.log(utcTimeStr); // 输出格式: "2024-01-20T08:30:00Z"
 */ 