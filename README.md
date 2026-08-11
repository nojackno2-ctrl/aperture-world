# Aperture World · 互動攝影練習場 📷

[![React 19](https://img.shields.io/badge/React-19.2.6-61dafb.svg?style=flat-square&logo=react)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-0.185.1-black.svg?style=flat-square&logo=threedotjs)](https://threejs.org/)
[![Vinext](https://img.shields.io/badge/Vinext-1.0.0--beta.2-blueviolet.svg?style=flat-square)](https://vinext.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6.svg?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-f38020.svg?style=flat-square&logo=cloudflare)](https://workers.cloudflare.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg?style=flat-square)](LICENSE)

> **「十一個全 3D 場景，一台全片幅相機。轉動曝光三要素，在瀏覽器中感受快門與光影的魅力。」**

**Aperture World** 是一款基於 WebGL2 與物理光學模擬的網頁版專業攝影練習遊戲。無論你是剛接觸攝影的初學者、想磨練決定性瞬間的快門反應，或是想在沒有實體相機的情況下理解**光圈（Aperture）**、**快門速度（Shutter Speed）**、**感光度（ISO）**與**鏡頭焦距（Focal Length）**的連動關係，Aperture World 都能提供最極致擬真且流暢的掌上攝影體驗。

---

## 🌟 核心特色 (Key Features)

### 1. 🎛️ 專業級全片幅相機操控系統
* **五大專業曝光模式**：支援 `AUTO`（全自動）、`P`（程式自動）、`S`（快門先決）、`A`（光圈先決）、`M`（全手動）模式。
* **1/3 EV 階細緻微調**：快門速度（1/32000s 至 30s 長曝光）、光圈值（F1.2 至 F22）、ISO（50 至 102400）均遵循真實相機梯階。
* **智慧曝光補償與安全快門**：支援 -3.0 EV 至 +3.0 EV 曝光補償，內建鏡頭焦段安全快門防手震邏輯（自動模式下防止安全快門過慢）。
* **多區與點測光模擬**：即時分析畫面中心與環境發光體，計算物體反光率與入射角，呈現最真實的測光讀數。

### 2. 🔭 真實物理光學與景深散景模擬
* **Circle of Confusion (彌散圓) 物理光學計算**：依據 35mm 全片幅感光元件尺寸、焦距、光圈值與物距，精準計算前景、主體與背景的散景模糊半徑。
* **十七款旗艦專業鏡頭群 (包含 6 款變焦與 11 款大光圈定焦)**：
  * **12–24 mm F2.8**：旗艦超廣角大三元（適合壯闊風景、星空銀河）
  * **16–35 mm F2.8 II**：二代廣角大三元（適合風景建築、街拍環境）
  * **24–70 mm F2.8 II**：二代標準大三元鏡皇（適合全方位日常、人像街拍）
  * **28–70 mm F2.0**：F2 超大光圈標準變焦（媲美多支定焦的頂級散景）
  * **70–200 mm F2.8 II**：二代望遠大三元（具備光學防手震，適合人像、運動賽事）
  * **100–400 mm F4.5–5.6**：超遠攝變焦鏡（適合生態、鳥類、航空起降）
  * **14 mm F1.8 / 24 mm F1.4 / 35 mm F1.4**：廣角與人文大光圈定焦群（極致星空、夜景與街拍）
  * **50 mm F1.2 / 50 mm F1.4 / 85 mm F1.4 II**：人像與標準大光圈定焦群（極淺景深、奶油散景）
  * **100 mm F2.8 APD / 135 mm F1.8**：特殊柔焦與空氣切割機人像定焦
  * **300 mm F2.8 / 400 mm F2.8 / 600 mm F4.0**：專業超遠攝旗艦巨砲（運動賽事與飛羽生態）
* **中心自動對焦 (AF) 系統**：即時光學測距，提供「點: S / 點: M / 點: L」三段可調 AF 框尺寸。

### 3. ⚡ 旗艦級高速連拍與寫入緩衝
* **多種過片模式 (Drive Modes)**：
  * **Single**：單張拍攝
  * **Burst Hi+ (30 fps)**：每秒 30 張旗艦級高速連拍
  * **Burst Mid (15 fps)**：每秒 15 張標準連拍
  * **Burst Lo (5 fps)**：每秒 5 張省電低速連拍
* **擬真寫入緩衝區 (Buffer Memory)**：內建 300 張高速寫入緩衝量表、10 fps 記憶卡寫入節奏與 2,000 張記憶卡容量限制，逼真還原連拍塞緩衝的拍攝手感。

### 4. 🖼️ 專業相片庫、完整 EXIF 與直方圖分析
* **無失真原圖檢視**：支援全解析度相片即時預覽與縮放。
* **完整 EXIF 參數紀錄**：快門速度、光圈、ISO、焦距、測光模式、過片模式、拍攝時間與曝光評分。
* **即時三色與亮度直方圖**：提供 RGB 各通道與 Luminance 亮度分佈，即時檢查高光溢出與暗部死黑。
* **相片管理**：支援單張相片刪除、鍵盤快速翻頁與一鍵清空相片庫。

### 5. 📱 極致跨平台與響應式介面 (Desktop & Mobile)
* **桌面端體驗**：支援滑鼠自由視角轉動、滾輪無段變焦、全鍵盤快捷鍵操作與一鍵全螢幕模式。
* **行動端體驗**：專屬手機橫直向觸控控制台、拇指滾輪滑桿調整、觸控防誤觸機制與全螢幕 API 最佳化。

---

## 🌄 11 大 3D 主題攝影訓練場景

Aperture World 內建 11 個完全使用 Three.js 程序化生成的全 3D 場景，涵蓋各種光影條件與運動速度：

| 編號 | 場景名稱 | 光線與環境條件 (EV) | 推薦拍攝技巧與核心課題 |
| :--- | :--- | :--- | :--- |
| **01** | **清晨風景 · 山谷第一道光** | `EV 12.4` · 晨曦高反差 | 縮小光圈（F8–F16）獲得大景深，保留天空與山巒細節。 |
| **02** | **飛鳥 · 掠過濕地的飛鳥** | `EV 13.2` · 高速不規則移動 | 使用超遠攝長焦（200–300mm）與高速快門（1/1000s+）凝結飛羽。 |
| **03** | **運動賽事 · 終點前的衝刺** | `EV 11.8` · 高速直道衝刺 | 快門先決（1/800s+）捕捉運動員騰空瞬間，可切換連拍模式。 |
| **04** | **室內人像 · 窗邊自然光** | `EV 9.8` · 柔和側向自然光 | 大光圈（F1.4–F2.8）淺景深分離人物與背景，精準對焦在眼神。 |
| **05** | **團體合影 · 朋友們的紀念照** | `EV 12.8` · 前後排多人 | 避免過大光圈導致後排失焦，適度縮小光圈（F5.6–F11）保證全員清晰。 |
| **06** | **白天街拍 · 轉角的一秒** | `EV 14.2` · 街頭隨機光影 | 活用 P 模式或泛焦距離，快速捕捉行人與街景的環境敘事。 |
| **07** | **夜間街景 · 霓虹雨夜** | `EV 5.8` · 弱光霓虹與濕滑倒影 | 光圈全開、拉高 ISO 並維持手持安全快門（1/60s–1/125s）平衡噪點與亮度。 |
| **08** | **高山星夜 · 銀河與高山星夜** | `EV -4.5` · 極低光源星空 | 10–30 秒長曝光、最大光圈（F1.4–F2.8）、ISO 3200–12800，鎖定無限遠對焦。 |
| **09** | **俯瞰夜景 · 山頂萬家燈火** | `EV 3.8` · 遠距高反差夜景 | 腳架慢速快門（1–4 秒）搭配 F8–F11 獲得銳利夜景與漂亮星芒。 |
| **10** | **航空攝影 · 跑道上的鋼鐵巨鳥** | `EV 13.6` · 遠距離超高速起降 | 200–600mm 超長焦鏡頭，1/1000s 以上快門追焦起降客機與起落架。 |
| **11** | **戶外人像 · 陽光花園戶外人像** | `EV 12.2` · 斑駁戶外自然光 | 50–85mm 搭配大光圈 F1.4–F2.0，營造柔美紫藤花背景散景。 |

---

## ⌨️ 鍵盤快捷鍵與操作指南 (Controls)

### 桌面端快捷鍵 (Desktop)
* **滑鼠移動**：旋轉相機視角（尋找主體）
* **滑鼠滾輪**：調整鏡頭焦距（變焦 Zoom In / Zoom Out）
* **滑鼠點擊 / 空白鍵 (Space)**：單擊拍攝快門（**長按**可連續高速連拍）
* **`D` 鍵**：快速切換過片模式（Single ➔ Hi+ ➔ Mid ➔ Lo）
* **`P` 鍵**：開啟 / 關閉詳細參數調整面板（鏡頭選擇、AF 對焦框大小、測光模式等）
* **`G` 鍵**：開啟相片庫（Photo Library）
* **`H` 鍵**：隱藏 / 顯示 HUD 拍攝介面（適合沉浸式觀景）
* **`F` 鍵**：切換全螢幕模式
* **`ESC` 鍵**：釋放滑鼠指標鎖定 / 關閉彈出面板

### 觸控與行動端操作 (Mobile)
* **單指滑動視角**：轉動鏡頭方向。
* **底部控制台**：直覺點選快門、光圈、曝光補償、ISO，並透過拇指滑桿即時調節數值。
* **獨立實體感快門鍵**：支援輕觸單張與長按高速連拍。

---

## 🏗️ 系統架構與技術特點 (Architecture & Optimization)

Aperture World 採用現代前端與 WebGL 效能架構，確保在各種裝置上皆能達到 60–120 FPS 的極致流暢度：

```
Aperture World
├── app/
│   ├── page.tsx            # 相機頂層控制邏輯、曝光演算法、HUD 狀態與相片庫
│   ├── viewport.tsx        # Three.js 渲染管線、AF 對焦檢測、曝光擷取與畫布管理
│   ├── scene-kit.mjs       # 共用 3D 骨架人物、動物、物件模型與批次合併工具
│   ├── scene3d.mjs         # 11 大場景模組載入器與動態分塊排程 (Scene Chunks)
│   ├── scenes/             # 11 個獨立場景定義模組 (按需載入 / Lazy Loading)
│   ├── motion.mjs          # 主體運動軌跡、航線與快門次影格軌跡計算
│   ├── optics.mjs          # 物理光學計算 (Circle of Confusion、FOV、景深散景)
│   ├── world.mjs           # 場景光照、環境霧氣、測光反射率與俯仰限制配置
│   ├── histogram.tsx       # 高效能 TypedArray 直方圖取樣與 Canvas 視覺化
│   └── three-runtime.ts    # 精簡版 Three.js 匯出邊界 (減少 Production Bundle 大小)
├── tests/
│   └── rendered-html.test.mjs  # 光學計算、曝光契約、架構與 HTML 渲染自動化測試
```

### ⚡ 關鍵效能優化 (Performance Highlights)
1. **動態場景分塊 (Scene Code-Splitting)**：將龐大的 3D 場景拆分為 11 個獨立動態 chunk，初始頁面下載體積減少 43% 以上。
2. **共用中心射線探測 (Shared Center Raycasting)**：將自動對焦 (AF) 與測光射線檢測合併為單一射線檢測，遍歷次數減半。
3. **畫布集區複用 (Canvas Pooling)**：快門曝光合成與散景處理全面複用記憶體中的 Scratch Canvas，徹底消除 30fps 連拍時的 GC 停頓。
4. **32-bit TypedArray 膠粒加速**：以 `Uint32Array` 直寫底片膠粒噪點紋理，像素處理效能提升 400%。
5. **低功耗與無效渲染跳過**：當相機靜止或滑鼠拖曳達視角邊界時自動 Bail-out，相片庫開啟時自動暫停 3D 渲染迴圈。

---

## 🛠️ 本機開發與建置 (Development)

### 環境需求
* **Node.js**：`>= 22.13.0`
* **瀏覽器**：支援 WebGL2（建議開啟硬體加速）

### 快速開始
```bash
# 1. 複製專案庫
git clone https://github.com/nojackno2-ctrl/aperture-world.git
cd aperture-world

# 2. 安裝相依套件
npm install

# 3. 啟動本機開發伺服器
npm run dev
```
啟動後在瀏覽器開啟終端機輸出的本機網址（通常為 `http://localhost:3000`）。

### 驗證與測試
本專案包含嚴格的 TypeScript 型別檢查、ESLint 與完整的自動化測試套件：

```bash
# 執行完整建置與端對端測試
npm test

# 執行程式碼品質檢查
npm run lint

# 執行嚴格 TypeScript 型別檢查
npx tsc --noEmit --incremental false
```

### 部署至 Cloudflare Workers
專案已完全相容於 Cloudflare Workers / Pages：
```bash
npm run build
npx wrangler deploy dist/server/wrangler.json
```

---

## 📄 授權條款 (License)

本專案採用 [MIT License](LICENSE) 開源授權。歡迎自由體驗、學習與交流！
