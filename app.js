/**
 * 00981a 追蹤神器 - 前端邏輯 v2
 * 功能：每日異動表格 + Bar Chart Race + 日期進度條
 */

// ── 狀態 ─────────────────────────────────────
const state = {
    // 每日異動 Tab
    dates: [],
    currentDate: null,
    rawData: [],
    sortCol: 'WeightChange',
    sortAsc: false,
    searchQuery: '',

    // 成分股佔比動態 Tab
    chartData: null,
    chartDates: [],
    currentChartDateIdx: 0,
    isPlaying: false,
    timer: null,
    chartInstance: null,
    chartReady: false
};

// ── DOM 元素 ──────────────────────────────────
const els = {
    dateSelect:        document.getElementById('date-select'),
    tableBody:         document.getElementById('table-body'),
    loading:           document.getElementById('loading-spinner'),
    searchInput:       document.getElementById('search-input'),
    topBuySymbol:      document.querySelector('#top-buy .symbol'),
    topBuyValue:       document.querySelector('#top-buy .value'),
    topSellSymbol:     document.querySelector('#top-sell .symbol'),
    topSellValue:      document.querySelector('#top-sell .value'),
    totalChanges:      document.querySelector('#total-changes .value'),
    thElements:        document.querySelectorAll('th[data-sort]'),
    tabBtns:           document.querySelectorAll('.tab-btn'),
    tabContents:       document.querySelectorAll('.tab-content'),
    chartContainer:    document.getElementById('chart-container'),
    playBtn:           document.getElementById('play-btn'),
    currentChartDate:  document.getElementById('current-chart-date'),
    timelineSlider:    document.getElementById('timeline-slider'),
    timelineLabelStart:document.getElementById('timeline-label-start'),
    timelineLabelEnd:  document.getElementById('timeline-label-end'),
    prevBtn:           document.getElementById('prev-btn'),
    nextBtn:           document.getElementById('next-btn'),
};

// ═══════════════════════════════════════════════
// 初始化
// ═══════════════════════════════════════════════
async function init() {
    try {
        // 載入日期列表
        const res = await fetch('data/dates.json');
        if (!res.ok) throw new Error('無法載入日期列表');
        state.dates = await res.json();

        if (state.dates.length === 0) { showError('沒有資料。'); return; }

        // 填入下拉選單
        els.dateSelect.innerHTML = state.dates.map(d =>
            `<option value="${d}">${formatDate(d)}</option>`
        ).join('');

        // 事件綁定 —— 每日異動
        els.dateSelect.addEventListener('change', e => loadDataForDate(e.target.value));
        els.searchInput.addEventListener('input', e => {
            state.searchQuery = e.target.value.toLowerCase();
            renderTable();
        });
        els.thElements.forEach(th =>
            th.addEventListener('click', () => handleSort(th.dataset.sort))
        );

        // 事件綁定 —— Tabs
        els.tabBtns.forEach(btn =>
            btn.addEventListener('click', () => switchTab(btn.dataset.target))
        );

        // 事件綁定 —— Chart 控制
        els.playBtn.addEventListener('click', togglePlay);
        els.prevBtn.addEventListener('click', () => stepChart(-1));
        els.nextBtn.addEventListener('click', () => stepChart(+1));

        // 進度條拖曳
        els.timelineSlider.addEventListener('input', () => {
            const idx = parseInt(els.timelineSlider.value, 10);
            if (idx !== state.currentChartDateIdx) {
                state.currentChartDateIdx = idx;
                updateChartData();
                updateSliderFill();
                updateNavBtns();
            }
        });

        // 初始資料載入
        loadDataForDate(state.dates[0]);
        loadChartData();           // 背景預載圖表資料

    } catch (err) {
        console.error(err);
        showError('初始化失敗：' + err.message);
    }
}

// ── 日期格式化 YYYYMMDD → YYYY-MM-DD ─────────
function formatDate(d) {
    if (!d || d.length !== 8) return d;
    return `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
}

// ═══════════════════════════════════════════════
// 每日異動 Tab
// ═══════════════════════════════════════════════
async function loadDataForDate(date) {
    state.currentDate = date;
    els.tableBody.innerHTML = '';
    els.loading.style.display = 'block';
    try {
        const res = await fetch(`data/00981a_composition_change_${date}.csv`);
        if (!res.ok) throw new Error(`找不到 ${date} 的資料`);
        parseCSV(await res.text());
        updateSummary();
        renderTable();
    } catch (err) {
        console.error(err);
        showError('讀取資料失敗：' + err.message);
    } finally {
        els.loading.style.display = 'none';
    }
}

function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) { state.rawData = []; return; }
    state.rawData = lines.slice(1).map(line => {
        const cols = line.split(',');
        return {
            ChangeType:   cols[0] || '',
            Symbol:       cols[1] || '',
            Name:         cols[2] || '',
            SharesChange: parseInt(cols[5]) || 0,
            WeightChange: parseFloat(cols[8]) || 0,
            IsRemove:     cols[0] === '移除',
            IsNew:        cols[0] === '新增' || cols[0] === '新增持股'
        };
    }).filter(r => r.Symbol);
}

function updateSummary() {
    if (!state.rawData.length) {
        ['topBuySymbol','topBuyValue','topSellSymbol','topSellValue'].forEach(k => els[k].textContent = '--');
        els.totalChanges.textContent = '0';
        return;
    }
    let maxBuy = null, maxSell = null;
    state.rawData.forEach(r => {
        if (r.WeightChange > 0 && (!maxBuy || r.WeightChange > maxBuy.WeightChange)) maxBuy = r;
        if ((r.WeightChange < 0 || r.IsRemove) && (!maxSell || r.WeightChange < maxSell.WeightChange)) maxSell = r;
    });
    if (maxBuy) {
        els.topBuySymbol.textContent = `${maxBuy.Symbol} ${maxBuy.Name}`;
        els.topBuyValue.textContent   = `+${maxBuy.WeightChange}%`;
    } else {
        els.topBuySymbol.textContent = '無';
        els.topBuyValue.textContent  = '--';
    }
    if (maxSell) {
        els.topSellSymbol.textContent = `${maxSell.Symbol} ${maxSell.Name}`;
        els.topSellValue.textContent  = `${maxSell.WeightChange}%`;
    } else {
        els.topSellSymbol.textContent = '無';
        els.topSellValue.textContent  = '--';
    }
    els.totalChanges.textContent = state.rawData.length;
}

function handleSort(col) {
    if (state.sortCol === col) { state.sortAsc = !state.sortAsc; }
    else { state.sortCol = col; state.sortAsc = false; }
    els.thElements.forEach(th => {
        th.classList.toggle('active-sort', th.dataset.sort === col);
        const icon = th.querySelector('.sort-icon');
        if (th.dataset.sort === col) icon.textContent = state.sortAsc ? '↑' : '↓';
        else icon.textContent = '↕';
    });
    renderTable();
}

function renderTable() {
    let data = [...state.rawData];
    if (state.searchQuery)
        data = data.filter(r =>
            r.Symbol.toLowerCase().includes(state.searchQuery) ||
            r.Name.toLowerCase().includes(state.searchQuery)
        );

    data.sort((a, b) => {
        let va = a[state.sortCol], vb = b[state.sortCol];
        if (['WeightChange','SharesChange'].includes(state.sortCol)) {
            if (isNaN(va)) va = -1e9;
            if (isNaN(vb)) vb = -1e9;
        }
        if (va < vb) return state.sortAsc ? -1 : 1;
        if (va > vb) return state.sortAsc ?  1 : -1;
        return 0;
    });

    if (!data.length) {
        els.tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-muted)">沒有找到符合的資料</td></tr>`;
        return;
    }

    els.tableBody.innerHTML = data.map(r => {
        let badgeCls = 'neutral-badge';
        if (r.ChangeType.includes('增加') || r.IsNew) badgeCls = 'buy-badge';
        else if (r.ChangeType.includes('減少') || r.IsRemove) badgeCls = 'sell-badge';

        let shareCls  = r.SharesChange > 0 ? 'buy' : r.SharesChange < 0 ? 'sell' : 'neutral';
        let weightCls = r.WeightChange > 0 ? 'buy' : r.WeightChange < 0 ? 'sell' : 'neutral';
        let shareText  = r.SharesChange > 0 ? `+${r.SharesChange.toLocaleString()}` : r.SharesChange.toLocaleString();
        let weightText = r.WeightChange > 0 ? `+${r.WeightChange}%` : `${r.WeightChange}%`;

        if (r.IsRemove) {
            shareCls = weightCls = 'remove';
            shareText = weightText = '已移除';
        }

        return `<tr>
            <td><span class="badge ${badgeCls}">${r.ChangeType}</span></td>
            <td><strong>${r.Symbol}</strong></td>
            <td class="hide-mobile">${r.Name}</td>
            <td class="num-col hide-mobile ${shareCls}">${shareText}</td>
            <td class="num-col ${weightCls}">${weightText}</td>
        </tr>`;
    }).join('');
}

function showError(msg) {
    els.tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--color-sell)">${msg}</td></tr>`;
}

// ═══════════════════════════════════════════════
// Tabs
// ═══════════════════════════════════════════════
function switchTab(targetId) {
    els.tabBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.target === targetId);
        btn.setAttribute('aria-selected', btn.dataset.target === targetId);
    });
    els.tabContents.forEach(c => c.classList.toggle('active', c.id === targetId));

    if (targetId === 'tab-trend') {
        if (state.chartInstance) {
            setTimeout(() => state.chartInstance.resize(), 60);
        } else if (!state.chartReady) {
            loadChartData();
        }
    }
}

// ═══════════════════════════════════════════════
// Chart 資料載入
// ═══════════════════════════════════════════════
async function loadChartData() {
    try {
        const res = await fetch('data/historical_weights.json');
        if (!res.ok) throw new Error('無法載入圖表資料');
        const data = await res.json();
        state.chartData  = data.series;
        state.chartDates = data.dates;   // 由舊到新
        state.currentChartDateIdx = 0;
        state.chartReady = true;
        initChart();
    } catch (err) {
        console.error('圖表載入失敗', err);
    }
}

// ═══════════════════════════════════════════════
// ECharts 初始化
// ═══════════════════════════════════════════════
function initChart() {
    if (!state.chartDates.length) return;

    state.chartInstance = echarts.init(els.chartContainer, 'dark');

    // 為每個股票分配固定顏色（同一支股票永遠同色）
    const colorMap = {};
    const palette = [
        '#00e676','#4fc3f7','#a78bfa','#ff8a65','#ffd54f',
        '#80cbc4','#f48fb1','#ce93d8','#90caf9','#a5d6a7',
        '#ffcc02','#ff7043','#26c6da','#ec407a','#7e57c2',
        '#66bb6a','#42a5f5','#ef5350','#26a69a','#8d6e63'
    ];
    let colorIdx = 0;
    state.chartDates.forEach(date => {
        (state.chartData[date] || []).forEach(item => {
            if (!colorMap[item.symbol]) {
                colorMap[item.symbol] = palette[colorIdx % palette.length];
                colorIdx++;
            }
        });
    });

    const option = {
        backgroundColor: 'transparent',
        grid: { top: 10, bottom: 10, left: 10, right: 80, containLabel: true },
        xAxis: {
            max: 'dataMax',
            axisLabel: {
                color: '#7a82a0',
                formatter: n => n.toFixed(1) + '%'
            },
            splitLine: { lineStyle: { color: 'rgba(255,255,255,0.07)' } }
        },
        yAxis: {
            type: 'category',
            inverse: true,
            max: 19,          // 顯示前 20 名 (index 0~19)
            axisLabel: {
                show: true,
                fontSize: 13,
                color: '#edf0f7',
                width: 120,
                overflow: 'truncate'
            },
            axisLine: { show: false },
            axisTick: { show: false }
        },
        series: [{
            type: 'bar',
            realtimeSort: false,
            data: [],
            itemStyle: {
                color: params => colorMap[params.name?.split(' ')[0]] || palette[0],
                borderRadius: [0, 6, 6, 0]
            },
            label: {
                show: true,
                position: 'right',
                valueAnimation: true,
                color: '#edf0f7',
                fontSize: 13,
                fontFamily: "'Outfit', sans-serif",
                formatter: p => p.value.toFixed(2) + '%'
            },
            barMaxWidth: 28
        }],
        animationDuration: 0,
        animationDurationUpdate: 900,
        animationEasingUpdate: 'cubicInOut'
    };

    state.chartInstance.setOption(option);
    window.addEventListener('resize', () => state.chartInstance.resize());

    // 初始化進度條
    const total = state.chartDates.length - 1;
    els.timelineSlider.max   = total;
    els.timelineSlider.value = 0;
    els.timelineLabelStart.textContent = formatDate(state.chartDates[0]);
    els.timelineLabelEnd.textContent   = formatDate(state.chartDates[total]);
    updateSliderFill();
    updateNavBtns();
    updateChartData();
}

// ─ 更新圖表資料到目前 Index ──────────────────
function updateChartData() {
    if (!state.chartDates.length || !state.chartInstance) return;
    const date    = state.chartDates[state.currentChartDateIdx];
    const dayData = (state.chartData[date] || []).slice();

    dayData.sort((a, b) => b.value - a.value);
    const top20 = dayData.slice(0, 20);

    els.currentChartDate.textContent = formatDate(date);

    state.chartInstance.setOption({
        yAxis: { data: top20.map(i => i.symbol + ' ' + i.name) },
        series: [{ data: top20.map(i => ({ value: i.value, name: i.symbol + ' ' + i.name })) }]
    });
}

// ─ 前後步進 ─────────────────────────────────
function stepChart(delta) {
    const newIdx = state.currentChartDateIdx + delta;
    if (newIdx < 0 || newIdx >= state.chartDates.length) return;
    state.currentChartDateIdx = newIdx;
    els.timelineSlider.value = newIdx;
    updateChartData();
    updateSliderFill();
    updateNavBtns();
}

// ─ 更新進度條填色（CSS custom property）──────
function updateSliderFill() {
    const pct = (state.currentChartDateIdx / (state.chartDates.length - 1)) * 100;
    els.timelineSlider.style.setProperty('--progress', pct.toFixed(1) + '%');
}

// ─ 更新前後鍵的 disabled 狀態 ────────────────
function updateNavBtns() {
    els.prevBtn.disabled = state.currentChartDateIdx === 0;
    els.nextBtn.disabled = state.currentChartDateIdx === state.chartDates.length - 1;
}

// ─ 播放 / 暫停 ───────────────────────────────
function togglePlay() {
    state.isPlaying = !state.isPlaying;
    if (state.isPlaying) {
        els.playBtn.textContent = '⏸ 暫停';
        els.playBtn.classList.add('playing');

        // 若已到最後，從頭播
        if (state.currentChartDateIdx >= state.chartDates.length - 1) {
            state.currentChartDateIdx = 0;
        }

        state.timer = setInterval(() => {
            state.currentChartDateIdx++;
            if (state.currentChartDateIdx >= state.chartDates.length) {
                state.currentChartDateIdx = state.chartDates.length - 1;
                togglePlay(); // 播完自動暫停
                return;
            }
            els.timelineSlider.value = state.currentChartDateIdx;
            updateChartData();
            updateSliderFill();
            updateNavBtns();
        }, 1100);
    } else {
        els.playBtn.textContent = '▶ 播放';
        els.playBtn.classList.remove('playing');
        clearInterval(state.timer);
    }
}

// ── 啟動 ─────────────────────────────────────
init();
