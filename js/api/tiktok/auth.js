/**
 * TikTok授权相关操作
 */
import { logger } from '../../utils/logger.js';
import { getAdvertiserInfo } from './advertiser.js';

const API_BASE = 'https://business-api.tiktok.com';
const AUTH_BASE = 'https://business-api.tiktok.com/open_api/v1.3/oauth2';

/**
 * 生成随机state
 */
function generateState() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * 获取授权URL
 */
export function getAuthUrl(appId) {
    try {
        // 生成并保存state
        const state = generateState();
        chrome.storage.local.set({ tiktokAuthState: state });

        // 构建Chrome OAuth2回调地址
        const extensionId = chrome.runtime.id;
        const redirectUri = `https://${extensionId}.chromiumapp.org/oauth2`;

        // 构建授权URL
        const url = new URL(`${API_BASE}/portal/auth`);
        url.searchParams.append('app_id', appId);
        url.searchParams.append('redirect_uri', redirectUri);
        url.searchParams.append('state', state);
        url.searchParams.append('response_type', 'code');

        logger.info('tiktok-api', '生成授权URL', {
            appId,
            redirectUri,
            state
        });

        return url.toString();
    } catch (error) {
        logger.error('tiktok-api', '生成授权URL失败', error);
        throw error;
    }
}

/**
 * 使用授权码获取访问令牌
 */
export async function getAccessToken(appId, appSecret, authCode) {
    try {
        // 构建Chrome OAuth2回调地址
        const extensionId = chrome.runtime.id;
        const redirectUri = `https://${extensionId}.chromiumapp.org/oauth2`;

        logger.info('tiktok-api', '请求访问令牌', { 
            appId, 
            authCode, 
            redirectUri 
        });

        const url = `${AUTH_BASE}/access_token/`;
        const headers = {
            'Content-Type': 'application/json'
        };
        const body = {
            app_id: appId,
            secret: appSecret,
            auth_code: authCode,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri
        };

        logger.info('tiktok-api', '发送请求', { 
            url, 
            method: 'POST', 
            headers,
            body: { ...body, secret: '***' } 
        });

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });

        logger.info('tiktok-api', 'Token请求响应状态', { 
            status: response.status 
        });

        // 获取响应文本并记录
        const responseText = await response.text();
        logger.info('tiktok-api', 'Token请求响应原文', { 
            responseText 
        });

        // 尝试解析JSON
        let data;
        try {
            data = JSON.parse(responseText.trim());
        } catch (parseError) {
            logger.error('tiktok-api', 'Token响应JSON解析失败', { 
                responseText,
                error: parseError 
            });
            throw new Error(`响应解析失败: ${parseError.message}`);
        }

        logger.info('tiktok-api', 'Token请求响应', {
            code: data.code,
            message: data.message,
            request_id: data.request_id
        });

        if (data.code !== 0) {
            throw new Error(`获取访问令牌失败: ${data.message} (错误码: ${data.code})`);
        }

        return {
            accessToken: data.data.access_token,
            refreshToken: data.data.refresh_token,
            expiresIn: data.data.expires_in,
            advertiserIds: data.data.advertiser_ids || []
        };
    } catch (error) {
        logger.error('tiktok-api', '获取访问令牌失败', error);
        throw error;
    }
}

/**
 * 处理授权回调
 */
export async function handleAuthCallback(url) {
    try {
        const urlObj = new URL(url);
        
        // 检查是否包含必要参数
        if (!urlObj.searchParams.has('code') || !urlObj.searchParams.has('state')) {
            throw new Error('回调URL缺少必要参数');
        }

        // 获取并验证state
        const { tiktokAuthState } = await chrome.storage.local.get('tiktokAuthState');
        const state = urlObj.searchParams.get('state');
        
        if (state !== tiktokAuthState) {
            logger.error('tiktok-api', 'state不匹配', {
                expected: tiktokAuthState,
                received: state
            });
            throw new Error('授权验证失败');
        }

        // 获取授权码
        const code = urlObj.searchParams.get('code');
        
        // 获取应用配置
        const { tiktokAppId, tiktokAppSecret } = await chrome.storage.local.get([
            'tiktokAppId',
            'tiktokAppSecret'
        ]);

        // 使用授权码获取访问令牌
        const { accessToken, refreshToken, expiresIn, advertiserIds } = await getAccessToken(
            tiktokAppId,
            tiktokAppSecret,
            code
        );

        // 先保存授权信息
        await chrome.storage.local.set({
            tiktokAccessToken: accessToken,
            tiktokRefreshToken: refreshToken,
            tiktokTokenExpireTime: Date.now() + expiresIn * 1000,
            tiktokAdvertiserIds: advertiserIds,
            tiktokAuthStatus: '已授权'
        });

        // 尝试获取广告账户详细信息
        try {
            const advertiserList = await getAdvertiserInfo(accessToken, advertiserIds);
            // 保存广告账户信息
            await chrome.storage.local.set({
                tiktokAdvertiserList: advertiserList
            });
            return {
                success: true,
                advertiserList
            };
        } catch (advertiserError) {
            logger.error('tiktok-api', '获取广告账户信息失败，但不影响授权状态', {
                error: advertiserError.message
            });
            // 返回基本的广告账户ID列表
            return {
                success: true,
                advertiserList: advertiserIds.map(id => ({
                    advertiser_id: id,
                    advertiser_name: `广告账户(${id})`
                }))
            };
        }
    } catch (error) {
        logger.error('tiktok-api', '授权失败', {
            error: error.message,
            stack: error.stack
        });
        
        // 更新授权状态
        await chrome.storage.local.set({
            tiktokAuthStatus: '授权失败'
        });

        throw error;
    }
} 