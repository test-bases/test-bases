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
    constructorModal: document.getElementById('constructor-modal-overlay'),
    promptOverlay: document.getElementById('custom-prompt-overlay'),
    promptTitle: document.getElementById('prompt-title'),
    promptInput: document.getElementById('prompt-input'),
    promptCancel: document.getElementById('prompt-cancel'),
    promptConfirm: document.getElementById('prompt-confirm')
};

let currentManualQuestId = null;
let allQuests = [];
let userData = {};

// Конфигуратор строк конструктора
const constructorConfig = {
    twitch_chat: {
        title: "Twitch Чат",
        options: [
            { target: 25, reward: 1, label: "25" },
            { target: 50, reward: 2, label: "50" },
            { target: 100, reward: 4, label: "100" }
        ],
        selectedIdx: 1,
        enabled: false
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
        title: "Персональный",
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
        <div class="cs-modal-card" style="border-color: var(--gold-primary); box-shadow: 0 10px 40px rgba(255,215,0,0.15);">
            <div class="modal-header-line">
                <h3 style="color:var(--gold-primary);">${title}</h3>
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

window.makeApiRequest = async function(url, body = {}, method = 'POST', isSilent = false) {
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
};

// ==========================================
// 3. УПРАВЛЕНИЕ СПОЙЛЕРАМИ (Для Серии)
// ==========================================

window.toggleSpoiler = function(spoilerId) {
    const card = document.getElementById(spoilerId);
    if (!card) return;

    const isCollapsed = card.classList.toggle('collapsed');

    if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.selectionChanged();
    }

    if (!isCollapsed) {
        setTimeout(() => {
            card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 150);
    }
};

// ==========================================
// 4. ДИАЛОГОВОЕ ОКНО КОНСТРУКТОРА
// ==========================================

window.openConstructorModal = function() {
    const modal = document.getElementById('constructor-modal-overlay');
    if (modal) modal.classList.remove('hidden');
    if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.selectionChanged();
    }
};

window.closeConstructorModal = function() {
    const modal = document.getElementById('constructor-modal-overlay');
    if (modal) modal.classList.add('hidden');
};

window.selectChip = function(key, index) {
    const config = constructorConfig[key];
    if (!config) return;

    config.selectedIdx = index;

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

    localStorage.setItem('cs2_weekly_contract', JSON.stringify({
        slots: activeSlots,
        date: new Date().toISOString()
    }));

    if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
    }

    window.closeConstructorModal();
    window.customAlert("Недельный контракт принят к исполнению!", "УСПЕХ");
    if (dom.weeklyLimitCount) dom.weeklyLimitCount.textContent = "1 / 5";

    const summary = document.getElementById('constructor-card-summary');
    if (summary) summary.textContent = `Активно задач: ${activeSlots.length}`;
};

// ==========================================
// 5. МОДАЛКА СЕРИИ И ВКЛАДКИ
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
        dom.claimChallengeBtn.classList.add('disabled');
    }
};

// ==========================================
// 6. СТАРТ И ИНИЦИАЛИЗАЦИЯ
// ==========================================

async function main() {
    updateLoading(25);
    recalcConstructorTotal();
    updateLoading(70);

    try {
        let bootstrapData = window.bootstrapPromise ? await window.bootstrapPromise : await window.makeApiRequest("/api/v1/bootstrap", {}, 'POST', true);
        if (bootstrapData) {
            userData = bootstrapData.user || {};
            allQuests = bootstrapData.quests || [];

            if (bootstrapData.matrix_quest) {
                const tg = bootstrapData.matrix_quest.tg_msg_current || 12;
                const tw = bootstrapData.matrix_quest.twitch_msg_current || 48;
                const tgDig = document.getElementById('matrix-tg-digits');
                const twDig = document.getElementById('matrix-twitch-digits');
                const tgFill = document.getElementById('matrix-tg-fill');
                const twFill = document.getElementById('matrix-twitch-fill');

                if (tgDig) tgDig.textContent = `${tg} / 50`;
                if (twDig) twDig.textContent = `${tw} / 200`;
                if (tgFill) tgFill.style.width = `${Math.min(100, (tg / 50) * 100)}%`;
                if (twFill) twFill.style.width = `${Math.min(100, (tw / 200) * 100)}%`;
            }
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
