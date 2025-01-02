import { logger } from '../../utils/logger.js';
import { createCampaign } from './campaign.js';
import { createAdgroup } from './adgroup.js';
import { createAd } from './ad.js';
import { getCurrentCampaignId, getCurrentAdgroupId } from './format.js';

/**
 * 创建广告流程
 * @param {Object} config - 配置信息
 * @param {Object} formatedRecordInfo - 格式化后的记录信息
 * @returns {Promise<Object>} 创建结果
 */
export async function createAdvertisement(config, formatedRecordInfo) {
    try {
        // 1. 获取当前campaign_id
        const currentCampaignId = getCurrentCampaignId(formatedRecordInfo);
        
        // 2. 如果没有campaign_id，创建新的campaign
        let campaignId = currentCampaignId;
        let campaignError = null;
        if (!currentCampaignId) {
            logger.info('tiktok-create', '开始创建广告系列');
            try {
                // 更新进度为33%
                document.dispatchEvent(new CustomEvent('adCreationProgress', { 
                    detail: { stage: '创建广告系列', progress: 33 } 
                }));

                campaignId = await createCampaign(config, formatedRecordInfo);
                if (campaignId.startsWith('error:')) {
                    campaignError = campaignId.replace('error:', '');
                } else {
                    // 保存campaign相关信息，用于后续复用
                    window.glv = window.glv || {};
                    window.glv.previous_campaign_id = campaignId;
                    window.glv.previous_campaign_sequence = formatedRecordInfo?.campaign?.campaign_sequence;
                }
            } catch (error) {
                campaignError = error.message;
                campaignId = `error: ${error.message}`;
            }
        }

        // 3. 获取当前adgroup_id
        const currentAdgroupId = getCurrentAdgroupId(campaignId, formatedRecordInfo);
        
        // 4. 如果没有adgroup_id，创建新的adgroup
        let adgroupId = currentAdgroupId;
        let adgroupError = null;
        if (!currentAdgroupId) {
            logger.info('tiktok-create', '开始创建广告组');
            try {
                // 更新进度为66%
                document.dispatchEvent(new CustomEvent('adCreationProgress', { 
                    detail: { stage: '创建广告组', progress: 66 } 
                }));

                // 只有在campaign创建成功时才创建adgroup
                if (!campaignError) {
                    adgroupId = await createAdgroup(config, campaignId, formatedRecordInfo);
                    if (adgroupId.startsWith('error:')) {
                        adgroupError = adgroupId.replace('error:', '');
                    } else {
                        // 保存adgroup相关信息，用于后续复用
                        window.glv = window.glv || {};
                        window.glv.previous_adgroup_id = adgroupId;
                        window.glv.previous_adgroup_sequence = formatedRecordInfo?.adgroup?.adgroup_sequence;
                    }
                } else {
                    adgroupError = '由于广告系列创建失败，跳过广告组创建';
                    adgroupId = `error: ${adgroupError}`;
                }
            } catch (error) {
                adgroupError = error.message;
                adgroupId = `error: ${error.message}`;
            }
        }

        // 5. 创建广告
        let adId;
        let adError = null;
        try {
            logger.info('tiktok-create', '开始创建广告');
            // 更新进度为100%
            document.dispatchEvent(new CustomEvent('adCreationProgress', { 
                detail: { stage: '创建广告', progress: 100 } 
            }));

            // 只有在campaign和adgroup都创建成功时才创建ad
            if (!campaignError && !adgroupError) {
                adId = await createAd(config, formatedRecordInfo, adgroupId);
                if (adId.startsWith('error:')) {
                    adError = adId.replace('error:', '');
                }
            } else {
                adError = '由于前序步骤失败，跳过广告创建';
                adId = `error: ${adError}`;
            }
        } catch (error) {
            adError = error.message;
            adId = `error: ${error.message}`;
        }

        // 6. 返回创建结果
        const result = {
            success: !campaignError && !adgroupError && !adError,
            data: {
                campaign_id: campaignError ? `error: ${campaignError}` : campaignId,
                adgroup_id: adgroupError ? `error: ${adgroupError}` : adgroupId,
                ad_id: adError ? `error: ${adError}` : adId
            },
            error: campaignError || adgroupError || adError || null
        };

        logger.info('tiktok-create', '创建广告完成', result);
        return result;

    } catch (error) {
        logger.error('tiktok-create', '创建广告异常', { error: error.message });
        return {
            success: false,
            data: {
                campaign_id: `error: ${error.message}`,
                adgroup_id: `error: ${error.message}`,
                ad_id: `error: ${error.message}`
            },
            error: error.message
        };
    }
}

/**
 * 批量创建广告
 * @param {Object} config - 配置信息
 * @param {Array<Object>} formatedRecords - 格式化后的记录列表
 * @returns {Promise<Array<Object>>} 创建结果列表
 */
export async function batchCreateAdvertisements(config, formatedRecords) {
    try {
        logger.info('tiktok-create', '开始批量创建广告', { 
            total: formatedRecords.length 
        });

        // 初始化全局变量
        window.glv = window.glv || {};
        window.glv.previous_campaign_id = '';
        window.glv.previous_adgroup_id = '';
        window.glv.previous_campaign_sequence = '';
        window.glv.previous_adgroup_sequence = '';

        const results = [];
        for (const record of formatedRecords) {
            const result = await createAdvertisement(config, record);
            results.push(result);

            // 如果创建失败，添加更多的上下文信息
            if (!result.success) {
                logger.error('tiktok-create', '批量创建中的单条记录失败', {
                    error: result.error,
                    record_info: {
                        campaign_name: record?.campaign?.campaign_name,
                        adgroup_name: record?.adgroup?.adgroup_name,
                        ad_name: record?.ad?.ad_name
                    }
                });
            }
        }

        const successCount = results.filter(r => r.success).length;
        logger.info('tiktok-create', '批量创建广告完成', { 
            total: formatedRecords.length,
            success: successCount,
            failed: formatedRecords.length - successCount
        });

        return results;

    } catch (error) {
        logger.error('tiktok-create', '批量创建广告异常', { error: error.message });
        throw error;
    }
} 