import { logger } from '../../utils/logger.js';
import { createAdvertisement, batchCreateAdvertisements } from '../../api/tiktok/create.js';

/**
 * 创建广告按钮组件
 */
export function renderCreateButton(container) {
    const button = document.createElement('button');
    button.className = 'refresh-btn';
    button.innerHTML = '<i class="fas fa-plus"></i> 创建广告';
    button.onclick = handleCreate;
    container.appendChild(button);
}

/**
 * 处理创建广告的点击事件
 */
async function handleCreate() {
    try {
        // 1. 获取选中的记录
        const selectedRows = document.querySelectorAll('input[type="checkbox"][name^="checkbox-"]:checked');
        if (selectedRows.length === 0) {
            alert('请选择要创建的记录');
            return;
        }

        // 2. 获取配置信息
        const config = await chrome.storage.local.get([
            'tiktokAccessToken',
            'tiktokAdvertiserList',
            'tiktokTokenExpireTime',
            'tiktokSelectedAdvertiserId'
        ]);
        
        logger.info('create-ui', '获取配置信息', { config });

        // 检查token是否存在
        if (!config.tiktokAccessToken || !config.tiktokAdvertiserList) {
            alert('请先完成广告账户授权');
            return;
        }

        // 检查token是否过期
        const now = Date.now();
        if (config.tiktokTokenExpireTime && now >= config.tiktokTokenExpireTime) {
            alert('授权已过期，请重新授权');
            // 清除过期的token
            await chrome.storage.local.remove([
                'tiktokAccessToken',
                'tiktokTokenExpireTime',
                'tiktokAuthStatus'
            ]);
            return;
        }

        // 获取选中的广告账户
        const advertiserList = config.tiktokAdvertiserList;
        if (!Array.isArray(advertiserList) || advertiserList.length === 0) {
            alert('未找到可用的广告账户');
            return;
        }

        // 使用用户选择的广告账户
        const selectedAdvertiserId = config.tiktokSelectedAdvertiserId;
        if (!selectedAdvertiserId) {
            alert('请在设置中选择要使用的广告账户');
            return;
        }

        const selectedAdvertiser = advertiserList.find(advertiser => 
            advertiser.advertiser_id === selectedAdvertiserId
        );

        if (!selectedAdvertiser) {
            alert('选中的广告账户不存在或已失效，请重新选择');
            return;
        }

        // 3. 获取记录数据
        const records = [];
        for (const checkbox of selectedRows) {
            const row = checkbox.closest('tr');
            if (!row) continue;

            let recordData = null;

            // 1. 首先尝试从checkbox的data属性中获取记录数据
            try {
                if (checkbox.dataset.record) {
                    recordData = JSON.parse(checkbox.dataset.record);
                }
            } catch (error) {
                logger.error('create-ui', '解析data属性记录数据失败', { 
                    error: error.message,
                    data: checkbox.dataset.record
                });
            }

            // 2. 如果从data属性获取失败，尝试从window.tableData获取
            if (!recordData && window.tableData && Array.isArray(window.tableData)) {
                // 从checkbox的name中获取索引
                const index = parseInt(checkbox.getAttribute('name').replace('checkbox-', '')) - 1;
                if (index >= 0 && index < window.tableData.length) {
                    recordData = window.tableData[index];
                }
            }

            // 3. 验证记录数据
            if (recordData && recordData.record_id) {
                records.push(recordData);
            } else {
                logger.error('create-ui', '无法获取有效的记录数据', {
                    checkbox_name: checkbox.getAttribute('name'),
                    has_dataset: !!checkbox.dataset.record,
                    has_table_data: !!(window.tableData && Array.isArray(window.tableData))
                });
            }
        }

        if (records.length === 0) {
            alert('无法获取选中记录的数据，请刷新页面后重试');
            return;
        }

        // 记录获取到的所有记录
        logger.info('create-ui', '获取到记录数据', { 
            total: records.length,
            records: records.map(r => ({
                record_id: r.record_id,
                fields: Object.keys(r.fields || {})
            }))
        });

        // 显示进度弹窗
        const progressModal = showProgressModal(records.length);

        try {
            // 4. 格式化记录数据
            const { processRecords } = await import('../../api/tiktok/format.js');
            const formatedRecords = processRecords(records);

            // 5. 批量创建广告
            const { batchCreateAdvertisements } = await import('../../api/tiktok/create.js');
            const apiConfig = {
                Access_Token: config.tiktokAccessToken,
                advertiser_id: selectedAdvertiserId
            };

            // 获取更新记录的函数
            const { updateRecord } = await import('../../api/feishu/bitable.js');

            // 逐条创建广告并更新记录
            const results = [];
            for (let i = 0; i < formatedRecords.length; i++) {
                const record = formatedRecords[i];
                try {
                    // 更新进度条
                    updateProgress(progressModal, i + 1, formatedRecords.length);

                    // 创建广告
                    const result = await createAdvertisement(apiConfig, record);
                    results.push(result);

                    // 如果创建成功或有返回的ID，立即更新飞书记录
                    try {
                        // 记录原始数据
                        logger.info('create-ui', '准备更新记录', { 
                            record_id: record.record_id,
                            fields: record.fields,
                            result: result
                        });

                        // 准备更新的字段
                        const fields = {};
                        
                        // 系列ID
                        if (result.data.campaign_id) {
                            fields['系列ID'] = result.data.campaign_id;
                        }
                        
                        // 组ID
                        if (result.data.adgroup_id) {
                            fields['组ID'] = result.data.adgroup_id;
                        }
                        
                        // 广告ID
                        if (result.data.ad_id) {
                            fields['广告ID'] = result.data.ad_id;
                        }

                        // 记录要更新的字段
                        logger.info('create-ui', '准备更新字段', { 
                            record_id: record.record_id,
                            fields,
                            result_data: result.data
                        });
                        
                        // 只有当有字段需要更新时才调用API
                        if (Object.keys(fields).length > 0) {
                            if (!record.record_id) {
                                throw new Error('记录ID不存在');
                            }
                            // 记录即将发送的请求
                            logger.info('create-ui', '即将发送更新请求', { 
                                record_id: record.record_id,
                                fields,
                                raw_fields: record.fields
                            });
                            
                            // 更新飞书记录
                            await updateRecord(record.record_id, fields);
                            
                            logger.info('create-ui', '更新飞书记录成功', { 
                                record_id: record.record_id,
                                fields
                            });
                        } else {
                            logger.info('create-ui', '记录无需更新', { 
                                record_id: record.record_id
                            });
                        }
                    } catch (error) {
                        logger.error('create-ui', '更新飞书记录失败', { 
                            error: error.message,
                            record_id: record.record_id
                        });
                    }

                    // 更新进度弹窗
                    updateProgressModalWithResults(progressModal, results);
                } catch (error) {
                    logger.error('create-ui', '创建广告失败', { 
                        error: error.message,
                        record_id: record.record_id
                    });
                    results.push({
                        success: false,
                        error: error.message
                    });
                    // 更新进度弹窗显示错误
                    updateProgressModalWithResults(progressModal, results);
                }
            }

            // 最后一次更新进度弹窗
            updateProgressModalWithResults(progressModal, results);

            // 如果有成功的记录，刷新表格
            if (results.some(r => r.success)) {
                // 触发表格刷新
                document.dispatchEvent(new CustomEvent('refreshTable'));
            }
        } catch (error) {
            // 如果发生错误，也更新进度弹窗显示错误信息
            updateProgressModalWithResults(progressModal, [{
                success: false,
                error: error.message
            }]);
            throw error; // 继续抛出错误以便外层catch处理
        }

    } catch (error) {
        logger.error('create-ui', '创建广告失败', { error: error.message });
        if (error.message.includes('Access token is incorrect or has been revoked')) {
            alert('授权已失效，请重新授权');
            // 清除无效的token
            await chrome.storage.local.remove([
                'tiktokAccessToken',
                'tiktokTokenExpireTime',
                'tiktokAuthStatus'
            ]);
        } else {
            alert('创建广告失败: ' + error.message);
        }
    }
}

/**
 * 显示进度弹窗
 * @param {number} total - 总记录数
 * @returns {HTMLElement} 弹窗元素
 */
function showProgressModal(total) {
    // 创建遮罩层
    const modalContainer = document.createElement('div');
    modalContainer.style.position = 'fixed';
    modalContainer.style.top = '0';
    modalContainer.style.left = '0';
    modalContainer.style.width = '100%';
    modalContainer.style.height = '100%';
    modalContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    modalContainer.style.display = 'flex';
    modalContainer.style.alignItems = 'center';
    modalContainer.style.justifyContent = 'center';
    modalContainer.style.zIndex = '9999';

    // 创建弹窗内容
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-dialog';
    modalContent.style.margin = '0';
    modalContent.style.minWidth = '400px';
    modalContent.innerHTML = `
        <div class="modal-content" style="background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div class="modal-header" style="border-bottom: 1px solid #eee; padding: 15px;">
                <h5 class="modal-title" style="margin: 0; font-size: 18px;">创建广告中</h5>
            </div>
            <div class="modal-body" style="padding: 20px;">
                <div class="progress" style="height: 20px; background-color: #f5f5f5; border-radius: 4px; overflow: hidden;">
                    <div class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" style="width: 0%; height: 100%; background-color: #007bff;"></div>
                </div>
                <div class="mt-2" style="margin-top: 10px;">
                    <span class="progress-text" style="font-size: 14px;">准备创建广告...</span>
                </div>
                <div class="results-container mt-3" style="margin-top: 15px;"></div>
            </div>
        </div>
    `;

    modalContainer.appendChild(modalContent);

    // 添加关闭方法
    modalContainer.close = function() {
        if (document.body.contains(modalContainer)) {
            document.body.removeChild(modalContainer);
        }
        // 移除事件监听器
        document.removeEventListener('adCreationProgress', progressHandler);
    };

    // 添加进度事件监听器
    const progressHandler = (event) => {
        const { stage, progress } = event.detail;
        const progressBar = modalContainer.querySelector('.progress-bar');
        const progressText = modalContainer.querySelector('.progress-text');
        
        // 获取当前记录的索引（从 URL 参数或其他地方）
        const currentRecordIndex = parseInt(progressBar.style.width) / 100 * total;
        // 计算基础进度
        const baseProgress = ((currentRecordIndex - 1) / total) * 100;
        // 计算当前阶段的额外进度
        const stageProgress = (progress - 0) / 100 * (100 / total);
        // 计算总进度
        const totalProgress = baseProgress + stageProgress;
        
        progressBar.style.width = totalProgress + '%';
        progressText.textContent = `第 ${Math.ceil(currentRecordIndex)}/${total} 条记录: ${stage}中...`;
    };
    document.addEventListener('adCreationProgress', progressHandler);

    // 添加到页面
    document.body.appendChild(modalContainer);
    return modalContainer;
}

/**
 * 更新进度弹窗显示结果
 * @param {HTMLElement} modal - 弹窗元素
 * @param {Array<Object>} results - 创建结果
 */
function updateProgressModalWithResults(modal, results) {
    const successCount = results.filter(r => r.success).length;
    const failedCount = results.length - successCount;
    
    const resultsContainer = modal.querySelector('.results-container');
    const resultContent = document.createElement('div');
    resultContent.innerHTML = `
        <div class="alert ${failedCount === 0 ? 'alert-success' : 'alert-warning'}" style="padding: 15px; border-radius: 4px; margin-bottom: 10px; ${failedCount === 0 ? 'background-color: #d4edda; color: #155724;' : 'background-color: #fff3cd; color: #856404;'}">
            <h6 style="margin: 0 0 10px 0; font-size: 16px;">创建完成</h6>
            <p style="margin: 5px 0;">成功: ${successCount} 条</p>
            <p style="margin: 5px 0;">失败: ${failedCount} 条</p>
        </div>
        ${failedCount > 0 ? `
            <div class="failed-details" style="margin-top: 15px;">
                <h6 style="margin: 0 0 10px 0; font-size: 14px;">失败详情:</h6>
                <ul style="list-style: none; padding: 0; margin: 0;">
                    ${results.filter(r => !r.success).map(r => `
                        <li style="color: #dc3545; margin-bottom: 5px;">${r.error}</li>
                    `).join('')}
                </ul>
            </div>
        ` : ''}
        <div style="text-align: center; margin-top: 20px;">
            <button class="close-modal-btn" style="padding: 8px 16px; background-color: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">关闭</button>
        </div>
    `;

    // 清空原有内容
    resultsContainer.innerHTML = '';
    resultsContainer.appendChild(resultContent);

    // 添加关闭按钮事件监听器
    const closeButton = resultContent.querySelector('.close-modal-btn');
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            modal.close();
            // 如果有成功的记录或有返回的ID，刷新表格
            if (results.some(r => r.success) || results.some(r => r.data?.campaign_id || r.data?.adgroup_id || r.data?.ad_id)) {
                logger.info('create-ui', '创建完成，准备刷新表格', { 
                    total: results.length,
                    success: results.filter(r => r.success).length,
                    has_ids: results.filter(r => r.data?.campaign_id || r.data?.adgroup_id || r.data?.ad_id).length
                });

                // 等待一秒后刷新，确保飞书API更新完成
                setTimeout(() => {
                    // 触发表格刷新
                    document.dispatchEvent(new CustomEvent('refreshTable'));
                    logger.info('create-ui', '触发表格刷新事件');
                }, 1000);
            }
        });
    }
}

/**
 * 更新进度条
 * @param {HTMLElement} modal - 弹窗元素
 * @param {number} current - 当前记录索引
 * @param {number} total - 总记录数
 */
function updateProgress(modal, current, total) {
    // 每条记录的进度分为三个阶段：创建广告系列(33%)、创建广告组(33%)、创建广告(34%)
    // 计算当前记录的基础进度
    const baseProgress = ((current - 1) / total) * 100;
    // 当前记录的阶段进度会在事件监听器中更新
    
    const progressBar = modal.querySelector('.progress-bar');
    const progressText = modal.querySelector('.progress-text');
    
    progressBar.style.width = baseProgress + '%';
    progressText.textContent = `正在处理第 ${current}/${total} 条记录...`;
} 