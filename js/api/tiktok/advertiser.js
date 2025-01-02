/**
 * 广告账户相关API
 */
import { logger } from '../../utils/logger.js';

const API_BASE = 'https://business-api.tiktok.com';

/**
 * 获取广告账户详细信息
 */
export async function getAdvertiserInfo(accessToken, advertiserIds) {
    try {
        // 构建URL和查询参数
        const urlObj = new URL(`${API_BASE}/open_api/v1.3/oauth2/advertiser/get/`);
        
        // 获取应用配置
        const { tiktokAppId, tiktokAppSecret } = await chrome.storage.local.get([
            'tiktokAppId',
            'tiktokAppSecret'
        ]);

        // 添加查询参数
        urlObj.searchParams.append('app_id', tiktokAppId);
        urlObj.searchParams.append('secret', tiktokAppSecret);

        const headers = {
            'Access-Token': accessToken
        };

        logger.info('tiktok-api', '请求广告账户信息', { 
            url: urlObj.toString().replace(tiktokAppSecret, '***'),
            advertiserIds
        });

        const response = await fetch(urlObj.toString(), {
            method: 'GET',
            headers
        });

        logger.info('tiktok-api', '广告账户信息响应状态', { 
            status: response.status 
        });

        // 获取响应文本并记录
        const responseText = await response.text();
        logger.info('tiktok-api', '广告账户信息响应原文', { 
            responseText 
        });

        // 尝试解析JSON
        let data;
        try {
            data = JSON.parse(responseText.trim());
        } catch (parseError) {
            logger.error('tiktok-api', '广告账户信息JSON解析失败', { 
                responseText,
                error: parseError 
            });
            throw new Error(`广告账户信息解析失败: ${parseError.message}`);
        }

        logger.info('tiktok-api', '广告账户信息响应', {
            code: data.code,
            message: data.message,
            request_id: data.request_id
        });
        
        if (data.code !== 0) {
            throw new Error(`获取广告账户信息失败: ${data.message} (错误码: ${data.code})`);
        }

        if (!data.data || !data.data.list) {
            logger.error('tiktok-api', '广告账户信息响应格式错误', { 
                data 
            });
            throw new Error('广告账户信息响应格式错误');
        }

        // 记录获取到的广告账户列表
        const advertiserList = data.data.list.map(advertiser => ({
            advertiser_id: advertiser.advertiser_id,
            advertiser_name: `${advertiser.advertiser_name || '未命名'}（${advertiser.advertiser_id}）`,
            status: advertiser.status
        }));

        logger.info('tiktok-api', '获取到广告账户列表', {
            count: advertiserList.length,
            accounts: advertiserList.map(acc => ({
                id: acc.advertiser_id,
                name: acc.advertiser_name,
                status: acc.status
            }))
        });

        return advertiserList;
    } catch (error) {
        logger.error('tiktok-api', '获取广告账户信息失败', {
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
} 