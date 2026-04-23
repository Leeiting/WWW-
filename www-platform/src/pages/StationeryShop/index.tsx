// Mischief Managed — 文具店掩護頁面（Phase 6 實作）
// 白色、無聊的普通文具店外觀，偽裝用途
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import styles from './StationeryShop.module.css'

// 假商品清單（不可購買）
const FAKE_PRODUCTS = [
  {
    id: 'st-001',
    emoji: '✏️',
    name: '高級鉛筆 2B',
    desc: '書寫流暢，適合考試使用。12入裝。',
    price: 'NT$ 45',
  },
  {
    id: 'st-002',
    emoji: '🩹',
    name: '天然橡皮擦',
    desc: '無毒環保材質，擦除乾淨不留痕。',
    price: 'NT$ 18',
  },
  {
    id: 'st-003',
    emoji: '📎',
    name: '訂書機（含釘）',
    desc: '標準規格，適合文書裝訂，容量 100 釘。',
    price: 'NT$ 120',
  },
  {
    id: 'st-004',
    emoji: '📏',
    name: '透明塑膠尺 30cm',
    desc: '刻度清晰，耐用防折。',
    price: 'NT$ 25',
  },
  {
    id: 'st-005',
    emoji: '🖊️',
    name: '原子筆（藍色）',
    desc: '書寫順暢，適合各類文件簽署。10入裝。',
    price: 'NT$ 60',
  },
  {
    id: 'st-006',
    emoji: '🗂️',
    name: 'A4 空白影印紙',
    desc: '80g/m²，適合一般印表機使用。500張/包。',
    price: 'NT$ 89',
  },
]

// 文具店掩護頁面主元件
const StationeryShop = () => (
  <div className={styles.page}>
    {/* 中文註解：Mischief Managed 模式下 OG 標籤自動切換為文具店資訊（spec §12.5）*/}
    <Helmet>
      <title>怪洛克文具批發 — 您值得信賴的文具夥伴</title>
      <meta name="description" content="怪洛克文具批發股份有限公司，提供各式文具批發零售業務，品質保證，服務至上。" />
      <meta property="og:type"        content="website" />
      <meta property="og:title"       content="怪洛克文具批發 — 您值得信賴的文具夥伴" />
      <meta property="og:description" content="怪洛克文具批發股份有限公司，提供各式文具批發零售業務，品質保證，服務至上。" />
      <meta property="og:site_name"   content="怪洛克文具批發股份有限公司" />
      <meta property="og:locale"      content="zh_TW" />
      <meta name="twitter:card"        content="summary" />
      <meta name="twitter:title"       content="怪洛克文具批發 — 您值得信賴的文具夥伴" />
      <meta name="twitter:description" content="怪洛克文具批發股份有限公司，文具批發零售，品質保證。" />
    </Helmet>

    {/* 頂部橫幅 */}
    <header className={styles.header}>
      <div className={styles.logo}>
        <span className={styles.logoMain}>怪洛克文具批發股份有限公司</span>
        <span className={styles.logoSub}>Knockturn Stationery Co., Ltd. &nbsp;｜&nbsp; 統一編號：00000000</span>
      </div>
    </header>

    {/* 公告橫幅 */}
    <div className={styles.notice}>
      ⚠️ 本店目前僅接受面交，暫停網路下單功能，感謝配合。
    </div>

    {/* 主內容 */}
    <main className={styles.main}>
      <p className={styles.sectionTitle}>精選商品</p>

      {/* 假商品網格 */}
      <div className={styles.productGrid}>
        {FAKE_PRODUCTS.map(p => (
          <div key={p.id} className={styles.productCard}>
            <span className={styles.productEmoji}>{p.emoji}</span>
            <p className={styles.productName}>{p.name}</p>
            <p className={styles.productDesc}>{p.desc}</p>
            <p className={styles.productPrice}>{p.price}</p>
            {/* 不可購買按鈕 */}
            <button className={styles.buyButton} disabled>
              暫停訂購
            </button>
          </div>
        ))}
      </div>

      {/* 關於本店 */}
      <div className={styles.about}>
        <h3>關於本店</h3>
        <p>
          怪洛克文具批發股份有限公司創立於民國 82 年，專營各式文具批發零售業務，
          服務對象涵蓋學校、辦公室及一般家庭用戶。
        </p>
        <p>
          本店秉持「誠信經營、品質第一」的理念，提供多樣化的文具產品，
          歡迎各界洽詢批發報價。
        </p>
        <p>
          營業時間：週一至週五 09:00–18:00 ｜ 聯絡電話：(02) 2345-6789
        </p>
      </div>
    </main>

    {/* 頁尾 */}
    <footer className={styles.footer}>
      <p className={styles.footerMain}>© 2026 怪洛克文具批發股份有限公司 版權所有</p>
      <p className={styles.footerDisclaimer}>本店與任何魔法活動無關</p>
    </footer>
  </div>
)

export default StationeryShop
