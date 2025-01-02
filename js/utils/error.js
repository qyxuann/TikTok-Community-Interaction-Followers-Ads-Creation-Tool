import { logger } from './logger.js';

// 错误类型枚举
export const ErrorType = {
    NETWORK: 'NETWORK',      // 网络错误
    API: 'API',             // API错误
    VALIDATION: 'VALIDATION', // 验证错误
    STORAGE: 'STORAGE',      // 存储错误
    UNKNOWN: 'UNKNOWN'       // 未知错误
};

// 自定义错误类
export class AppError extends Error {
    constructor(message, type = ErrorType.UNKNOWN, originalError = null) {
        super(message);
        this.name = 'AppError';
        this.type = type;
        this.originalError = originalError;
        this.timestamp = new Date();
    }

    // 获取错误详情
    getDetails() {
        return {
            message: this.message,
            type: this.type,
            timestamp: this.timestamp,
            stack: this.stack,
            originalError: this.originalError ? {
                message: this.originalError.message,
                name: this.originalError.name,
                stack: this.originalError.stack
            } : null
        };
    }
}

// 错误处理函数
export function handleError(error, module = 'unknown') {
    // 转换为AppError
    const appError = error instanceof AppError ? error : new AppError(
        error.message,
        getErrorType(error),
        error
    );

    // 记录错误日志
    logger.error(module, appError.message, appError.getDetails());

    // 返回用户友好的错误信息
    return getUserFriendlyMessage(appError);
}

// 根据错误类型获取用户友好的错误信息
function getUserFriendlyMessage(error) {
    switch (error.type) {
        case ErrorType.NETWORK:
            return '网络连接失败，请检查网络设置后重试';
        case ErrorType.API:
            return '服务请求失败，请稍后重试';
        case ErrorType.VALIDATION:
            return error.message || '输入数据验证失败，请检查后重试';
        case ErrorType.STORAGE:
            return '数据存储失败，请检查权限设置后重试';
        default:
            return '操作失败，请稍后重试';
    }
}

// 根据错误实例判断错误类型
function getErrorType(error) {
    if (error instanceof TypeError && error.message.includes('network')) {
        return ErrorType.NETWORK;
    }
    if (error.name === 'ValidationError') {
        return ErrorType.VALIDATION;
    }
    if (error.message.includes('storage')) {
        return ErrorType.STORAGE;
    }
    if (error.message.includes('api') || error.response) {
        return ErrorType.API;
    }
    return ErrorType.UNKNOWN;
}

// API错误处理
export function handleApiError(error, module) {
    const apiError = new AppError(
        error.response?.data?.message || error.message,
        ErrorType.API,
        error
    );
    return handleError(apiError, module);
}

// 验证错误处理
export function handleValidationError(message, module) {
    const validationError = new AppError(
        message,
        ErrorType.VALIDATION
    );
    return handleError(validationError, module);
}

// 存储错误处理
export function handleStorageError(error, module) {
    const storageError = new AppError(
        error.message,
        ErrorType.STORAGE,
        error
    );
    return handleError(storageError, module);
} 