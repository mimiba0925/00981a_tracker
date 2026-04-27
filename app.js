/**
 * 00981a 追蹤神器 - 前端邏輯
 */

// 狀態管理
const state = {
    dates: [],
    currentDate: null,
    rawData: [],
    sortCol: 'WeightChange',
    sortAsc: false,
    searchQuery: ''
};

// DOM 元素
const els = {
    dateSelect: document.getElementById('date-select'),
    tableBody: document.getElementById('table-body'),
    loading: document.getElementById('loading-spinner'),
    searchInput: document.getElementById('search-input'),
    topBuySymbol: document.querySelector('#top-buy .symbol'),
    topBuyValue: document.querySelector('#top-buy .value'),
    topSellSymbol: document.querySelector('#top-sell .symbol'),
    topSellValue: document.querySelector('#top-sell .value'),
    totalChanges: document.querySelector('#total-changes .value'),
    thElements: document.querySelectorAll('th[data-sort]')
};

// 初始化
async function init() {
    try {
        // 取得日期列表
        const res = await fetch('data/dates.json');
        if (!res.ok) throw new Error('無法載入日期列表');
        state.dates = await res.json();
        
        if (state.dates.length === 0) {
            showError('沒有找到任何資料檔案。');
            return;
        }

        // 填入下拉選單
        els.dateSelect.innerHTML = state.dates.map(date => 
            `<option value="${date}">${formatDate(date)}</option>`
        ).join('');

        // 監聽事件
        els.dateSelect.addEventListener('change', (e) => loadDataForDate(e.target.value));
        els.searchInput.addEventListener('input', (e) => {
            state.searchQuery = e.target.value.toLowerCase();
            renderTable();
        });

        els.thElements.forEach(th => {
            th.addEventListener('click', () => handleSort(th.dataset.sort));
        });

        // 載入最新一天的資料
        loadDataForDate(state.dates[0]);

    } catch (error) {
        console.error(error);
        showError('初始化失敗：' + error.message);
    }
}

// 格式化 YYYYMMDD 為 YYYY-MM-DD
function formatDate(dateStr) {
    if (dateStr.length !== 8) return dateStr;
    return `${dateStr.substring(0,4)}-${dateStr.substring(4,6)}-${dateStr.substring(6,8)}`;
}

// 載入特定日期的 CSV 資料
async function loadDataForDate(date) {
    state.currentDate = date;
    els.tableBody.innerHTML = '';
    els.loading.style.display = 'block';

    try {
        const res = await fetch(`data/00981a_composition_change_${date}.csv`);
        if (!res.ok) throw new Error(`找不到 ${date} 的資料`);
        const csvText = await res.text();
        
        parseCSV(csvText);
        updateSummary();
        renderTable();
    } catch (error) {
        console.error(error);
        showError('讀取資料失敗：' + error.message);
    } finally {
        els.loading.style.display = 'none';
    }
}

// 簡易 CSV 解析器
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
        state.rawData = [];
        return;
    }

    // 假設格式: 變化類別,股票代號,股票名稱,股數_D1,股數_D2,股數變化,權重_D1(%),權重_D2(%),權重變化(%)
    // 注意：有些移除的項目欄位可能是空的
    
    state.rawData = lines.slice(1).map(line => {
        // 簡單的 split，沒有處理引號內的逗號 (假設這個 CSV 比較乾淨)
        const cols = line.split(',');
        
        return {
            ChangeType: cols[0] || '',
            Symbol: cols[1] || '',
            Name: cols[2] || '',
            SharesChange: parseInt(cols[5]) || 0,
            WeightChange: parseFloat(cols[8]) || 0,
            IsRemove: cols[0] === '移除',
            IsNew: cols[0] === '新增' || cols[0] === '新增持股'
        };
    }).filter(row => row.Symbol); // 過濾掉空行
}

// 更新摘要卡片
function updateSummary() {
    if (state.rawData.length === 0) {
        els.topBuySymbol.textContent = '--';
        els.topBuyValue.textContent = '--';
        els.topSellSymbol.textContent = '--';
        els.topSellValue.textContent = '--';
        els.totalChanges.textContent = '0';
        return;
    }

    // 找出最大買進 (WeightChange 最大者，且為正)
    let maxBuy = null;
    let maxSell = null;

    state.rawData.forEach(row => {
        if (row.WeightChange > 0) {
            if (!maxBuy || row.WeightChange > maxBuy.WeightChange) maxBuy = row;
        } else if (row.WeightChange < 0 || row.IsRemove) {
            if (!maxSell || row.WeightChange < maxSell.WeightChange) maxSell = row;
        }
    });

    if (maxBuy) {
        els.topBuySymbol.textContent = `${maxBuy.Symbol} ${maxBuy.Name}`;
        els.topBuyValue.textContent = `+${maxBuy.WeightChange}%`;
    } else {
        els.topBuySymbol.textContent = '無';
        els.topBuyValue.textContent = '--';
    }

    if (maxSell) {
        els.topSellSymbol.textContent = `${maxSell.Symbol} ${maxSell.Name}`;
        els.topSellValue.textContent = `${maxSell.WeightChange}%`;
    } else {
        els.topSellSymbol.textContent = '無';
        els.topSellValue.textContent = '--';
    }

    els.totalChanges.textContent = state.rawData.length;
}

// 處理排序點擊
function handleSort(col) {
    if (state.sortCol === col) {
        state.sortAsc = !state.sortAsc; // 切換順序
    } else {
        state.sortCol = col;
        state.sortAsc = false; // 預設降冪(大的在上面)
    }
    
    // 更新 UI Icon
    els.thElements.forEach(th => {
        th.classList.remove('active-sort');
        if (th.dataset.sort === col) {
            th.classList.add('active-sort');
            th.querySelector('.sort-icon').textContent = state.sortAsc ? '↑' : '↓';
        } else {
            th.querySelector('.sort-icon').textContent = '↕';
        }
    });

    renderTable();
}

// 渲染表格
function renderTable() {
    let data = [...state.rawData];

    // 1. 過濾
    if (state.searchQuery) {
        data = data.filter(row => 
            row.Symbol.toLowerCase().includes(state.searchQuery) || 
            row.Name.toLowerCase().includes(state.searchQuery)
        );
    }

    // 2. 排序
    data.sort((a, b) => {
        let valA = a[state.sortCol];
        let valB = b[state.sortCol];
        
        // 處理移除的情況，讓它在排序時不會出錯
        if (state.sortCol === 'WeightChange' || state.sortCol === 'SharesChange') {
            if (valA === undefined || valA === null || isNaN(valA)) valA = -999999999;
            if (valB === undefined || valB === null || isNaN(valB)) valB = -999999999;
        }

        if (valA < valB) return state.sortAsc ? -1 : 1;
        if (valA > valB) return state.sortAsc ? 1 : -1;
        return 0;
    });

    // 3. 渲染
    els.tableBody.innerHTML = data.map(row => {
        // 判斷 Badge 樣式
        let badgeClass = 'neutral-badge';
        if (row.ChangeType.includes('增加') || row.IsNew) badgeClass = 'buy-badge';
        else if (row.ChangeType.includes('減少') || row.IsRemove) badgeClass = 'sell-badge';

        // 數值顏色與格式化
        let shareClass = row.SharesChange > 0 ? 'buy' : (row.SharesChange < 0 ? 'sell' : 'neutral');
        let weightClass = row.WeightChange > 0 ? 'buy' : (row.WeightChange < 0 ? 'sell' : 'neutral');
        
        let shareText = row.SharesChange > 0 ? `+${row.SharesChange.toLocaleString()}` : row.SharesChange.toLocaleString();
        let weightText = row.WeightChange > 0 ? `+${row.WeightChange}%` : `${row.WeightChange}%`;

        if (row.IsRemove) {
            shareClass = 'remove';
            weightClass = 'remove';
            shareText = '已移除';
            weightText = '已移除';
        }

        return `
            <tr>
                <td><span class="badge ${badgeClass}">${row.ChangeType}</span></td>
                <td><strong>${row.Symbol}</strong></td>
                <td>${row.Name}</td>
                <td class="num-col ${shareClass}">${shareText}</td>
                <td class="num-col ${weightClass}">${weightText}</td>
            </tr>
        `;
    }).join('');

    if (data.length === 0) {
        els.tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 30px; color: var(--text-muted);">沒有找到符合的資料</td></tr>`;
    }
}

// 顯示錯誤訊息
function showError(msg) {
    els.tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 30px; color: var(--color-sell);">${msg}</td></tr>`;
}

// 啟動
init();
