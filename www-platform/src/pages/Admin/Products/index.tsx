import { useState } from 'react'
import { useProductStore, toKnut } from '@/store/productStore'
import { formatPrice } from '@/store/cartStore'
import type { Product, ProductCategory, SKUItem } from '@/types'
import styles from './Products.module.css'

// 類別選項
const CATEGORY_OPTIONS: { value: ProductCategory; label: string }[] = [
  { value: 'prank', label: '🃏 惡作劇' },
  { value: 'defense', label: '🛡️ 防禦咒' },
  { value: 'love_potion', label: '💘 愛情魔藥' },
  { value: 'fireworks', label: '✨ 奇妙煙火' },
  { value: 'magical_beast', label: '🐉 魔法生物' },
]

// 空表單初始值
const emptyForm = {
  name: '',
  category: 'prank' as ProductCategory,
  galleon: 0,
  sickle: 0,
  knut: 0,
  stock: 10,
  dangerLevel: 1 as 1 | 2 | 3 | 4 | 5,
  mediaUrl: '',
  isHidden: false,
  description: '',
}

type FormData = typeof emptyForm

// SKU 草稿格式（含臨時 key 供 UI 操作）
interface SkuDraft {
  draftKey: string        // 中文註解：UI 操作用的臨時唯一鍵（非資料庫 ID）
  spec: string
  galleon: number
  sickle: number
  knut: number
  stock: number
  imageUrl: string
  weightG: string         // 中文註解：空字串代表未填
}

// 建立空白 SKU 草稿
const emptySkuDraft = (): SkuDraft => ({
  draftKey: `draft-${Date.now()}-${Math.random()}`,
  spec: '',
  galleon: 0,
  sickle: 0,
  knut: 0,
  stock: 10,
  imageUrl: '',
  weightG: '',
})

// 將 SKUItem 轉為草稿格式（供編輯時填入）
const skuToDraft = (sku: SKUItem): SkuDraft => ({
  draftKey: sku.id,
  spec: sku.spec,
  galleon: sku.price.galleon,
  sickle: sku.price.sickle,
  knut: sku.price.knut,
  stock: sku.stock,
  imageUrl: sku.imageUrl ?? '',
  weightG: sku.weightG !== undefined ? String(sku.weightG) : '',
})

const AdminProducts = () => {
  const products = useProductStore(s => s.products)
  const addProduct = useProductStore(s => s.addProduct)
  const updateProduct = useProductStore(s => s.updateProduct)
  const deleteProduct = useProductStore(s => s.deleteProduct)
  const restockSKU = useProductStore(s => s.restockSKU)
  const toggleHidden = useProductStore(s => s.toggleHidden)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)
  // 中文註解：SKU 草稿列表（獨立管理，與主表單欄位分離）
  const [skuDrafts, setSkuDrafts] = useState<SkuDraft[]>([])
  // 從辦公室偷回：記錄目標 SKU（productId + skuId）與輸入數量
  const [restockTarget, setRestockTarget] = useState<{ productId: string; skuId: string } | null>(null)
  const [restockQty, setRestockQty] = useState(5)

  // 開啟新增表單
  const openAdd = () => {
    setForm(emptyForm)
    setSkuDrafts([emptySkuDraft()])  // 中文註解：預設一個空白 SKU
    setEditingId(null)
    setShowForm(true)
  }

  // 開啟編輯表單
  const openEdit = (p: Product) => {
    setForm({
      name: p.name,
      category: p.category,
      galleon: p.price.galleon,
      sickle: p.price.sickle,
      knut: p.price.knut,
      stock: p.stock,
      dangerLevel: p.dangerLevel,
      mediaUrl: p.mediaUrl,
      isHidden: p.isHidden,
      description: p.description,
    })
    // 中文註解：將現有 SKU 轉為草稿格式；若無 SKU 則預設一個空白
    setSkuDrafts(p.skuItems.length > 0 ? p.skuItems.map(skuToDraft) : [emptySkuDraft()])
    setEditingId(p.id)
    setShowForm(true)
  }

  // 儲存（新增 or 更新）
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // 中文註解：過濾掉規格名稱未填的草稿，並轉回 SKUItem 格式
    const validSkus = skuDrafts
      .filter(d => d.spec.trim() !== '')
      .map((d, idx) => ({
        id: editingId ? d.draftKey : `SKU-${editingId ?? 'new'}-${idx}`,
        productId: editingId ?? '',
        spec: d.spec.trim(),
        price: { galleon: d.galleon, sickle: d.sickle, knut: d.knut },
        stock: d.stock,
        imageUrl: d.imageUrl.trim() || undefined,
        weightG: d.weightG !== '' ? Number(d.weightG) : undefined,
      } satisfies Omit<SKUItem, 'productId'> & { productId: string }))

    const data = {
      name: form.name.trim(),
      category: form.category,
      price: { galleon: form.galleon, sickle: form.sickle, knut: form.knut },
      stock: form.stock,
      dangerLevel: form.dangerLevel,
      mediaUrl: form.mediaUrl.trim(),
      isHidden: form.isHidden,
      description: form.description.trim(),
      skuItems: validSkus,  // 中文註解：傳入完整 SKU 列表（空陣列時 store 自動補標準版）
    }
    if (editingId) {
      updateProduct(editingId, data)
    } else {
      addProduct(data)
    }
    setShowForm(false)
  }

  // 刪除確認
  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`確定要刪除「${name}」嗎？此操作無法復原。`)) {
      deleteProduct(id)
    }
  }

  // 表單欄位更新
  const set = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setForm(prev => ({ ...prev, [key]: value }))

  // SKU 草稿欄位更新
  const setSku = <K extends keyof SkuDraft>(draftKey: string, field: K, value: SkuDraft[K]) =>
    setSkuDrafts(prev => prev.map(d => d.draftKey === draftKey ? { ...d, [field]: value } : d))

  // 新增 SKU 草稿
  const addSkuDraft = () => setSkuDrafts(prev => [...prev, emptySkuDraft()])

  // 刪除 SKU 草稿
  const removeSkuDraft = (draftKey: string) =>
    setSkuDrafts(prev => prev.filter(d => d.draftKey !== draftKey))

  return (
    <>
      {/* 工具列 */}
      <div className={styles.toolbar}>
        <p className={styles.toolbarTitle}>📦 商品管理（{products.length} 件）</p>
        <button className={styles.addBtn} onClick={openAdd}>+ 新增商品</button>
      </div>

      {/* 商品列表 */}
      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th>商品名稱</th>
              <th>類別</th>
              <th>定價</th>
              <th>庫存</th>
              <th>危險</th>
              <th>隱身咒</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr className={styles.emptyRow}>
                <td colSpan={7}>尚無商品，點擊「新增商品」開始吧！</td>
              </tr>
            ) : products.map(p => {
              // 中文註解：根據所有 SKU 判斷警示等級（任一 SKU 缺貨即視為缺貨；任一 SKU 偏低即視為偏低）
              const hasOutOfStock = p.skuItems.some(s => s.stock === 0)
              const hasLowStock = !hasOutOfStock && p.skuItems.some(s => s.stock > 0 && s.stock < 5)
              const needsRestock = hasOutOfStock || hasLowStock

              return (
              <tr
                key={p.id}
                className={[
                  p.isHidden ? styles.hidden : '',
                  hasOutOfStock ? styles.rowOutOfStock : hasLowStock ? styles.rowLowStock : '',
                ].filter(Boolean).join(' ')}
              >
                {/* 商品名稱 */}
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {needsRestock && (
                      <span className={hasOutOfStock ? styles.alertDotOut : styles.alertDot} title={hasOutOfStock ? '有 SKU 缺貨' : '有 SKU 庫存偏低'} />
                    )}
                    <div>
                      <p className={styles.productName} title={p.name}>{p.name}</p>
                      <p style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px' }}>{p.id}</p>
                    </div>
                  </div>
                </td>

                {/* 類別 */}
                <td>
                  <span className={styles.categoryBadge}>
                    {CATEGORY_OPTIONS.find(c => c.value === p.category)?.label ?? p.category}
                  </span>
                </td>

                {/* 定價 */}
                <td style={{ whiteSpace: 'nowrap' }}>
                  {formatPrice(toKnut(p.price.galleon, p.price.sickle, p.price.knut))}
                </td>

                {/* 庫存：每個 SKU 獨立顯示 */}
                <td style={{ verticalAlign: 'top', minWidth: '140px' }}>
                  <div className={styles.skuStockList}>
                    {p.skuItems.map(sku => {
                      const isOut = sku.stock === 0
                      const isLow = sku.stock > 0 && sku.stock < 5
                      const isActive = restockTarget?.productId === p.id && restockTarget?.skuId === sku.id
                      return (
                        <div key={sku.id} className={styles.skuStockRow}>
                          <div className={styles.skuStockInfo}>
                            <span className={styles.skuStockSpec}>{sku.spec}</span>
                            {isOut ? (
                              <span className={styles.stockZero}>0 缺貨</span>
                            ) : isLow ? (
                              <span className={styles.stockLow}>{sku.stock} 偏低</span>
                            ) : (
                              <span className={styles.stockNormal}>{sku.stock}</span>
                            )}
                          </div>

                          {/* 從辦公室偷回（庫存 < 5 的 SKU） */}
                          {(isOut || isLow) && (
                            isActive ? (
                              <div className={styles.restockPanel}>
                                <span className={styles.restockPanelLabel}>偷幾個？（最少 5）</span>
                                <input
                                  className={styles.restockInput}
                                  type="number"
                                  min={5}
                                  value={restockQty}
                                  onChange={e => setRestockQty(Math.max(5, Number(e.target.value)))}
                                />
                                <div className={styles.restockBtns}>
                                  <button
                                    className={styles.restockConfirmBtn}
                                    onClick={() => {
                                      restockSKU(p.id, sku.id, restockQty)
                                      setRestockTarget(null)
                                      setRestockQty(5)
                                    }}
                                  >
                                    ✅ 確認偷回 {restockQty} 個
                                  </button>
                                  <button
                                    className={styles.restockCancelBtn}
                                    onClick={() => { setRestockTarget(null); setRestockQty(5) }}
                                  >
                                    取消
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                className={styles.restockBtn}
                                onClick={() => { setRestockTarget({ productId: p.id, skuId: sku.id }); setRestockQty(5) }}
                              >
                                🏃 偷回
                              </button>
                            )
                          )}
                        </div>
                      )
                    })}
                  </div>
                </td>

                {/* 危險等級 */}
                <td>
                  <span className={styles.stars}>
                    {'★'.repeat(p.dangerLevel)}{'☆'.repeat(5 - p.dangerLevel)}
                  </span>
                </td>

                {/* 隱身咒 Toggle */}
                <td>
                  <label className={styles.toggle} title={p.isHidden ? '已隱藏（點擊顯示）' : '顯示中（點擊隱藏）'}>
                    <input
                      type="checkbox"
                      checked={p.isHidden}
                      onChange={() => toggleHidden(p.id)}
                    />
                    <span className={styles.toggleTrack} />
                  </label>
                </td>

                {/* 操作 */}
                <td>
                  <div className={styles.actions}>
                    <button className={styles.editBtn} onClick={() => openEdit(p)}>編輯</button>
                    <button className={styles.deleteBtn} onClick={() => handleDelete(p.id, p.name)}>刪除</button>
                  </div>
                </td>
              </tr>
            )})}

          </tbody>
        </table>
      </div>

      {/* 新增 / 編輯表單彈窗 */}
      {showForm && (
        <div className={styles.overlay} onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className={styles.formModal}>
            {/* 表單標題 */}
            <div className={styles.formHeader}>
              <h2 className={styles.formTitle}>
                {editingId ? '✏️ 編輯商品' : '➕ 新增商品'}
              </h2>
              <button className={styles.closeBtn} onClick={() => setShowForm(false)}>✕</button>
            </div>

            <form className={styles.form} onSubmit={handleSubmit}>
              {/* 商品名稱 */}
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>商品名稱 *</label>
                <input
                  className={styles.fieldInput}
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="例：嘔吐棒棒糖"
                  maxLength={50}
                  required
                />
              </div>

              {/* 魔法類別 */}
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>魔法類別 *</label>
                <select
                  className={styles.fieldInput}
                  value={form.category}
                  onChange={e => set('category', e.target.value as ProductCategory)}
                >
                  {CATEGORY_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* 定價（Galleon / Sickle / Knut） */}
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>主要定價（第一 SKU 的預設值）</label>
                <div className={styles.priceRow}>
                  <div className={styles.priceField}>
                    <span className={styles.priceLabel}>金加隆 (G)</span>
                    <input
                      className={styles.fieldInput}
                      type="number" min={0}
                      value={form.galleon}
                      onChange={e => set('galleon', Number(e.target.value))}
                    />
                  </div>
                  <div className={styles.priceField}>
                    <span className={styles.priceLabel}>銀閃 (S)</span>
                    <input
                      className={styles.fieldInput}
                      type="number" min={0} max={16}
                      value={form.sickle}
                      onChange={e => set('sickle', Number(e.target.value))}
                    />
                  </div>
                  <div className={styles.priceField}>
                    <span className={styles.priceLabel}>納特 (K)</span>
                    <input
                      className={styles.fieldInput}
                      type="number" min={0} max={28}
                      value={form.knut}
                      onChange={e => set('knut', Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>

              {/* 庫存量 */}
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>主要庫存（第一 SKU 的預設值）</label>
                <input
                  className={styles.fieldInput}
                  type="number" min={0}
                  value={form.stock}
                  onChange={e => set('stock', Number(e.target.value))}
                />
              </div>

              {/* 危險等級 Slider */}
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>
                  危險等級（{'★'.repeat(form.dangerLevel)}{'☆'.repeat(5 - form.dangerLevel)}）
                </label>
                <div className={styles.sliderRow}>
                  <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>安全</span>
                  <input
                    className={styles.slider}
                    type="range" min={1} max={5} step={1}
                    value={form.dangerLevel}
                    onChange={e => set('dangerLevel', Number(e.target.value) as 1|2|3|4|5)}
                  />
                  <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>極危</span>
                  <span className={styles.sliderValue}>{form.dangerLevel}</span>
                </div>
              </div>

              {/* 商品主圖 / 動圖 URL */}
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>商品主圖 / 動圖 URL（.gif 或 .mp4）</label>
                <input
                  className={styles.fieldInput}
                  value={form.mediaUrl}
                  onChange={e => set('mediaUrl', e.target.value)}
                  placeholder="https://example.com/item.gif"
                />
                {/* 中文註解：主圖預覽（有填 URL 才顯示） */}
                {form.mediaUrl.trim() && (
                  <div className={styles.mediaPreview}>
                    {form.mediaUrl.trim().endsWith('.mp4')
                      ? <video src={form.mediaUrl.trim()} autoPlay loop muted playsInline />
                      : <img src={form.mediaUrl.trim()} alt="預覽" />
                    }
                  </div>
                )}
              </div>

              {/* 商品描述 */}
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>商品描述（最多 200 字）</label>
                <textarea
                  className={`${styles.fieldInput} ${styles.fieldTextarea}`}
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                  placeholder="描述此商品的奇妙功效與副作用..."
                  maxLength={200}
                />
              </div>

              {/* 隱身咒開關 */}
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>隱身咒</label>
                <div className={styles.toggleRow}>
                  <label className={styles.toggle}>
                    <input
                      type="checkbox"
                      checked={form.isHidden}
                      onChange={e => set('isHidden', e.target.checked)}
                    />
                    <span className={styles.toggleTrack} />
                  </label>
                  <span>{form.isHidden ? '🫥 已隱藏（前台不顯示）' : '👁 顯示中'}</span>
                </div>
              </div>

              {/* ── SKU 規格管理 ── */}
              <div className={styles.skuSection}>
                <div className={styles.skuSectionHeader}>
                  <span className={styles.fieldLabel} style={{ marginBottom: 0 }}>
                    🎁 規格 SKU（{skuDrafts.length} 個）
                  </span>
                  <button type="button" className={styles.addSkuBtn} onClick={addSkuDraft}>
                    + 新增規格
                  </button>
                </div>
                <p className={styles.skuHint}>每個規格可有獨立定價、庫存與規格圖片；規格名稱留空將被略過。</p>

                {skuDrafts.map((draft, idx) => (
                  <div key={draft.draftKey} className={styles.skuCard}>
                    {/* SKU 標題列 */}
                    <div className={styles.skuCardHeader}>
                      <span className={styles.skuCardTitle}>規格 #{idx + 1}</span>
                      {skuDrafts.length > 1 && (
                        <button
                          type="button"
                          className={styles.removeSkuBtn}
                          onClick={() => removeSkuDraft(draft.draftKey)}
                        >
                          刪除
                        </button>
                      )}
                    </div>

                    {/* 規格名稱 */}
                    <div className={styles.skuRow}>
                      <label className={styles.skuLabel}>規格名稱 *</label>
                      <input
                        className={styles.fieldInput}
                        value={draft.spec}
                        onChange={e => setSku(draft.draftKey, 'spec', e.target.value)}
                        placeholder="例：10ml、標準版、6顆裝"
                      />
                    </div>

                    {/* SKU 定價 */}
                    <div className={styles.skuRow}>
                      <label className={styles.skuLabel}>定價</label>
                      <div className={styles.skuPriceRow}>
                        <div className={styles.skuPriceField}>
                          <span className={styles.priceLabel}>G</span>
                          <input className={styles.fieldInput} type="number" min={0}
                            value={draft.galleon}
                            onChange={e => setSku(draft.draftKey, 'galleon', Number(e.target.value))} />
                        </div>
                        <div className={styles.skuPriceField}>
                          <span className={styles.priceLabel}>S</span>
                          <input className={styles.fieldInput} type="number" min={0} max={16}
                            value={draft.sickle}
                            onChange={e => setSku(draft.draftKey, 'sickle', Number(e.target.value))} />
                        </div>
                        <div className={styles.skuPriceField}>
                          <span className={styles.priceLabel}>K</span>
                          <input className={styles.fieldInput} type="number" min={0} max={28}
                            value={draft.knut}
                            onChange={e => setSku(draft.draftKey, 'knut', Number(e.target.value))} />
                        </div>
                      </div>
                    </div>

                    {/* SKU 庫存 */}
                    <div className={styles.skuRow}>
                      <label className={styles.skuLabel}>庫存</label>
                      <input className={styles.fieldInput} type="number" min={0}
                        value={draft.stock}
                        onChange={e => setSku(draft.draftKey, 'stock', Number(e.target.value))} />
                    </div>

                    {/* 中文註解：SKU 專屬規格圖（選填，有填則覆蓋商品主圖） */}
                    <div className={styles.skuRow}>
                      <label className={styles.skuLabel}>規格圖 URL（選填）</label>
                      <input
                        className={styles.fieldInput}
                        value={draft.imageUrl}
                        onChange={e => setSku(draft.draftKey, 'imageUrl', e.target.value)}
                        placeholder="此規格專屬圖片 / 動圖 URL（覆蓋主圖）"
                      />
                      {/* 規格圖預覽 */}
                      {draft.imageUrl.trim() && (
                        <div className={styles.mediaPreview}>
                          {draft.imageUrl.trim().endsWith('.mp4')
                            ? <video src={draft.imageUrl.trim()} autoPlay loop muted playsInline />
                            : <img src={draft.imageUrl.trim()} alt={`規格 ${draft.spec} 預覽`} />
                          }
                        </div>
                      )}
                    </div>

                    {/* 重量（選填） */}
                    <div className={styles.skuRow}>
                      <label className={styles.skuLabel}>重量（公克，選填）</label>
                      <input
                        className={styles.fieldInput}
                        type="number" min={0}
                        value={draft.weightG}
                        onChange={e => setSku(draft.draftKey, 'weightG', e.target.value)}
                        placeholder="例：50（供運費計算）"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </form>

            {/* 表單按鈕 */}
            <div className={styles.formActions}>
              <button className={styles.submitBtn} onClick={handleSubmit as never}>
                {editingId ? '儲存變更' : '新增商品'}
              </button>
              <button className={styles.cancelBtn} onClick={() => setShowForm(false)}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default AdminProducts
