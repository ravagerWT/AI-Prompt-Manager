// Background Service Worker (background.js)

// 監聽擴充功能安裝或更新事件
chrome.runtime.onInstalled.addListener(details => {
  console.log("AI 提示詞管理助手已安裝或更新。", details.reason);

  // 可以在這裡設置一些初始的儲存值，如果需要的話
  // 例如，確保 prompts 鍵存在
  chrome.storage.local.get('prompts', result => {
    if (result.prompts === undefined) {
      chrome.storage.local.set({ prompts: [] }, () => {
        console.log("初始化提示詞儲存空間。");
      });
    }
  });

   // 如果是首次安裝，可以選擇自動打開側邊欄 (但預設點擊圖標就會開)
   // if (details.reason === 'install') {
   //    chrome.sidePanel.open({ windowId: window.id }); // 需要獲取當前窗口 ID
   // }

   // 創建右鍵選單範例 (如果需要)
   /*
   chrome.contextMenus.create({
       id: "saveSelectedTextAsPrompt",
       title: "將選取文字儲存為提示詞",
       contexts: ["selection"] // 僅在選取文字時顯示
   });
   */
});

// 監聽工具列圖示點擊事件 (如果需要自訂行為，但預設已綁定 sidePanel)
// chrome.action.onClicked.addListener((tab) => {
//   chrome.sidePanel.open({ windowId: tab.windowId });
// });


// 監聽右鍵選單點擊事件 (如果創建了右鍵選單)
/*
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "saveSelectedTextAsPrompt" && info.selectionText) {
    // 選取的文字
    const selectedText = info.selectionText;
    console.log("選取的文字:", selectedText);

    // 可以打開側邊欄並傳遞訊息，讓側邊欄打開新增表單並預填內容
    chrome.sidePanel.open({ windowId: tab.windowId });

    // 稍作延遲，確保 sidePanel 的 JS 已載入並準備好接收訊息
    setTimeout(() => {
        chrome.runtime.sendMessage({
            action: "fillPromptFormFromSelection",
            content: selectedText
        });
    }, 500); // 500ms 延遲，可能需要調整

  }
});
*/

// 監聽來自 Side Panel 或 Content Script 的訊息 (如果需要)
/*
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Background script 收到訊息:", request);
    if (request.action === "someActionFromSidePanel") {
        // 做一些背景處理...
        sendResponse({ result: "Background processed" });
    }
    return true; // 如果需要異步發送響應
});
*/