import { useState } from 'react'
import { useProductStore, toKnut } from '@/store/productStore'
import { formatPrice } from '@/store/cartStore'
import type { Product, ProductCategory } from '@/types'
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

const AdminProducts = () => {
  const products = useProductStore(s => s.products)
  const addProduct = useProductStore(s => s.addProduct)
  const updateProduct = useProductStore(s => s.updateProduct)
  const deleteProduct = useProductStore(s => s.deleteProduct)
  const restockProduct = useProductStore(s => s.restockProduct)
  const toggleHidden = useProductStore(s => s.toggleHidden)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)

  // 開啟新增表單
  const openAdd = () => {
    setForm(emptyForm)
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
    setEditingId(p.id)
    setShowForm(true)
  }

  // 儲存（新增 or 更新）
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const data = {
      name: form.name.trim(),
      category: form.category,
      price: { galleon: form.galleon, sickle: form.sickle, knut: form.knut },
      stock: form.stock,
      dangerLevel: form.dangerLevel,
      mediaUrl: form.mediaUrl.trim(),
      isHidden: form.isHidden,
      description: form.description.trim(),
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
            ) : products.map(p => (
              <tr key={p.id} className={p.isHidden ? styles.hidden : ''}>
                {/* 商品名稱 */}
                <td>
                  <p className={styles.productName} title={p.name}>{p.name}</p>
                  <p style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px' }}>{p.id}</p>
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

                {/* 庫存 */}
                <td>
                  {p.stock === 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={styles.stockZero}>0（缺貨）</span>
                      <button
                        className={styles.restockBtn}
                        onClick={() => restockProduct(p.id)}
                        title="從辦公室偷回（恢復庫存 5）"
                      >
                        從辦公室偷回
                      </button>
                    </div>
                  ) : (
                    <span className={styles.stockNormal}>{p.stock}</span>
                  )}
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
            ))}
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
                <label className={styles.fieldLabel}>定價</label>
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
                <label className={styles.fieldLabel}>庫存量</label>
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

              {/* 商品動圖 URL */}
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>商品動圖 URL（.gif 或 .mp4）</label>
                <input
                  className={styles.fieldInput}
                  value={form.mediaUrl}
                  onChange={e => set('mediaUrl', e.target.value)}
                  placeholder="https://example.com/item.gif"
                />
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
