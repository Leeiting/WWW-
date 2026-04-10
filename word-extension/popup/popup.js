// 擴充功能 Popup 腳本 | Extension popup script

// 載入已儲存的資料 | Load saved data
chrome.storage.local.get(['words', 'geminiApiKey'], ({ words = [], geminiApiKey = '' }) => {
  // 顯示目前單字數量 | Display current word count
  document.getElementById('wordCount').textContent = `${words.length} 個單字`;

  // 若已設定 API Key，顯示提示 | Show hint if API key is already set
  if (geminiApiKey) {
    document.getElementById('apiKey').placeholder = '已設定（輸入新值可更新）';
  }
});

// 開啟單字列表頁面 | Open word list page
document.getElementById('openWordlist').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('wordlist/wordlist.html') });
  window.close();
});

// 儲存 Gemini API Key | Save Gemini API Key
document.getElementById('saveKey').addEventListener('click', () => {
  const key = document.getElementById('apiKey').value.trim();
  const msg = document.getElementById('saveMsg');

  if (!key) {
    msg.style.color = '#e53935';
    msg.textContent = '請輸入 API Key';
    return;
  }

  chrome.storage.local.set({ geminiApiKey: key }, () => {
    // 清除輸入框並顯示成功訊息 | Clear input and show success message
    document.getElementById('apiKey').value = '';
    document.getElementById('apiKey').placeholder = '已設定（輸入新值可更新）';
    msg.style.color = '#3a7de0';
    msg.textContent = '✓ 已儲存';

    // 2 秒後清除訊息 | Clear message after 2 seconds
    setTimeout(() => { msg.textContent = ''; }, 2000);
  });
});
