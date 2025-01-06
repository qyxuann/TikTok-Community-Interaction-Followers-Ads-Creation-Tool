/**
 * 飞书多维表格相关操作
 */
import { logger } from '../../utils/logger.js';
import { handleApiError } from '../../utils/error.js';
import { getTenantAccessToken } from './auth.js';

// 验证多维表格访问权限
export async function verifyTableAccess(token, appToken, tableId) {
    try {
        // 检查参数
        if (!token || !appToken) {
            logger.error('feishu-api', '参数不完整', { token, appToken });
            throw new Error('缺少必要参数');
        }

        // 先验证多维表格访问权限
        const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables`;
        
        // 记录请求日志
        logger.info('feishu-api', '发送验证多维表格访问权限请求', {
            url,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json; charset=utf-8'
            }
        });

        // 先检查响应状态
        if (!response.ok) {
            const errorText = await response.text();
            logger.error('feishu-api', '请求失败', {
                status: response.status,
                statusText: response.statusText,
                errorText
            });
            throw new Error(`请求失败: ${response.status} ${response.statusText}`);
        }

        // 获取响应文本
        const text = await response.text();

        // 记录原始响应
        logger.debug('feishu-api', '验证多维表格访问权限原始响应', {
            status: response.status,
            text
        });

        // 尝试解析JSON
        let result;
        try {
            result = JSON.parse(text);
        } catch (error) {
            logger.error('feishu-api', 'JSON解析失败', {
                error: error.message,
                text
            });
            throw new Error('响应格式错误');
        }

        // 记录解析后的响应
        logger.info('feishu-api', '验证多维表格访问权限响应', {
            status: response.status,
            result
        });

        if (result.code !== 0) {
            logger.error('feishu-api', '业务错误', result);
            throw new Error(result.msg || '验证多维表格访问权限失败');
        }

        // 如果提供了tableId，验证该表是否存在
        if (tableId) {
            const tables = result.data?.items || [];
            const tableExists = tables.some(table => table.table_id === tableId);
            if (!tableExists) {
                throw new Error('指定的数据表不存在');
            }
        }

        return true;
    } catch (error) {
        const message = handleApiError(error, 'feishu-api');
        throw new Error(message);
    }
}

// 获取多维表格数据
export async function getTableData(token, appToken, tableId, viewId = '', pageToken = '', pageSize = 100) {
    try {
        // 检查参数
        if (!appToken || !tableId) {
            logger.error('feishu-api', '参数不完整', { appToken, tableId });
            throw new Error('缺少必要参数');
        }

        // 获取最新的访问令牌
        const { feishuAppId, feishuAppSecret } = await chrome.storage.local.get([
            'feishuAppId',
            'feishuAppSecret'
        ]);

        if (!feishuAppId || !feishuAppSecret) {
            throw new Error('缺少飞书应用配置');
        }

        const accessToken = await getTenantAccessToken(feishuAppId, feishuAppSecret);

        // 首先获取表格的字段信息
        const fieldsUrl = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/fields`;
        const fieldsResponse = await fetch(fieldsUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json; charset=utf-8'
            }
        });

        if (!fieldsResponse.ok) {
            throw new Error(`获取字段信息失败: ${fieldsResponse.status}`);
        }

        const fieldsResult = await fieldsResponse.json();
        if (fieldsResult.code !== 0) {
            throw new Error(fieldsResult.msg || '获取字段信息失败');
        }

        // 构建字段映射，保存字段顺序和信息
        const fieldMap = {};
        fieldsResult.data.items.forEach((field, index) => {
            fieldMap[field.field_name] = {
                id: field.field_id,
                type: field.type === 'DateTime' ? 15 : // 创建时间
                      field.type === 'CreatedBy' ? 17 : // 创建人
                      field.type === 'ModifiedTime' ? 16 : // 修改时间
                      field.type === 'ModifiedBy' ? 18 : // 修改人
                      field.type === 'Text' ? 1 : // 单行文本
                      field.type === 'MultiLineText' ? 2 : // 多行文本
                      field.type === 'Number' ? 3 : // 数字
                      field.type === 'SingleSelect' ? 4 : // 单选
                      field.type === 'MultiSelect' ? 5 : // 多选
                      field.type === 'Date' ? 6 : // 日期
                      field.type === 'Checkbox' ? 7 : // 复选框
                      field.type === 'User' ? 8 : // 人员
                      field.type === 'Url' ? 9 : // 链接
                      field.type === 'Attachment' ? 10 : // 附件
                      field.type === 'Phone' ? 11 : // 电话号码
                      field.type === 'Email' ? 12 : // 邮箱
                      field.type === 'Location' ? 13 : // 地理位置
                      field.type === 'AutoNumber' ? 14 : // 自动编号
                      field.type === 'Formula' ? 19 : // 公式
                      field.type === 'DuplexLink' ? 20 : // 关联记录
                      field.type === 'LookUp' ? 21 : // 查找引用
                      field.type === 'Currency' ? 22 : // 货币
                      field.type === 'Percent' ? 23 : // 百分比
                      field.type === 'Progress' ? 24 : // 进度
                      field.type === 'Rating' ? 25 : // 评分
                      field.type === 'Barcode' ? 26 : // 条码
                      field.type === 'QrCode' ? 27 : // 二维码
                      field.type === 'SingleLink' ? 28 : // 单向关联
                      field.type === 'DuplexLink' ? 29 : // 双向关联
                      field.type === 'Group' ? 30 : // 分组
                      field.type === 'Button' ? 31 : // 按钮
                      0, // 未知类型
                name: field.field_name,
                index: index,
                property: field.property || {} // 保存字段的其他属性
            };
        });

        // 构建基础URL和查询参数
        const params = new URLSearchParams({
            page_size: String(pageSize)
        });

        // 如果提供了视图ID，添加到查询参数中
        if (viewId) {
            params.append('view_id', viewId);
        }

        // 如果提供了分页标记，添加到查询参数中
        if (pageToken) {
            params.append('page_token', pageToken);
        }

        // 使用正确的API路径
        const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`;
        
        // 记录请求日志
        logger.info('feishu-api', '发送获取多维表格数据请求', {
            url: url + '?' + params.toString(),
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            },
            viewId: viewId || '默认视图',
            pageToken: pageToken || '首页'
        });

        const response = await fetch(`${url}?${params.toString()}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json; charset=utf-8'
            }
        });

        // 先检查响应状态
        if (!response.ok) {
            const errorText = await response.text();
            logger.error('feishu-api', '请求失败', {
                status: response.status,
                statusText: response.statusText,
                errorText
            });
            throw new Error(`请求失败: ${response.status} ${response.statusText}`);
        }

        // 获取响应文本
        const text = await response.text();

        // 记录原始响应
        logger.debug('feishu-api', '获取多维表格数据原始响应', {
            status: response.status,
            text
        });

        // 尝试解析JSON
        let result;
        try {
            result = JSON.parse(text);
        } catch (error) {
            logger.error('feishu-api', 'JSON解析失败', {
                error: error.message,
                text
            });
            throw new Error('响应格式错误');
        }

        // 记录解析后的响应
        logger.info('feishu-api', '获取多维表格数据响应', {
            status: response.status,
            result
        });

        if (result.code !== 0) {
            logger.error('feishu-api', '业务错误', result);
            throw new Error(result.msg || '获取多维表格数据失败');
        }

        // 验证返回的数据格式
        if (!result.data || !Array.isArray(result.data.items)) {
            logger.error('feishu-api', '返回数据格式错误', result);
            throw new Error('返回数据格式错误');
        }

        // 转换数据格式，保持字段顺序
        const records = result.data.items.map(item => {
            // 记录原始数据
            // logger.debug('feishu-api', '处理记录数据', {
            //     record_id: item.record_id,
            //     fields: Object.keys(item.fields || {})
            // });

            return {
                record_id: item.record_id,
                fields: item.fields
            };
        });

        // 记录所有记录ID
        // logger.info('feishu-api', '获取到记录列表', {
        //     total: records.length,
        //     record_ids: records.map(r => r.record_id)
        // });

        // 返回数据，包含分页信息和字段信息
        return {
            records,
            fields: fieldMap,
            total: result.data.total || records.length,
            has_more: result.data.has_more || false,
            page_token: result.data.page_token || null,
            page_size: pageSize
        };
    } catch (error) {
        const message = handleApiError(error, 'feishu-api');
        throw new Error(message);
    }
}

/**
 * 获取表格字段信息
 * @param {string} appToken - 多维表格应用token
 * @param {string} tableId - 数据表ID
 * @param {string} accessToken - 访问令牌
 * @returns {Promise<Object>} 字段信息
 */
async function getTableFields(appToken, tableId, accessToken) {
    try {
        const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/fields`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.code !== 0) {
            throw new Error(`API error! message: ${result.msg}`);
        }

        // 构建字段映射
        const fieldMap = {};
        result.data.items.forEach(field => {
            fieldMap[field.field_name] = {
                id: field.field_id,
                type: field.type,
                property: field.property
            };
        });

        return fieldMap;
    } catch (error) {
        logger.error('feishu-bitable', '获取字段信息失败', { error });
        throw error;
    }
}

/**
 * 格式化字段值
 * @param {string} fieldType - 字段类型
 * @param {any} value - 字段值
 * @returns {any} 格式化后的值
 */
function formatFieldValue(fieldType, value) {
    switch (fieldType) {
        case 'Text':
        case 'SingleText':
            return value; // 文本类型直接返回
        case 'Number':
            return Number(value); // 数字类型转换为数字
        case 'SingleSelect':
            return value; // 单选类型直接返回选项值
        case 'MultiSelect':
            return Array.isArray(value) ? value : [value]; // 多选类型确保是数组
        case 'DateTime':
        case 'Date':
            return typeof value === 'number' ? value : Date.parse(value); // 日期类型转换为时间戳
        case 'Checkbox':
            return Boolean(value); // 复选框类型转换为布尔值
        case 'User':
            return Array.isArray(value) ? value : [{ id: value }]; // 人员类型转换为对象数组
        case 'Url':
            return typeof value === 'object' ? value : { link: value, text: value }; // 超链接类型转换为对象
        default:
            return value; // 其他类型直接返回
    }
}

/**
 * 更新记录
 * @param {string} recordId - 记录ID
 * @param {Object} fields - 要更新的字段
 * @returns {Promise<Object>} 更新结果
 */
export async function updateRecord(recordId, fields) {
    try {
        // 检查记录ID
        if (!recordId) {
            throw new Error('记录ID不能为空');
        }

        // 检查记录ID格式
        if (typeof recordId !== 'string' || !recordId.startsWith('rec')) {
            throw new Error(`记录ID格式不正确: ${recordId}`);
        }

        // 获取配置信息
        const { feishuAppId, feishuAppSecret, feishuAppToken, feishuTableId } = await chrome.storage.local.get([
            'feishuAppId',
            'feishuAppSecret',
            'feishuAppToken',
            'feishuTableId'
        ]);

        if (!feishuAppId || !feishuAppSecret || !feishuAppToken || !feishuTableId) {
            throw new Error('缺少飞书配置信息');
        }

        // 获取访问令牌
        const accessToken = await getTenantAccessToken(feishuAppId, feishuAppSecret);

        // 记录输入参数
        logger.info('feishu-bitable', '更新记录输入参数', {
            record_id: recordId,
            fields: fields,
            app_token: feishuAppToken,
            table_id: feishuTableId
        });

        // 构建请求URL
        const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${feishuAppToken}/tables/${feishuTableId}/records/${recordId}?user_id_type=open_id`;

        // 记录请求信息
        logger.info('feishu-bitable', '准备发送请求', {
            method: 'PUT',
            url,
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: {
                fields
            }
        });

        // 发送请求
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fields
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            logger.error('feishu-bitable', '请求失败', {
                status: response.status,
                statusText: response.statusText,
                errorText
            });
            throw new Error(`请求失败: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        
        if (result.code !== 0) {
            throw new Error(`API error! message: ${result.msg}`);
        }

        logger.info('feishu-bitable', '更新记录成功', {
            record_id: recordId,
            result
        });

        return result;
    } catch (error) {
        logger.error('feishu-bitable', '更新记录失败', {
            error: error.message,
            record_id: recordId,
            fields
        });
        throw error;
    }
} 