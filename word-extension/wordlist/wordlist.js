// 單字列表頁面腳本 | Word list page script

// 所有單字資料（用於搜尋過濾） | All word data (for search filtering)
let allWords = [];

// ── 初始化 | Initialize ──────────────────────────────────

function init() {
  // 從 chrome.storage.local 載入單字 | Load words from chrome.storage.local
  chrome.storage.local.get('words', ({ words = [] }) => {
    allWords = words;
    renderCards(sortWords(allWords));
    updateCount(allWords.length);
  });

  // 搜尋輸入監聽 | Search input listener
  document.getElementById('searchInput').addEventListener('input', onSearch);
}

// ── 搜尋 | Search ──────────────────────────────────

function onSearch(e) {
  const query = e.target.value;
  const filtered = filterWords(query);
  renderCards(sortWords(filtered));
  updateCount(filtered.length, query.trim() !== '');
}

// 過濾單字（不分大小寫，比對單字和翻譯） | Filter words case-insensitively against word and translation
function filterWords(query) {
  if (!query.trim()) return allWords;
  const q = query.toLowerCase();
  return allWords.filter(
    w => w.word.toLowerCase().includes(q) || w.translation.includes(q)
  );
}

// 排序：置頂優先，再依建立時間降序 | Sort: pinned first, then by createdAt descending
function sortWords(words) {
  return [...words].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.createdAt - a.createdAt;
  });
}

// ── 渲染 | Render ──────────────────────────────────

// 渲染卡片列表 | Render card list
function renderCards(words) {
  const grid = document.getElementById('cardGrid');
  const emptyState = document.getElementById('emptyState');
  const noResults = document.getElementById('noResults');
  const isSearching = document.getElementById('searchInput').value.trim() !== '';

  grid.innerHTML = '';

  if (words.length === 0) {
    emptyState.style.display = isSearching ? 'none' : 'block';
    noResults.style.display = isSearching ? 'block' : 'none';
    return;
  }

  emptyState.style.display = 'none';
  noResults.style.display = 'none';

  // 建立並插入每張卡片 | Create and insert each card
  words.forEach(word => grid.appendChild(createCard(word)));
}

// 建立單字卡片 DOM 元素 | Create word card DOM element
function createCard(word) {
  const card = document.createElement('div');
  card.className = 'word-card' + (word.pinned ? ' pinned' : '');
  card.dataset.id = word.id;

  card.innerHTML = `
    <div class="card-actions">
      <button class="btn-pin ${word.pinned ? 'active' : ''}" title="${word.pinned ? '取消置頂' : '置頂'}">
        📌 ${word.pinned ? '已置頂' : '置頂'}
      </button>
      <button class="btn-delete" title="刪除此單字">🗑 刪除</button>
    </div>
    <div class="card-word">${escHtml(word.word)}</div>
    <div class="card-meta">
      <span class="card-pos">${escHtml(word.partOfSpeech)}</span>
      <span class="card-translation">${escHtml(word.translation)}</span>
    </div>
    <div class="card-divider"></div>
    <div class="card-example-en">&ldquo;${escHtml(word.exampleEn)}&rdquo;</div>
    <div class="card-example-zh">「${escHtml(word.exampleZh)}」</div>
  `;

  // 置頂按鈕事件 | Pin button event
  card.querySelector('.btn-pin').addEventListener('click', () => togglePin(word.id));
  // 刪除按鈕事件 | Delete button event
  card.querySelector('.btn-delete').addEventListener('click', () => deleteWord(word.id));

  return card;
}

// ── 操作 | Operations ──────────────────────────────────

// 切換置頂狀態 | Toggle pin status
function togglePin(id) {
  allWords = allWords.map(w => w.id === id ? { ...w, pinned: !w.pinned } : w);

  chrome.storage.local.set({ words: allWords }, () => {
    // 重新渲染（考慮搜尋狀態） | Re-render (considering search state)
    const filtered = filterWords(document.getElementById('searchInput').value);
    renderCards(sortWords(filtered));
  });
}

// 刪除單字 | Delete word
function deleteWord(id) {
  allWords = allWords.filter(w => w.id !== id);

  chrome.storage.local.set({ words: allWords }, () => {
    const filtered = filterWords(document.getElementById('searchInput').value);
    renderCards(sortWords(filtered));
    updateCount(filtered.length, document.getElementById('searchInput').value.trim() !== '');
  });
}

// 更新計數顯示 | Update count display
function updateCount(count, isFiltered = false) {
  const badge = document.getElementById('wordCount');
  if (isFiltered) {
    badge.textContent = `找到 ${count} 個`;
  } else {
    // 同步全部數量 | Sync total count
    badge.textContent = `${allWords.length} 個單字`;
  }
}

// ── 工具函式 | Utility ──────────────────────────────────

// HTML 特殊字元跳脫，防止 XSS | Escape HTML special characters to prevent XSS
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// 啟動 | Start
init();
