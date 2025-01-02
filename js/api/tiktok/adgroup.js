import { logger } from '../../utils/logger.js';
import { getCurrentUTCTimeInISOFormat } from '../../utils/time.js';

const API_PATH = '/open_api/v1.3/adgroup/create/';
const API_HOST = 'business-api.tiktok.com';

/**
 * 获取出价类型
 * @param {string} bid - 出价值
 * @returns {string} 出价类型
 */
function getBidType(bid) {
    return bid === '0' ? 'BID_TYPE_NO_BID' : 'BID_TYPE_CUSTOM';
}

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
            logger.info('tiktok-adgroup', '请求成功', { url, attempt });
            return result;

        } catch (error) {
            logger.error('tiktok-adgroup', `第${attempt}次请求失败`, { error: error.message });
            
            if (attempt === maxRetries) {
                logger.error('tiktok-adgroup', '已达到最大重试次数');
                throw new Error(`创建广告组失败: ${error.message}`);
            }

            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

/**
 * 创建广告组
 * @param {Object} config - 配置信息
 * @param {string} campaignId - 广告系列ID
 * @param {Object} formatedRecordInfo - 格式化后的记录信息
 * @returns {Promise<string>} 创建的广告组ID
 */
export async function createAdgroup(config, campaignId, formatedRecordInfo) {
    try {
        // 记录输入参数
        logger.info('tiktok-adgroup', '准备创建广告组', {
            campaign_id: campaignId,
            adgroup_info: formatedRecordInfo?.adgroup
        });

        const requestData = {
            advertiser_id: config.advertiser_id,
            campaign_id: campaignId,
            adgroup_name: formatedRecordInfo?.adgroup?.adgroup_name,
            placements: ['PLACEMENT_TIKTOK'],
            comment_disabled: false,
            video_download_disabled: false,
            location_ids: formatedRecordInfo?.adgroup?.location_ids,
            gender: formatedRecordInfo?.adgroup?.gender,
            age_groups: formatedRecordInfo?.adgroup?.age_groups,
            budget_mode: 'BUDGET_MODE_DAY',
            budget: 20.00,
            schedule_type: 'SCHEDULE_FROM_NOW',
            schedule_start_time: getCurrentUTCTimeInISOFormat(),
            dayparting: formatedRecordInfo?.adgroup?.dayparting,
            optimization_goal: 'FOLLOWERS',
            bid_type: getBidType(formatedRecordInfo?.adgroup?.bid_1 || ''),
            conversion_bid_price: formatedRecordInfo?.adgroup?.bid_1,
            billing_event: 'OCPM',
            pacing: 'PACING_MODE_SMOOTH',
            operation_status: 'ENABLE'
        };

        // 记录请求数据
        logger.info('tiktok-adgroup', '广告组创建请求数据', { requestData });

        const response = await post(config, requestData);
        
        if (!response) {
            throw new Error('请求返回为空');
        }

        const adgroupId = response?.data?.adgroup_id || '';
        
        if (adgroupId) {
            logger.info('tiktok-adgroup', '广告组创建成功', { 
                adgroup_id: adgroupId,
                adgroup_name: requestData.adgroup_name
            });
        } else {
            logger.error('tiktok-adgroup', '广告组创建失败', { 
                error: response?.message || 'unknown error',
                response
            });
        }

        return adgroupId || `error: ${response?.message || 'unknown'}`;

    } catch (error) {
        logger.error('tiktok-adgroup', '创建广告组异常', { error: error.message });
        throw error;
    }
} 