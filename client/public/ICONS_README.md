# PWA Icons

為了讓 PWA 正常運作，你需要生成以下圖示檔案：

## 需要的檔案

1. `pwa-192x192.png` - 192x192 像素的 PNG 圖示
2. `pwa-512x512.png` - 512x512 像素的 PNG 圖示
3. `apple-touch-icon.png` - 180x180 像素的 PNG 圖示（iOS）
4. `mask-icon.svg` - Safari 的 pinned tab 圖示
5. `favicon.ico` - 瀏覽器標籤圖示

## 快速生成方式

### 方法 1：使用線上工具
1. 前往 https://realfavicongenerator.net/
2. 上傳你的 logo 或使用 `pwa-512x512.svg` 作為基礎
3. 下載生成的所有圖示並放入此資料夾

### 方法 2：使用 pwa-asset-generator（推薦）
```bash
# 安裝工具
npm install -g pwa-asset-generator

# 從 SVG 生成所有圖示
pwa-asset-generator ./pwa-512x512.svg ./public --icon-only --type png --opaque false
```

### 方法 3：手動轉換
使用任何圖像編輯工具（如 Figma、Photoshop、GIMP）將 SVG 轉換為所需尺寸的 PNG。

## 目前狀態

✅ `pwa-512x512.svg` - SVG 原始檔（已建立）
⏳ `pwa-192x192.png` - 需要生成
⏳ `pwa-512x512.png` - 需要生成
⏳ `apple-touch-icon.png` - 需要生成
⏳ `favicon.ico` - 需要更新為實際圖示
