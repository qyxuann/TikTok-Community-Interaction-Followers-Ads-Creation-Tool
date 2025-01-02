/**
 * TikTok 广告数据格式化
 */
import { logger } from '../../utils/logger.js';

// 数据格式化主函数
export function formatRecordInfo(data) {
    const campaign = {
        campaign_sequence: data.fields?.['系列序号'] || '',
        campaign_id: data.fields?.['系列ID'] || '',
        campaign_name: data.fields?.['系列名称']?.[0]?.text || ''
    };

    const adgroup = {
        adgroup_sequence: data.fields?.['组序号'] || '',
        adgroup_id: data.fields?.['组ID'] || '',
        adgroup_name: data.fields?.['组名称']?.[0]?.text || '',
        location_ids: getLocationIds(data.fields?.['国家']?.[0]?.text || ''),
        age_groups: getAgeGroups(data.fields?.['年龄']?.[0]?.text || ''),
        gender: getGender(data.fields?.['性别']?.[0]?.text || ''),
        dayparting: getDayparting(data.fields?.['投放时段']?.[0]?.text || '全天'),
        bid_1: data.fields?.['出价'] || ''
    };

    const ad = {
        ad_sequence: data.fields?.['广告序号'] || '',
        ad_id: data.fields?.['广告ID'] || '',
        ad_name: data.fields?.['广告名称']?.[0]?.text || '',
        identity_id: data.fields?.['identity_id']?.[0]?.text || '',
        tiktok_item_id: data.fields?.['tiktok_item_id']?.[0]?.text || ''
    };

    return { 
        campaign, 
        adgroup, 
        ad,
        record_id: data.record_id,
        fields: data.fields
    };
}

// 获取地区ID
function getLocationIds(country) {
    if (country === 'CA') {
        return ['6251999'];
    } else if (country === 'US&CA') {
        return ['6252001', '6251999'];
    } else {
        return ['6252001'];
    }
}

// 获取年龄组
function getAgeGroups(ageStr) {
    const ageGroupMap = {
        '1855': ['AGE_18_24', 'AGE_25_34', 'AGE_35_44', 'AGE_45_54', 'AGE_55_100'],
        '1854': ['AGE_18_24', 'AGE_25_34', 'AGE_35_44', 'AGE_45_54'],
        '1844': ['AGE_18_24', 'AGE_25_34', 'AGE_35_44'],
        '1834': ['AGE_18_24', 'AGE_25_34'],
        '1824': ['AGE_18_24'],
        '2555': ['AGE_25_34', 'AGE_35_44', 'AGE_45_54', 'AGE_55_100'],
        '2554': ['AGE_25_34', 'AGE_35_44', 'AGE_45_54'],
        '2544': ['AGE_25_34', 'AGE_35_44'],
        '2534': ['AGE_25_34'],
        '3555': ['AGE_35_44', 'AGE_45_54', 'AGE_55_100'],
        '3554': ['AGE_35_44', 'AGE_45_54'],
        '3544': ['AGE_35_44'],
        '4555': ['AGE_45_54', 'AGE_55_100'],
        '4554': ['AGE_45_54'],
        '5500': ['AGE_55_100']
    };
    return ageGroupMap[ageStr] || [];
}

// 获取性别
function getGender(genderStr) {
    if (genderStr === '不限') {
        return 'GENDER_UNLIMITED';
    } else if (genderStr === '男性') {
        return 'GENDER_MALE';
    } else if (genderStr === '女性') {
        return 'GENDER_FEMALE';
    }
    return 'GENDER_UNLIMITED';
}

// 获取投放时段
function getDayparting(daypartingStr) {
    if (daypartingStr === '全天') {
        return '1'.repeat(336);
    } else {
        const startHour = parseInt(daypartingStr.substring(0, 2));
        const endHour = parseInt(daypartingStr.substring(2));

        // Create a list of 48 '0's for one day
        const dayBinary = new Array(48).fill('0');

        // Convert start_hour and end_hour to half-hour slots
        const startSlot = startHour * 2;
        const endSlot = endHour * 2;

        // Set the corresponding slots to '1'
        for (let i = startSlot; i < endSlot; i++) {
            dayBinary[i] = '1';
        }

        // Join the list to form the binary string for one day
        const dayBinaryStr = dayBinary.join('');

        // Repeat for 7 days to get the weekly binary string
        return dayBinaryStr.repeat(7);
    }
}

// 批量处理记录
export function processRecords(records) {
    return records.map(record => formatRecordInfo(record));
}

// 获取当前系列ID
export function getCurrentCampaignId(formatedRecordInfo) {
    const campaignInfo = formatedRecordInfo?.campaign;
    
    // 1. 如果记录中已有campaign_id,说明是已存在的广告系列
    if (campaignInfo?.campaign_id) {
        return campaignInfo.campaign_id;
    }
    
    // 2. 如果没有campaign_id,但sequence相同,说明是同一个待创建的广告系列
    if (campaignInfo?.campaign_sequence && 
        campaignInfo.campaign_sequence === window.glv?.previous_campaign_sequence) {
        return window.glv?.previous_campaign_id || '';
    }
    
    // 3. 其他情况说明是新的广告系列
    return '';
}

// 获取当前广告组ID
export function getCurrentAdgroupId(currentCampaignId, formatedRecordInfo) {
    const adgroupInfo = formatedRecordInfo?.adgroup;
    
    // 1. 如果记录中已有adgroup_id,说明是已存在的广告组
    if (adgroupInfo?.adgroup_id) {
        return adgroupInfo.adgroup_id;
    }
    
    // 2. 如果广告系列ID不同,说明是新的广告系列下的广告组
    if (currentCampaignId !== window.glv?.previous_campaign_id) {
        return '';
    }
    
    // 3. 如果广告系列ID相同且sequence相同,说明是同一个待创建的广告组
    if (adgroupInfo?.adgroup_sequence && 
        adgroupInfo.adgroup_sequence === window.glv?.previous_adgroup_sequence) {
        return window.glv?.previous_adgroup_id || '';
    }
    
    // 4. 其他情况说明是新的广告组
    return '';
} 