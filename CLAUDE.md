@AGENTS.md

# Token 效率优化规则

## 文件读写规则（降低 354:1 输入输出比的核心措施）

1. **精准读取**：用 `Read` 时指定 offset/limit 只读需要的行，不要通读整个文件
2. **批量编辑**：修改同一个文件的多处内容，合并在一次响应中完成，不要拆成多次读-改循环
3. **不重复读取**：当前会话中已经读过的文件内容，直接引用内存中的信息，不重新读取
4. **Grep 优先**：查找代码位置时先用 `Grep` 定位，再 `Read` 指定行，避免先 `Glob` 再通读

## 会话长寿规则（降低"入场费"均摊成本）

1. **不轻易开新会话**：每个新会话都要付全价读取项目上下文，长会话自动压缩后继续用，不手动 `/clear`
2. **逻辑断点告知**：完成一个功能模块时告知我，我判断是否需要手动 `/compact`（比自动压缩更智能）
3. **探索型任务派给予代理**：grep/glob 扫描、多文件调查等产生大量中间输出的工作，派给予代理隔离执行
4. **上下文退化时反馈**：感觉 Claude 忘记前文时直接说"上下文不行了"，我评估是 `/rewind` 还是 `/compact`
5. **CLAUDE.md 保持在 200 行以内**：这是唯一在压缩中完整保留的内容，精简高效

## 压缩安全保障（防丢失·可回滚）

1. **Git 提交为保险**：每完成一个可工作的改动点，我会列出改了哪些文件+改了什么，你说"提交"就 commit，随时可 `git revert` 或看 diff
2. **压缩前状态快照**：触发 `/compact` 前，我会整理当前修改文件列表、任务进度、关键错误，写入会话供压缩后的上下文衔接
3. **不丢失历史**：压缩只是把旧消息摘要化，不会删除——任何时候可用 `/rewind` 或说"退回到 XX"跳回压缩前的某个位置
4. **长期信息写入 daily**：重要的架构决策、bug 根因、修复方案，压缩前我会问你"这个要记吗"，你说"记"就写入记忆系统

## 开发守则

- 改前先描述改动范围（改哪几个文件、改什么），让我确认后再执行
- 不扫描 node_modules、.git 等无关目录
- 修复 bug 时只读取与 bug 直接相关的文件和行，不读完整文件

## 项目架构

取件通 — React Native + Expo Android App，自动追踪快递包裹。
- **技术栈**：Expo SDK 55 + expo-router + expo-sqlite + TypeScript
- **包名**：`com.carl.pickupapp`
- **ADB**：`C:\Users\27570\platform-tools\platform-tools\adb.exe`
- **APK 输出**：`android/app/build/outputs/apk/debug/app-debug.apk`

### 数据流
```
通知/SMS → 原生模块 → JS Event → 解析 → DAO → SQLite
                                          ↓
                                物流 API 查询补充轨迹
```

### 分层
- `src/models/` — 类型定义（Package, ParsedSmsResult）
- `src/database/` — SQLite 建表 + CRUD（dao.ts）
- `src/services/` — 业务逻辑（SMS解析/通知监听/物流API/OCR）
- `src/patterns/` — 快递短信/通知正则规则
- `src/components/` — UI 组件（PackageCard, SummaryBanner 等）
- `src/hooks/` — usePackages, usePermissions
- `app/` — expo-router 页面（首页/手动/详情/设置）
- `modules/` — 自定义原生 Kotlin 模块（通知/SMS/OCR/挂件）
