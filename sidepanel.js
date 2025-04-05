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
const searchTagSuggestionsContainer = document.getElementById('search-tag-suggestions'); // **新增**
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
  searchInput.addEventListener('input', handleSearchInput); // **綁定新的主處理函數**
  searchInput.addEventListener('keydown', handleSearchKeyDown); // **新增：處理 Enter/ESC 等鍵**

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

  // 點擊外部關閉邏輯**
  document.addEventListener('click', handleClickOutside); // **統一處理外部點擊**
}



// --- 核心渲染與邏輯 ---

/**
 * 根據當前狀態 (currentTab, currentSort, searchInput.value, currentFilterTags) 渲染對應的視圖
 */
function renderCurrentView() {
    const searchTerm = searchInput.value.trim();
    const isSearching = searchTerm !== '';

    console.log(`Rendering view. Current tab: ${currentTab}, Is Searching: ${isSearching}`);

    // 清空選擇模式狀態 (如果不在選擇模式相關頁籤)
    if (currentTab !== 'trash' && currentTab !== 'import-export') {
        exitSelectionMode(); // 確保在非選擇頁籤時退出模式
    }
    // 注意: exitSelectionMode 內部會調用其頁籤的渲染函數，可能導致重複渲染
    // 更好的做法可能是 exitSelectionMode 只重置狀態，不觸發渲染，由 renderCurrentView 主導
    // 為了簡單起見，暫時保持原樣，但注意潛在的重複渲染

    contentArea.innerHTML = ''; // 清空內容區域

    // --- 決定實際使用的渲染邏輯對應的 Tab ---
    let effectiveTabForRendering = currentTab;
    let visualTabToActivate = currentTab;

    if (isSearching) {
        // **如果正在搜尋，強制使用 'prompts' 的渲染邏輯和視覺樣式**
        effectiveTabForRendering = 'prompts';
        visualTabToActivate = 'prompts'; // 同步視覺狀態
        console.log("Search active, forcing render as 'prompts' tab.");
    }

    // --- 更新視覺上活動的頁籤樣式 ---
    updateActiveTabStyle(visualTabToActivate);

    // --- 過濾數據 ---
    // filterPrompts 現在能正確處理搜尋和非搜尋情況
    let filteredPrompts = filterPrompts();
    currentPrompts = sortPrompts(filteredPrompts, currentSort); // 排序應用於過濾結果

    // --- 根據 effectiveTabForRendering 選擇渲染函數 ---
    switch (effectiveTabForRendering) {
        case 'prompts':
            console.log(`Rendering 'prompts' view logic (Tab: ${currentTab}, Search: ${isSearching})`);
            // **傳遞已過濾和排序的列表，渲染函數需要能處理包含已刪除項目的情況**
            renderPromptListView(currentPrompts);
            break;
        case 'add':
            // 只有在 currentTab 真的是 'add' 且 *沒有* 搜尋時才會執行到這裡
            console.log("Handling 'add' tab (No search)");
            openPromptForm();
            contentArea.innerHTML = '<p style="text-align:center; color:#6b7280;">請在上方表單中新增提示詞。</p>';
            break;
        case 'tags':
             // 只有在 currentTab 真的是 'tags' 且 *沒有* 搜尋時才會執行到這裡
            console.log("Calling renderTagsView for 'tags' tab (No search)");
            renderTagsView(allPrompts.filter(p => !p.isDeleted)); // Tags 視圖基於所有活動提示詞
            break;
        case 'trash':
             // 只有在 currentTab 真的是 'trash' 且 *沒有* 搜尋時才會執行到這裡
            console.log("Calling renderTrashView for 'trash' tab (No search)");
            // 傳遞已按 isDeleted 過濾的數據
            renderTrashView(currentPrompts);
            break;
        case 'import-export':
             // 只有在 currentTab 真的是 'import-export' 且 *沒有* 搜尋時才會執行到這裡
            console.log("Calling renderImportExportView for 'import-export' tab (No search)");
            renderImportExportView();
            break;
        default:
            console.error(`Unknown effective tab for rendering: ${effectiveTabForRendering}`);
            contentArea.innerHTML = '<p>錯誤：未知的頁籤狀態</p>';
    }
}

/**
 * 過濾提示詞列表
 * @returns {Array} 過濾後的提示詞陣列
 */
function filterPrompts() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const isSearching = searchTerm !== ''; // 是否正在執行搜尋

    return allPrompts.filter(prompt => {
        // --- 步驟 1: 關鍵字搜尋 (如果正在搜尋) ---
        if (isSearching) {
            const titleMatch = prompt.title.toLowerCase().includes(searchTerm);
            const purposeMatch = prompt.purpose?.toLowerCase().includes(searchTerm) || false;
            const contentMatch = prompt.content.toLowerCase().includes(searchTerm);
            const tagsMatch = (prompt.tags || []).some(tag => tag.toLowerCase().includes(searchTerm));

            if (!(titleMatch || purposeMatch || contentMatch || tagsMatch)) {
                return false; // 任何一個都不匹配則過濾掉
            }
            // **如果正在搜尋，則不再應用後續的基於 Tab 的過濾**
            // 搜尋結果需要包含所有狀態的提示詞，讓渲染函數去區分顯示
        } else {
            // --- 步驟 2: 基於 Tab 的過濾 (如果沒有在搜尋) ---
            switch (currentTab) {
                case 'trash':
                    // 在垃圾桶頁籤，只顯示 isDeleted 為 true 的
                    if (!prompt.isDeleted) return false;
                    break;
                case 'tags':
                    // 在標籤頁籤，不顯示已刪除的，並應用標籤篩選 (如果有的話)
                    if (prompt.isDeleted) return false;
                    if (currentFilterTags.size > 0) {
                        const promptTags = new Set(prompt.tags || []);
                        let matchesAllTags = true;
                        for (const filterTag of currentFilterTags) {
                            if (!promptTags.has(filterTag)) {
                                matchesAllTags = false;
                                break;
                            }
                        }
                        if (!matchesAllTags) return false;
                    }
                    break;
                case 'prompts':
                case 'import-export': // 匯入匯出頁面本身不顯示列表，但如果未來有列表也應排除已刪除
                default:
                    // 在其他頁籤 (主要是提示詞頁籤)，不顯示 isDeleted 為 true 的
                    if (prompt.isDeleted) return false;
                    break;
            }
        }

        return true; // 通過所有適用的篩選條件
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
 * @param {string | null} forceTab - 強制設置哪個頁籤為活動狀態，如果為 null，則使用 currentTab
 */
function updateActiveTabStyle(forceTab = null) {
    const tabToActivate = forceTab || currentTab; // 使用強制指定的頁籤，否則用當前的
    // console.log(`Updating active tab style. Activating: ${tabToActivate}`); // 可選日誌
    tabButtons.forEach(button => {
        if (button.dataset.tab === tabToActivate) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
}

// --- 頁籤渲染函數 ---

/**
 * 渲染提示詞列表視圖 (用於 'prompts' 頁籤和搜尋結果)
 * @param {Array} promptsToRender - 要渲染的提示詞陣列 (可能包含已刪除項，在搜尋時)
 */
function renderPromptListView(promptsToRender) {
    contentArea.innerHTML = ''; // 清空現有內容
    const list = document.createElement('ul');
    list.className = 'prompt-list';

    if (promptsToRender.length === 0) {
        // 根據是否有搜尋詞提供不同提示
        list.innerHTML = `<li class="empty-message">${searchInput.value.trim() ? '找不到符合條件的提示詞。' : '還沒有提示詞，點擊「新增提示詞」開始吧！'}</li>`;
    } else {
        promptsToRender.forEach(prompt => {
            // createPromptListItem 已經能根據 prompt.isDeleted 添加 .deleted class
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
    if (isSelectionMode) {
        checkboxHTML = `<input type="checkbox" class="prompt-select-checkbox" data-id="${prompt.id}" data-prompt-title="${prompt.title}" ${selectedPromptIds.has(prompt.id) ? 'checked' : ''}>`;
    }

    let actionsHTML = '';
    if (!isSelectionMode) {
        actionsHTML = `<div class="prompt-actions">`;
        if (prompt.isDeleted) {
            actionsHTML += `
                <button class="icon-button recover-button" title="復原">復</button>
                <button class="icon-button perm-delete-button danger" title="永久刪除">除</button>
            `;
        } else {
            actionsHTML += `
                <button class="icon-button copy-button" title="複製內容">複</button>
                <button class="icon-button insert-button" title="插入到頁面">插</button>
                <button class="icon-button duplicate-button" title="建立副本">副</button>
                <button class="icon-button export-button" title="匯出此項">匯</button>
                <button class="icon-button delete-button danger" title="移至垃圾桶">刪</button>
            `;
        }
        actionsHTML += `</div>`;
    }

    // --- 構建新的順序，包含條件式顯示 Purpose 和 Tags ---
    li.innerHTML = `
        ${checkboxHTML}
        <div class="prompt-details">
            <!-- 1. 提示詞標題 -->
            <div class="prompt-header">
                <span class="prompt-title">${prompt.title}</span>
            </div>

            <!-- 2. 提示詞用途 (如果存在) -->
            ${prompt.purpose ? `
                <div class="prompt-purpose">
                    <span class="purpose-label">用途:</span> ${prompt.purpose}
                </div>
            ` : ''}

            <!-- 3. 提示詞內容 (預覽，僅非垃圾桶) -->
            ${(!prompt.isDeleted && prompt.content) ? `
                <div class="prompt-content-preview">${prompt.content}</div>
                ` : ''}

            <!-- 4. 標籤 (如果存在) -->
            ${(prompt.tags && prompt.tags.length > 0) ? `
                <div class="prompt-tags">
                    ${prompt.tags.map(tag => `<span>${tag}</span>`).join(' ')}
                </div>
            ` : ''}

            <!-- 5. 修改及建立日期時間 -->
            <div class="prompt-timestamps">
                <span class="timestamp-label">修改:</span> ${formatDateTime(prompt.updatedAt)} |
                <span class="timestamp-label">建於:</span> ${formatDateTime(prompt.createdAt)}
            </div>

            <!-- 6. 互動按鈕 -->
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
    activePrompts.forEach(p => { (p.tags || []).forEach(tag => { /* ... */ allTags.add(tag); }); });
    const sortedTags = Array.from(allTags).sort();

    const tagListContainer = document.createElement('div');
    // ... (設置 class, sticky 樣式等) ...
    tagListContainer.className = 'tag-list-container'; // Make sure sticky styles are applied
    tagListContainer.style.position = 'sticky';
    tagListContainer.style.top = '-1px'; // or 0
    tagListContainer.style.backgroundColor = '#f4f4f5'; // Match background
    tagListContainer.style.zIndex = '10';
    tagListContainer.style.paddingBottom = '10px';
    tagListContainer.style.borderBottom = '1px solid #eee';
    tagListContainer.style.paddingTop = '1px'; // If using top: -1px

    tagListContainer.innerHTML = `<h3>所有標籤 (${sortedTags.length})</h3>`;

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
            // *** 修改：傳遞 event 對象給 handleTagClick ***
            tagElement.addEventListener('click', (event) => handleTagClick(tag, event));
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
        // ... (篩選 promptsToShow 的邏輯) ...
        promptsToShow = activePrompts.filter(prompt => {
             const promptTags = new Set(prompt.tags || []);
             let matchesAll = true;
             for (const filterTag of currentFilterTags) {
                 if (!promptTags.has(filterTag)) {
                     matchesAll = false;
                     break;
                 }
             }
             return matchesAll;
        });
    } else {
         promptsToShow = activePrompts;
    }

    // 創建列表容器和標題
    const listContainer = document.createElement('div');
    listContainer.id = 'tags-prompt-list-container'; // 給一個唯一 ID 方便調試

    const listTitle = document.createElement('h4');
    // ... (設置 listTitle 的樣式和文本) ...
     listTitle.style.marginTop = '20px';
     listTitle.style.marginBottom = '10px';
     if (currentFilterTags.size > 0) {
         // For multiple tags, use ' & '
         listTitle.textContent = `包含標籤 "${Array.from(currentFilterTags).join(' & ')}" 的提示詞 (${promptsToShow.length})：`;
     } else {
         listTitle.textContent = `所有提示詞 (${activePrompts.length})：`;
     }
    listContainer.appendChild(listTitle);

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
    console.log("renderImportExportView: Function started."); // 日誌：函數開始

    // --- 準備 HTML 結構 (保持不變) ---
    const importExportHTML = `
        <div class="import-export-section">
            <div class="export-heading-container">
                <h3>匯出提示詞</h3>
                <div id="partial-export-action-buttons" class="hidden">
                    <button id="confirm-partial-export" class="primary" disabled>匯出選取項目 (0)</button>
                    <button id="cancel-partial-export">取消</button>
                </div>
            </div>
            <div class="import-export-actions" id="export-actions">
                <button id="export-partial-button">部分匯出...</button>
                <button id="export-all-button">全部匯出為 JSON</button>
            </div>
            <div id="partial-export-list-container" class="hidden">
                <h4>選擇要匯出的提示詞：</h4>
                <ul id="partial-export-list" class="prompt-list"></ul>
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

    const footerHTML = `
        <footer class="plugin-footer">
            <a href="https://github.com/ravagerWT/AI-Prompt-Manager" target="_blank" rel="noopener noreferrer" title="點擊前往官方網站" class="footer-icon-link">
                <img src="icons/icon16.png" alt="插件圖標" class="footer-icon">
            </a>
            <span class="footer-text">點擊左側圖標前往官方網站</span>
            <span id="footer-version-info" class="footer-version">v....</span>
        </footer>
    `;

    // --- 1. 更新 DOM ---
    console.log("renderImportExportView: Setting innerHTML...");
    try {
        contentArea.innerHTML = importExportHTML + footerHTML;
        console.log("renderImportExportView: innerHTML assignment completed.");
    } catch (error) {
        console.error("renderImportExportView: Error during innerHTML assignment:", error);
        contentArea.innerHTML = "<p style='color:red;'>載入匯入/匯出介面時發生錯誤。</p>"; // 提供錯誤回饋
        return; // 如果 innerHTML 設置失敗，後續操作無意義
    }


    // --- 2. **延遲執行**後續操作 (確保 DOM 更新) ---
    // 使用 requestAnimationFrame 或 setTimeout 0
    // requestAnimationFrame 通常更好，它會在下一次瀏覽器重繪前執行
    requestAnimationFrame(() => {
        console.log("renderImportExportView: Running post-render setup (requestAnimationFrame)...");
        try {
            // --- 查找必要的元素 ---
            const exportPartialBtn = document.getElementById('export-partial-button');
            const exportAllBtn = document.getElementById('export-all-button');
            const importFileElement = document.getElementById('import-file');
            const footerElement = contentArea.querySelector('.plugin-footer'); // 使用 querySelector
            const versionElement = document.getElementById('footer-version-info');

            // --- 檢查 Footer 是否存在 ---
            if (footerElement) {
                console.log("renderImportExportView: Footer element found.");
                // --- 填充版本號 ---
                if (versionElement) {
                    console.log("renderImportExportView: Version element found.");
                    try {
                        const manifest = chrome.runtime.getManifest();
                        if (manifest && manifest.version) {
                            versionElement.textContent = `v${manifest.version}`;
                            console.log("renderImportExportView: Version set to:", manifest.version);
                        } else {
                            versionElement.textContent = 'v?.?.?';
                            console.warn("renderImportExportView: Could not get version from manifest object:", manifest);
                        }
                    } catch (e) {
                        console.error("renderImportExportView: Error getting manifest or setting version:", e);
                        versionElement.textContent = 'v?.?.?';
                    }
                } else {
                    console.error("renderImportExportView: #footer-version-info element NOT FOUND inside footer!");
                }
            } else {
                console.error("renderImportExportView: Footer element (.plugin-footer) NOT FOUND after setting innerHTML!");
                // 如果 Footer 沒找到，可能 HTML 結構或 CSS 有問題
                // 檢查 Elements 面板確認結構和 CSS 樣式 (如 display: none)
            }


            // --- 綁定事件監聽器 ---
            if (exportPartialBtn) {
                console.log("renderImportExportView: Binding listener to Partial Export button.");
                // **確保移除舊監聽器 (如果可能重複渲染)**
                // 雖然每次設置 innerHTML 會移除舊的，但為了健壯性，可以這樣寫
                // 或者確保 renderImportExportView 不會在無需刷新的情況下被調用
                exportPartialBtn.removeEventListener('click', enterPartialExportMode); // 移除舊的 (如果存在)
                exportPartialBtn.addEventListener('click', enterPartialExportMode);
                 // **檢查按鈕是否被禁用**
                 if (exportPartialBtn.disabled) {
                    console.warn("Partial export button is disabled.");
                 } else {
                    console.log("Partial export button is enabled.")
                 }
            } else {
                console.error("renderImportExportView: #export-partial-button not found!");
            }

            if (exportAllBtn) {
                console.log("renderImportExportView: Binding listener to Export All button.");
                exportAllBtn.removeEventListener('click', handleExportAll);
                exportAllBtn.addEventListener('click', handleExportAll);
                 if (exportAllBtn.disabled) {
                    console.warn("Export all button is disabled.");
                 } else {
                     console.log("Export all button is enabled.")
                 }
            } else {
                console.error("renderImportExportView: #export-all-button not found!");
            }

            if (importFileElement) {
                console.log("renderImportExportView: Binding listener to Import file input.");
                importFileElement.removeEventListener('change', handleImportFile);
                importFileElement.addEventListener('change', handleImportFile);
            } else {
                console.error("renderImportExportView: #import-file not found!");
            }

            console.log("renderImportExportView: Post-render setup finished.");

        } catch (error) {
             console.error("renderImportExportView: Error during post-render setup:", error);
        }
    }); // 結束 requestAnimationFrame
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
    console.log("Entering partial export mode..."); // 日誌：函數開始
    isSelectionMode = true;
    selectedPromptIds.clear();

    document.getElementById('export-actions').classList.add('hidden');
    const listContainer = document.getElementById('partial-export-list-container');
    const newButtonContainer = document.getElementById('partial-export-action-buttons');

    // *** 關鍵：檢查元素是否存在並移除 hidden ***
    if (newButtonContainer) {
        console.log("Partial export action buttons container found. Removing hidden class...");
        newButtonContainer.classList.remove('hidden');
        // *** 檢查是否真的移除了 ***
        console.log("Button container class list after remove:", newButtonContainer.className);
        // *** 檢查計算後的樣式，確認 display 不是 none ***
        if (window.getComputedStyle(newButtonContainer).display === 'none') {
             console.warn("Button container display style is still 'none' after removing hidden class! Check CSS conflicts.");
        } else {
             console.log("Button container display style is now:", window.getComputedStyle(newButtonContainer).display);
        }
    } else {
        console.error("#partial-export-action-buttons element NOT FOUND in the DOM!");
        // 如果元素找不到，後續綁定監聽器等都會失敗
        return; // 提前退出，防止後續錯誤
    }

    // 顯示列表容器
     if(listContainer) {
        listContainer.classList.remove('hidden');
     } else {
        console.error("#partial-export-list-container element NOT FOUND!");
        return
     }


    const listElement = document.getElementById('partial-export-list');
    if(!listElement) {
        console.error("#partial-export-list element NOT FOUND!");
        return;
    }
    listElement.innerHTML = '<div class="loading">載入提示詞...</div>';

    const activePrompts = sortPrompts(allPrompts.filter(p => !p.isDeleted), currentSort);
    listElement.innerHTML = '';

    const confirmBtn = newButtonContainer.querySelector('#confirm-partial-export');
    const cancelBtn = newButtonContainer.querySelector('#cancel-partial-export');

    // 檢查按鈕是否存在
    if (!confirmBtn || !cancelBtn) {
        console.error("Confirm or Cancel button not found within #partial-export-action-buttons!");
        return;
    }


    if (activePrompts.length === 0) {
        listElement.innerHTML = '<li class="empty-message">沒有可供選擇的提示詞。</li>';
        confirmBtn.disabled = true;
    } else {
        activePrompts.forEach(prompt => {
            const listItem = createPromptListItem(prompt);
            listElement.appendChild(listItem);
        });
        confirmBtn.disabled = true; // 初始禁用
    }

    confirmBtn.textContent = `匯出選取項目 (0)`;

    // 重新綁定事件監聽器
    const newConfirmBtn = confirmBtn.cloneNode(true); // 使用 cloneNode 清除監聽器
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    newConfirmBtn.addEventListener('click', handleConfirmPartialExport);

    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    newCancelBtn.addEventListener('click', exitPartialExportMode);

    updateDeleteSelectedButtonCount();
    console.log("Partial export mode setup complete."); // 日誌：函數結束
}

/**
 * 退出部分匯出模式
 */
function exitPartialExportMode() {
    // *** 隱藏列表和新的按鈕容器，顯示初始按鈕 ***
    document.getElementById('export-actions').classList.remove('hidden'); // 顯示初始按鈕
    const listContainer = document.getElementById('partial-export-list-container');
    listContainer.classList.add('hidden'); // 隱藏列表
    listContainer.querySelector('#partial-export-list').innerHTML = ''; // 清空列表內容
    const newButtonContainer = document.getElementById('partial-export-action-buttons');
    newButtonContainer.classList.add('hidden'); // *** 隱藏新的按鈕容器 ***

    // 調用通用的退出選擇模式函數來重置狀態
     exitSelectionMode(); // 這個會設置 isSelectionMode = false, 清空 selectedPromptIds
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
 * 處理頁籤切換 (由用戶點擊觸發)
 * @param {string} tabName - 被點擊的頁籤名稱 (data-tab 的值)
 */
async function handleTabChange(tabName) {
    console.log(`User initiated tab change to: ${tabName}`);

    // 檢查是否可以安全切換 (例如，檢查未儲存的表單)
    // ... (省略未儲存更改的確認邏輯，假設它工作正常) ...
    let proceedChange = true;
    // if (unsavedChanges && !await confirmExit()) { proceedChange = false; }

    if (!proceedChange) {
        console.log("Tab change cancelled by user.");
        return; // 停止切換
    }

    // 關閉可能打開的表單
    closePromptForm();

    // 更新當前邏輯 Tab
    currentTab = tabName;

    // *** 關鍵：用戶手動切換頁籤時，清空搜尋狀態 ***
    if (searchInput.value !== '') {
        searchInput.value = ''; // 清空搜尋框
        // 隱藏搜尋建議 (如果有的話)
        if (searchTagSuggestionsContainer && !searchTagSuggestionsContainer.classList.contains('hidden')) {
             searchTagSuggestionsContainer.classList.add('hidden');
             console.log("Search suggestions hidden due to tab change.");
        }
        console.log("Search input cleared due to manual tab change.");
    }
    currentFilterTags.clear(); // 同樣清空標籤篩選
    sortOptionsContainer.classList.add('hidden'); // 隱藏排序選項
    exitSelectionMode(); // 退出可能存在的選擇模式

    // *** 觸發渲染，renderCurrentView 會根據新的 currentTab 和空的搜尋框來渲染 ***
    renderCurrentView();
}

/**
 * 處理主搜尋框的輸入事件 (包含建議和觸發列表更新)
 */
function handleSearchInput() {
    const searchTerm = searchInput.value;
    handleTagSuggestions(searchTerm); // 處理標籤建議顯示/隱藏
    triggerRenderOnSearch(); // 觸發主列表的過濾和渲染
}

/**
 * 處理標籤建議邏輯
 * @param {string} currentInputValue - 當前搜尋框的值
 */
function handleTagSuggestions(currentInputValue) {
    const lastHashIndex = currentInputValue.lastIndexOf('#');
    let showSuggestions = false;
    let suggestions = [];

    // 條件：最後一個 '#' 後面有非空格字符
    if (lastHashIndex !== -1) {
        const potentialTagQuery = currentInputValue.substring(lastHashIndex + 1);
        if (potentialTagQuery.length > 0 && !potentialTagQuery.includes(' ')) {
            const tagQuery = potentialTagQuery.toLowerCase();
            const uniqueTags = getUniqueActiveTags(); // 獲取所有可用標籤
            suggestions = uniqueTags.filter(tag =>
                // 忽略大小寫和開頭的 # 進行比較
                tag.toLowerCase().substring(1).startsWith(tagQuery)
            )
            .sort() // 按字母排序
            .slice(0, 7); // 最多顯示 7 個建議

            if (suggestions.length > 0) {
                showSuggestions = true;
            }
        }
    }

    renderSearchSuggestions(suggestions, showSuggestions);
}

/**
 * 渲染搜尋框的標籤建議
 * @param {string[]} suggestions - 要顯示的標籤建議陣列
 * @param {boolean} show - 是否顯示建議框
 */
function renderSearchSuggestions(suggestions, show) {
    if (!searchTagSuggestionsContainer) return; // 防禦性檢查

    searchTagSuggestionsContainer.innerHTML = ''; // 清空舊建議
    if (show && suggestions.length > 0) {
        suggestions.forEach(tag => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = tag;
            // 使用 mousedown 而不是 click，可以避免失去焦點導致建議框先隱藏
            button.addEventListener('mousedown', (e) => {
                 e.preventDefault(); // 防止輸入框失去焦點
                 selectSearchTagSuggestion(tag);
             });
            searchTagSuggestionsContainer.appendChild(button);
        });
        searchTagSuggestionsContainer.classList.remove('hidden');
    } else {
        searchTagSuggestionsContainer.classList.add('hidden');
    }
}

/**
 * 處理選擇搜尋標籤建議的事件
 * @param {string} selectedTag - 被選中的標籤
 */
function selectSearchTagSuggestion(selectedTag) {
    const currentValue = searchInput.value;
    const lastHashIndex = currentValue.lastIndexOf('#');

    // 用選中的標籤替換從最後一個 # 開始的部分
    if (lastHashIndex !== -1) {
        searchInput.value = currentValue.substring(0, lastHashIndex) + selectedTag;
    } else {
        // 理論上不應發生，但作為備用
        searchInput.value = selectedTag;
    }

    searchTagSuggestionsContainer.classList.add('hidden'); // 隱藏建議
    searchInput.focus(); // 保持焦點
    triggerRenderOnSearch(); // 立即觸發使用新值的搜索
}

/**
 * 獲取所有唯一的、未刪除的提示詞標籤
 * @returns {string[]} - 標籤陣列
 */
function getUniqueActiveTags() {
    const uniqueTags = new Set();
    allPrompts.filter(p => !p.isDeleted).forEach(p => {
        (p.tags || []).forEach(tag => {
            if (tag && typeof tag === 'string') {
               uniqueTags.add(tag);
            }
        });
    });
    return Array.from(uniqueTags);
}

/**
 * 處理搜尋框的按鍵事件 (例如 Enter, Escape)
 * @param {KeyboardEvent} event
 */
function handleSearchKeyDown(event) {
    const suggestionsVisible = !searchTagSuggestionsContainer.classList.contains('hidden');

    if (suggestionsVisible) {
        if (event.key === 'Escape') {
             event.preventDefault(); // 阻止默認行為 (如清空輸入框)
             searchTagSuggestionsContainer.classList.add('hidden'); // 隱藏建議
        }
        // 可以添加上下鍵選擇建議的邏輯 (較複雜，暫不實現)
        // else if (event.key === 'ArrowDown') { ... }
        // else if (event.key === 'ArrowUp') { ... }
        // else if (event.key === 'Enter') { ... select highlighted suggestion ... }
    }
    // 按下 Enter 鍵時，即使建議不可見，也可能需要觸發搜索 (瀏覽器默認行為可能已處理)
}

/**
 * 觸發主列表的過濾和重新渲染 (原 handleSearch 的核心)
 */
function triggerRenderOnSearch() {
    // 這個函數不需要改變，它調用 renderCurrentView
    renderCurrentView();
}
  
/**
 * 統一處理點擊外部區域隱藏下拉框的邏輯
 * @param {MouseEvent} event
 */
function handleClickOutside(event) {
    // 關閉排序選項
    if (sortOptionsContainer && sortButton && // 添加檢查
        !sortButton.contains(event.target) &&
        !sortOptionsContainer.contains(event.target)) {
        sortOptionsContainer.classList.add('hidden');
    }

    // 關閉搜尋建議
    if (searchTagSuggestionsContainer && searchInput && // 添加檢查
        !searchInput.contains(event.target) &&
        !searchTagSuggestionsContainer.contains(event.target)) {
        searchTagSuggestionsContainer.classList.add('hidden');
    }

    // 關閉表單標籤建議 (如果需要的話)
    const formTagSuggestionsContainer = document.getElementById('tag-suggestions');
    const formTagsInput = document.getElementById('prompt-tags');
    if (formTagSuggestionsContainer && formTagsInput &&
        !formTagsInput.contains(event.target) &&
        !formTagSuggestionsContainer.contains(event.target)) {
        formTagSuggestionsContainer.classList.add('hidden');
    }
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
 * @param {MouseEvent} event - 原始的點擊事件對象
 */
function handleTagClick(tag, event) {
    if (currentTab !== 'tags') return;
    console.log(`Tag clicked: ${tag}, Ctrl/Cmd pressed: ${event.ctrlKey || event.metaKey}`);

    const isMultiSelectModifier = event.ctrlKey || event.metaKey; // 檢查是否按下了 Ctrl 或 Cmd

    if (isMultiSelectModifier) {
        // --- 多選/切換邏輯 (按住 Ctrl/Cmd) ---
        if (currentFilterTags.has(tag)) {
            // 如果已選中，則移除
            currentFilterTags.delete(tag);
            console.log(`Tag removed (multi-select): ${tag}. Current filters:`, currentFilterTags);
        } else {
            // 如果未選中，則添加
            currentFilterTags.add(tag);
            console.log(`Tag added (multi-select): ${tag}. Current filters:`, currentFilterTags);
        }
    } else {
        // --- 單選邏輯 (直接點擊) ---
        // 檢查是否點擊了已經是唯一選中的標籤
        if (currentFilterTags.size === 1 && currentFilterTags.has(tag)) {
            // 如果是，則取消篩選 (恢復顯示全部)
            currentFilterTags.clear();
            console.log(`Tag deselected (was only one): ${tag}. Filter cleared.`);
        } else {
            // 否則，清除所有現有篩選，只選中當前點擊的標籤
            currentFilterTags.clear();
            currentFilterTags.add(tag);
            console.log(`Filter set to single tag (direct click): ${tag}.`);
        }
    }

    // 狀態已更新，重新渲染標籤頁視圖
    renderTagsView(allPrompts.filter(p => !p.isDeleted));
}