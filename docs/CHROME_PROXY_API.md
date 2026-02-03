# Chrome Extension Proxy APIs

## Overview
Chrome extensions can control proxy settings through several APIs. This document covers available interfaces for proxy configuration.

## 1. chrome.proxy API

**Status:** Available in Manifest V2 and V3 (with limitations)

**Permission Required:**
```json
"permissions": ["proxy"]
```

### Configuration Modes

#### Fixed Servers Mode
```javascript
chrome.proxy.settings.set({
  value: {
    mode: "fixed_servers",
    rules: {
      singleProxy: {
        scheme: "http",
        host: "127.0.0.1",
        port: 7890
      },
      bypassList: ["localhost", "127.0.0.1"]
    }
  },
  scope: "regular"
});
```

#### PAC Script Mode
```javascript
chrome.proxy.settings.set({
  value: {
    mode: "pac_script",
    pacScript: {
      url: "http://example.com/proxy.pac"
      // or
      // data: "function FindProxyForURL(url, host) { return 'PROXY 127.0.0.1:7890'; }"
    }
  },
  scope: "regular"
});
```

#### System Mode (Reset to system default)
```javascript
chrome.proxy.settings.set({
  value: {
    mode: "system"
  },
  scope: "regular"
});
```

#### Direct Mode (No proxy)
```javascript
chrome.proxy.settings.set({
  value: {
    mode: "direct"
  },
  scope: "regular"
});
```

### Reading Current Proxy Settings
```javascript
chrome.proxy.settings.get({}, (config) => {
  console.log(config.value);
});
```

### Proxy Rules Structure
```javascript
{
  singleProxy: { scheme, host, port },        // Use single proxy for all
  proxyForHttp: { scheme, host, port },       // HTTP only
  proxyForHttps: { scheme, host, port },      // HTTPS only
  proxyForFtp: { scheme, host, port },        // FTP only
  fallbackProxy: { scheme, host, port },      // Fallback for other protocols
  bypassList: ["localhost", "127.0.0.1", "*.example.com"]
}
```

### Schemes
- `http` - HTTP proxy
- `https` - HTTPS proxy  
- `socks4` - SOCKS4 proxy
- `socks5` - SOCKS5 proxy

### Scope Levels
- `regular` - Regular profile settings
- `incognito_persistent` - Incognito mode (persistent across sessions)
- `incognito_session_only` - Incognito mode (session only)

## 2. chrome.webRequest API

**Status:** Available but limited in Manifest V3

**Permission Required:**
```json
"permissions": ["webRequest", "webRequestBlocking"]
```

**Note:** In Manifest V3, `webRequestBlocking` is limited. Use `declarativeNetRequest` instead for blocking/modifying requests.

### Intercepting Requests
```javascript
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    console.log("Request:", details.url);
    // Can redirect or block
    return { cancel: false };
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);
```

## 3. chrome.webRequest.onAuthRequired

**Status:** Available in Manifest V2 and V3

Handle proxy authentication:
```javascript
chrome.webRequest.onAuthRequired.addListener(
  (details, callback) => {
    callback({
      authCredentials: {
        username: "user",
        password: "pass"
      }
    });
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);
```

## 4. Declarative Net Request API (Manifest V3)

**Status:** Recommended for Manifest V3

**Permission Required:**
```json
"permissions": ["declarativeNetRequest"]
```

**Note:** This API is primarily for blocking/redirecting requests, not for proxy configuration.

## 5. Proxy Bypass Patterns

Supported patterns in `bypassList`:
```
[
  "localhost",           // Exact match
  "127.0.0.1",           // IP address
  "*.example.com",       // Wildcard subdomain
  "*example.com",        // Wildcard prefix
  "example.com:8080",    // With port
  "192.168.1.1/24",      // CIDR notation (not always supported)
  "<local>"             // All local addresses (loopback, link-local, etc.)
]
```

## 6. PAC Script Format

```javascript
function FindProxyForURL(url, host) {
  // Direct connection for local addresses
  if (isPlainHostName(host) ||
      shExpMatch(host, "*.local") ||
      isInNet(dnsResolve(host), "10.0.0.0", "255.0.0.0") ||
      isInNet(dnsResolve(host), "172.16.0.0", "255.240.0.0") ||
      isInNet(dnsResolve(host), "192.168.0.0", "255.255.0.0") ||
      isInNet(dnsResolve(host), "127.0.0.0", "255.255.255.0")) {
    return "DIRECT";
  }
  
  // Use proxy for specific domains
  if (shExpMatch(host, "*.google.com")) {
    return "PROXY 127.0.0.1:7890";
  }
  
  // Default proxy
  return "PROXY 127.0.0.1:7890; DIRECT";
}
```

PAC Functions Available:
- `isPlainHostName(host)` - Returns true if no domain name
- `dnsDomainIs(host, domain)` - Domain match
- `localHostOrDomainIs(host, hostdom)` - Local match
- `isResolvable(host)` - Can resolve DNS
- `isInNet(ip, pattern, mask)` - IP in network
- `dnsResolve(host)` - Resolve to IP
- `myIpAddress()` - Get client IP
- `shExpMatch(str, pattern)` - Shell pattern match
- `weekdayRange()`, `dateRange()`, `timeRange()` - Time-based rules

## 7. Important Considerations

### Platform Differences
- **Windows:** Full support
- **macOS:** Full support
- **Linux:** May require additional setup
- **Chrome OS:** Limited support

### Conflict with System Settings
- Extension proxy settings override system proxy
- Last extension to set proxy wins
- Users can disable extension proxy control

### Security
- HTTPS sites may show warnings with certain proxies
- Certificate validation may fail with MITM proxies
- PAC scripts execute with extension privileges

## 8. Integration with Clash

Since Clash runs as a local proxy (typically 127.0.0.1:7890), the extension should:

1. **Configure Chrome to use Clash:**
```javascript
chrome.proxy.settings.set({
  value: {
    mode: "fixed_servers",
    rules: {
      singleProxy: {
        scheme: "http",
        host: "127.0.0.1",
        port: 7890
      },
      bypassList: ["localhost", "127.0.0.1", "<local>"]
    }
  },
  scope: "regular"
});
```

2. **Monitor Clash mode changes:**
   - Clash Mode: Global / Rule / Direct
   - Extension should sync proxy settings accordingly

3. **Alternative: Use SwitchyOmega approach**
   - Don't directly set system proxy
   - Provide quick toggle to enable/disable Clash proxy
   - Let users choose when to route through Clash

## References

- [Chrome Proxy API Documentation](https://developer.chrome.com/docs/extensions/reference/proxy/)
- [PAC Specification](https://web.archive.org/web/20070602031929/http://wp.netscape.com/eng/mozilla/2.0/relnotes/demo/proxy-live.html)
- [Chrome WebRequest API](https://developer.chrome.com/docs/extensions/reference/webRequest/)
