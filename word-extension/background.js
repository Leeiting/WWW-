// 英文單字卡 - Background Service Worker

// 安裝時建立右鍵選單 | Create context menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'activate-word-select',
    title: '選取英文單字',
    contexts: ['page', 'selection']
  });
});

// 監聽右鍵選單點擊 | Listen for context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'activate-word-select' && tab?.id) {
    activateContentScript(tab.id);
  }
});

// 監聽快捷鍵指令（tab 參數不穩定，改用 query 取得當前分頁） | Listen for keyboard shortcut - use query instead of unreliable tab param
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'activate-selection') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      activateContentScript(tab.id);
    }
  }
});

// 動態注入 content script（content.js 有防重複注入守衛）後送出啟動指令
// Dynamically inject content script (guarded against double-injection) then send activate
async function activateContentScript(tabId) {
  try {
    // 每次都注入：content.js 內部有 window.__wcLoaded 守衛防止重複執行
    // Always inject: content.js has window.__wcLoaded guard to prevent duplicate execution
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    await chrome.scripting.insertCSS({ target: { tabId }, files: ['content.css'] });
    await chrome.tabs.sendMessage(tabId, { action: 'activate' });
  } catch {
    // chrome:// 或其他受限頁面無法注入屬正常情況，靜默忽略
    // chrome:// or restricted pages cannot be injected — silently ignore
  }
}

// 監聽 content script 的翻譯請求 | Listen for translation requests from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'translate') {
    handleTranslation(message.text)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // 保持非同步回應通道開啟 | Keep async response channel open
  }
});

// 呼叫 Gemini API 進行翻譯與分析 | Call Gemini API for translation and analysis
async function handleTranslation(text) {
  const { geminiApiKey } = await chrome.storage.local.get('geminiApiKey');

  if (!geminiApiKey) {
    throw new Error('請先在擴充功能 Popup 中設定 Gemini API Key');
  }

  // 組合提示詞，要求回傳 JSON 格式 | Build prompt requesting JSON response
  const prompt = `分析以下英文文字，並以 JSON 格式回傳以下資訊：
1. word: 主要英文單字或片語（整理乾淨，去除標點）
2. translation: 繁體中文翻譯
3. partOfSpeech: 詞性（用繁體中文：名詞／動詞／形容詞／副詞／介系詞／連接詞／感嘆詞）
4. exampleEn: 一個自然的英文例句（使用該單字）
5. exampleZh: 例句的繁體中文翻譯

只回傳 JSON，不要任何其他文字或 markdown：
{
  "word": "...",
  "translation": "...",
  "partOfSpeech": "...",
  "exampleEn": "...",
  "exampleZh": "..."
}

英文文字：${text}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3 }
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gemini API 錯誤 ${response.status}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // 解析 JSON 回應，支援被 markdown 包裝的情況 | Parse JSON, handle markdown code block wrapper
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('無法解析 AI 回應格式');
  }

  return JSON.parse(jsonMatch[0]);
}
