import { logger } from '../../utils/logger.js';

const API_PATH = '/open_api/v1.3/campaign/create/';
const API_HOST = 'business-api.tiktok.com';

/**
 * 构建请求URL
 * @param {string} path - 请求路径
 * @param {string} query - 查询参数
 * @returns {string} 完整的请求URL
 */
function buildUrl(path, query = '') {
    const scheme = 'https';
    const url = new URL(`${scheme}://${API_HOST}${path}`);
    if (query) {
        url.search = query;
    }
    return url.toString();
}

/**
 * 发送POST请求
 * @param {Object} config - 配置信息
 * @param {Object} data - 请求数据
 * @returns {Promise<Object>} 响应数据
 */
async function post(config, data) {
    const url = buildUrl(API_PATH);
    const headers = {
        'Access-Token': config.Access_Token,
        'Content-Type': 'application/json'
    };

    const maxRetries = 10;
    const delay = 5000; // 5秒

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            logger.info('tiktok-campaign', '请求成功', { url, attempt });
            return result;

        } catch (error) {
            logger.error('tiktok-campaign', `第${attempt}次请求失败`, { error: error.message });
            
            if (attempt === maxRetries) {
                logger.error('tiktok-campaign', '已达到最大重试次数');
                throw new Error(`创建广告系列失败: ${error.message}`);
            }

            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

/**
 * 创建广告系列
 * @param {Object} config - 配置信息
 * @param {Object} formatedRecordInfo - 格式化后的记录信息
 * @returns {Promise<string>} 创建的广告系列ID
 */
export async function createCampaign(config, formatedRecordInfo) {
    try {
        const requestData = {
            advertiser_id: config.advertiser_id,
            budget_mode: 'BUDGET_MODE_INFINITE',
            objective_type: 'ENGAGEMENT',
            operation_status: 'DISABLE',
            campaign_name: formatedRecordInfo?.campaign?.campaign_name
        };

        logger.info('tiktok-campaign', '开始创建广告系列', { 
            campaign_name: requestData.campaign_name
        });

        const response = await post(config, requestData);

        if (!response) {
            throw new Error('请求返回为空');
        }

        const campaignId = response?.data?.campaign_id || '';
        
        if (campaignId) {
            logger.info('tiktok-campaign', '广告系列创建成功', { 
                campaign_id: campaignId,
                campaign_name: requestData.campaign_name
            });
        } else {
            logger.error('tiktok-campaign', '广告系列创建失败', { 
                error: response?.message || 'unknown error'
            });
        }

        return campaignId || `error: ${response?.message || 'unknown'}`;

    } catch (error) {
        logger.error('tiktok-campaign', '创建广告系列异常', { error: error.message });
        throw error;
    }
} 