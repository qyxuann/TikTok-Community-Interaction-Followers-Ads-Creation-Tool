# TikTok 社区互动-账号关注广告创建工具 | Community Interaction - Account Follow Ad Creation Tool

[切换语言 | Switch Language](#english)

## 简体中文

一个 Chrome 扩展，用于快速创建 TikTok 社区互动-账号关注广告。通过读取飞书多维表格中的数据，自动化创建广告系列、广告组和广告。

### 功能特性

- 🔄 自动同步飞书多维表格数据
- 📊 批量创建广告系列、广告组和广告
- 🎯 支持自定义定向（年龄、性别、地区等）
- ⏰ 灵活的投放时段设置
- 💰 支持自定义出价策略
- 📝 自动更新创建结果到飞书表格
- 🔍 实时日志记录和查看
- ⚙️ 完整的配置管理功能

### 安装说明

1. 下载项目代码
2. 打开 Chrome 浏览器，进入扩展管理页面 (`chrome://extensions/`)
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目目录

### 使用前配置

#### 飞书配置
1. 创建飞书应用并获取以下信息：
   - 应用 ID
   - 应用密钥
   - 多维表格 ID (app_token)
   - 数据表 ID (table_id)

#### TikTok 配置
1. 创建 TikTok 开发者应用并获取：
   - 应用 ID
   - 应用密钥
2. 完成 TikTok 广告账户授权

### 使用说明

1. 点击扩展图标，打开主界面
2. 在设置中完成飞书和 TikTok 配置
3. 选择要创建广告的数据行
4. 点击"创建广告"按钮
5. 等待创建完成，查看结果

### 数据表格式要求

飞书多维表格需要包含以下字段：

| 字段名 | 类型 | 说明 |
|-------|------|------|
| 系列名称 | 文本 | 广告系列名称 |
| 组名称 | 文本 | 广告组名称 |
| 广告名称 | 文本 | 广告名称 |
| 国家 | 单选 | US/CA/US&CA |
| 年龄 | 单选 | 1855/1854/1844等 |
| 性别 | 单选 | 不限/男性/女性 |
| 投放时段 | 单选 | 全天/0923等 |
| 出价 | 数字 | 广告出价 |
| identity_id | 文本 | TikTok账号ID |
| tiktok_item_id | 文本 | TikTok视频ID |

### 开发说明

#### 项目结构
```
├── manifest.json          # 扩展配置文件
├── html/                  # HTML 页面
├── css/                   # 样式文件
├── js/                   # JavaScript 源码
│   ├── api/             # API 接口
│   ├── components/      # UI 组件
│   └── utils/          # 工具函数
└── icons/               # 图标资源
```

#### 技术栈
- Chrome Extension API
- TikTok Marketing API
- 飞书开放 API
- ES6+ JavaScript
- HTML5 & CSS3

---

## English

A Chrome extension for quickly creating TikTok community interaction - account follow ads. It automates the creation of campaigns, ad groups, and ads by reading data from Feishu (Lark) tables.

[切换语言 | Switch Language](#简体中文)

### Features

- 🔄 Auto-sync with Feishu tables
- 📊 Batch creation of campaigns, ad groups, and ads
- 🎯 Custom targeting support (age, gender, location, etc.)
- ⏰ Flexible scheduling options
- 💰 Custom bidding strategy support
- 📝 Auto-update results to Feishu table
- 🔍 Real-time logging and viewing
- ⚙️ Complete configuration management

### Installation

1. Download the project code
2. Open Chrome browser, go to extensions page (`chrome://extensions/`)
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the project directory

### Pre-use Configuration

#### Feishu Configuration
1. Create a Feishu app and get:
   - App ID
   - App Secret
   - Bitable ID (app_token)
   - Table ID (table_id)

#### TikTok Configuration
1. Create a TikTok developer app and get:
   - App ID
   - App Secret
2. Complete TikTok ad account authorization

### Usage Instructions

1. Click the extension icon to open main interface
2. Complete Feishu and TikTok configuration in settings
3. Select data rows for ad creation
4. Click "Create Ad" button
5. Wait for completion and check results

### Table Format Requirements

Feishu table should include these fields:

| Field Name | Type | Description |
|------------|------|-------------|
| Campaign Name | Text | Name of ad campaign |
| Group Name | Text | Name of ad group |
| Ad Name | Text | Name of ad |
| Country | Single Select | US/CA/US&CA |
| Age | Single Select | 1855/1854/1844etc |
| Gender | Single Select | Unlimited/Male/Female |
| Schedule | Single Select | All day/0923etc |
| Bid | Number | Ad bid |
| identity_id | Text | TikTok account ID |
| tiktok_item_id | Text | TikTok video ID |

### Development Guide

#### Project Structure
```
├── manifest.json          # Extension config file
├── html/                  # HTML pages
├── css/                   # Style files
├── js/                   # JavaScript source code
│   ├── api/             # API interfaces
│   ├── components/      # UI components
│   └── utils/          # Utility functions
└── icons/               # Icon resources
```

#### Tech Stack
- Chrome Extension API
- TikTok Marketing API
- Feishu Open API
- ES6+ JavaScript
- HTML5 & CSS3 