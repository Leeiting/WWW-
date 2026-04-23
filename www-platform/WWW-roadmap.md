# 衛氏巫師法寶店（WWW）電商平台 — 開發路線圖

> 參考規格書：`WWW-spec.md`
> 專案路徑：`d:\fih機器人\www-platform\`

## 技術棧

| 類別 | 選擇 |
|------|------|
| 框架 | React 19 + TypeScript |
| 建構工具 | Vite |
| 狀態管理 | Zustand |
| 路由 | React Router v7 |
| 動畫 | Framer Motion |
| 樣式 | CSS Modules + CSS 變數 |
| 儲存 | localStorage（MVP 不需後端） |
| 套件管理 | npm |

---

## Phase 1：專案骨架（Project Skeleton）

**目標：** 可運行的空殼，含型別、Stores、路由、斜角巷主題

### 執行項目
- [ ] `npm create vite@latest www-platform -- --template react-ts`
- [ ] 安裝依賴：`zustand react-router-dom framer-motion`
- [ ] 建立完整目錄結構（components / pages / store / types / hooks）
- [ ] `src/types/index.ts`：Product、CartItem、SystemConfig 型別定義
- [ ] `src/store/productStore.ts`：商品 CRUD + localStorage 持久化
- [ ] `src/store/cartStore.ts`：購物車 + 榮恩稅計算
- [ ] `src/store/prankStore.ts`：四個惡搞開關狀態
- [ ] `src/index.css`：斜角巷 CSS 變數（深褐色主題、Cinzel 字型）
- [ ] `src/App.tsx`：路由設定（`/` `/admin` `/admin/products` `/admin/prank` `/stationery`）
- [ ] `vite.config.ts`：`@` 路徑別名

**驗收：** `npm run dev` 成功啟動，背景深褐色，路由可切換

---

## Phase 2：前台商品展示（Storefront）

**目標：** 斜角巷風格商品列表，含完整視覺效果

### 執行項目
- [ ] `ProductCard` 元件
  - 商品動圖顯示（gif / mp4）
  - 危險等級星星（★★★☆☆）
  - 危險等級 = 5 → 黑魔標記 + 標題閃爍紅色
  - 庫存正常：「立即交出金加隆」按鈕
  - 庫存 = 0：圖片灰階，按鈕禁用，顯示「石內卜來訪：已被沒收」
  - 卡片隨機微旋轉（-1deg ~ 1deg）
- [ ] `Storefront` 頁面
  - 商品格狀排列
  - `usePageShake` hook：頁面每 10 秒震動一次
  - 斜角巷視覺：深褐背景、暗金色文字、藥水污漬背景圖案

**驗收：** AC-01（黑魔標記顯示）、頁面震動效果正常

---

## Phase 3：購物車與結帳（Cart & Checkout）

**目標：** 完整購物流程，含榮恩識別與配送選擇

### 執行項目
- [ ] `Cart` 側邊欄：商品列表、數量調整、小計顯示
- [ ] `CheckoutModal` 彈窗
  - 「你是否為榮恩・衛斯理？」身份確認
  - 是榮恩 → 新增「家屬服務費 100%」明細，Total × 2
  - 二次確認機制（防誤觸）
  - 收據顯示「您已自願申報家屬身份」
- [ ] 配送方式選單

| 選項 | 代碼 | 預估時間 |
|------|------|---------|
| 消影術 | `instant` | 即時 |
| 飛天掃帚 | `broom` | 1-2 小時 |
| 騎士墜鬼馬 | `thestral` | 1-3 天 |
| 騎士公車 | `knight_bus` | 不定 |

- [ ] 訂單確認頁面

**驗收：** AC-03（榮恩家屬服務費正確計算）

---

## Phase 4：後台管理（Admin CRUD）

**目標：** 管理員可完整管理商品庫存

### 執行項目
- [ ] Admin 佈局（左側導覽 + 右側內容區）
- [ ] `Products` 頁面：商品列表表格
- [ ] 新增商品表單（名稱、類別、定價、庫存、危險等級、動圖、隱身咒）
- [ ] 編輯 / 刪除商品
- [ ] 「從辦公室偷回」按鈕（庫存 = 0 時顯示，按下恢復為 5）
- [ ] 隱身咒 Toggle → 前台商品即時消失（不渲染 DOM）

**驗收：** AC-02（從辦公室偷回）、AC-09（隱身咒）

---

## Phase 5：Prank Console（惡搞控制中心）

**目標：** 管理員可一鍵觸發全站惡搞效果

### 執行項目
- [x] `PrankConsole` 頁面 UI（開關面板）
- [x] **惡搞模式**：`Math.random() * 4.5 + 0.5`，每 2 秒更新所有商品顯示價格
- [x] **吼叫信模式**：
  - 全寬紅色橫幅 + 打字動畫
  - 音效播放（user gesture 觸發，避免瀏覽器封鎖）
  - 每 10 秒閃爍一次，直到手動關閉
- [x] **飛七巡邏**：
  - 隨機位置 `position: fixed` 浮動圖層
  - Framer Motion 不規則移動動畫
  - 點擊飛七 + 購物車有「誘餌炸彈」→ 爆炸動畫 + 消失 300 秒

**驗收：** AC-04（飛七爆炸）、AC-05（惡搞定價跳動）、AC-06（關閉恢復原價）、AC-10（吼叫信）

---

## Phase 6：Mischief Managed（緊急掩護模式）

**目標：** 一鍵切換為普通文具店，魔法部來了也不怕

### 執行項目
- [x] 後台右上角「Mischief Managed 🔴」紅色大按鈕
- [x] 觸發後：關閉所有惡搞開關，前台路由切換至 `/stationery`
- [x] `StationeryShop` 頁面
  - 白色背景、標楷體字型
  - 標題：「怪洛克文具批發股份有限公司」
  - 假商品（鉛筆、橡皮擦、訂書機，不可購買）
  - 頁尾小字：「本店與任何魔法活動無關」
- [x] 解除按鈕 → 恢復惡搞狀態與原路由

**驗收：** AC-07（Mischief Managed 啟動）、AC-08（解除後恢復）

---

## 開發進度總覽

| Phase | 內容 | 狀態 | 完成後可看到 |
|-------|------|:----:|------------|
| 1 | 骨架 + 型別 + Stores | ✅ | 空白頁面可路由切換 |
| 2 | 前台商品展示 | ✅ | 斜角巷商品列表 |
| 3 | 購物車與結帳 | ✅ | 完整購物流程 |
| 4 | 後台 CRUD | ✅ | 管理員可上下架商品 |
| 5 | Prank Console | ✅ | 惡搞特效全開 |
| 6 | Mischief Managed | ✅ | 平台完整上線 |

---

> ⚠️ *I solemnly swear that I am up to no good.*
