# 📜 專案開發規格書：Project Marauder（劫盜者計畫）

| 欄位 | 內容 |
|------|------|
| **專案名稱** | 衛氏巫師法寶店（Weasleys' Wizard Wheezes）數位轉型平台 |
| **專案代號** | Project Marauder |
| **版本** | v1.0 |
| **文件狀態** | 草案（待榮恩加倍徵收稅確認） |
| **作者** | 喬治・衛斯理 / 弗雷・衛斯理 / 李亦婷 |
| **建立日期** | 2026-04-10 |
| **最後更新** | 2026-04-10 |

---

## 目錄

1. [專案概述](#一專案概述)
2. [使用者角色與權限](#二使用者角色與權限)
3. [技術架構建議](#三技術架構建議)
4. [功能規格](#四功能規格)
5. [介面規格](#五介面規格)
6. [驗收標準](#六驗收標準)
7. [開發里程碑](#七開發里程碑)
8. [風險與注意事項](#八風險與注意事項)

---

## 一、專案概述

### 1.1 專案目標

打造一個充滿驚喜與不確定性的電商平台，透過後台強大的「惡作劇控制系統（Prank Console）」，讓管理員（喬治與弗雷）能即時操控前台消費者的購物體驗，藉此對抗無聊的魔法部法規。

### 1.2 核心價值

| 面向 | 說明 |
|------|------|
| **前台** | 混亂、有趣、沉浸式的斜角巷購物感 |
| **後台** | 高度可控的商品管理、動態定價機制與突發事件觸發器 |
| **差異化** | 唯一一家會主動嚇跑顧客又能讓顧客上癮的魔法電商 |

### 1.3 專案範圍（Scope）

**納入（In-Scope）：**
- 商品瀏覽、搜尋、加入購物車、結帳
- 後台商品 CRUD 管理
- 惡搞模式（動態定價、音效、飛七圖層）
- 榮恩識別系統（家屬服務費）
- 緊急切換「文具店模式」（Mischief Managed）

**排除（Out-Scope）：**
- 真實金流串接（Galleon 不可兌換現金）
- 行動 App（iOS / Android）
- 多語言支援（僅繁體中文）
- 真實的石內卜教授

### 1.4 術語說明

| 術語 | 說明 |
|------|------|
| Galleon（金加隆） | 主要貨幣單位，1 Galleon = 17 Sickle |
| Sickle（銀閃） | 次要貨幣單位，1 Sickle = 29 Knut |
| Knut（納特） | 最小貨幣單位 |
| 榮恩稅 | 結帳總額 × 2 的家屬服務費邏輯 |
| 石內卜來訪 | 庫存歸零時觸發的缺貨警告狀態 |
| Prank Console | 後台惡作劇控制中心 |
| Mischief Managed | 緊急切換「普通文具店」模式的掩護機制 |

---

## 二、使用者角色與權限

### 2.1 角色定義

| 角色 | 識別方式 | 說明 |
|------|---------|------|
| **一般消費者** | 無特殊標記 | 瀏覽商品、加入購物車、結帳，需承受隨機惡搞特效 |
| **榮恩・衛斯理** | 結帳時自行申報 | 系統套用「家屬服務費 100%」，結帳金額 × 2 |
| **管理員（喬治/弗雷）** | 後台帳號密碼 | 擁有完整後台控制權限，可觸發全站特效 |

### 2.2 功能存取權限對照表

| 功能 | 一般消費者 | 榮恩 | 管理員 |
|------|:--------:|:----:|:------:|
| 瀏覽商品 | ✅ | ✅ | ✅ |
| 加入購物車 | ✅ | ✅ | ✅ |
| 結帳（正常價格） | ✅ | ❌ | ✅ |
| 結帳（加倍價格） | ❌ | ✅ | ❌ |
| 商品 CRUD | ❌ | ❌ | ✅ |
| 觸發惡搞模式 | ❌ | ❌ | ✅ |
| 觸發吼叫信模式 | ❌ | ❌ | ✅ |
| 觸發飛七巡邏 | ❌ | ❌ | ✅ |
| 啟用 Mischief Managed | ❌ | ❌ | ✅ |
| 「從辦公室偷回」庫存 | ❌ | ❌ | ✅ |

---

## 三、技術架構建議

### 3.1 技術選型

#### 前端

| 項目 | 選擇 | 理由 |
|------|------|------|
| 框架 | React 19 + TypeScript | 與現有 todo-app 技術棧一致，類型安全 |
| 建構工具 | Vite | 快速 HMR，與現有專案一致 |
| 樣式 | CSS Modules + CSS 變數 | 元件隔離，主題切換（惡搞/文具店模式） |
| 狀態管理 | Zustand | 輕量、適合商品/購物車/惡搞開關狀態 |
| 路由 | React Router v7 | 前後台路由分離 |
| 動畫 | Framer Motion | 飛七浮動圖層、頁面震動效果 |

#### 後端（MVP 階段可省略，用 localStorage）

| 項目 | 選擇 | 理由 |
|------|------|------|
| 執行環境 | Node.js + Express | 輕量，與前端同語言 |
| 資料庫 | Supabase（PostgreSQL） | 免費額度足夠，即時訂閱適合惡搞狀態同步 |
| 認證 | Supabase Auth | 管理員帳號管理 |

> **MVP 建議**：Phase 1-2 使用 `localStorage` 模擬後端，Phase 3 再接入 Supabase。

### 3.2 專案目錄結構

```
www-platform/
├── public/
│   ├── sounds/
│   │   └── howler.mp3          # 吼叫信音效
│   └── images/
│       ├── dark-mark.svg       # 黑魔標記
│       └── peeves.gif          # 飛七動圖
├── src/
│   ├── components/
│   │   ├── ProductCard/        # 商品卡片元件
│   │   ├── Cart/               # 購物車
│   │   ├── CheckoutModal/      # 結帳彈窗（含榮恩識別）
│   │   ├── PeevesLayer/        # 飛七浮動圖層
│   │   ├── HowlerAlert/        # 吼叫信音效元件
│   │   └── MisManagedOverlay/  # Mischief Managed 掩護介面
│   ├── pages/
│   │   ├── Storefront/         # 前台商店
│   │   ├── Admin/
│   │   │   ├── Dashboard/      # 後台總覽
│   │   │   ├── Products/       # 商品管理
│   │   │   └── PrankConsole/   # 惡作劇控制中心
│   │   └── StationeryShop/     # Mischief Managed 文具店頁面
│   ├── store/
│   │   ├── productStore.ts     # 商品狀態
│   │   ├── cartStore.ts        # 購物車狀態
│   │   └── prankStore.ts       # 惡搞模式開關狀態
│   ├── types/
│   │   └── index.ts            # 共用型別定義
│   ├── hooks/
│   │   ├── usePrankMode.ts     # 惡搞模式邏輯
│   │   └── usePageShake.ts     # 頁面震動計時器
│   └── App.tsx
├── package.json
└── vite.config.ts
```

### 3.3 資料模型

#### 商品（Product）

```typescript
interface Product {
  id: string;                    // UUID，格式：WWW-001-Puke
  name: string;                  // 商品名稱
  category: ProductCategory;     // 魔法類別（見下方 Enum）
  price: {
    galleon: number;             // 金加隆
    sickle: number;              // 銀閃
    knut: number;                // 納特
  };
  stock: number;                 // 庫存量（0 = 石內卜來訪）
  dangerLevel: 1 | 2 | 3 | 4 | 5; // 危險等級
  mediaUrl: string;              // .gif 或 .mp4 商品動圖 URL
  isHidden: boolean;             // 隱身咒開關（true = 前台不顯示）
  description: string;           // 商品描述
  createdAt: string;             // ISO 8601 時間戳記
}

type ProductCategory =
  | 'prank'         // 惡作劇
  | 'defense'       // 防禦咒
  | 'love_potion'   // 愛情魔藥
  | 'fireworks'     // 奇妙煙火
  | 'magical_beast' // 魔法生物
```

#### 系統設定（SystemConfig）

```typescript
interface SystemConfig {
  prankModeEnabled: boolean;      // 惡搞模式開關
  howlerModeEnabled: boolean;     // 吼叫信模式開關
  peevesPatrolActive: boolean;    // 飛七巡邏開關
  misManagedActive: boolean;      // Mischief Managed 掩護模式
  priceRandomMin: number;         // 惡搞定價係數下限（預設 0.5）
  priceRandomMax: number;         // 惡搞定價係數上限（預設 5.0）
}
```

#### 購物車項目（CartItem）

```typescript
interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  basePrice: number;             // 以 Knut 為最小單位計算
  displayPrice: number;          // 惡搞模式下的即時顯示價格
}
```

### 3.4 API 端點設計（若接入後端）

| 方法 | 路徑 | 說明 | 權限 |
|------|------|------|------|
| GET | `/api/products` | 取得所有商品（前台，排除隱藏） | 公開 |
| GET | `/api/products/all` | 取得所有商品（含隱藏） | 管理員 |
| POST | `/api/products` | 新增商品 | 管理員 |
| PUT | `/api/products/:id` | 更新商品 | 管理員 |
| PATCH | `/api/products/:id/stock` | 更新庫存（含「從辦公室偷回」） | 管理員 |
| DELETE | `/api/products/:id` | 刪除商品 | 管理員 |
| GET | `/api/config` | 取得系統設定 | 管理員 |
| PUT | `/api/config` | 更新系統設定（惡搞開關） | 管理員 |
| POST | `/api/checkout` | 提交訂單（含榮恩識別） | 公開 |

### 3.5 狀態管理（Zustand Stores）

**prankStore.ts** — 惡搞模式全域狀態
```typescript
interface PrankStore {
  prankModeEnabled: boolean;
  howlerModeEnabled: boolean;
  peevesPatrolActive: boolean;
  misManagedActive: boolean;
  togglePrankMode: () => void;
  toggleHowlerMode: () => void;
  triggerPeevesPatrol: () => void;
  activateMischiefManaged: () => void;  // 一鍵切換文具店
  deactivateMischiefManaged: () => void;
}
```

### 3.6 Mischief Managed 雙模式切換機制

```
[管理員按下 "Mischief Managed"]
         │
         ▼
  prankStore.activateMischiefManaged()
         │
         ├─ 關閉所有惡搞開關（prankMode、howler、peeves）
         ├─ 前台路由重導至 /stationery（普通文具店頁面）
         ├─ 後台顯示「文具店模式進行中」提示
         └─ localStorage 記錄原始商品資料（不清除）

[管理員按下 "Mischief Managed" 解除]
         │
         ▼
  prankStore.deactivateMischiefManaged()
         │
         └─ 前台路由恢復 /，惡搞設定恢復上次狀態
```

---

## 四、功能規格

### 4.1 商品上架系統（Product Management）

#### 商品欄位完整定義

| 欄位名稱 | 型態 | 規範 / 描述 |
|---------|------|------------|
| 商品 ID | UUID | 格式：`WWW-{序號}-{縮寫}`，如 `WWW-001-Puke` |
| 商品名稱 | String | 支援全形中文、魔法符文文字輸入，最多 50 字 |
| 魔法類別 | Enum | 惡作劇 / 防禦咒 / 愛情魔藥 / 奇妙煙火 / 魔法生物 |
| 定價 | Object | 包含 `galleon`、`sickle`、`knut` 三欄位（正整數） |
| 庫存量 | Integer | 最小值 0；值為 0 時觸發「石內卜來訪」邏輯 |
| 危險等級 | Slider | 1（安全）～ 5（極度危險），步進值 1 |
| 商品動圖 | File | 限 `.gif` 或 `.mp4`，大小上限 10MB |
| 隱身咒開關 | Boolean | `true` = 前台不渲染此商品（物理性消失） |
| 商品描述 | String | 最多 200 字，支援 Markdown 粗體 / 斜體 |

#### 庫存狀態機

```
庫存 > 0  ──→  [正常]   按鈕顯示：「立即交出金加隆」（可購買）
庫存 = 0  ──→  [缺貨]   圖片轉灰階，按鈕禁用，顯示：「石內卜來訪：已被沒收」
管理員按「從辦公室偷回」──→ 庫存恢復為 5，狀態回到 [正常]
```

### 4.2 後台控制中心（The Prank Console）

#### 可控開關與觸發器

| 控制項 | 類型 | 行為說明 |
|--------|------|---------|
| **惡搞模式** | Toggle | 開啟後，前台所有商品價格每 2 秒以 `Math.random() * (5 - 0.5) + 0.5` 係數即時跳動 |
| **吼叫信模式** | Toggle | 開啟後，前台自動播放音效：「再不買，石內卜教授要來了，快一點！」並顯示全螢幕警告橫幅 |
| **飛七巡邏** | 一次性觸發 | 在前台隨機位置生成飛七（Peeves）浮動圖層，移動 30 秒後自動消失 |
| **Mischief Managed** | 緊急切換 | 一鍵清除所有惡搞特效，前台偽裝為「怪洛克文具批發店」（普通文具店頁面） |

#### 惡搞模式技術規格

```javascript
// 惡搞定價邏輯（前端執行）
const getPrankPrice = (basePrice: number): number => {
  const multiplier = Math.random() * (5.0 - 0.5) + 0.5; // 0.5x ~ 5.0x
  return Math.round(basePrice * multiplier);
};

// 每 2000ms 重新計算一次
useEffect(() => {
  if (!prankModeEnabled) return;
  const interval = setInterval(() => {
    recalculateAllPrices(); // Zustand action
  }, 2000);
  return () => clearInterval(interval);
}, [prankModeEnabled]);
```

### 4.3 購物車與結帳邏輯

#### 結帳流程

```
用戶點擊「結帳」
     │
     ▼
彈出身份驗證視窗
「請問你是否為榮恩・衛斯理？」
[是的，我是榮恩] ──→ 在明細新增「家屬服務費 100%」
                       Total = Subtotal + Subtotal × 1.0
                              = Subtotal × 2
[不，我只是路過的] ──→ 維持原始小計
     │
     ▼
選擇配送方式
     │
     ▼
確認訂單送出
```

#### 配送方式選單

| 選項 | 代碼 | 說明 | 預估時間 |
|------|------|------|---------|
| 消影術 | `instant` | 瞬間送達，不保證完整性 | 即時 |
| 飛天掃帚 | `broom` | 快速空運 | 1-2 小時 |
| 騎士墜鬼馬 | `thestral` | 標準陸運（僅目睹死亡者可見配送員） | 1-3 天 |
| 騎士公車 | `knight_bus` | 社交體驗方案，途中可能繞路數次 | 不定 |

### 4.4 吼叫信模式（Howler Mode）

- 觸發時播放 `/sounds/howler.mp3`
- 同時在頁面頂部顯示全寬紅色橫幅，文字動態打字效果顯示：
  > 「再不買，石內卜教授要來了，快一點！」
- 橫幅每 10 秒閃爍一次，直到管理員手動關閉

### 4.5 飛七巡邏（Peeves Patrol）

- 觸發後在前台隨機 `(x, y)` 座標生成飛七浮動圖層（`position: fixed`）
- 飛七以 CSS animation 在畫面內不規則移動
- 若用戶點擊飛七圖層且購物車含有「誘餌炸彈」商品：
  - 飛七圖層觸發爆炸動畫（scale + opacity 漸出）
  - 飛七從頁面消失 **300 秒**後自動重現
- 否則點擊飛七無效果（配合角色性格）

---

## 五、介面規格

### 5.1 前台視覺規範

| 設計項目 | 規格 |
|---------|------|
| **整體風格** | 斜角巷木質窗框感，偏暖褐色與暗金色 |
| **背景** | 深褐色（`#2C1810`），帶半透明魔法藥水污漬圖案（SVG） |
| **主色** | 暗金色 `#C9972E` |
| **強調色** | 警告紅 `#8B0000`（危險等級 5 / 石內卜警告） |
| **字型** | 標題：`Cinzel` 魔法風格字型；內文：`Noto Serif TC` |
| **卡片排列** | 每個商品卡片隨機 `rotate: -1deg ~ 1deg`（略微歪斜感） |
| **頁面震動** | 每 10 秒觸發一次 `keyframes shake`（`translateX ±3px`，持續 500ms） |
| **黑魔標記** | 危險等級 = 5 時，卡片右上角顯示 SVG 黑魔標記，標題閃爍紅色 |

### 5.2 商品卡片元件規格（ProductCard）

```
┌──────────────────────────────┐◄─ 危險等級=5 時顯示 [黑魔標記]
│                              │
│   [商品動圖 / 圖片區域]       │
│   200px × 200px              │
│                              │
├──────────────────────────────┤
│  商品名稱（粗體，1-2 行）      │
│  魔法類別標籤                  │
│  危險等級：★★★☆☆              │
│                              │
│  💰 3 Galleon 5 Sickle       │  ◄─ 惡搞模式：數字每 2 秒跳動
│                              │
│  [立即交出金加隆] ←正常庫存    │
│  [石內卜來訪：已被沒收] ←缺貨  │  ◄─ 灰階圖片，按鈕禁用
└──────────────────────────────┘
```

### 5.3 後台管理介面佈局

```
┌──────────────────────────────────────────────────────┐
│  🔮 WWW 後台控制中心          [Mischief Managed] 🔴   │
├──────────────┬───────────────────────────────────────┤
│              │                                        │
│  📦 商品管理  │  [惡搞模式] ●────○  ON                 │
│              │  價格跳動係數：0.5x ～ 5.0x             │
│  🎭 Prank   │                                        │
│    Console  │  [吼叫信模式] ●────○  OFF               │
│              │                                        │
│  📊 訂單     │  [飛七巡邏] [觸發] 按鈕                  │
│              │                                        │
│              │  ─────────────────────────────         │
│              │  商品列表                               │
│              │  ID │ 名稱 │ 庫存 │ 危險 │ 操作         │
│              │  ... │ ... │  3  │ ★★★ │ 編輯/刪除     │
└──────────────┴───────────────────────────────────────┘
```

### 5.4 Mischief Managed 文具店頁面

- 路由：`/stationery`
- 頁面標題：「怪洛克文具批發股份有限公司」
- 陳列：普通鉛筆、橡皮擦、訂書機（假商品，不可購買）
- 背景色：純白 `#FFFFFF`，字型：標楷體
- 頁尾小字：「本店與任何魔法活動無關」

---

## 六、驗收標準

### 原始驗收標準

| 編號 | 測試案例 | 預期結果 |
|------|---------|---------|
| **AC-01** | 在後台將「測奸器」危險等級設為 5 | 前台對應商品出現黑魔標記，且標題變為閃爍紅色 |
| **AC-02** | 庫存歸零後，管理員點擊「從辦公室偷回」按鈕 | 庫存恢復為 5，前台「石內卜來訪」警語消失 |
| **AC-03** | 用戶在結帳彈窗承認自己是榮恩 | 系統在明細中新增一筆「家屬服務費 100%」並計算總價 |
| **AC-04** | 飛七出現時，點擊購買「誘餌炸彈」 | 飛七圖層觸發爆炸動畫並在頁面消失 300 秒 |

### 新增技術驗收標準

| 編號 | 測試案例 | 預期結果 |
|------|---------|---------|
| **AC-05** | 管理員開啟惡搞模式，等待 2 秒 | 前台所有商品價格數值更新，係數介於 0.5x ～ 5x |
| **AC-06** | 管理員關閉惡搞模式 | 前台所有商品價格立即恢復原始定價 |
| **AC-07** | 管理員點擊「Mischief Managed」 | 所有惡搞特效停止，前台路由切換至 `/stationery`，頁面顯示普通文具店 |
| **AC-08** | Mischief Managed 模式解除 | 前台路由恢復 `/`，惡搞設定恢復上次狀態 |
| **AC-09** | 將商品「隱身咒」開關設為 ON | 前台商品列表中該商品不渲染（DOM 中不存在） |
| **AC-10** | 吼叫信模式開啟 | 頁面頂部出現紅色橫幅，播放音效；音效因瀏覽器限制無法自動播放時，應顯示「點擊頁面任意處以啟動警報」提示 |

---

## 七、開發里程碑

### Phase 1 — 基礎架構 + 商品 CRUD（Week 1-2）
- [ ] 初始化 Vite + React + TypeScript 專案
- [ ] 建立 Zustand stores（product / cart / prank）
- [ ] 商品 CRUD 後台頁面（使用 localStorage）
- [ ] 前台商品列表基本顯示
- [ ] 商品卡片元件（含危險等級、庫存狀態）

### Phase 2 — 前台體驗 + 結帳（Week 3）
- [ ] 前台視覺套用（斜角巷風格）
- [ ] 頁面每 10 秒震動效果
- [ ] 購物車功能
- [ ] 榮恩識別彈窗 + 家屬服務費計算
- [ ] 配送方式選單

### Phase 3 — Prank Console（Week 4）
- [ ] 惡搞模式（動態定價）
- [ ] 吼叫信模式（音效 + 橫幅）
- [ ] 飛七巡邏圖層 + 誘餌炸彈互動
- [ ] 後台控制中心 UI

### Phase 4 — Mischief Managed + 上線準備（Week 5）
- [ ] Mischief Managed 模式（文具店頁面 + 一鍵切換）
- [ ] 全站 AC 驗收測試
- [ ] 響應式調整（桌面優先）
- [ ] 部署至 Vercel / Netlify

---

## 八、風險與注意事項

| 風險 | 說明 | 緩解方案 |
|------|------|---------|
| **瀏覽器音效限制** | 現代瀏覽器禁止頁面自動播放音效（autoplay policy） | 偵測 user gesture 後才播放，並顯示「點擊以啟動警報」提示（AC-10） |
| **Math.random 效能** | 惡搞模式每 2 秒重算所有商品價格，商品數量多時可能卡頓 | 使用 `useMemo` 惰性計算，商品超過 50 筆時改為 `requestAnimationFrame` 批次更新 |
| **法遵風險（魔法部）** | 動態定價可能觸發消費者保護法疑慮（麻瓜世界） | Mischief Managed 緊急切換提供即時掩護；上線前確認目標市場法規 |
| **SEO 衝突** | 惡搞模式下商品名稱閃爍/亂跳影響搜尋引擎索引 | 惡搞效果僅套用在視覺層（CSS/JS），HTML 結構保持穩定 |
| **榮恩誤觸** | 消費者不小心承認是榮恩導致加倍收費投訴 | 彈窗加入「我確定要承認我是榮恩」二次確認機制，並在收據顯示「您已自願申報家屬身份」 |

---

> ⚠️ **備註（Project Marauder）**
>
> 管理員需確保後台具備一鍵清理功能。若魔法部官員來訪，後台必須能切換為「普通的文具店」模式，此功能稱為「惡作劇完畢（Mischief Managed）」。
>
> *I solemnly swear that I am up to no good.*
