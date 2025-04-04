// --- 通用輔助函數 ---

/**
 * 生成唯一的 ID (基於 UUID v4)
 * @returns {string} UUID
 */
function generateId() {
  // 在 Chrome 擴充功能環境中，crypto.randomUUID() 通常可用
  if (crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  } else {
    // 備用方案 (安全性較低，但可用)
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
}

/**
 * 獲取 ISO 8601 格式的當前時間字串
 * @returns {string} ISO 8601 Datetime String
 */
function getCurrentISOTime() {
  return new Date().toISOString();
}

/**
 * 顯示短暫的提示訊息 (Toast)
 * @param {string} message - 要顯示的訊息
 * @param {'success'|'error'|'info'} type - 訊息類型 (影響樣式)
 * @param {number} duration - 顯示持續時間 (毫秒)
 */
function showToast(message, type = 'info', duration = 3000) {
  const toastElement = document.getElementById('toast-message');
  if (!toastElement) return;

  toastElement.textContent = message;
  toastElement.className = 'toast'; // 重置樣式
  if (type === 'success') {
    toastElement.classList.add('success');
  } else if (type === 'error') {
    toastElement.classList.add('error');
  }
  // 'info' 不需要額外 class

  toastElement.classList.remove('hidden');

  // 使用 setTimeout 在一段時間後隱藏
  setTimeout(() => {
    toastElement.classList.add('hidden');
  }, duration);
}

/**
 * 顯示確認對話框
 * @param {string} message - 確認訊息
 * @returns {Promise<boolean>} - 使用者點擊確認則 resolve(true)，否則 resolve(false)
 */
function showConfirm(message) {
  return new Promise((resolve) => {
    const dialog = document.getElementById('confirm-dialog');
    const messageElement = document.getElementById('confirm-message');
    const yesButton = document.getElementById('confirm-yes');
    const noButton = document.getElementById('confirm-no');

    if (!dialog || !messageElement || !yesButton || !noButton) {
      console.error("確認對話框元素未找到");
      resolve(false); // 無法顯示對話框，視為取消
      return;
    }

    messageElement.textContent = message;
    dialog.classList.remove('hidden');

    // 移除舊的監聽器，防止重複觸發
    const newYesButton = yesButton.cloneNode(true);
    const newNoButton = noButton.cloneNode(true);
    yesButton.parentNode.replaceChild(newYesButton, yesButton);
    noButton.parentNode.replaceChild(newNoButton, noButton);


    const handleYes = () => {
      dialog.classList.add('hidden');
      resolve(true);
    };

    const handleNo = () => {
      dialog.classList.add('hidden');
      resolve(false);
    };

    newYesButton.addEventListener('click', handleYes, { once: true });
    newNoButton.addEventListener('click', handleNo, { once: true });

     // 添加 Esc 鍵關閉
    const handleEsc = (event) => {
        if (event.key === 'Escape') {
            handleNo();
            document.removeEventListener('keydown', handleEsc);
        }
    };
    document.addEventListener('keydown', handleEsc);
  });
}


/**
 * 解析標籤輸入字串為標籤陣列
 * @param {string} tagString - 輸入的標籤字串 (例如 "#tag1 #tag2#tag3")
 * @returns {string[]} - 清理過的標籤陣列 (例如 ["#tag1", "#tag2", "#tag3"])
 */
function parseTags(tagString) {
  if (!tagString || typeof tagString !== 'string') {
    return [];
  }
  // 1. 移除前後多餘空格
  // 2. 以 # 作為分隔符 (處理 #tag1#tag2 和 #tag1 #tag2 的情況)
  // 3. 過濾掉空字串
  // 4. 確保每個標籤都以 # 開頭
  // 5. 移除每個標籤前後的空格
  return tagString.trim().split('#')
    .map(tag => tag.trim()) // 移除每個部分前後的空格
    .filter(tag => tag.length > 0) // 過濾掉空字串
    .map(tag => `#${tag.startsWith('#') ? tag.substring(1) : tag}`); // 確保 # 開頭
}

/**
 * 將標籤陣列格式化為輸入框顯示的字串
 * @param {string[]} tagsArray - 標籤陣列
 * @returns {string} - 用於輸入框顯示的字串 (例如 "#tag1 #tag2")
 */
function formatTagsForInput(tagsArray) {
  if (!Array.isArray(tagsArray)) {
    return '';
  }
  return tagsArray.join(' '); // 簡單地用空格連接
}

/**
 * 從 chrome.storage.local 獲取所有提示詞
 * @returns {Promise<Array>} - 包含所有提示詞物件的陣列
 */
async function getPromptsFromStorage() {
  try {
    const result = await chrome.storage.local.get('prompts');
    // 如果 'prompts' 不存在，返回空陣列
    return result.prompts || [];
  } catch (error) {
    console.error("讀取提示詞時發生錯誤:", error);
    showToast("讀取提示詞失敗", 'error');
    return []; // 出錯時返回空陣列
  }
}

/**
 * 將提示詞陣列儲存到 chrome.storage.local
 * @param {Array} promptsArray - 要儲存的提示詞陣列
 * @returns {Promise<boolean>} - 儲存成功返回 true，失敗返回 false
 */
async function savePromptsToStorage(promptsArray) {
  try {
    await chrome.storage.local.set({ prompts: promptsArray });
    return true;
  } catch (error) {
    console.error("儲存提示詞時發生錯誤:", error);
    showToast("儲存提示詞失敗", 'error');
    return false;
  }
}

/**
 * 格式化日期時間字串為更易讀的格式
 * @param {string} isoString - ISO 8601 日期時間字串
 * @returns {string} - 例如 "2023/10/28 15:30"
 */
function formatDateTime(isoString) {
  if (!isoString) return 'N/A';
  try {
    const date = new Date(isoString);
    // 使用 Intl.DateTimeFormat 提供本地化日期時間格式
     const options = {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false // 使用 24 小時制
     };
     // 'zh-TW' 是台灣繁體中文的區域設置代碼
     return new Intl.DateTimeFormat('zh-TW', options).format(date).replace(',', ''); // 移除可能的分隔逗號
  } catch (e) {
    console.warn("無法格式化日期:", isoString, e);
    return isoString; // 出錯時返回原始字串
  }
}