# Clash API Reference

基于 mihomo (Clash Meta) 内核 API 文档

文档来源: https://wiki.metacubex.one/api/

---

## Base URL

```
http://127.0.0.1:9090
```

Default port: `9090` (configurable in Clash config)

**认证:** 如果设置了 `secret`，需要在请求头中添加：
```
Authorization: Bearer ${secret}
```

---

## System Info

### Get Version
```http
GET /version
```

获取 Clash 版本信息。

**Response:**
```json
{
  "premium": true,
  "version": "v1.18.0",
  "meta": true
}
```

### Get Memory Usage
```http
GET /memory
```

获取实时内存占用，单位 kb。

**Response:**
```json
{
  "inuse": 10240,
  "oslimit": 0
}
```

---

## Logging

### Stream Logs (SSE)
```http
GET /logs
```

获取实时日志流（Server-Sent Events）。

**Query Parameters:**
- `level` - 日志级别: `debug`, `info`, `warning`, `error`

**Response:**
```
event: message
data: {"type": "info", "payload": "[TCP] 127.0.0.1:54321 --> www.google.com:443 match DomainSuffix(google.com) using Proxy"}
```

---

## Traffic Statistics

### Stream Traffic (SSE)
```http
GET /traffic
```

获取实时流量信息，单位 kbps。

**Response:**
```
event: message
data: {"up": 1024, "down": 2048}
```

---

## Configuration

### Get Current Config
```http
GET /configs
```

获取当前运行的基本配置。

**Response:**
```json
{
  "port": 7890,
  "socks-port": 7891,
  "redir-port": 7892,
  "mixed-port": 7890,
  "allow-lan": true,
  "mode": "rule",
  "log-level": "info",
  "ipv6": false,
  "external-controller": "127.0.0.1:9090"
}
```

### Reload Config
```http
PUT /configs?force=true
Content-Type: application/json

{
  "path": "",
  "payload": ""
}
```

重新加载配置。必须发送数据，URL需携带 `?force=true` 强制执行。

**注意:** 如果路径不在 Clash 工作目录，需要设置 `SAFE_PATHS` 环境变量将其加入安全路径。

### Partial Update Config
```http
PATCH /configs
Content-Type: application/json

{
  "mixed-port": 7890,
  "mode": "rule",
  "log-level": "info"
}
```

更新基本配置，按需修改需要更新的配置项。

### Update GEO Database
```http
POST /configs/geo
Content-Type: application/json

{}
```

更新 GEO 数据库。

### Restart Core
```http
POST /restart
Content-Type: application/json

{}
```

重启内核。

---

## Upgrade

### Upgrade Core
```http
POST /upgrade
Content-Type: application/json

{}
```

更新内核版本。

### Upgrade Web UI
```http
POST /upgrade/ui
```

更新 Web 面板。须先设置 `external-ui`。

### Upgrade GEO Database
```http
POST /upgrade/geo
Content-Type: application/json

{}
```

更新 GEO 数据库。

---

## Proxy Groups (策略组)

### Get All Groups
```http
GET /group
```

获取所有策略组信息。

**Response:**
```json
{
  "proxies": {
    "GLOBAL": {
      "name": "GLOBAL",
      "type": "Selector",
      "now": "香港节点",
      "all": ["香港节点", "美国节点", "直连"]
    },
    "自动选择": {
      "name": "自动选择",
      "type": "URLTest",
      "now": "香港节点",
      "all": ["香港节点", "美国节点"]
    }
  }
}
```

### Get Specific Group
```http
GET /group/{group_name}
```

获取特定策略组信息。

**Example:** `GET /group/GLOBAL`

### Clear Group Fixed Selection
```http
DELETE /group/{group_name}
```

清除自动策略组的 fixed 选择。

### Test Group Latency
```http
GET /group/{group_name}/delay?url=xxx&timeout=5000
```

对指定策略组内的节点进行延迟测试，返回新的延迟信息，并清除自动策略组的 fixed 选择。

**Query Parameters:**
- `url` - 测试 URL
- `timeout` - 超时时间（毫秒，默认 5000）

---

## Proxies

### Get All Proxies
```http
GET /proxies
```

获取所有代理信息。

**Response:**
```json
{
  "proxies": {
    "GLOBAL": {
      "name": "GLOBAL",
      "type": "Selector",
      "now": "香港节点",
      "all": ["香港节点", "美国节点", "直连"]
    },
    "香港节点": {
      "name": "香港节点",
      "type": "Shadowsocks",
      "history": [
        {"time": "2024-01-01T00:00:00Z", "delay": 150}
      ]
    }
  }
}
```

### Get Specific Proxy
```http
GET /proxies/{proxy_name}
```

获取特定代理信息。

**Example:** `GET /proxies/香港节点`

### Switch Proxy
```http
PUT /proxies/{proxy_name}
Content-Type: application/json

{
  "name": "香港节点"
}
```

选择特定的代理。

**Example:** 切换 GLOBAL 到 "香港节点"
```http
PUT /proxies/GLOBAL
Content-Type: application/json

{
  "name": "香港节点"
}
```

### Test Proxy Latency
```http
GET /proxies/{proxy_name}/delay?url=xxx&timeout=5000
```

对指定代理进行延迟测试。

**Query Parameters:**
- `url` - 测试 URL（默认: http://www.gstatic.com/generate_204）
- `timeout` - 超时时间（毫秒，默认 5000）

---

## Proxy Providers (代理集合)

### Get All Proxy Providers
```http
GET /providers/proxies
```

获取所有代理集合的信息。

### Get Specific Provider
```http
GET /providers/proxies/{provider_name}
```

获取特定代理集合的信息。

### Update Provider
```http
PUT /providers/proxies/{provider_name}
```

更新代理集合（从远程拉取最新配置）。

### Health Check Provider
```http
GET /providers/proxies/{provider_name}/healthcheck
```

触发特定代理集合的健康检查。

### Test Provider Proxy
```http
GET /providers/proxies/{provider_name}/{proxy_name}/healthcheck?url=xxx&timeout=5000
```

对代理集合内的指定代理进行延迟测试。

---

## Rules

### Get All Rules
```http
GET /rules
```

获取所有规则信息。

**Response:**
```json
{
  "rules": [
    {
      "type": "DOMAIN-SUFFIX",
      "payload": "google.com",
      "proxy": "Proxy"
    },
    {
      "type": "GEOIP",
      "payload": "CN",
      "proxy": "DIRECT"
    }
  ]
}
```

---

## Rule Providers (规则集合)

### Get All Rule Providers
```http
GET /providers/rules
```

获取所有规则集合的信息。

### Update Rule Provider
```http
PUT /providers/rules/{provider_name}
```

更新规则集合。

---

## Connection Management

### Get All Connections
```http
GET /connections
```

获取所有活跃连接信息。

**Response:**
```json
{
  "downloadTotal": 1024000,
  "uploadTotal": 512000,
  "connections": [
    {
      "id": "conn-id",
      "metadata": {
        "network": "tcp",
        "type": "HTTP",
        "sourceIP": "127.0.0.1",
        "destinationIP": "1.2.3.4",
        "sourcePort": "54321",
        "destinationPort": "443",
        "host": "www.google.com"
      },
      "upload": 1024,
      "download": 2048,
      "start": "2024-01-01T00:00:00Z",
      "chains": ["Proxy", "香港节点"],
      "rule": "DOMAIN-SUFFIX",
      "rulePayload": "google.com"
    }
  ]
}
```

### Close All Connections
```http
DELETE /connections
```

关闭所有活跃连接。

### Close Specific Connection
```http
DELETE /connections/{id}
```

关闭特定连接。

---

## DNS Query

### Query DNS
```http
GET /dns/query?name=example.com&type=A
```

获取指定名称和类型的 DNS 查询数据。

**Query Parameters:**
- `name` - 域名（必需）
- `type` - 记录类型: `A`, `AAAA`, `CNAME`, `MX`, `TXT`, `SRV`, `NS` 等（默认 A）

---

## Cache

### Flush FakeIP Cache
```http
POST /cache/fakeip/flush
```

清除 FakeIP 缓存。

---

## DEBUG (需要日志级别为 debug)

### Force GC
```http
PUT /debug/gc
```

主动触发垃圾回收。

### Get Pprof Info
```http
GET /debug/pprof
```

获取性能分析信息。

**注意:** 需要内核启动时日志级别为 `debug`。

可用端点:
- `/debug/pprof/allocs` - 内存分配情况
- `/debug/pprof/heap` - 堆内存使用详情

**查看图形化报告:**
```bash
go tool pprof -http=:8080 http://127.0.0.1:9090/debug/pprof/heap
go tool pprof -http=:8080 http://127.0.0.1:9090/debug/pprof/allocs
```

---

## JavaScript Examples

### Connect to Logs via EventSource
```javascript
const eventSource = new EventSource('http://127.0.0.1:9090/logs?level=info');
eventSource.onmessage = (event) => {
  const log = JSON.parse(event.data);
  console.log(log.payload);
};
```

### Connect to Traffic via EventSource
```javascript
const eventSource = new EventSource('http://127.0.0.1:9090/traffic');
eventSource.onmessage = (event) => {
  const traffic = JSON.parse(event.data);
  console.log(`Up: ${traffic.up}, Down: ${traffic.down}`);
};
```

### Switch Proxy with Auth
```javascript
fetch('http://127.0.0.1:9090/proxies/GLOBAL', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-secret'
  },
  body: JSON.stringify({ name: '香港节点' })
});
```

---

## Error Responses

所有错误返回 JSON 格式:

```json
{
  "message": "Proxy not found"
}
```

常见状态码:
- `200` - Success
- `400` - Bad Request
- `404` - Not Found
- `500` - Internal Server Error

---

## API Summary

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/version` | GET | 获取版本信息 |
| `/memory` | GET | 获取内存占用 |
| `/logs` | GET | 实时日志流 |
| `/traffic` | GET | 实时流量流 |
| `/configs` | GET/PUT/PATCH | 配置管理 |
| `/configs/geo` | POST | 更新 GEO 数据库 |
| `/restart` | POST | 重启内核 |
| `/upgrade` | POST | 更新内核 |
| `/upgrade/ui` | POST | 更新 Web UI |
| `/upgrade/geo` | POST | 更新 GEO 数据库 |
| `/group` | GET | 获取所有策略组 |
| `/group/{name}` | GET/DELETE | 策略组详情/清除固定选择 |
| `/group/{name}/delay` | GET | 测试策略组延迟 |
| `/proxies` | GET | 获取所有代理 |
| `/proxies/{name}` | GET/PUT | 代理详情/切换代理 |
| `/proxies/{name}/delay` | GET | 测试代理延迟 |
| `/providers/proxies` | GET | 所有代理集合 |
| `/providers/proxies/{name}` | GET/PUT | 代理集合详情/更新 |
| `/providers/proxies/{name}/healthcheck` | GET | 代理集合健康检查 |
| `/providers/proxies/{p}/{proxy}/healthcheck` | GET | 测试集合内代理延迟 |
| `/rules` | GET | 获取所有规则 |
| `/providers/rules` | GET | 所有规则集合 |
| `/providers/rules/{name}` | PUT | 更新规则集合 |
| `/connections` | GET/DELETE | 连接管理 |
| `/connections/{id}` | DELETE | 关闭特定连接 |
| `/dns/query` | GET | DNS 查询 |
| `/cache/fakeip/flush` | POST | 清除 FakeIP 缓存 |
| `/debug/gc` | PUT | 强制垃圾回收 |
| `/debug/pprof` | GET | 性能分析 |
