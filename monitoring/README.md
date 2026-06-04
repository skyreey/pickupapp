# 取件通 (PickupApp) — 监控方案

> v1.0 最小可用监控

---

## 1. 监控概览

由于取件通是客户端为主的App（非在线服务），监控重点在于：

| 监控对象 | 优先级 | 工具 |
|----------|--------|------|
| App崩溃 | P0 | 酷安/用户反馈（无自动上报） |
| 后端激活服务 | P1 | 手动curl健康检查 |
| 用户反馈异常 | P1 | 酷安评论区巡查 |
| APK下载量 | P2 | GitHub Release统计 |

---

## 2. 后端健康检查

激活验证服务（server/index.js）监控：

```bash
# 健康检查（每30分钟cron）
curl -f https://your-server.com/health || echo "服务异常"

# 验证API可用性
curl -X POST https://your-server.com/verify \
  -H "Content-Type: application/json" \
  -d '{"code":"TEST_CODE","deviceId":"test"}'
```

### 告警阈值

| 指标 | 正常 | 告警 |
|------|------|------|
| 健康检查 | HTTP 200 | 连续3次失败 |
| API响应时间 | <2s | >5s |
| 激活成功率 | >95% | <80% |

---

## 3. 客户端异常监控

v1.0不引入崩溃上报SDK（保持隐私），采用以下替代方案：

- **设置页内嵌"反馈"入口** — 用户遇到问题可即时反馈
- **GitHub Issues监控** — 设置Watch，关注新Issue
- **酷安评论区** — 每日手动check

v2.0可考虑：
- Firebase Crashlytics（需权衡隐私）
- 自建轻量崩溃日志收集

---

## 4. 监控日程

| 频率 | 操作 | 负责人 |
|------|------|--------|
| 每日 | 酷安评论区 + 评分检查 | @carl |
| 每周 | GitHub Issues巡检 | @carl |
| 每月 | 生成健康报告 `monitoring/Health_Report_YYYY-MM.md` | Feedback Analyzer Agent |
