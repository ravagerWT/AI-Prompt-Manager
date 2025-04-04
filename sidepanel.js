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
 * 根據當前狀態 (currentTab, currentSort, searchInput.value, currentFilterTags) 渲染對應的視圖
 */
function renderCurrentView() {
  // 清空選擇模式狀態
  exitSelectionMode();
  contentArea.innerHTML = ''; // 清空內容區域

  // 1. 過濾 (根據頁籤、搜尋、標籤篩選)
  let filteredPrompts = filterPrompts();

  // 2. 排序
  currentPrompts = sortPrompts(filteredPrompts, currentSort);

  // 3. 渲染特定頁籤內容
  switch (currentTab) {
    case 'prompts':
      renderPromptListView(currentPrompts.filter(p => !p.isDeleted));
      break;
    case 'add':
      openPromptForm(); // 開啟新增表單
       // 切換到新增時，通常希望列表區域是空的或顯示提示
      contentArea.innerHTML = '<p style="text-align:center; color:#6b7280;">請在上方表單中新增提示詞。</p>';
      break;
    case 'tags':
      renderTagsView(allPrompts.filter(p => !p.isDeleted));
      break;
    case 'trash':
      renderTrashView(currentPrompts.filter(p => p.isDeleted));
      break;
    case 'import-export':
      renderImportExportView();
      break;
    default:
      contentArea.innerHTML = '<p>未知頁籤</p>';
  }

  // 更新活動頁籤樣式
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

  let innerHTML = '';

  // 如果是選擇模式，添加 checkbox
  if (isSelectionMode) {
    innerHTML += `<input type="checkbox" class="prompt-select-checkbox" data-id="${prompt.id}" ${selectedPromptIds.has(prompt.id) ? 'checked' : ''}>`;
  }

   innerHTML += `<div class="prompt-details">`; // 包裹主要內容，用於 flex 佈局
   innerHTML += `
    <div class="prompt-header">
      <span class="prompt-title">${prompt.title}</span>
      <!-- 非選擇模式下才顯示右側操作按鈕 -->
      ${!isSelectionMode ? `
        <div class="prompt-actions">
          ${prompt.isDeleted ? `
            <button class="icon-button recover-button" title="復原">R</button> <!-- 復原圖標 -->
            <button class="icon-button perm-delete-button danger" title="永久刪除">X</button> <!-- 永久刪除圖標 -->
          ` : `
            <button class="icon-button copy-button" title="複製內容">C</button> <!-- 複製圖標 -->
            <button class="icon-button insert-button" title="插入到頁面">I</button> <!-- 插入圖標 -->
            <button class="icon-button duplicate-button" title="建立副本">D</button> <!-- 副本圖標 -->
            <button class="icon-button export-button" title="匯出此項">E</button> <!-- 匯出圖標 -->
            <button class="icon-button delete-button danger" title="移至垃圾桶">T</button> <!-- 垃圾桶圖標 -->
          `}
        </div>
      ` : ''}
    </div>
  `;

  // 顯示元數據 (標籤和時間)
  innerHTML += `<div class="prompt-meta">`;
  if (prompt.tags && prompt.tags.length > 0) {
      innerHTML += `<span class="tags">標籤: ${prompt.tags.map(tag => `<span>${tag}</span>`).join(' ')}</span> | `;
  }
  innerHTML += `<span class="timestamp">修改: ${formatDateTime(prompt.updatedAt)} | 建於: ${formatDateTime(prompt.createdAt)}</span>`;
  innerHTML += `</div>`;

  // 顯示內容預覽 (如果非垃圾桶項目)
  if (!prompt.isDeleted && prompt.content) {
       innerHTML += `<div class="prompt-content-preview">${prompt.content}</div>`;
   }

   innerHTML += `</div>`; // 結束 .prompt-details

  li.innerHTML = innerHTML;

  // --- 為列表項內的元素添加事件監聽器 ---

  // 點擊非按鈕區域觸發編輯 (僅對非垃圾桶項目且非選擇模式有效)
   const detailsDiv = li.querySelector('.prompt-details');
   if (detailsDiv && !prompt.isDeleted && !isSelectionMode) {
       detailsDiv.addEventListener('click', (e) => {
           // 確保點擊的不是按鈕本身
           if (!e.target.closest('.prompt-actions button')) {
               openPromptForm(prompt); // 傳入 prompt 物件以進行編輯
           }
       });
   }

   // 複製按鈕
   const copyBtn = li.querySelector('.copy-button');
   if (copyBtn) {
       copyBtn.addEventListener('click', (e) => {
           e.stopPropagation(); // 防止觸發編輯
           handleCopyPrompt(prompt.id, prompt.content);
       });
   }

   // 插入按鈕
   const insertBtn = li.querySelector('.insert-button');
   if (insertBtn) {
       insertBtn.addEventListener('click', (e) => {
           e.stopPropagation();
           handleInsertPrompt(prompt.content);
       });
   }

   // 刪除 (移至垃圾桶) 按鈕
   const deleteBtn = li.querySelector('.delete-button');
   if (deleteBtn) {
       deleteBtn.addEventListener('click', async (e) => {
           e.stopPropagation();
           if (await showConfirm(`確定要將提示詞「${prompt.title}」移至垃圾桶嗎？`)) {
               await movePromptToTrash(prompt.id);
           }
       });
   }

   // 建立副本按鈕
   const duplicateBtn = li.querySelector('.duplicate-button');
   if (duplicateBtn) {
       duplicateBtn.addEventListener('click', async (e) => {
           e.stopPropagation();
           await duplicatePrompt(prompt.id);
       });
   }

   // 匯出單項按鈕
   const exportBtn = li.querySelector('.export-button');
   if (exportBtn) {
       exportBtn.addEventListener('click', (e) => {
           e.stopPropagation();
           handleExportPrompts([prompt]); // 傳遞包含單個 prompt 的陣列
       });
   }

   // 復原按鈕 (垃圾桶內)
   const recoverBtn = li.querySelector('.recover-button');
   if (recoverBtn) {
       recoverBtn.addEventListener('click', async (e) => {
           e.stopPropagation();
           await recoverPromptFromTrash(prompt.id);
       });
   }

   // 永久刪除按鈕 (垃圾桶內)
   const permDeleteBtn = li.querySelector('.perm-delete-button');
   if (permDeleteBtn) {
       permDeleteBtn.addEventListener('click', async (e) => {
           e.stopPropagation();
           if (await showConfirm(`確定要永久刪除提示詞「${prompt.title}」嗎？此操作無法復原。`)) {
               await permanentlyDeletePrompts([prompt.id]);
           }
       });
   }

   // Checkbox (選擇模式下)
   const checkbox = li.querySelector('.prompt-select-checkbox');
   if (checkbox) {
       checkbox.addEventListener('change', (e) => {
           const id = e.target.dataset.id;
           if (e.target.checked) {
               selectedPromptIds.add(id);
           } else {
               selectedPromptIds.delete(id);
           }
           // console.log("已選取 IDs:", selectedPromptIds); // 調試用
       });
   }


  return li;
}


/**
 * 渲染標籤視圖
 * @param {Array} activePrompts - 所有未刪除的提示詞
 */
function renderTagsView(activePrompts) {
    contentArea.innerHTML = ''; // 清空

    // 1. 提取所有唯一的標籤
    const allTags = new Set();
    activePrompts.forEach(p => {
        (p.tags || []).forEach(tag => allTags.add(tag));
    });
    const sortedTags = Array.from(allTags).sort(); // 按字母排序

    // 2. 渲染標籤雲/列表
    const tagListContainer = document.createElement('div');
    tagListContainer.className = 'tag-list-container';
    tagListContainer.innerHTML = `<h3>所有標籤 (${sortedTags.length})</h3>`;

    const tagCloud = document.createElement('div');
    tagCloud.className = 'tag-cloud';

    if (sortedTags.length > 0) {
        sortedTags.forEach(tag => {
            const tagElement = document.createElement('span');
            tagElement.className = 'tag-item';
            tagElement.textContent = tag;
            tagElement.dataset.tag = tag;
            if (currentFilterTags.has(tag)) {
                tagElement.classList.add('selected');
            }
            tagElement.addEventListener('click', () => handleTagClick(tag));
            tagCloud.appendChild(tagElement);
        });
        // 添加清除篩選按鈕 (如果有篩選條件)
        if (currentFilterTags.size > 0) {
            const clearButton = document.createElement('button');
            clearButton.textContent = '清除篩選';
            clearButton.className = 'clear-tag-filter';
            clearButton.onclick = () => {
                currentFilterTags.clear();
                renderCurrentView(); // 重新渲染以清除篩選
            };
            tagCloud.appendChild(clearButton);
        }

    } else {
        tagCloud.innerHTML = '<p style="color:#6b7280;">尚未建立任何標籤。</p>';
    }
    tagListContainer.appendChild(tagCloud);
    contentArea.appendChild(tagListContainer);

    // 3. 渲染篩選後的提示詞列表 (如果沒有篩選，顯示全部)
    const promptsToShow = currentFilterTags.size > 0
        ? filterPrompts().filter(p => !p.isDeleted) // 使用已過濾且排序的列表
        : activePrompts; // 顯示所有活動提示詞

     const listContainer = document.createElement('div');
     contentArea.appendChild(listContainer); // 先添加容器，再填充列表
     renderPromptListView(sortPrompts(promptsToShow, currentSort)); // 渲染列表並排序

     // 更新提示信息
    const listTitle = document.createElement('h4');
    listTitle.style.marginTop = '15px';
    listTitle.style.marginBottom = '10px';
    if (currentFilterTags.size > 0) {
        listTitle.textContent = `包含標籤 "${Array.from(currentFilterTags).join(', ')}" 的提示詞 (${promptsToShow.length})：`;
    } else {
        listTitle.textContent = `所有提示詞 (${activePrompts.length})：`;
    }
    // 將標題插入到列表之前
    listContainer.parentNode.insertBefore(listTitle, listContainer);
}


/**
 * 渲染垃圾桶視圖
 * @param {Array} deletedPrompts - 所有已刪除的提示詞
 */
function renderTrashView(deletedPrompts) {
    contentArea.innerHTML = ''; // 清空

    // 1. 渲染頂部操作按鈕
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'trash-actions';
    actionsContainer.id = 'trash-actions-container'; // 給一個ID方便查找替換

    if (isSelectionMode) {
        actionsContainer.innerHTML = `
            <button id="perm-delete-selected" class="danger">永久刪除選取項目 (${selectedPromptIds.size})</button>
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

    // 2. 渲染已刪除的提示詞列表
    const list = document.createElement('ul');
    list.className = 'prompt-list trash-list'; // 添加 trash-list 類名用於特定樣式

    if (deletedPrompts.length === 0) {
        list.innerHTML = '<li class="empty-message">垃圾桶是空的。</li>';
    } else {
        // 在渲染列表項之前應用當前排序
        const sortedDeletedPrompts = sortPrompts(deletedPrompts, currentSort);
        sortedDeletedPrompts.forEach(prompt => {
            const listItem = createPromptListItem(prompt); // 使用通用函數創建列表項
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
  const tags = parseTags(promptTagsInput.value); // 使用工具函數解析標籤

  // 驗證必填欄位
  if (!title || !content) {
    showToast('標題和內容為必填項', 'error');
    // 可以在此處添加更明顯的視覺提示，例如高亮未填寫的欄位
     if (!title) promptTitleInput.style.borderColor = 'red'; else promptTitleInput.style.borderColor = '';
     if (!content) promptContentInput.style.borderColor = 'red'; else promptContentInput.style.borderColor = '';
    return;
  }
   // 清除可能存在的錯誤樣式
   promptTitleInput.style.borderColor = '';
   promptContentInput.style.borderColor = '';


  const now = getCurrentISOTime();
  let isNew = false;

  if (id) {
    // --- 更新現有提示詞 ---
    const promptIndex = allPrompts.findIndex(p => p.id === id);
    if (promptIndex === -1) {
      showToast('找不到要更新的提示詞', 'error');
      return;
    }
    const updatedPrompt = {
      ...allPrompts[promptIndex], // 保留原有屬性 (如 createdAt, isDeleted)
      title,
      purpose,
      content,
      tags,
      updatedAt: now,
    };
    allPrompts[promptIndex] = updatedPrompt;
    showToast('提示詞修改成功!', 'success');
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
    showToast('提示詞新增成功!', 'success');
  }

  // 儲存變更到 storage
  const success = await savePromptsToStorage(allPrompts);

  if (success) {
    // 關閉表單
    closePromptForm();
    // 如果是新增，跳轉到提示詞列表頁籤並重新渲染
    if (isNew) {
      handleTabChange('prompts'); // 會觸發 renderCurrentView
    } else {
      // 如果是修改，留在當前頁籤並重新渲染
      renderCurrentView();
    }
  }
}

/**
 * 處理點擊取消新增/編輯按鈕
 */
async function handleCancelPromptForm() {
    const id = promptIdInput.value;
    const title = promptTitleInput.value.trim();
    const purpose = promptPurposeInput.value.trim();
    const content = promptContentInput.value.trim();
    const tags = promptTagsInput.value.trim(); // 檢查是否有輸入

    // 檢查是否有未儲存的更改 (對於編輯模式或新增模式有輸入內容)
    let hasChanges = false;
    if (id) { // 編輯模式
        const originalPrompt = allPrompts.find(p => p.id === id);
        if (originalPrompt) {
            if (originalPrompt.title !== title ||
                (originalPrompt.purpose || '') !== purpose ||
                originalPrompt.content !== content ||
                formatTagsForInput(originalPrompt.tags || []) !== tags) {
                hasChanges = true;
            }
        } else { hasChanges = true;} // 找不到原始數據也算有變化（異常情況）
    } else { // 新增模式
        if (title || purpose || content || tags) {
            hasChanges = true;
        }
    }


    if (hasChanges) {
        const confirmMessage = id ? '您有未儲存的修改，確定要放棄嗎？' : '您輸入的內容將不會被儲存，確定要放棄嗎？';
        if (!await showConfirm(confirmMessage)) {
            return; // 使用者取消放棄
        }
    }

    closePromptForm();
    // 取消後，如果是在 add tab，跳回 prompts tab
    if (currentTab === 'add') {
        handleTabChange('prompts');
    } else {
       renderCurrentView(); // 確保列表狀態正確（如果在編輯時取消）
    }
}

/**
 * 關閉新增/編輯表單
 */
function closePromptForm() {
  promptFormContainer.classList.add('hidden');
  promptForm.reset();
  // 清除可能存在的錯誤樣式
  promptTitleInput.style.borderColor = '';
  promptContentInput.style.borderColor = '';
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
    // 1. 獲取當前活動的分頁
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0) {
            showToast("無法找到活動分頁", "error");
            console.error("No active tab found.");
            return;
        }
        const activeTabId = tabs[0].id;

        // 2. 向該分頁的 Content Script 發送訊息
        chrome.scripting.executeScript({
            target: { tabId: activeTabId },
            func: insertTextIntoActiveElement, // 直接傳遞函數
            args: [content] // 將內容作為參數傳遞
        }, (results) => {
            if (chrome.runtime.lastError) {
                console.error("插入腳本執行錯誤:", chrome.runtime.lastError.message);
                showToast("插入失敗: 無法在當前頁面執行腳本", "error");
                return;
            }

            // executeScript 的回調會收到一個包含每個 frame 結果的陣列
            // 我們主要關心主 frame 的結果
            if (results && results.length > 0 && results[0].result) {
                 const result = results[0].result;
                 if (result.success) {
                     showToast("提示詞已插入!", "success", 1500);
                 } else {
                     showToast(`插入失敗: ${result.message}`, "error");
                 }
            } else {
                 // 可能是 Content script 沒有正確返回結果或沒有執行
                 console.warn("插入腳本沒有返回預期的結果:", results);
                 showToast("插入失敗: 未找到可插入的輸入框", "error");
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
 */
async function permanentlyDeletePrompts(idsToDelete) {
  const initialLength = allPrompts.length;
  allPrompts = allPrompts.filter(p => !idsToDelete.includes(p.id));
  const deletedCount = initialLength - allPrompts.length;

  if (deletedCount > 0) {
    if (await savePromptsToStorage(allPrompts)) {
      showToast(`已永久刪除 ${deletedCount} 個提示詞`, 'success');
      // 清空選擇（如果是在選擇模式下觸發的）
      exitSelectionMode(); // 會觸發 renderCurrentView
    }
  } else {
    showToast('沒有找到要刪除的提示詞', 'info');
     exitSelectionMode(); // 即使沒刪除也要退出選擇模式並刷新
  }
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
    isSelectionMode = true; // 借用垃圾桶的選擇模式標記
    selectedPromptIds.clear(); // 清空之前的選擇

    // 隱藏常規匯出按鈕，顯示列表和確認/取消按鈕
    document.getElementById('export-actions').classList.add('hidden');
    const listContainer = document.getElementById('partial-export-list-container');
    listContainer.classList.remove('hidden');
    const listElement = document.getElementById('partial-export-list');
    listElement.innerHTML = '<div class="loading">載入提示詞...</div>'; // 清空並顯示載入

    // 獲取並渲染未刪除的提示詞列表（帶 checkbox）
    const activePrompts = sortPrompts(allPrompts.filter(p => !p.isDeleted), currentSort);
    listElement.innerHTML = ''; // 再次清空

    if (activePrompts.length === 0) {
        listElement.innerHTML = '<li class="empty-message">沒有可供選擇的提示詞。</li>';
        // 禁用確認匯出按鈕
        const confirmBtn = listContainer.querySelector('#confirm-partial-export');
        if(confirmBtn) confirmBtn.disabled = true;
    } else {
        activePrompts.forEach(prompt => {
            // 設置 isSelectionMode 為 true 來渲染帶 checkbox 的列表項
            const listItem = createPromptListItem(prompt);
            listElement.appendChild(listItem);
        });
         // 確保確認按鈕可用
        const confirmBtn = listContainer.querySelector('#confirm-partial-export');
        if(confirmBtn) confirmBtn.disabled = false;
    }


    // 添加確認和取消按鈕的事件監聽器 (如果尚未添加)
    const confirmBtn = listContainer.querySelector('#confirm-partial-export');
    const cancelBtn = listContainer.querySelector('#cancel-partial-export');

    // 移除舊監聽器再添加，防止重複綁定
    confirmBtn.replaceWith(confirmBtn.cloneNode(true));
    cancelBtn.replaceWith(cancelBtn.cloneNode(true));

    listContainer.querySelector('#confirm-partial-export').addEventListener('click', handleConfirmPartialExport);
    listContainer.querySelector('#cancel-partial-export').addEventListener('click', exitPartialExportMode);

}

/**
 * 退出部分匯出模式
 */
function exitPartialExportMode() {
    isSelectionMode = false;
    selectedPromptIds.clear();
    document.getElementById('export-actions').classList.remove('hidden');
    const listContainer = document.getElementById('partial-export-list-container');
    listContainer.classList.add('hidden');
    listContainer.querySelector('#partial-export-list').innerHTML = ''; // 清空列表
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
    if (currentTab !== 'trash' && currentTab !== 'import-export') {
        console.warn("非垃圾桶或匯出頁面，無法進入選擇模式");
        return;
    }
     if (currentTab === 'trash') {
        isSelectionMode = true;
        selectedPromptIds.clear();
        renderTrashView(allPrompts.filter(p => p.isDeleted)); // 重新渲染垃圾桶視圖以顯示 checkbox 和按鈕
     }
     // 部分匯出的選擇模式由 enterPartialExportMode 處理
}

/**
 * 退出垃圾桶/匯出的選擇模式並重新渲染
 */
function exitSelectionMode() {
    if (isSelectionMode) {
        isSelectionMode = false;
        selectedPromptIds.clear();
        if (currentTab === 'trash') {
            renderTrashView(allPrompts.filter(p => p.isDeleted)); // 重新渲染垃圾桶
        } else if (currentTab === 'import-export') {
             exitPartialExportMode(); // 匯出頁面使用特定退出函數
        } else {
            renderCurrentView(); // 其他頁面正常刷新
        }
    }
}


/**
 * 處理點擊「永久刪除選取項目」按鈕
 */
async function handlePermanentDeleteSelected() {
    if (selectedPromptIds.size === 0) {
        showToast("請先選擇要永久刪除的提示詞", "info");
        return;
    }

    if (await showConfirm(`確定要永久刪除選取的 ${selectedPromptIds.size} 個提示詞嗎？此操作無法復原。`)) {
        await permanentlyDeletePrompts(Array.from(selectedPromptIds));
        // permanentlyDeletePrompts 內部會調用 exitSelectionMode 並刷新視圖
    }
}

/**
 * 處理點擊「清空垃圾桶」按鈕
 */
async function handleEmptyTrash() {
    const trashCount = allPrompts.filter(p => p.isDeleted).length;
    if (trashCount === 0) {
        showToast("垃圾桶已經是空的了", "info");
        return;
    }

    if (await showConfirm(`確定要清空垃圾桶嗎？這將永久刪除 ${trashCount} 個提示詞，此操作無法復原。`)) {
        const idsToDelete = allPrompts.filter(p => p.isDeleted).map(p => p.id);
        await permanentlyDeletePrompts(idsToDelete);
        // permanentlyDeletePrompts 內部會調用 exitSelectionMode 並刷新視圖
    }
}


// --- 其他輔助函數 ---

/**
 * 處理頁籤切換
 * @param {string} tabName - 被點擊的頁籤名稱 (data-tab 的值)
 */
function handleTabChange(tabName) {
    if (currentTab === tabName) return; // 點擊當前頁籤不動作

    // 如果從 'add' 或編輯狀態切換走，檢查是否有未儲存的更改
    if ((currentTab === 'add' || !promptFormContainer.classList.contains('hidden')) && tabName !== 'add') {
         // handleCancelPromptForm 內部會處理確認和頁籤跳轉邏輯
         // 我們這裡只觸發它，但不阻塞頁籤切換本身
         handleCancelPromptForm();
         // 注意：handleCancelPromptForm 可能是異步的，如果它彈出確認框，
         // 用戶點擊取消時，頁籤實際上已經切換了。
         // 更好的做法是讓 handleCancelPromptForm 返回一個 Promise，
         // 但為了簡化，目前先這樣處理。如果用戶取消放棄，
         // 表單仍然打開，但頁籤視覺上已切換，下次渲染會恢復。
    }

    currentTab = tabName;
    searchInput.value = ''; // 切換頁籤時清空搜尋框
    currentFilterTags.clear(); // 切換頁籤時清除標籤篩選
    sortButton.textContent = 'S'; // 重置排序按鈕顯示（如果需要的話）
    sortOptionsContainer.classList.add('hidden'); // 隱藏排序選項

    closePromptForm(); // 確保表單總是關閉的，除非是點擊 'add' 或編輯
    exitSelectionMode(); // 確保退出選擇模式
    renderCurrentView();
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
    if (currentTab !== 'tags') return; // 僅在標籤頁籤有效

    // 多選邏輯 (按住 Ctrl/Cmd 或 Shift，簡單起見先做單選/取消)
    if (currentFilterTags.has(tag)) {
        currentFilterTags.delete(tag); // 再次點擊取消選中
    } else {
         // 單選模式：先清除其他選中
         // currentFilterTags.clear();
         currentFilterTags.add(tag); // 添加選中
         // 如果需要多選，移除 clear() 即可
    }
    renderCurrentView(); // 重新渲染標籤頁視圖
}