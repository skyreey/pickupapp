<div align="center">
  <img src="./assets/adaptive-icon.png" width="120" height="120" alt="取件通 Logo">
  <h1>取件通 · PickupApp</h1>
  <p>
    <strong>Android 快递包裹自动追踪助手</strong>
  </p>
  <p>
    自动识别取件短信 · 实时监控购物通知 · 一站式包裹管理
  </p>
  <p>
    <img src="https://img.shields.io/badge/Expo-55-blue?logo=expo" alt="Expo 55">
    <img src="https://img.shields.io/badge/React_Native-0.83.6-blue?logo=react" alt="React Native 0.83.6">
    <img src="https://img.shields.io/badge/Android-API_26%2B-brightgreen?logo=android" alt="Android API 26+">
    <img src="https://img.shields.io/badge/language-TypeScript-blue?logo=typescript" alt="TypeScript">
    <img src="https://img.shields.io/badge/release-24_MB-success" alt="Release 24MB">
  </p>
</div>

---

## 功能特性

### 核心功能

| 功能 | 说明 |
|------|------|
| 短信自动识别 | 监听/扫描收件箱 SMS，正则解析取件码、快递公司、站点信息 |
| 购物通知监控 | 通过 NotificationListenerService 实时监听淘宝/京东/拼多多/抖音/菜鸟等 14 个 App 的物流通知 |
| 包裹管理 | 首页列表筛选（待取件/进行中/已取件/全部），批量操作，快捷标记取件 |
| 取件码快捷展示 | 大号取件码横幅，一键复制，点击拨号/导航到站点 |
| 物流轨迹追踪 | 内置物流查询 API，自动获取物流轨迹时间线 |
| 屏幕截图 OCR | 集成 ML Kit 中文 OCR，从快递通知截图中批量提取单号/公司/状态 |
| 手动录入 | 粘贴短信或输入单号，支持 OCR 多图批量识别 |
| 数据导入导出 | JSON 格式导出分享/导入恢复，方便备份和迁移 |
| 桌面挂件 | AppWidget 快捷显示最新取件码（已移除） |

### 智能特性

- **自动去重**：同一取件码的重复短信不会创建多个包裹
- **智能匹配**：新短信自动匹配已有包裹（按快递公司+地址+单号多层匹配）
- **已取件检测**：历史 SMS 中的"已签收/已取件"关键词自动标记
- **自动取件**：物流 API 检测到"已签收"状态时自动标记取件
- **通知推送**：包裹到站时发送本地通知，支持桌面角标

---

## 架构概览

```
┌─────────────────────────────────────────────────┐
│                   UI 层 (React)                   │
│  expo-router (Tabs + Stack)                      │
│  ┌─────────────────────────────────────────────┐ │
│  │ 首页 (index.tsx)    详情 (detail/[id].tsx)  │ │
│  │ 手动录入 (manual.tsx)  设置 (settings.tsx)  │ │
│  └─────────────────────────────────────────────┘ │
│                   组件层                          │
│  PackageCard  SummaryBanner  PickupCodeBanner    │
│  TrackingTimeline  PermissionGuide  StatusBadge  │
├─────────────────────────────────────────────────┤
│              服务层 (TypeScript)                  │
│  ┌─────────────────┐  ┌──────────────────────┐  │
│  │ sms-listener    │  │ notification-listener │  │
│  │ sms-parser      │  │ notification-parser   │  │
│  │ sms-patterns    │  │ notification-patterns │  │
│  └────────┬────────┘  └──────────┬───────────┘  │
│           │                      │               │
│  ┌────────▼──────────────────────▼───────────┐  │
│  │              DAO (数据库接口层)             │  │
│  │          insertPackage / updatePickupCode  │  │
│  │     findMatchingPackage / markAsPickedUp   │  │
│  └────────────────────┬──────────────────────┘  │
│                       │                          │
│  ┌────────────────────▼──────────────────────┐  │
│  │           SQLite (expo-sqlite)            │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  ┌───────────────────────────────────────────┐  │
│  │         其他服务                           │  │
│  │  tracking-api.ts   (快递物流查询)          │  │
│  │  tracker-scheduler.ts (定时刷新物流)       │  │
│  │  notification-service.ts (本地通知推送)    │  │
│  │  settings-store.ts     (设置持久化)        │  │
│  │  ocr-parser.ts         (OCR 文字解析)      │  │
│  └───────────────────────────────────────────┘  │
├─────────────────────────────────────────────────┤
│            原生模块层 (Kotlin)                    │
│  ┌─────────────────┐  ┌──────────────────────┐  │
│  │ expo-sms-reader  │  │ expo-notification-   │  │
│  │ SmsReceiver      │  │ reader                │  │
│  │ inbox scanner    │  │ NotificationListener  │  │
│  └─────────────────┘  └──────────────────────┘  │
│  ┌─────────────────┐  ┌──────────────────────┐  │
│  │ expo-ocr-reader │  │ expo-app-scanner     │  │
│  │ ML Kit OCR      │  │ 已安装App检测         │  │
│  └─────────────────┘  └──────────────────────┘  │
├─────────────────────────────────────────────────┤
│              Android 系统服务                    │
│  Sms BroadcastReceiver  NotificationListener     │
│  SharedPreferences       ContentProvider(sms)    │
└─────────────────────────────────────────────────┘
```

### 数据流

```
通知/SMS → 原生模块 → JS Event → 解析器 → DAO → SQLite
                                               ↓
                                     物流 API 补充轨迹
                                               ↓
                                    本地通知推送 + UI 刷新
```

---

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Expo SDK 55, React Native 0.83.6 |
| UI | expo-router, react-native-paper, react-native-vector-icons |
| 存储 | expo-sqlite (SQLite), SharedPreferences (原生持久化) |
| 语言 | TypeScript 5.9, Kotlin (原生模块) |
| 架构 | Fabric (New Architecture), Hermes 引擎 |
| 原生能力 | SmsReceiver, NotificationListenerService, ML Kit OCR |
| 构建工具 | Gradle, R8 混淆, AAPT2 |

---

## 项目结构

```
PickupApp/
├── app/                          # expo-router 页面
│   ├── _layout.tsx               # 根布局 (Stack)
│   ├── (tabs)/
│   │   ├── _layout.tsx           # 底部 Tab 布局
│   │   ├── index.tsx             # 首页 — 包裹列表
│   │   ├── manual.tsx            # 手动添加页
│   │   └── settings.tsx          # 设置页
│   └── detail/
│       └── [id].tsx              # 包裹详情页
│
├── src/
│   ├── components/               # UI 组件
│   │   ├── PackageCard.tsx       # 包裹卡片
│   │   ├── SummaryBanner.tsx     # 统计概览
│   │   ├── PickupCodeBanner.tsx  # 取件码横幅
│   │   ├── TrackingTimeline.tsx  # 物流时间线
│   │   ├── PermissionGuide.tsx   # 权限引导
│   │   ├── StatusBadge.tsx       # 状态角标
│   │   └── EmptyState.tsx        # 空状态
│   │
│   ├── services/                 # 核心服务
│   │   ├── sms-listener.ts       # SMS 监听全流程
│   │   ├── sms-parser.ts         # SMS 正则解析
│   │   ├── notification-listener.ts # 通知监听
│   │   ├── notification-parser.ts   # 通知解析
│   │   ├── notification-service.ts  # 本地推送
│   │   ├── tracking-api.ts       # 物流查询 API
│   │   ├── tracker-scheduler.ts  # 物流定时刷新
│   │   ├── settings-store.ts     # 设置持久化
│   │   └── ocr-parser.ts         # OCR 文字解析
│   │
│   ├── database/                 # 数据库层
│   │   ├── index.ts              # Schema + 迁移
│   │   └── dao.ts                # CRUD 操作
│   │
│   ├── patterns/                 # 解析规则
│   │   ├── sms-patterns.ts       # 13+ 快递短信规则
│   │   └── notification-patterns.ts # 7+ 购物通知规则
│   │
│   ├── hooks/                    # 自定义 Hooks
│   │   ├── usePackages.ts        # 包裹数据 Hook
│   │   └── usePermissions.ts     # 权限状态 Hook
│   │
│   ├── models/                   # 类型定义
│   │   └── index.ts              # 所有 TypeScript 类型
│   │
│   └── utils/                    # 工具函数
│       ├── formatters.ts         # 格式化工具
│       └── navigation.ts         # 地图导航/拨号
│
├── modules/                      # 原生模块 (Kotlin)
│   ├── expo-sms-reader/          # SMS 读取模块
│   │   └── android/src/main/java/expo/modules/exposmsreader/
│   │       ├── ExpoSmsReaderModule.kt
│   │       └── SmsReceiver.kt
│   │
│   ├── expo-notification-reader/ # 通知监听模块
│   │   └── android/src/main/java/expo/modules/exponotificationreader/
│   │       ├── ExpoNotificationReaderModule.kt
│   │       └── PickupNotificationService.kt
│   │
│   ├── expo-ocr-reader/          # OCR 识别模块 (ML Kit)
│   │   └── android/src/main/java/expo/modules/expoocrreader/
│   │       └── ExpoOcrReaderModule.kt
│   │
│   ├── expo-app-scanner/         # 已安装 App 检测模块
│   │   └── android/src/main/java/expo/modules/expoappscanner/
│   │       └── ExpoAppScannerModule.kt
│   │
│   └── expo-gallery-launcher/    # 相册选择模块
│       └── android/src/main/java/expo/modules/expogallerylauncher/
│           └── ExpoGalleryLauncherModule.kt
│
├── android/                      # Android 原生工程
│   ├── app/
│   │   └── build.gradle          # App 构建配置
│   ├── gradle.properties         # Gradle 全局属性
│   └── build.gradle              # 根构建脚本
│
├── assets/                       # 静态资源
│   ├── icon.png
│   ├── adaptive-icon.png
│   └── splash-icon.png
│
├── plugins/                      # Expo Config Plugins
│   └── withAndroidManifest.js
│
├── package.json                  # 依赖配置
├── app.json                      # Expo 配置
├── tsconfig.json                 # TypeScript 配置
└── README.md                     # 本文档
```

---

## 快速开始

### 前置条件

- Node.js >= 18
- JDK 17
- Android SDK (API 26+)
- Android 设备或模拟器 (推荐真机，因需要 SMS 权限)

### 环境变量

```bash
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
set ANDROID_HOME=C:\Users\27570\AppData\Local\Android\Sdk
```

### 安装

```bash
# 克隆项目
git clone https://github.com/skyreey/PickupApp.git
cd PickupApp

# 安装依赖
npm install

# 构建 Debug APK
npx expo run:android

# 构建 Release APK
cd android
.\gradlew assembleRelease
```

> Release APK 路径：`android/app/build/outputs/apk/release/app-release.apk`

### 安装到设备

```bash
# 安装 APK
adb install -r android/app/build/outputs/apk/release/app-release.apk

# 授权 SMS 读取权限
adb shell pm grant com.carl.pickupapp android.permission.READ_SMS
```

---

## 构建配置

### Release 构建

已在 `gradle.properties` 中优化：

| 配置 | 值 | 说明 |
|------|-----|------|
| `reactNativeArchitectures` | `arm64-v8a` | 仅编译 64 位架构，减小 APK |
| `hermesEnabled` | `true` | Hermes JS 引擎 |
| `newArchEnabled` | `true` | Fabric New Architecture |
| `minifyEnabled` | `true` | R8 混淆/压缩 |
| `enableShrinkResources` | `true` | 资源压缩 |
| `useLegacyPackaging` | `true` | Hermes + Fabric 兼容 |

Release APK 体积：约 **24 MB**（Debug 约 210 MB）

### 权限清单

| 权限 | 用途 |
|------|------|
| `READ_SMS` | 扫描收件箱短信，解析取件码 |
| `RECEIVE_SMS` | 实时监听新短信 |
| `POST_NOTIFICATIONS` | 发送到站/状态变更通知 |
| `RECEIVE_BOOT_COMPLETED` | 开机后自动重启监听服务 |
| `INTERNET` | 物流 API 查询 |
| `VIBRATE` | 通知震动 |

---

## 原生模块一览

| 模块 | 语言 | 职责 |
|------|------|------|
| `expo-sms-reader` | Kotlin | SMS 收件箱扫描 + 广播接收器 |
| `expo-notification-reader` | Kotlin | NotificationListenerService，监控 14 个购物 App |
| `expo-ocr-reader` | Kotlin | ML Kit 中文 OCR 文字识别 |
| `expo-app-scanner` | Kotlin | 检测已安装购物 App 及安装时间 |
| `expo-gallery-launcher` | Kotlin | 系统相册选择图片 |

---

## 许可证

本项目为个人开源项目，仅供学习和参考。

---

<div align="center">
  <p>Made with ❤️ by Carl</p>
  <p>
    <a href="mailto:skyreey@gmail.com">联系作者</a>
  </p>
</div>
