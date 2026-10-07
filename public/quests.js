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
    
    // Блок интерактивного конструктора
    questBuilderCard: document.getElementById('quest-builder-card'),
    builderStepLabel: document.getElementById('builder-step-label'),
    builderQuestTitle: document.getElementById('builder-quest-title'),
    builderQuestDesc: document.getElementById('builder-quest-desc'),
    builderTargetBadge: document.getElementById('builder-target-badge'),
    builderRewardText: document.getElementById('builder-reward-text'),
    builderStartBtn: document.getElementById('builder-start-btn'),
    slider: document.getElementById('quest-difficulty-slider'),
    sliderTicks: document.getElementById('slider-ticks-container'),

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

// Состояние конструктора активности
let currentPlatformMode = 'twitch_chat'; // 'twitch_chat' | 'twitch_uptime' | 'telegram_chat'
let filteredBuilderQuests = [];
let selectedBuilderQuest = null;

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
// 3. 🎛️ ИНТЕРАКТИВНЫЙ СЛАЙДЕР-КОНСТРУКТОР
// ==========================================

function getPrefixForMode(mode) {
    if (mode === 'twitch_chat') return 'automatic_twitch_messages';
    if (mode === 'twitch_uptime') return 'automatic_twitch_uptime';
    if (mode === 'telegram_chat') return 'automatic_telegram';
    return 'automatic_twitch';
}

function initQuestBuilder() {
    if (!dom.questBuilderCard) return;

    // Если у пользователя уже запущен квест — скрываем конструктор
    if (userData.active_quest_id) {
        dom.questBuilderCard.classList.add('hidden');
        if (dom.activeAutomaticQuestContainer) dom.activeAutomaticQuestContainer.classList.remove('hidden');
        return;
    }

    dom.questBuilderCard.classList.remove('hidden');
    if (dom.activeAutomaticQuestContainer) dom.activeAutomaticQuestContainer.classList.add('hidden');

    const prefix = getPrefixForMode(currentPlatformMode);
    
    // Выбираем из базы квесты нужной категории
    filteredBuilderQuests = allQuests
        .filter(q => q.quest_type && q.quest_type.startsWith(prefix) && !q.is_completed)
        .sort((a, b) => (a.target_value || 0) - (b.target_value || 0));

    // Если точных нет, берем запасной список
    if (filteredBuilderQuests.length === 0) {
        filteredBuilderQuests = allQuests
            .filter(q => q.quest_type && !q.quest_type.includes('manual') && !q.is_completed)
            .sort((a, b) => (a.target_value || 0) - (b.target_value || 0));
    }

    if (filteredBuilderQuests.length === 0) {
        dom.builderQuestTitle.textContent = "Нет доступных заданий";
        dom.builderQuestDesc.textContent = "Все задания этой категории выполнены!";
        if (dom.slider) dom.slider.disabled = true;
        if (dom.builderStartBtn) dom.builderStartBtn.disabled = true;
        return;
    }

    if (dom.slider) {
        dom.slider.disabled = false;
        dom.slider.min = "0";
        dom.slider.max = String(filteredBuilderQuests.length - 1);
        dom.slider.step = "1";
        
        // По умолчанию ставим среднее деление
        const defaultIndex = Math.floor((filteredBuilderQuests.length - 1) / 2);
        dom.slider.value = String(defaultIndex);
        updateBuilderUI(defaultIndex);
    }
}

window.selectBuilderPlatform = function(mode) {
    currentPlatformMode = mode;
    document.querySelectorAll('.platform-pill').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === mode);
    });
    if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.selectionChanged();
    }
    initQuestBuilder();
};

window.onQuestSliderChange = function(indexVal) {
    const idx = parseInt(indexVal, 10);
    updateBuilderUI(idx);
    if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.selectionChanged();
    }
};

function updateBuilderUI(index) {
    selectedBuilderQuest = filteredBuilderQuests[index];
    if (!selectedBuilderQuest) return;

    // Текстовые метки уровней сложности
    const levels = ['ЛАЙТ', 'МЕДИУМ', 'ХАРД', 'ХАРДКОР', 'УЛЬТРА'];
    const levelName = levels[Math.min(index, levels.length - 1)] || 'ВЫЗОВ';
    if (dom.builderStepLabel) dom.builderStepLabel.textContent = levelName;

    if (dom.builderQuestTitle) dom.builderQuestTitle.textContent = selectedBuilderQuest.title || "Вызов дня";
    if (dom.builderQuestDesc) dom.builderQuestDesc.textContent = selectedBuilderQuest.description || "Выполните цель для получения награды";

    // Единицы измерения цели
    let unit = "сообщ.";
    if (selectedBuilderQuest.quest_type?.includes('uptime')) unit = "мин.";
    if (dom.builderTargetBadge) dom.builderTargetBadge.textContent = `${selectedBuilderQuest.target_value || 1} ${unit}`;

    // Награда
    const rewardVal = selectedBuilderQuest.reward_amount || 1;
    if (dom.builderRewardText) {
        dom.builderRewardText.innerHTML = `+${rewardVal} Билета <i class="fa-solid fa-ticket" style="font-size:12px;"></i>`;
    }

    // Подписи под слайдером
    if (dom.sliderTicks) {
        if (filteredBuilderQuests.length <= 2) {
            dom.sliderTicks.innerHTML = `<span>ЛАЙТ</span><span>ХАРД</span>`;
        } else if (filteredBuilderQuests.length === 3) {
            dom.sliderTicks.innerHTML = `<span>ЛАЙТ</span><span>МЕДИУМ</span><span>ХАРД</span>`;
        } else {
            dom.sliderTicks.innerHTML = `<span>ЛАЙТ</span><span>МЕДИУМ</span><span>ХАРД</span><span>УЛЬТРА</span>`;
        }
    }

    if (dom.builderStartBtn) dom.builderStartBtn.disabled = false;
}

window.startCustomSelectedQuest = async function() {
    if (!selectedBuilderQuest) return;
    const btn = dom.builderStartBtn;
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    }

    try {
        await makeApiRequest("/api/v1/quests/start", { quest_id: selectedBuilderQuest.id });
        localStorage.removeItem('quests_cache_v1');
        window.location.reload();
    } catch (e) {
        window.customAlert(e.message || "Не удалось запустить задание");
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = 'ПРИНЯТЬ';
        }
    }
};

// ==========================================
// 4. ПЕРЕКЛЮЧЕНИЕ ГЛАВНЫХ ВКЛАДОК
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
// 5. ТРЕКЕР «МАТРИЦА» И ЧЕЛЛЕНДЖИ
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
        <div class="quest-card builder-card" style="border-color: rgba(52, 199, 89, 0.4);">
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
        title: "Конструктор вызова",
        text: "Выбирай платформу и двигай <b>ползунок сложности</b>! Чем выше цель, тем больше билетов ты получаешь за один заход.",
        img: "/static/grind_intro.png",
        targetSelector: "#quest-builder-card"
    },
    {
        title: "Слайдер сложности",
        text: "Настраивай удобный объем активности под свой вечер: <b>Лайт</b>, <b>Медиум</b> или <b>Хардкор</b> с повышенным кушем!",
        img: "/static/grind_tasks.png",
        targetSelector: ".slider-wrapper"
    },
    {
        title: "Матрица активности",
        text: "Не забывай про <b>Проверку доверием</b> сверху: общайся в чатах, закрывай цели и забирай секретный кейс!",
        img: "/static/grind_tickets.png",
        targetSelector: "#matrix-quest-tracker"
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
// 7. СТАРТ И СОБЫТИЯ
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

        // Инициализируем наш новый конструктор со слайдером
        initQuestBuilder();

        // Проверяем, есть ли активный квест
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

function setupEventListeners() {
    if (window.Telegram?.WebApp?.BackButton) {
        window.Telegram.WebApp.BackButton.show();
        window.Telegram.WebApp.BackButton.onClick(() => window.history.back());
    }

    // Обработчик кнопок на странице
    document.body.addEventListener('click', async (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        // Забрать награду за квест
        if (target.dataset.questId) {
            target.disabled = true;
            try {
                const res = await makeApiRequest('/api/v1/promocode', { quest_id: parseInt(target.dataset.questId, 10) });
                window.customAlert(res.message || "Награда успешно начислена на ваш баланс!", "Успешно");
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
                window.customAlert("Награда за челлендж получена!", "Успешно");
                setTimeout(() => window.location.reload(), 1200);
            } catch (err) {
                target.disabled = false;
            }
        }

        // Отмена квеста
        if (target.id === 'cancel-quest-btn') {
            if (confirm("Отменить текущее задание?")) {
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
    main();
} catch (e) {
    if (dom.loaderOverlay) dom.loaderOverlay.classList.add('hidden');
}
