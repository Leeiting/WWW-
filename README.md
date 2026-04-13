# 衛氏巫師法寶店（WWW）電商平台

> *I solemnly swear that I am up to no good.*

以哈利波特世界為主題的惡搞電商平台，使用 React + TypeScript 建構。

---

## 專案結構

```
├── WWW-spec.md / WWW-spec.html   # 完整功能規格書
├── WWW-roadmap.md                # 開發路線圖
└── www-platform/                 # 前端主專案
```

## 技術棧

- **框架**：React 19 + TypeScript + Vite
- **狀態管理**：Zustand（含 localStorage 持久化）
- **路由**：React Router v7
- **動畫**：Framer Motion
- **樣式**：CSS Modules + CSS 變數（斜角巷主題）

## 主要功能

### 前台
- 斜角巷風格商品列表，含危險等級星星評分
- 危險等級 5 → 卡片顯示黑魔標記 + 紅色邊框
- 庫存即時顯示，下單數量不可超過庫存
- 購物車側邊欄 + 結帳彈窗
- 榮恩・衛斯理識別機制（家屬服務費 100%）
- 多種魔法配送方式（消影術 / 飛天掃帚 / 騎士墜鬼馬 / 騎士公車）

### 後台管理
- 商品 CRUD（新增、編輯、刪除）
- 庫存歸零 → 「從辦公室偷回」按鈕（恢復庫存為 5）
- 隱身咒開關（前台立即隱藏商品）

### Prank Console（惡搞控制中心）
- **惡搞模式**：前台所有商品價格每 2 秒以隨機係數跳動（0.5x～5.0x），結帳仍用原價
- **吼叫信模式**：全寬紅色橫幅 + Web Audio API 合成警報聲（880Hz/660Hz 交替方波），僅後台可關閉
- **飛七巡邏**：飛七在前台隨機浮動，不規則移動

### Mischief Managed（緊急掩護模式）
- 一鍵關閉所有惡搞特效並切換至「怪洛克文具批發」偽裝頁面
- 解除後恢復原本魔法商店

## 快速啟動

```bash
cd www-platform
npm install
npm run dev
```

開發伺服器啟動後：
- 前台：`http://localhost:5173/`
- 後台：`http://localhost:5173/admin`
- 文具店（掩護）：`http://localhost:5173/stationery`
