/**
 * TikTok授权相关操作
 */
import { getAuthUrl, handleAuthCallback } from '../../api/tiktok/auth.js';
import { feishuConnection } from '../../api/feishu/index.js';
import { logger } from '../../utils/logger.js';

// 更新状态样式的辅助函数
function updateStatusStyle(element, status) {
    // 移除所有可能的状态类
    element.classList.remove('status-connected', 'status-connecting', 'status-error', 'status-authorized', 'status-authorizing');
    
    // 根据状态添加对应的类
    switch (status) {
        case '已连接':
        case '已授权':
            element.classList.add(element.id.includes('feishu') ? 'status-connected' : 'status-authorized');
            break;
        case '连接中...':
        case '授权中...':
            element.classList.add(element.id.includes('feishu') ? 'status-connecting' : 'status-authorizing');
            break;
        case '连接失败':
        case '授权失败':
            element.classList.add('status-error');
            break;
        default:
            // 默认状态不添加类
            break;
    }
}

// 初始化设置面板
export async function initializeSettings() {
    try {
        // 加载保存的设置
        const settings = await chrome.storage.local.get([
            'tiktokAppId',
            'tiktokAppSecret',
            'tiktokAuthStatus',
            'tiktokAdvertiserList',
            'tiktokSelectedAdvertiserId',
            'feishuAppId',
            'feishuAppSecret',
            'feishuAppToken',
            'feishuTableId',
            'feishuViewId',
            'feishuConnectionStatus'
        ]);

        // 填充设置值
        const elements = {
            'tiktokAppId': settings.tiktokAppId || '',
            'tiktokAppSecret': settings.tiktokAppSecret || '',
            'tiktokAuthStatus': settings.tiktokAuthStatus || '未授权',
            'feishuAppId': settings.feishuAppId || '',
            'feishuAppSecret': settings.feishuAppSecret || '',
            'feishuAppToken': settings.feishuAppToken || '',
            'feishuTableId': settings.feishuTableId || '',
            'feishuViewId': settings.feishuViewId || '',
            'feishuConnectionStatus': settings.feishuConnectionStatus || '未连接'
        };

        // 更新DOM元素
        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                if (id.endsWith('Status')) {
                    element.textContent = value;
                    updateStatusStyle(element, value);
                } else {
                    element.value = value;
                }
            }
        });

        // 初始化广告账户下拉框
        const advertiserSelect = document.getElementById('tiktokAdvertiserSelect');
        if (settings.tiktokAuthStatus === '已授权' && settings.tiktokAdvertiserList) {
            advertiserSelect.disabled = false;
            advertiserSelect.innerHTML = settings.tiktokAdvertiserList.map(advertiser => 
                `<option value="${advertiser.advertiser_id}" ${advertiser.advertiser_id === settings.tiktokSelectedAdvertiserId ? 'selected' : ''}>
                    ${advertiser.advertiser_name || `广告账户(${advertiser.advertiser_id})`}
                </option>`
            ).join('');
        } else {
            advertiserSelect.disabled = true;
            advertiserSelect.innerHTML = '<option value="">请先完成TikTok授权</option>';
        }

        // 监听广告账户选择变化
        advertiserSelect.addEventListener('change', handleAdvertiserChange);

        // 监听输入变化自动保存
        document.querySelectorAll('input').forEach(input => {
            input.addEventListener('change', handleInputChange);
        });

        // 绑定按钮事件
        document.getElementById('tiktokAuthButton').addEventListener('click', handleTikTokAuth);
        document.getElementById('feishuConnectionButton').addEventListener('click', handleFeishuConnection);
        document.getElementById('exportConfig').addEventListener('click', handleExportConfig);
        document.getElementById('importConfig').addEventListener('click', () => {
            document.getElementById('configFileInput').click();
        });
        document.getElementById('configFileInput').addEventListener('change', handleImportConfig);

        // 监听来自background的消息
        chrome.runtime.onMessage.addListener((message) => {
            if (message.type === 'TIKTOK_AUTH_SUCCESS') {
                document.getElementById('tiktokAuthStatus').textContent = '已授权';
            } else if (message.type === 'TIKTOK_AUTH_FAILURE') {
                document.getElementById('tiktokAuthStatus').textContent = '授权失败';
            }
        });

        // 监听广告账户下拉框点击事件
        advertiserSelect.addEventListener('click', handleAdvertiserSelectClick);
        advertiserSelect.addEventListener('change', handleAdvertiserChange);

        logger.info('settings', '设置面板初始化完成');
    } catch (error) {
        logger.error('settings', '设置面板初始化失败', error);
        throw new Error('设置面板初始化失败');
    }
}

// 处理输入变化
async function handleInputChange(event) {
    try {
        const { id, value } = event.target;
        await chrome.storage.local.set({ [id]: value });

        // 如果是飞书配置变化，重置连接状态
        if (id.startsWith('feishu')) {
            const statusElement = document.getElementById('feishuConnectionStatus');
            statusElement.textContent = '未连接';
            updateStatusStyle(statusElement, '未连接');
            await chrome.storage.local.set({ feishuConnectionStatus: '未连接' });
        }
        // 如果是TikTok配置变化，重置授权状态
        else if (id.startsWith('tiktok')) {
            const statusElement = document.getElementById('tiktokAuthStatus');
            statusElement.textContent = '未授权';
            updateStatusStyle(statusElement, '未授权');
            await chrome.storage.local.set({ tiktokAuthStatus: '未授权' });
        }

        logger.info('settings', '设置已保存', { id, value: id.includes('Secret') ? '***' : value });
    } catch (error) {
        logger.error('settings', '保存设置失败', error);
        throw new Error('保存设置失败');
    }
}

// 处理广告账户选择变化
async function handleAdvertiserChange(event) {
    try {
        const advertiserId = event.target.value;
        await chrome.storage.local.set({ tiktokSelectedAdvertiserId: advertiserId });
        logger.info('settings', '已选择广告账户', { advertiserId });
    } catch (error) {
        logger.error('settings', '保存广告账户选择失败', error);
        alert('保存广告账户选择失败: ' + error.message);
    }
}

// 处理TikTok授权
async function handleTikTokAuth() {
    try {
        // 获取应用配置
        const { tiktokAppId } = await chrome.storage.local.get('tiktokAppId');
        
        if (!tiktokAppId) {
            throw new Error('请先配置TikTok应用ID');
        }

        // 更新状态为授权中
        const statusElement = document.getElementById('tiktokAuthStatus');
        statusElement.textContent = '授权中...';
        updateStatusStyle(statusElement, '授权中...');
        await chrome.storage.local.set({ tiktokAuthStatus: '授权中...' });

        // 生成授权URL
        const authUrl = getAuthUrl(tiktokAppId);
        
        logger.info('settings', '开始TikTok授权', { authUrl });

        // 使用chrome.identity.launchWebAuthFlow进行授权
        const responseUrl = await chrome.identity.launchWebAuthFlow({
            url: authUrl,
            interactive: true
        });

        logger.info('settings', '收到授权回调', { responseUrl });

        // 处理授权回调
        const result = await handleAuthCallback(responseUrl);
        
        if (result.success) {
            statusElement.textContent = '已授权';
            updateStatusStyle(statusElement, '已授权');

            // 更新广告账户下拉框
            const advertiserSelect = document.getElementById('tiktokAdvertiserSelect');
            if (result.advertiserList && result.advertiserList.length > 0) {
                advertiserSelect.disabled = false;
                advertiserSelect.innerHTML = result.advertiserList.map(advertiser => 
                    `<option value="${advertiser.advertiser_id}">
                        ${advertiser.advertiser_name || `广告账户(${advertiser.advertiser_id})`}
                    </option>`
                ).join('');
                // 默认选择第一个广告账户
                await chrome.storage.local.set({ 
                    tiktokSelectedAdvertiserId: result.advertiserList[0].advertiser_id
                });
            }

            logger.info('settings', 'TikTok授权成功', { 
                advertiserList: result.advertiserList 
            });
        } else {
            throw new Error('授权失败');
        }
    } catch (error) {
        logger.error('settings', 'TikTok授权失败', error);
        const statusElement = document.getElementById('tiktokAuthStatus');
        statusElement.textContent = '授权失败';
        updateStatusStyle(statusElement, '授权失败');
        await chrome.storage.local.set({ tiktokAuthStatus: '授权失败' });
        alert('TikTok授权失败: ' + error.message);
    }
}

// 处理飞书连接
async function handleFeishuConnection() {
    const statusElement = document.getElementById('feishuConnectionStatus');
    try {
        // 获取飞书配置
        const { feishuAppId, feishuAppSecret, feishuAppToken, feishuTableId, feishuViewId } = await chrome.storage.local.get([
            'feishuAppId',
            'feishuAppSecret',
            'feishuAppToken',
            'feishuTableId',
            'feishuViewId'
        ]);

        // 验证必填字段
        const missingFields = [];
        if (!feishuAppId) missingFields.push('应用ID');
        if (!feishuAppSecret) missingFields.push('应用密钥');
        if (!feishuAppToken) missingFields.push('多维表格ID');
        if (!feishuTableId) missingFields.push('数据表ID');

        if (missingFields.length > 0) {
            throw new Error('请填写以下必填信息：' + missingFields.join('、'));
        }

        // 更新状态为连接中
        statusElement.textContent = '连接中...';
        updateStatusStyle(statusElement, '连接中...');
        await chrome.storage.local.set({ feishuConnectionStatus: '连接中...' });

        // 调用飞书API进行连接验证
        try {
            const isConnected = await feishuConnection({
                appId: feishuAppId,
                appSecret: feishuAppSecret,
                appToken: feishuAppToken,
                tableId: feishuTableId,
                viewId: feishuViewId
            });

            if (!isConnected) {
                throw new Error('验证失败：无法访问指定的多维表格');
            }

            // 更新连接状态
            statusElement.textContent = '已连接';
            updateStatusStyle(statusElement, '已连接');
            await chrome.storage.local.set({ 
                feishuConnectionStatus: '已连接',
                feishuLastVerified: new Date().toISOString()
            });

            logger.info('settings', '飞书连接成功', {
                appToken: feishuAppToken,
                tableId: feishuTableId,
                viewId: feishuViewId || '未指定'
            });
        } catch (apiError) {
            // API调用失败，获取具体错误信息
            const errorMessage = apiError.response?.data?.msg || apiError.message || '未知错误';
            throw new Error('API调用失败：' + errorMessage);
        }
    } catch (error) {
        logger.error('settings', '飞书连接失败', error);
        statusElement.textContent = '连接失败';
        updateStatusStyle(statusElement, '连接失败');
        await chrome.storage.local.set({ 
            feishuConnectionStatus: '连接失败',
            feishuLastError: error.message
        });
        // 显示错误提示
        alert('飞书连接失败：' + error.message);
    }
}

// 处理配置导出
async function handleExportConfig() {
    try {
        // 获取所有配置
        const config = await chrome.storage.local.get([
            'tiktokAppId',
            'tiktokAppSecret',
            'feishuAppId',
            'feishuAppSecret',
            'feishuAppToken',
            'feishuTableId',
            'feishuViewId'
        ]);

        // 创建配置文件
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // 下载配置文件
        const a = document.createElement('a');
        a.href = url;
        a.download = 'tiktok-ad-config.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        logger.info('settings', '配置导出成功');
    } catch (error) {
        logger.error('settings', '配置导出失败', error);
        throw new Error('配置导出失败: ' + error.message);
    }
}

// 处理配置导入
async function handleImportConfig(event) {
    try {
        const file = event.target.files[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const config = JSON.parse(e.target.result);
                
                // 验证配置文件格式
                if (!config || typeof config !== 'object') {
                    throw new Error('无效的配置文件格式');
                }

                // 保存配置到storage
                await chrome.storage.local.set(config);
                
                // 更新界面显示
                const elements = {
                    'tiktokAppId': config.tiktokAppId || '',
                    'tiktokAppSecret': config.tiktokAppSecret || '',
                    'tiktokAuthStatus': '未授权',
                    'feishuAppId': config.feishuAppId || '',
                    'feishuAppSecret': config.feishuAppSecret || '',
                    'feishuAppToken': config.feishuAppToken || '',
                    'feishuTableId': config.feishuTableId || '',
                    'feishuViewId': config.feishuViewId || '',
                    'feishuConnectionStatus': '未连接'
                };

                // 更新DOM元素
                Object.entries(elements).forEach(([id, value]) => {
                    const element = document.getElementById(id);
                    if (element) {
                        if (id.endsWith('Status')) {
                            element.textContent = value;
                            updateStatusStyle(element, value);
                        } else {
                            element.value = value;
                            // 触发change事件以确保更新storage
                            element.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    }
                });

                // 更新状态
                await chrome.storage.local.set({
                    tiktokAuthStatus: '未授权',
                    feishuConnectionStatus: '未连接'
                });

                logger.info('settings', '配置导入成功');
                alert('配置导入成功！');
            } catch (error) {
                logger.error('settings', '配置导入失败', error);
                alert('配置导入失败: ' + error.message);
            }
        };

        reader.onerror = () => {
            logger.error('settings', '读取配置文件失败');
            alert('读取配置文件失败');
        };

        reader.readAsText(file);

        // 清除文件选择，以便可以重复导入同一个文件
        event.target.value = '';
    } catch (error) {
        logger.error('settings', '配置导入失败', error);
        alert('配置导入失败: ' + error.message);
    }
}

// 处理广告账户下拉框点击事件
async function handleAdvertiserSelectClick() {
    try {
        // 检查是否已授权
        const { tiktokAuthStatus, tiktokAccessToken, tiktokAdvertiserIds } = await chrome.storage.local.get([
            'tiktokAuthStatus',
            'tiktokAccessToken',
            'tiktokAdvertiserIds'
        ]);

        if (tiktokAuthStatus !== '已授权' || !tiktokAccessToken || !tiktokAdvertiserIds) {
            return;
        }

        // 获取最新的广告账户列表
        const { getAdvertiserInfo } = await import('../../api/tiktok/advertiser.js');
        const advertiserList = await getAdvertiserInfo(tiktokAccessToken, tiktokAdvertiserIds);

        // 更新下拉框选项
        const advertiserSelect = document.getElementById('tiktokAdvertiserSelect');
        const currentValue = advertiserSelect.value; // 保存当前选中值

        advertiserSelect.innerHTML = advertiserList.map(advertiser => 
            `<option value="${advertiser.advertiser_id}" ${advertiser.advertiser_id === currentValue ? 'selected' : ''}>
                ${advertiser.advertiser_name || `广告账户(${advertiser.advertiser_id})`}
            </option>`
        ).join('');

        // 保存最新的广告账户列表
        await chrome.storage.local.set({ tiktokAdvertiserList: advertiserList });

        logger.info('settings', '广告账户列表已更新', { 
            count: advertiserList.length,
            accounts: advertiserList.map(acc => ({
                id: acc.advertiser_id,
                name: acc.advertiser_name
            }))
        });
    } catch (error) {
        logger.error('settings', '获取广告账户列表失败', error);
        alert('获取广告账户列表失败: ' + error.message);
    }
} 