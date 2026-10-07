// ==========================================
// 1. ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ И DOM
// ==========================================
const dom = {
    loaderOverlay: document.getElementById('loader-overlay'),
    loadingText: document.getElementById('loading-text'),
    loadingBarFill: document.getElementById('loading-bar-fill'),
    mainContent: document.getElementById('main-content'),
    
    challengeContainer: document.getElementById('challenge-container'),
    activeAutomaticQuestContainer: document.getElementById('active-automatic-quest-container'),
    questBuilderCard: document.getElementById('quest-builder-card'),

    // Разделы
    sectionAuto: document.getElementById('section-auto-quests'),
    sectionManual: document.getElementById('section-manual-quests'),

    // Модальные окна
    promptOverlay: document.getElementById('custom-prompt-overlay'),
    promptTitle: document.getElementById('prompt-title'),
    promptInput: document.getElementById('prompt-input'),
    promptCancel: document.getElementById('prompt-cancel'),
    promptConfirm: document.getElementById('prompt-confirm'),
    
    scheduleModal: document.getElementById('schedule-modal-overlay'),
    scheduleCloseBtn: document.getElementById('schedule-modal-close-btn')
};

let currentQuestId = null;
let countdownIntervals = {};
let allQuests = [];
let userData = {};

// Состояние мульти-слайдеров
let multiQuestsData = {
    twitch_chat: [],
    twitch_uptime: [],
    telegram_chat: []
};

let selectedCombo = {
    twitch_chat: null,
    twitch_uptime: null,
    telegram_chat: null
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
    if (lower.includes('streak expired') || lower.includes('streak lost') || lower.includes('missed') || lower.includes('сгорел')) {
        return "Ваша серия сгорела! Вы пропустили день, серия сброшена на День 1.";
    }
    if (lower.includes('already claimed') || lower.includes('cooldown') || lower.includes('уже забран')) {
        return "Награда уже собрана! Дождитесь окончания кулдауна.";
    }
    if (lower.includes('unauthorized') || lower.includes('invalid initdata')) {
        return "Сессия устарела. Пожалуйста, перезапустите мини-приложение.";
    }
    return msg;
}

window.customAlert = function(text, title = 'Внимание', type = 'warning') {
    const oldAlert = document.getElementById('custom-app-alert');
    if (oldAlert) oldAlert.remove();

    const translatedText = formatErrorMessage(text);
    let iconClass = type === 'error' ? 'fa-solid fa-circle-exclamation' : 'fa-solid fa-triangle-exclamation';
    let iconColor = type === 'error' ? 'var(--danger-color)' : 'var(--accent-neon)';

    const overlay = document.createElement('div');
    overlay.id = 'custom-app-alert';
    overlay.className = 'modal-overlay visible';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    overlay.innerHTML = `
        <div class="bottom-sheet" style="box-shadow: none; background: transparent; border: none; backdrop-filter: none; -webkit-backdrop-filter: none; max-width: 320px; padding: 20px 18px; text-align: left;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <i class="${iconClass}" style="color: ${iconColor}; font-size: 15px;"></i>
                    <h3 style="margin: 0; font-size: 14px; font-weight: 900; color: #fff; text-transform: uppercase;">${title}</h3>
                </div>
                <button class="tour-close-btn" onclick="this.closest('.modal-overlay').remove()"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div style="font-size: 11px; color: #ffffff; line-height: 1.45; font-weight: 500; margin-bottom: 18px;">
                ${translatedText}
            </div>
            <button class="premium-btn active-state" onclick="this.closest('.modal-overlay').remove()">ПОНЯТНО</button>
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
        if (e.name === 'AbortError') e.message = "Превышено время ожидания ответа.";
        if (e.message !== 'Cooldown active' && !isSilent) {
            window.customAlert(e.message, 'Ошибка', 'error');
        }
        throw e;
    } finally {
        if (!isSilent && dom.loaderOverlay) dom.loaderOverlay.classList.add('hidden');
    }
}

function startCountdown(timerElement, expiresAt, intervalKey, onEndCallback) {
    if (countdownIntervals[intervalKey]) clearInterval(countdownIntervals[intervalKey]);
    if (!timerElement) return;

    const endTime = new Date(expiresAt).getTime();
    const updateTimer = () => {
        const currentTimerElement = document.getElementById(timerElement.id);
        if (!currentTimerElement) {
            clearInterval(countdownIntervals[intervalKey]);
            return;
        }
        const now = new Date().getTime();
        const distance = endTime - now;
        if (distance < 0) {
            clearInterval(countdownIntervals[intervalKey]);
            delete countdownIntervals[intervalKey];
            if (onEndCallback) onEndCallback();
            if (intervalKey === 'challenge_cooldown') refreshDataSilently();
            return;
        }
        const h = Math.floor((distance % 86400000) / 3600000);
        const m = Math.floor((distance % 3600000) / 60000);
        const s = Math.floor((distance % 60000) / 1000);
        currentTimerElement.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };
    countdownIntervals[intervalKey] = setInterval(updateTimer, 1000);
    updateTimer();
}

// ==========================================
// 3. 🎛️ МУЛЬТИ-КОНСТРУКТОР 3 В 1 И КОМБО-ОЧЕРЕДЬ
// ==========================================

function initQuestBuilder() {
    if (!dom.questBuilderCard) return;

    if (userData.active_quest_id) {
        dom.questBuilderCard.classList.add('hidden');
        if (dom.activeAutomaticQuestContainer) {
            dom.activeAutomaticQuestContainer.classList.remove('hidden');
        }
        return;
    }

    dom.questBuilderCard.classList.remove('hidden');
    if (dom.activeAutomaticQuestContainer) {
        dom.activeAutomaticQuestContainer.classList.add('hidden');
    }

    // Фильтруем квесты по категориям
    multiQuestsData.twitch_chat = allQuests
        .filter(q => q.quest_type && q.quest_type.includes('twitch_messages') && !q.is_completed)
        .sort((a, b) => (a.target_value || 0) - (b.target_value || 0));

    multiQuestsData.twitch_uptime = allQuests
        .filter(q => q.quest_type && q.quest_type.includes('twitch_uptime') && !q.is_completed)
        .sort((a, b) => (a.target_value || 0) - (b.target_value || 0));

    multiQuestsData.telegram_chat = allQuests
        .filter(q => q.quest_type && q.quest_type.includes('telegram') && !q.is_completed)
        .sort((a, b) => (a.target_value || 0) - (b.target_value || 0));

    // Настраиваем слайдеры
    setupRowSlider('twitch_chat', 'slider-twitch-chat');
    setupRowSlider('twitch_uptime', 'slider-twitch-uptime');
    setupRowSlider('telegram_chat', 'slider-telegram-chat');

    recalcTotalComboReward();
}

function setupRowSlider(type, elementId) {
    const slider = document.getElementById(elementId);
    const list = multiQuestsData[type];
    if (!slider || !list || list.length === 0) {
        if (slider) slider.disabled = true;
        return;
    }

    slider.disabled = false;
    slider.min = "0";
    slider.max = String(list.length - 1);
    slider.step = "1";
    const defIdx = Math.min(1, list.length - 1);
    slider.value = String(defIdx);

    updateMultiSlider(type, defIdx, false);
}

window.updateMultiSlider = function(type, indexVal, triggerHaptic = true) {
    const idx = parseInt(indexVal, 10);
    const list = multiQuestsData[type];
    const quest = list[idx];
    if (!quest) return;

    selectedCombo[type] = quest;

    let unit = "сообщ.";
    if (type === 'twitch_uptime') unit = "мин.";

    const targetEl = document.getElementById(`target-val-${type.replace('_', '-')}`);
    const rewardEl = document.getElementById(`reward-val-${type.replace('_', '-')}`);

    if (targetEl) targetEl.textContent = `${quest.target_value || 1} ${unit}`;
    if (rewardEl) rewardEl.textContent = `+${quest.reward_amount || 1} 🎟️`;

    if (triggerHaptic && window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.selectionChanged();
    }

    recalcTotalComboReward();
};

function recalcTotalComboReward() {
    let sum = 0;
    Object.values(selectedCombo).forEach(q => {
        if (q && q.reward_amount) sum += q.reward_amount;
    });

    const totalEl = document.getElementById('total-combo-reward');
    if (totalEl) {
        totalEl.innerHTML = `+${sum} Билетов <i class="fa-solid fa-ticket" style="font-size: 11px;"></i>`;
    }
}

// Запуск комбо без изменения структуры БД
window.startComboContract = async function() {
    const questsToQueue = Object.values(selectedCombo).filter(Boolean);
    if (questsToQueue.length === 0) return;

    const btn = document.getElementById('combo-start-btn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    }

    const queueIds = questsToQueue.map(q => q.id);
    const firstQuestId = queueIds.shift();
    localStorage.setItem('user_quest_combo_queue', JSON.stringify(queueIds));

    try {
        await makeApiRequest("/api/v1/quests/start", { quest_id: firstQuestId });
        localStorage.removeItem('quests_cache_v1');
        window.location.reload();
    } catch (e) {
        window.customAlert(e.message || "Не удалось запустить комбо-контракт");
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = 'АКТИВИРОВАТЬ ВСЕ 3';
        }
    }
};

// ==========================================
// 4. ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК
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
// 5. ТРЕКЕР МАТРИЦЫ И ЧЕЛЛЕНДЖИ
// ==========================================

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
    const isReadyToClaim = tgDone >= 50 && twitchDone >= 200;

    container.innerHTML = `
        <div class="glass-card" style="margin-bottom: 8px; padding: 10px 14px; flex-direction: row; justify-content: space-between; align-items: center;">
            <div style="font-size: 11px; font-weight: 900; color: #fff; text-transform: uppercase;">
                <i class="fa-solid fa-shield-halved" style="color: #2AABEE; margin-right: 5px;"></i> ПРОВЕРКА ДОВЕРИЕМ
            </div>
            ${isReadyToClaim ? `
                <button onclick="claimMatrixReward()" class="premium-btn active-state" style="width:auto; padding:6px 12px; font-size:10px;">
                    ЗАБРАТЬ ПРИЗ
                </button>
            ` : `
                <div style="display: flex; gap: 10px; font-size: 10px; font-weight: 800; font-family:'SF Mono', monospace;">
                    <span style="color:${tgDone >= 50 ? 'var(--accent-green)' : 'var(--accent-neon)'};">TG: ${tgDone}/50</span>
                    <span style="color:${twitchDone >= 200 ? 'var(--accent-green)' : 'var(--accent-neon)'};">TW: ${twitchDone}/200</span>
                </div>
            `}
        </div>
    `;
}

function renderChallenge(challengeData, isGuest) {
    dom.challengeContainer.innerHTML = '';
    const isOnline = userData.is_stream_online === true;
    const streamBadgeHtml = isOnline 
        ? `<div class="stream-status-badge online"><i class="fa-solid fa-circle" style="font-size:6px; margin-right:3px;"></i> LIVE</div>`
        : `<div class="stream-status-badge offline">ОФФЛАЙН</div>`;

    if (isGuest) return;
    
    if (challengeData && challengeData.cooldown_until) {
        dom.challengeContainer.innerHTML = `
            <div class="quest-card">
                ${streamBadgeHtml}
                <div class="quest-title">Следующий стрим-челлендж</div>
                <p class="quest-subtitle">Будет доступен после окончания кулдауна</p>
                <div id="challenge-cooldown-timer" class="challenge-timer" style="margin-top: 6px;">...</div>
            </div>`;
        startCountdown(document.getElementById('challenge-cooldown-timer'), challengeData.cooldown_until, 'challenge_cooldown');
        return;
    }

    if (!challengeData || !challengeData.description) return;

    const challenge = challengeData; 
    const currentProgress = challenge.progress_value || 0;
    const target = challenge.target_value || 1;
    const percent = Math.min(100, (currentProgress / target) * 100);
    const canClaim = currentProgress >= target && !challenge.claimed_at;
    
    dom.challengeContainer.innerHTML = `
        <div class="quest-card">
            ${streamBadgeHtml}
            <div class="quest-title">${challenge.description}</div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${percent}%;"></div>
                <div class="progress-content"><span class="progress-text">${currentProgress} / ${target}</span></div>
            </div>
            <div style="margin-top:6px;">
                <button id="claim-challenge-btn" data-challenge-id="${challenge.challenge_id}" class="premium-btn ${canClaim ? 'active-state' : ''}" ${!canClaim ? 'disabled' : ''}>
                    ${challenge.claimed_at ? 'ВЫПОЛНЕНО' : 'ЗАБРАТЬ ЧЕЛЛЕНДЖ'}
                </button>
            </div>
        </div>`;
}

function renderActiveAutomaticQuest(quest, userData) {
    if (!dom.activeAutomaticQuestContainer) return;
    dom.activeAutomaticQuestContainer.innerHTML = '';
    if (!quest || !userData || !userData.active_quest_id) {
        dom.activeAutomaticQuestContainer.classList.add('hidden');
        return;
    }
    
    const activeQuest = allQuests.find(q => q.id === userData.active_quest_id);
    if (!activeQuest) return;

    dom.activeAutomaticQuestContainer.classList.remove('hidden');

    const progress = userData.active_quest_progress || 0;
    const target = activeQuest.target_value || 1;
    const percent = Math.min(100, (progress / target) * 100);
    const isCompleted = progress >= target;
    
    dom.activeAutomaticQuestContainer.innerHTML = `
        <div class="quest-card" style="border-color: rgba(52, 199, 89, 0.4);">
            <div class="active-quest-indicator">ВЫПОЛНЯЕТСЯ</div>
            <div class="quest-title" style="margin-top: 8px;">${activeQuest.title}</div>
            <div class="quest-subtitle">${activeQuest.description}</div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${percent}%; background: linear-gradient(90deg, #34c759, #30d158);"></div>
                <div class="progress-content"><span class="progress-text">${progress} / ${target}</span></div>
            </div>
            <div style="margin-top:6px;">
                ${isCompleted ? `
                    <button class="premium-btn active-state" data-quest-id="${activeQuest.id}">
                        ЗАБРАТЬ НАГРАДУ
                    </button>
                ` : `
                    <button id="cancel-quest-btn" class="cancel-quest-button">
                        Отменить задание
                    </button>
                `}
            </div>
        </div>`;
}

function renderManualQuests(questsData) {
    const container = document.getElementById('manual-quests-list');
    if (!container) return;
    container.innerHTML = ''; 

    let quests = Array.isArray(questsData) ? questsData : (questsData?.quests || []);
    if (quests.length === 0) {
        container.innerHTML = `<p style="text-align: center; font-size: 11px; color: var(--text-color-muted); padding:20px 0;">Нет доступных заданий для проверки.</p>`;
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
                <div style="color:var(--accent-neon); font-size:11px; font-weight:800; margin:4px 0;">+${q.reward_amount} <i class="fa-solid fa-coins"></i></div>
                <div class="manual-quest-actions">
                    ${q.action_url ? `<a href="${escapeHTML(q.action_url)}" target="_blank" class="action-link-btn">Открыть</a>` : ''}
                    <button class="premium-btn perform-quest-button" data-id="${q.id}" data-title="${escapeHTML(q.title)}" style="padding:6px 10px;">Отправить</button>
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

// ==========================================
// 6. ОБУЧАЮЩИЙ ГИД (ТУР)
// ==========================================
let currentQuestTourStep = 0;
const questTourSteps = [
    {
        title: "Комбо-контракт",
        text: "Настраивай удобный объём активности на сегодня! Каждый ползунок регулирует нагрузку и суммирует итоговую награду билетов 🎟️.",
        img: "/static/grind_intro.png",
        targetSelector: "#quest-builder-card"
    },
    {
        title: "Проверка доверием",
        text: "Сверху отображается шкала <b>Матрицы</b>: общайся в чате TG и на стримах Twitch, чтобы забрать секретный кейс!",
        img: "/static/grind_tasks.png",
        targetSelector: "#matrix-quest-tracker"
    },
    {
        title: "Ручная проверка",
        text: "Выполняй задания сообщества во второй вкладке, прикрепляй пруфы и получай монеты на баланс после одобрения модератором!",
        img: "/static/grind_shop.png",
        targetSelector: ".segment-control"
    }
];

function injectTourMarkup() {
    if (document.getElementById('tour-backdrop')) return;
    document.body.insertAdjacentHTML('beforeend', `
        <div id="tour-backdrop" class="tour-backdrop"></div>
        <div id="tour-card" class="tour-card" style="display: none;">
            <div class="tour-card-header">
                <span class="tour-step-badge" id="tour-step-badge">Шаг 1 из 3</span>
                <button class="tour-close-btn" onclick="closeQuestTour()"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="tour-levitate-stage" id="tour-img-stage">
                <img id="tour-img" class="tour-img" src="" alt="Обучение" onerror="document.getElementById('tour-img-stage').style.display='none'">
            </div>
            <div class="tour-card-body">
                <h4 class="tour-title" id="tour-title">Обучение</h4>
                <p class="tour-text" id="tour-text">...</p>
            </div>
            <div class="tour-actions">
                <button class="premium-btn" id="tour-prev-btn" style="flex: 1;" onclick="prevQuestTourStep()">Назад</button>
                <button class="premium-btn active-state" id="tour-next-btn" style="flex: 1.5;" onclick="nextQuestTourStep()">Далее</button>
            </div>
        </div>
    `);
}

window.startQuestTour = function() {
    injectTourMarkup();
    currentQuestTourStep = 0;
    document.body.classList.add('tour-mode');
    document.getElementById('tour-card').style.display = 'flex';
    renderCurrentQuestTourStep();
};

window.closeQuestTour = function() {
    document.body.classList.remove('tour-mode');
    const card = document.getElementById('tour-card');
    if (card) card.style.display = 'none';
    document.querySelectorAll('.tour-target-active').forEach(el => el.classList.remove('tour-target-active'));
};

window.nextQuestTourStep = function() {
    if (currentQuestTourStep < questTourSteps.length - 1) {
        currentQuestTourStep++;
        renderCurrentQuestTourStep();
    } else {
        closeQuestTour();
    }
};

window.prevQuestTourStep = function() {
    if (currentQuestTourStep > 0) {
        currentQuestTourStep--;
        renderCurrentQuestTourStep();
    }
};

function renderCurrentQuestTourStep() {
    const step = questTourSteps[currentQuestTourStep];
    document.querySelectorAll('.tour-target-active').forEach(el => el.classList.remove('tour-target-active'));

    document.getElementById('tour-step-badge').textContent = `Шаг ${currentQuestTourStep + 1} из ${questTourSteps.length}`;
    document.getElementById('tour-title').textContent = step.title;
    document.getElementById('tour-text').innerHTML = step.text;

    const imgEl = document.getElementById('tour-img');
    if (step.img) {
        document.getElementById('tour-img-stage').style.display = 'flex';
        imgEl.src = step.img;
    }

    document.getElementById('tour-prev-btn').style.visibility = currentQuestTourStep === 0 ? 'hidden' : 'visible';
    document.getElementById('tour-next-btn').textContent = currentQuestTourStep === questTourSteps.length - 1 ? 'ПОНЯТНО 👍' : 'ДАЛЕЕ ➔';

    const target = document.querySelector(step.targetSelector);
    if (target) {
        target.classList.add('tour-target-active');
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// ==========================================
// 7. СТАРТ И ОБРАБОТЧИКИ
// ==========================================

async function main() {
    let bootstrapData = window.bootstrapPromise ? await window.bootstrapPromise : await makeApiRequest("/api/v1/bootstrap", {}, 'POST', true);

    if (bootstrapData) {
        userData = bootstrapData.user || {};
        allQuests = bootstrapData.quests || [];

        if (bootstrapData.matrix_quest !== undefined) {
            renderMatrixTracker(bootstrapData.matrix_quest, userData);
        }

        const isTwitchLinked = !!(userData.twitch_id || userData.twitch_login);
        if (userData.challenge) renderChallenge(userData.challenge, !isTwitchLinked);

        // Инициализируем 3-в-1 мульти-конструктор
        initQuestBuilder();

        // Проверяем, есть ли запущенный квест
        if (userData.active_quest_id) {
            renderActiveAutomaticQuest(allQuests.find(q => q.id === userData.active_quest_id), userData);
        }

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
            icon.style.color = pulledDistance > 60 ? "var(--accent-neon)" : "var(--text-color-muted)";
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
            icon.classList.add('fa-spin');
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

        // Забрать награду за авто-квест
        if (target.dataset.questId) {
            target.disabled = true;
            try {
                const res = await makeApiRequest('/api/v1/promocode', { quest_id: parseInt(target.dataset.questId, 10) });
                
                // Проверяем очередь комбо-контракта
                const rawQueue = localStorage.getItem('user_quest_combo_queue');
                const queue = rawQueue ? JSON.parse(rawQueue) : [];

                if (queue.length > 0) {
                    const nextQuestId = queue.shift();
                    localStorage.setItem('user_quest_combo_queue', JSON.stringify(queue));
                    // Бесшовно запускаем следующий квест цепочки
                    await makeApiRequest('/api/v1/quests/start', { quest_id: nextQuestId }, 'POST', true);
                    window.customAlert("Награда получена! Следующий этап контракта активирован.", "Этап завершён");
                } else {
                    localStorage.removeItem('user_quest_combo_queue');
                    window.customAlert(res.message || "Награда успешно начислена на ваш баланс!", "Успешно");
                }

                setTimeout(() => window.location.reload(), 1200);
            } catch (err) {
                target.disabled = false;
            }
        }

        // Забрать награду за стрим-челлендж
        if (target.id === 'claim-challenge-btn') {
            target.disabled = true;
            try {
                await makeApiRequest(`/api/v1/challenges/${target.dataset.challengeId}/claim`, {}, 'POST');
                window.customAlert("Награда за стрим-челлендж получена!", "Успешно");
                setTimeout(() => window.location.reload(), 1200);
            } catch (err) {
                target.disabled = false;
            }
        }

        // Отмена активного квеста
        if (target.id === 'cancel-quest-btn') {
            if (confirm("Отменить текущее задание? Очередь контракта также будет сброшена.")) {
                localStorage.removeItem('user_quest_combo_queue');
                await makeApiRequest('/api/v1/quests/cancel');
                window.location.reload();
            }
        }

        // Открытие ручного квеста для ввода пруфа
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
            window.customAlert("Заявка успешно отправлена на проверку модератором!", "Принято");
        });
    }

    if (dom.promptCancel) {
        dom.promptCancel.addEventListener('click', () => dom.promptOverlay.classList.add('hidden'));
    }
}

try {
    if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
    }
    setupEventListeners();
    initPullToRefresh();
    main();
} catch (e) {
    if (dom.loaderOverlay) dom.loaderOverlay.classList.add('hidden');
}
