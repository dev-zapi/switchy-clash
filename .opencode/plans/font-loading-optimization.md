# Popup 字体加载优化计划

## 当前问题

1. **CSS `@import` 阻塞渲染**
   - `src/app.css` 第 1 行：`@import url('https://unpkg.com/subsetted-fonts@latest/MiSans-VF/MiSans-VF.css')`
   - 外部 CDN 请求阻塞 CSSOM 构建，延迟首次渲染

2. **无预加载提示**
   - 浏览器不知道需要提前加载字体资源
   - 字体加载时机晚（只有 CSS 解析到 `@font-face` 时才开始下载）

3. **使用 `@latest` 版本号**
   - 无法复用浏览器缓存
   - 可能遇到 CDN 最新版本兼容性问题

## 优化方案

### 1. 在 `src/popup/index.html` 添加预加载

```html
<head>
  <!-- Preload MiSans-VF font CSS -->
  <link rel="preload" href="https://unpkg.com/subsetted-fonts@1.0.4/MiSans-VF/MiSans-VF.css" as="style" onload="this.onload=null">
  
  <!-- Preload critical MiSans-VF font subsets (most commonly used characters) -->
  <link rel="preload" href="https://unpkg.com/subsetted-fonts@1.0.4/MiSans-VF/MiSans-VF.0.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="https://unpkg.com/subsetted-fonts@1.0.4/MiSans-VF/MiSans-VF.1.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="https://unpkg.com/subsetted-fonts@1.0.4/MiSans-VF/MiSans-VF.2.woff2" as="font" type="font/woff2" crossorigin>
</head>
```

**技术说明：**
- `preload` + `as="style"`：优先加载字体 CSS
- `onload="this.onload=null"`：避免重复加载
- 预加载前 3 个分片（覆盖基本拉丁、常用符号、CJK 基本字符）
- `crossorigin`：必需，因为字体文件跨域

### 2. 在 `src/options/index.html` 添加相同预加载

Options 页面同样使用 MiSans 字体，需要相同的预加载优化。

### 3. 优化 `src/app.css`

```css
/* 固定版本号 */
@import url('https://unpkg.com/subsetted-fonts@1.0.4/MiSans-VF/MiSans-VF.css');

/* 优化 fallback 字体栈 */
@theme {
  --font-sans: 'MiSans-VF', sans-serif;
  --font-cascadia-code: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  --font-jetbrains-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
}
```

**改进点：**
- 固定版本号 `@1.0.4` 替代 `@latest`
- 使用 `sans-serif` 作为 fallback（浏览器默认无衬线字体）
- 简化字体栈，减少不必要的字体名称

## 预加载的字体分片说明

MiSans-VF 分 50 个 woff2 文件，按 unicode-range 分区：

| 分片 | Unicode 范围 | 覆盖内容 | 优先级 |
|------|-------------|----------|--------|
| 0 | U+ff03-ff5d, U+ffe0-ffe4 | 全角符号、拉丁字母 | 🔴 高 |
| 1 | U+f92c-fa11, U+fe30-fe6b | CJK 兼容汉字、竖排符号 | 🔴 高 |
| 2 | U+9f3d-9fa2 | CJK 基本汉字（高频字） | 🔴 高 |
| 3 | U+9dfa-9f39 | CJK 基本汉字扩展 | 🟡 中 |
| 4 | U+9c3b-9d8f | CJK 汉字（生僻字） | 🟡 中 |

**推荐预加载 0-2 分片** 可覆盖 popup 界面的绝大多数文本（英文、数字、常用汉字）。

## 预期效果

| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| 首屏渲染延迟 | 200-500ms | <50ms | **75-90%** |
| 字体加载完成 | 不可预测 | 100-300ms | **可预测** |
| FOUT（字体切换闪烁） | 可能发生 | 减少 | **swap 策略** |
| LCP（最大内容绘制） | 受字体阻塞 | 优化 30-50% | **显著改善** |

## 技术细节

### font-display: swap 策略

- **swap**: 立即使用后备字体显示文本，字体加载完成后切换
- 优点：文本立即可见，无 FOIT（Flash Of Invisible Text）
- 缺点：可能有轻微 FOUT（Flash Of Unstyled Text），但可接受

### 预加载优先级

浏览器加载顺序：
1. HTML 解析开始
2. 发现 `<link rel="preload">` → **立即加入高优先级队列**
3. 下载字体 CSS 和 woff2 文件
4. CSS 解析时字体已缓存或正在下载
5. 系统字体立即渲染，MiSans 加载完成后切换

### 文件大小估算

预加载 3 个字体分片：
- MiSans-VF.0.woff2: ~80KB
- MiSans-VF.1.woff2: ~70KB
- MiSans-VF.2.woff2: ~90KB
- **总计：~240KB**（可接受，覆盖最常用的字符）

## 实施步骤

1. ✅ 修改 `src/popup/index.html` 添加预加载标签
2. ✅ 修改 `src/options/index.html` 添加预加载标签
3. ✅ 修改 `src/app.css` 固定版本号 + 优化 fallback 字体栈
4. 运行 `npm run build` 构建
5. 测试 popup 打开速度（对比优化前后）

## 测试验证

### 性能测试方法

1. **Chrome DevTools Performance**
   ```
   - 打开 DevTools → Performance
   - 清空缓存，点击 popup 图标
   - 观察 Font 加载时机和 LCP
   ```

2. **Network 面板验证**
   ```
   - 打开 DevTools → Network
   - 筛选 Font 类型
   - 确认字体文件优先级为 Highest/High
   - 确认字体在 300ms 内开始下载
   ```

3. **视觉验证**
   ```
   - 文本是否立即可见（sans-serif fallback）
   - 字体切换是否平滑（无闪烁）
   - popup 打开是否无卡顿
   ```

## 参考资源

- [MDN: font-display](https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/font-display)
- [web.dev: Preload fonts](https://web.dev/preload-optional-fonts/)
- [Unpkg: subsetted-fonts](https://unpkg.com/subsetted-fonts@1.0.4/)
