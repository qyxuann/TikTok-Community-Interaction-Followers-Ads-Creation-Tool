import { logger } from '../../utils/logger.js';

const API_PATH = '/open_api/v1.3/ad/create/';
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
            logger.info('tiktok-ad', '请求成功', { url, attempt });
            return result;

        } catch (error) {
            logger.error('tiktok-ad', `第${attempt}次请求失败`, { error: error.message });
            
            if (attempt === maxRetries) {
                logger.error('tiktok-ad', '已达到最大重试次数');
                throw new Error(`创建广告失败: ${error.message}`);
            }

            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

/**
 * 创建广告
 * @param {Object} config - 配置信息
 * @param {Object} formatedRecordInfo - 格式化后的记录信息
 * @param {string} adgroupId - 广告组ID
 * @returns {Promise<string>} 创建的广告ID
 */
export async function createAd(config, formatedRecordInfo, adgroupId) {
    try {
        const requestData = {
            advertiser_id: config.advertiser_id,
            adgroup_id: adgroupId,
            creatives: [
                {
                    ad_name: formatedRecordInfo?.ad?.ad_name || '',
                    identity_type: 'BC_AUTH_TT',
                    identity_id: formatedRecordInfo?.ad?.identity_id || '',
                    identity_authorized_bc_id: '7049325583804661762',
                    dynamic_destination: 'UNSET',
                    ad_format: 'SINGLE_VIDEO',
                    tiktok_item_id: formatedRecordInfo?.ad?.tiktok_item_id || '',
                    creative_authorized: false
                }
            ]
        };

        // 记录请求数据
        logger.info('tiktok-ad', '广告创建请求数据', { requestData });

        const response = await post(config, requestData);
        
        if (!response) {
            throw new Error('请求返回为空');
        }

        const adIds = response?.data?.ad_ids || [];
        const adId = adIds[0] || '';
        
        if (adId) {
            logger.info('tiktok-ad', '广告创建成功', { 
                ad_id: adId,
                ad_name: requestData.creatives[0].ad_name
            });
        } else {
            logger.error('tiktok-ad', '广告创建失败', { 
                error: response?.message || 'unknown error',
                response
            });
        }

        return adId || `error: ${response?.message || 'unknown'}`;

    } catch (error) {
        logger.error('tiktok-ad', '创建广告异常', { error: error.message });
        throw error;
    }
} 