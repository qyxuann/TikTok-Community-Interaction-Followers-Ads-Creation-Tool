/**
 * 飞书API统一入口
 */
import { getTenantAccessToken } from './auth.js';
import { verifyTableAccess } from './bitable.js';
import { logger } from '../../utils/logger.js';

// 测试飞书连接
export async function feishuConnection({ appId, appSecret, appToken, tableId, viewId }) {
    try {
        // 获取访问令牌
        logger.info('feishu-api', '开始测试飞书连接');
        const token = await getTenantAccessToken(appId, appSecret);

        // 验证多维表格访问权限
        const isConnected = await verifyTableAccess(token, appToken, tableId);

        return isConnected;
    } catch (error) {
        logger.error('feishu-api', '测试飞书连接失败', error);
        throw error;
    }
} 