import { Link } from 'react-router-dom'
import { useProductStore } from '@/store/productStore'
import { usePrankStore } from '@/store/prankStore'

const AdminDashboard = () => {
  const products = useProductStore(s => s.products)
  const prankModeEnabled = usePrankStore(s => s.prankModeEnabled)
  const howlerModeEnabled = usePrankStore(s => s.howlerModeEnabled)
  const peevesPatrolActive = usePrankStore(s => s.peevesPatrolActive)

  const totalStock = products.reduce((sum, p) => sum + p.stock, 0)
  const outOfStock = products.filter(p => p.stock === 0).length
  const hidden = products.filter(p => p.isHidden).length
  const danger5 = products.filter(p => p.dangerLevel === 5).length

  const cardStyle: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    padding: '20px 24px',
  }

  const numStyle: React.CSSProperties = {
    fontFamily: 'var(--font-title)',
    fontSize: '32px',
    color: 'var(--gold-light)',
    margin: '8px 0 4px',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '11px',
    color: 'var(--text-dim)',
    letterSpacing: '1px',
    textTransform: 'uppercase' as const,
  }

  return (
    <div>
      <p style={{ fontFamily: 'var(--font-title)', fontSize: '15px', color: 'var(--gold)', marginBottom: '24px' }}>
        📊 總覽
      </p>

      {/* 數字卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <div style={cardStyle}>
          <p style={labelStyle}>商品總數</p>
          <p style={numStyle}>{products.length}</p>
        </div>
        <div style={cardStyle}>
          <p style={labelStyle}>總庫存</p>
          <p style={numStyle}>{totalStock}</p>
        </div>
        <div style={{ ...cardStyle, borderColor: outOfStock > 0 ? 'var(--red)' : 'var(--border)' }}>
          <p style={labelStyle}>缺貨商品</p>
          <p style={{ ...numStyle, color: outOfStock > 0 ? 'var(--red-bright)' : 'var(--gold-light)' }}>{outOfStock}</p>
        </div>
        <div style={cardStyle}>
          <p style={labelStyle}>隱藏商品</p>
          <p style={numStyle}>{hidden}</p>
        </div>
        <div style={{ ...cardStyle, borderColor: danger5 > 0 ? 'var(--red)' : 'var(--border)' }}>
          <p style={labelStyle}>極危商品 ☠</p>
          <p style={{ ...numStyle, color: danger5 > 0 ? 'var(--red-bright)' : 'var(--gold-light)' }}>{danger5}</p>
        </div>
      </div>

      {/* 惡搞狀態 */}
      <p style={{ fontFamily: 'var(--font-title)', fontSize: '13px', color: 'var(--gold)', marginBottom: '12px' }}>
        🎭 惡搞模式狀態
      </p>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '32px' }}>
        {[
          { label: '惡搞模式', active: prankModeEnabled },
          { label: '吼叫信模式', active: howlerModeEnabled },
          { label: '飛七巡邏', active: peevesPatrolActive },
        ].map(s => (
          <div key={s.label} style={{
            ...cardStyle,
            display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 18px',
            borderColor: s.active ? 'var(--gold)' : 'var(--border)',
          }}>
            <span style={{
              width: '10px', height: '10px', borderRadius: '50%',
              background: s.active ? 'var(--gold)' : 'var(--border)',
              boxShadow: s.active ? '0 0 8px var(--gold)' : 'none',
              display: 'inline-block',
            }} />
            <span style={{ fontSize: '13px', color: s.active ? 'var(--gold)' : 'var(--text-dim)' }}>
              {s.label}
            </span>
            <span style={{ fontSize: '11px', color: s.active ? 'var(--gold)' : 'var(--text-dim)' }}>
              {s.active ? 'ON' : 'OFF'}
            </span>
          </div>
        ))}
      </div>

      {/* 快速連結 */}
      <p style={{ fontFamily: 'var(--font-title)', fontSize: '13px', color: 'var(--gold)', marginBottom: '12px' }}>
        ⚡ 快速操作
      </p>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <Link to="/admin/products" style={{
          ...cardStyle, display: 'block', textDecoration: 'none',
          color: 'var(--gold)', fontFamily: 'var(--font-title)', fontSize: '13px',
          transition: 'border-color 0.2s',
        }}>
          📦 商品管理 →
        </Link>
        <Link to="/admin/prank" style={{
          ...cardStyle, display: 'block', textDecoration: 'none',
          color: 'var(--gold)', fontFamily: 'var(--font-title)', fontSize: '13px',
        }}>
          🎭 Prank Console →
        </Link>
      </div>
    </div>
  )
}

export default AdminDashboard
