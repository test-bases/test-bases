// ==========================================
// 1. ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ И DOM
// ==========================================
const dom = {
    loaderOverlay: document.getElementById('loader-overlay'),
    loadingText: document.getElementById('loading-text'),
    loadingBarFill: document.getElementById('loading-bar-fill'),
    mainContent: document.getElementById('main-content'),
    fullName: document.getElementById('fullName'),
    
    // Элементы квестов
    challengeContainer: document.getElementById('challenge-container'),
    activeAutomaticQuestContainer: document.getElementById('active-automatic-quest-container'),
    questChooseBtn: document.getElementById("quest-choose-btn"),
    questChooseContainer: document.getElementById("quest-choose-container"),
    
    // Модальные окна
    rewardClaimedOverlay: document.getElementById('reward-claimed-overlay'),
    rewardCloseBtn: document.getElementById('reward-close-btn'),
    ticketsClaimedOverlay: document.getElementById('tickets-claimed-overlay'),
    ticketsClaimCloseBtn: document.getElementById('tickets-claim-close-btn'),
    
    promptOverlay: document.getElementById('custom-prompt-overlay'),
    promptTitle: document.getElementById('prompt-title'),
    promptInput: document.getElementById('prompt-input'),
    promptCancel: document.getElementById('prompt-cancel'),
    promptConfirm: document.getElementById('prompt-confirm'),

    infoQuestionIcon: document.getElementById('info-question-icon'),
    infoModalOverlay: document.getElementById('info-modal-overlay'),
    infoModalCloseBtn: document.getElementById('info-modal-close-btn'),
    sectionAuto: document.getElementById('section-auto-quests'),
    sectionManual: document.getElementById('section-manual-quests'),

    // Универсальная модалка
    modalOverlay: document.getElementById('universal-modal-overlay'),
    modalTitle: document.getElementById('modal-title'),
    modalCloseBtn: document.getElementById('modal-close-btn'),
    modalContainer: document.getElementById('modal-cards-container'),
    
    scheduleModal: document.getElementById('schedule-modal-overlay'),
    scheduleCloseBtn: document.getElementById('schedule-modal-close-btn')
};

let currentQuestId = null;
let countdownIntervals = {};
let allQuests = [];
let userData = {};
let questsForRoulette = [];

// ==========================================
// 2. УТИЛИТЫ И КАСТОМНЫЕ АЛЕРТЫ LIQUID GLASS
// ==========================================

function escapeHTML(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/[&<>"']/g, match => ({'&': '&amp;','<': '&lt;','>': '&gt;','"': '&quot;',"'": '&#39;'})[match]);
}

function updateLoading(percent) {
    if (dom.loadingText) dom.loadingText.textContent = Math.floor(percent) + '%';
    if (dom.loadingBarFill) dom.loadingBarFill.style.width = Math.floor(percent) + '%';
}

// 🌐 Словарь перевода и нормализации ошибок с бэкенда
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
    if (lower.includes('failed to fetch') || lower.includes('network')) {
        return "Проблема со связью. Проверьте интернет-соединение.";
    }
    return msg;
}

// 🎨 Кастомный алерт без серого нативного окна Telegram
window.customAlert = function(text, title = 'Внимание', type = 'warning') {
    const oldAlert = document.getElementById('custom-app-alert');
    if (oldAlert) oldAlert.remove();

    const translatedText = formatErrorMessage(text);

    let iconClass = 'fa-solid fa-triangle-exclamation';
    let iconColor = 'var(--accent-neon)';

    if (type === 'error') {
        iconClass = 'fa-solid fa-circle-exclamation';
        iconColor = 'var(--danger-color)';
    }

    const overlay = document.createElement('div');
    overlay.id = 'custom-app-alert';
    overlay.className = 'modal-overlay visible';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    overlay.innerHTML = `
        <div class="bottom-sheet" style="box-shadow: none; background: transparent; border: none; backdrop-filter: none; -webkit-backdrop-filter: none; max-width: 320px; padding: 20px 18px; text-align: left;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <i class="${iconClass}" style="color: ${iconColor}; font-size: 15px;"></i>
                    <h3 style="margin: 0; font-size: 14px; font-weight: 900; color: #fff; text-transform: uppercase; letter-spacing: 0.5px;">${title}</h3>
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
            if (onEndCallback) {
                onEndCallback();
            } else if (intervalKey === 'challenge') {
                const cardElement = currentTimerElement.closest('.quest-card');
                if (cardElement) {
                   cardElement.classList.add('expired');
                   const titleEl = cardElement.querySelector('.quest-title');
                   const titleText = titleEl ? titleEl.textContent : 'Челлендж';
                   cardElement.innerHTML = `
                       <div class="quest-content-wrapper">
                           <div class="quest-icon"><i class="fa-solid fa-star"></i></div>
                           <h2 class="quest-title">${titleText}</h2>
                       </div>
                       <div class="expired-overlay">
                           <div class="expired-overlay-text">Время истекло</div>
                           <button id="check-challenge-progress-btn" class="claim-reward-button" style="margin-top:0;">
                               <i class="fa-solid fa-flag-checkered"></i> <span>Завершить</span>
                           </button>
                       </div>
                   `;
                }
            } else if (intervalKey.startsWith('quest_')) {
                 const cardElement = currentTimerElement.closest('.quest-card');
                 if (cardElement) {
                    cardElement.classList.add('expired');
                    const contentWrapper = cardElement.querySelector('.quest-content-wrapper');
                    cardElement.innerHTML = `
                        ${contentWrapper ? contentWrapper.outerHTML : ''}
                        <div class="expired-overlay">
                            <div class="expired-overlay-text">Время истекло</div>
                            <button id="complete-expired-quest-btn" class="claim-reward-button" style="margin-top:0;">
                               <i class="fa-solid fa-flag-checkered"></i> <span>Завершить</span>
                            </button>
                        </div>
                    `;
                 }
            }
            if (intervalKey === 'challenge_cooldown') refreshDataSilently();
            return;
        }
        const d = Math.floor(distance / 86400000);
        const h = Math.floor((distance % 86400000) / 3600000);
        const m = Math.floor((distance % 3600000) / 60000);
        const s = Math.floor((distance % 60000) / 1000);
        let result = '';
        if (d > 0) result += `${d}д `;
        result += `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        currentTimerElement.textContent = result;
    };
    countdownIntervals[intervalKey] = setInterval(updateTimer, 1000);
    updateTimer();
}

// === УНИВЕРСАЛЬНАЯ МОДАЛКА ===
function openUniversalModal(title, contentHTML = '') {
    dom.modalTitle.textContent = title;
    if (contentHTML) dom.modalContainer.innerHTML = contentHTML;
    else dom.modalContainer.innerHTML = '';

    dom.modalOverlay.classList.remove('hidden');
    requestAnimationFrame(() => {
        dom.modalOverlay.classList.add('active');
    });
}

function closeUniversalModal() {
    dom.modalOverlay.classList.remove('active');
    setTimeout(() => {
        dom.modalOverlay.classList.add('hidden');
        dom.modalContainer.innerHTML = '';
        dom.modalContainer.classList.remove('grid-mode');
    }, 300);
}

if (dom.modalCloseBtn) {
    dom.modalCloseBtn.addEventListener('click', closeUniversalModal);
}

// ==========================================
// 3. ТРЕКЕР «МАТРИЦА» (В САМОМ ВЕРХУ)
// ==========================================
function renderMatrixTracker(matrixData, userData) {
    const container = document.getElementById('matrix-quest-tracker');
    if (!container) return;

    if (document.body.classList.contains('browser-mode') && !localStorage.getItem('tg_web_auth_token')) {
        container.style.display = 'none';
        return;
    }

    if (!matrixData || matrixData.selected_pill !== 'blue' || matrixData.is_completed) {
        container.innerHTML = '';
        container.style.display = 'none'; 
        return;
    }

    container.style.display = 'block'; 

    const tgDone = matrixData.tg_msg_current || 0;
    const twitchDone = matrixData.twitch_msg_current || 0;
    
    const twitchAlert = (userData && userData.twitch_id) ? '' : '<div style="color:var(--danger-color); font-size:10px; text-align: right; padding-right: 16px; font-weight:700;"><i class="fa-solid fa-triangle-exclamation"></i> Привяжи Twitch в профиле!</div>';

    const isReadyToClaim = tgDone >= 50 && twitchDone >= 200;
    const tgPercent = Math.min(tgDone / 50, 1);
    const twitchPercent = Math.min(twitchDone / 200, 1);
    const totalProgress = (tgPercent + twitchPercent) / 2;

    let questTitle = "ПРОВЕРКА ДОВЕРИЕМ";
    let questIcon = '<i class="fa-solid fa-shield-halved" style="color: #2AABEE; margin-right: 5px;"></i>';

    if (isReadyToClaim) {
        questTitle = "ДОВЕРИЕ ОПРАВДАНО";
        questIcon = '<i class="fa-solid fa-check-double" style="color: var(--accent-green); margin-right: 5px;"></i>';
    } else if (totalProgress >= 0.8) {
        questTitle = "АБСОЛЮТНАЯ ВЕРНОСТЬ";
        questIcon = '<i class="fa-solid fa-bolt" style="color: var(--accent-neon); margin-right: 5px;"></i>';
    } else if (totalProgress >= 0.5) {
        questTitle = "ДОВЕРИЕ РАСТЕТ";
        questIcon = '<i class="fa-solid fa-fire" style="color: #ff9500; margin-right: 5px;"></i>';
    }

    let rightSideHtml = '';

    if (isReadyToClaim) {
        rightSideHtml = `
            <button onclick="claimMatrixReward()" id="matrix-claim-btn" class="premium-btn active-state" style="width:auto; padding:6px 14px; font-size:10px;">
                ЗАБРАТЬ ПРИЗ
            </button>
        `;
    } else {
        rightSideHtml = `
            <div style="display: flex; gap: 12px; align-items: center;">
                <div style="display: flex; flex-direction: column; align-items: flex-end;">
                    <span style="font-size: 8px; color: var(--text-color-muted); text-transform: uppercase; font-weight: 800;">Telegram</span>
                    <span style="font-size: 11px; font-weight: 900; color: ${tgDone >= 50 ? 'var(--accent-green)' : 'var(--accent-neon)'}; font-family:'SF Mono', monospace;">${tgDone >= 50 ? 50 : tgDone}/50</span>
                </div>
                <div style="width: 1px; height: 16px; background: rgba(255,255,255,0.12);"></div>
                <div style="display: flex; flex-direction: column; align-items: flex-end;">
                    <span style="font-size: 8px; color: var(--text-color-muted); text-transform: uppercase; font-weight: 800;">Twitch</span>
                    <span style="font-size: 11px; font-weight: 900; color: ${twitchDone >= 200 ? 'var(--accent-green)' : 'var(--accent-neon)'}; font-family:'SF Mono', monospace;">${twitchDone >= 200 ? 200 : twitchDone}/200</span>
                </div>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="glass-card" style="margin-bottom: 8px; padding: 10px 14px; flex-direction: row; justify-content: space-between; align-items: center;">
            <div style="font-size: 11px; font-weight: 900; color: #fff; text-transform: uppercase; letter-spacing:0.5px;">
                ${questIcon} ${questTitle}
            </div>
            ${rightSideHtml}
        </div>
        ${twitchAlert}
    `;
}

// === ОКНО НАГРАДЫ ===
function injectRewardPopup(amount, text = "Задание выполнено!", reloadOnClose = false) {
    const existing = document.getElementById('rewardPopup');
    if (existing) existing.remove();

    let topIcon = '<i class="fa-solid fa-gift"></i>';
    let rewardBlock = '';
    let headerContent = `<h3 style="margin: 0 0 8px; font-size: 17px; font-weight: 900; color: #fff; text-transform:uppercase; letter-spacing:0.6px;">${text}</h3>`;

    if (amount > 0) {
        rewardBlock = `
            <p style="margin: 0 0 16px; color: var(--text-color-muted); font-size: 12px; font-weight: 500;">Награда зачислена на баланс</p>
            <div style="background: rgba(255, 215, 0, 0.1); border: 1px solid rgba(255, 215, 0, 0.25); border-radius: 14px; padding: 10px 20px; margin-bottom: 20px; display: inline-block;">
                <span style="font-size: 28px; font-weight: 900; color: var(--accent-neon); text-shadow: 0 0 15px rgba(255, 215, 0, 0.4);">+${amount}</span>
            </div>
        `;
    } else {
        rewardBlock = `<div style="margin-bottom: 16px;"></div>`; 
    }

    const popupHtml = `
    <div id="rewardPopup" class="modal-overlay visible">
      <div class="bottom-sheet" style="text-align: center;">
        <div style="font-size: 44px; margin-bottom: 12px; color: var(--accent-neon); filter: drop-shadow(0 0 20px rgba(255, 215, 0, 0.4));">
            ${topIcon}
        </div>
        ${headerContent}
        ${rewardBlock}
        <button id="closeRewardBtn" class="premium-btn active-state">
            ОТЛИЧНО
        </button>
      </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', popupHtml);

    if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
    }

    document.getElementById('closeRewardBtn').addEventListener('click', () => {
        const popup = document.getElementById('rewardPopup');
        if (popup) popup.remove();
        if (reloadOnClose) {
            window.location.reload();
        } else if (typeof main === 'function') {
            main(); 
        }
    });
}

// ==========================================
// 4. РЕНДЕРИНГ ЧЕЛЛЕНДЖЕЙ И КВЕСТОВ
// ==========================================

function createTwitchNoticeHtml() {
    return `<div class="twitch-update-notice">ℹ️ Прогресс синхронизируется в фоновом режиме (до 30 мин).</div>`;
}

function renderChallenge(challengeData, isGuest) {
    dom.challengeContainer.innerHTML = '';
    const isOnline = userData.is_stream_online === true;
    
    const streamBadgeHtml = isOnline 
        ? `<div class="stream-status-badge online"><i class="fa-solid fa-circle" style="font-size:6px; margin-right:3px;"></i> СТРИМ ОНЛАЙН</div>`
        : `<div class="stream-status-badge offline">СТРИМ ОФФЛАЙН</div>`;

    if (isGuest) {
        dom.challengeContainer.innerHTML = `
            <div class="quest-card">
                ${streamBadgeHtml} 
                <div class="quest-icon"><i class="fa-brands fa-twitch"></i></div>
                <h2 class="quest-title">Случайный челлендж</h2>
                <p class="quest-subtitle">Для доступа к челленджам требуется привязка Twitch-аккаунта в профиле.</p>
                <a href="/profile" class="premium-btn active-state" style="text-decoration: none; margin-top: 6px;">Привязать Twitch</a>
            </div>`;
        return;
    }
    
    if (challengeData && challengeData.cooldown_until) {
        dom.challengeContainer.innerHTML = `
            <div class="quest-card">
                ${streamBadgeHtml} 
                <div class="quest-icon"><i class="fa-solid fa-hourglass-half"></i></div>
                <h2 class="quest-title">Следующий челлендж</h2>
                <p class="quest-subtitle">Новое задание будет доступно после окончания таймера.</p>
                <div id="challenge-cooldown-timer" class="challenge-timer" style="margin-top: 8px;">...</div>
            </div>`;
        if (!countdownIntervals['challenge_cooldown']) {
            startCountdown(document.getElementById('challenge-cooldown-timer'), challengeData.cooldown_until, 'challenge_cooldown');
        }
        return;
    }

    if ((!challengeData || !challengeData.description) && !isOnline) {
        dom.challengeContainer.innerHTML = `
            <div class="quest-card">
                <div class="quest-icon" style="color: var(--danger-color); text-shadow:none;">
                    <i class="fa-solid fa-video-slash"></i>
                </div>
                <h2 class="quest-title">Стрим сейчас оффлайн</h2>
                <p class="quest-subtitle">Челленджи доступны во время прямого эфира. Ознакомьтесь с расписанием.</p>
                <button id="open-schedule-btn" class="premium-btn" style="margin-top: 6px;">
                    <i class="fa-regular fa-calendar-days" style="color:var(--accent-neon);"></i> <span>Расписание стримов</span>
                </button>
            </div>`;
        document.getElementById('open-schedule-btn').addEventListener('click', () => {
            if(dom.scheduleModal) dom.scheduleModal.classList.remove('hidden');
        });
        return;
    }

    if (!challengeData || !challengeData.description) {
        dom.challengeContainer.innerHTML = `
            <div class="quest-card">
                ${streamBadgeHtml} 
                <div class="quest-icon"><i class="fa-solid fa-dice"></i></div>
                <h2 class="quest-title">Случайный челлендж</h2>
                <p class="quest-subtitle">Испытай удачу! Получи случайное испытание и забери награду.</p>
                <button id="get-challenge-btn" class="premium-btn active-state" style="margin-top: 6px;">
                    <i class="fa-solid fa-play"></i> <span>Получить челлендж</span>
                </button>
            </div>`;
        return;
    }

    const challenge = challengeData; 
    const currentProgress = challenge.progress_value || 0;
    const target = challenge.target_value || 1;
    const percent = target > 0 ? Math.min(100, (currentProgress / target) * 100) : 0;
    const canClaim = currentProgress >= target && !challenge.claimed_at;
    
    let claimButtonHtml = '';
    if (challenge.claimed_at) {
        claimButtonHtml = `
            <button class="premium-btn" disabled>
                <i class="fa-solid fa-check" style="color:var(--accent-green);"></i> <span>Выполнено</span>
            </button>
        `;
    } else {
        claimButtonHtml = `
            <button id="claim-challenge-btn" data-challenge-id="${challenge.challenge_id}" class="premium-btn ${canClaim ? 'active-state' : ''}" ${!canClaim ? 'disabled' : ''}>
                <i class="fa-solid fa-gift"></i> <span>Забрать награду</span>
            </button>
        `;
    }

    const isTwitchChallenge = challenge.condition_type && challenge.condition_type.includes('twitch');
    const twitchNotice = isTwitchChallenge ? createTwitchNoticeHtml() : '';
    let progressTextContent = `${currentProgress} / ${target}`;
    const conditionType = challenge.condition_type || '';
    if (conditionType.includes('twitch_uptime')) {
        progressTextContent = `${currentProgress} / ${target} мин.`;
    } else if (conditionType.includes('twitch_messages')) {
        progressTextContent = `💬 ${currentProgress} / ${target}`;
    } else if (conditionType.includes('telegram_messages')) {
        progressTextContent = `✉️ ${currentProgress} / ${target}`;
    }
    
    dom.challengeContainer.innerHTML = `
        <div class="quest-card">
            ${streamBadgeHtml} 
            <div class="quest-icon"><i class="fa-solid fa-star"></i></div>
            <h2 class="quest-title">${challenge.description || ''}</h2>
            <div id="challenge-timer" class="challenge-timer">...</div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${percent}%;"></div>
                <div class="progress-content">
                    <span class="progress-text">${progressTextContent}</span>
                </div>
            </div>
            ${twitchNotice}
            <div style="margin-top:6px;">${claimButtonHtml}</div>
        </div>`;
    
    if (challenge.expires_at) {
        startCountdown(document.getElementById('challenge-timer'), challenge.expires_at, 'challenge');
    }
}

function renderActiveAutomaticQuest(quest, userData) {
    dom.activeAutomaticQuestContainer.innerHTML = '';
    if (!quest || !userData || !userData.active_quest_id) return;
    
    const activeQuest = allQuests.find(q => q.id === userData.active_quest_id);
    if (!activeQuest) return;

    const iconHtml = (activeQuest.icon_url && activeQuest.icon_url !== "") ? `<img src="${activeQuest.icon_url}" style="width:32px; height:32px; border-radius:8px; margin:0 auto 4px;" alt="Иконка">` : `<div class="quest-icon"><i class="fa-solid fa-bolt"></i></div>`;
    const progress = userData.active_quest_progress || 0;
    const target = activeQuest.target_value || 1;
    const percent = target > 0 ? Math.min(100, (progress / target) * 100) : 0;
    const isCompleted = progress >= target;
    const isTwitchQuest = activeQuest.quest_type && activeQuest.quest_type.includes('twitch');
    const twitchNotice = isTwitchQuest ? createTwitchNoticeHtml() : '';
    
    let buttonHtml = '';
    
    if (isCompleted) {
        buttonHtml = `<button class="premium-btn active-state" data-quest-id="${activeQuest.id}"><i class="fa-solid fa-gift"></i> <span>Забрать</span></button>`;
    } else {
        const lastCancel = userData.last_quest_cancel_at;
        let cancelBtnDisabled = false;
        let cooldownEndTime = null;
        
        if (lastCancel) {
            const lastCancelDate = new Date(lastCancel);
            const now = new Date();
            const diffHours = (now - lastCancelDate) / 3600000;
            if (diffHours < 24) {
                cancelBtnDisabled = true;
                cooldownEndTime = new Date(lastCancelDate.getTime() + 24 * 60 * 60 * 1000);
            }
        }

        const freeCancelBtn = `<button id="cancel-quest-btn" class="cancel-quest-button" ${cancelBtnDisabled ? 'disabled' : ''}>Отменить бесплатно</button>`;
        
        let paidCancelBtn = '';
        if (cancelBtnDisabled) {
            const cost = userData.next_cancel_cost || 5; 
            paidCancelBtn = `
                <button id="paid-cancel-quest-btn" data-cost="${cost}" class="cancel-quest-button" style="margin-top: 6px; color: var(--accent-neon); border-color: rgba(255, 215, 0, 0.3);">
                    <i class="fa-solid fa-ticket"></i> Отменить за ${cost} билетов
                </button>
            `;
        }

        buttonHtml = `
            <div style="display: flex; flex-direction: column; width: 100%;">
                ${freeCancelBtn}
                ${paidCancelBtn}
            </div>
        `;

        if (cancelBtnDisabled) {
            setTimeout(() => {
                const btn = document.getElementById('cancel-quest-btn');
                const paidBtn = document.getElementById('paid-cancel-quest-btn');
                if (btn) {
                     startCountdown(btn, cooldownEndTime, 'quest_cancel', () => {
                        btn.disabled = false;
                        btn.textContent = 'Отменить бесплатно';
                        if(paidBtn) paidBtn.style.display = 'none'; 
                    });
                }
            }, 0);
        }
    }

    const currentProgress = Math.min(progress, target);
    let progressTextContent = `${currentProgress} / ${target}`;
    const questType = activeQuest.quest_type || '';
    
    if (questType.includes('twitch_uptime')) progressTextContent = `${currentProgress} / ${target} мин.`;
    else if (questType.includes('twitch_messages')) progressTextContent = `💬 ${currentProgress} / ${target}`;
    else if (questType.includes('telegram_messages')) progressTextContent = `✉️ ${currentProgress} / ${target}`;
    
    const questEndDate = userData.active_quest_end_date;
    const timerHtml = questEndDate ? `<div id="quest-timer-${activeQuest.id}" class="challenge-timer" style="margin-top:6px;">...</div>` : '';
    
    dom.activeAutomaticQuestContainer.innerHTML = `
        <div class="quest-card">
            ${!isCompleted ? '<div class="active-quest-indicator">Выполняется</div>' : ''}
            <div class="quest-content-wrapper">
                ${iconHtml}
                <h2 class="quest-title">${activeQuest.title || ''}</h2>
                <p class="quest-subtitle">${activeQuest.description || ''}</p>
                ${timerHtml} 
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${percent}%;"></div>
                    <div class="progress-content"><span class="progress-text">${progressTextContent}</span></div>
                </div>
                ${twitchNotice}
            </div>
            <div style="margin-top:6px;">${buttonHtml}</div>
        </div>`;
        
    if (questEndDate) {
        setTimeout(() => {
             const timerElement = document.getElementById(`quest-timer-${activeQuest.id}`);
             if (timerElement) startCountdown(timerElement, questEndDate, `quest_${activeQuest.id}`);
        }, 0); 
    }
    
    dom.questChooseBtn.classList.add('hidden');
    dom.questChooseContainer.classList.add('hidden');
}

function renderManualQuests(questsData) {
    const container = document.getElementById('manual-quests-list');
    if (!container) return;
    container.innerHTML = ''; 

    let quests = [];
    if (Array.isArray(questsData)) {
        quests = questsData;
    } else if (questsData && Array.isArray(questsData.quests)) {
        quests = questsData.quests;
    } else if (questsData && Array.isArray(questsData.data)) {
        quests = questsData.data;
    }

    if (!quests || quests.length === 0) {
        container.innerHTML = `<p style="text-align: center; font-size: 11px; color: var(--text-color-muted); padding:20px 0;">Нет доступных заданий для проверки.</p>`;
        return;
    }

    const groupedQuests = new Map();
    quests.forEach(quest => {
        const categoryName = quest.quest_categories ? quest.quest_categories.name : 'Разное';
        if (!groupedQuests.has(categoryName)) groupedQuests.set(categoryName, []);
        groupedQuests.get(categoryName).push(quest);
    });

    groupedQuests.forEach((questsInCategory, categoryName) => {
        const questsHtml = questsInCategory.map(quest => {
            const iconHtml = (quest.icon_url && quest.icon_url !== "") ? `<img src="${escapeHTML(quest.icon_url)}" style="width:32px; height:32px; border-radius:8px; margin:0 auto 4px;" alt="Иконка">` : `<div class="quest-icon"><i class="fa-solid fa-user-check"></i></div>`;
            const actionLinkHtml = (quest.action_url && quest.action_url !== "")
                ? `<a href="${escapeHTML(quest.action_url)}" target="_blank" rel="noopener noreferrer" class="action-link-btn">Перейти</a>`
                : '';
            const submitButtonText = (quest.action_url && quest.action_url !== "") ? 'Отправить' : 'Выполнить';
            
            return `
                <div class="quest-card" style="margin-bottom:0;">
                    <div style="flex-grow: 1;">
                        ${iconHtml}
                        <h2 class="quest-title">${escapeHTML(quest.title || '')}</h2>
                        <p class="quest-subtitle">${escapeHTML(quest.description || '')}</p>
                        <p class="quest-subtitle" style="margin-top:6px; color:var(--accent-neon); font-weight:800;">Награда: +${quest.reward_amount || ''} <i class="fa-solid fa-coins"></i></p>
                    </div>
                    <div class="manual-quest-actions">
                        ${actionLinkHtml}
                        <button class="perform-quest-button" data-id="${quest.id}" data-title="${escapeHTML(quest.title)}">${submitButtonText}</button>
                    </div>
                </div>
            `;
        }).join('');

        const accordionHtml = `
            <details class="quest-category-accordion">
                <summary class="quest-category-header">${escapeHTML(categoryName)}</summary>
                <div class="quest-category-body">
                    ${questsHtml}
                </div>
            </details>
        `;
        container.insertAdjacentHTML('beforeend', accordionHtml);
    });
}

// ==========================================
// 5. ОСНОВНАЯ ЛОГИКА
// ==========================================

async function refreshDataSilently() {
    try {
        const hbData = await makeApiRequest("/api/v1/user/heartbeat", {}, 'POST', true);
        if (hbData) {
            if (hbData.is_active === false) return;
            if (hbData.tickets !== undefined) {
                userData.tickets = hbData.tickets; 
                const ticketEl = document.getElementById('ticketStats');
                if (ticketEl) ticketEl.textContent = hbData.tickets;
            }
            
            if (hbData.quest_id) {
                userData.active_quest_id = hbData.quest_id;
                userData.active_quest_progress = hbData.quest_progress;
                const activeQuest = allQuests.find(q => q.id === hbData.quest_id);
                if (activeQuest) {
                    const target = activeQuest.target_value || 1;
                    const progress = hbData.quest_progress;
                    
                    const activeQuestContainer = document.getElementById('active-automatic-quest-container');
                    if (activeQuestContainer) {
                        const fill = activeQuestContainer.querySelector('.progress-fill');
                        const textSpan = activeQuestContainer.querySelector('.progress-text');
                        const claimBtn = activeQuestContainer.querySelector('.claim-reward-button');

                        if (fill && textSpan) {
                            let prefix = "";
                            if (activeQuest.quest_type && activeQuest.quest_type.includes('twitch_messages')) prefix = "💬 ";
                            else if (activeQuest.quest_type && activeQuest.quest_type.includes('telegram_messages')) prefix = "✉️ ";
                            const suffix = (activeQuest.quest_type && activeQuest.quest_type.includes('uptime')) ? " мин." : "";

                            textSpan.textContent = `${prefix}${progress} / ${target}${suffix}`;
                            const percent = Math.min(100, (progress / target) * 100);
                            fill.style.width = `${percent}%`;

                            if (progress >= target && !claimBtn) {
                                renderActiveAutomaticQuest(activeQuest, userData);
                            }
                        }
                    }
                }
            }

            if (hbData.has_active_challenge) {
                if (!userData.challenge) userData.challenge = {};
                userData.challenge.progress_value = hbData.challenge_progress;
                userData.challenge.target_value = hbData.challenge_target;

                const challengeContainer = document.getElementById('challenge-container');
                if (challengeContainer) {
                    const fill = challengeContainer.querySelector('.progress-fill');
                    const textSpan = challengeContainer.querySelector('.progress-text');
                    const claimBtn = challengeContainer.querySelector('#claim-challenge-btn');

                    if (fill && textSpan) {
                        const progress = hbData.challenge_progress;
                        const target = hbData.challenge_target;
                        let prefix = "";
                        const currentText = textSpan.textContent;
                        if (currentText.includes("💬")) prefix = "💬 ";
                        if (currentText.includes("✉️")) prefix = "✉️ ";
                        const suffix = currentText.includes("мин.") ? " мин." : "";

                        textSpan.textContent = `${prefix}${progress} / ${target}${suffix}`;
                        const percent = Math.min(100, (progress / target) * 100);
                        fill.style.width = `${percent}%`;

                        if (progress >= target && (!claimBtn || claimBtn.disabled)) {
                            renderChallenge(userData.challenge, false);
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.error("Ошибка фонового обновления:", e);
    }
}

async function startChallengeRoulette() {
    const getChallengeBtn = document.getElementById('get-challenge-btn');
    if(getChallengeBtn) getChallengeBtn.disabled = true;
    dom.loaderOverlay.classList.remove('hidden'); 
    try {
        const available = await makeApiRequest('/api/v1/user/challenge/available');
        const assignedChallenge = await makeApiRequest('/api/v1/user/challenge');
        dom.loaderOverlay.classList.add('hidden'); 
        if (assignedChallenge && assignedChallenge.cooldown_until) {
            renderChallenge(assignedChallenge, false);
            return;
        }
        if (!available || available.length === 0 || !assignedChallenge || !assignedChallenge.challenges) {
            window.customAlert('Нет доступных челленджей или произошла ошибка.');
            if(getChallengeBtn) getChallengeBtn.disabled = false;
            return;
        }
        
        const overlay = document.createElement('div');
        overlay.className = 'prompt-overlay';
        overlay.innerHTML = `<div style="width: 90%; max-width: 360px; height: 160px; background: rgba(14, 14, 18, 0.96); border: 1px solid var(--glass-border); border-radius: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; overflow: hidden;"><div id="roulette-inner" style="position: absolute; width: 100%; top: 0;"></div><div style="position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 100%; height: 50px; border-top: 1.5px solid var(--accent-neon); border-bottom: 1.5px solid var(--accent-neon); box-sizing: border-box; z-index: 1;"></div></div>`;
        document.body.appendChild(overlay);
        const inner = overlay.querySelector('#roulette-inner');
        const itemHeight = 50;
        let rouletteItems = [];
        for (let i = 0; i < 30; i++) rouletteItems.push(...available.sort(() => Math.random() - 0.5));
        rouletteItems.push(assignedChallenge.challenges);
        inner.innerHTML = rouletteItems.map(item => `<div data-id="${item.id}" style="height: ${itemHeight}px; display: flex; flex-direction: column; align-items: center; justify-content: center;"><div style="font-size: 13px; font-weight: 800; color:#fff;">${item.description}</div><div style="font-size: 10px; color: var(--accent-neon); font-weight:700;">Награда: ${item.reward_amount} ⭐</div></div>`).join('');
        await new Promise(resolve => setTimeout(resolve, 100));
        const winnerElement = Array.from(inner.querySelectorAll(`[data-id="${assignedChallenge.challenge_id}"]`)).pop();
        if (winnerElement) {
            const centeredPosition = winnerElement.offsetTop - (inner.parentElement.clientHeight / 2) + (itemHeight / 2);
            inner.style.transition = 'transform 6s cubic-bezier(0.2, 0.8, 0.2, 1)';
            inner.style.transform = `translateY(-${centeredPosition}px)`;
            setTimeout(() => {
                overlay.remove();
                localStorage.removeItem('quests_cache_v1');
                window.location.reload();
            }, 7000);
        }
    } catch (e) {
        dom.loaderOverlay.classList.add('hidden');
        if(getChallengeBtn) getChallengeBtn.disabled = false;
    }
}

async function openQuestSelectionModal() {
    const currentTheme = document.body.getAttribute('data-theme');
    const isTelegram = currentTheme === 'telegram';
    const filterPrefix = isTelegram ? 'automatic_telegram' : 'automatic_twitch';

    const quests = allQuests
        .filter(q => q.quest_type && q.quest_type.startsWith(filterPrefix) && !q.is_completed)
        .sort((a, b) => (b.reward_amount || 0) - (a.reward_amount || 0));

    if (!quests || quests.length === 0) {
        console.log(`📭 Нет доступных квестов (${filterPrefix}).`);
        return; 
    }

    const modalTitle = isTelegram ? 'Telegram Испытания' : 'Twitch Испытания';
    const accentColor = isTelegram ? '#0a84ff' : '#9146ff';
    const iconClass = isTelegram ? 'fa-brands fa-telegram' : 'fa-brands fa-twitch';

    openUniversalModal(modalTitle);
    
    const container = dom.modalContainer;
    container.classList.add('grid-mode'); 
    container.innerHTML = ''; 
    
    quests.forEach((quest, index) => {
        const el = document.createElement('div');
        el.className = `quest-card`;
        
        const rewardText = userData.quest_rewards_enabled 
            ? `+${quest.reward_amount} <i class="fa-solid fa-coins"></i>`
            : `Ивент`;

        el.innerHTML = `
            <div class="quest-icon" style="color: ${accentColor}; font-size: 26px;">
                <i class="${iconClass}"></i>
            </div>
            
            <div class="quest-title">${quest.title}</div>
            <div style="font-size: 11px; font-weight: 800; color: var(--accent-neon);">${rewardText}</div>
            
            <button class="premium-btn active-state" style="margin-top:auto;" id="btn-start-${quest.id}">
                Начать
            </button>
        `;

        const btn = el.querySelector(`#btn-start-${quest.id}`);
        btn.addEventListener('click', async () => {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            try {
                await makeApiRequest("/api/v1/quests/start", { quest_id: quest.id });
                closeUniversalModal();
                localStorage.removeItem('quests_cache_v1');
                window.location.reload(); 
            } catch(e) {
                window.customAlert(e.message, 'Ошибка', 'error');
                btn.disabled = false;
                btn.innerText = 'Начать';
            }
        });
        
        container.appendChild(el);
    });
}

function hideQuestRoulette() {
    const container = dom.questChooseContainer;
    Array.from(container.children).forEach(card => card.classList.add('fade-out'));
    setTimeout(() => {
        container.innerHTML = '';
        container.classList.add('hidden');
        dom.questChooseBtn.disabled = false;
    }, 500);
}

// ==========================================
// 6. ИНИЦИАЛИЗАЦИЯ И ТЕМАТИКА
// ==========================================

function setPlatformTheme(platform) {
    document.body.setAttribute('data-theme', platform);
    
    const questButton = dom.questChooseBtn;
    if (platform === 'telegram') {
        questButton.innerHTML = '<i class="fa-brands fa-telegram"></i> TELEGRAM ИСПЫТАНИЯ';
        dom.challengeContainer.classList.add('hidden');
    } else {
        questButton.innerHTML = '<i class="fa-brands fa-twitch"></i> TWITCH ИСПЫТАНИЯ';
        dom.challengeContainer.classList.remove('hidden');
    }

    questsForRoulette = allQuests.filter(q => 
        q.quest_type && q.quest_type.startsWith(`automatic_${platform}`) && !q.is_completed
    );

    const activeQuest = allQuests.find(q => q.id === userData.active_quest_id);
    let isActiveQuestVisible = false;

    if (activeQuest) {
        const activeType = activeQuest.quest_type || '';
        if (activeType.includes(platform)) {
            isActiveQuestVisible = true;
        }
    }

    if (isActiveQuestVisible) {
        renderActiveAutomaticQuest(activeQuest, userData);
        dom.activeAutomaticQuestContainer.classList.remove('hidden');
        dom.questChooseBtn.classList.add('hidden');
        dom.questChooseContainer.classList.add('hidden');
    } else {
        dom.activeAutomaticQuestContainer.classList.add('hidden'); 
        
        if (questsForRoulette.length > 0) {
            dom.questChooseBtn.classList.remove('hidden');
            dom.questChooseBtn.disabled = false;
            dom.questChooseContainer.classList.add('hidden'); 
        } else {
             if (platform === 'manual') {
                 dom.questChooseBtn.classList.add('hidden');
             } else {
                 dom.questChooseBtn.classList.remove('hidden');
                 dom.questChooseBtn.disabled = true;
                 dom.questChooseBtn.innerHTML = '<i class="fa-solid fa-clock"></i> Задания недоступны';
             }
        }
    }
}

function safeSwitchTab(platform) {
    const currentTheme = document.body.getAttribute('data-theme');
    if (currentTheme === platform) return;

    const switchEl = document.getElementById(`view-${platform}`);
    if (switchEl) switchEl.checked = true;
    setPlatformTheme(platform);
}

function handleGlobalBack() {
    let closedAny = false;

    const injectedPopups = document.querySelectorAll('.popup-overlay, #custom-app-alert');
    injectedPopups.forEach(p => {
        if (p.style.opacity !== '0' && p.style.display !== 'none') {
            p.remove();
            closedAny = true;
        }
    });

    if (dom.modalOverlay && dom.modalOverlay.classList.contains('active')) {
        closeUniversalModal();
        closedAny = true;
    }

    const staticModals = [
        dom.promptOverlay, dom.infoModalOverlay, dom.scheduleModal, 
        dom.rewardClaimedOverlay, dom.ticketsClaimedOverlay
    ];
    staticModals.forEach(m => {
        if (m && !m.classList.contains('hidden')) {
            m.classList.add('hidden');
            closedAny = true;
        }
    });

    if (closedAny) return;

    if (window.history.length > 1 && document.referrer) {
        window.history.back();
    } else {
        window.location.href = '/menu';
    }
}

function setupGestures() {
    let touchStartX = 0;
    let touchStartY = 0;
    const SWIPE_THRESHOLD = 80;

    document.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].screenX;
        const touchEndY = e.changedTouches[0].screenY;

        const diffX = touchEndX - touchStartX;
        const diffY = touchEndY - touchStartY;

        if (document.querySelector('.popup-overlay, .prompt-overlay:not(.hidden), .modal-overlay.active, .modal-overlay.visible')) {
            return; 
        }

        if (Math.abs(diffX) > Math.abs(diffY)) {
            if (diffX < -SWIPE_THRESHOLD) {
                safeSwitchTab('telegram');
            } else if (diffX > SWIPE_THRESHOLD) {
                safeSwitchTab('twitch');
            }
        } 
        else if (Math.abs(diffY) > Math.abs(diffX)) {
            if (diffY > SWIPE_THRESHOLD && dom.mainContent.scrollTop <= 10) {
                safeSwitchTab('manual');
            }
        }
    }, { passive: true });
}

function initUnifiedSwitcher() {
    const radios = document.querySelectorAll('input[name="view"]');
    radios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.checked) {
                const view = e.target.value;

                if (!dom.sectionAuto || !dom.sectionManual) return;

                if (view === 'manual') {
                    dom.sectionAuto.classList.add('hidden');
                    dom.sectionManual.classList.remove('hidden');
                    setPlatformTheme('manual'); 
                } else {
                    dom.sectionAuto.classList.remove('hidden');
                    dom.sectionManual.classList.add('hidden');
                    setPlatformTheme(view);
                }
                try { window.Telegram?.WebApp?.HapticFeedback?.selectionChanged(); } catch (err) {}
            }
        });
    });
}

// ==========================================
// 🎓 ИНТЕРАКТИВНОЕ ОБУЧЕНИЕ (ТУР ПО ЗАДАНИЯМ)
// ==========================================
let currentQuestTourStep = 0;

const questTourSteps = [
    {
        title: "Центр заданий",
        text: "Выполняй задания и челленджи активности, чтобы накапливать <span class='gold'>билеты 🎟️</span> для розыгрышей скинов и аукционов!",
        img: "/static/grind_intro.png",
        targetSelector: ".complex-switch-wrapper"
    },
    {
        title: "Матрица активности",
        text: "Вверху страницы отслеживается твой прогресс доверия: общайся в <b>Telegram</b> и на стримах <b>Twitch</b>, чтобы забрать секретный суперприз!",
        img: "/static/grind_intro.png",
        targetSelector: "#matrix-quest-tracker"
    },
    {
        title: "Стрим-челленджи",
        text: "Во время прямого эфира бери <b>случайные челленджи</b>. Задания проверяются автоматически в прямом эфире стрима!",
        img: "/static/grind_tasks.png",
        targetSelector: "#challenge-container"
    },
    {
        title: "Ручная проверка",
        text: "Во вкладке <b>«Ручная проверка»</b> выполняй задания сообщества, отправляй пруфы и получай дополнительные монеты на баланс!",
        img: "/static/grind_shop.png",
        targetSelector: ".complex-switch-wrapper"
    }
];

function injectTourMarkup() {
    if (document.getElementById('tour-backdrop')) return;

    const tourHtml = `
        <div id="tour-backdrop" class="tour-backdrop"></div>
        <div id="tour-card" class="tour-card" style="display: none;">
            <div class="tour-card-header">
                <span class="tour-step-badge" id="tour-step-badge">Шаг 1 из 4</span>
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
    `;
    document.body.insertAdjacentHTML('beforeend', tourHtml);
}

window.startQuestTour = function() {
    injectTourMarkup();
    currentQuestTourStep = 0;
    document.body.classList.add('tour-mode');
    document.getElementById('tour-card').style.display = 'flex';
    renderCurrentQuestTourStep();
    try { window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success'); } catch (e) {}
};

window.closeQuestTour = function() {
    document.body.classList.remove('tour-mode');
    const card = document.getElementById('tour-card');
    if (card) card.style.display = 'none';
    document.querySelectorAll('.tour-target-active').forEach(el => el.classList.remove('tour-target-active'));
    try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light'); } catch (e) {}
};

window.nextQuestTourStep = function() {
    if (currentQuestTourStep < questTourSteps.length - 1) {
        currentQuestTourStep++;
        renderCurrentQuestTourStep();
        try { window.Telegram?.WebApp?.HapticFeedback?.selectionChanged(); } catch (e) {}
    } else {
        closeQuestTour();
    }
};

window.prevQuestTourStep = function() {
    if (currentQuestTourStep > 0) {
        currentQuestTourStep--;
        renderCurrentQuestTourStep();
        try { window.Telegram?.WebApp?.HapticFeedback?.selectionChanged(); } catch (e) {}
    }
};

function renderCurrentQuestTourStep() {
    const step = questTourSteps[currentQuestTourStep];
    document.querySelectorAll('.tour-target-active').forEach(el => el.classList.remove('tour-target-active'));

    document.getElementById('tour-step-badge').textContent = `Шаг ${currentQuestTourStep + 1} из ${questTourSteps.length}`;
    document.getElementById('tour-title').textContent = step.title;
    document.getElementById('tour-text').innerHTML = step.text;

    const stageEl = document.getElementById('tour-img-stage');
    const imgEl = document.getElementById('tour-img');

    if (step.img) {
        stageEl.style.display = 'flex';
        imgEl.src = step.img;
    } else {
        stageEl.style.display = 'none';
    }

    const prevBtn = document.getElementById('tour-prev-btn');
    const nextBtn = document.getElementById('tour-next-btn');

    prevBtn.style.visibility = currentQuestTourStep === 0 ? 'hidden' : 'visible';
    nextBtn.textContent = currentQuestTourStep === questTourSteps.length - 1 ? 'ПОНЯТНО 👍' : 'ДАЛЕЕ ➔';

    const target = document.querySelector(step.targetSelector);
    if (target) {
        target.classList.add('tour-target-active');
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// ==========================================
// 7. СТАРТ И ОСНОВНОЙ ВЫЗОВ
// ==========================================

async function main() {
    localStorage.removeItem('last_active_tab'); 

    if (window.Telegram && !window.Telegram.WebApp.initData) {
        if (dom.loaderOverlay) dom.loaderOverlay.classList.add('hidden');
        return; 
    }

    const cachedRaw = localStorage.getItem('quests_cache_v1');
    let isRenderedFromCache = false;

    if (cachedRaw) {
        try {
            const cachedData = JSON.parse(cachedRaw);
            if (cachedData && cachedData.user) {
                userData = cachedData.user;
                allQuests = cachedData.quests || [];
                
                if (dom.fullName) {
                    dom.fullName.textContent = userData.full_name || "Гость";
                }
                
                if (document.getElementById('ticketStats')) {
                    document.getElementById('ticketStats').textContent = userData.tickets || 0;
                }

                initUnifiedSwitcher();
                
                const tempTab = localStorage.getItem('temp_return_tab');
                let defaultView = tempTab || (userData.is_stream_online ? 'twitch' : 'telegram');
                if (tempTab) localStorage.removeItem('temp_return_tab');

                const switchEl = document.getElementById(`view-${defaultView}`);
                if (switchEl) {
                    switchEl.checked = true;
                    setPlatformTheme(defaultView);
                    dom.sectionAuto.classList.remove('hidden');
                    dom.sectionManual.classList.add('hidden');
                }

                const isTwitchLinkedCache = !!(userData.twitch_id || userData.twitch_login || userData.twitch_access_token);
                if (userData.challenge) renderChallenge(userData.challenge, !isTwitchLinkedCache);
                else renderChallenge({ cooldown_until: userData.challenge_cooldown_until }, !isTwitchLinkedCache);
                
                if (dom.loaderOverlay) dom.loaderOverlay.classList.add('hidden');
                dom.mainContent.style.opacity = 1;
                isRenderedFromCache = true;
            }
        } catch (e) {
            console.error("Cache parsing error", e);
        }
    }

    if (!isRenderedFromCache && dom.loaderOverlay) {
        dom.loaderOverlay.classList.remove('hidden');
        updateLoading(10);
    }
    
    try {
        let bootstrapData = window.bootstrapPromise ? await window.bootstrapPromise : await makeApiRequest("/api/v1/bootstrap", {}, 'POST', true);
        updateLoading(50);

        if (bootstrapData) {
            localStorage.setItem('quests_cache_v1', JSON.stringify(bootstrapData));

            userData = bootstrapData.user;
            allQuests = bootstrapData.quests;
            
            if (bootstrapData.matrix_quest !== undefined) {
                renderMatrixTracker(bootstrapData.matrix_quest, userData);
            }
            
            if (userData) {
                if (dom.fullName) dom.fullName.textContent = userData.full_name || "Гость";
                if (document.getElementById('ticketStats')) {
                    document.getElementById('ticketStats').textContent = userData.tickets || 0;
                }
            }

            initUnifiedSwitcher(); 

            let defaultView = userData.is_stream_online ? 'twitch' : 'telegram';
            if (isRenderedFromCache) {
                 const currentChecked = document.querySelector('input[name="view"]:checked');
                 if (currentChecked) defaultView = currentChecked.value;
            } else {
                 const switchEl = document.getElementById(`view-${defaultView}`);
                 if (switchEl) switchEl.checked = true;
            }
            
            setPlatformTheme(defaultView);

            const isTwitchLinkedNet = !!(userData.twitch_id || userData.twitch_login || userData.twitch_access_token);
            if (userData.challenge) renderChallenge(userData.challenge, !isTwitchLinkedNet);
            else renderChallenge({ cooldown_until: userData.challenge_cooldown_until }, !isTwitchLinkedNet);

            updateLoading(70);
            
            try {
                const manualQuests = await makeApiRequest("/api/v1/quests/manual", {}, 'POST', true);
                renderManualQuests(manualQuests);
            } catch (e) {
                const fallbackQuests = allQuests.filter(q => q.quest_type === 'manual_check');
                renderManualQuests(fallbackQuests);
            }
        }

        if (dom.loaderOverlay) dom.loaderOverlay.classList.add('hidden');
        dom.mainContent.style.opacity = 1;

    } catch (e) {
        console.error("Ошибка в main:", e);
        if (dom.loaderOverlay) dom.loaderOverlay.classList.add('hidden');
    }
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
    if (window.Telegram && Telegram.WebApp.BackButton) {
        Telegram.WebApp.BackButton.show();
        Telegram.WebApp.BackButton.offClick(handleGlobalBack);
        Telegram.WebApp.BackButton.onClick(handleGlobalBack);
    }
    setupGestures();

    // Запуск кнопки вопроса (тур-гида), если она есть рядом с заголовком
    const helpBtn = document.querySelector('.tour-help-btn');
    if (helpBtn) {
        helpBtn.addEventListener('click', () => window.startQuestTour());
    }

    if(dom.promptCancel) dom.promptCancel.addEventListener('click', () => dom.promptOverlay.classList.add('hidden'));
    
    if(dom.promptConfirm) dom.promptConfirm.addEventListener('click', async () => {
        const text = dom.promptInput.value.trim();
        if (!text) return;
        const questIdForSubmission = currentQuestId;
        dom.promptOverlay.classList.add('hidden');
        await makeApiRequest(`/api/v1/quests/${questIdForSubmission}/submit`, { submittedData: text });
        window.customAlert('Ваша заявка принята и отправлена на проверку!', 'Успешно');
    });
    
    if(dom.rewardCloseBtn) dom.rewardCloseBtn.addEventListener('click', () => { dom.rewardClaimedOverlay.classList.add('hidden'); main(); });
    if(dom.ticketsClaimCloseBtn) dom.ticketsClaimCloseBtn.addEventListener('click', () => { dom.ticketsClaimedOverlay.classList.add('hidden'); main(); });
    if(dom.infoQuestionIcon) dom.infoQuestionIcon.addEventListener('click', () => dom.infoModalOverlay.classList.remove('hidden'));
    if(dom.infoModalCloseBtn) dom.infoModalCloseBtn.addEventListener('click', () => dom.infoModalOverlay.classList.add('hidden'));
    
    if (dom.scheduleCloseBtn && dom.scheduleModal) {
        dom.scheduleCloseBtn.addEventListener('click', () => { dom.scheduleModal.classList.add('hidden'); });
        dom.scheduleModal.addEventListener('click', (e) => {
            if (e.target === dom.scheduleModal) dom.scheduleModal.classList.add('hidden');
        });
    }

    if (dom.questChooseBtn) {
        dom.questChooseBtn.addEventListener("click", () => {
            if (dom.questChooseContainer.classList.contains('hidden')) {
                openQuestSelectionModal();
            } else {
                hideQuestRoulette();
            }
        });
    }
    
    document.body.addEventListener('click', async (event) => {
        const target = event.target.closest('button');
        if (!target) return;

        if (target.id === 'get-challenge-btn') {
            await startChallengeRoulette();

        } else if (target.id === 'claim-challenge-btn') {
            target.disabled = true;
            target.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            
            if(userData.challenge) userData.challenge.claimed_at = new Date().toISOString(); 
            
            try {
                const challengeId = target.dataset.challengeId; 
                const result = await makeApiRequest(`/api/v1/challenges/${challengeId}/claim`, {}, 'POST');
                
                if (result.success) {
                    target.innerHTML = '<i class="fa-solid fa-check"></i> <span>Выполнено</span>';
                    target.disabled = true;

                    if (result.promocode) {
                        dom.rewardClaimedOverlay.classList.remove('hidden'); 
                    } else {
                        await main();
                    }
                } else {
                    window.customAlert(result.message || "Не удалось забрать награду");
                    target.disabled = false;
                    target.innerHTML = '<i class="fa-solid fa-gift"></i> <span>Забрать награду</span>';
                    if(userData.challenge) delete userData.challenge.claimed_at;
                }
            } catch (e) {
                target.disabled = false;
                target.innerHTML = '<i class="fa-solid fa-gift"></i> <span>Забрать награду</span>';
                if(userData.challenge) delete userData.challenge.claimed_at;
            }

        } else if (target.classList.contains('claim-reward-button') && target.dataset.questId) {
            const questId = target.dataset.questId;
            target.disabled = true;
            target.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            try {
                const result = await makeApiRequest('/api/v1/promocode', { quest_id: parseInt(questId) });
                if (result && result.promocode) {
                    dom.rewardClaimedOverlay.classList.remove('hidden');
                } else if (result && result.tickets_only) {
                    const ticketStatsEl = document.getElementById('ticketStats');
                    if (ticketStatsEl) {
                        const current = parseInt(ticketStatsEl.textContent, 10);
                        ticketStatsEl.textContent = current + (result.tickets_awarded || 0);
                    }
                    dom.ticketsClaimedOverlay.classList.remove('hidden');
                } else {
                    await main();
                }
            } catch (e) {
                target.disabled = false;
                target.innerHTML = '<i class="fa-solid fa-gift"></i> <span>Забрать</span>';
            }

        } else if (target.classList.contains('perform-quest-button') && target.dataset.id) {
            currentQuestId = target.dataset.id;
            dom.promptTitle.textContent = target.dataset.title;
            dom.promptInput.value = '';
            dom.promptOverlay.classList.remove('hidden');
            dom.promptInput.focus();

        } else if (target.id === 'check-challenge-progress-btn' || target.id === 'complete-expired-quest-btn') {
            target.disabled = true;
            target.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            
            const currentTab = document.querySelector('input[name="view"]:checked')?.value || 'twitch';
            localStorage.setItem('temp_return_tab', currentTab);
            localStorage.removeItem('quests_cache_v1');

            try {
                if (target.id === 'check-challenge-progress-btn') await makeApiRequest("/api/v1/user/challenge/close_expired");
                else await makeApiRequest('/api/v1/quests/close_expired');
                window.location.reload();
            } catch (e) {
                window.location.reload();
            }

        } else if (target.id === 'cancel-quest-btn') {
            event.preventDefault();
            if (confirm("Вы уверены, что хотите отменить это задание?")) {
                try {
                    const btn = document.getElementById('cancel-quest-btn');
                    if(btn) { btn.disabled = true; btn.innerText = '...'; }

                    await makeApiRequest('/api/v1/quests/cancel');
                    const currentTab = document.querySelector('input[name="view"]:checked')?.value || 'twitch';
                    localStorage.setItem('temp_return_tab', currentTab);
                    localStorage.removeItem('quests_cache_v1');
                    window.location.reload();
                } catch (e) {
                    window.location.reload();
                }
            }
        } else if (target.id === 'paid-cancel-quest-btn') {
            event.preventDefault();
            const cost = parseInt(target.dataset.cost || 5);
            const currentTickets = parseInt(userData.tickets || 0);

            if (currentTickets < cost) {
                window.customAlert(`Недостаточно билетов! Нужно: ${cost}, у вас: ${currentTickets}`);
                return;
            }

            if (confirm(`Списать ${cost} билетов за отмену задания?`)) {
                target.disabled = true;
                target.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                
                try {
                    await makeApiRequest('/api/v1/quests/cancel_paid'); 
                    const currentTab = document.querySelector('input[name="view"]:checked')?.value || 'twitch';
                    localStorage.setItem('temp_return_tab', currentTab);
                    localStorage.removeItem('quests_cache_v1');
                    window.location.reload();
                } catch (e) {
                    target.disabled = false;
                    target.innerHTML = `<i class="fa-solid fa-ticket"></i> Отменить за ${cost} билетов`;
                    window.customAlert(e.message || "Ошибка при отмене");
                }
            }
        }
    });
}

// ==========================================
// 8. ЗАПУСК ПРИЛОЖЕНИЯ
// ==========================================

async function checkMaintenance() {
    try {
        const res = await fetch('/api/v1/bootstrap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData: window.Telegram?.WebApp?.initData || '' })
        });
        if (res.ok) {
            const data = await res.json();
            if (data.maintenance) window.location.href = '/'; 
        }
    } catch (e) {}
}

window.claimMatrixReward = async function() {
    const btn = document.getElementById('matrix-claim-btn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    }

    try {
        const result = await makeApiRequest('/api/v1/matrix/claim', {}, 'POST');

        if (result && result.success) {
            if (window.Telegram?.WebApp?.HapticFeedback) {
                Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            }
            localStorage.removeItem('quests_cache_v1');
            const rewardAmount = result.reward || 10;
            const successText = `Доверие оправдано!<br><span style="color:var(--accent-neon); font-size:14px; margin-top:4px; display:block;">🎁 Выдан Кейс | The Noot-Noot</span>`;
            injectRewardPopup(rewardAmount, successText, true);
        } else {
            window.customAlert(result.message || result.error || "Не удалось забрать приз");
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = 'ЗАБРАТЬ ПРИЗ';
            }
        }
    } catch (e) {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = 'ЗАБРАТЬ ПРИЗ';
        }
    }
};

try {
    if (window.Telegram?.WebApp) {
        Telegram.WebApp.ready();
        Telegram.WebApp.expand();
    }
    checkMaintenance();
    setupEventListeners();
    initPullToRefresh();
    main();
    setInterval(refreshDataSilently, 30000);
} catch (e) {
    if (dom.loaderOverlay) dom.loaderOverlay.classList.add('hidden');
    document.body.innerHTML = `<div style="text-align:center; padding:20px; color:#fff;"><h1>Ошибка запуска</h1><p>${e.message}</p></div>`;
}
