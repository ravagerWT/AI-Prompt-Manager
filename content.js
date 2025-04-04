// Content Script (content.js)
// 這個腳本在瀏覽器頁面上下文中運行

// console.log("AI 提示詞助手 Content Script 已載入");

// 這個腳本目前不需要主動做什麼，只需要等待 background/sidepanel 發送插入訊息。
// 插入邏輯現在直接通過 chrome.scripting.executeScript({ func: ... }) 注入執行。
// 這種方式更靈活，避免了 content script 需要一直監聽消息。

// 如果未來需要更複雜的頁面互動（例如右鍵選單儲存選取文字），
// 則可以在這裡添加事件監聽器和消息傳遞邏輯。
// 例如：
/*
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "insertPrompt") {
    const textToInsert = request.content;
    const activeElement = document.activeElement;
    let success = false;
    let message = "未找到焦點輸入框或文本區域";

    // ... (插入邏輯，與 sidepanel.js 中的 insertTextIntoActiveElement 類似) ...

    sendResponse({ success: success, message: message });
    return true; // 表示異步處理 sendResponse
  }
});
*/