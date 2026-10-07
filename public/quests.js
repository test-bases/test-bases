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

    // === НОВЫЕ ПЕРЕМЕННЫЕ МОДАЛКИ ===
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
// 2. УТИЛИТЫ И API (Глобальные)
// ==========================================

function escapeHTML(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/[&<>"']/g, match => ({'&': '&amp;','<': '&lt;','>': '&gt;','"': '&quot;',"'": '&#39;'})[match]);
}

function updateLoading(percent) {
    if (dom.loadingText) dom.loadingText.textContent = Math.floor(percent) + '%';
    if (dom.loadingBarFill) dom.loadingBarFill.style.width = Math.floor(percent) + '%';
}

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
        
        // Добавляем initData ко всем POST/PUT запросам
        if (method !== 'GET') {
            options.body = JSON.stringify({ ...body, initData: Telegram.WebApp.initData });
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
        if (e.message !== 'Cooldown active' && !isSilent) Telegram.WebApp.showAlert(`Ошибка: ${e.message}`);
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

// === УПРАВЛЕНИЕ КРАСИВЫМ ОКНОМ ===
function openUniversalModal(title, contentHTML = '') {
    dom.modalTitle.textContent = title;
    
    if (contentHTML) {
        dom.modalContainer.innerHTML = contentHTML;
    } else {
        dom.modalContainer.innerHTML = '';
    }

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
// ТРЕКЕР СИНИЙ ПИЛЮЛИ (МАТРИЦА) — В САМОМ ВЕРХУ
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
    
    const twitchAlert = (userData && userData.twitch_id) ? '' : '<div style="color:#ff3b30; font-size:10px; text-align: right; position: relative; top: -15px; padding-right: 16px;"><i class="fa-solid fa-triangle-exclamation"></i> Привяжи Twitch!</div>';

    const isReadyToClaim = tgDone >= 50 && twitchDone >= 200;
    const tgPercent = Math.min(tgDone / 50, 1);
    const twitchPercent = Math.min(twitchDone / 200, 1);
    const totalProgress = (tgPercent + twitchPercent) / 2;

    let questTitle = "ПРОВЕРКА ДОВЕРИЕМ";
    let questIcon = '<i class="fa-solid fa-shield-halved" style="color: #2AABEE; margin-right: 5px;"></i>';

    if (isReadyToClaim) {
        questTitle = "ДОВЕРИЕ ОПРАВДАНО";
        questIcon = '<i class="fa-solid fa-check-double" style="color: #34c759; margin-right: 5px;"></i>';
    } else if (totalProgress >= 0.8) {
        questTitle = "АБСОЛЮТНАЯ ВЕРНОСТЬ";
        questIcon = '<i class="fa-solid fa-bolt" style="color: #FFD700; margin-right: 5px;"></i>';
    } else if (totalProgress >= 0.5) {
        questTitle = "ДОВЕРИЕ РАСТЕТ";
        questIcon = '<i class="fa-solid fa-fire" style="color: #ff9500; margin-right: 5px;"></i>';
    }

    let rightSideHtml = '';

    if (isReadyToClaim) {
        rightSideHtml = `
            <button onclick="claimMatrixReward()" id="matrix-claim-btn" style="background: #34c759; color: #fff; border: none; padding: 6px 14px; border-radius: 8px; font-weight: 900; font-size: 11px; text-transform: uppercase; cursor: pointer; box-shadow: 0 0 15px rgba(52, 199, 89, 0.4); transition: transform 0.1s;">
                ЗАБРАТЬ ПРИЗ
            </button>
        `;
    } else {
        rightSideHtml = `
            <div style="display: flex; gap: 15px; align-items: center;">
                <div style="display: flex; flex-direction: column; align-items: flex-end;">
                    <a href="https://t.me/hatelove_ttv" target="_blank" onclick="if(window.Telegram?.WebApp) { Telegram.WebApp.openTelegramLink('https://t.me/hatelove_ttv'); return false; }" style="font-size: 9px; color: #8e8e93; text-transform: uppercase; font-weight: 700; text-decoration: none;">Telegram</a>
                    <span style="font-size: 13px; font-weight: 900; color: ${tgDone >= 50 ? '#34c759' : '#FFD700'}; text-shadow: 0 2px 4px rgba(0,0,0,0.8);">${tgDone >= 50 ? 50 : tgDone} / 50</span>
                </div>
                <div style="width: 1px; height: 20px; background: rgba(255,255,255,0.1);"></div>
                <div style="display: flex; flex-direction: column; align-items: flex-end;">
                    <a href="https://www.twitch.tv/hatelove_ttv" target="_blank" style="font-size: 9px; color: #8e8e93; text-transform: uppercase; font-weight: 700; text-decoration: none;">Twitch</a>
                    <span style="font-size: 13px; font-weight: 900; color: ${twitchDone >= 200 ? '#34c759' : '#FFD700'}; text-shadow: 0 2px 4px rgba(0,0,0,0.8);">${twitchDone >= 200 ? 200 : twitchDone} / 200</span>
                </div>
            </div>
        `;
    }

    container.innerHTML = `
        <div style="margin: 0 16px; padding: 12px 0; background: transparent; border: none; display: flex; justify-content: space-between; align-items: center;">
            <div style="font-size: 11px; font-weight: 800; color: #fff; text-transform: uppercase; text-shadow: 0 2px 4px rgba(0,0,0,0.8);">
                ${questIcon} ${questTitle}
            </div>
            ${rightSideHtml}
        </div>
        ${twitchAlert}
    `;
}

// === КРАСИВОЕ ОКНО НАГРАДЫ (С ПЕРЕЗАГРУЗКОЙ) ===
function injectRewardPopup(amount, text = "Задание выполнено!", reloadOnClose = false) {
    const existing = document.getElementById('rewardPopup');
    if (existing) existing.remove();

    let topIcon = '<i class="fa-solid fa-ticket"></i>';
    let rewardBlock = '';
    let headerContent = `<h3 style="margin: 0 0 8px; font-size: 22px; font-weight: 800; color: #fff; letter-spacing: 0.5px; line-height: 1.2;">${text}</h3>`;

    if (amount > 0) {
        rewardBlock = `
            <p style="margin: 0 0 24px; color: #8e8e93; font-size: 14px; font-weight: 500;">Награда зачислена на баланс</p>
            <div style="
                background: rgba(255, 215, 0, 0.1); 
                border: 1px solid rgba(255, 215, 0, 0.2); 
                border-radius: 16px; 
                padding: 12px; 
                margin-bottom: 28px;
                display: inline-block;
                min-width: 120px;
            ">
                <span style="font-size: 36px; font-weight: 900; color: #FFD700; text-shadow: 0 2px 10px rgba(255, 215, 0, 0.2);">+${amount}</span>
            </div>
        `;
    } else {
        topIcon = '<i class="fa-solid fa-gift"></i>';
        rewardBlock = `<div style="margin-bottom: 24px;"></div>`; 
    }

    const popupHtml = `
    <div id="rewardPopup" class="popup-overlay" style="display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.85); z-index: 999999; justify-content: center; align-items: center; backdrop-filter: blur(10px); animation: fadeIn 0.3s;">
      
      <div class="popup-content" style="
          background: #1c1c1e; 
          color: #fff; 
          padding: 32px 24px; 
          border-radius: 24px; 
          text-align: center; 
          width: 85%; 
          max-width: 320px; 
          border: 1px solid rgba(255, 255, 255, 0.08); 
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5); 
          transform: scale(0.9); 
          animation: popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
      ">
        
        <div style="font-size: 54px; margin-bottom: 16px; color: #FFD700; filter: drop-shadow(0 0 25px rgba(255, 215, 0, 0.3)); animation: float 3s ease-in-out infinite;">
            ${topIcon}
        </div>
        
        ${headerContent}
        
        ${rewardBlock}
        
        <button id="closeRewardBtn" style="
            width: 100%; 
            background: linear-gradient(135deg, #0088cc 0%, #005f8f 100%); 
            color: #fff; 
            border: none; 
            padding: 16px; 
            border-radius: 16px; 
            font-weight: 700; 
            font-size: 16px; 
            cursor: pointer; 
            box-shadow: 0 8px 20px rgba(0, 136, 204, 0.3); 
            transition: transform 0.1s, box-shadow 0.1s; 
            text-transform: uppercase;
            letter-spacing: 1px;
        ">
            ЗАКРЫТЬ
        </button>

      </div>
    </div>
    <style>
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes popIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      @keyframes float { 0% { transform: translateY(0px) rotate(0deg); } 50% { transform: translateY(-8px) rotate(5deg); } 100% { transform: translateY(0px) rotate(0deg); } }
      #closeRewardBtn:active { transform: scale(0.96); box-shadow: 0 4px 10px rgba(0, 136, 204, 0.2); }
    </style>
    `;

    document.body.insertAdjacentHTML('beforeend', popupHtml);

    if(window.Telegram && Telegram.WebApp.HapticFeedback) {
        Telegram.WebApp.HapticFeedback.notificationOccurred('success');
    }

    document.getElementById('closeRewardBtn').addEventListener('click', () => {
        const popup = document.getElementById('rewardPopup');
        popup.style.opacity = '0';
        setTimeout(() => {
            popup.remove();
            if (reloadOnClose) {
                window.location.reload();
            } else if (typeof main === 'function') {
                main(); 
            }
        }, 200);
    });
}

// ==========================================
// 3. РЕНДЕРИНГ
// ==========================================

function createTwitchNoticeHtml() {
    return `<div class="twitch-update-notice">ℹ️ Прогресс обновляется с задержкой (до 30 мин).</div>`;
}

function renderChallenge(challengeData, isGuest) {
    dom.challengeContainer.innerHTML = '';
    const isOnline = userData.is_stream_online === true;
    
    const streamBadgeHtml = isOnline 
        ? `<div class="stream-status-badge online"><i class="fa-solid fa-circle" style="font-size:6px; vertical-align:middle; margin-right:3px;"></i> СТРИМ ОНЛАЙН</div>`
        : `<div class="stream-status-badge offline">СТРИМ ОФФЛАЙН</div>`;

    if (isGuest) {
        dom.challengeContainer.innerHTML = `
            <div class="quest-card quest-locked">
                ${streamBadgeHtml} <div class="quest-icon"><i class="fa-brands fa-twitch"></i></div>
                <h2 class="quest-title">Случайный челлендж</h2>
                <p class="quest-subtitle">Для доступа к челленджам требуется привязка Twitch-аккаунта.</p>
                <a href="/profile" class="perform-quest-button" style="text-decoration: none;">Привязать Twitch</a>
            </div>`;
        return;
    }
    
    if (challengeData && challengeData.cooldown_until) {
        dom.challengeContainer.innerHTML = `
            <div class="quest-card challenge-card">
                ${streamBadgeHtml} <div class="quest-icon"><i class="fa-solid fa-hourglass-half"></i></div>
                <h2 class="quest-title">Следующий челлендж</h2>
                <p class="quest-subtitle">Новое задание будет доступно после окончания таймера.</p>
                <div id="challenge-cooldown-timer" class="challenge-timer" style="font-size: 14px; font-weight: 600; color: var(--primary-color); margin-top: 10px;">...</div>
            </div>`;
        if (!countdownIntervals['challenge_cooldown']) {
            startCountdown(document.getElementById('challenge-cooldown-timer'), challengeData.cooldown_until, 'challenge_cooldown');
        }
        return;
    }

    if ((!challengeData || !challengeData.description) && !isOnline) {
        dom.challengeContainer.innerHTML = `
            <div class="quest-card challenge-card">
                <div class="quest-icon" style="color: #ff3b30; box-shadow: none; text-shadow: none; background: rgba(255, 59, 48, 0.1);">
                    <i class="fa-solid fa-video-slash"></i>
                </div>
                <h2 class="quest-title">Стрим сейчас оффлайн</h2>
                <p class="quest-subtitle">Челленджи доступны только во время эфира. Посмотрите расписание.</p>
                <button id="open-schedule-btn" class="claim-reward-button" style="background: #3a3a3c; color: #fff; box-shadow: none; border: 1px solid rgba(255,255,255,0.1);">
                    <i class="fa-regular fa-calendar-days"></i> <span>Расписание стримов</span>
                </button>
            </div>`;
        document.getElementById('open-schedule-btn').addEventListener('click', () => {
            if(dom.scheduleModal) dom.scheduleModal.classList.remove('hidden');
        });
        return;
    }

    if (!challengeData || !challengeData.description) {
        dom.challengeContainer.innerHTML = `
            <div class="quest-card challenge-card">
                ${streamBadgeHtml} <div class="quest-icon"><i class="fa-solid fa-dice"></i></div>
                <h2 class="quest-title">Случайный челлендж</h2>
                <p class="quest-subtitle">Испытай удачу! Получи случайное задание и выполни его.</p>
                <button id="get-challenge-btn" class="claim-reward-button">
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
    const isCompleted = currentProgress >= target;
    
    let claimButtonHtml = '';

    if (challenge.claimed_at) {
        claimButtonHtml = `
            <button class="claim-reward-button" disabled style="background: #2c2c2e; color: #666; cursor: default; box-shadow: none; border: 1px solid rgba(255,255,255,0.05);">
                <i class="fa-solid fa-check"></i> <span>Выполнено</span>
            </button>
        `;
    } else {
        claimButtonHtml = `
            <button id="claim-challenge-btn" data-challenge-id="${challenge.challenge_id}" class="claim-reward-button" ${!canClaim ? 'disabled' : ''}>
                <i class="fa-solid fa-gift"></i> <span>Забрать награду</span>
            </button>
        `;
    }
    let statusText = '';
    if (challenge.claimed_at) {
        statusText = '<div style="color: #34C759; font-size: 12px; margin: 5px 0;">✅ Награда получена</div>';
    } else if (isCompleted) {
        statusText = '<div style="color: #FFCC00; font-size: 12px; margin: 5px 0;">🎁 Награда готова!</div>';
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
        <div class="quest-card challenge-card">
            ${streamBadgeHtml} <div class="quest-icon"><i class="fa-solid fa-star"></i></div>
            <h2 class="quest-title">${challenge.description || ''}</h2>
            ${statusText}
            <div id="challenge-timer" class="challenge-timer">...</div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${percent}%;"></div>
                <div class="progress-content">
                    <span class="progress-text">${progressTextContent}</span>
                </div>
            </div>
            ${twitchNotice}
            ${claimButtonHtml}
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

    const iconHtml = (activeQuest.icon_url && activeQuest.icon_url !== "") ? `<img src="${activeQuest.icon_url}" class="quest-image-icon" alt="Иконка квеста">` : `<div class="quest-icon"><i class="fa-solid fa-bolt"></i></div>`;
    const progress = userData.active_quest_progress || 0;
    const target = activeQuest.target_value || 1;
    const percent = target > 0 ? Math.min(100, (progress / target) * 100) : 0;
    const isCompleted = progress >= target;
    const isTwitchQuest = activeQuest.quest_type && activeQuest.quest_type.includes('twitch');
    const twitchNotice = isTwitchQuest ? createTwitchNoticeHtml() : '';
    
    let buttonHtml = '';
    
    if (isCompleted) {
        buttonHtml = `<button class="claim-reward-button" data-quest-id="${activeQuest.id}"><i class="fa-solid fa-gift"></i> <span>Забрать</span></button>`;
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
                <button id="paid-cancel-quest-btn" data-cost="${cost}" class="cancel-quest-button" style="margin-top: 10px; background: rgba(255, 165, 0, 0.15); border: 1px solid rgba(255, 165, 0, 0.4); color: #ffae00;">
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
    const timerHtml = questEndDate ? `<div id="quest-timer-${activeQuest.id}" class="challenge-timer">...</div>` : '';
    
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
            <div class="button-container">${buttonHtml}</div>
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
        container.innerHTML = `<p style="text-align: center; font-size: 12px; color: var(--text-color-muted);">Нет заданий для ручной проверки.</p>`;
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
            const iconHtml = (quest.icon_url && quest.icon_url !== "") ? `<img src="${escapeHTML(quest.icon_url)}" class="quest-image-icon" alt="Иконка квеста">` : `<div class="quest-icon"><i class="fa-solid fa-user-check"></i></div>`;
            const actionLinkHtml = (quest.action_url && quest.action_url !== "")
                ? `<a href="${escapeHTML(quest.action_url)}" target="_blank" rel="noopener noreferrer" class="action-link-btn">Перейти</a>`
                : '';
            const submitButtonText = (quest.action_url && quest.action_url !== "") ? 'Отправить' : 'Выполнить';
            
            return `
                <div class="quest-card" style="display: flex; flex-direction: column;">
                    <div style="flex-grow: 1;">
                        ${iconHtml}
                        <h2 class="quest-title">${escapeHTML(quest.title || '')}</h2>
                        <p class="quest-subtitle">${escapeHTML(quest.description || '')}</p>
                        <p class="quest-subtitle">Награда: ${quest.reward_amount || ''} <i class="fa-solid fa-coins" style="color: #ffcc00;"></i></p>
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
// 4. ОСНОВНАЯ ЛОГИКА
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
            Telegram.WebApp.showAlert('Нет доступных челленджей или произошла ошибка.');
            if(getChallengeBtn) getChallengeBtn.disabled = false;
            return;
        }
        
        const overlay = document.createElement('div');
        overlay.className = 'prompt-overlay';
        overlay.innerHTML = `<div style="width: 90%; max-width: 400px; height: 150px; background: var(--surface-glass-bg); border-radius: 14px; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; overflow: hidden;"><div id="roulette-inner" style="position: absolute; width: 100%; top: 0;"></div><div style="position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 100%; height: 50px; border-top: 2px solid var(--primary-color); border-bottom: 2px solid var(--primary-color); box-sizing: border-box; z-index: 1;"></div></div>`;
        document.body.appendChild(overlay);
        const inner = overlay.querySelector('#roulette-inner');
        const itemHeight = 50;
        let rouletteItems = [];
        for (let i = 0; i < 30; i++) rouletteItems.push(...available.sort(() => Math.random() - 0.5));
        rouletteItems.push(assignedChallenge.challenges);
        inner.innerHTML = rouletteItems.map(item => `<div data-id="${item.id}" style="height: ${itemHeight}px; display: flex; flex-direction: column; align-items: center; justify-content: center;"><div style="font-size: 14px; font-weight: 600;">${item.description}</div><div style="font-size: 11px; color: var(--quest-icon-color);">Награда: ${item.reward_amount} ⭐</div></div>`).join('');
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
        console.log(`📭 Нет доступных квестов (${filterPrefix}). Меню не открываем.`);
        return; 
    }

    const modalTitle = isTelegram ? 'Telegram Испытания' : 'Twitch Испытания';
    const accentColor = isTelegram ? '#0088cc' : '#9146ff';
    const bgIconColor = isTelegram ? 'rgba(0, 136, 204, 0.2)' : 'rgba(145, 70, 255, 0.2)';
    const iconClass = isTelegram ? 'fa-brands fa-telegram' : 'fa-brands fa-twitch';

    openUniversalModal(modalTitle);
    
    const container = dom.modalContainer;
    container.classList.add('grid-mode'); 
    container.innerHTML = ''; 
    
    quests.forEach((quest, index) => {
        const el = document.createElement('div');
        el.className = `tg-grid-card anim-card anim-delay-${index % 8}`;
        
        const rewardText = userData.quest_rewards_enabled 
            ? `+${quest.reward_amount} <i class="fa-solid fa-coins" style="color: #ffcc00;"></i>`
            : `Ивент`;

        el.innerHTML = `
            <div class="tg-grid-icon" style="color: ${accentColor}; background: ${bgIconColor}; box-shadow: 0 4px 10px ${bgIconColor};">
                <i class="${iconClass}"></i>
            </div>
            
            <div class="tg-grid-title">${quest.title}</div>
            <div class="tg-grid-reward">${rewardText}</div>
            
            <button class="tg-grid-btn" style="background: ${accentColor};" id="btn-start-${quest.id}">
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
                Telegram.WebApp.showAlert(`Ошибка: ${e.message}`);
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
// 5. ИНИЦИАЛИЗАЦИЯ И ОБРАБОТЧИКИ
// ==========================================

function setPlatformTheme(platform) {
    document.body.setAttribute('data-theme', platform);
    
    const questButton = dom.questChooseBtn;
    if (platform === 'telegram') {
        questButton.classList.remove('twitch-theme');
        questButton.classList.add('telegram-theme');
        questButton.innerHTML = '<i class="fa-brands fa-telegram"></i> TELEGRAM ИСПЫТАНИЯ';
        dom.challengeContainer.classList.add('hidden');
    } else {
        questButton.classList.remove('telegram-theme');
        questButton.classList.add('twitch-theme');
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
            if (platform === 'telegram') dom.questChooseBtn.innerHTML = '<i class="fa-brands fa-telegram"></i> TELEGRAM ИСПЫТАНИЯ';
            else dom.questChooseBtn.innerHTML = '<i class="fa-brands fa-twitch"></i> TWITCH ИСПЫТАНИЯ';
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

    const injectedPopups = document.querySelectorAll('.popup-overlay');
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

        if (document.querySelector('.popup-overlay, .prompt-overlay:not(.hidden), .active')) {
            return; 
        }

        if (Math.abs(diffX) > Math.abs(diffY)) {
            if (diffX < -SWIPE_THRESHOLD) {
                safeSwitchTab('twitch');
            } else if (diffX > SWIPE_THRESHOLD) {
                safeSwitchTab('telegram');
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
                try { Telegram.WebApp.HapticFeedback.selectionChanged(); } catch (err) {}
            }
        });
    });
}

async function main() {
    localStorage.removeItem('last_active_tab'); 

    if (window.Telegram && !Telegram.WebApp.initData) {
        if (dom.loaderOverlay) dom.loaderOverlay.classList.add('hidden');
        return; 
    }

    const cachedRaw = localStorage.getItem('quests_cache_v1');
    let isRenderedFromCache = false;

    if (cachedRaw) {
        try {
            const cachedData = JSON.parse(cachedRaw);
            if (cachedData && cachedData.user) {
                console.log("🚀 Restoring from cache...");
                
                userData = cachedData.user;
                allQuests = cachedData.quests || [];
                
                if (dom.fullName) {
                    dom.fullName.textContent = userData.full_name || "Гость";
                    
                    if (dom.fullName.parentNode && !document.getElementById('promo-btn-inject')) {
                        const btn = document.createElement('a');
                        btn.id = 'promo-btn-inject';
                        btn.href = 'profile.html';
                        btn.className = 'promo-profile-btn'; 
                        btn.innerHTML = 'Промокоды'; 
                        dom.fullName.insertAdjacentElement('afterend', btn);
                    }
                }
                
                if (document.getElementById('ticketStats')) {
                    document.getElementById('ticketStats').textContent = userData.tickets || 0;
                }

                initUnifiedSwitcher();
                
                const tempTab = localStorage.getItem('temp_return_tab');
                let defaultView;

                if (tempTab) {
                    defaultView = tempTab;
                    localStorage.removeItem('temp_return_tab');
                } else {
                    defaultView = userData.is_stream_online ? 'twitch' : 'telegram';
                }

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
        let bootstrapData;
        
        if (window.bootstrapPromise) {
            try {
                bootstrapData = await window.bootstrapPromise;
            } catch (e) {
                console.warn("Предзагрузка не удалась, пробуем снова...", e);
                bootstrapData = await makeApiRequest("/api/v1/bootstrap", {}, 'POST', true);
            }
        } else {
            bootstrapData = await makeApiRequest("/api/v1/bootstrap", {}, 'POST', true);
        }
        
        updateLoading(50);

        if (bootstrapData) {
            localStorage.setItem('quests_cache_v1', JSON.stringify(bootstrapData));

            userData = bootstrapData.user;
            allQuests = bootstrapData.quests;
            
            if (bootstrapData.matrix_quest !== undefined) {
                renderMatrixTracker(bootstrapData.matrix_quest, userData);
            }
            
            if (userData) {
                if (dom.fullName) {
                    dom.fullName.textContent = userData.full_name || "Гость";
                    if (dom.fullName.parentNode && !document.getElementById('promo-btn-inject')) {
                        const btn = document.createElement('a');
                        btn.id = 'promo-btn-inject';
                        btn.href = 'profile.html';
                        btn.className = 'promo-profile-btn'; 
                        btn.innerHTML = 'Промокоды';
                        dom.fullName.insertAdjacentElement('afterend', btn);
                    }
                }
                
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
            
            if (defaultView === 'manual') {
                 dom.sectionAuto.classList.add('hidden');
                 dom.sectionManual.classList.remove('hidden');
            } else {
                 dom.sectionAuto.classList.remove('hidden');
                 dom.sectionManual.classList.add('hidden');
            }

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

        const urlParams = new URLSearchParams(window.location.search);
        const viewCommand = urlParams.get('view');
        const openCommand = urlParams.get('open');
        
        if (userData.active_quest_id) {
            const activeQuest = allQuests.find(q => q.id === userData.active_quest_id);
            
            if (activeQuest && activeQuest.quest_type && activeQuest.quest_type.includes('twitch')) {
                safeSwitchTab('twitch');
            } else {
                safeSwitchTab('telegram');
            }
            
            console.log("✅ Квест активен. Просто открываем вкладку прогресса.");
            
            const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
        } 
        else {
            if (viewCommand) {
                 safeSwitchTab(viewCommand);
            }
            else if (openCommand === 'roulette' || openCommand === 'twitch_only') {
                const isOnline = userData.is_stream_online === true;
                
                if (isOnline) {
                    safeSwitchTab('twitch');
                    console.log("🌊 Стрим онлайн -> Открываем Twitch выбор");
                    setTimeout(() => openQuestSelectionModal(), 400);
                } 
                else {
                    safeSwitchTab('telegram');
                    console.log("zzz Стрим оффлайн -> Открываем TG выбор");
                    setTimeout(() => openQuestSelectionModal(), 400);
                }

                const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
                window.history.replaceState({}, document.title, cleanUrl);
            }
        }

        const openQuestId = urlParams.get('open_id');
        if (openQuestId) {
            const targetBtn = document.querySelector(`.perform-quest-button[data-id="${openQuestId}"]`);
            
            if (targetBtn) {
                const manualTab = document.getElementById('view-manual');
                if (manualTab) {
                    manualTab.checked = true;
                    setPlatformTheme('manual');
                    if (dom.sectionAuto) dom.sectionAuto.classList.add('hidden');
                    if (dom.sectionManual) dom.sectionManual.classList.remove('hidden');
                }
                
                const accordion = targetBtn.closest('details.quest-category-accordion');
                if (accordion) accordion.setAttribute('open', '');
                
                const targetCard = targetBtn.closest('.quest-card');
                if (targetCard) {
                    setTimeout(() => {
                        targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        
                        const origShadow = targetCard.style.boxShadow;
                        const origBorder = targetCard.style.borderColor;
                        
                        targetCard.style.transition = 'all 0.4s ease';
                        targetCard.style.borderColor = '#FFD700';
                        targetCard.style.boxShadow = '0 0 15px rgba(255, 215, 0, 0.4)';
                        
                        setTimeout(() => {
                            targetCard.style.borderColor = origBorder;
                            targetCard.style.boxShadow = origShadow;
                        }, 2500);
                    }, 300);
                }
                
                const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
                window.history.replaceState({}, document.title, cleanUrl);
            }
        }

        if (dom.loaderOverlay) dom.loaderOverlay.classList.add('hidden');
        dom.mainContent.style.opacity = 1;

    } catch (e) {
        console.error("Ошибка в main:", e);
        if (!isRenderedFromCache) {
            Telegram.WebApp.showAlert("Ошибка загрузки. Обновите страницу.");
        }
        if (dom.loaderOverlay) dom.loaderOverlay.classList.add('hidden');
    }
}

function initPullToRefresh() {
    const content = document.getElementById('main-content');
    const ptrContainer = document.getElementById('pull-to-refresh'); 
    const icon = ptrContainer ? ptrContainer.querySelector('i') : null;
    if (!content || !ptrContainer || !icon) return;
    let startY = 0;
    let pulledDistance = 0;
    let isPulling = false;
    const triggerThreshold = 80;

    content.addEventListener('touchstart', (e) => {
        if (content.scrollTop <= 0) { 
            startY = e.touches[0].clientY; 
            isPulling = true; 
            content.style.transition = 'none'; 
            ptrContainer.style.transition = 'none'; 
            icon.style.transition = 'none';
        } else { isPulling = false; }
    }, { passive: true });

    content.addEventListener('touchmove', (e) => {
        if (!isPulling) return;
        const currentY = e.touches[0].clientY;
        const diff = currentY - startY;
        if (diff > 0 && content.scrollTop <= 0) {
            if (e.cancelable) e.preventDefault();
            pulledDistance = Math.pow(diff, 0.85); 
            if (pulledDistance > 180) pulledDistance = 180;
            content.style.transform = `translateY(${pulledDistance}px)`;
            ptrContainer.style.transform = `translateY(${pulledDistance}px)`;
            icon.style.transform = `rotate(${pulledDistance * 2.5}deg)`;
            if (pulledDistance > triggerThreshold) icon.style.color = "#34c759";
            else icon.style.color = "#FFD700";
        }
    }, { passive: false });

    content.addEventListener('touchend', () => {
        if (!isPulling) return;
        isPulling = false;
        content.style.transition = 'transform 0.3s ease-out';
        ptrContainer.style.transition = 'transform 0.3s ease-out';
        if (pulledDistance > triggerThreshold) {
            content.style.transform = `translateY(80px)`;
            ptrContainer.style.transform = `translateY(80px)`;
            icon.classList.add('fa-spin');
            Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            setTimeout(() => window.location.reload(), 500);
        } else {
            content.style.transform = 'translateY(0px)';
            ptrContainer.style.transform = 'translateY(0px)';
            icon.style.transform = 'rotate(0deg)';
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

    const footer = document.querySelector('.app-footer');
    if (footer) {
        footer.addEventListener('click', (e) => {
            if (e.target.closest('.footer-item')) {
                try { Telegram.WebApp.HapticFeedback.impactOccurred('medium'); } catch (err) {}
            }
        });
    }

    document.addEventListener('click', (e) => {
        if (e.target && e.target.classList.contains('quest-category-header')) {
            e.preventDefault();
            const details = e.target.parentElement;
            if (details) {
                if (details.hasAttribute('open')) details.removeAttribute('open');
                else details.setAttribute('open', '');
            }
        }
    });

    if(dom.promptCancel) dom.promptCancel.addEventListener('click', () => dom.promptOverlay.classList.add('hidden'));
    
    if(dom.promptConfirm) dom.promptConfirm.addEventListener('click', async () => {
        const text = dom.promptInput.value.trim();
        if (!text) return;
        const questIdForSubmission = currentQuestId;
        dom.promptOverlay.classList.add('hidden');
        await makeApiRequest(`/api/v1/quests/${questIdForSubmission}/submit`, { submittedData: text });
        Telegram.WebApp.showAlert('Ваша заявка принята и отправлена на проверку!');
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
            
            if(userData.challenge) {
                userData.challenge.claimed_at = new Date().toISOString(); 
            }
            
            try {
                const challengeId = target.dataset.challengeId; 
                const result = await makeApiRequest(`/api/v1/challenges/${challengeId}/claim`, {}, 'POST');
                
                if (result.success) {
                    target.innerHTML = '<i class="fa-solid fa-check"></i> <span>Выполнено</span>';
                    target.style.background = '#2c2c2e';
                    target.style.color = '#666';
                    target.style.boxShadow = 'none';

                    if (result.promocode) {
                        dom.rewardClaimedOverlay.classList.remove('hidden'); 
                    } else {
                        await main();
                    }
                } else {
                    Telegram.WebApp.showAlert(result.message || "Не удалось забрать награду");
                    target.disabled = false;
                    target.style.background = ''; 
                    target.style.color = '';
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
                console.error(e);
                window.location.reload();
            }

        } else if (target.id === 'cancel-quest-btn') {
            event.preventDefault();
            Telegram.WebApp.showConfirm("Вы уверены, что хотите отменить это задание? Отменять задания можно лишь раз в сутки.", async (ok) => {
                if (ok) {
                    try {
                        const btn = document.getElementById('cancel-quest-btn');
                        if(btn) { btn.disabled = true; btn.innerText = '...'; }

                        await makeApiRequest('/api/v1/quests/cancel');
                        Telegram.WebApp.showAlert('Задание отменено.');

                        const currentTab = document.querySelector('input[name="view"]:checked')?.value || 'twitch';
                        localStorage.setItem('temp_return_tab', currentTab);
                        localStorage.removeItem('quests_cache_v1');
                        window.location.reload();
                    } catch (e) {
                        window.location.reload();
                    }
                }
            });
        } else if (target.id === 'paid-cancel-quest-btn') {
            event.preventDefault();
            
            const cost = parseInt(target.dataset.cost || 5);
            const currentTickets = parseInt(userData.tickets || 0);

            if (currentTickets < cost) {
                if(Telegram.WebApp.HapticFeedback) Telegram.WebApp.HapticFeedback.notificationOccurred('error');
                
                openUniversalModal('Не хватает билетов', `
                    <div style="text-align:center; padding: 20px; display: flex; flex-direction: column; align-items: center;">
                        <div style="font-size: 50px; margin-bottom: 15px; animation: shake 0.5s; color: #ff4757; filter: drop-shadow(0 0 10px rgba(255, 71, 87, 0.3));">
                            <i class="fa-solid fa-ticket"></i>
                        </div>
                        <p style="font-size: 16px; color: #fff; margin-bottom: 8px; font-weight: 600;">
                            Баланс: <span style="color:#FFD700">${currentTickets}</span> <i class="fa-solid fa-ticket" style="font-size:12px"></i> / Нужно: <span style="color:#ff4757">${cost}</span>
                        </p>
                        <p style="font-size: 13px; color: #8e8e93; line-height: 1.5; margin-bottom: 20px;">
                            Выполняй задания или приглашай друзей, чтобы заработать больше!
                        </p>
                        <button onclick="closeUniversalModal()" style="
                            width: 100%; padding: 14px; border-radius: 14px; 
                            background: rgba(255, 255, 255, 0.1); color: #fff; border: 1px solid rgba(255,255,255,0.1); font-weight: 600; font-size: 15px; cursor: pointer;
                        ">Понятно</button>
                    </div>
                    <style>
                        @keyframes shake { 0% { transform: translateX(0); } 25% { transform: translateX(-5px); } 50% { transform: translateX(5px); } 75% { transform: translateX(-5px); } 100% { transform: translateX(0); } }
                    </style>
                `);
                return;
            }

            Telegram.WebApp.showConfirm(`Списать ${cost} билетов за отмену задания?`, async (ok) => {
                if (ok) {
                    target.disabled = true;
                    target.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                    
                    try {
                        await makeApiRequest('/api/v1/quests/cancel_paid'); 
                        Telegram.WebApp.showAlert(`Задание отменено! Списано ${cost} билетов.`);
                        
                        const currentTab = document.querySelector('input[name="view"]:checked')?.value || 'twitch';
                        localStorage.setItem('temp_return_tab', currentTab);
                        localStorage.removeItem('quests_cache_v1');
                        window.location.reload();
                    } catch (e) {
                        target.disabled = false;
                        target.innerHTML = `<i class="fa-solid fa-ticket"></i> Отменить за ${cost} билетов`;
                        Telegram.WebApp.showAlert(e.message || "Ошибка при отмене");
                    }
                }
            });
        }
    });
}

// ==========================================
// 6. ЗАПУСК
// ==========================================

async function checkMaintenance() {
    try {
        const res = await fetch('/api/v1/bootstrap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData: window.Telegram.WebApp.initData || '' })
        });
        if (res.ok) {
            const data = await res.json();
            if (data.maintenance) {
                window.location.href = '/'; 
            }
        }
    } catch (e) {
        console.error("Ошибка проверки статуса:", e);
    }
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
            if (window.Telegram && Telegram.WebApp.HapticFeedback) {
                Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            }
            
            localStorage.removeItem('quests_cache_v1');
            
            const rewardAmount = result.reward || 10;
            
            const successText = `
                <span style="font-size: 18px; line-height: 1.2;">Доверие оправдано!</span>
                <span style="font-size: 14px; color: #FFD700; display: block; margin-top: 8px; font-weight: 700;">
                    🎁 Выдан Кейс | The Noot-Noot
                </span>
                <span style="font-size: 11px; color: #8e8e93; font-weight: 500; display: block; margin-top: 4px; letter-spacing: 0.2px;">
                    Он уже ждет в разделе Кейсы
                </span>
            `;
            
            injectRewardPopup(rewardAmount, successText, true);

        } else {
            Telegram.WebApp.showAlert(result.message || result.error || "Не удалось забрать приз");
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = 'ЗАБРАТЬ ПРИЗ';
            }
        }
    } catch (e) {
        console.error("Ошибка при получении награды матрицы:", e);
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = 'ЗАБРАТЬ ПРИЗ';
        }
    }
};

try {
    Telegram.WebApp.ready();
    Telegram.WebApp.expand();
    checkMaintenance();
    setupEventListeners();
    initPullToRefresh();
    main();
    setInterval(refreshDataSilently, 30000);
} catch (e) {
    console.error("Critical Error:", e);
    if (dom.loaderOverlay) dom.loaderOverlay.classList.add('hidden');
    document.body.innerHTML = `<div style="text-align:center; padding:20px; color:#fff;"><h1>Ошибка запуска</h1><p>${e.message}</p></div>`;
}
