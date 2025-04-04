// Background Service Worker (background.js)

// 監聽擴充功能安裝或更新事件
chrome.runtime.onInstalled.addListener(details => {
  console.log("AI 提示詞管理助手已安裝或更新。", details.reason);

  // 初始化儲存空間 (保持不變)
  chrome.storage.local.get('prompts', result => {
    if (result.prompts === undefined) {
      chrome.storage.local.set({ prompts: [] }, () => {
        console.log("初始化提示詞儲存空間。");
      });
    }
  });

  // 如果有創建右鍵選單，相關代碼保持不變
  /*
  chrome.contextMenus.create({ ... });
  */
});

// *** 新增：監聽工具列圖示點擊事件 ***
chrome.action.onClicked.addListener((tab) => {
  // tab 參數包含了被點擊時所在的標籤頁資訊，包括 windowId
  console.log("插件圖示被點擊，嘗試開啟側邊欄。 Tab ID:", tab.id, "Window ID:", tab.windowId);
  if (tab.windowId) {
      // 使用 windowId 來指定在哪個視窗開啟側邊欄
      chrome.sidePanel.open({ windowId: tab.windowId })
          .then(() => {
              console.log("chrome.sidePanel.open() 調用成功。");
          })
          .catch((error) => {
              // 添加錯誤處理，以防萬一
              console.error("開啟側邊欄時發生錯誤:", error);
              // 例如，如果用戶正在使用一個不支持側邊欄的視窗類型 (如畫中畫)
          });
  } else {
       console.error("無法獲取點擊事件的 windowId，無法開啟側邊欄。");
       // 這種情況比較少見，但作為健壯性檢查
  }
});

// 如果有監聽右鍵選單點擊事件，相關代碼保持不變
/*
chrome.contextMenus.onClicked.addListener((info, tab) => { ... });
*/

// 如果有監聽來自其他腳本的訊息，相關代碼保持不變
/*
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => { ... });
*/

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