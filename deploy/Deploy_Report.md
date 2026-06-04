# 取件通 (PickupApp) — 部署报告

> 版本：v1.0.0 | 日期：2026-06-03

---

## 1. 部署环境

| 项目 | 详情 |
|------|------|
| 应用类型 | Android APK |
| 包名 | com.carl.pickupapp |
| 版本号 | 1.0.0 (versionCode: 1) |
| 目标SDK | Android 8.0+ (API 26+) |
| 架构 | arm64-v8a |
| APK体积 | ~24MB (Release) |

---

## 2. 后端服务

| 项目 | 详情 |
|------|------|
| 服务类型 | Node.js (轻量级激活验证API) |
| 代码位置 | server/index.js |
| 运行方式 | 独立VPS / Serverless函数 |
| 环境变量 | ACTIVATION_SECRET（激活码生成密钥） |
| 端口 | 可配置（默认3000） |
| 依赖 | express + crypto（内置） |

---

## 3. 构建流程

### 3.1 本地构建

```bash
# Debug APK
npx expo run:android

# Release APK (推荐用于发布)
cd android
.\gradlew assembleRelease
```

### 3.2 构建前检查清单

- [ ] `npx expo run:android` 无编译错误
- [ ] `npm test` 全部通过
- [ ] AndroidManifest.xml 权限声明完整
- [ ] versionCode 和 versionName 已更新
- [ ] 隐私政策和用户协议页面可访问
- [ ] Pro验证服务器正常运行
- [ ] release keystore 未过期

### 3.3 CI/CD（已配置）

`.github/workflows/ci.yml` 已配置，每次 push 自动执行：
- ESLint 代码检查
- TypeScript 类型检查
- Jest 单元测试
- Expo Doctor 环境检查

---

## 4. 安装与测试

### 4.1 ADB安装

```bash
# 卸载旧版本
adb uninstall com.carl.pickupapp

# 安装新APK
adb install android/app/build/outputs/apk/release/app-release.apk

# 授予关键权限
adb shell pm grant com.carl.pickupapp android.permission.READ_SMS
adb shell pm grant com.carl.pickupapp android.permission.POST_NOTIFICATIONS

# 验证安装
adb shell dumpsys package com.carl.pickupapp | findstr "versionName"
```

### 4.2 首次使用流程

1. 打开App → 引导页
2. 授予SMS读取权限
3. 启用通知监听服务
4. 等待自动扫描历史短信（首次7天范围）
5. 首页出现包裹列表

---

## 5. 发布渠道

| 渠道 | 状态 | 备注 |
|------|------|------|
| GitHub Releases | ✅ 计划中 | 托管APK下载 |
| 酷安 | 🟡 计划中 | 国内Android用户社区 |
| Google Play | ⚪ 远期 | 需Google开发者账号 |
| 华为应用市场 | ⚪ 远期 | 需企业资质 |

---

## 6. 回滚方案

| 场景 | 操作 |
|------|------|
| APK有严重Bug | GitHub Release 回退到上一版本APK |
| 后端服务异常 | Pro验证改为本地离线模式（fallback） |
| 数据库迁移失败 | 清空数据 + 引导用户重新导入JSON备份 |

---

## 7. 版本记录

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0.0 | 待定 | 初始发布版 |
