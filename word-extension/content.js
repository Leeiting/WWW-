// 英文單字卡 - Content Script

// 防止重複注入：若已載入則跳過所有初始化 | Guard against double injection
if (!window.__wcLoaded) {
  window.__wcLoaded = true;

  // ── 狀態變數 | State variables ────────────────────────────────
  let isActive = false;
  let overlay = null;
  let selectionRectEl = null;
  let popup = null;
  let startX = 0;
  let startY = 0;

  // ── 訊息監聽 | Message listener ────────────────────────────────
  // 監聽來自 background 的啟動訊息 | Listen for activate message from background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'activate' && !isActive) {
      activateSelectionMode();
    }
  });

  // ── 選取模式 | Selection mode ────────────────────────────────

  // 啟動框選模式 | Activate rectangle selection mode
  function activateSelectionMode() {
    isActive = true;
    removePopup();

    // 建立全螢幕遮罩層 | Create fullscreen overlay
    overlay = document.createElement('div');
    overlay.id = 'wc-overlay';

    // 建立選取矩形 | Create selection rectangle element
    selectionRectEl = document.createElement('div');
    selectionRectEl.id = 'wc-selection-rect';
    overlay.appendChild(selectionRectEl);
    document.body.appendChild(overlay);

    overlay.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
  }

  // 取消並清除選取模式 | Cancel and clean up selection mode
  function deactivateSelectionMode() {
    isActive = false;
    if (overlay) {
      overlay.removeEventListener('mousedown', onMouseDown);
      overlay.remove();
      overlay = null;
      selectionRectEl = null;
    }
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  function onMouseDown(e) {
    e.preventDefault();
    startX = e.clientX;
    startY = e.clientY;

    selectionRectEl.style.display = 'block';
    selectionRectEl.style.left = startX + 'px';
    selectionRectEl.style.top = startY + 'px';
    selectionRectEl.style.width = '0';
    selectionRectEl.style.height = '0';

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  function onMouseMove(e) {
    // 動態更新矩形尺寸 | Dynamically update rectangle dimensions
    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);

    selectionRectEl.style.left = x + 'px';
    selectionRectEl.style.top = y + 'px';
    selectionRectEl.style.width = w + 'px';
    selectionRectEl.style.height = h + 'px';
  }

  function onMouseUp(e) {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);

    // 取得矩形的視口座標 | Get viewport coordinates of the selection
    const rect = selectionRectEl.getBoundingClientRect();

    // 選取範圍太小則忽略 | Ignore if selection is too small
    if (rect.width < 5 || rect.height < 5) {
      deactivateSelectionMode();
      return;
    }

    // 計算 popup 的顯示位置（避免超出螢幕） | Calculate popup position (avoid off-screen)
    const popupX = Math.min(rect.right + 4, window.innerWidth - 360);
    const popupY = Math.min(rect.bottom + 8, window.innerHeight - 320);

    // 提取矩形範圍內的英文文字 | Extract English text within the rectangle
    const text = getTextInRect(rect);

    deactivateSelectionMode();

    if (!text) {
      showToast('未找到英文文字，請重新框選');
      return;
    }

    showPopup(text, popupX, popupY);
  }

  function onKeyDown(e) {
    // 按 ESC 取消選取 | Press ESC to cancel selection
    if (e.key === 'Escape') {
      deactivateSelectionMode();
    }
  }

  // ── 文字提取 | Text extraction ────────────────────────────────

  // 提取矩形範圍內的英文文字 | Extract English text within the rectangle
  function getTextInRect(selRect) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        // 排除 script / style / noscript 內的文字 | Exclude script/style/noscript content
        const tag = node.parentElement?.tagName?.toLowerCase();
        if (tag === 'script' || tag === 'style' || tag === 'noscript') {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    let text = '';
    let node;

    while ((node = walker.nextNode())) {
      const content = node.textContent?.trim();
      if (!content) continue;

      // 取得文字節點的視口位置 | Get viewport position of text node
      const range = document.createRange();
      range.selectNodeContents(node);
      const r = range.getBoundingClientRect();

      if (r.width > 0 && r.height > 0 && rectsOverlap(r, selRect)) {
        text += content + ' ';
      }
    }

    // 過濾非 ASCII 字元，保留英文與標點 | Filter to ASCII English characters only
    return text.replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // 判斷兩個矩形是否重疊 | Check if two rectangles overlap
  function rectsOverlap(a, b) {
    return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
  }

  // ── 翻譯 Popup ────────────────────────────────────────────────

  // 顯示翻譯結果 Popup | Show translation result popup
  function showPopup(text, x, y) {
    removePopup();

    popup = document.createElement('div');
    popup.id = 'wc-popup';
    popup.style.left = Math.max(4, x) + 'px';
    popup.style.top = Math.max(4, y) + 'px';

    // 顯示載入中畫面 | Show loading state
    popup.innerHTML = `
      <div class="wc-popup-header">
        <span class="wc-popup-title">📚 英文單字卡</span>
        <button class="wc-close-btn" title="關閉">✕</button>
      </div>
      <div class="wc-popup-body">
        <div class="wc-loading">
          <div class="wc-spinner"></div>
          <span>AI 翻譯中…</span>
        </div>
      </div>
    `;

    popup.querySelector('.wc-close-btn').addEventListener('click', removePopup);
    document.body.appendChild(popup);

    // 發送翻譯請求給 background | Send translation request to background
    chrome.runtime.sendMessage({ action: 'translate', text }, (response) => {
      // Popup 可能已被關閉 | Popup might have been closed
      if (!popup) return;

      const body = popup.querySelector('.wc-popup-body');

      if (!response || !response.success) {
        body.innerHTML = `
          <div class="wc-error">⚠️ 翻譯失敗</div>
          <div class="wc-error-msg">${escHtml(response?.error || '未知錯誤')}</div>
        `;
        return;
      }

      const { word, translation, partOfSpeech, exampleEn, exampleZh } = response.data;

      // 渲染翻譯結果 | Render translation result
      body.innerHTML = `
        <div class="wc-word">${escHtml(word)}</div>
        <div class="wc-meta">
          <span class="wc-pos">${escHtml(partOfSpeech)}</span>
          <span class="wc-translation">${escHtml(translation)}</span>
        </div>
        <div class="wc-divider"></div>
        <div class="wc-example-en">&ldquo;${escHtml(exampleEn)}&rdquo;</div>
        <div class="wc-example-zh">「${escHtml(exampleZh)}」</div>
        <div class="wc-actions">
          <button class="wc-save-btn">儲存單字</button>
        </div>
      `;

      // 儲存按鈕事件 | Save button event
      popup.querySelector('.wc-save-btn').addEventListener('click', () => {
        saveWord({ word, translation, partOfSpeech, exampleEn, exampleZh });
      });
    });
  }

  // ── 儲存單字 | Save word ────────────────────────────────────

  // 將單字儲存至 chrome.storage.local | Save word to chrome.storage.local
  function saveWord(wordData) {
    const entry = {
      id: Date.now().toString(),
      ...wordData,
      pinned: false,
      createdAt: Date.now()
    };

    chrome.storage.local.get('words', ({ words = [] }) => {
      // 檢查是否已存在相同單字（不分大小寫） | Check for duplicate (case-insensitive)
      const exists = words.some(
        w => w.word.toLowerCase() === entry.word.toLowerCase()
      );

      if (exists) {
        showToast('此單字已在列表中！');
        return;
      }

      // 新單字加在最前面 | Prepend new word
      words.unshift(entry);
      chrome.storage.local.set({ words }, () => {
        showToast('✓ 單字已儲存！');
        removePopup();
      });
    });
  }

  // ── 工具函式 | Utilities ────────────────────────────────────

  // 顯示短暫 Toast 通知 | Show brief toast notification
  function showToast(msg) {
    // 移除舊的 toast | Remove existing toast
    document.getElementById('wc-toast')?.remove();

    const toast = document.createElement('div');
    toast.id = 'wc-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2200);
  }

  // 移除 Popup | Remove popup
  function removePopup() {
    if (popup) {
      popup.remove();
      popup = null;
    }
  }

  // HTML 特殊字元跳脫，防止 XSS | Escape HTML special characters to prevent XSS
  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

} // end if (!window.__wcLoaded)
