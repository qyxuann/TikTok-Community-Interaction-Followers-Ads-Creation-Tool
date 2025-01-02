/**
 * 飞书API认证相关操作
 */
import { logger } from '../../utils/logger.js';
import { handleApiError } from '../../utils/error.js';

const MODULE = 'FeishuAuth';

// 获取飞书租户访问令牌
export async function getTenantAccessToken(appId, appSecret) {
    try {
        const url = 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal';
        const data = {
            app_id: appId,
            app_secret: appSecret
        };

        // 记录请求日志
        logger.info('feishu-api', '发送获取租户访问令牌请求', {
            url,
            method: 'POST',
            data
        });

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        // 记录响应日志
        logger.info('feishu-api', '获取租户访问令牌响应', {
            status: response.status,
            result
        });

        if (result.code !== 0) {
            throw new Error(result.msg || '获取租户访问令牌失败');
        }

        return result.tenant_access_token;
    } catch (error) {
        const message = handleApiError(error, 'feishu-api');
        throw new Error(message);
    }
} 