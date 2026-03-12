/**
 * Dashboard Exploratório - Lógica de Renderização e Filtros
 */

let rawData = null;
let evolucaoChart, classesChart, assuntosChart, especializadasChart;
let currentEspecializada = 'Todas';

// Cores globais do Design System
const originalColorsDoughnut = [
    '#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b',
    '#ef4444', '#14b8a6', '#6366f1', '#84cc16', '#a855f7', '#f43f5e',
    '#06b6d4' // Nova cor (Cyan) para evitar repetição entre PA e CPRAC
];
let gridColor = 'rgba(255, 255, 255, 0.05)';

// Configurações Globais do Chart.js
function updateChartDefaults() {
    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#FFFFFF' : '#000000'; // Pure white or pure black for maximum contrast
    const tooltipBg = isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.9)';
    const tooltipColor = isDark ? '#FFFFFF' : '#000000';

    Chart.defaults.color = textColor;
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.plugins.tooltip.backgroundColor = tooltipBg;
    Chart.defaults.plugins.tooltip.titleColor = tooltipColor;
    Chart.defaults.plugins.tooltip.bodyColor = tooltipColor;
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.plugins.tooltip.borderColor = 'rgba(0,0,0,0.1)';
    Chart.defaults.plugins.tooltip.borderWidth = 1;

    // Atualizar cores de grade e eixos (ticks), e redesenhar TODOS os gráficos
    gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.05)';
    [evolucaoChart, classesChart, assuntosChart, especializadasChart].forEach(chart => {
        if (!chart) return;
        
        if (chart.options.scales) {
            Object.values(chart.options.scales).forEach(scale => {
                if (scale.grid) scale.grid.color = gridColor;
                if (scale.ticks) scale.ticks.color = textColor; // Garante que labels dos eixos mudem de cor
            });
        }
        chart.update(); // Sempre atualizar para refletir mudanças globais e de plugins
    });
}

/**
 * Inicializa o Dashboard carregando os dados externos
 */
async function initDashboard() {
    setupTheme(); // Configurar tema ANTES de qualquer coisa para evitar flicker e garantir elementos
    
    try {
        const response = await fetch('data.json');
        rawData = await response.json();
        
        setupYearsSlider();
        initCharts();
        populateSidebar();
        updateDashboard('Todas');
        
        // Event Listeners
        document.getElementById('year-start').addEventListener('input', handleYearSlider);
        document.getElementById('year-end').addEventListener('input', handleYearSlider);
        document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
        
    } catch (error) {
        console.error("Erro ao carregar dados do dashboard:", error);
        document.body.innerHTML += `<div class="fixed inset-0 flex items-center justify-center bg-black/80 z-50 text-red-500 font-bold p-10 text-center">Erro crítico ao carregar dados (data.json). Verifique o console.</div>`;
    }
}

/**
 * Lógica de Troca de Tema
 */
function setupTheme() {
    const themeToggleDarkIcon = document.getElementById('theme-toggle-dark-icon');
    const themeToggleLightIcon = document.getElementById('theme-toggle-light-icon');

    // Mudar os ícones com base no estado atual
    if (localStorage.getItem('color-theme') === 'dark' || (!('color-theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        // Se desejar que o padrão seja noturno mesmo sem nada salvo, mude esta lógica.
        // O usuário pediu Diurno como padrão.
    }

    // Como o padrão deve ser diurno, só aplicamos dark se houver preferência explícita
    if (localStorage.getItem('color-theme') === 'dark') {
        document.documentElement.classList.add('dark');
        themeToggleLightIcon.classList.remove('hidden');
    } else {
        document.documentElement.classList.remove('dark');
        themeToggleDarkIcon.classList.remove('hidden');
    }
    updateChartDefaults();
}

function toggleTheme() {
    const themeToggleDarkIcon = document.getElementById('theme-toggle-dark-icon');
    const themeToggleLightIcon = document.getElementById('theme-toggle-light-icon');

    themeToggleDarkIcon.classList.toggle('hidden');
    themeToggleLightIcon.classList.toggle('hidden');

    if (document.documentElement.classList.contains('dark')) {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('color-theme', 'light');
    } else {
        document.documentElement.classList.add('dark');
        localStorage.setItem('color-theme', 'dark');
    }
    updateChartDefaults();
}

/**
 * Configura os limites do slider de anos com base nos dados reais
 */
function setupYearsSlider() {
    const years = Object.keys(rawData.global_by_year).map(Number).sort((a, b) => a - b);
    const minYear = years[0];
    const maxYear = years[years.length - 1];

    const startEl = document.getElementById('year-start');
    const endEl = document.getElementById('year-end');

    [startEl, endEl].forEach(el => {
        el.min = minYear;
        el.max = maxYear;
    });

    startEl.value = minYear;
    endEl.value = maxYear;

    updateSliderUI();
}

/**
 * Popula a sidebar com as especializadas encontradas nos dados
 */
function populateSidebar() {
    const sidebarLista = document.getElementById('sidebar-especializadas');
    const clsActive = 'active w-full text-left px-4 py-3 rounded-lg bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-white border border-purple-500/50 transition-all text-sm font-semibold shadow-[0_0_15px_rgba(168,85,247,0.2)]';
    const clsInactive = 'w-full text-left px-4 py-3 rounded-lg text-white/60 hover:bg-white/5 hover:text-white transition-all text-sm font-medium border border-transparent';

    sidebarLista.innerHTML = ''; // Limpar antes

    const createBtn = (label, isActive = false) => {
        const btn = document.createElement('button');
        btn.className = isActive ? clsActive : clsInactive;
        btn.innerHTML = `<span>${label}</span>`;
        btn.onclick = () => {
            Array.from(sidebarLista.children).forEach(b => b.className = clsInactive);
            btn.className = clsActive;
            updateDashboard(label);
        };
        return btn;
    };

    sidebarLista.appendChild(createBtn('Todas', true));
    
    Object.keys(rawData.especializadas_totals).sort().forEach(esp => {
        sidebarLista.appendChild(createBtn(esp));
    });
}

/**
 * Inicializa as instâncias dos gráficos do Chart.js
 */
function initCharts() {
    // 1. Evolução Temporal (Line)
    const ctxEvolucao = document.getElementById('chartEvolucao').getContext('2d');
    const gradientLine = ctxEvolucao.createLinearGradient(0, 0, 0, 400);
    gradientLine.addColorStop(0, 'rgba(168, 85, 247, 0.5)');
    gradientLine.addColorStop(1, 'rgba(168, 85, 247, 0.0)');

    evolucaoChart = new Chart(ctxEvolucao, {
        type: 'line',
        data: { labels: [], datasets: [{ label: 'Processos', data: [], borderColor: '#a855f7', backgroundColor: gradientLine, borderWidth: 2, pointRadius: 4, fill: true, tension: 0.4 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { x: { grid: { color: gridColor } }, y: { grid: { color: gridColor }, beginAtZero: true } }, plugins: { legend: { display: false } } }
    });

    // Plugin para labels nas barras
    const barLabelsPlugin = {
        id: 'barLabels',
        afterDatasetsDraw(chart) {
            const { ctx } = chart;
            const isDark = document.documentElement.classList.contains('dark');
            const labelColor = isDark ? '#FFFFFF' : '#000000'; // Branco no noturno, Preto no diurno
            
            chart.data.datasets.forEach((dataset, i) => {
                const meta = chart.getDatasetMeta(i);
                meta.data.forEach((element, index) => {
                    const val = dataset._raw[index];
                    if (val) {
                        ctx.save();
                        ctx.fillStyle = labelColor;
                        ctx.font = "bold 11px 'Inter', sans-serif";
                        ctx.textAlign = 'left';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(val.toLocaleString('pt-BR'), element.tooltipPosition().x + 6, element.tooltipPosition().y);
                        ctx.restore();
                    }
                });
            });
        }
    };

    // 2. Classes (Horizontal Bar)
    classesChart = createBarChart('chartClasses', 'rgba(59, 130, 246, 0.8)', barLabelsPlugin);
    
    // 3. Assuntos (Horizontal Bar)
    assuntosChart = createBarChart('chartAssuntos', 'rgba(236, 72, 153, 0.8)', barLabelsPlugin);

    // 4. Especializadas (Doughnut)
    especializadasChart = new Chart(document.getElementById('chartEspecializadas'), {
        type: 'doughnut',
        data: { 
            labels: Object.keys(rawData.especializadas_totals), 
            datasets: [{ 
                data: Object.values(rawData.especializadas_totals), 
                backgroundColor: originalColorsDoughnut, 
                borderWidth: 0 
            }] 
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            cutout: '50%', // Preenche mais a circunferência reduzindo o buraco central
            plugins: { 
                legend: { position: 'right', labels: { padding: 20, usePointStyle: true } },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1) + '%';
                            return `${label}: ${percentage} (${value.toLocaleString('pt-BR')})`;
                        }
                    }
                }
            } 
        }
    });
}

function createBarChart(canvasId, color, plugin) {
    return new Chart(document.getElementById(canvasId), {
        type: 'bar',
        data: { labels: [], datasets: [{ 
            data: [], 
            _raw: [], 
            backgroundColor: color, 
            borderRadius: 6,
            barPercentage: 0.8,      // Aumenta a espessura da barra no slot disponível
            categoryPercentage: 0.9  // Reduz o espaço entre as categorias
        }] },
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false, 
            layout: { padding: { right: 80, top: 10, bottom: 10 } },
            scales: { 
                x: { grid: { color: gridColor }, max: 100 }, 
                y: { grid: { display: false }, ticks: { padding: 10 } } 
            },
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => `${ctx.raw.toFixed(2)}% (${ctx.dataset._raw[ctx.dataIndex].toLocaleString('pt-BR')})` } } }
        },
        plugins: [plugin]
    });
}

/**
 * Atualiza os gráficos e KPIs com base nos filtros selecionados
 */
function updateDashboard(esp) {
    currentEspecializada = esp;
    let start = parseInt(document.getElementById('year-start').value);
    let end = parseInt(document.getElementById('year-end').value);

    // Ordenar start/end caso o usuário inverta os sliders
    if (start > end) [start, end] = [end, start];

    let validYears = [];
    for (let y = start; y <= end; y++) validYears.push(y.toString());

    let dataTotal = 0;
    let aggregatedClasses = {};
    let aggregatedAssuntos = {};
    let dataAnosObj = {};

    let allTimeTotal = Object.values(rawData.especializadas_totals).reduce((a, b) => a + b, 0);
    let totalOfEspAllTime = esp === 'Todas' ? allTimeTotal : (rawData.especializadas_totals[esp] || 0);

    validYears.forEach(y => {
        let yData = esp === 'Todas' ? rawData.global_by_year[y] : (rawData.esp_by_year[esp] && rawData.esp_by_year[esp][y] ? rawData.esp_by_year[esp][y] : null);
        dataAnosObj[y] = yData ? yData.total : 0;
        if (yData) {
            dataTotal += yData.total;
            Object.entries(yData.classes).forEach(([c, v]) => aggregatedClasses[c] = (aggregatedClasses[c] || 0) + v);
            Object.entries(yData.assuntos).forEach(([a, v]) => aggregatedAssuntos[a] = (aggregatedAssuntos[a] || 0) + v);
        }
    });

    const dataClassesRes = getTop10Percent(aggregatedClasses);
    const dataAssuntosRes = getTop10Percent(aggregatedAssuntos);
    const dataAnos = validYears.map(y => dataAnosObj[y] || 0);

    // Atualizar UI (KPIs)
    document.getElementById('kpi-total').innerText = dataTotal.toLocaleString('pt-BR');
    
    if (esp === 'Todas') {
        const topEsp = Object.entries(rawData.especializadas_totals).sort((a, b) => b[1] - a[1])[0];
        document.getElementById('kpi-title-2').innerText = "Especializada Líder";
        document.getElementById('kpi-lider').innerHTML = `${topEsp[0]} <span class="text-sm font-normal text-white/50">(${(topEsp[1]/allTimeTotal*100).toFixed(0)}%)</span>`;
        especializadasChart.data.datasets[0].backgroundColor = originalColorsDoughnut;
    } else {
        document.getElementById('kpi-title-2').innerText = "Participação Histórica";
        document.getElementById('kpi-lider').innerHTML = `${(totalOfEspAllTime / allTimeTotal * 100).toFixed(1)}% <span class="text-sm font-normal text-white/50">do total</span>`;
        const espIdx = Object.keys(rawData.especializadas_totals).indexOf(esp);
        especializadasChart.data.datasets[0].backgroundColor = originalColorsDoughnut.map((c, i) => i === espIdx ? c : hexToRgba(c, 0.15));
    }

    let maxVal = Math.max(...dataAnos, 0);
    let picoAno = maxVal > 0 ? validYears[dataAnos.indexOf(maxVal)] : "N/A";
    document.getElementById('kpi-pico').innerHTML = `${picoAno} <span class="text-sm font-normal text-white/50">(${maxVal >= 1000 ? Math.round(maxVal / 1000) + 'k' : maxVal})</span>`;
    document.getElementById('kpi-classe').innerText = dataClassesRes._labels[0] || "N/A";

    // Atualizar Gráficos
    evolucaoChart.data.labels = validYears;
    evolucaoChart.data.datasets[0].data = dataAnos;
    evolucaoChart.update();

    updateBarChart(classesChart, dataClassesRes, [59, 130, 246]);
    updateBarChart(assuntosChart, dataAssuntosRes, [236, 72, 153]);
    especializadasChart.update();
}

function updateBarChart(chart, res, rgb) {
    chart.data.labels = res._labels;
    chart.data.datasets[0].data = res._data;
    chart.data.datasets[0]._raw = res._raw;
    chart.data.datasets[0].backgroundColor = generateColors(res._data, ...rgb);
    chart.update();
}

/**
 * Utilitários
 */
function getTop10Percent(countsObj) {
    let entries = Object.entries(countsObj).sort((a, b) => b[1] - a[1]).slice(0, 10);
    let total = Object.values(countsObj).reduce((s, v) => s + v, 0);
    if (total === 0) return { _labels: [], _data: [], _raw: [] };
    return {
        _labels: entries.map(x => x[0]),
        _data: entries.map(x => (x[1] / total) * 100),
        _raw: entries.map(x => x[1])
    };
}

function generateColors(dataArray, r, g, b) {
    let max = Math.max(...dataArray, 1);
    return dataArray.map(v => `rgba(${r}, ${g}, ${b}, ${0.3 + 0.7 * (v / max)})`);
}

function hexToRgba(hex, alpha) {
    let r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function updateSliderUI() {
    const start = parseInt(document.getElementById('year-start').value);
    const end = parseInt(document.getElementById('year-end').value);
    const min = parseInt(document.getElementById('year-start').min);
    const max = parseInt(document.getElementById('year-start').max);

    const [s, e] = start < end ? [start, end] : [end, start];
    document.getElementById('year-val').innerText = s === e ? s : `${s} - ${e}`;
    
    const left = ((s - min) / (max - min)) * 100;
    const right = 100 - ((e - min) / (max - min)) * 100;
    document.getElementById('slider-progress').style.left = left + "%";
    document.getElementById('slider-progress').style.right = right + "%";
}

function handleYearSlider(e) {
    updateSliderUI();
    updateDashboard(currentEspecializada);
}

// Iniciar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', initDashboard);
