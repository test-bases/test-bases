// ==========================================
// 1. ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ И DOM
// ==========================================
const dom = {
    loaderOverlay: document.getElementById('loader-overlay'),
    loadingText: document.getElementById('loading-text'),
    loadingBarFill: document.getElementById('loading-bar-fill'),
    mainContent: document.getElementById('main-content'),
    
    challengeContainer: document.getElementById('challenge-container'),
    activeContractDashboard: document.getElementById('active-contract-dashboard'),
    activeContractTasksList: document.getElementById('active-contract-tasks-list'),
    questBuilderCard: document.getElementById('quest-builder-card'),

    // Разделы
    sectionAuto: document.getElementById('section-auto-quests'),
    sectionManual: document.getElementById('section-manual-quests'),

    // Модальные окна
    streakModal: document.getElementById('streak-modal-overlay'),
    promptOverlay: document.getElementById('custom-prompt-overlay'),
    promptTitle: document.getElementById('prompt-title'),
    promptInput: document.getElementById('prompt-input'),
    promptCancel: document.getElementById('prompt-cancel'),
    promptConfirm: document.getElementById('prompt-confirm'),
    
    scheduleModal: document.getElementById('schedule-modal-overlay'),
    scheduleCloseBtn: document.getElementById('schedule-modal-close-btn')
};

let currentQuestId = null;
let allQuests = [];
let userData = {};

// Состояние недели и лимитов (5 на неделю)
let weeklyLimit = {
    used: 1,
    max: 5
};

// Пресеты значений и наград для слотов
const slotPresets = {
    twitch_chat: [
        { target: 25, unit: 'сообщ.', reward: 1 },
        { target: 50, unit: 'сообщ.', reward: 2 },
        { target: 100, unit: 'сообщ.', reward: 4 }
    ],
    twitch_uptime: [
        { target: 30, unit: 'мин.', reward: 1 },
        { target: 60, unit: 'мин.', reward: 3 },
        { target: 120, unit: 'мин.', reward: 5 }
    ],
    telegram_chat: [
        { target: 15, unit: 'сообщ.', reward: 1 },
        { target: 30, unit: 'сообщ.', reward: 2 },
        { target: 60, unit: 'сообщ.', reward: 3 }
    ],
    personal_quest: [
        { title: "Открыть 10 кейсов", target: 10, unit: 'шт.', reward: 5 },
        { title: "Отгадать 50 слов", target: 50, unit: 'слов', reward: 6 },
        { title: "Пригласить 3 друзей", target: 3, unit: 'чел.', reward: 8 }
    ]
};

// Текущее состояние выбора в конструкторе
let builderState = {
    twitch_chat: { enabled: true, index: 1 },
    twitch_uptime: { enabled: true, index: 1 },
    telegram_chat: { enabled: true, index: 0 },
    personal_quest: { enabled: true, index: 0 }
};

// ==========================================
// 2. УТИЛИТЫ И КАСТОМНЫЕ АЛЕРТЫ
// ==========================================

function escapeHTML(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/[&<>"']/g, match => ({'&': '&amp;','<': '&lt;','>': '&gt;','"': '&quot;',"'": '&#39;'})[match]);
}

function updateLoading(percent) {
    if (dom.loadingText) dom.loadingText.textContent = Math.floor(percent) + '%';
    if (dom.loadingBarFill) dom.loadingBarFill.style.width = Math.floor(percent) + '%';
}

function formatErrorMessage(msg) {
    if (!msg || typeof msg !== 'string') return "Произошла непредвиденная ошибка";
    const lower = msg.toLowerCase();
    if (lower.includes('streak expired') || lower.includes('streak lost') || lower.includes('сгорел')) {
        return "Ваша серия сгорела! Вы пропустили день, серия сброшена на День 1.";
    }
    if (lower.includes('already claimed') || lower.includes('cooldown')) {
        return "Награда уже собрана! Дождитесь окончания кулдауна.";
    }
    return msg;
}

window.customAlert = function(text, title = 'Внимание', type = 'warning') {
    const oldAlert = document.getElementById('custom-app-alert');
    if (oldAlert) oldAlert.remove();

    const translatedText = formatErrorMessage(text);
    let iconClass = type === 'error' ? 'fa-solid fa-circle-exclamation' : 'fa-solid fa-triangle-exclamation';

    const overlay = document.createElement('div');
    overlay.id = 'custom-app-alert';
    overlay.className = 'modal-overlay visible';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    overlay.innerHTML = `
        <div class="bottom-sheet" style="box-shadow: none; max-width: 310px; padding: 18px 16px; text-align: left;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <div style="display: flex; align-items: center; gap: 7px;">
                    <i class="${iconClass}" style="color: #fff; font-size: 13px;"></i>
                    <h3 style="margin: 0; font-size: 12px; font-weight: 900; color: #fff; text-transform: uppercase;">${title}</h3>
                </div>
                <button class="tour-close-btn" onclick="this.closest('.modal-overlay').remove()"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div style="font-size: 11px; color: #b0b0b8; line-height: 1.4; font-weight: 500; margin-bottom: 16px;">
                ${translatedText}
            </div>
            <button class="compact-action-btn" style="width:100%;" onclick="this.closest('.modal-overlay').remove()">ПОНЯТНО</button>
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
            window.customAlert(e.message, 'Ошибка', 'error');
        }
        throw e;
    } finally {
        if (!isSilent && dom.loaderOverlay) dom.loaderOverlay.classList.add('hidden');
    }
}

// ==========================================
// 3. 🎛️ ЛОГИКА КОНСТРУКТОРА ВЫБОРА
// ==========================================

function initBuilderUI() {
    // Проверяем, есть ли активный контракт в памяти
    const activeContract = localStorage.getItem('user_weekly_contract');
    if (activeContract) {
        renderActiveContract(JSON.parse(activeContract));
        return;
    }

    if (dom.questBuilderCard) dom.questBuilderCard.classList.remove('hidden');
    if (dom.activeContractDashboard) dom.activeContractDashboard.classList.add('hidden');

    // Обновляем слоты
    ['twitch_chat', 'twitch_uptime', 'telegram_chat'].forEach(key => {
        updateSlotUI(key, builderState[key].index);
    });

    updatePersonalQuestUI(builderState.personal_quest.index);
    recalcTotalReward();
    updateWeeklyLimitBadge();
}

function updateWeeklyLimitBadge() {
    const badge = document.getElementById('weekly-limit-badge');
    if (badge) {
        badge.textContent = `Лимит: ${weeklyLimit.used} / ${weeklyLimit.max}`;
    }
}

// Включение/выключение тумблера активности
window.toggleSlot = function(key, isChecked) {
    builderState[key].enabled = isChecked;
    const card = document.getElementById(`slot-card-${key.replace('_', '-')}`);
    if (card) {
        card.classList.toggle('disabled-slot', !isChecked);
    }
    
    // Блокируем контролы внутри
    const controls = document.getElementById(`controls-${key.replace('_', '-')}`);
    if (controls) {
        controls.querySelectorAll('input, button, .preset-pill').forEach(el => {
            el.style.pointerEvents = isChecked ? 'auto' : 'none';
        });
    }

    if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.selectionChanged();
    }
    recalcTotalReward();
};

// Степпер [-] [+]
window.stepSlot = function(key, delta) {
    const maxIdx = slotPresets[key].length - 1;
    let newIdx = builderState[key].index + delta;
    if (newIdx < 0) newIdx = 0;
    if (newIdx > maxIdx) newIdx = maxIdx;

    builderState[key].index = newIdx;
    updateSlotUI(key, newIdx);

    if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.selectionChanged();
    }
    recalcTotalReward();
};

// Слайдер input
window.onSlotSliderInput = function(key, val) {
    const idx = parseInt(val, 10);
    builderState[key].index = idx;
    updateSlotUI(key, idx);

    if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.selectionChanged();
    }
    recalcTotalReward();
};

// Быстрые плашки
window.setSlotPreset = function(key, idx) {
    builderState[key].index = idx;
    updateSlotUI(key, idx);

    if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.selectionChanged();
    }
    recalcTotalReward();
};

function updateSlotUI(key, idx) {
    const preset = slotPresets[key][idx];
    const targetEl = document.getElementById(`target-val-${key.replace('_', '-')}`);
    const rewardEl = document.getElementById(`reward-val-${key.replace('_', '-')}`);
    const sliderEl = document.getElementById(`slider-${key.replace('_', '-')}`);

    if (targetEl) targetEl.textContent = `${preset.target} ${preset.unit}`;
    if (rewardEl) rewardEl.textContent = `+${preset.reward} 🎟️`;
    if (sliderEl) sliderEl.value = String(idx);

    // Подсветка активной плашки
    const controls = document.getElementById(`controls-${key.replace('_', '-')}`);
    if (controls) {
        const pills = controls.querySelectorAll('.preset-pill');
        pills.forEach((p, i) => p.classList.toggle('active', i === idx));
    }
}

// Персональный вызов
window.setPersonalQuestPreset = function(idx) {
    builderState.personal_quest.index = idx;
    updatePersonalQuestUI(idx);
    if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.selectionChanged();
    }
    recalcTotalReward();
};

function updatePersonalQuestUI(idx) {
    const preset = slotPresets.personal_quest[idx];
    const titleEl = document.getElementById('personal-quest-title-label');
    const rewardEl = document.getElementById('reward-val-personal-quest');
    
    if (titleEl) titleEl.textContent = preset.title;
    if (rewardEl) rewardEl.textContent = `+${preset.reward} 🎟️`;

    const controls = document.getElementById('controls-personal-quest');
    if (controls) {
        const pills = controls.querySelectorAll('.preset-pill');
        pills.forEach((p, i) => p.classList.toggle('active', i === idx));
    }
}

function recalcTotalReward() {
    let total = 0;
    ['twitch_chat', 'twitch_uptime', 'telegram_chat', 'personal_quest'].forEach(key => {
        if (builderState[key].enabled) {
            const idx = builderState[key].index;
            total += slotPresets[key][idx].reward;
        }
    });

    const rewardEl = document.getElementById('total-combo-reward');
    if (rewardEl) {
        rewardEl.innerHTML = `+${total} билетов <i class="fa-solid fa-ticket" style="color: var(--accent-neon); font-size: 11px;"></i>`;
    }
}

// ==========================================
// 4. СТАРТ И ТРЕКИНГ КОНТРАКТА
// ==========================================

window.startCustomContract = function() {
    // 1. Проверяем лимит на неделю (5 раз)
    if (weeklyLimit.used >= weeklyLimit.max) {
        window.customAlert("Лимит 5 контрактов на эту неделю исчерпан! Статистика обнулится в воскресенье.", "Лимит недели");
        return;
    }

    // 2. Собираем только включенные слоты
    const tasks = [];
    if (builderState.twitch_chat.enabled) {
        const p = slotPresets.twitch_chat[builderState.twitch_chat.index];
        tasks.push({ id: 'tw_chat', title: 'Сообщения на Twitch', target: p.target, current: 0, unit: p.unit, reward: p.reward, claimed: false });
    }
    if (builderState.twitch_uptime.enabled) {
        const p = slotPresets.twitch_uptime[builderState.twitch_uptime.index];
        tasks.push({ id: 'tw_uptime', title: 'Просмотр стрима', target: p.target, current: 0, unit: p.unit, reward: p.reward, claimed: false });
    }
    if (builderState.telegram_chat.enabled) {
        const p = slotPresets.telegram_chat[builderState.telegram_chat.index];
        tasks.push({ id: 'tg_chat', title: 'Чат Telegram', target: p.target, current: 0, unit: p.unit, reward: p.reward, claimed: false });
    }
    if (builderState.personal_quest.enabled) {
        const p = slotPresets.personal_quest[builderState.personal_quest.index];
        tasks.push({ id: 'personal', title: p.title, target: p.target, current: 0, unit: p.unit, reward: p.reward, claimed: false });
    }

    if (tasks.length === 0) {
        window.customAlert("Включите хотя бы одно задание для старта контракта!");
        return;
    }

    weeklyLimit.used++;
    updateWeeklyLimitBadge();

    const contractData = {
        startedAt: new Date().toISOString(),
        tasks: tasks
    };

    localStorage.setItem('user_weekly_contract', JSON.stringify(contractData));
    if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
    }
    renderActiveContract(contractData);
};

function renderActiveContract(contractData) {
    if (dom.questBuilderCard) dom.questBuilderCard.classList.add('hidden');
    if (dom.activeContractDashboard) dom.activeContractDashboard.classList.remove('hidden');

    const listContainer = dom.activeContractTasksList;
    if (!listContainer) return;

    listContainer.innerHTML = '';
    contractData.tasks.forEach(task => {
        const isDone = task.current >= task.target;
        const row = document.createElement('div');
        row.className = 'active-task-row';

        row.innerHTML = `
            <div class="active-task-info">
                <span class="active-task-title">${task.title}</span>
                <span class="active-task-progress">${task.current} / ${task.target} ${task.unit}</span>
            </div>
            <button class="claim-single-btn ${isDone && !task.claimed ? 'ready' : ''}" ${!isDone || task.claimed ? 'disabled' : ''} onclick="claimSingleTaskReward('${task.id}')">
                ${task.claimed ? 'Забрано' : `+${task.reward} 🎟️`}
            </button>
        `;
        listContainer.appendChild(row);
    });
}

window.claimSingleTaskReward = function(taskId) {
    const raw = localStorage.getItem('user_weekly_contract');
    if (!raw) return;
    const contract = JSON.parse(raw);
    const task = contract.tasks.find(t => t.id === taskId);
    if (!task || task.claimed) return;

    task.claimed = true;
    localStorage.setItem('user_weekly_contract', JSON.stringify(contract));

    window.customAlert(`Награда +${task.reward} билетов начислена на ваш баланс!`, "Награда получена");
    renderActiveContract(contract);
};

window.cancelActiveContract = function() {
    if (confirm("Отменить недельный контракт за 15 билетов? Прогресс текущих заданий будет сброшен.")) {
        localStorage.removeItem('user_weekly_contract');
        window.customAlert("Контракт отменён. Вы можете настроить новый список задач.", "Контракт сброшен");
        initBuilderUI();
    }
};

// ==========================================
// 5. МОДАЛЬНОЕ ОКНО ИДЕАЛЬНОЙ СЕРИИ
// ==========================================

window.openStreakModal = function() {
    if (dom.streakModal) dom.streakModal.classList.add('visible');
    if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.selectionChanged();
    }
};

window.closeStreakModal = function() {
    if (dom.streakModal) dom.streakModal.classList.remove('visible');
};

// ==========================================
// 6. ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК
// ==========================================

window.switchViewTab = function(tab) {
    const isAuto = tab === 'auto';
    document.getElementById('tab-btn-auto')?.classList.toggle('active', isAuto);
    document.getElementById('tab-btn-manual')?.classList.toggle('active', !isAuto);

    dom.sectionAuto?.classList.toggle('hidden', !isAuto);
    dom.sectionManual?.classList.toggle('hidden', isAuto);

    if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.selectionChanged();
    }
};

// ==========================================
// 7. СТАРТ И ОСНОВНАЯ ЛОГИКА
// ==========================================

async function main() {
    let bootstrapData = window.bootstrapPromise ? await window.bootstrapPromise : await makeApiRequest("/api/v1/bootstrap", {}, 'POST', true);

    if (bootstrapData) {
        userData = bootstrapData.user || {};
        allQuests = bootstrapData.quests || [];

        if (bootstrapData.matrix_quest !== undefined) {
            renderMatrixTracker(bootstrapData.matrix_quest, userData);
        }

        initBuilderUI();

        try {
            const manualQuests = await makeApiRequest("/api/v1/quests/manual", {}, 'POST', true);
            renderManualQuests(manualQuests);
        } catch (e) {
            renderManualQuests(allQuests.filter(q => q.quest_type === 'manual_check'));
        }
    }

    if (dom.loaderOverlay) dom.loaderOverlay.classList.add('hidden');
    dom.mainContent.style.opacity = 1;
}

function renderMatrixTracker(matrixData, userData) {
    const container = document.getElementById('matrix-quest-tracker');
    if (!container) return;

    if (!matrixData || matrixData.selected_pill !== 'blue' || matrixData.is_completed) {
        container.innerHTML = '';
        container.style.display = 'none'; 
        return;
    }

    container.style.display = 'block'; 
    const tgDone = matrixData.tg_msg_current || 0;
    const twitchDone = matrixData.twitch_msg_current || 0;

    container.innerHTML = `
        <div class="glass-card" style="margin-bottom: 6px; padding: 9px 12px; flex-direction: row; justify-content: space-between; align-items: center;">
            <div style="font-size: 10px; font-weight: 800; color: #fff; text-transform: uppercase;">
                <i class="fa-solid fa-shield-halved" style="color: #fff; margin-right: 4px; opacity:0.8;"></i> Проверка доверием
            </div>
            <div style="display: flex; gap: 8px; font-size: 9px; font-weight: 800; font-family:'SF Mono', monospace;">
                <span style="color:#fff;">TG: ${tgDone}/50</span>
                <span style="color:#fff;">TW: ${twitchDone}/200</span>
            </div>
        </div>
    `;
}

function renderManualQuests(questsData) {
    const container = document.getElementById('manual-quests-list');
    if (!container) return;
    container.innerHTML = ''; 

    let quests = Array.isArray(questsData) ? questsData : (questsData?.quests || []);
    if (quests.length === 0) {
        container.innerHTML = `<p style="text-align: center; font-size: 11px; color: var(--text-color-muted); padding:20px 0;">Нет заданий для проверки.</p>`;
        return;
    }

    const grouped = new Map();
    quests.forEach(q => {
        const cat = q.quest_categories?.name || 'Разное';
        if (!grouped.has(cat)) grouped.set(cat, []);
        grouped.get(cat).push(q);
    });

    grouped.forEach((list, catName) => {
        const items = list.map(q => `
            <div class="quest-card" style="margin-bottom:0;">
                <div class="quest-title">${escapeHTML(q.title)}</div>
                <div class="quest-subtitle">${escapeHTML(q.description)}</div>
                <div style="color:#fff; font-size:10px; font-weight:800; margin:3px 0;">+${q.reward_amount} монет</div>
                <div class="manual-quest-actions">
                    ${q.action_url ? `<a href="${escapeHTML(q.action_url)}" target="_blank" class="action-link-btn">Открыть</a>` : ''}
                    <button class="compact-action-btn perform-quest-button" data-id="${q.id}" data-title="${escapeHTML(q.title)}" style="padding:6px 10px; flex:1;">Отправить</button>
                </div>
            </div>
        `).join('');

        container.insertAdjacentHTML('beforeend', `
            <details class="quest-category-accordion" open>
                <summary class="quest-category-header">${escapeHTML(catName)}</summary>
                <div class="quest-category-body">${items}</div>
            </details>
        `);
    });
}

function initPullToRefresh() {
    const content = document.getElementById('main-content');
    const ptrContainer = document.getElementById('pull-to-refresh'); 
    const icon = ptrContainer ? ptrContainer.querySelector('i') : null;
    if (!content || !ptrContainer || !icon) return;
    let startY = 0, pulledDistance = 0, isPulling = false;

    content.addEventListener('touchstart', (e) => {
        if (content.scrollTop <= 0) { 
            startY = e.touches[0].clientY; 
            isPulling = true; 
        } else { isPulling = false; }
    }, { passive: true });

    content.addEventListener('touchmove', (e) => {
        if (!isPulling) return;
        const diff = e.touches[0].clientY - startY;
        if (diff > 0 && content.scrollTop <= 0) {
            if (e.cancelable) e.preventDefault();
            pulledDistance = Math.min(Math.pow(diff, 0.85), 100);
            content.style.transform = `translateY(${pulledDistance}px)`;
            ptrContainer.style.transform = `translateY(${pulledDistance}px)`;
            icon.style.transform = `rotate(${pulledDistance * 3}deg)`;
        }
    }, { passive: false });

    content.addEventListener('touchend', () => {
        if (!isPulling) return;
        isPulling = false;
        content.style.transition = 'transform 0.3s ease-out';
        ptrContainer.style.transition = 'transform 0.3s ease-out';
        if (pulledDistance > 60) {
            content.style.transform = `translateY(60px)`;
            ptrContainer.style.transform = `translateY(60px)`;
            setTimeout(() => window.location.reload(), 400);
        } else {
            content.style.transform = 'translateY(0px)';
            ptrContainer.style.transform = 'translateY(0px)';
        }
        pulledDistance = 0;
    });
}

function setupEventListeners() {
    if (window.Telegram?.WebApp?.BackButton) {
        window.Telegram.WebApp.BackButton.show();
        window.Telegram.WebApp.BackButton.onClick(() => window.history.back());
    }

    document.body.addEventListener('click', async (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        if (target.classList.contains('perform-quest-button')) {
            currentQuestId = target.dataset.id;
            dom.promptTitle.textContent = target.dataset.title;
            dom.promptInput.value = '';
            dom.promptOverlay.classList.remove('hidden');
        }
    });

    if (dom.promptConfirm) {
        dom.promptConfirm.addEventListener('click', async () => {
            const val = dom.promptInput.value.trim();
            if (!val) return;
            dom.promptOverlay.classList.add('hidden');
            await makeApiRequest(`/api/v1/quests/${currentQuestId}/submit`, { submittedData: val });
            window.customAlert("Заявка успешно отправлена на проверку!", "Принято");
        });
    }

    if (dom.promptCancel) {
        dom.promptCancel.addEventListener('click', () => dom.promptOverlay.classList.add('hidden'));
    }
}

try {
    if (window.Telegram?.WebApp) {
        Telegram.WebApp.ready();
        Telegram.WebApp.expand();
    }
    setupEventListeners();
    initPullToRefresh();
    main();
} catch (e) {
    if (dom.loaderOverlay) dom.loaderOverlay.classList.add('hidden');
}
