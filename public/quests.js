// ==========================================
// 1. ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ И DOM
// ==========================================
const dom = {
    loaderOverlay: document.getElementById('loader-overlay'),
    loadingText: document.getElementById('loading-text'),
    loadingBarFill: document.getElementById('loading-bar-fill'),
    mainContent: document.getElementById('main-content'),

    constructorTotalReward: document.getElementById('constructor-total-reward'),
    activateContractBtn: document.getElementById('activate-contract-btn'),

    sectionWeekly: document.getElementById('section-weekly-plan'),
    sectionManual: document.getElementById('section-manual-quests'),
};

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
        <div class="cs-modal-card" style="text-align: center;">
            <h3 style="color:var(--gold-primary); margin-top: 0; font-size: 18px;">${title}</h3>
            <p style="color:#A1A1AA; font-size: 14px; margin-bottom: 20px;">${text}</p>
            <button class="cs-gold-btn full-btn" onclick="this.closest('.cs-modal-backdrop').remove()">ОТЛИЧНО</button>
        </div>
    `;
    document.body.appendChild(overlay);

    if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('warning');
    }
};

// ==========================================
// 3. УПРАВЛЕНИЕ МОДАЛКАМИ И ТАБАМИ
// ==========================================
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
    window.customAlert("Награда +2 билета зачислена на ваш баланс!", "ЧЕЛЛЕНДЖ ЗАВЕРШЕН");
    const btn = document.getElementById('claim-challenge-btn');
    if (btn) {
        btn.textContent = "ЗАБРАНО";
        btn.style.opacity = "0.5";
        btn.style.pointerEvents = "none";
    }
};

window.openConstructorModal = function() {
    document.getElementById('constructor-modal-overlay')?.classList.remove('hidden');
    if (window.Telegram?.WebApp?.HapticFeedback) Telegram.WebApp.HapticFeedback.selectionChanged();
};

window.closeConstructorModal = function() {
    document.getElementById('constructor-modal-overlay')?.classList.add('hidden');
};

window.openStreakModal = function() {
    document.getElementById('streak-modal-overlay')?.classList.remove('hidden');
    if (window.Telegram?.WebApp?.HapticFeedback) Telegram.WebApp.HapticFeedback.selectionChanged();
};
window.closeStreakModal = function() {
    document.getElementById('streak-modal-overlay')?.classList.add('hidden');
};

// ==========================================
// 4. ЛОГИКА КОНСТРУКТОРА В МОДАЛКЕ
// ==========================================
window.selectChip = function(key, index) {
    const config = constructorConfig[key];
    if (!config) return;

    config.selectedIdx = index;
    const rowEl = document.getElementById(`row-${key.replace('_', '-')}`);
    
    if (rowEl) {
        const chips = rowEl.querySelectorAll('.target-chip');
        chips.forEach((c, idx) => c.classList.toggle('active', idx === index));
    }

    if (window.Telegram?.WebApp?.HapticFeedback) Telegram.WebApp.HapticFeedback.selectionChanged();
    recalcConstructorTotal();
};

window.toggleConstructorRow = function(key, isEnabled) {
    const config = constructorConfig[key];
    if (!config) return;

    config.enabled = isEnabled;
    const rowEl = document.getElementById(`row-${key.replace('_', '-')}`);
    const statusText = document.getElementById(`status-${key.replace('_', '-')}`);

    if (rowEl) rowEl.classList.toggle('row-disabled', !isEnabled);
    if (statusText) {
        statusText.textContent = isEnabled ? 'ВКЛ' : 'ВЫКЛ';
        statusText.style.color = isEnabled ? 'var(--gold-primary)' : 'var(--text-dim)';
    }

    if (window.Telegram?.WebApp?.HapticFeedback) Telegram.WebApp.HapticFeedback.selectionChanged();
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
    }
}

window.submitConstructorContract = function() {
    let activeSlots = [];
    Object.entries(constructorConfig).forEach(([key, slot]) => {
        if (slot.enabled) activeSlots.push(slot);
    });

    if (activeSlots.length === 0) {
        window.customAlert("Включите тумблером хотя бы одну активность для контракта!");
        return;
    }

    window.closeConstructorModal();
    window.customAlert("Сложный недельный контракт успешно принят к исполнению!", "КОНТРАКТ АКТИВИРОВАН");
    
    const countEl = document.getElementById('weekly-limit-count');
    if (countEl) countEl.innerHTML = `<span style="color:var(--gold-primary)">1</span> / 5`;
};

// ==========================================
// 5. ИНИЦИАЛИЗАЦИЯ
// ==========================================
async function main() {
    updateLoading(40);
    recalcConstructorTotal();
    
    setTimeout(() => {
        updateLoading(100);
        if (dom.loaderOverlay) dom.loaderOverlay.classList.add('hidden');
        dom.mainContent.style.opacity = 1;
    }, 400); // Имитация загрузки для плавности
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
