/**
 * 多维表格数据展示组件
 */
import { logger } from '../../utils/logger.js';
import { getTableData } from '../../api/feishu/bitable.js';
import { renderCreateButton } from '../create/index.js';

// 缓存配置
const CACHE_CONFIG = {
    expireTime: 5 * 60000, // 5分钟
    key: 'tableDataCache'
};

// 分页配置
const PAGE_CONFIG = {
    key: 'tablePageConfig',
    size: 20, // 每页显示的记录数
    maxPageCount: 100 // 最大页数限制
};

// 字段类型映射
const FIELD_TYPE_MAP = {
    1: '单行文本',
    2: '多行文本',
    3: '数字',
    4: '单选',
    5: '多选',
    6: '日期',
    7: '复选框',
    8: '人员',
    9: '链接',
    10: '附件',
    11: '电话号码',
    12: '邮箱',
    13: '地理位置',
    14: '自动编号',
    15: '创建时间',
    16: '修改时间',
    17: '创建人',
    18: '修改人',
    19: '公式',
    20: '关联记录',
    21: '查找引用',
    22: '货币',
    23: '百分比',
    24: '进度',
    25: '评分',
    26: '条码',
    27: '二维码',
    28: '单向关联',
    29: '双向关联',
    30: '分组',
    31: '按钮'
};

// 获取字段类型的友好显示
function getFieldTypeText(type) {
    return FIELD_TYPE_MAP[type] || `未知类型(${type})`;
}

// 初始化表格组件
export async function initializeTable() {
    try {
        // 获取容器元素
        const contentElement = document.getElementById('content');
        if (!contentElement) {
            throw new Error('找不到内容容器元素');
        }

        // 创建表格结构
        contentElement.innerHTML = `
            <div class="table-container">
                <div class="table-header d-flex justify-content-between align-items-center">
                    <div class="d-flex align-items-center">
                        <h2 class="me-3">数据列表</h2>
                    </div>
                    <div class="button-group">
                        <div id="createButtonContainer"></div>
                        <button id="refreshBtn" class="refresh-btn">
                            <i class="fas fa-sync"></i>
                            刷新
                        </button>
                    </div>
                </div>
                <div class="table-scroll-container">
                    <div id="tableContent" class="table-content">
                        <div class="loading">加载中...</div>
                    </div>
                </div>
                <div id="paginationContainer" class="pagination-container"></div>
            </div>
        `;

        // 渲染创建按钮
        const createButtonContainer = document.getElementById('createButtonContainer');
        renderCreateButton(createButtonContainer);

        // 绑定刷新按钮事件
        const refreshBtn = document.getElementById('refreshBtn');
        refreshBtn.addEventListener('click', handleRefresh);

        // 添加表格刷新事件监听器
        document.addEventListener('refreshTable', handleRefresh);

        // 初始加载数据
        await loadTableData();

    } catch (error) {
        logger.error('table-ui', '初始化表格失败', { error: error.message });
        throw error;
    }
}

// 加载表格数据
async function loadTableData(forceRefresh = false, pageToken = '', currentPage = 1) {
    try {
        const tableContent = document.getElementById('tableContent');
        tableContent.innerHTML = '<div class="loading">加载中...</div>';

        // 获取数据
        const data = await getTableDataWithCache(forceRefresh, pageToken);
        
        // 渲染数据
        await renderTableData(data, currentPage);

        // 保存分页状态
        await savePageState(data, currentPage);

        logger.info('table', '数据加载成功', { 
            recordCount: data.records.length,
            currentPage,
            hasMore: data.has_more
        });
    } catch (error) {
        logger.error('table', '数据加载失败', error);
        const tableContent = document.getElementById('tableContent');
        tableContent.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-circle"></i>
                数据加载失败: ${error.message}
            </div>
        `;
    }
}

// 带缓存的数据获取
async function getTableDataWithCache(forceRefresh = false, pageToken = '') {
    try {
        // 获取配置
        const config = await chrome.storage.local.get([
            'feishuAppToken',
            'feishuTableId',
            'feishuViewId'
        ]);

        // 验证配置
        if (!config.feishuAppToken || !config.feishuTableId) {
            throw new Error('请先完成飞书配置并进行连接验证');
        }

        // 如果是翻页或强制刷新，跳过缓存
        if (!forceRefresh && !pageToken) {
            // 尝试获取缓存
            const cache = await chrome.storage.local.get(CACHE_CONFIG.key);
            const now = Date.now();
            
            if (cache[CACHE_CONFIG.key] && 
                now - cache[CACHE_CONFIG.key].lastSyncTime < CACHE_CONFIG.expireTime) {
                return cache[CACHE_CONFIG.key].data;
            }
        }

        // 获取新数据
        const data = await getTableData(
            null, // token参数已不再需要
            config.feishuAppToken,
            config.feishuTableId,
            config.feishuViewId,
            pageToken,
            PAGE_CONFIG.size
        );

        // 只有首页数据才缓存
        if (!pageToken) {
            await chrome.storage.local.set({
                [CACHE_CONFIG.key]: {
                    lastSyncTime: Date.now(),
                    data: data
                }
            });
        }

        return data;
    } catch (error) {
        // 如果是配置错误，直接抛出错误
        if (error.message.includes('请先完成飞书配置') || 
            error.message.includes('验证失败') ||
            error.message.includes('无效的访问令牌') ||
            error.message.includes('未授权')) {
            throw error;
        }

        // 其他错误（如网络问题）才尝试使用缓存
        const cache = await chrome.storage.local.get(CACHE_CONFIG.key);
        if (cache[CACHE_CONFIG.key]) {
            logger.warn('table', '使用缓存数据', { lastSyncTime: cache[CACHE_CONFIG.key].lastSyncTime });
            return cache[CACHE_CONFIG.key].data;
        }
        throw error;
    }
}

// 保存分页状态
async function savePageState(data, currentPage = 1) {
    try {
        await chrome.storage.local.set({
            [PAGE_CONFIG.key]: {
                current_page: currentPage,
                page_token: data.page_token,
                has_more: data.has_more,
                total: data.total
            }
        });
    } catch (error) {
        logger.error('table', '保存分页状态失败', error);
    }
}

// 渲染分页控件
function renderPagination(container, data, currentPage = 1) {
    const pagination = document.createElement('div');
    pagination.className = 'table-pagination';
    
    // 计算总页数（预估值，因为飞书API不返回具体总页数）
    const totalRecords = data.total || 0;
    const estimatedTotalPages = Math.min(
        Math.ceil(totalRecords / PAGE_CONFIG.size),
        PAGE_CONFIG.maxPageCount
    );

    // 计算显示的页码范围
    const maxVisiblePages = 7; // 最多显示的页码数
    let startPage = Math.max(1, currentPage - 3);
    let endPage = Math.min(estimatedTotalPages, startPage + maxVisiblePages - 1);

    // 调整起始页，确保显示足够的页码
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    // 创建分页按钮
    // 上一页按钮
    const prevButton = document.createElement('button');
    prevButton.className = 'page-btn';
    prevButton.innerHTML = '<i class="fas fa-chevron-left"></i>';
    if (currentPage <= 1) {
        prevButton.disabled = true;
    } else {
        prevButton.addEventListener('click', () => handlePrevPage(currentPage));
    }
    pagination.appendChild(prevButton);

    // 第一页
    if (startPage > 1) {
        const firstPageBtn = document.createElement('button');
        firstPageBtn.className = 'page-btn';
        firstPageBtn.textContent = '1';
        firstPageBtn.addEventListener('click', () => handlePageClick(1));
        pagination.appendChild(firstPageBtn);

        if (startPage > 2) {
            const ellipsis = document.createElement('span');
            ellipsis.className = 'page-ellipsis';
            ellipsis.textContent = '...';
            pagination.appendChild(ellipsis);
        }
    }

    // 中间页码
    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
        pageBtn.textContent = String(i);
        if (i !== currentPage) {
            pageBtn.addEventListener('click', () => handlePageClick(i));
        }
        pagination.appendChild(pageBtn);
    }

    // 最后一页
    if (endPage < estimatedTotalPages) {
        if (endPage < estimatedTotalPages - 1) {
            const ellipsis = document.createElement('span');
            ellipsis.className = 'page-ellipsis';
            ellipsis.textContent = '...';
            pagination.appendChild(ellipsis);
        }
        
        const lastPageBtn = document.createElement('button');
        lastPageBtn.className = 'page-btn';
        lastPageBtn.textContent = String(estimatedTotalPages);
        lastPageBtn.addEventListener('click', () => handlePageClick(estimatedTotalPages));
        pagination.appendChild(lastPageBtn);
    }

    // 下一页按钮
    const nextButton = document.createElement('button');
    nextButton.className = 'page-btn';
    nextButton.innerHTML = '<i class="fas fa-chevron-right"></i>';
    if (!data.has_more) {
        nextButton.disabled = true;
    } else {
        nextButton.addEventListener('click', () => handleNextPage(data.page_token, currentPage));
    }
    pagination.appendChild(nextButton);

    // 总记录数显示
    const totalInfo = document.createElement('span');
    totalInfo.className = 'page-total';
    totalInfo.textContent = `共 ${estimatedTotalPages} 页，${totalRecords} 条记录`;
    pagination.appendChild(totalInfo);

    container.appendChild(pagination);
}

// 页码点击处理函数
async function handlePageClick(page) {
    const currentPage = parseInt(document.querySelector('.page-btn.active')?.textContent) || 1;
    if (page === currentPage) return;
    
    try {
        if (page < currentPage) {
            // 向前翻页，需要重新加载到第一页然后逐页加载
            await loadTableData(true, '', 1);
            // TODO: 实现加载到指定页的逻辑
        } else if (page === currentPage + 1) {
            // 下一页可以直接使用 page_token
            const { tablePageConfig } = await chrome.storage.local.get(PAGE_CONFIG.key);
            if (tablePageConfig?.page_token) {
                await handleNextPage(tablePageConfig.page_token, currentPage);
            }
        } else {
            // 其他情况暂不支持
            logger.warn('table', '暂不支持跳转到非相邻页面');
            // TODO: 实现任意页面跳转的逻辑
        }
    } catch (error) {
        logger.error('table', '页码跳转失败', error);
    }
}

// 添加分页相关的样式
const style = document.createElement('style');
style.textContent = `
    .table-pagination {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin-top: 16px;
    }
    .table-pagination .page-btn {
        min-width: 32px;
        height: 32px;
        padding: 0 8px;
        border: 1px solid #d9d9d9;
        border-radius: 2px;
        background: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        color: rgba(0, 0, 0, 0.85);
        transition: all 0.3s;
    }
    .table-pagination .page-btn:hover:not(:disabled) {
        border-color: #1890ff;
        color: #1890ff;
    }
    .table-pagination .page-btn.active {
        border-color: #1890ff;
        background: #1890ff;
        color: white;
    }
    .table-pagination .page-btn:disabled {
        cursor: not-allowed;
        color: rgba(0, 0, 0, 0.25);
        background: #f5f5f5;
    }
    .table-pagination .page-ellipsis {
        color: rgba(0, 0, 0, 0.25);
    }
    .table-pagination .page-total {
        margin-left: 16px;
        color: rgba(0, 0, 0, 0.45);
        font-size: 13px;
    }
    .loading {
        color: #1890ff;
        text-align: center;
        padding: 20px;
        font-size: 14px;
    }
    .loading i {
        margin-right: 8px;
    }
    .empty-message {
        color: rgba(0, 0, 0, 0.45);
        text-align: center;
        padding: 20px;
        font-size: 14px;
    }
    .empty-message i {
        font-size: 20px;
        margin-bottom: 8px;
        display: block;
    }
    .error-message {
        color: #ff4d4f;
        text-align: center;
        padding: 20px;
        font-size: 14px;
    }
    .error-message i {
        margin-right: 8px;
    }
    /* 添加按钮组样式 */
    .button-group {
        display: flex;
        gap: 8px;
    }
    
    .refresh-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 32px;
        padding: 0 16px;
        border: none;
        border-radius: 6px;
        background-color: #1677ff;
        color: white;
        font-size: 14px;
        cursor: pointer;
        transition: background-color 0.3s;
    }
    
    .refresh-btn:hover {
        background-color: #4096ff;
    }
    
    .refresh-btn i {
        margin-right: 6px;
    }
    
    .refresh-btn:disabled {
        background-color: #d9d9d9;
        cursor: not-allowed;
    }
`;
document.head.appendChild(style);

// 处理上一页
async function handlePrevPage(currentPage) {
    if (currentPage <= 1) return;
    
    try {
        // 直接加载上一页
        await loadTableData(true, '', currentPage - 1);
        logger.info('table', '切换到上一页', { currentPage: currentPage - 1 });
    } catch (error) {
        logger.error('table', '切换页面失败', error);
    }
}

// 处理下一页
async function handleNextPage(pageToken, currentPage) {
    if (!pageToken) return;
    
    try {
        // 加载下一页数据
        await loadTableData(true, pageToken, currentPage + 1);
        logger.info('table', '切换到下一页', { currentPage: currentPage + 1 });
    } catch (error) {
        logger.error('table', '切换页面失败', error);
    }
}

// 选中记录的临时存储
let selectedRecordIds = new Set();
let selectedRecords = new Map(); // 存储选中记录的完整信息
let tableBodyElement = null; // 保存表格体的引用

// 保存选中的记录
function saveSelectedRecords() {
    if (!tableBodyElement) return;
    
    const selectedCheckboxes = tableBodyElement.querySelectorAll('input[type="checkbox"]:checked');
    selectedRecordIds.clear();
    selectedRecords.clear();
    
    selectedCheckboxes.forEach(checkbox => {
        const recordId = checkbox.dataset.recordId;
        selectedRecordIds.add(recordId);
        
        // 获取完整的行数据
        const record = JSON.parse(checkbox.dataset.record);
        selectedRecords.set(recordId, record);
    });
    
    // 更新选中记录数显示
    const selectedCountElement = document.getElementById('selectedCount');
    if (selectedCountElement) {
        selectedCountElement.textContent = `已选择 ${selectedRecordIds.size} 条`;
    }
    
    logger.info('table', '临时保存选中记录', { 
        count: selectedRecordIds.size,
        selectedRecords: Array.from(selectedRecords.values())
    });
}

// 获取选中的记录数据
function getSelectedRecords() {
    return {
        ids: Array.from(selectedRecordIds),
        records: Array.from(selectedRecords.values())
    };
}

// 渲染表格数据
async function renderTableData(data, currentPage = 1) {
    const tableContent = document.getElementById('tableContent');
    const paginationContainer = document.getElementById('paginationContainer');
    
    // 检查数据有效性
    if (!data || !data.records) {
        tableContent.innerHTML = `
            <div class="empty-message">
                <i class="fas fa-inbox"></i>
                暂无数据
            </div>
        `;
        return;
    }

    const records = data.records;
    if (!Array.isArray(records) || records.length === 0) {
        tableContent.innerHTML = `
            <div class="empty-message">
                <i class="fas fa-inbox"></i>
                暂无数据
            </div>
        `;
        return;
    }

    // 检查字段信息
    if (!data.fields || Object.keys(data.fields).length === 0) {
        tableContent.innerHTML = `
            <div class="empty-message">
                <i class="fas fa-inbox"></i>
                数据格式不正确
            </div>
        `;
        return;
    }

    try {
        // 创建表格容器
        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'table-wrapper';

        // 创建表格信息栏
        const tableInfo = document.createElement('div');
        tableInfo.className = 'table-info';
        tableInfo.innerHTML = `
            <span class="record-count">
                共 ${data.total || records.length} 条记录
                <span id="selectedCount" style="margin-left: 15px; color: #1890ff;">
                    已选择 0 条
                </span>
            </span>
        `;
        tableWrapper.appendChild(tableInfo);

        // 创建表格
        const table = document.createElement('table');
        table.className = 'data-table';
        table.style.whiteSpace = 'nowrap';
        table.style.borderCollapse = 'collapse';
        table.style.border = '1px solid #ddd';
        table.style.width = '100%';
        table.style.fontSize = '13px'; // 减小字体大小

        // 获取排序后的字段列表
        const sortedFields = Object.values(data.fields).sort((a, b) => a.index - b.index);

        // 创建表头
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');

        // 添加全选列
        const thCheckbox = document.createElement('th');
        thCheckbox.style.width = '40px';
        thCheckbox.style.minWidth = '40px';
        thCheckbox.style.maxWidth = '40px';
        thCheckbox.style.padding = '4px 6px';
        thCheckbox.style.textAlign = 'center';
        thCheckbox.style.backgroundColor = '#f5f5f5';
        thCheckbox.style.borderRight = '1px solid #ddd';

        // 创建全选复选框
        const selectAllCheckbox = document.createElement('input');
        selectAllCheckbox.type = 'checkbox';
        selectAllCheckbox.id = 'selectAll';
        selectAllCheckbox.name = 'selectAll';
        selectAllCheckbox.style.cursor = 'pointer';
        // 绑定全选事件
        selectAllCheckbox.addEventListener('change', (e) => {
            const checkboxes = tableBodyElement.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(checkbox => {
                checkbox.checked = e.target.checked;
            });
            // 保存选中状态
            saveSelectedRecords();
        });

        thCheckbox.appendChild(selectAllCheckbox);
        headerRow.appendChild(thCheckbox);

        // 添加其他列
        sortedFields.forEach(field => {
            const th = document.createElement('th');
            th.textContent = field.name;
            th.style.borderRight = '1px solid #ddd';
            th.style.padding = '4px 6px';
            th.style.backgroundColor = '#f5f5f5';
            
            if (field.name === '广告ID' || field.name === '组ID' || field.name === '系列ID') {
                th.style.width = '140px';
                th.style.minWidth = '140px';
                th.style.maxWidth = '140px';
                th.style.overflow = 'visible';
            }
            
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // 创建表格体
        const tbody = document.createElement('tbody');
        tableBodyElement = tbody; // 保存引用

        records.forEach(record => {
            if (record && record.fields) {
                const row = document.createElement('tr');
                
                // 添加选择框列
                const tdCheckbox = document.createElement('td');
                tdCheckbox.style.width = '40px';
                tdCheckbox.style.minWidth = '40px';
                tdCheckbox.style.maxWidth = '40px';
                tdCheckbox.style.padding = '4px 6px';
                tdCheckbox.style.textAlign = 'center';
                tdCheckbox.style.borderRight = '1px solid #ddd';
                tdCheckbox.style.borderBottom = '1px solid #eee';
                
                // 创建复选框
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.dataset.recordId = record.record_id;
                checkbox.dataset.record = JSON.stringify(record);
                checkbox.id = `checkbox-${record.record_id}`; // 添加唯一id
                checkbox.name = `checkbox-${record.record_id}`; // 添加唯一name
                checkbox.style.cursor = 'pointer';
                // 绑定选择事件
                checkbox.addEventListener('change', () => {
                    // 检查是否所有行都被选中
                    const allCheckboxes = tableBodyElement.querySelectorAll('input[type="checkbox"]');
                    const allChecked = Array.from(allCheckboxes).every(cb => cb.checked);
                    selectAllCheckbox.checked = allChecked;
                    // 保存选中状态
                    saveSelectedRecords();
                });
                
                tdCheckbox.appendChild(checkbox);
                row.appendChild(tdCheckbox);

                // 添加其他列
                sortedFields.forEach(field => {
                    const td = document.createElement('td');
                    const value = formatFieldValue(record.fields[field.name]);
                    td.textContent = value;
                    td.title = value;
                    td.style.whiteSpace = 'nowrap';
                    td.style.borderRight = '1px solid #ddd';
                    td.style.padding = '4px 6px';
                    td.style.borderBottom = '1px solid #eee';
                    
                    if (field.name === '广告ID' || field.name === '组ID' || field.name === '系列ID') {
                        td.style.width = '140px';
                        td.style.minWidth = '140px';
                        td.style.maxWidth = '140px';
                        td.style.overflow = 'visible';
                        td.style.textOverflow = 'clip';
                    } else {
                        td.style.overflow = 'hidden';
                        td.style.textOverflow = 'ellipsis';
                    }
                    
                    row.appendChild(td);
                });
                tbody.appendChild(row);
            }
        });
        table.appendChild(tbody);

        // 将表格添加到容器
        tableWrapper.appendChild(table);

        // 更新内容
        tableContent.innerHTML = '';
        tableContent.appendChild(tableWrapper);

        // 渲染分页控件（移到外部容器）
        paginationContainer.innerHTML = ''; // 清空原有内容
        renderPagination(paginationContainer, data, currentPage);

        // 切换页面时保持选中状态，只清除不存在的记录
        const newRecordIds = new Set(records.map(record => record.record_id));
        selectedRecordIds = new Set(
            Array.from(selectedRecordIds).filter(id => newRecordIds.has(id))
        );
        saveSelectedRecords();

    } catch (error) {
        logger.error('table', '渲染表格数据失败', error);
        tableContent.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-circle"></i>
                渲染数据失败: ${error.message}
            </div>
        `;
        paginationContainer.innerHTML = '';
        tableBodyElement = null;
    }
}

// 格式化字段值
function formatFieldValue(value) {
    if (value === null || value === undefined) {
        return '';
    }

    // 处理数组类型
    if (Array.isArray(value)) {
        return value.map(item => formatFieldValue(item)).join(', ');
    }

    // 处理时间戳（毫秒）
    if (typeof value === 'number' && String(value).length === 13) {
        try {
            const date = new Date(value);
            // 添加日期有效性检查
            if (!isNaN(date) && date.getTime() > 0 && date.getFullYear() >= 1970) {
                return date.toLocaleDateString('zh-CN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                }).replace(/\//g, '-');
            }
            return String(value); // 如果日期无效，返回原始值
        } catch (error) {
            logger.warn('table', '时间戳格式化失败', { value, error });
            return String(value);
        }
    }

    // 处理对象类型
    if (typeof value === 'object' && value !== null) {
        try {
            // 处理飞书多维表格的特殊字段类型
            if (value.text) {
                return value.text;
            } else if (value.name) {
                return value.name;
            } else if (value.date) {
                return value.date;
            } else if (value.datetime) {
                return value.datetime;
            } else if (value.location) {
                return `${value.location.name || ''}${value.location.address ? ` (${value.location.address})` : ''}`;
            } else if (value.options) {
                return Array.isArray(value.options) ? value.options.join(', ') : value.options;
            } else if (value.url) {
                return value.text || value.url;
            } else if (value.email) {
                return value.email;
            } else if (value.phone) {
                return value.phone;
            } else if (value.attachment) {
                return value.attachment.name || '[附件]';
            } else if (value.record_ids) {
                return `[关联记录: ${value.record_ids.join(', ')}]`;
            } else if (value.created_by || value.created_time || value.updated_by || value.updated_time) {
                let info = [];
                if (value.created_by) info.push(`创建人: ${value.created_by}`);
                if (value.created_time) info.push(`创建时间: ${formatFieldValue(value.created_time)}`);
                if (value.updated_by) info.push(`修改人: ${value.updated_by}`);
                if (value.updated_time) info.push(`修改时间: ${formatFieldValue(value.updated_time)}`);
                return info.join(', ');
            }
            
            // 尝试将其他对象类型转换为字符串
            const str = JSON.stringify(value);
            return str === '{}' ? '' : str;
        } catch (error) {
            logger.warn('table', '对象格式化失败', { value, error });
            return '[复杂数据]';
        }
    }

    // 处理其他基本类型
    return String(value);
}

// 处理刷新事件
async function handleRefresh() {
    logger.info('table-ui', '开始刷新表格');
    try {
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '<i class="fas fa-sync fa-spin"></i> 刷新中...';
        }

        // 清除缓存
        await chrome.storage.local.remove(CACHE_CONFIG.key);
        
        // 重新加载数据
        await loadTableData(true);
        
        logger.info('table-ui', '表格刷新完成');
    } catch (error) {
        logger.error('table-ui', '表格刷新失败', { error: error.message });
    } finally {
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = '<i class="fas fa-sync"></i> 刷新';
        }
    }
}

// 监听表格刷新事件
document.addEventListener('refreshTable', async () => {
    try {
        // 这里应该调用获取数据的方法
        // const newData = await fetchTableData();
        // renderTable(container, newData);
    } catch (error) {
        logger.error('table', '刷新表格失败', { error: error.message });
        alert('刷新表格失败: ' + error.message);
    }
}); 

/**
 * 渲染表格组件
 * @param {HTMLElement} container - 容器元素
 */
export function renderTable(container) {
    // ... existing code ...

    // 添加表格刷新事件监听器
    document.addEventListener('refreshTable', async () => {
        logger.info('table-ui', '收到表格刷新事件');
        try {
            // 重新获取并渲染表格数据
            await loadTableData(container);
            logger.info('table-ui', '表格刷新完成');
        } catch (error) {
            logger.error('table-ui', '表格刷新失败', { error: error.message });
        }
    });

    // 初始加载表格数据
    loadTableData(container);
} 