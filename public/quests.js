// ==========================================
// 1. ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ И DOM
// ==========================================
const dom = {
    loaderOverlay: document.getElementById('loader-overlay'),
    loadingText: document.getElementById('loading-text'),
    loadingBarFill: document.getElementById('loading-bar-fill'),
    mainContent: document.getElementById('main-content'),
    
    matrixTracker: document.getElementById('matrix-quest-tracker'),
    weeklyLimitCount: document.getElementById('weekly-limit-count'),
    challengeDescText: document.getElementById('challenge-desc-text'),
    challengeProgressFill: document.getElementById('challenge-progress-fill'),
    challengeNumbers: document.getElementById('challenge-numbers'),
    claimChallengeBtn: document.getElementById('claim-challenge-btn'),
    
    constructorTotalReward: document.getElementById('constructor-total-reward'),
    activateContractBtn: document.getElementById('activate-contract-btn'),

    sectionWeekly: document.getElementById('section-weekly-plan'),
    sectionManual: document.getElementById('section-manual-quests'),

    streakModal: document.getElementById('streak-modal-overlay'),
    promptOverlay: document.getElementById('custom-prompt-overlay'),
    promptTitle: document.getElementById('prompt-title'),
    promptInput: document.getElementById('prompt-input'),
    promptCancel: document.getElementById('prompt-cancel'),
    promptConfirm: document.getElementById('prompt-confirm')
};

let currentManualQuestId = null;
let allQuests = [];
let userData = {};

// Состояние конструктора 1в1 как в макете
const constructorConfig = {
    twitch_chat: {
        title: "Twitch Чат",
        options: [
            { target: 25, reward: 1, label: "25" },
            { target: 50, reward: 2, label: "50" },
            { target: 100, reward: 4, label: "100" }
        ],
        selectedIdx: 1,
        enabled: false // по умолчанию ВЫКЛ как в макете
    },
    twitch_uptime: {
        title: "Просмотр стрима",
        options: [
            { target: 30, reward: 1, label: "30 мин." },
            { target: 60, reward: 2, label: "60 мин." },
            { target: 120, reward: 5, label: "120 мин." }
        ],
        selectedIdx: 1,
        enabled: false
    },
    telegram_chat: {
        title: "Telegram Чат",
        options: [
            { target: 15, reward: 1, label: "15" },
            { target: 30, reward: 2, label: "30" },
            { target: 60, reward: 3, label: "60" }
        ],
        selectedIdx: 1,
        enabled: false
    },
    personal_quest: {
        title: "Персональный вызов",
        options: [
            { target: 10, reward: 5, label: "10 кейсов" },
            { target: 50, reward: 6, label: "50 слов" },
            { target: 3, reward: 8, label: "3 друга" }
        ],
        selectedIdx: 1,
        enabled: false
    }
};

// ==========================================
// 2. УТИЛИТЫ И КАСТОМНЫЕ АЛЕРТЫ
// ==========================================

function updateLoading(percent) {
    if (dom.loadingText) dom.loadingText.textContent = Math.floor(percent) + '%';
    if (dom.loadingBarFill) dom.loadingBarFill.style.width = Math.floor(percent) + '%';
}

window.customAlert = function(text, title = 'ВНИМАНИЕ') {
    const old = document.getElementById('custom-cs-alert');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'custom-cs-alert';
    overlay.className = 'cs-modal-backdrop';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    overlay.innerHTML = `
        <div class="cs-modal-card" style="border-color: rgba(255,215,0,0.5);">
            <div class="modal-header-line">
                <h3 style="color:#FFD700;">${title}</h3>
                <button class="modal-close-icon" onclick="this.closest('.cs-modal-backdrop').remove()"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <p class="modal-info-text" style="color:#fff;">${text}</p>
            <button class="cs-gold-btn full-btn" onclick="this.closest('.cs-modal-backdrop').remove()">ОТЛИЧНО</button>
        </div>
    `;
    document.body.appendChild(overlay);

    if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('warning');
    }
};

async function makeApiRequest(url, body = {}, method = 'POST', isSilent = false) {
    if (!isSilent && dom.loaderOverlay) dom.loaderOverlay.classList.remove('hidden');
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);

        const options = { 
            method, 
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal 
        };
        
        if (method !== 'GET') {
            options.body = JSON.stringify({ ...body, initData: window.Telegram?.WebApp?.initData || '' });
        }
        
        const response = await fetch(url, options);
        clearTimeout(timeoutId);

        if (response.status === 429) throw new Error('Cooldown active'); 
        if (response.status === 204) return null;
        
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || result.message || 'Ошибка сервера');
        return result;
    } catch (e) {
        if (e.message !== 'Cooldown active' && !isSilent) {
            window.customAlert(e.message, 'ОШИБКА');
        }
        throw e;
    } finally {
        if (!isSilent && dom.loaderOverlay) dom.loaderOverlay.classList.add('hidden');
    }
}

// ==========================================
// 3. РЕНДЕРИНГ МАТРИЦЫ 1В1
// ==========================================

function renderMatrixBar(matrixData) {
    if (!dom.matrixTracker) return;

    const tgDone = matrixData?.tg_msg_current || 12;
    const twitchDone = matrixData?.twitch_msg_current || 48;

    const tgPercent = Math.min(100, Math.round((tgDone / 50) * 100));
    const twitchPercent = Math.min(100, Math.round((twitchDone / 200) * 100));

    dom.matrixTracker.innerHTML = `
        <div class="matrix-brand">
            <div class="matrix-icon-poly"><i class="fa-solid fa-shapes"></i></div>
            <div class="matrix-brand-text">
                <span class="matrix-name">МАТРИЦА <i class="fa-regular fa-circle-question" style="font-size:8px; opacity:0.6;"></i></span>
                <span class="matrix-sub">Проверка доверием</span>
            </div>
        </div>
        <div class="matrix-stat-group">
            <div class="matrix-stat-item">
                <i class="fa-brands fa-telegram"></i>
                <div class="matrix-stat-data">
                    <span class="matrix-stat-label">Telegram</span>
                    <div class="matrix-mini-track"><div class="matrix-mini-fill" style="width: ${tgPercent}%;"></div></div>
                </div>
                <span class="matrix-stat-digits">${tgDone} / 50</span>
            </div>
            <div class="matrix-stat-item">
                <i class="fa-brands fa-twitch"></i>
                <div class="matrix-stat-data">
                    <span class="matrix-stat-label">Twitch</span>
                    <div class="matrix-mini-track"><div class="matrix-mini-fill" style="width: ${twitchPercent}%;"></div></div>
                </div>
                <span class="matrix-stat-digits">${twitchDone} / 200</span>
            </div>
        </div>
    `;
}

// ==========================================
// 4. ЛОГИКА КОНСТРУКТОРА (ЧИПСЫ, СВИТЧИ, СУММА)
// ==========================================

window.selectChip = function(key, index) {
    const config = constructorConfig[key];
    if (!config) return;

    config.selectedIdx = index;

    // Обновляем визуальный класс active
    const rowEl = document.getElementById(`row-${key.replace('_', '-')}`);
    if (rowEl) {
        const chips = rowEl.querySelectorAll('.target-chip');
        chips.forEach((c, idx) => c.classList.toggle('active', idx === index));
    }

    if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.selectionChanged();
    }

    recalcConstructorTotal();
};

window.toggleConstructorRow = function(key, isEnabled) {
    const config = constructorConfig[key];
    if (!config) return;

    config.enabled = isEnabled;

    const rowEl = document.getElementById(`row-${key.replace('_', '-')}`);
    const statusText = document.getElementById(`status-${key.replace('_', '-')}`);

    if (rowEl) rowEl.classList.toggle('row-disabled', !isEnabled);
    if (statusText) statusText.textContent = isEnabled ? 'ВКЛ' : 'ВЫКЛ';

    if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.selectionChanged();
    }

    recalcConstructorTotal();
};

function recalcConstructorTotal() {
    let total = 0;
    let anyEnabled = false;

    Object.values(constructorConfig).forEach(slot => {
        if (slot.enabled) {
            anyEnabled = true;
            total += slot.options[slot.selectedIdx].reward;
        }
    });

    if (dom.constructorTotalReward) {
        dom.constructorTotalReward.textContent = String(total);
    }

    if (dom.activateContractBtn) {
        dom.activateContractBtn.classList.toggle('disabled', !anyEnabled);
        dom.activateContractBtn.classList.toggle('active', anyEnabled);
    }
}

window.submitConstructorContract = async function() {
    let activeSlots = [];
    Object.entries(constructorConfig).forEach(([key, slot]) => {
        if (slot.enabled) {
            activeSlots.push({
                type: key,
                title: slot.title,
                target: slot.options[slot.selectedIdx].target,
                reward: slot.options[slot.selectedIdx].reward
            });
        }
    });

    if (activeSlots.length === 0) {
        window.customAlert("Включите хотя бы одну активность тумблером!");
        return;
    }

    // Сохраняем в кэш активный контракт
    localStorage.setItem('cs2_weekly_contract', JSON.stringify({
        slots: activeSlots,
        date: new Date().toISOString()
    }));

    if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
    }

    window.customAlert("Недельный контракт принят к исполнению!", "УСПЕХ");
    if (dom.weeklyLimitCount) dom.weeklyLimitCount.textContent = "1 / 5";
};

// ==========================================
// 5. МОДАЛКА СЕРИИ И НАВИГАЦИЯ
// ==========================================

window.openStreakModal = function() {
    if (dom.streakModal) dom.streakModal.classList.remove('hidden');
    if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.selectionChanged();
    }
};

window.closeStreakModal = function() {
    if (dom.streakModal) dom.streakModal.classList.add('hidden');
};

window.switchMainTab = function(tab) {
    const isWeekly = tab === 'weekly';
    document.getElementById('tab-btn-weekly')?.classList.toggle('active', isWeekly);
    document.getElementById('tab-btn-manual')?.classList.toggle('active', !isWeekly);

    dom.sectionWeekly?.classList.toggle('hidden', !isWeekly);
    dom.sectionManual?.classList.toggle('hidden', isWeekly);

    if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.selectionChanged();
    }
};

window.claimActiveStreamChallenge = function() {
    window.customAlert("Награда +2 билета зачислена на баланс!", "ЧЕЛЛЕНДЖ ЗАВЕРШЕН");
    if (dom.claimChallengeBtn) {
        dom.claimChallengeBtn.textContent = "ГОТОВО";
        dom.claimChallengeBtn.disabled = true;
    }
};

// ==========================================
// 6. СТАРТ И ИНИЦИАЛИЗАЦИЯ
// ==========================================

async function main() {
    updateLoading(20);
    
    // Начальное состояние матрицы 1в1
    renderMatrixBar({ tg_msg_current: 12, twitch_msg_current: 48 });

    // Все слоты по умолчанию выключены, как в макете
    Object.keys(constructorConfig).forEach(k => {
        const row = document.getElementById(`row-${k.replace('_', '-')}`);
        if (row) row.classList.add('row-disabled');
    });
    recalcConstructorTotal();

    updateLoading(60);

    try {
        let bootstrapData = window.bootstrapPromise ? await window.bootstrapPromise : await makeApiRequest("/api/v1/bootstrap", {}, 'POST', true);
        if (bootstrapData) {
            userData = bootstrapData.user || {};
            allQuests = bootstrapData.quests || [];
            if (bootstrapData.matrix_quest) renderMatrixBar(bootstrapData.matrix_quest);
        }
    } catch (e) {}

    updateLoading(100);
    if (dom.loaderOverlay) dom.loaderOverlay.classList.add('hidden');
    dom.mainContent.style.opacity = 1;
}

try {
    if (window.Telegram?.WebApp) {
        Telegram.WebApp.ready();
        Telegram.WebApp.expand();
    }
    main();
} catch (e) {
    if (dom.loaderOverlay) dom.loaderOverlay.classList.add('hidden');
}
