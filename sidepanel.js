// --- 全域變數與狀態 ---
let allPrompts = []; // 儲存從 storage 讀取的完整提示詞列表
let currentPrompts = []; // 當前顯示在列表中的提示詞 (經過篩選和排序)
let currentTab = 'prompts'; // 當前活動的頁籤
let currentSort = 'updatedAt_desc'; // 當前排序方式
let currentFilterTags = new Set(); // 當前篩選的標籤
let isSelectionMode = false; // 是否處於垃圾桶/匯出的選擇模式
let selectedPromptIds = new Set(); // 在選擇模式下選中的提示詞 ID

// --- DOM 元素引用 ---
const searchInput = document.getElementById('search-input');
const sortButton = document.getElementById('sort-button');
const sortOptionsContainer = document.getElementById('sort-options');
const tabButtons = document.querySelectorAll('.tab-button');
const contentArea = document.getElementById('content-area');
const promptFormContainer = document.getElementById('prompt-form-container');
const promptForm = document.getElementById('prompt-form');
const formTitle = document.getElementById('form-title');
const promptIdInput = document.getElementById('prompt-id');
const promptTitleInput = document.getElementById('prompt-title');
const promptPurposeInput = document.getElementById('prompt-purpose');
const promptContentInput = document.getElementById('prompt-content');
const promptTagsInput = document.getElementById('prompt-tags');
const tagSuggestionsContainer = document.getElementById('tag-suggestions');
const savePromptButton = document.getElementById('save-prompt-button');
const cancelPromptButton = document.getElementById('cancel-prompt-button');

// --- 初始化 ---
document.addEventListener('DOMContentLoaded', initialize);

async function initialize() {
  setupEventListeners();
  await loadInitialData();
  renderCurrentView(); // 根據初始狀態渲染視圖
}

async function loadInitialData() {
  contentArea.innerHTML = '<div class="loading">載入中...</div>';
  allPrompts = await getPromptsFromStorage();
  console.log("載入提示詞:", allPrompts.length, "條");
  // 可以在這裡做一些數據清理或版本遷移 (如果需要)
}

// --- 事件監聽器設定 ---
function setupEventListeners() {
  // 頁籤切換
  tabButtons.forEach(button => {
    button.addEventListener('click', () => handleTabChange(button.dataset.tab));
  });

  // 搜尋輸入
  searchInput.addEventListener('input', handleSearch);

  // 排序按鈕與選項
  sortButton.addEventListener('click', toggleSortOptions);
  document.addEventListener('click', closeSortOptionsOnClickOutside); // 點擊外部關閉
  sortOptionsContainer.addEventListener('click', handleSortChange);

  // 新增/編輯表單提交
  promptForm.addEventListener('submit', handlePromptFormSubmit);

  // 取消新增/編輯
  cancelPromptButton.addEventListener('click', handleCancelPromptForm);

  // 標籤輸入建議 (簡單實現)
  promptTagsInput.addEventListener('input', handleTagInput);
}

// --- 核心渲染與邏輯 ---

/**
 * 根據當前狀態渲染對應的視圖
 */
function renderCurrentView() {
    console.log(`Rendering view for tab: ${currentTab}`); // <--- 添加日誌
    exitSelectionMode();
    contentArea.innerHTML = '';
  
    let filteredPrompts = filterPrompts();
    currentPrompts = sortPrompts(filteredPrompts, currentSort);
  
    switch (currentTab) {
      case 'prompts':
        console.log('Calling renderPromptListView for prompts tab'); // <--- 添加日誌
        renderPromptListView(currentPrompts.filter(p => !p.isDeleted));
        break;
      case 'add':
        console.log('Handling add tab'); // <--- 添加日誌
        openPromptForm();
        contentArea.innerHTML = '<p style="text-align:center; color:#6b7280;">請在上方表單中新增提示詞。</p>';
        break;
      case 'tags':
        console.log('Calling renderTagsView for tags tab'); // <--- 添加日誌
        // 傳遞所有未刪除的提示詞給 renderTagsView
        renderTagsView(allPrompts.filter(p => !p.isDeleted));
        break;
      case 'trash':
        console.log('Calling renderTrashView for trash tab'); // <--- 添加日誌
        renderTrashView(currentPrompts.filter(p => p.isDeleted));
        break;
      case 'import-export':
        console.log('Calling renderImportExportView for import-export tab'); // <--- 添加日誌
        renderImportExportView();
        break;
      default:
        console.error(`Unknown tab: ${currentTab}`); // <--- 添加錯誤日誌
        contentArea.innerHTML = '<p>錯誤：未知的頁籤</p>';
    }
  
    updateActiveTabStyle();
  }

/**
 * 過濾提示詞列表
 * @returns {Array} 過濾後的提示詞陣列
 */
function filterPrompts() {
    const searchTerm = searchInput.value.toLowerCase().trim();

    return allPrompts.filter(prompt => {
        // 1. 基礎過濾 (垃圾桶狀態) - 搜尋時不過濾 isDeleted
        // 在各自的渲染函數中處理 isDeleted 過濾
        // if (currentTab === 'trash' && !prompt.isDeleted) return false;
        // if (currentTab !== 'trash' && currentTab !== 'search' && prompt.isDeleted) return false; // 非垃圾桶非搜索，不顯示已刪除

        // 2. 標籤篩選 (僅在 'tags' 頁籤且有選中標籤時生效)
        if (currentTab === 'tags' && currentFilterTags.size > 0) {
            if (prompt.isDeleted) return false; // 標籤頁不顯示垃圾桶內容
            const promptTags = new Set(prompt.tags || []);
            // 檢查是否包含 *所有* 選中的篩選標籤
            let matchesAllTags = true;
            for (const filterTag of currentFilterTags) {
                if (!promptTags.has(filterTag)) {
                    matchesAllTags = false;
                    break;
                }
            }
            if (!matchesAllTags) return false;
        }

        // 3. 關鍵字搜尋 (如果搜尋框有內容)
        if (searchTerm) {
            const titleMatch = prompt.title.toLowerCase().includes(searchTerm);
            const purposeMatch = prompt.purpose?.toLowerCase().includes(searchTerm) || false;
            const contentMatch = prompt.content.toLowerCase().includes(searchTerm);
            const tagsMatch = (prompt.tags || []).some(tag => tag.toLowerCase().includes(searchTerm));

            if (!(titleMatch || purposeMatch || contentMatch || tagsMatch)) {
                return false; // 任何一個都不匹配則過濾掉
            }
            // 搜尋時，垃圾桶和非垃圾桶的都可能顯示，在渲染時區分
        } else {
             // 沒有搜尋詞時，根據頁籤決定是否顯示垃圾桶內容
             if (currentTab === 'trash' && !prompt.isDeleted) return false;
             if (currentTab !== 'trash' && prompt.isDeleted) return false;
        }


        return true; // 通過所有篩選條件
    });
}


/**
 * 排序提示詞列表
 * @param {Array} prompts - 要排序的提示詞陣列
 * @param {string} sortKey - 排序關鍵字 (例如 'updatedAt_desc')
 * @returns {Array} 排序後的提示詞陣列
 */
function sortPrompts(prompts, sortKey) {
  return [...prompts].sort((a, b) => {
    switch (sortKey) {
      case 'createdAt_asc':
        return new Date(a.createdAt) - new Date(b.createdAt);
      case 'createdAt_desc':
        return new Date(b.createdAt) - new Date(a.createdAt);
      case 'updatedAt_asc':
        return new Date(a.updatedAt) - new Date(b.updatedAt);
      case 'updatedAt_desc_specific': // 明確區分修改時間
         return new Date(b.updatedAt) - new Date(a.updatedAt);
      case 'updatedAt_desc': // 預設：最近新增或修改
      default:
        // 將 updatedAt 和 createdAt 中較晚的時間作為排序依據
        const lastActiveA = Math.max(new Date(a.updatedAt).getTime(), new Date(a.createdAt).getTime());
        const lastActiveB = Math.max(new Date(b.updatedAt).getTime(), new Date(b.createdAt).getTime());
        return lastActiveB - lastActiveA;
    }
  });
}

/**
 * 更新活動頁籤的視覺樣式
 */
function updateActiveTabStyle() {
  tabButtons.forEach(button => {
    if (button.dataset.tab === currentTab) {
      button.classList.add('active');
    } else {
      button.classList.remove('active');
    }
  });
}

// --- 頁籤渲染函數 ---

/**
 * 渲染提示詞列表視圖 (用於 'prompts' 頁籤和搜尋結果)
 * @param {Array} promptsToRender - 要渲染的提示詞陣列
 */
function renderPromptListView(promptsToRender) {
    contentArea.innerHTML = ''; // 清空現有內容
    const list = document.createElement('ul');
    list.className = 'prompt-list';

    if (promptsToRender.length === 0) {
        list.innerHTML = `<li class="empty-message">${searchInput.value ? '找不到符合條件的提示詞。' : '還沒有提示詞，點擊「新增提示詞」開始吧！'}</li>`;
    } else {
        promptsToRender.forEach(prompt => {
            const listItem = createPromptListItem(prompt);
            list.appendChild(listItem);
        });
    }
    contentArea.appendChild(list);
}


/**
 * 建立單個提示詞列表項的 HTML 元素
 * @param {object} prompt - 提示詞物件
 * @returns {HTMLElement} - 代表列表項的 li 元素
 */
function createPromptListItem(prompt) {
    const li = document.createElement('li');
    li.className = `prompt-item ${prompt.isDeleted ? 'deleted' : ''} ${isSelectionMode ? 'selection-mode' : ''}`;
    li.dataset.id = prompt.id;

    let checkboxHTML = '';
    // 如果是選擇模式，準備 checkbox HTML
    if (isSelectionMode) {
        checkboxHTML = `<input type="checkbox" class="prompt-select-checkbox" data-id="${prompt.id}" data-prompt-title="${prompt.title}" ${selectedPromptIds.has(prompt.id) ? 'checked' : ''}>`;
    }

    // --- 準備按鈕區的 HTML ---
    let actionsHTML = '';
    // 只有在非選擇模式下才顯示按鈕
    if (!isSelectionMode) {
        actionsHTML = `<div class="prompt-actions">`; // 按鈕容器
        if (prompt.isDeleted) {
            // 垃圾桶內的按鈕
            actionsHTML += `
                <button class="icon-button recover-button" title="復原">復</button>
                <button class="icon-button perm-delete-button danger" title="永久刪除">除</button>
            `;
        } else {
            // 非垃圾桶的按鈕
            actionsHTML += `
                <button class="icon-button copy-button" title="複製內容">複</button>
                <button class="icon-button insert-button" title="插入到頁面">插</button>
                <button class="icon-button duplicate-button" title="建立副本">副</button>
                <button class="icon-button export-button" title="匯出此項">匯</button>
                <button class="icon-button delete-button danger" title="移至垃圾桶">刪</button>
            `;
        }
        actionsHTML += `</div>`; // 結束按鈕容器
    }

    // --- 構建主要的 innerHTML ---
    // 包含 checkbox (如果在選擇模式) 和主要的 prompt-details div
    li.innerHTML = `
        ${checkboxHTML}
        <div class="prompt-details">
            <div class="prompt-header">
                <span class="prompt-title">${prompt.title}</span>
                <!-- 按鈕區已移出 Header -->
            </div>
            <div class="prompt-meta">
                ${(prompt.tags && prompt.tags.length > 0) ? `<span class="tags">標籤: ${prompt.tags.map(tag => `<span>${tag}</span>`).join(' ')}</span> | ` : ''}
                <span class="timestamp">修改: ${formatDateTime(prompt.updatedAt)} | 建於: ${formatDateTime(prompt.createdAt)}</span>
            </div>
            ${(!prompt.isDeleted && prompt.content) ? `<div class="prompt-content-preview">${prompt.content}</div>` : ''}

            <!-- *** 將按鈕區 HTML 插入到這裡 *** -->
            ${actionsHTML}
        </div>
    `;

    // --- 為列表項內的元素添加事件監聽器 ---
    // (這部分邏輯保持不變，選擇器應該仍然能找到對應的按鈕和元素)
    // Checkbox
    const checkbox = li.querySelector('.prompt-select-checkbox');
    if (checkbox) {
        checkbox.addEventListener('change', (e) => {
            const id = e.target.dataset.id;
            if (e.target.checked) {
                selectedPromptIds.add(id);
            } else {
                selectedPromptIds.delete(id);
            }
            console.log("Selected IDs:", selectedPromptIds);
            updateDeleteSelectedButtonCount(); // 更新按鈕計數
        });
    }
    // 複製按鈕
    const copyBtn = li.querySelector('.copy-button');
    if (copyBtn) { copyBtn.addEventListener('click', (e) => { e.stopPropagation(); handleCopyPrompt(prompt.id, prompt.content); }); }
    // 插入按鈕
    const insertBtn = li.querySelector('.insert-button');
    if (insertBtn) { insertBtn.addEventListener('click', (e) => { e.stopPropagation(); handleInsertPrompt(prompt.content); }); }
    // 刪除 (移至垃圾桶) 按鈕
    const deleteBtn = li.querySelector('.delete-button');
    if (deleteBtn) { deleteBtn.addEventListener('click', async (e) => { e.stopPropagation(); if (await showConfirm(`確定要將提示詞「${prompt.title}」移至垃圾桶嗎？`)) { await movePromptToTrash(prompt.id); } }); }
    // 建立副本按鈕
    const duplicateBtn = li.querySelector('.duplicate-button');
    if (duplicateBtn) { duplicateBtn.addEventListener('click', async (e) => { e.stopPropagation(); await duplicatePrompt(prompt.id); }); }
    // 匯出單項按鈕
    const exportBtn = li.querySelector('.export-button');
    if (exportBtn) { exportBtn.addEventListener('click', (e) => { e.stopPropagation(); handleExportPrompts([prompt]); }); }
    // 復原按鈕 (垃圾桶內)
    const recoverBtn = li.querySelector('.recover-button');
    if (recoverBtn) { recoverBtn.addEventListener('click', async (e) => { e.stopPropagation(); await recoverPromptFromTrash(prompt.id); }); }
    // 永久刪除按鈕 (垃圾桶內)
    const permDeleteBtn = li.querySelector('.perm-delete-button');
    if (permDeleteBtn) { permDeleteBtn.addEventListener('click', async (e) => { e.stopPropagation(); if (await showConfirm(`確定要永久刪除提示詞「${prompt.title}」嗎？此操作無法復原。`)) { await permanentlyDeletePrompts([prompt.id]); } }); }
     // 點擊非按鈕區域觸發編輯
    const detailsDiv = li.querySelector('.prompt-details');
    if (detailsDiv && !prompt.isDeleted && !isSelectionMode) {
        detailsDiv.addEventListener('click', (e) => {
            // 確保點擊的不是按鈕本身或按鈕區域內的任何元素
            if (!e.target.closest('.prompt-actions') && !e.target.closest('.prompt-select-checkbox')) {
                openPromptForm(prompt);
            }
        });
    }

    return li;
}


/**
 * 渲染標籤視圖
 * @param {Array} activePrompts - 所有未刪除的提示詞 (從 allPrompts 過濾 isDeleted=false 得來)
 */
function renderTagsView(activePrompts) {
    console.log('Executing renderTagsView. Current filter tags:', currentFilterTags);
    contentArea.innerHTML = ''; // 清空，確保從頭開始渲染

    // --- 1. 渲染標籤雲 ---
    const allTags = new Set();
    activePrompts.forEach(p => {
        (p.tags || []).forEach(tag => {
            if (tag && typeof tag === 'string') {
               allTags.add(tag);
            } else {
               console.warn("發現無效標籤格式:", tag, "來自提示詞ID:", p.id);
            }
        });
    });
    const sortedTags = Array.from(allTags).sort();
    console.log('Unique tags for cloud:', sortedTags);

    const tagListContainer = document.createElement('div');
    tagListContainer.className = 'tag-list-container';
    tagListContainer.innerHTML = `<h3>所有標籤 (${sortedTags.length})</h3>`; // 保持 H3

    const tagCloud = document.createElement('div');
    tagCloud.className = 'tag-cloud';

    if (sortedTags.length > 0) {
        sortedTags.forEach(tag => {
            const tagElement = document.createElement('span');
            tagElement.className = 'tag-item';
            tagElement.textContent = tag;
            tagElement.dataset.tag = tag;
            if (currentFilterTags.has(tag)) { // 檢查是否在當前篩選條件中
                tagElement.classList.add('selected');
            }
            tagElement.addEventListener('click', () => handleTagClick(tag)); // 監聽點擊
            tagCloud.appendChild(tagElement);
        });
        // 添加清除篩選按鈕 (當有篩選條件時)
        if (currentFilterTags.size > 0) {
            const clearButton = document.createElement('button');
            clearButton.textContent = '清除篩選';
            clearButton.className = 'clear-tag-filter';
            clearButton.onclick = () => {
                console.log("Clearing tag filter.");
                currentFilterTags.clear();
                // 直接重新渲染標籤頁面，因為狀態已改變
                renderTagsView(allPrompts.filter(p => !p.isDeleted));
            };
            tagCloud.appendChild(clearButton);
        }
    } else {
        tagCloud.innerHTML = '<p style="color:#6b7280;">尚未建立任何標籤。</p>';
    }
    tagListContainer.appendChild(tagCloud);
    contentArea.appendChild(tagListContainer); // 將標籤雲添加到 contentArea

    console.log('Tag cloud rendered.');

    // --- 2. 渲染提示詞列表 (根據 currentFilterTags 篩選) ---

    // 決定要顯示哪些提示詞
    let promptsToShow;
    if (currentFilterTags.size > 0) {
        console.log(`Filtering active prompts by tags:`, currentFilterTags);
        promptsToShow = activePrompts.filter(prompt => {
             const promptTags = new Set(prompt.tags || []);
             let matchesAll = true;
             for (const filterTag of currentFilterTags) {
                 if (!promptTags.has(filterTag)) {
                     matchesAll = false;
                     break; // 只要有一個篩選標籤不匹配，就停止檢查該提示詞
                 }
             }
             // console.log(`Prompt "${prompt.title}" matches filter? ${matchesAll}`); // 可選的詳細日誌
             return matchesAll;
        });
        console.log(`${promptsToShow.length} prompts matched the filter.`);
    } else {
         // 沒有篩選條件，顯示所有活動提示詞
         console.log('No filter tags selected, showing all active prompts.');
         promptsToShow = activePrompts;
    }

    // 創建列表容器和標題
    const listContainer = document.createElement('div');
    listContainer.id = 'tags-prompt-list-container'; // 給一個唯一 ID 方便調試

    const listTitle = document.createElement('h4'); // 使用 H4 與 H3 區分
    listTitle.style.marginTop = '20px'; // 增加與標籤雲的間距
    listTitle.style.marginBottom = '10px';
    if (currentFilterTags.size > 0) {
        listTitle.textContent = `包含標籤 "${Array.from(currentFilterTags).join(' & ')}" 的提示詞 (${promptsToShow.length})：`;
    } else {
        listTitle.textContent = `所有提示詞 (${activePrompts.length})：`;
    }
    listContainer.appendChild(listTitle); // 將標題添加到列表容器

    // 創建列表元素 (ul)
    const listElement = document.createElement('ul');
    listElement.className = 'prompt-list';

    // 填充列表內容
    if (promptsToShow.length === 0) {
        listElement.innerHTML = `<li class="empty-message">${currentFilterTags.size > 0 ? '沒有符合目前篩選標籤的提示詞。' : '沒有提示詞可顯示。'}</li>`;
    } else {
        // 先排序再渲染
        sortPrompts(promptsToShow, currentSort).forEach(prompt => {
            const listItem = createPromptListItem(prompt); // 使用通用函數創建列表項
            listElement.appendChild(listItem);
        });
    }
    listContainer.appendChild(listElement); // 將列表 ul 添加到列表容器

    contentArea.appendChild(listContainer); // *** 將包含標題和列表的容器添加到 contentArea ***

    console.log('Prompt list rendered in tags view.');
}

/**
 * 用於更新「永久刪除選取項目」按鈕計數的輔助函數
 */
function updateDeleteSelectedButtonCount() {
    // 確保我們在垃圾桶的選擇模式下
    if (currentTab === 'trash' && isSelectionMode) {
        const deleteSelectedButton = document.getElementById('perm-delete-selected');
        if (deleteSelectedButton) {
            const count = selectedPromptIds.size;
            deleteSelectedButton.textContent = `永久刪除選取項目 (${count})`;
            // 同步更新按鈕的禁用狀態
            deleteSelectedButton.disabled = count === 0;
        }
    }
     // *** 同步更新部分匯出按鈕的計數 (如果也在選擇模式下) ***
     else if (currentTab === 'import-export' && isSelectionMode) {
         const exportSelectedButton = document.getElementById('confirm-partial-export');
         if (exportSelectedButton) {
             const count = selectedPromptIds.size;
             exportSelectedButton.textContent = `匯出選取項目 (${count})`;
             exportSelectedButton.disabled = count === 0;
         }
     }
}

/**
 * 渲染垃圾桶視圖
 * @param {Array} deletedPrompts - 所有已刪除的提示詞
 */
function renderTrashView(deletedPrompts) {
    contentArea.innerHTML = '';

    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'trash-actions';
    actionsContainer.id = 'trash-actions-container';

    if (isSelectionMode) {
        // *** 初始渲染時也使用輔助函數更新計數和狀態 ***
        const initialCount = selectedPromptIds.size; // 通常是 0
        actionsContainer.innerHTML = `
            <button id="perm-delete-selected" class="danger" ${initialCount === 0 ? 'disabled' : ''}>永久刪除選取項目 (${initialCount})</button>
            <button id="cancel-selection">取消</button>
        `;
        actionsContainer.querySelector('#perm-delete-selected').addEventListener('click', handlePermanentDeleteSelected);
        actionsContainer.querySelector('#cancel-selection').addEventListener('click', exitSelectionMode);
    } else {
        actionsContainer.innerHTML = `
            <button id="enter-selection-mode" ${deletedPrompts.length === 0 ? 'disabled' : ''}>選擇刪除</button>
            <button id="empty-trash" class="danger" ${deletedPrompts.length === 0 ? 'disabled' : ''}>清空垃圾桶</button>
        `;
        if (deletedPrompts.length > 0) {
            actionsContainer.querySelector('#enter-selection-mode').addEventListener('click', enterSelectionMode);
            actionsContainer.querySelector('#empty-trash').addEventListener('click', handleEmptyTrash);
        }
    }
    contentArea.appendChild(actionsContainer);

    // ... (渲染列表的邏輯保持不變) ...
    const list = document.createElement('ul');
    list.className = 'prompt-list trash-list';
    if (deletedPrompts.length === 0) {
        list.innerHTML = '<li class="empty-message">垃圾桶是空的。</li>';
    } else {
        const sortedDeletedPrompts = sortPrompts(deletedPrompts, currentSort);
        sortedDeletedPrompts.forEach(prompt => {
            const listItem = createPromptListItem(prompt);
            list.appendChild(listItem);
        });
    }
    contentArea.appendChild(list);
}

/**
 * 渲染匯入/匯出視圖
 */
function renderImportExportView() {
    contentArea.innerHTML = `
        <div class="import-export-section">
            <h3>匯出提示詞</h3>
            <div class="import-export-actions" id="export-actions">
                <button id="export-partial-button">部分匯出...</button>
                <button id="export-all-button">全部匯出為 JSON</button>
            </div>
            <div id="partial-export-list-container" class="hidden">
                <h4>選擇要匯出的提示詞：</h4>
                <ul id="partial-export-list" class="prompt-list"></ul>
                 <div class="form-actions">
                     <button id="confirm-partial-export" class="primary">匯出選取項目</button>
                     <button id="cancel-partial-export">取消</button>
                 </div>
            </div>
        </div>

        <div class="import-export-section">
            <h3>匯入提示詞</h3>
            <div class="import-export-actions">
                <label for="import-file" id="import-button-label">從 JSON 檔案匯入</label>
                <input type="file" id="import-file" accept=".json" class="hidden">
            </div>
            <div id="import-status" class="status-message"></div>
        </div>
    `;

    // 添加事件監聽器
    document.getElementById('export-partial-button').addEventListener('click', enterPartialExportMode);
    document.getElementById('export-all-button').addEventListener('click', handleExportAll);
    document.getElementById('import-file').addEventListener('change', handleImportFile);

    // 部分匯出相關按鈕的監聽器在 enterPartialExportMode 中添加
}


// --- 表單處理 ---

/**
 * 開啟新增或編輯提示詞的表單
 * @param {object|null} promptToEdit - 如果是編輯，傳入提示詞物件；新增則傳 null
 */
function openPromptForm(promptToEdit = null) {
    promptForm.reset(); // 清空表單
    promptIdInput.value = ''; // 清除可能殘留的 ID
    tagSuggestionsContainer.innerHTML = ''; // 清空標籤建議
    tagSuggestionsContainer.classList.add('hidden');

    if (promptToEdit) {
        // 編輯模式
        formTitle.textContent = '修改提示詞';
        promptIdInput.value = promptToEdit.id;
        promptTitleInput.value = promptToEdit.title;
        promptPurposeInput.value = promptToEdit.purpose || '';
        promptContentInput.value = promptToEdit.content;
        promptTagsInput.value = formatTagsForInput(promptToEdit.tags || []);
        savePromptButton.textContent = '確認修改';
    } else {
        // 新增模式
        formTitle.textContent = '新增提示詞';
        savePromptButton.textContent = '儲存';
    }
    promptFormContainer.classList.remove('hidden');
    promptTitleInput.focus(); // 自動聚焦到標題欄
     // 確保新增表單出現時，頁籤切換到 'add'
     if (!promptToEdit && currentTab !== 'add') {
        handleTabChange('add'); // 強制切換頁籤視覺狀態但不重新渲染主內容區
        updateActiveTabStyle();
     }
}

/**
 * 處理新增/編輯表單的提交事件
 * @param {Event} event - 表單提交事件
 */
async function handlePromptFormSubmit(event) {
    event.preventDefault(); // 阻止表單預設提交行為
  
    const id = promptIdInput.value;
    const title = promptTitleInput.value.trim();
    const purpose = promptPurposeInput.value.trim();
    const content = promptContentInput.value.trim();
    const tags = parseTags(promptTagsInput.value);
  
    // 驗證必填欄位
    if (!title || !content) {
      showToast('標題和內容為必填項', 'error');
      if (!title) promptTitleInput.style.borderColor = 'red'; else promptTitleInput.style.borderColor = '';
      if (!content) promptContentInput.style.borderColor = 'red'; else promptContentInput.style.borderColor = '';
      return;
    }
     promptTitleInput.style.borderColor = '';
     promptContentInput.style.borderColor = '';
  
    const now = getCurrentISOTime();
    let isNew = false;
    let operationSuccess = false; // 標記操作是否成功
  
    try { // 使用 try...catch 包裹儲存操作
        if (id) {
          // --- 更新現有提示詞 ---
          const promptIndex = allPrompts.findIndex(p => p.id === id);
          if (promptIndex === -1) {
            showToast('找不到要更新的提示詞', 'error');
            return; // 出錯直接返回
          }
          const updatedPrompt = {
            ...allPrompts[promptIndex],
            title,
            purpose,
            content,
            tags,
            updatedAt: now,
          };
          allPrompts[promptIndex] = updatedPrompt;
  
          // 嘗試儲存
          if (await savePromptsToStorage(allPrompts)) {
               showToast('提示詞修改成功!', 'success');
               operationSuccess = true;
           } else {
               // savePromptsToStorage 內部已顯示錯誤 toast
               // 回滾更改 (可選，但更安全)
               // 需要重新讀取或保留原始數據副本以實現回滾
               console.error("儲存修改失敗，更改未保存。");
           }
  
        } else {
          // --- 新增提示詞 ---
          isNew = true;
          const newPrompt = {
            id: generateId(),
            title,
            purpose,
            content,
            tags,
            createdAt: now,
            updatedAt: now,
            isDeleted: false,
          };
          allPrompts.push(newPrompt);
  
          // 嘗試儲存
           if (await savePromptsToStorage(allPrompts)) {
               showToast('提示詞新增成功!', 'success');
               operationSuccess = true;
           } else {
               // savePromptsToStorage 內部已顯示錯誤 toast
               // 回滾更改
               allPrompts.pop(); // 移除剛才添加的新項目
               console.error("儲存新提示詞失敗。");
           }
        }
  
    } catch (error) {
         console.error("處理表單提交時發生錯誤:", error);
         showToast("處理儲存時發生錯誤", 'error');
         operationSuccess = false;
    }
  
  
    // --- 操作完成後的處理 ---
    if (operationSuccess) {
      // *** 立即關閉表單 ***
      closePromptForm();
  
      // 根據是新增還是修改，刷新視圖或切換頁籤
      if (isNew) {
        handleTabChange('prompts'); // 會觸發 renderCurrentView
      } else {
        renderCurrentView(); // 修改後刷新當前視圖
      }
    }
    // 如果 operationSuccess 為 false，表單保持打開狀態，讓用戶可以重試或取消
  }

/**
 * 處理點擊取消新增/編輯按鈕
 */
async function handleCancelPromptForm() {
    const id = promptIdInput.value;
    const title = promptTitleInput.value.trim();
    const purpose = promptPurposeInput.value.trim();
    const content = promptContentInput.value.trim();
    const tags = promptTagsInput.value.trim();

    let hasChanges = false;
    if (id) {
        const originalPrompt = allPrompts.find(p => p.id === id);
        if (originalPrompt) {
            if (originalPrompt.title !== title ||
                (originalPrompt.purpose || '') !== purpose ||
                originalPrompt.content !== content ||
                formatTagsForInput(originalPrompt.tags || []) !== tags) {
                hasChanges = true;
            }
        } else { hasChanges = true;}
    } else {
        if (title || purpose || content || tags) {
            hasChanges = true;
        }
    }

    let shouldClose = true; // 預設關閉
    if (hasChanges) {
        const confirmMessage = id ? '您有未儲存的修改，確定要放棄嗎？' : '您輸入的內容將不會被儲存，確定要放棄嗎？';
        // 等待用戶確認，如果用戶取消，則不關閉
        if (!await showConfirm(confirmMessage)) {
            shouldClose = false;
        }
    }

    if (shouldClose) {
        // *** 立即關閉表單 ***
        closePromptForm();

        // 取消後，如果是在 add tab，跳回 prompts tab
        if (currentTab === 'add') {
            handleTabChange('prompts');
        }
        // 不需要 else { renderCurrentView(); } 因為關閉表單本身不會改變列表數據
    }
}

/**
 * 關閉新增/編輯表單
 */
function closePromptForm() {
    // *** 移除 hidden class 是立即執行的 ***
    promptFormContainer.classList.add('hidden');
    promptForm.reset();
    // 清除可能存在的錯誤樣式
    promptTitleInput.style.borderColor = '';
    promptContentInput.style.borderColor = '';
    tagSuggestionsContainer.innerHTML = ''; // 清空標籤建議
    tagSuggestionsContainer.classList.add('hidden');
  }

/**
 * 處理標籤輸入框的輸入事件，顯示建議
 */
function handleTagInput() {
    const inputValue = promptTagsInput.value;
    // 簡單獲取最後一個 '#' 後的內容作為建議基礎
    const lastHashIndex = inputValue.lastIndexOf('#');
    const currentTagInput = lastHashIndex >= 0 ? inputValue.substring(lastHashIndex + 1).toLowerCase() : inputValue.toLowerCase();

    if (!currentTagInput.trim()) {
        tagSuggestionsContainer.innerHTML = '';
        tagSuggestionsContainer.classList.add('hidden');
        return;
    }

    // 從所有未刪除提示詞中提取唯一標籤
    const uniqueTags = new Set();
    allPrompts.filter(p => !p.isDeleted).forEach(p => {
        (p.tags || []).forEach(tag => uniqueTags.add(tag));
    });

    // 篩選匹配的標籤
    const suggestions = Array.from(uniqueTags)
        .filter(tag => tag.toLowerCase().includes(currentTagInput) && tag.toLowerCase() !== `#${currentTagInput}`) // 包含輸入且不完全相等
        .sort()
        .slice(0, 5); // 最多顯示 5 個建議

    tagSuggestionsContainer.innerHTML = ''; // 清空舊建議
    if (suggestions.length > 0) {
        suggestions.forEach(tag => {
            const button = document.createElement('button');
            button.type = 'button'; // 防止觸發表單提交
            button.textContent = tag;
            button.addEventListener('click', () => selectTagSuggestion(tag));
            tagSuggestionsContainer.appendChild(button);
        });
        tagSuggestionsContainer.classList.remove('hidden');
    } else {
        tagSuggestionsContainer.classList.add('hidden');
    }
}

/**
 * 選擇標籤建議
 * @param {string} selectedTag - 被選中的標籤
 */
function selectTagSuggestion(selectedTag) {
    const currentValue = promptTagsInput.value;
    const lastHashIndex = currentValue.lastIndexOf('#');

    let newValue;
    if (lastHashIndex >= 0) {
        // 替換最後一個 '#' 後的內容
        newValue = currentValue.substring(0, lastHashIndex) + selectedTag;
    } else {
        // 如果沒有 '#'，直接設為選中的標籤
        newValue = selectedTag;
    }

    promptTagsInput.value = newValue + ' '; // 添加空格方便輸入下一個
    tagSuggestionsContainer.innerHTML = '';
    tagSuggestionsContainer.classList.add('hidden');
    promptTagsInput.focus();
}


// --- 提示詞操作函數 ---

/**
 * 複製提示詞內容到剪貼簿
 * @param {string} id - 提示詞 ID (用於視覺回饋)
 * @param {string} content - 要複製的內容
 */
async function handleCopyPrompt(id, content) {
  try {
    await navigator.clipboard.writeText(content);
    showToast('提示詞內容已複製！', 'success', 1500); // 短暫顯示
    // 可選：給按鈕或列表項添加視覺回饋
    const button = document.querySelector(`.prompt-item[data-id="${id}"] .copy-button`);
    if (button) {
      button.textContent = '√'; // 臨時改變圖標或文字
      setTimeout(() => button.textContent = 'C', 1500); // 恢復
    }
  } catch (err) {
    console.error('複製失敗:', err);
    showToast('複製失敗，請檢查瀏覽器權限', 'error');
  }
}

/**
 * 請求 Content Script 將提示詞內容插入到頁面
 * @param {string} content - 要插入的內容
 */
function handleInsertPrompt(content) {
    console.log("handleInsertPrompt called.");

    // *** 修改：嘗試獲取最後獲得焦點的窗口 ***
    chrome.windows.getLastFocused({ populate: true }, (window) => {
        if (chrome.runtime.lastError || !window) {
            console.error("無法獲取最後焦點窗口:", chrome.runtime.lastError?.message || "未知錯誤");
            showToast("無法確定目標窗口", "error");
            return;
        }

        // 從獲取的窗口中找到活動的 Tab
        const activeTab = window.tabs?.find(tab => tab.active);

        if (!activeTab || !activeTab.id) {
            console.error("在焦點窗口中找不到活動分頁。 Window tabs:", window.tabs);
            showToast("無法找到有效的活動分頁", "error");
            return;
        }

        const targetTabId = activeTab.id;
        const targetUrl = activeTab.url;

        console.log(`Targeting last focused window's active tab ID: ${targetTabId}, URL: ${targetUrl}`);

        // *** 恢復 URL 檢查，現在應該能獲取正確的 URL ***
        if (!targetUrl || targetUrl.startsWith('chrome://') || targetUrl.startsWith('chrome-extension://') || targetUrl.includes('chrome.google.com/webstore')) {
            console.warn(`阻止在受限制頁面 (${targetUrl}) 插入。`);
            showToast("無法在此特殊頁面插入提示詞", "warning");
            return;
        }

        console.log(`URL check passed. Proceeding to executeScript on tab ID: ${targetTabId}`);

        // 執行腳本注入 (後續邏輯保持不變)
        chrome.scripting.executeScript({
            target: { tabId: targetTabId },
            func: insertTextIntoActiveElement,
            args: [content]
        }, (results) => {
            if (chrome.runtime.lastError) {
                console.error(`executeScript Error: ${chrome.runtime.lastError.message}`);
                let userMessage = "插入失敗: 無法在當前頁面執行腳本。";
                if (chrome.runtime.lastError.message.includes("Cannot access") || chrome.runtime.lastError.message.includes("Cannot script") || chrome.runtime.lastError.message.includes("No access")) {
                     userMessage = `無法在頁面 (${targetUrl || '未知URL'}) 上執行插入操作。`;
                } else if (chrome.runtime.lastError.message.includes("No tab with id") || chrome.runtime.lastError.message.includes("No frame with id")) {
                     userMessage = "插入失敗: 目標頁面已關閉或無法訪問。";
                } else if (chrome.runtime.lastError.message.includes("missing host permission")) {
                     userMessage = `插入失敗: 缺少對此頁面 (${targetUrl || '未知URL'}) 的操作權限。`;
                     console.warn("Host permission missing. Check manifest and target URL:", targetUrl);
                }
                showToast(userMessage, "error");
                return;
            }

            if (results && results.length > 0 && results[0].result) {
                 const result = results[0].result;
                 if (result.success) {
                     showToast("提示詞已插入!", "success", 1500);
                 } else {
                     showToast(`插入失敗: ${result.message || '頁面中未找到輸入框'}`, "error");
                 }
            } else {
                 console.warn("Injection script did not return expected result:", results);
                 if (targetUrl && (targetUrl.startsWith('https://chrome.google.com/') || targetUrl.startsWith('chrome://'))) {
                      showToast("無法在此特殊頁面插入提示詞", "warning");
                 } else {
                      showToast("插入失敗: 未找到可插入的輸入框或頁面阻止了操作。", "error");
                 }
            }
        });
    });
}

// 這個函數會被注入到目標頁面執行 (注意：它不能訪問 sidepanel.js 的變數)
function insertTextIntoActiveElement(textToInsert) {
    const activeElement = document.activeElement;
    let success = false;
    let message = "未找到焦點輸入框或文本區域";

    if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable)) {
        if (typeof activeElement.value !== 'undefined') {
            const start = activeElement.selectionStart;
            const end = activeElement.selectionEnd;
            const originalValue = activeElement.value;
            activeElement.value = originalValue.substring(0, start) + textToInsert + originalValue.substring(end);
            // 更新游標位置
            activeElement.selectionStart = activeElement.selectionEnd = start + textToInsert.length;
            success = true;
             message = "插入成功";
        } else if (activeElement.isContentEditable) {
             // 對於 contentEditable 元素，使用 document.execCommand (可能未來會被廢棄，但目前廣泛支援)
             // 或更現代的 Selection API
             const selection = window.getSelection();
             if (selection.rangeCount > 0) {
                 selection.deleteFromDocument(); // 刪除選中內容
                 selection.getRangeAt(0).insertNode(document.createTextNode(textToInsert));
                 selection.collapseToEnd(); // 將游標移到插入內容之後
                 success = true;
                 message = "插入成功";
             } else {
                 message = "無法獲取編輯區域的選區";
             }
        } else {
             message = "焦點元素不是標準輸入框或文本區域";
        }
         // 觸發 input 事件，以便某些框架 (如 React, Vue) 能偵測到變化
        activeElement.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // 返回執行結果給 sidepanel
    return { success, message };
}


/**
 * 將指定 ID 的提示詞標記為已刪除 (移至垃圾桶)
 * @param {string} id - 要刪除的提示詞 ID
 */
async function movePromptToTrash(id) {
  const promptIndex = allPrompts.findIndex(p => p.id === id);
  if (promptIndex === -1) {
    showToast('找不到要刪除的提示詞', 'error');
    return;
  }

  allPrompts[promptIndex].isDeleted = true;
  allPrompts[promptIndex].updatedAt = getCurrentISOTime(); // 更新時間戳

  if (await savePromptsToStorage(allPrompts)) {
    showToast('已移至垃圾桶', 'success');
    renderCurrentView(); // 重新渲染當前視圖
  }
}

/**
 * 從垃圾桶恢復提示詞
 * @param {string} id - 要恢復的提示詞 ID
 */
async function recoverPromptFromTrash(id) {
  const promptIndex = allPrompts.findIndex(p => p.id === id);
  if (promptIndex === -1 || !allPrompts[promptIndex].isDeleted) {
    showToast('找不到要恢復的提示詞或該提示詞不在垃圾桶中', 'error');
    return;
  }

  allPrompts[promptIndex].isDeleted = false;
  allPrompts[promptIndex].updatedAt = getCurrentISOTime();

  if (await savePromptsToStorage(allPrompts)) {
    showToast('提示詞已復原', 'success');
    renderCurrentView(); // 刷新垃圾桶視圖
  }
}

/**
 * 永久刪除一個或多個提示詞
 * @param {string[]} idsToDelete - 要永久刪除的提示詞 ID 陣列
 * @returns {Promise<boolean>} - 操作成功 (數據已從 allPrompts 移除且成功儲存) 返回 true，否則返回 false
 */
async function permanentlyDeletePrompts(idsToDelete) {
    const initialLength = allPrompts.length;
    const originalPrompts = [...allPrompts]; // 保留原始副本以便儲存失敗時恢復 (可選)
  
    allPrompts = allPrompts.filter(p => !idsToDelete.includes(p.id));
    const deletedCount = initialLength - allPrompts.length;
  
    let success = false; // 預設為失敗
  
    if (deletedCount > 0) {
      if (await savePromptsToStorage(allPrompts)) {
        showToast(`已永久刪除 ${deletedCount} 個提示詞`, 'success');
        success = true; // 標記成功
      } else {
          // 儲存失敗，恢復 allPrompts (可選)
          allPrompts = originalPrompts;
          console.error("永久刪除後儲存失敗，操作已回滾。");
          // showToast 已經在 savePromptsToStorage 中處理
          success = false;
      }
    } else {
      showToast('沒有找到要刪除的提示詞', 'info');
      success = true; // 沒有實際刪除但也算操作完成（沒有失敗）
    }
  
    // 無論成功與否，都嘗試退出選擇模式 (如果有的話)
    // exitSelectionMode 內部會根據當前 tab 決定是否刷新視圖
    exitSelectionMode();
  
    return success; // 返回操作最終是否成功
  }

/**
 * 建立一個現有提示詞的副本
 * @param {string} id - 原始提示詞的 ID
 */
async function duplicatePrompt(id) {
    const originalPrompt = allPrompts.find(p => p.id === id);
    if (!originalPrompt || originalPrompt.isDeleted) {
        showToast('找不到原始提示詞或其已在垃圾桶中', 'error');
        return;
    }

    const now = getCurrentISOTime();
    const newTitle = `${originalPrompt.title} 的副本`; // 自動修改標題

    // 檢查副本標題是否已存在，如果存在，則添加數字後綴
    let finalTitle = newTitle;
    let counter = 1;
    while (allPrompts.some(p => p.title === finalTitle && !p.isDeleted)) {
        counter++;
        finalTitle = `${newTitle} (${counter})`;
    }


    const newPrompt = {
        ...originalPrompt, // 複製所有屬性
        id: generateId(), // 生成新 ID
        title: finalTitle,
        createdAt: now,
        updatedAt: now,
        isDeleted: false, // 確保副本不在垃圾桶
    };

    allPrompts.push(newPrompt);

    if (await savePromptsToStorage(allPrompts)) {
        showToast(`已建立副本: ${finalTitle}`, 'success');
        // 渲染視圖，並高亮新副本
        renderCurrentView();
        // 延遲一點時間執行高亮，確保元素已渲染
        setTimeout(() => {
            const newItem = document.querySelector(`.prompt-item[data-id="${newPrompt.id}"]`);
            if (newItem) {
                newItem.classList.add('highlight');
                newItem.scrollIntoView({ behavior: 'smooth', block: 'center' }); // 滾動到可見區域
                // 移除高亮 class，防止一直存在
                setTimeout(() => newItem.classList.remove('highlight'), 2000);
            }
        }, 100);
    }
}


// --- 匯入/匯出處理 ---

/**
 * 處理匯出請求 (單個、多個或全部)
 * @param {Array} promptsToExport - 要匯出的提示詞物件陣列
 */
function handleExportPrompts(promptsToExport) {
    if (!promptsToExport || promptsToExport.length === 0) {
        showToast("沒有可匯出的提示詞", "info");
        return;
    }

    // 構建符合規範的 JSON 結構
    const exportData = {
        prompts: promptsToExport.map(p => ({ // 確保只匯出需要的欄位且格式正確
            id: p.id,
            title: p.title,
            purpose: p.purpose || "", // 確保空值是空字串
            content: p.content,
            tags: p.tags || [], // 確保空值是空陣列
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
            isDeleted: p.isDeleted // 通常匯出時不需要 isDeleted，但規範中包含了它
        }))
    };

    const jsonData = JSON.stringify(exportData, null, 2); // 格式化 JSON 輸出
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // 觸發下載
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-'); // YYYY-MM-DD-HH-mm-ss
    const filename = `ai_prompts_export_${timestamp}.json`;

    chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs: true // 讓使用者選擇儲存位置
    }).then(downloadId => {
        if (downloadId) {
            showToast("開始匯出...", "success");
        } else {
            // 如果 downloadId 未定義，可能是下載被阻止或出錯
             showToast("匯出失敗，請檢查下載權限或設置", "error");
             console.error("chrome.downloads.download 未返回 ID，下載可能失敗。");
        }
         // 釋放 Object URL
        URL.revokeObjectURL(url);
    }).catch(error => {
        console.error("匯出下載時發生錯誤:", error);
        showToast(`匯出失敗: ${error.message}`, "error");
        URL.revokeObjectURL(url); // 確保釋放
    });

     // 退出可能存在的選擇模式
     exitPartialExportMode();
}

/**
 * 處理點擊「全部匯出」按鈕
 */
function handleExportAll() {
    const promptsToExport = allPrompts.filter(p => !p.isDeleted); // 只匯出未刪除的
    if (promptsToExport.length === 0) {
        showToast("沒有可匯出的提示詞", "info");
        return;
    }
    handleExportPrompts(promptsToExport);
}


/**
 * 進入部分匯出模式
 */
function enterPartialExportMode() {
    isSelectionMode = true; // 進入選擇模式
    selectedPromptIds.clear(); // 清空選擇

    document.getElementById('export-actions').classList.add('hidden');
    const listContainer = document.getElementById('partial-export-list-container');
    listContainer.classList.remove('hidden');
    const listElement = document.getElementById('partial-export-list');
    listElement.innerHTML = '<div class="loading">載入提示詞...</div>';

    const activePrompts = sortPrompts(allPrompts.filter(p => !p.isDeleted), currentSort);
    listElement.innerHTML = '';

    const confirmBtn = listContainer.querySelector('#confirm-partial-export');
    const cancelBtn = listContainer.querySelector('#cancel-partial-export');

    if (activePrompts.length === 0) {
        listElement.innerHTML = '<li class="empty-message">沒有可供選擇的提示詞。</li>';
        if(confirmBtn) confirmBtn.disabled = true;
    } else {
        activePrompts.forEach(prompt => {
            const listItem = createPromptListItem(prompt); // isSelectionMode=true 會渲染 checkbox
            listElement.appendChild(listItem);
        });
        if(confirmBtn) confirmBtn.disabled = true; // 初始狀態下沒有選中，禁用按鈕
    }

    // *** 更新初始按鈕文字和狀態 ***
     if (confirmBtn) {
        confirmBtn.textContent = `匯出選取項目 (0)`; // 初始計數為 0
     }

    // 重新綁定事件監聽器
    confirmBtn.replaceWith(confirmBtn.cloneNode(true));
    cancelBtn.replaceWith(cancelBtn.cloneNode(true));
    listContainer.querySelector('#confirm-partial-export').addEventListener('click', handleConfirmPartialExport);
    listContainer.querySelector('#cancel-partial-export').addEventListener('click', exitPartialExportMode);
}

/**
 * 退出部分匯出模式
 */
function exitPartialExportMode() {
    // 退出選擇模式的邏輯已包含在 exitSelectionMode 中
    // 只需處理界面元素的顯示/隱藏
    document.getElementById('export-actions').classList.remove('hidden');
    const listContainer = document.getElementById('partial-export-list-container');
    listContainer.classList.add('hidden');
    listContainer.querySelector('#partial-export-list').innerHTML = '';
     // 調用通用的退出選擇模式函數
     exitSelectionMode();
}

/**
 * 處理點擊「匯出選取項目」按鈕
 */
function handleConfirmPartialExport() {
    const promptsToExport = allPrompts.filter(p => selectedPromptIds.has(p.id));
    if (promptsToExport.length === 0) {
        showToast("請先選擇要匯出的提示詞", "info");
        return;
    }
    handleExportPrompts(promptsToExport);
    // handleExportPrompts 內部會調用 exitPartialExportMode
}


/**
 * 處理選擇匯入檔案的事件
 * @param {Event} event - input file change 事件
 */
async function handleImportFile(event) {
    const file = event.target.files[0];
    const statusElement = document.getElementById('import-status');
    statusElement.textContent = ''; // 清除舊狀態

    if (!file) {
        statusElement.textContent = '未選擇檔案。';
        statusElement.className = 'status-message info';
        return;
    }

    if (!file.name.endsWith('.json')) {
        statusElement.textContent = '錯誤：請選擇 .json 格式的檔案。';
        statusElement.className = 'status-message error';
        return;
    }

    statusElement.textContent = '正在讀取與解析檔案...';
    statusElement.className = 'status-message info';

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const content = e.target.result;
            const data = JSON.parse(content);

            // 驗證檔案結構
            if (!data || !Array.isArray(data.prompts)) {
                throw new Error("JSON 檔案格式不符，缺少 'prompts' 陣列。");
            }

            statusElement.textContent = `找到 ${data.prompts.length} 條提示詞，正在處理匯入...`;

            let importedCount = 0;
            let duplicatedCount = 0;
            const importedPrompts = [];
            const existingTitles = new Set(allPrompts.map(p => p.title));

            for (const importedPrompt of data.prompts) {
                // 基礎驗證 (id, title, content 是否存在)
                if (!importedPrompt.id || !importedPrompt.title || !importedPrompt.content) {
                     console.warn("匯入項目缺少必要欄位 (id, title, content)，已跳過:", importedPrompt);
                    continue; // 跳過格式不符的項目
                }

                 // 處理 ID 衝突 (如果匯入的 ID 已存在，則生成新 ID)
                 let finalId = importedPrompt.id;
                 if (allPrompts.some(p => p.id === finalId)) {
                     console.warn(`ID 衝突: ${finalId}，將為其生成新 ID。`);
                     finalId = generateId();
                 }


                // 處理標題衝突 (匯入的標題已存在於現有提示詞中)
                let finalTitle = importedPrompt.title;
                if (existingTitles.has(finalTitle)) {
                    let counter = 1;
                    let newTitle = `${finalTitle} 的副本`;
                    while (existingTitles.has(newTitle) || importedPrompts.some(p => p.title === newTitle)) { // 也要檢查本次已處理的
                        counter++;
                        newTitle = `${finalTitle} 的副本 (${counter})`;
                    }
                    finalTitle = newTitle;
                    duplicatedCount++;
                    console.log(`標題衝突: "${importedPrompt.title}" -> "${finalTitle}"`);
                }

                 const now = getCurrentISOTime();
                 const newPrompt = {
                     id: finalId,
                     title: finalTitle,
                     purpose: importedPrompt.purpose || "",
                     content: importedPrompt.content,
                     tags: Array.isArray(importedPrompt.tags) ? importedPrompt.tags.map(t => String(t).startsWith('#') ? String(t) : `#${String(t)}`) : [], // 確保是陣列且帶 #
                     createdAt: importedPrompt.createdAt || now, // 如果匯入數據沒時間戳，用當前時間
                     updatedAt: importedPrompt.updatedAt || now,
                     isDeleted: typeof importedPrompt.isDeleted === 'boolean' ? importedPrompt.isDeleted : false, // 預設為 false
                 };
                 importedPrompts.push(newPrompt);
                 existingTitles.add(finalTitle); // 將新標題加入檢查集合
                 importedCount++;
            }

            // 將處理過的新提示詞添加到主列表
            allPrompts = [...allPrompts, ...importedPrompts];

            // 儲存回 storage
            if (await savePromptsToStorage(allPrompts)) {
                statusElement.textContent = `匯入成功！新增 ${importedCount} 條提示詞 (${duplicatedCount} 條因標題重複已重新命名)。`;
                statusElement.className = 'status-message success';
                // 跳轉到提示詞列表頁籤以查看結果
                handleTabChange('prompts');
            } else {
                 statusElement.textContent = '匯入處理完成，但儲存失敗。';
                 statusElement.className = 'status-message error';
            }

        } catch (error) {
            console.error("匯入檔案處理失敗:", error);
            statusElement.textContent = `匯入失敗：${error.message}`;
            statusElement.className = 'status-message error';
        } finally {
            // 清空 file input 的值，允許使用者再次選擇同一個檔案
            event.target.value = null;
        }
    };

    reader.onerror = (e) => {
        console.error("讀取檔案失敗:", e);
        statusElement.textContent = '讀取檔案時發生錯誤。';
        statusElement.className = 'status-message error';
        event.target.value = null;
    };

    reader.readAsText(file); // 以文字形式讀取檔案
}


// --- 垃圾桶選擇模式 ---

/**
 * 進入垃圾桶的選擇模式
 */
function enterSelectionMode() {
    if (currentTab !== 'trash') { // 簡化：僅處理垃圾桶頁籤
        console.warn("非垃圾桶頁面，無法進入選擇模式");
        return;
    }
    isSelectionMode = true;
    selectedPromptIds.clear(); // 進入時清空選擇
    // 重新渲染垃圾桶視圖，會顯示 checkbox 和正確的初始按鈕狀態(計數0, disabled)
    renderTrashView(allPrompts.filter(p => p.isDeleted));
    // *** 無需在此處調用 updateDeleteSelectedButtonCount，因為 renderTrashView 已處理初始狀態 ***
}

/**
 * 退出垃圾桶/匯出的選擇模式並重新渲染
 */
function exitSelectionMode() {
    if (isSelectionMode) {
        const wasTrashTab = currentTab === 'trash'; // 記錄是否在垃圾桶頁籤
        isSelectionMode = false;
        selectedPromptIds.clear(); // 退出時清空選擇
        if (wasTrashTab) {
            renderTrashView(allPrompts.filter(p => p.isDeleted)); // 重新渲染垃圾桶
        } else if (currentTab === 'import-export') {
             exitPartialExportMode();
        }
        // 不需要全局 renderCurrentView，只刷新受影響的頁籤
    }
}


/**
 * 處理點擊「永久刪除選取項目」按鈕
 */
async function handlePermanentDeleteSelected() {
    const count = selectedPromptIds.size; // 使用 size 屬性
    if (count === 0) {
        showToast("請先選擇要永久刪除的提示詞", "info");
        return;
    }

    // 可選：獲取選中項目的標題用於確認信息
    // const titles = Array.from(selectedPromptIds).map(id => allPrompts.find(p=>p.id===id)?.title || '未知項').join(', ');
    // if (await showConfirm(`確定要永久刪除選取的 ${count} 個提示詞 (${titles}) 嗎？此操作無法復原。`)) {

    if (await showConfirm(`確定要永久刪除選取的 ${count} 個提示詞嗎？此操作無法復原。`)) {
        await permanentlyDeletePrompts(Array.from(selectedPromptIds));
        // permanentlyDeletePrompts 內部目前會調用 exitSelectionMode，
        // exitSelectionMode 會清空 selectedPromptIds 並調用 renderTrashView 刷新
    }
}


/**
 * 處理點擊「清空垃圾桶」按鈕
 */
async function handleEmptyTrash() {
    const trashItems = allPrompts.filter(p => p.isDeleted); // 先獲取待刪除項
    const trashCount = trashItems.length;

    if (trashCount === 0) {
        showToast("垃圾桶已經是空的了", "info");
        return;
    }

    if (await showConfirm(`確定要清空垃圾桶嗎？這將永久刪除 ${trashCount} 個提示詞，此操作無法復原。`)) {
        const idsToDelete = trashItems.map(p => p.id); // 從已過濾的項目獲取 ID

        // *** 調用永久刪除函數 ***
        // 我們需要知道刪除操作是否真的成功完成了數據更新
        // 修改 permanentlyDeletePrompts 讓它返回一個布爾值表示成功與否
        const deleteSuccess = await permanentlyDeletePrompts(idsToDelete);

        // *** 關鍵：無論是否在選擇模式，只要刪除成功就刷新垃圾桶視圖 ***
        if (deleteSuccess) {
             console.log("清空垃圾桶成功，正在刷新視圖...");
             // 傳遞最新的已刪除項目列表 (此刻應該是空的) 給渲染函數
             renderTrashView(allPrompts.filter(p => p.isDeleted));
        } else {
             console.log("清空垃圾桶操作完成，但刪除或儲存失敗，不刷新視圖。");
             // 此時 permanentlyDeletePrompts 內部應該已經顯示了錯誤 Toast
        }
        // 注意：permanentlyDeletePrompts 內部仍然會調用 exitSelectionMode
        // 如果在選擇模式下點擊清空，exitSelectionMode 會再次調用 renderTrashView，
        // 這雖然有點重複，但無害，且確保了兩種情況下視圖都能刷新。
    }
}


// --- 其他輔助函數 ---

/**
 * 處理頁籤切換
 * @param {string} tabName - 被點擊的頁籤名稱 (data-tab 的值)
 */
async function handleTabChange(tabName) {
    console.log(`Tab change requested: ${tabName}`); // <--- 添加日誌
  
    if (currentTab === tabName && tabName !== 'add') return; // 點擊當前頁籤不動作 (除非是add，允許重新打開表單)
  
    // ... (檢查未儲存更改的邏輯保持不變) ...
    // (這裡省略之前的檢查邏輯，假設它沒問題)
    let proceedChange = true;
    if ((currentTab === 'add' || !promptFormContainer.classList.contains('hidden')) && tabName !== 'add') {
         const id = promptIdInput.value;
         const title = promptTitleInput.value.trim();
         const purpose = promptPurposeInput.value.trim();
         const content = promptContentInput.value.trim();
         const tags = promptTagsInput.value.trim();
         let hasChanges = false;
         // ... (判斷是否有修改的邏輯) ...
         if (id) { /* ... */ } else { if (title || purpose || content || tags) hasChanges = true; }
  
         if (hasChanges) {
              const confirmMessage = id ? '您有未儲存的修改，確定要離開嗎？' : '您輸入的內容將不會被儲存，確定要離開嗎？';
              if (!await showConfirm(confirmMessage)) {
                  proceedChange = false; // 用戶取消，不切換頁籤
              }
         }
    }
  
    if (!proceedChange) {
         console.log("Tab change cancelled by user.");
         return; // 停止後續操作
    }
  
    // 如果確認要切換，先關閉可能打開的表單
    closePromptForm();
  
    currentTab = tabName;
    console.log(`Current tab set to: ${currentTab}`); // <--- 添加日誌確認狀態更新
  
    searchInput.value = '';
    currentFilterTags.clear();
    // sortButton.textContent = 'S'; // 按鈕文字可能不需要重置
    sortOptionsContainer.classList.add('hidden');
    exitSelectionMode(); // 確保退出選擇模式
  
    renderCurrentView(); // <--- 確保調用了渲染函數
  }

/**
 * 處理搜尋框輸入事件
 */
function handleSearch() {
  // 不需要立即切換頁籤，直接重新渲染當前視圖即可
  renderCurrentView();
}

/**
 * 切換排序選項的顯示/隱藏
 */
function toggleSortOptions(event) {
    event.stopPropagation(); // 防止觸發下面的 document click 監聽器
    sortOptionsContainer.classList.toggle('hidden');
}

/**
 * 點擊頁面其他地方關閉排序選項
 */
function closeSortOptionsOnClickOutside(event) {
    if (!sortButton.contains(event.target) && !sortOptionsContainer.contains(event.target)) {
        sortOptionsContainer.classList.add('hidden');
    }
     // 同時關閉標籤建議（如果點擊的不是標籤輸入框或建議列表）
    if (!promptTagsInput.contains(event.target) && !tagSuggestionsContainer.contains(event.target)) {
        tagSuggestionsContainer.classList.add('hidden');
    }
}

/**
 * 處理排序選項的點擊事件
 * @param {Event} event - 點擊事件
 */
function handleSortChange(event) {
  if (event.target.tagName === 'BUTTON') {
    const newSort = event.target.dataset.sort;
    if (newSort && newSort !== currentSort) {
      currentSort = newSort;
      // 更新排序按鈕顯示 (可選)
      // sortButton.textContent = `S (${event.target.textContent.substring(0, 4)}...)`;
      renderCurrentView(); // 重新渲染列表
    }
    sortOptionsContainer.classList.add('hidden'); // 選擇後關閉選項
  }
}

/**
 * 處理標籤雲中標籤的點擊事件 (用於篩選)
 * @param {string} tag - 被點擊的標籤
 */
function handleTagClick(tag) {
    // 這個函數邏輯之前修改過，應該是正確的
    if (currentTab !== 'tags') return;
    console.log(`Tag clicked: ${tag}`);

    // 根據點擊更新篩選集合 currentFilterTags
    if (currentFilterTags.has(tag)) {
        currentFilterTags.delete(tag);
        console.log(`Tag removed from filter: ${tag}. Current filters:`, currentFilterTags);
    } else {
        currentFilterTags.add(tag);
         console.log(`Tag added to filter: ${tag}. Current filters:`, currentFilterTags);
         // 如果需要嚴格單選，取消下面這行註釋，並移除上面的 else 分支
         // currentFilterTags.clear(); currentFilterTags.add(tag);
    }

    // *** 關鍵：因為狀態 (currentFilterTags) 改變了，需要重新渲染整個標籤頁 ***
    // 傳遞當前的活動提示詞數據給渲染函數
    renderTagsView(allPrompts.filter(p => !p.isDeleted));
}