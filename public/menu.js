// ================================================================
// 1. ИНИЦИАЛИЗАЦИЯ (Флаги уже установлены в HTML) 
// ================================================================
console.log("📡 [DETECTOR] Текущий режим:", window.isVk ? "ВКонтакте" : "Telegram/Web");

// 🔥 ГЕНЕРАЦИЯ УНИКАЛЬНОГО DEVICE ID ДЛЯ БОРЬБЫ С ТВИНКАМИ 🔥
(function initDeviceIdentifier() {
    try {
        if (!localStorage.getItem('frontend_device_id')) {
            const uuid = typeof crypto.randomUUID === 'function' 
                ? crypto.randomUUID() 
                : 'dev_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            localStorage.setItem('frontend_device_id', uuid);
            console.log("📱 [DETECTOR] Создан новый слепок девайса:", uuid);
        } else {
            console.log("📱 [DETECTOR] Слепок девайса подгружен из памяти:", localStorage.getItem('frontend_device_id'));
        }
    } catch (e) {
        console.error("Ошибка детектора девайса:", e);
    }
})();

// 🔥 ПЕРЕХВАТ ТОКЕНА ПОСЛЕ ВХОДА ЧЕРЕЗ TWITCH В БРАУЗЕРЕ 🔥
(function catchWebTwitchToken() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const webToken = urlParams.get('web_token');
        if (webToken) {
            localStorage.setItem('tg_web_auth_token', webToken);
            localStorage.removeItem('cache_bootstrap'); // Сбрасываем гостевой кэш
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    } catch (e) {
        console.error("Ошибка перехвата токена:", e);
    }
})();

// 🔥 ПРОФЕССИОНАЛЬНЫЙ 5-УРОВНЕВЫЙ ДЕТЕКТОР СРЕДЫ (TG / VK / WEB) 🔥
window.AppEnv = {
    isTelegramApp: false,
    isVkApp: false,
    isWebBrowser: false,
    deviceType: 'pc', // 'mobile' | 'pc'
    osPlatform: 'unknown', // 'ios' | 'android' | 'tdesktop' | 'macos' | 'web'
    savedInitData: ''
};

function detectEnvironmentSync() {
    const ua = navigator.userAgent || navigator.vendor || window.opera || '';
    const hash = window.location.hash || '';
    const search = window.location.search || '';

    // 1. Проверка ВКонтакте
    if (window.isVk || search.includes('vk_app_id=') || search.includes('vk_user_id=')) {
        window.isVk = true;
        window.AppEnv.isVkApp = true;
        window.AppEnv.deviceType = (/android|ipad|iphone|ipod/i.test(ua)) ? 'mobile' : 'pc';
        return window.AppEnv;
    }

    // 2. Собираем ВСЕ возможные доказательства того, что мы внутри клиента Telegram
    const tg = window.Telegram?.WebApp;
    const tgPlatform = tg?.platform || 'unknown';

    // А) Проверяем нативные мосты Telegram для ВСЕХ ОС (Android, iOS webkit, Desktop)
    const hasNativeTgBridge = Boolean(
        typeof window.TelegramWebviewProxy !== 'undefined' ||
        typeof window.TelegramWebview !== 'undefined' ||
        typeof window.TelegramWebviewProxyProto !== 'undefined' ||
        (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.performAction) ||
        (window.external && typeof window.external.notify === 'function') ||
        hash.includes('tgWebAppData=') ||
        hash.includes('tgWebAppVersion=') ||
        search.includes('tgWebAppStartParam=') ||
        sessionStorage.getItem('__telegram__initParams') !== null ||
        sessionStorage.getItem('hatelavka_is_tg_session') === 'true' ||
        (localStorage.getItem('hatelavka_ever_had_tg') === 'true' && /; wv\)/i.test(ua))
    );

    // Б) Проверяем URL-хэш и внутреннее хранилище Telegram SDK
    let tgSessionInitData = '';
    let tgSessionPlatform = '';
    try {
        const rawInitParams = sessionStorage.getItem('__telegram__initParams');
        if (rawInitParams) {
            const parsed = JSON.parse(rawInitParams);
            if (parsed.tgWebAppData) tgSessionInitData = parsed.tgWebAppData;
            if (parsed.tgWebAppPlatform) tgSessionPlatform = parsed.tgWebAppPlatform;
        }
    } catch (e) {}

    // Если в хэше есть tgWebAppData — вытаскиваем его напрямую на случай задержки SDK
    if (!tgSessionInitData && hash.includes('tgWebAppData=')) {
        try {
            const hashParams = new URLSearchParams(hash.replace(/^#/, ''));
            tgSessionInitData = hashParams.get('tgWebAppData') || '';
            if (!tgSessionPlatform) tgSessionPlatform = hashParams.get('tgWebAppPlatform') || '';
        } catch (e) {}
    }

    // В) Проверяем наш собственный страховочный кэш (спасает при переходах между страницами и сбоях сети внутри ТГ)
    const cachedTgInitData = sessionStorage.getItem('hatelavka_tg_init_data') || localStorage.getItem('hatelavka_tg_init_data_backup') || '';

    // Г) Итоговый initData из всех источников
    const finalInitData = tg?.initData || tgSessionInitData || cachedTgInitData || '';
    if (finalInitData) {
        try { 
            sessionStorage.setItem('hatelavka_tg_init_data', finalInitData); 
            localStorage.setItem('hatelavka_tg_init_data_backup', finalInitData);
        } catch (e) {}
        window.AppEnv.savedInitData = finalInitData;
    }

    // Д) Определяем реальную платформу Telegram
    const effectiveTgPlatform = (tgPlatform !== 'unknown' ? tgPlatform : tgSessionPlatform) || 'unknown';
    const validTgPlatforms = ['ios', 'android', 'android_x', 'tdesktop', 'macos', 'unigram', 'weba', 'webk', 'web'];
    const hasValidTgPlatform = validTgPlatforms.includes(effectiveTgPlatform) && Boolean(finalInitData || hasNativeTgBridge);

    // Е) Проверка User-Agent (официальный и кастомные клиенты TG + встроенный Android WebView "; wv)")
    const isAndroidWebView = /Android.*(;\s*wv\)|Version\/\d+\.\d+\s+Chrome\/)/i.test(ua) && !window.isVk;
    const hasTgUserAgent = /Telegram/i.test(ua) || isAndroidWebView;

    // 🔥 ЖЕЛЕЗОБЕТОННЫЙ ВЕРДИКТ: ЭТО TELEGRAM MINI APP ИЛИ ОБЫЧНЫЙ БРАУЗЕР? 🔥
    if (finalInitData.length > 0 || hasNativeTgBridge || hasValidTgPlatform || hasTgUserAgent) {
        try {
            sessionStorage.setItem('hatelavka_is_tg_session', 'true');
            if (finalInitData.length > 0 || hasNativeTgBridge) {
                localStorage.setItem('hatelavka_ever_had_tg', 'true');
            }
        } catch (e) {}
        window.AppEnv.isTelegramApp = true;
        window.AppEnv.isWebBrowser = false;
        window.AppEnv.osPlatform = effectiveTgPlatform !== 'unknown' ? effectiveTgPlatform : (/iphone|ipad|ipod/i.test(ua) ? 'ios' : (/android/i.test(ua) ? 'android' : 'tdesktop'));
        window.AppEnv.deviceType = (['ios', 'android', 'android_x'].includes(window.AppEnv.osPlatform) || /android|ipad|iphone|ipod/i.test(ua)) ? 'mobile' : 'pc';
        
        // Принудительно сносим browser-mode и закрываем веб-модалку, если она вдруг вылезла
        if (document.body) {
            document.body.classList.remove('browser-mode');
            document.body.classList.add('tg-mode');
        }
        const strayModal = document.getElementById('web-auth-modal');
        if (strayModal) strayModal.remove();
    } else {
        window.AppEnv.isTelegramApp = false;
        window.AppEnv.isWebBrowser = true;
        window.AppEnv.osPlatform = 'web';
        window.AppEnv.deviceType = (/android|ipad|iphone|ipod/i.test(ua)) ? 'mobile' : 'pc';
    }

    return window.AppEnv;
}

// Запускаем первичное определение мгновенно
detectEnvironmentSync();

// 🔥 УМНЫЙ ПЭЙЛОАД С ПОДДЕРЖКОЙ TG, VK И WEB-АВТОРИЗАЦИИ 🔥
function getAuthPayload() {
    const env = detectEnvironmentSync();

    if (env.isVkApp) {
        return { initData: window.vkParams || '', platform: 'vk', platform_type: env.deviceType };
    }

    // Если мы 100% внутри Telegram — ВСЕГДА отдаем TG initData (даже из резервного кэша сессии или памяти)
    if (env.isTelegramApp) {
        const tgData = window.Telegram?.WebApp?.initData || env.savedInitData || sessionStorage.getItem('hatelavka_tg_init_data') || localStorage.getItem('hatelavka_tg_init_data_backup') || '';
        return {
            initData: tgData,
            platform: 'tg',
            platform_type: env.deviceType
        };
    }

    // Если мы в обычном браузере — берем токен от Web-авторизации
    const webToken = localStorage.getItem('tg_web_auth_token') || '';
    return { 
        initData: webToken, 
        platform: 'web', 
        platform_type: env.deviceType 
    };
}

async function fetchVkParamsFromBridge() {
    return new Promise((resolve) => {
        if (typeof vkBridge !== 'undefined') {
            vkBridge.send("VKWebAppGetConfig").then(() => resolve()).catch(() => resolve());
        } else resolve();
    });
}

// Глобальные переменные
const dom = {
    loaderOverlay: document.getElementById('loader-overlay'),
    loadingText: document.getElementById('loading-text'),
    loadingBarFill: document.getElementById('loading-bar-fill'),
    mainContent: document.getElementById('main-content'),
    fullName: document.getElementById('fullName'),
    navAdmin: document.getElementById('nav-admin'),
    viewDashboard: document.getElementById('view-dashboard'),
    viewShop: document.getElementById('view-shop'),
    giftContainer: document.getElementById('gift-container'),
    giftIconBtn: document.getElementById('gift-icon-btn'),
    giftModalOverlay: document.getElementById('gift-modal-overlay'),
    giftOpenBtn: document.getElementById('gift-open-btn'),
    giftCloseBtn: document.getElementById('gift-close-btn'),
    giftContentInitial: document.getElementById('gift-content-initial'),
    giftContentResult: document.getElementById('gift-content-result'),
    giftResultTitle: document.getElementById('gift-result-title'),
    giftResultText: document.getElementById('gift-result-text'),
    giftResultIcon: document.getElementById('gift-result-icon'),
    giftPromoBlock: document.getElementById('gift-promo-block'),
    giftPromoCode: document.getElementById('gift-promo-code'),
    tutorialOverlay: document.getElementById('tutorial-overlay'),
    tutorialModal: document.getElementById('tutorial-modal'),
    tutorialTitle: document.getElementById('tutorial-title'),
    tutorialText: document.getElementById('tutorial-text'),
    tutorialStepCounter: document.getElementById('tutorial-step-counter'),
    tutorialNextBtn: document.getElementById('tutorial-next-btn'),
    tutorialSkipBtn: document.getElementById('tutorial-skip-btn'),
    weeklyGoalsContainer: document.getElementById('weekly-goals-container-placeholder'),
    weeklyGoalsTrigger: document.getElementById('weekly-goals-trigger'),
    weeklyGoalsBadge: document.getElementById('weekly-goals-badge'),    
    weeklyModalOverlay: document.getElementById('weekly-modal-overlay'),
    weeklyModalCloseBtn: document.getElementById('weekly-modal-close-btn'),
    weeklyGoalsListContainer: document.getElementById('weekly-goals-list-container'),
    weeklyModalCounter: document.getElementById('weekly-modal-counter')
};

let userData = {};
let allQuests = [];
window.coinsPurchasesEnabled = true; // <-- ДОБАВИЛИ ФЛАГ
let heartbeatInterval = null;
let bonusGiftEnabled = false;
let cachedP2PCases = [];
let itemsCache = {};
let isShopLoaded = false;
let currentSlideIndex = 0;
let slideInterval;
let sliderAbortController = null; 
let lastSliderSignature = '';

// Массив имен кейсов, которые сейчас бесплатны для юзера
window.activeFreeCases = [];
window.currentCategoryId = 2716312; // <--- ТЫКАЙ СЮДА (добавь эту строку)

// ================================================================
// 🔥 УМНАЯ ЛОГИКА КУПОНОВ (ТАБЛИЦА cs_codes)
// ================================================================
function getMyUserIdStr() {
    // Надежно достаем ID пользователя
    return String(window.Telegram?.WebApp?.initDataUnsafe?.user?.id || window.userData?.telegram_id || window.userData?.id || "");
}

function getAvailableCouponsForCase(itemName) {
    const target = (itemName || "").trim().toLowerCase();
    const myId = getMyUserIdStr();

    const coupons = (window.activeFreeCases || []).filter(coupon => {
        if (typeof coupon === 'object' && coupon !== null) {
            const couponTarget = (coupon.target_case_name || "").trim().toLowerCase();
            if (couponTarget !== target) return false;

            // Смотрим и в activated_by_ids, И в assigned_to
            const activatedBy = Array.isArray(coupon.activated_by_ids) ? coupon.activated_by_ids.map(String) : [];
            const isAssignedToMe = String(coupon.assigned_to) === myId;
            const isActivatedByMe = activatedBy.includes(myId) || isAssignedToMe;

            // Проверяем, что еще не потратили
            const usedBy = Array.isArray(coupon.used_by_ids) ? coupon.used_by_ids.map(String) : [];
            const isUsedByMe = usedBy.includes(myId);

            return isActivatedByMe && !isUsedByMe;
        }
        
        if (typeof coupon === 'string') {
            return coupon.trim().toLowerCase() === target;
        }
        return false;
    });

    // 🔥 СОРТИРУЕМ НА ФРОНТЕНДЕ: Купоны с bypass_lock = true всегда встают на 1-е место! 🔥
    coupons.sort((a, b) => {
        const aBypass = (typeof a === 'object' && a.bypass_lock) ? 1 : 0;
        const bBypass = (typeof b === 'object' && b.bypass_lock) ? 1 : 0;
        return bBypass - aBypass;
    });

    return coupons;
}

async function syncMyPromos() {
    try {
        const auth = getAuthPayload(); 
        const response = await makeApiRequest('/api/cs/my_active_promos', {}, 'GET', true);
        
        if (response && response.active_cases) {
            window.activeFreeCases = response.active_cases;
            console.log("Синхронизация купонов: ", window.activeFreeCases);
            if (typeof currentCategoryId !== 'undefined') renderItems(itemsCache[currentCategoryId]); 
        }
    } catch (e) {
        console.error("Ошибка синхронизации промокодов:", e);
    }
}

// ================================================================
// ИСТОРИЯ УВЕДОМЛЕНИЙ (ЧЕРЕЗ ЛОГОТИП)
// ================================================================

// Быстрая смена визуала колокольчика без сетевых запросов
function updateNotificationBadgeUI(count) {
    const badge = document.getElementById('logo-notification-badge');
    const bellIcon = document.querySelector('.bell-wrapper i.fa-bell');
    
    if (!badge) return;
    
    if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.classList.remove('hidden');
        if (bellIcon) {
            bellIcon.style.color = '#ffd700';
            bellIcon.style.textShadow = '0 0 8px rgba(255, 215, 0, 0.4)';
        }
    } else {
        badge.classList.add('hidden');
        if (bellIcon) {
            bellIcon.style.color = '';
            bellIcon.style.textShadow = 'none';
        }
    }
}

// 1. Фоновое обновление бейджа и колокольчика (теперь работает без запросов к серверу)
function updateNotificationsBadge(unread_count) {
    const badge = document.getElementById('logo-notification-badge');
    if (!badge) return;

    // Ищем иконку колокольчика железобетонно по твоей верстке
    const bellIcon = document.querySelector('.bell-wrapper i.fa-bell');

    try {
        if (unread_count > 0) {
            // Вписываем количество в бейдж
            badge.textContent = unread_count > 99 ? '99+' : unread_count;
            badge.classList.remove('hidden');
            
            // Зажигаем саму иконку колокольчика (делаем золотой + свечение)
            if (bellIcon) {
                bellIcon.style.color = '#ffd700';
                bellIcon.style.textShadow = '0 0 8px rgba(255, 215, 0, 0.4)';
            }
        } else {
            badge.classList.add('hidden');
            
            // Гасим иконку (возвращаем дефолтный цвет)
            if (bellIcon) {
                bellIcon.style.color = '';
                bellIcon.style.textShadow = 'none';
            }
        }
    } catch (e) {
        console.warn("Ошибка при обновлении бейджа уведомлений", e);
    }
}



// 2. Функция удаления уведомления (Заложена на будущее)
window.deleteNotification = async function(event, notifId) {
    event.stopPropagation(); 
    
    // Находим карточку
    const notifCard = event.target.closest('.notif-item');
    if (!notifCard) return;

    // Плавно скрываем (Оптимистичный UI)
    notifCard.style.opacity = '0';
    notifCard.style.transform = 'scale(0.95)';
    
    setTimeout(() => {
        notifCard.style.display = 'none';
    }, 300);

    try {
        // Эндпоинт, который мы сделали на бэке
        await makeApiRequest('/api/v1/notifications/delete', { id: notifId }, 'POST', true);
        updateNotificationBadgeUI(hbData.unread_notifications || 0);
    } catch (e) {
        // Если ошибка — возвращаем карточку обратно
        notifCard.style.display = 'flex';
        setTimeout(() => {
            notifCard.style.opacity = '1';
            notifCard.style.transform = 'scale(1)';
        }, 50);
    }
};

// 3. Открытие истории (При клике на колокольчик)
window.openNotificationsHistory = async function() {
    const badge = document.getElementById('logo-notification-badge');
    if (badge) badge.classList.add('hidden'); 
    
    // Гасим колокольчик при открытии, железобетонно по твоей верстке
    const bellIcon = document.querySelector('.bell-wrapper i.fa-bell');
    if (bellIcon) {
        bellIcon.style.color = '';
        bellIcon.style.textShadow = 'none';
    }

    showShopModal({
        title: "🔔 Уведомления",
        subtitle: '<div style="text-align:center; padding:30px;"><i class="fa-solid fa-spinner fa-spin" style="font-size:24px; color:#ffd700;"></i><br><br>Загрузка истории...</div>',
        confirmText: "Закрыть",
        confirmClass: "btn-cancel-modal",
        showCancel: false,
        onConfirm: (close) => close()
    });

    try {
        const res = await makeApiRequest('/api/v1/notifications', {}, 'GET', true);
        const notifs = res.notifications || [];

        let html = '<div style="max-height: 65vh; overflow-y: auto; padding-right: 6px; text-align: left; overflow-x: hidden; display: block; width: 100%; box-sizing: border-box;">';

        if (notifs.length === 0) {
            html += '<div style="text-align: center; color: #888; padding: 40px 10px;"><i class="fa-regular fa-bell-slash" style="font-size: 32px; margin-bottom: 12px; opacity: 0.4;"></i><br><span style="font-size: 12px; font-weight: 400;">Здесь пока пусто.</span><br><span style="font-size: 10px; opacity: 0.6;">Вся история начислений будет храниться тут.</span></div>';
        } else {
            notifs.forEach(n => {
                let icon = '<i class="fa-solid fa-bell" style="color: #8e8e93;"></i>';
                let iconBg = 'rgba(255, 255, 255, 0.05)';
                
                if (n.type === 'coins') { 
                    icon = '<i class="fa-solid fa-coins" style="color: #ffd700;"></i>'; 
                    iconBg = 'rgba(255, 215, 0, 0.1)'; 
                }
                if (n.type === 'tickets') { 
                    icon = '<i class="fa-solid fa-ticket" style="color: #9146ff;"></i>'; 
                    iconBg = 'rgba(145, 70, 255, 0.1)'; 
                }
                if (n.type === 'error') { 
                    icon = '<i class="fa-solid fa-circle-xmark" style="color: #ff3b30;"></i>'; 
                    iconBg = 'rgba(255, 59, 48, 0.1)'; 
                }
                if (n.type === 'system' || n.type === 'success') { 
                    icon = '<i class="fa-solid fa-check" style="color: #34c759;"></i>'; 
                    iconBg = 'rgba(52, 199, 89, 0.1)'; 
                }

                const dateObj = new Date(n.created_at);
                const timeStr = dateObj.toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'});
                const dateStr = dateObj.toLocaleDateString('ru-RU', {day: '2-digit', month: '2-digit'});
                // Светящаяся золотая рамка для новых, тусклая для старых
                const unreadBorder = n.is_read ? 'rgba(255,255,255,0.03)' : 'rgba(255,215,0,0.3)';

                // ВЁРСТКА: Убраны пустые символы и переносы, чтобы карточки стояли ровно
                html += `<div class="notif-item" style="background: #232325; border-radius: 12px; padding: 10px 32px 20px 10px; margin-bottom: 2px; position: relative; border: 1px solid ${unreadBorder}; transition: opacity 0.3s, transform 0.3s; box-sizing: border-box; width: 100%; display: flex; align-items: flex-start; gap: 10px;">
                    <div style="width: 32px; height: 32px; border-radius: 50%; background: ${iconBg}; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 14px;">
                        ${icon}
                    </div>
                    <div style="flex-grow: 1; display: flex; flex-direction: column; min-width: 0; padding-bottom: 2px;">
                        <div style="font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;">
                            ${escapeHTML(n.title)}
                        </div>
                        <div style="font-size: 11px; font-weight: 400; color: #aaa; line-height: 1.3; word-break: break-word; overflow-wrap: anywhere; white-space: normal; margin-bottom: 0;">
                            ${escapeHTML(n.message)}
                        </div>
                    </div>
                    <div style="position: absolute; bottom: -4px; right: 10px; font-size: 9px; font-weight: 500; color: #666;">
                        ${dateStr} в ${timeStr}
                    </div>
                    <div style="position: absolute; top: 10px; right: 10px; width: 24px; height: 24px; cursor: pointer; opacity: 0.5; transition: opacity 0.2s; display: flex; align-items: flex-start; justify-content: flex-end;" onclick="deleteNotification(event, '${n.id}')" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.5'">
                        <i class="fa-solid fa-trash" style="color: #ff3b30; font-size: 12px;"></i>
                    </div>
                </div>`;
            });
        }
        html += '</div>';

        const subtitleEl = document.querySelector('.custom-confirm-box .confirm-subtitle');
        if (subtitleEl) subtitleEl.innerHTML = html;

        if (notifs.some(n => !n.is_read)) {
            await makeApiRequest('/api/v1/notifications/read', { user_id: window.Telegram?.WebApp?.initDataUnsafe?.user?.id }, 'POST', true);
        }

    } catch (e) {
        const subtitleEl = document.querySelector('.custom-confirm-box .confirm-subtitle');
        if (subtitleEl) subtitleEl.innerHTML = '<div style="color:#ff3b30; text-align:center; padding:20px; font-size: 12px;">Не удалось загрузить историю.</div>';
    }
};
// ================================================================
// УТИЛИТЫ И API
// ================================================================
function escapeHTML(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/[&<>"']/g, match => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[match]);
}

function lockAppScroll() { document.body.classList.add('no-scroll'); if (dom.mainContent) dom.mainContent.classList.add('no-scroll'); }
function unlockAppScroll() { document.body.classList.remove('no-scroll'); if (dom.mainContent) dom.mainContent.classList.remove('no-scroll'); }

function updateLoading(percent) {
    if (dom.loadingText) dom.loadingText.textContent = Math.floor(percent) + '%';
    if (dom.loadingBarFill) dom.loadingBarFill.style.width = Math.floor(percent) + '%';
}

// 🔥 Функция определения типа устройства (ПК или Мобилка)
function getPlatformType() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    if (/android/i.test(userAgent) || /iPad|iPhone|iPod/.test(userAgent)) {
        return 'mobile';
    }
    return 'pc';
}
       async function makeApiRequest(url, body = {}, method = 'POST', isSilent = false) {
    console.log(`🌐 [API] ---> Начинаем запрос: ${method} ${url}`);
    if (!isSilent && dom.loaderOverlay) dom.loaderOverlay.classList.remove('hidden');
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);
        
        // Намертво вшиваем заголовок X-Device-Id для сквозного детекта базой данных
        const options = { 
            method, 
            headers: { 
                'Content-Type': 'application/json',
                'X-Device-Id': localStorage.getItem('frontend_device_id') || ''
            }, 
            signal: controller.signal 
        };
        
        // 🔥 ИСПРАВЛЕНИЕ: Получаем payload один раз и передаем платформу даже в GET-запросах
        const authPayload = getAuthPayload();
        
        if (method !== 'GET') {
            options.body = JSON.stringify({ ...body, ...authPayload });
        } else {
            const separator = url.includes('?') ? '&' : '?';
            url += `${separator}initData=${encodeURIComponent(authPayload.initData)}&platform=${encodeURIComponent(authPayload.platform)}&platform_type=${encodeURIComponent(authPayload.platform_type)}`;
        }

        const response = await fetch(url, options);
        clearTimeout(timeoutId); 
        
        console.log(`🌐 [API] <--- Ответ получен: ${method} ${url} | Статус: ${response.status}`);

        if (response.status === 429) throw new Error('Cooldown active');
        if (response.status === 204) return null;
        
        const result = await response.json();

        if (!response.ok) {
            // 👇 ЛОВИМ БЛОКИРОВКУ ПО АКТИВУ 👇
            if (result.detail && typeof result.detail === 'object' && result.detail.error_code === "ACTIVITY_LOCK") {
                window.showActivityWallModal(result.detail.current_msgs, result.detail.required_msgs);
                throw new Error("Activity Lock");
            }
            // 👇 ЛОВИМ ЛИМИТ ВЫВОДА (TRUST LOCK - ШТУКИ) 👇
            if (result.detail && typeof result.detail === 'object' && result.detail.error_code === "WEEKLY_TRUST_LIMIT") {
                window.customAlert(
                    "<span style='color: #ff3b30; font-size: 16px; font-weight: 900; text-transform: uppercase;'>Лимит выводов достигнут!</span><br><br>" +
                    "<span style='color: #fff; font-size: 15px; font-weight: 800;'>Не переживайте, скин вы не потеряете! 🎁</span><br><br>" +
                    "<span style='color: #e5e5ea; font-size: 13px; line-height: 1.4; font-weight: 500; display: inline-block; margin-bottom: 12px;'>" +
                    "Он надежно сохранен. Вы можете нажать кнопку <b style='color: #aaa;'>«Закрыть»</b>, чтобы оставить его в инвентаре до снятия лимита, либо прямо сейчас выбрать <b style='color: #ffd700;'>«Продать за билеты»</b>." +
                    "</span><br>" +
                    "<div style='background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 10px; border-radius: 10px; color: #ccc; font-size: 11px; line-height: 1.4; text-align: left;'>" +
                    "<i class='fa-solid fa-circle-info' style='color: #2AABEE; margin-right: 4px;'></i> Чтобы открыть инвентарь, нажмите на свою <b>Аватарку</b> или кнопку меню ( <i class='fa-solid fa-bars'></i> ) на главном экране." +
                    "</div>",
                    "ВСЁ ПОНЯТНО"
                );
                throw new Error("Trust Lock");
            }

            // 👇 ЛОВИМ ОБЩАК И ДЕНЕЖНЫЙ ЛИМИТ 👇
            if (result.detail && typeof result.detail === 'object' && (result.detail.error_code === "GLOBAL_DAILY_LIMIT" || result.detail.error_code === "WEEKLY_MONEY_LIMIT")) {
                window.customAlert(
                    `<span style='color: #ff3b30; font-size: 16px; font-weight: 900; text-transform: uppercase;'><i class="fa-solid fa-wallet"></i> БЮДЖЕТ ОГРАНИЧЕН</span><br><br>` +
                    `<span style='color: #fff; font-size: 14px; font-weight: 700; line-height: 1.4; display: inline-block; margin-bottom: 15px;'>${result.detail.message}</span><br>` +
                    `<div style='background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 10px; border-radius: 10px; color: #ccc; font-size: 11px; line-height: 1.4; text-align: left;'>` +
                    `<i class='fa-solid fa-circle-info' style='color: #ffcc00; margin-right: 4px;'></i> Не переживайте, ваш баланс не списан! Дождитесь отката таймера, чтобы продолжить покупки.` +
                    `</div>`,
                    "ПОНЯТНО"
                );
                throw new Error(result.detail.error_code === "GLOBAL_DAILY_LIMIT" ? "Global Lock" : "Trust Lock");
            }
            // 👆 КОНЕЦ ВСТАВКИ 👆
            
            // Защита от краша: если detail это массив (ошибка 422 от FastAPI) или объект, превращаем в строку
            let rawError = result.detail || result.message || "";
            if (typeof rawError !== 'string') {
                rawError = JSON.stringify(rawError);
            }
            const errorDetail = rawError.toUpperCase();

            // 💀 1. ВЕЧНЫЙ ЭКРАН СМЕРТИ (403 BANNED)
            if (response.status === 403 && errorDetail.includes("BAN")) {
    
    // 👇 УБИВАЕМ СТИЛЬ АНТИ-ФЛЕША, ИНАЧЕ ОН СКРОЕТ ЭКРАН БАНА 👇
    const antiFlash = document.getElementById('anti-flash-style');
    if (antiFlash) antiFlash.remove();
                document.body.innerHTML = `
                    <div style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: #000; z-index: 2147483647; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #ff3b30; text-align: center; padding: 30px; box-sizing: border-box; font-family: -apple-system, system-ui, sans-serif;">
                        <i class="fa-solid fa-skull-crossbones" style="font-size: 100px; margin-bottom: 25px; filter: drop-shadow(0 0 20px rgba(255, 59, 48, 0.6)); animation: banPulse 2s infinite;"></i>
                        
                        <h1 style="font-size: 28px; font-weight: 900; margin-bottom: 10px; text-transform: uppercase; color: #fff; letter-spacing: 1px;">Доступ ограничен</h1>
                        
                        <p style="color: #fff; font-size: 16px; line-height: 1.5; margin-bottom: 30px; opacity: 0.9; max-width: 300px;">
                            Твой аккаунт заблокирован за нарушение правил системы.
                        </p>

                        <a href="https://t.me/hatelove_twitch" target="_blank" style="display: inline-flex; align-items: center; gap: 10px; background: #2AABEE; color: #fff; text-decoration: none; padding: 14px 24px; border-radius: 14px; font-weight: 800; font-size: 14px; transition: transform 0.2s; box-shadow: 0 4px 20px rgba(42, 171, 238, 0.3);">
                            <i class="fa-brands fa-telegram" style="font-size: 18px;"></i> СВЯЗАТЬСЯ СО МНОЙ
                        </a>

                        <p style="color: #555; font-size: 11px; margin-top: 25px; line-height: 1.4;">
                            Если ты считаешь, что это произошло по ошибке,<br>напиши в поддержку для разбора ситуации.
                        </p>
                    </div>
                    <style>
                        @keyframes banPulse {
                            0% { transform: scale(1); opacity: 1; }
                            50% { transform: scale(1.05); opacity: 0.8; }
                            100% { transform: scale(1); opacity: 1; }
                        }
                    </style>
                `;
                
                document.body.style.overflow = 'hidden';
                document.body.style.position = 'fixed';

                if (window.Telegram?.WebApp?.HapticFeedback) {
                    Telegram.WebApp.HapticFeedback.notificationOccurred('error');
                }
                
                throw new Error("USER_BANNED");
            }

            // 👇 ВОТ СЮДА ВСТАВЛЯЕМ НАШУ ПРОВЕРКУ БОТА 👇
            if (result.detail && (errorDetail.includes("НЕ НАЙДЕН ПОЛЬЗОВАТЕЛЬ") || errorDetail.includes("BOT_USER_NOT_FOUND"))) {
                window.showBotAuthWarning();
                throw new Error("Bot Auth Required");
            }
            // 👆 КОНЕЦ ВСТАВКИ 👆

            // 🛡️ 2. ДУБЛИКАТЫ (400 DUPLICATE_TRADE_LINK / DUPLICATE_TWITCH)
            if (response.status === 400) {
                if (errorDetail.includes("DUPLICATE_TRADE_LINK")) {
                    // Для трейд-ссылки вызываем окно с инпутом
                    window.showSecurityBlock("Эта Трейд-ссылка уже используется другим игроком! Мы удалили её. Укажите правильную ссылку ниже.");
                    throw new Error("Security Block");
                }
                if (errorDetail.includes("DUPLICATE_TWITCH")) {
                    // Для Твича вызываем обычный алерт, чтобы не просить трейд-ссылку
                    window.customAlert("Этот Twitch-аккаунт уже привязан к другому пользователю! Обратитесь в поддержку.");
                    throw new Error("Security Block");
                }
            }

            // Обычная проверка на 403 (другие ограничения)
            if (response.status === 403) {
                // Для обычных 403 тоже используем алерт, чтобы зря не блокировать экран трейд-ссылкой
                window.customAlert(rawError || "Доступ ограничен.");
                throw new Error("Security Block");
            }
            
            // Используем rawError, чтобы избежать [object Object]
            throw new Error(rawError || 'Ошибка сервера');
        }
        return result;
    } catch (e) {
        console.error(`❌ [API] Ошибка при запросе ${url}:`, e);
        if (e.name === 'AbortError') e.message = "Превышено время ожидания ответа от сервера.";
        
        // 🔥 ВАЖНО: Если это Бан, Блок, Ошибка Бота, Блокировка Актива или Лимит Вывода, НЕ показываем стандартный customAlert
        const silentErrors = ['Cooldown active', 'Security Block', 'USER_BANNED', 'Bot Auth Required', 'Activity Lock', 'Trust Lock', 'Global Lock'];
        if (!silentErrors.includes(e.message) && !isSilent) {
             customAlert(`Ошибка: ${e.message}`);
        }
        throw e;
    } finally {
        if (!isSilent && dom.loaderOverlay) dom.loaderOverlay.classList.add('hidden');
    }
}


// Предзагрузка массива картинок
function preloadImages(urls) {
    const promises = urls.map(url => {
        return new Promise((resolve, reject) => {
            if (!url) {
                resolve();
                return;
            }
            const img = new Image();
            img.src = url;
            // Если картинка загрузилась или произошла ошибка — идём дальше (чтобы не зависнуть)
            img.onload = resolve;
            img.onerror = resolve; 
        });
    });
    // Ждем загрузки всех переданных картинок
    return Promise.all(promises);
}

// ================================================================
// HEARTBEAT (ФОНОВОЕ ОБНОВЛЕНИЕ)
// ================================================================
async function refreshDataSilently() {
    const env = detectEnvironmentSync();
    const hasWebToken = !!localStorage.getItem('tg_web_auth_token');
    if (!env.isTelegramApp && !env.isVkApp && !hasWebToken) return;
    try {
        const hbData = await makeApiRequest("/api/v1/user/heartbeat", {}, 'POST', true);
        if (hbData) {
            // Если техработы включили прямо во время сессии — мгновенный редирект
            if (hbData.maintenance) {
                document.body.innerHTML = '<div style="display:flex; height:100vh; width:100vw; background:#141414; align-items:center; justify-content:center; color:#FFD700; font-weight:bold; font-size:14px;"><i class="fa-solid fa-gear fa-spin" style="margin-right:10px;"></i> Технические работы...</div>';
                window.location.replace('/');
                return;
            }

            if (hbData.is_active === false) return;
            
            if (hbData.tickets !== undefined) {
                userData.tickets = hbData.tickets;
                const tel = document.getElementById('ticketStats');
                if (tel) {
                    let tNum = Number(hbData.tickets);
                    tel.textContent = tNum % 1 === 0 ? tNum.toString() : tNum.toFixed(2).replace('.', ',');
                }
            }
            if (hbData.quest_id) {
                userData.active_quest_id = hbData.quest_id;
                userData.active_quest_progress = hbData.quest_progress;
            }
            if (hbData.has_active_challenge) {
                if (!userData.challenge) userData.challenge = {};
                userData.challenge.progress_value = hbData.challenge_progress;
                userData.challenge.target_value = hbData.challenge_target;
            }
            updateShortcutStatuses(userData, allQuests);
            if (hbData.active_trade_status !== undefined) updateShopTile(hbData.active_trade_status);
            
            const giftContainer = document.getElementById('gift-container');
            const giftBtn = document.getElementById('daily-gift-btn');
            if (giftContainer && giftBtn) {
                 // Смотрим на глобальный тумблер, а не в профиль юзера
                 const isEnabled = (bonusGiftEnabled === true || String(bonusGiftEnabled).toLowerCase() === 'true');
                 
                 if (!isEnabled) { 
                     giftContainer.classList.add('hidden'); 
                     giftBtn.style.display = 'none'; 
                 }
            }
            
           // 👇 1. ИНТЕГРАЦИЯ СТАТУСА ИГРЫ 👇
            const gamesBtn = document.getElementById('nav-games-btn');
            if (gamesBtn && hbData.game_status && hbData.game_status.length > 0) {
                if (hbData.game_status[0].is_active && typeof userData !== 'undefined' && userData.is_stream_online) {
                    gamesBtn.classList.add('game-live');
                } else {
                    gamesBtn.classList.remove('game-live');
                }
            }
            
            if (hbData.unread_notifications !== undefined) {
                updateNotificationsBadge(hbData.unread_notifications);
            }
            
            // 🔥 ДОБАВЛЕНО: Синхронизация розыгрышей в фоне 🔥
            makeApiRequest('/api/v1/raffles/active', {}, 'POST', true)
                .then(freshRaffles => {
                    if (freshRaffles) initDynamicRaffleSlider(freshRaffles);
                }).catch(() => {});
                
            // 🔥 МАГИЯ: Стягиваем купоны. Вдруг админ выдал нам кейс или прилетел Twitch Drop! 🔥
            makeApiRequest('/api/cs/my_active_promos', {}, 'GET', true).then(res => {
                if (res && res.active_cases) {
                    const oldFreeCases = JSON.stringify(window.activeFreeCases || []);
                    const newFreeCases = JSON.stringify(res.active_cases);
                    if (oldFreeCases !== newFreeCases) {
                        window.activeFreeCases = res.active_cases;
                        if (window.currentCategoryId && itemsCache[window.currentCategoryId]) {
                            renderItems(itemsCache[window.currentCategoryId]);
                        }
                    }
                }
            }).catch(()=>{});
            
        }
    } catch (e) {
        console.error("Ошибка обновления данных в фоне:", e);
    }
}
// ================================================================
// НОВЫЙ ИНТЕРФЕЙС (ПЕРЕКЛЮЧАТЕЛИ И МЕНЮ)
// ================================================================
function setupNewUI() {
    const menuBtn = document.getElementById('open-menu-btn');
    const closeMenuBtn = document.getElementById('close-menu-btn');
    const sideMenu = document.getElementById('side-menu-overlay');

    const toggleMenu = (show) => {
        if (show) { sideMenu.classList.add('active'); document.body.style.overflow = 'hidden'; } 
        else { sideMenu.classList.remove('active'); document.body.style.overflow = ''; }
    };
    if (menuBtn) menuBtn.addEventListener('click', () => toggleMenu(true));
    if (closeMenuBtn) closeMenuBtn.addEventListener('click', () => toggleMenu(false));
    if (sideMenu) sideMenu.addEventListener('click', (e) => { if (e.target === sideMenu) toggleMenu(false); });

    const toggleOptions = document.querySelectorAll('.toggle-option');
    const toggleSlider = document.querySelector('.toggle-slider');
    const viewSections = document.querySelectorAll('.view-section');

    toggleOptions.forEach((option, index) => {
                option.addEventListener('click', () => {
                    toggleSlider.style.transform = `translateX(${index * 100}%)`;
                    toggleOptions.forEach(opt => opt.classList.remove('active'));
                    option.classList.add('active');

                    const targetId = option.getAttribute('data-target');
                    viewSections.forEach(section => {
                        if (section.id === targetId) section.classList.add('active');
                        else section.classList.remove('active');
                    });
                    
                    // Безопасный вызов вибрации, который не крашит выполнение скрипта
                    window.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.();

                    // Динамическая подгрузка кейсов при первом клике
                    if (targetId === 'view-shop' && !isShopLoaded) {
                        loadCategory(2716312);
                        isShopLoaded = true;
                    }
                });
            });
}

// ================================================================
// СЛАЙДЕР (FADE-АНИМАЦИЯ КАК В РОЗЫГРЫШАХ)
// ================================================================
function setupSlider() {
    const container = document.getElementById('main-slider-container');
    if (!container) return;

    // 🔥 ФИКС ПРЫЖКА МЕНЮ: Резервируем место под баннер до загрузки картинок
    container.style.minHeight = '130px'; 
    container.style.position = 'relative';

    // --- УМНАЯ ЗАГЛУШКА (теперь учитывает и динамические промо-слайды) ---
    const realSlides = container.querySelectorAll('.slide:not(#default-banner-slide)');
    const placeholder = document.getElementById('default-banner-slide');
    const hasActiveEvents = Array.from(realSlides).some(s => s.style.display !== 'none');
    
    if (placeholder) {
        placeholder.style.display = hasActiveEvents ? 'none' : '';
    }
    // ----------------------

    const allSlides = container.querySelectorAll('.slide');
    const visibleSlides = Array.from(allSlides).filter(slide => slide.style.display !== 'none');

    // Добавили s.dataset.promoSig, чтобы слайдер обновлялся при смене кода дня или счётчика активаций
    const currentSignature = visibleSlides.map(s => s.dataset.promoSig || s.dataset.event || s.href || s.src).join('|');

    const currentSignature = visibleSlides.map(s => s.dataset.event || s.href || s.src).join('|');
    if (currentSignature === lastSliderSignature && sliderAbortController) return;
    lastSliderSignature = currentSignature;

    if (slideInterval) clearInterval(slideInterval);
    if (sliderAbortController) sliderAbortController.abort();
    
    sliderAbortController = new AbortController();
    const signal = sliderAbortController.signal;

    const wrapper = container.querySelector('.slider-wrapper');
    const dotsContainer = container.querySelector('.slider-dots');
    
    let prevBtnOld = document.getElementById('slide-prev-btn');
    let nextBtnOld = document.getElementById('slide-next-btn');
    if (prevBtnOld) prevBtnOld.style.display = 'none';
    if (nextBtnOld) nextBtnOld.style.display = 'none';

    if (visibleSlides.length === 0) {
        container.style.display = 'none'; 
        return;
    } else {
        container.style.display = ''; 
    }

    if (wrapper) {
        wrapper.style.display = 'block'; 
        wrapper.style.position = 'relative';
        wrapper.style.transform = 'none';
        wrapper.style.width = '100%';
        wrapper.style.height = '100%';
        wrapper.style.minHeight = '130px'; // Дублируем страховку для wrapper
    }

    visibleSlides.forEach((slide, index) => {
        slide.style.position = 'absolute';
        slide.style.top = '0';
        slide.style.left = '0';
        slide.style.width = '100%';
        slide.style.height = '100%';
        slide.style.opacity = '0';
        slide.style.transition = 'opacity 0.6s ease';
        slide.style.pointerEvents = 'none'; 
        slide.style.zIndex = '1';
    });

    if (dotsContainer) {
        dotsContainer.style.display = visibleSlides.length > 1 ? 'flex' : 'none';
        dotsContainer.style.position = 'absolute';
        dotsContainer.style.top = '10px';
        dotsContainer.style.right = '10px';
        dotsContainer.style.bottom = 'auto';
        dotsContainer.style.left = 'auto';
        dotsContainer.style.justifyContent = 'flex-end';
        dotsContainer.style.margin = '0';
        dotsContainer.style.zIndex = '20';
        dotsContainer.style.gap = '4px';

        dotsContainer.innerHTML = '';
        visibleSlides.forEach((_, i) => {
            const dot = document.createElement('div');
            dot.className = 'mr-dot'; 
            dot.style.width = '6px';
            dot.style.height = '6px';
            dot.style.borderRadius = '50%';
            dot.style.background = 'rgba(255,255,255,0.2)';
            dot.style.transition = 'all 0.3s ease';
            dot.style.cursor = 'pointer';
            
            dot.onclick = () => { showSlide(i); resetSlideInterval(); };
            dotsContainer.appendChild(dot);
        });
    }
    const dots = dotsContainer ? dotsContainer.querySelectorAll('.mr-dot') : [];

    // ================================================================
// ДИНАМИЧЕСКИЕ ПРОМО-БАННЕРЫ В СЛАЙДЕРЕ (ПАРТНЕР + ВНУТРЕННИЕ)
// ================================================================
window.copyPromoCode = async function(event, code, btnEl) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    if (!code) return;

    let copied = false;
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(code);
            copied = true;
        }
    } catch (e) {}

    // Фоллбэк для мобильных WebView, где clipboard API иногда капризничает
    if (!copied) {
        try {
            const ta = document.createElement('textarea');
            ta.value = code;
            ta.style.cssText = 'position:fixed; top:-9999px; opacity:0;';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
            copied = true;
        } catch (e) {}
    }

    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.('success');

    if (btnEl) {
        const oldHtml = btnEl.innerHTML;
        btnEl.innerHTML = '<i class="fa-solid fa-check" style="color:#34c759;"></i>';
        setTimeout(() => { btnEl.innerHTML = oldHtml; }, 1500);
    }
};

window.openPromoPartnerLink = function(event, url) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    if (!url) return;
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('light');
    if (window.Telegram?.WebApp?.openLink) {
        window.Telegram.WebApp.openLink(url);
    } else {
        window.open(url, '_blank');
    }
};

window.quickActivatePromo = function(event, code) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    if (typeof window.openCouponModal === 'function') {
        window.openCouponModal();
        const input = document.getElementById('coupon-input');
        if (input) input.value = code;
    }
};

function renderPromoBanners(banners) {
    const wrapper = document.querySelector('#main-slider-container .slider-wrapper');
    if (!wrapper) return;

    // Удаляем прошлые динамические промо-слайды перед перерисовкой
    wrapper.querySelectorAll('.promo-banner-slide').forEach(el => el.remove());

    if (!Array.isArray(banners) || banners.length === 0) return;

    banners.forEach((b) => {
        const isPartner = b.type === 'partner';
        const safeCode = escapeHTML(b.code || '');
        const safeTitle = escapeHTML(b.title || (isPartner ? 'Промокод партнера' : 'Промокод дня'));
        const safeUrl = (b.target_url || '').replace(/'/g, "\\'");
        const safeJsCode = (b.code || '').replace(/'/g, "\\'");
        const accent = b.accent_color || (isPartner ? '#ffd700' : '#9146ff');

        // Фон: картинка из админки + темный градиент, чтобы текст всегда читался
        const bgStyle = b.image_url
            ? `background: linear-gradient(95deg, rgba(16,16,20,0.92) 0%, rgba(16,16,20,0.72) 55%, rgba(16,16,20,0.45) 100%), url('${escapeHTML(b.image_url)}') center/cover no-repeat;`
            : `background: linear-gradient(135deg, #1f1f26 0%, #141418 100%);`;

        // Нижняя строка: для партнера — дисклеймер про лимит, для нашего — реальный счётчик
        let subInfoHtml = '';
        if (isPartner) {
            const limitPrefix = b.limit_label ? `Лимит: ${escapeHTML(b.limit_label)} • ` : '';
            const disclaimer = escapeHTML(b.disclaimer || 'Серия ограничена, проверяйте наличие у партнера');
            subInfoHtml = `<div style="font-size: 9px; color: rgba(255,255,255,0.65); line-height: 1.25; margin-top: 4px;">${limitPrefix}${disclaimer}</div>`;
        } else {
            const used = Number(b.activations_count || 0);
            const max = b.max_activations ? Number(b.max_activations) : null;
            const isOut = max !== null && used >= max;
            const counterText = max !== null
                ? (isOut ? 'Все активации разобрали' : `Активировали: ${used} из ${max}`)
                : `Активировали: ${used}`;
            subInfoHtml = `<div style="font-size: 9.5px; font-weight: 700; color: ${isOut ? '#ff453a' : '#4ade80'}; margin-top: 4px;">
                <i class="fa-solid ${isOut ? 'fa-circle-xmark' : 'fa-fire'}" style="margin-right: 3px;"></i>${counterText}
            </div>`;
        }

        // Кнопка действия справа/снизу
        const actionBtnHtml = isPartner
            ? `<button type="button" onclick="openPromoPartnerLink(event, '${safeUrl}')" style="background: ${accent}; color: #000; border: none; border-radius: 9px; padding: 7px 11px; font-size: 10px; font-weight: 900; text-transform: uppercase; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.35);">
                   ${escapeHTML(b.cta_text || 'Перейти')} <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 9px;"></i>
               </button>`
            : `<button type="button" onclick="quickActivatePromo(event, '${safeJsCode}')" style="background: linear-gradient(135deg, #9146ff 0%, #6a11cb 100%); color: #fff; border: none; border-radius: 9px; padding: 7px 11px; font-size: 10px; font-weight: 900; text-transform: uppercase; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; box-shadow: 0 4px 12px rgba(145,70,255,0.35);">
                   <i class="fa-solid fa-ticket-simple" style="font-size: 9px;"></i> Ввести
               </button>`;

        const slide = document.createElement('div');
        slide.className = 'slide promo-banner-slide';
        slide.dataset.event = `promo_${b.id}`;
        slide.dataset.promoSig = `promo_${b.id}_${b.code}_${b.activations_count || 0}`;
        slide.style.cssText = `${bgStyle} border-radius: 16px; box-sizing: border-box; padding: 12px 14px; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; border: 1px solid rgba(255,255,255,0.08);`;

        slide.innerHTML = `
            <div style="display: flex; align-items: center; gap: 6px; padding-right: 45px;">
                <span style="font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.6px; color: ${accent}; background: rgba(0,0,0,0.45); border: 1px solid ${accent}55; padding: 2px 7px; border-radius: 6px;">
                    ${isPartner ? 'Партнер' : 'Бонус дня'}
                </span>
                <span style="font-size: 13px; font-weight: 900; color: #fff; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 2px 6px rgba(0,0,0,0.8);">
                    ${safeTitle}
                </span>
            </div>

            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 6px;">
                <div style="display: inline-flex; align-items: center; gap: 6px; background: rgba(0,0,0,0.55); border: 1px dashed ${accent}88; border-radius: 9px; padding: 5px 8px 5px 10px; max-width: 60%; backdrop-filter: blur(6px);">
                    <span style="font-family: 'SF Mono', Consolas, monospace; font-size: 13px; font-weight: 900; color: #fff; letter-spacing: 0.8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${safeCode}
                    </span>
                    <button type="button" onclick="copyPromoCode(event, '${safeJsCode}', this)" style="background: rgba(255,255,255,0.12); color: #fff; border: none; border-radius: 6px; width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;">
                        <i class="fa-regular fa-copy" style="font-size: 11px;"></i>
                    </button>
                </div>
                ${actionBtnHtml}
            </div>

            ${subInfoHtml}
        `;

        wrapper.appendChild(slide);
    });
}

    function showSlide(index) {
        if (index >= visibleSlides.length) index = 0; 
        if (index < 0) index = visibleSlides.length - 1;
        
        visibleSlides.forEach((slide, i) => {
            if (i === index) {
                slide.style.opacity = '1';
                slide.style.pointerEvents = 'auto';
                slide.style.zIndex = '5';
                if (dots[i]) {
                    dots[i].style.background = 'var(--primary-color, #ffd700)';
                    dots[i].style.width = '14px';
                    dots[i].style.borderRadius = '4px';
                    dots[i].style.boxShadow = '0 0 8px rgba(255,215,0,0.5)';
                }
            } else {
                slide.style.opacity = '0';
                slide.style.pointerEvents = 'none';
                slide.style.zIndex = '1';
                if (dots[i]) {
                    dots[i].style.background = 'rgba(255,255,255,0.2)';
                    dots[i].style.width = '6px';
                    dots[i].style.borderRadius = '50%';
                    dots[i].style.boxShadow = 'none';
                }
            }
        });
        currentSlideIndex = index;
    }
    
    function nextSlide() { showSlide(currentSlideIndex + 1); }
    function prevSlide() { showSlide(currentSlideIndex - 1); }
    function resetSlideInterval() { 
        clearInterval(slideInterval); 
        if (visibleSlides.length > 1) {
            slideInterval = setInterval(nextSlide, 5000); 
        }
    }

    let touchStartX = 0, touchStartY = 0, touchEndX = 0, isSwiping = false;
    container.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; touchEndX = touchStartX; isSwiping = false;
    }, { passive: true, signal });

    container.addEventListener('touchmove', (e) => {
        if (touchStartX === 0 && touchStartY === 0) return;
        const diffX = touchStartX - e.touches[0].clientX; const diffY = touchStartY - e.touches[0].clientY;
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 10) {
            isSwiping = true; if (e.cancelable) { e.preventDefault(); e.stopPropagation(); }
        }
        touchEndX = e.touches[0].clientX;
    }, { passive: false, signal });

    container.addEventListener('touchend', (e) => {
        if (isSwiping) {
            e.stopPropagation(); const diff = touchStartX - touchEndX;
            if (Math.abs(diff) > 50) { if (diff > 0) nextSlide(); else prevSlide(); resetSlideInterval(); }
        }
        touchStartX = 0; touchStartY = 0; isSwiping = false;
    }, { passive: true, signal });
    
    allSlides.forEach(slide => {
        slide.onclick = (e) => { if (isSwiping) { e.preventDefault(); e.stopPropagation(); return false; } };
    });

    if (currentSlideIndex >= visibleSlides.length) currentSlideIndex = 0;
    showSlide(currentSlideIndex); 
    resetSlideInterval();
}

function updateShortcutStatuses(userData, allQuests) {
    const chalStatus = document.getElementById('metro-challenge-status');
    const chalFill = document.getElementById('metro-challenge-fill');
    if (chalStatus && chalFill) {
        if (!userData.is_stream_online) {
            chalStatus.textContent = 'ОФФЛАЙН'; chalStatus.style.color = '#ff453a'; chalFill.style.width = '0%';
        } else if (userData.challenge) {
            const ch = userData.challenge;
            const prog = ch.progress_value || 0, target = ch.target_value || 1;
            if (ch.claimed_at) { chalStatus.textContent = "ПОЛУЧЕНО"; chalStatus.classList.add('metro-status-done'); chalFill.style.width = '100%'; }
            else if (prog >= target) { chalStatus.textContent = "ЗАБРАТЬ!"; chalStatus.classList.add('metro-status-done'); chalFill.style.width = '100%'; }
            else { chalStatus.textContent = `${prog} / ${target}`; chalStatus.classList.remove('metro-status-done'); chalStatus.style.color=''; chalFill.style.width = `${(prog/target)*100}%`; }
        } else {
            chalStatus.textContent = "Нет активного"; chalFill.style.width = '0%';
        }
    }

    const questStatus = document.getElementById('metro-quest-status');
    const questFill = document.getElementById('metro-quest-fill');
    if (questStatus && questFill) {
        if (!userData.active_quest_id) {
            questStatus.innerHTML = userData.is_stream_online ? '<i class="fa-brands fa-twitch"></i> Выбрать' : '<i class="fa-brands fa-telegram"></i> Выбрать';
            questFill.style.width = '0%'; questStatus.classList.remove('metro-status-done'); questStatus.style.color='';
        } else {
            const quest = allQuests.find(q => q.id === userData.active_quest_id);
            if (quest) {
                const prog = userData.active_quest_progress || 0, target = quest.target_value || 1;
                if (prog >= target) { questStatus.textContent = "ГОТОВО"; questStatus.classList.add('metro-status-done'); questFill.style.width = '100%'; }
                else { questStatus.textContent = `${prog} / ${target}`; questStatus.classList.remove('metro-status-done'); questStatus.style.color=''; questFill.style.width = `${(prog/target)*100}%`; }
            } else { questStatus.textContent = "..."; }
        }
    }
}

function updateShopTile(status) {
    const shopTile = document.getElementById('shortcut-shop');
    if (!shopTile) return;
    const safeStatus = status || 'none';
    shopTile.dataset.status = safeStatus;

    const stages = {
        'creating': { label: 'ЗАЯВКА СОЗДАНА', sub: 'Ожидание...', icon: '<i class="fa-regular fa-clock"></i>', bg: 'linear-gradient(135deg, #6a11cb 0%, #2575fc 100%)' },
        'sending': { label: 'ПРОВЕРКА АДМИНОМ', sub: 'Ожидайте...', icon: '<i class="fa-solid fa-hourglass-half fa-spin"></i>', bg: 'linear-gradient(135deg, #2AABEE, #229ED9)' },
        'confirming': { label: 'ТРЕБУЕТ ДЕЙСТВИЯ', sub: 'Передайте скин!', icon: '<i class="fa-solid fa-fire fa-beat"></i>', bg: 'linear-gradient(135deg, #ff3b30, #ff9500)' },
        'failed': { label: 'ОТМЕНЕНО', sub: 'Попробуйте снова', icon: '<i class="fa-solid fa-circle-xmark"></i>', bg: 'linear-gradient(135deg, #ff3b30 0%, #ff453a 100%)' }
    };

    const stage = stages[safeStatus];
    if (!stage) {
        shopTile.style.background = ''; shopTile.style.animation = '';
        shopTile.innerHTML = `<div class="metro-tile-bg-icon"><i class="fa-solid fa-cart-shopping"></i></div><div class="metro-content"><div class="metro-icon-main"><i class="fa-solid fa-cart-shopping"></i></div><span class="metro-label">Магазин</span><span class="metro-sublabel">Кейсы и предметы</span></div>`;
        return;
    }
    shopTile.style.background = stage.bg;
    shopTile.style.animation = safeStatus === 'confirming' ? 'statusPulse 2s infinite' : '';
    shopTile.innerHTML = `<div class="metro-tile-bg-icon" style="opacity:0.15">${stage.icon}</div><div class="metro-content"><div class="metro-icon-main" style="color:#fff;">${stage.icon}</div><span class="metro-label" style="color:#fff;">${stage.label}</span><span class="metro-sublabel" style="color: #fff;">${stage.sub}</span></div>`;
}

// Рефералка
async function checkReferralAndWelcome(userData) {
    console.log('[BONUS INIT] 🔍 Начинаем проверку приветственного бонуса. userData:', userData);
    const rawParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param || null;
    const bonusBtn = document.getElementById('open-bonus-btn');
    let validRefCode = null;
    
    console.log('[BONUS INIT] 🔑 start_param из Telegram:', rawParam);

    if (rawParam && rawParam.startsWith('r_')) { 
        validRefCode = rawParam; 
        localStorage.setItem('cached_referral_code', validRefCode); 
        console.log('[BONUS INIT] 💾 Сохранили новый реф-код в кэш:', validRefCode);
    }

    if (userData.referral_activated_at) {
        console.log('[BONUS INIT] ✅ Рефералка уже была активирована ранее. Скрываем бонус.');
        if (bonusBtn) bonusBtn.classList.add('hidden');
        localStorage.removeItem('openRefPopupOnLoad'); localStorage.removeItem('cached_referral_code'); localStorage.removeItem('pending_ref_code');
        return; 
    }

    const codeToPass = validRefCode || localStorage.getItem('cached_referral_code');
    const shouldShowBonus = userData.referrer_id || codeToPass;

    console.log('[BONUS INIT] 📊 Итог проверок: shouldShowBonus=', !!shouldShowBonus, '| codeToPass=', codeToPass);

    if (shouldShowBonus) {
        if (bonusBtn) { 
            bonusBtn.classList.remove('hidden'); 
            bonusBtn.onclick = () => {
                console.log('[BONUS INIT] 🖱 Клик по кнопке "Открыть бонус" в интерфейсе');
                openWelcomePopup(userData, codeToPass);
            }; 
        }
        
        const openOnLoad = localStorage.getItem('openRefPopupOnLoad');
        const isDeferred = localStorage.getItem('bonusPopupDeferred');
        
        console.log(`[BONUS INIT] 🚦 Флаги: openOnLoad=${openOnLoad}, isDeferred=${isDeferred}`);

        if (openOnLoad) {
            console.log('[BONUS INIT] 🚀 Принудительное открытие окна после возврата из OAuth (Twitch)');
            openWelcomePopup(userData, localStorage.getItem('pending_ref_code') || codeToPass);
            localStorage.removeItem('openRefPopupOnLoad');
        } else if (!isDeferred) {
            console.log('[BONUS INIT] 🚀 Автоматическое открытие окна (пользователь еще не нажимал "Позже")');
            openWelcomePopup(userData, codeToPass);
        } else {
            console.log('[BONUS INIT] ⏳ Пользователь ранее нажал "Позже". Окно ждет ручного клика.');
        }
    } else { 
        console.log('[BONUS INIT] 🚫 Нет реферала или кода. Бонус не положен.');
        if (bonusBtn) bonusBtn.classList.add('hidden'); 
    }
}

// ================================================================
// УТИЛИТЫ ДЛЯ ПРИВЕТСТВЕННОГО БОНУСА (ОТРИСОВКА ШАГОВ)
// ================================================================
function markStepDone(stepEl, iconEl) {
    if (stepEl) {
        stepEl.style.border = '1px solid rgba(52, 199, 89, 0.4)';
        stepEl.style.background = 'rgba(52, 199, 89, 0.1)';
    }
    if (iconEl) {
        iconEl.className = 'fa-solid fa-circle-check';
        iconEl.style.color = '#34c759';
    }
}

function markStepError(stepEl, iconEl) {
    if (stepEl) {
        stepEl.style.border = '1px solid rgba(255, 59, 48, 0.4)';
        stepEl.style.background = 'rgba(255, 59, 48, 0.1)';
    }
    if (iconEl) {
        iconEl.className = 'fa-solid fa-circle-xmark';
        iconEl.style.color = '#ff3b30';
    }
}

function markStepPending(stepEl, iconEl) {
    if (stepEl) {
        stepEl.style.border = '1px solid rgba(255, 215, 0, 0.4)';
        stepEl.style.background = 'rgba(255, 215, 0, 0.1)';
    }
    if (iconEl) {
        iconEl.className = 'fa-solid fa-spinner fa-spin';
        iconEl.style.color = '#ffd700';
    }
}

// 🔥 ШПИОН ЗА КЛИКАМИ 🔥
document.addEventListener('click', (e) => {
    console.log('[DEBUG CLICK] Вы кликнули на элемент:', e.target);
}, true);

// ================================================================
// БРОНЕБОЙНАЯ ФУНКЦИЯ ПРИВЕТСТВЕННОГО БОНУСА (С ЛОГАМИ)
// ================================================================
async function openWelcomePopup(currentUserData, referralCode = null) {
    console.log('[BONUS] 🚀 Инициализация окна приветственного бонуса');
    
    try {
        const popup = document.getElementById('welcome-popup');
        if (!popup) {
            console.error('[BONUS] ❌ Элемент #welcome-popup не найден в DOM!');
            return;
        }

        // 🔥 ЖЕСТКАЯ БРОНЯ ОТ ПЕРЕКРЫТИЯ СЛОЯМИ (z-index)
        popup.style.zIndex = '999999';
        popup.style.pointerEvents = 'auto';

        const laterBtn = document.getElementById('later-btn');
        const actionBtn = document.getElementById('action-btn');
        const stepTwitch = document.getElementById('step-twitch');
        const stepTg = document.getElementById('step-tg');
        
        let userData = currentUserData || {};
        console.log('[BONUS] Данные юзера на старте:', userData);

        popup.classList.remove('hidden');
        popup.classList.add('visible');

        if (actionBtn) {
            actionBtn.disabled = false;
            actionBtn.textContent = "Проверка..."; 
            actionBtn.style.background = ""; 
        }

        // 🔥 Логика кнопки "Позже"
        if (laterBtn) {
            laterBtn.onclick = (e) => {
                console.log('[BONUS] 🛑 Нажата кнопка "Позже", закрываем окно');
                e.preventDefault(); // Защита от всплытия
                popup.classList.remove('visible');
                setTimeout(() => popup.classList.add('hidden'), 300);
                
                localStorage.setItem('bonusPopupDeferred', 'true');
                localStorage.removeItem('openRefPopupOnLoad');
                
                const mainTriggerBtn = document.getElementById('open-bonus-btn');
                if (mainTriggerBtn) mainTriggerBtn.classList.remove('hidden');
            };
        } else {
            console.warn('[BONUS] ⚠️ Кнопка #later-btn не найдена!');
        }

        function renderTwitchSection() {
            if (!stepTwitch) {
                console.warn('[BONUS] ⚠️ Элемент #step-twitch не найден, пропускаем рендер');
                return;
            }
            
            console.log('[BONUS] Отрисовка секции Twitch. Привязан:', !!userData.twitch_id);
            
            if (!userData.twitch_id) {
                stepTwitch.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; margin-bottom: 12px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <i class="fa-brands fa-twitch" style="font-size: 20px; color: #9146ff; width: 24px; text-align: center;"></i>
                            <div style="text-align: left;">
                                <div style="font-weight: 500; font-size: 14px; color: #fff;">Привязка Twitch</div>
                                <div style="font-size: 11px; color: #aaa;">Обязательно для бонуса</div>
                            </div>
                        </div>
                        <i id="icon-twitch" class="fa-regular fa-circle" style="color: #aaa; font-size: 16px;"></i>
                    </div>
                    <div style="display: flex; gap: 8px; width: 100%;">
                        <button id="twitch-help-btn-popup" style="background-color: rgba(145, 70, 255, 0.2); color: #9146ff; border: 1px solid rgba(145, 70, 255, 0.4); border-radius: 8px; width: 42px; height: 36px; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;"><i class="fa-solid fa-question" style="font-size: 16px;"></i></button>
                        <button id="connect-twitch-btn-popup" style="background-color: #9146ff; color: white; border: none; border-radius: 8px; height: 36px; flex-grow: 1; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 13px;"><i class="fa-brands fa-twitch"></i> Привязать</button>
                    </div>`;
                stepTwitch.onclick = null;
                stepTwitch.style.cursor = 'default';
                stepTwitch.style.display = 'block';
                stepTwitch.style.padding = '12px';

                const btnConnect = document.getElementById('connect-twitch-btn-popup');
                const btnHelp = document.getElementById('twitch-help-btn-popup');

                if (btnConnect) {
                    btnConnect.onclick = async (e) => {
                        console.log('[BONUS] 🔗 Запуск процесса привязки Twitch');
                        e.preventDefault(); e.stopPropagation();
                        const originalText = btnConnect.innerHTML;
                        
                        if (referralCode) localStorage.setItem('pending_ref_code', referralCode);
                        else {
                            const cached = localStorage.getItem('cached_referral_code');
                            if (cached) localStorage.setItem('pending_ref_code', cached);
                        }

                        btnConnect.style.opacity = '0.7';
                        btnConnect.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; 
                        try {
                            if (!window.Telegram?.WebApp?.initData) {
                                console.error('[BONUS] ❌ Нет initData для привязки Twitch');
                                return;
                            }
                            localStorage.setItem('auth_source', 'menu');
                            
                            console.log('[BONUS] Отправка запроса на получение URL OAuth...');
                            const response = await fetch(`/api/v1/auth/twitch_oauth?initData=${encodeURIComponent(window.Telegram.WebApp.initData)}&redirect=/`);
                            
                            if (!response.ok) throw new Error(`Ошибка сервера: ${response.status}`);
                            const data = await response.json();
                            
                            console.log('[BONUS] Получен URL OAuth:', data.url);
                            if (data.url) {
                                localStorage.setItem('openRefPopupOnLoad', 'true');
                                window.Telegram.WebApp.openLink(data.url);
                                window.Telegram.WebApp.close(); 
                            }
                        } catch (err) {
                            console.error('[BONUS] ❌ Ошибка при получении ссылки Twitch:', err);
                            if(window.Telegram?.WebApp) window.Telegram.WebApp.showAlert("Ошибка: " + err.message);
                            btnConnect.style.opacity = '1';
                            btnConnect.innerHTML = originalText;
                        }
                    };
                }
                if (btnHelp) {
                    btnHelp.onclick = (e) => { 
                        e.stopPropagation(); 
                        popup.classList.remove('visible'); 
                        const sosOverlay = document.getElementById('sos-modal-overlay');
                        if (sosOverlay) sosOverlay.classList.remove('hidden'); 
                    };
                }
            } else {
                stepTwitch.innerHTML = `
                     <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <i class="fa-brands fa-twitch" style="font-size: 20px; color: #9146ff; width: 24px; text-align: center;"></i>
                            <div style="text-align: left;">
                                <div style="font-weight: 500; font-size: 14px; color: #fff;">Twitch привязан</div>
                                <div style="font-size: 11px; color: #aaa;">Аккаунт подключен</div>
                            </div>
                        </div>
                        <i id="icon-twitch" class="fa-solid fa-circle-check" style="color: #34c759; font-size: 16px;"></i>
                    </div>`;
                stepTwitch.style.cursor = 'pointer';
                stepTwitch.style.display = 'flex'; 
                stepTwitch.style.padding = '16px';
                stepTwitch.onclick = () => { if(window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.notificationOccurred('success'); };
                
                const iconTwitch = document.getElementById('icon-twitch'); 
                markStepDone(stepTwitch, iconTwitch);
            }
        }

        renderTwitchSection();

        if (stepTg) {
            stepTg.onclick = () => { 
                console.log('[BONUS] Переход в TG канал');
                if(window.Telegram?.WebApp) window.Telegram.WebApp.openTelegramLink('https://t.me/hatelove_ttv'); 
            };
        }

        const sosCloseBtn = document.getElementById('sos-close-btn');
        const sosAdminBtn = document.getElementById('sos-admin-btn');
        if (sosCloseBtn) sosCloseBtn.onclick = () => { 
            const sosOverlay = document.getElementById('sos-modal-overlay');
            if(sosOverlay) sosOverlay.classList.add('hidden'); 
            popup.classList.add('visible'); 
        };
        if (sosAdminBtn) sosAdminBtn.onclick = () => { 
            if(window.Telegram?.WebApp) window.Telegram.WebApp.openTelegramLink('https://t.me/hatelove_twitch'); 
        };

        // 🔥 Выделяем логику проверки в защищенный блок
        async function runCheck(isManualClick = false) {
            console.log(`[BONUS] 🔄 Запуск проверки условий (Ручной клик: ${isManualClick})`);
            try {
                if (!popup.classList.contains('visible') || !actionBtn) {
                    console.log('[BONUS] Окно скрыто или нет кнопки, отмена проверки.');
                    return; 
                }
                if (actionBtn.textContent.includes("ЗАБРАТЬ") && !isManualClick) return;

                actionBtn.disabled = true;
                actionBtn.textContent = "Проверка...";
                actionBtn.style.background = "#3a3a3c"; 
                
                const curIconTg = document.getElementById('icon-tg');
                const curIconTwitch = document.getElementById('icon-twitch');

                if (curIconTg && !curIconTg.classList.contains('fa-circle-check')) curIconTg.className = "fa-solid fa-spinner fa-spin";
                if (curIconTwitch && !curIconTwitch.classList.contains('fa-circle-check')) curIconTwitch.className = "fa-solid fa-spinner fa-spin";

                let tgOk = false;
                let checkFailed = false;

                // 1. Безопасная проверка Telegram
                try {
                    const initData = window.Telegram?.WebApp?.initData || '';
                    console.log('[BONUS] Отправка запроса проверки TG подписки...');
                    const tgRes = await makeApiRequest('/api/v1/user/check_subscription', { initData: initData }, 'POST', true);
                    console.log('[BONUS] Ответ проверки TG подписки:', tgRes);
                    if (tgRes && tgRes.is_subscribed) tgOk = true;
                } catch(e) { 
                    checkFailed = true; 
                    console.warn("[BONUS] ⚠️ Ошибка при проверке подписки TG:", e);
                }

                // 2. Безопасная проверка Twitch (обновляем бутстрап)
                try {
                    console.log('[BONUS] Отправка запроса bootstrap для проверки Twitch...');
                    const fresh = await makeApiRequest('/api/v1/bootstrap', {}, 'POST', true);
                    if (fresh && fresh.user) {
                        userData = fresh.user; 
                        if (window.userData) window.userData = fresh.user;
                        console.log('[BONUS] Получен свежий юзер:', userData.twitch_id ? 'Twitch привязан' : 'Twitch НЕТ');
                        renderTwitchSection(); // Перерисовываем актуальные данные
                    }
                } catch (e) { 
                    console.warn("[BONUS] ⚠️ Ошибка при обновлении бутстрапа:", e); 
                }

                const twitchOk = !!userData.twitch_id;
                console.log(`[BONUS] Итоги проверок -> TG_OK: ${tgOk}, TWITCH_OK: ${twitchOk}, FAILED: ${checkFailed}`);

                if (!popup.classList.contains('visible')) return;

                // Визуал проверки TG
                if (!checkFailed) {
                    if (tgOk) markStepDone(stepTg, document.getElementById('icon-tg')); 
                    else markStepError(stepTg, document.getElementById('icon-tg'));
                } else {
                    markStepPending(stepTg, document.getElementById('icon-tg'));
                }

                // Визуал проверки Twitch
                if (twitchOk) markStepDone(stepTwitch, document.getElementById('icon-twitch')); 
                else markStepError(stepTwitch, document.getElementById('icon-twitch'));

                // Итоговое решение по кнопке
                if (tgOk && twitchOk) {
                    console.log('[BONUS] ✅ Все условия выполнены, активируем кнопку получения!');
                    if(window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
                    actionBtn.disabled = false;
                    actionBtn.innerHTML = "ЗАБРАТЬ БОНУС 🎁";
                    actionBtn.style.background = "#FFD700";
                    actionBtn.style.color = "#000";
                    actionBtn.style.fontWeight = "800";
                    actionBtn.onclick = async () => {
                        console.log('[BONUS] 🎁 Отправка запроса на получение бонуса');
                        actionBtn.disabled = true;
                        actionBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Забираем...';
                        const finalRefCode = referralCode || localStorage.getItem('pending_ref_code') || localStorage.getItem('cached_referral_code');
                        
                        try {
                            const response = await fetch('/api/v1/user/referral/activate', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ initData: window.Telegram?.WebApp?.initData || '', referral_code: finalRefCode })
                            });
                            const res = await response.json();
                            console.log('[BONUS] Ответ активации:', res);

                            if (response.ok) {
                                if(window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
                                actionBtn.textContent = "Готово!";
                                document.getElementById('open-bonus-btn')?.classList.add('hidden');
                                localStorage.removeItem('openRefPopupOnLoad');
                                localStorage.removeItem('bonusPopupDeferred');
                                localStorage.removeItem('pending_ref_code');
                                localStorage.removeItem('cached_referral_code');
                                setTimeout(() => {
                                    popup.classList.remove('visible');
                                    popup.classList.add('hidden');
                                    const successModal = document.getElementById('subscription-success-modal');
                                    if (successModal) { successModal.classList.remove('hidden'); successModal.classList.add('visible'); }
                                    refreshDataSilently(); 
                                }, 500);
                            } else {
                                console.warn('[BONUS] ❌ Сервер отказал в выдаче бонуса:', res);
                                if(window.Telegram?.WebApp) window.Telegram.WebApp.showAlert(res.detail || "Ошибка");
                                actionBtn.disabled = false;
                                actionBtn.textContent = "ЗАБРАТЬ БОНУС 🎁";
                            }
                        } catch(e) {
                            console.error('[BONUS] ❌ Критическая ошибка сети при получении бонуса:', e);
                            if(window.Telegram?.WebApp) window.Telegram.WebApp.showAlert("Ошибка сети");
                            actionBtn.disabled = false;
                            actionBtn.textContent = "ЗАБРАТЬ БОНУС 🎁";
                        }
                    };
                } else {
                    console.log('[BONUS] ❌ Условия не выполнены, возвращаем кнопку в статус проверки.');
                    if(!checkFailed && window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
                    actionBtn.disabled = false;
                    actionBtn.textContent = "Проверить снова";
                    actionBtn.onclick = () => runCheck(true); 
                }

            } catch (e) {
                console.error("[BONUS] ❌ Непредвиденная ошибка в runCheck:", e);
                if (actionBtn) {
                    actionBtn.disabled = false;
                    actionBtn.textContent = "Ошибка проверки";
                    actionBtn.onclick = () => runCheck(true);
                }
            }
        }

        // Запускаем первую проверку с задержкой
        setTimeout(() => { runCheck(false); }, 400);

    } catch (globalErr) {
        console.error("[BONUS] ❌ Глобальная критическая ошибка в openWelcomePopup:", globalErr);
    }
}
// Подарки
async function checkGift() {
    if (!bonusGiftEnabled) {
        if(dom.giftContainer) dom.giftContainer.classList.add('hidden');
        return; 
    }
    try {
        const res = await makeApiRequest('/api/v1/gift/check', {}, 'POST', true);
        if (res && res.available) { if(dom.giftContainer) dom.giftContainer.classList.remove('hidden'); }
        else { if(dom.giftContainer) dom.giftContainer.classList.add('hidden'); }
    } catch (e) {}
}

// Вспомогательная функция для склонения слов
function declOfNum(number, titles) {
    const cases = [2, 0, 1, 1, 1, 2];
    return titles[ (number % 100 > 4 && number % 100 < 20) ? 2 : cases[(number % 10 < 5) ? number % 10 : 5] ];
}

function renderGiftResult(result) {
    // 1. Прячем начальный экран подарка и показываем экран результата
    dom.giftContentInitial.classList.add('hidden'); 
    dom.giftContentResult.classList.remove('hidden');
    
    // Прячем кнопку "Открыть", если она есть
    const giftBtn = document.getElementById('daily-gift-btn'); 
    if (giftBtn) giftBtn.style.display = 'none'; 
    
    // Прячем сам контейнер подарка на фоне и жестко скрываем блок с промокодом
    dom.giftContainer.classList.add('hidden'); 
    dom.giftPromoBlock.classList.add('hidden'); 

    // 2. ОТРИСОВКА ИКОНКИ И ТЕКСТА НАГРАДЫ (СЕРВЕРНОЙ!)
    if (result.type === 'tickets') { 
        dom.giftResultIcon.innerHTML = "🎟️"; 
        const ticketWord = declOfNum(result.value, ['билет', 'билета', 'билетов']);
        dom.giftResultText.innerHTML = `Вы получили <b>${result.value}</b>&nbsp;${ticketWord}!`; 
    } 
    else if (result.type === 'coins') { 
        dom.giftResultIcon.innerHTML = "💰"; 
        const coinWord = declOfNum(result.value, ['монету', 'монеты', 'монет']);
        dom.giftResultText.innerHTML = `Вы получили <b>${result.value}</b>&nbsp;${coinWord}!`; 
    } 
    else if (result.type === 'skin') { 
        // Если вдруг вернешь скины, логика останется рабочей
        dom.giftResultIcon.innerHTML = `<img src="${escapeHTML(result.meta?.image_url || '')}" style="width:100px; height:100px; object-fit:contain;">`; 
        dom.giftResultText.innerHTML = `<b>${escapeHTML(result.meta?.name || 'Скин')}</b>`; 
    }

    // 3. ОТРИСОВКА ЗАГОЛОВКА И КНОПКИ ЗАКРЫТИЯ (В зависимости от подписки)
    if (result.subscription_required) {
        // ЮЗЕР НЕ ПОДПИСАН (Дразнилка)
        
        // Возвращаем кнопку подарка, чтобы он мог нажать ее снова после подписки
        if (giftBtn) giftBtn.style.display = 'flex'; 
        
        dom.giftResultTitle.textContent = "ПОЧТИ ТВОЁ!"; 
        dom.giftResultTitle.style.color = "#ff3b30";
        
        dom.giftCloseBtn.textContent = "Подписаться и забрать"; 
        dom.giftCloseBtn.style.background = "#0088cc";
        
        // Кнопка ведет на канал
        dom.giftCloseBtn.onclick = (e) => { 
    e.preventDefault(); 
    if (window.Telegram?.WebApp?.openTelegramLink) {
        window.Telegram.WebApp.openTelegramLink("https://t.me/hatelove_ttv"); 
    } else {
        window.open("https://t.me/hatelove_ttv", "_blank");
    }
    dom.giftModalOverlay.classList.add('hidden'); 
    unlockAppScroll(); 
};
    } else {
        // ЮЗЕР ПОДПИСАН (Реальная награда)
        
        dom.giftResultTitle.textContent = "Поздравляем!"; 
        dom.giftResultTitle.style.color = "#34c759";
        
        dom.giftCloseBtn.textContent = "Круто!"; 
        dom.giftCloseBtn.style.background = "#555";
        
        // Кнопка просто закрывает модалку
        dom.giftCloseBtn.onclick = () => { 
            dom.giftModalOverlay.classList.add('hidden'); 
            unlockAppScroll(); 
        };
    }
}

// Туториал
const tutorialSteps = [
    { element: '.top-header', title: 'Ваш Профиль и Баланс', text: 'Сверху находится ваш профиль и баланс монет/билетов.' },
    { element: '#main-slider-container', title: 'Актуальные События', text: 'В этом слайдере находятся различные мероприятия!' },
    { element: '#shortcut-quests', title: 'Задания', text: 'Выполняйте задания и получайте награды.' },
    { element: '.toggle-container', title: 'Магазин Скинов', text: 'Переключайтесь на вкладку КЕЙСЫ, чтобы обменивать звезды на скины!' }
];
let currentTutorialStep = 0;

function showTutorialStep(stepIndex) {
    document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
    if (stepIndex >= tutorialSteps.length) { dom.tutorialOverlay.classList.add('hidden'); return; }
    
    let step = tutorialSteps[stepIndex];
    setTimeout(() => {
        const element = document.querySelector(step.element);
        if (element) {
            element.classList.add('tutorial-highlight');
            dom.tutorialTitle.textContent = step.title;
            dom.tutorialText.innerHTML = step.text;
            dom.tutorialStepCounter.textContent = `Шаг ${stepIndex + 1} из ${tutorialSteps.length}`;
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 150); 
}
function startTutorial() { currentTutorialStep = 0; dom.tutorialOverlay.classList.remove('hidden'); showTutorialStep(currentTutorialStep); }
if(dom.tutorialNextBtn) dom.tutorialNextBtn.onclick = () => { currentTutorialStep++; showTutorialStep(currentTutorialStep); };
if(dom.tutorialSkipBtn) dom.tutorialSkipBtn.onclick = () => { dom.tutorialOverlay.classList.add('hidden'); document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight')); };

// ================================================================
// ГЛАВНЫЙ РЕНДЕР 
// ================================================================
function hexToRgb(hex) { const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex); return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '255, 215, 0'; }


// ================================================================
// СОЧНАЯ КАРТОЧКА АУКЦИОНА НА ГЛАВНОЙ
// ================================================================
const RARITY_COLORS = {
    common: '#b0c3d9',      // Ширпотреб
    uncommon: '#5e98d9',    // Промышленное
    rare: '#4b69ff',        // Армейское
    mythical: '#8847ff',    // Запрещенное
    legendary: '#d32ce6',   // Засекреченное
    ancient: '#eb4b4b',     // Тайное
    immortal: '#e4ae39'     // Нож
};

function initDynamicAuction(preloadedData = null) {
    const container = document.getElementById('auction-card-container');
    if (!container) return;

    container.style.minHeight = '120px';

    const renderAuction = (data) => {
        let arr = [];
        if (Array.isArray(data)) arr = data;
        else if (data && Array.isArray(data.auctions)) arr = data.auctions;
        else if (data && Array.isArray(data.active_auctions)) arr = data.active_auctions;
        else if (data && Array.isArray(data.data)) arr = data.data;

        const activeAuction = arr.find(a => !a.ended_at);

        // 🔥 УМНЫЙ КЭШ (АНТИ-МОРГАНИЕ): Проверяем, изменилась ли ставка или сам лот
        const signature = activeAuction ? `${activeAuction.id}_${activeAuction.current_highest_bid}` : 'empty';
        if (container.dataset.signature === signature) return; // Если всё так же - не перерисовываем!
        container.dataset.signature = signature;

        if (activeAuction) {
            const img = activeAuction.image_url || '';
            const name = (activeAuction.title || 'Секретный лот')
                .replace(/StatTrak™/g, 'ST.')
                .replace(/StatTrak/g, 'ST.');

            const currentBid = activeAuction.current_highest_bid || 0;
            const rarityKey = activeAuction.rarity || 'mythical';
            const rarityColor = RARITY_COLORS[rarityKey] || '#ff9500';

            const hexToRgb = (hex) => {
                const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '255, 149, 0';
            };
            const rgbColor = hexToRgb(rarityColor);

            container.innerHTML = `
                <div style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; padding: 8px 6px; background: linear-gradient(135deg, rgba(${rgbColor}, 0.12) 0%, #1c1c1e 80%); position: relative; overflow: hidden; box-sizing: border-box; border-radius: 18px; border: none;">
                    
                    <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 80px; height: 80px; background: rgba(${rgbColor}, 0.15); filter: blur(20px); border-radius: 50%; z-index: 0; pointer-events: none;"></div>

                    <div style="z-index: 3; text-align: center; width: 100%;">
                        <!-- 🔥 ДОБАВЛЕН line-height: 1.4 для межстрочного интервала 🔥 -->
                        <div style="font-size: 8px; font-weight: 800; color: #fff; line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${escapeHTML(name)}
                        </div>
                    </div>

                    <div style="flex: 1 1 0; min-height: 0; display: flex; align-items: center; justify-content: center; width: 100%; position: relative; z-index: 2; margin: 6px 0; transform: scale(1.15) translateY(8px);">
                        <img src="${escapeHTML(img)}" style="max-height: 100%; max-width: 100%; object-fit: contain; filter: drop-shadow(0 6px 10px rgba(0,0,0,0.6)); animation: floatSkin 4s ease-in-out infinite;">
                    </div>

                    <div style="z-index: 3; width: 100%; display: flex; justify-content: center; margin-top: auto;">
                        <div class="mini-raffle-cta" style="font-weight: bold; font-size: 11px; text-transform: uppercase; width: 95%; height: 24px; border-radius: 100px; background: #ffd700; color: #000; position: relative; overflow: hidden; display: block; padding: 0;">
                            
                            <div class="auction-button-wrapper" style="position: relative; width: 100%; height: 100%;">
                                <div class="anim-state-bid">
                                    СТАВКА: ${currentBid} <i class="fa-solid fa-ticket" style="font-size: 10px;"></i>
                                </div>

                                <div class="anim-state-action">
                                    УЧАСТВОВАТЬ <i class="fa-solid fa-arrow-right"></i>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="auction-content" style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; opacity: 0.4;">
                    <i class="fa-solid fa-gavel" style="font-size: 24px; color: #ff9500; margin-bottom: 4px;"></i>
                    <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; line-height: 1.4;">Нет лотов</span>
                </div>
            `;
        }
    };

    if (preloadedData) {
        renderAuction(preloadedData);
        return;
    }
    try {
        const cachedBootstrap = JSON.parse(localStorage.getItem('cache_bootstrap') || '{}');
        renderAuction(cachedBootstrap.auctions || cachedBootstrap.active_auctions || []);
    } catch(e) {}
}

// ================================================================
// СОЧНЫЙ МИНИ-СЛАЙДЕР РОЗЫГРЫШЕЙ В ПРАВОЙ КНОПКЕ
// ================================================================
let raffleSlideInterval = null;
let raffleTimersInterval = null;

async function initDynamicRaffleSlider(preloadedData = null) {
    const container = document.getElementById('mini-raffle-slider');
    if (!container) return;

    container.style.minHeight = '84px'; 
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.justifyContent = 'center';

    // Показываем спиннер ТОЛЬКО если это самая первая загрузка
    if (!container.dataset.signature && (!container.innerHTML.trim() || container.innerHTML.includes('РОЗЫГРЫШИ'))) {
        container.innerHTML = '<div style="width:100%; text-align:center; opacity:0.5;"><i class="fa-solid fa-spinner fa-spin" style="color:#ffd700; font-size:16px;"></i></div>';
    }

    const renderRaffles = async (data) => {
        let arr = [];
        if (Array.isArray(data)) arr = data;
        else if (data && Array.isArray(data.raffles)) arr = data.raffles;
        else if (data && Array.isArray(data.data)) arr = data.data;

        const activeRaffles = arr.filter(r => r.status === 'active').slice(0, 5);

        // 🔥 УМНЫЙ КЭШ (АНТИ-МОРГАНИЕ): Сравниваем ID и количество участников
        const signature = JSON.stringify(activeRaffles.map(r => ({ id: r.id, p: r.participants_count })));
        if (container.dataset.signature === signature) return; // Если данные 1в1 - ничего не делаем!
        container.dataset.signature = signature;

        if (activeRaffles.length > 0) {
            const imagesToLoad = activeRaffles.map(r => r.settings?.card_image || r.settings?.prize_image).filter(Boolean);
            if (imagesToLoad.length > 0) {
                await preloadImages(imagesToLoad);
            }

            let slidesHTML = '';
            
            const hexToRgb = (hex) => {
                const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '255, 215, 0';
            };

            activeRaffles.forEach((raffle, index) => {
                const s = raffle.settings || {}; 
                const img = s.card_image || s.prize_image || ''; 
                const rarityColor = s.rarity_color || '#ffd700'; 
                const quality = s.skin_quality || 'FT';
                const pCount = raffle.participants_count || 0;

                const prizeName = (s.prize_name || 'Секретный приз')
                    .replace(/StatTrak™/g, 'ST.')
                    .replace(/StatTrak/g, 'ST.');

                let dotsHTML = '<div class="mr-dots-container">';
                activeRaffles.forEach((_, dotIndex) => {
                    dotsHTML += `<div class="mr-dot ${dotIndex === index ? 'active' : ''}" style="width:6px; height:6px; border-radius:50%; background: ${dotIndex === index ? rarityColor : 'rgba(255,255,255,0.2)'}; transition: background 0.3s;"></div>`;
                });
                dotsHTML += '</div>';

                slidesHTML += `
                    <div class="mini-raffle-slide ${index === 0 ? 'active' : ''}" style="--rarity-rgb: ${hexToRgb(rarityColor)};">
                        <!-- 🔥 ДОБАВЛЕН line-height: 1.4 для межстрочного интервала 🔥 -->
                        <div class="mini-raffle-info" style="display: flex; flex-direction: column; justify-content: center; line-height: 1.4;">
                            <div class="mini-raffle-name">${escapeHTML(prizeName)}</div>
                            <div class="mini-raffle-stats" style="font-size: 10px; margin-bottom: 4px;">
                                <span style="color: ${rarityColor};">${escapeHTML(quality)}</span> • 
                                <span style="opacity:0.8;"><i class="fa-solid fa-users"></i> ${pCount}</span>
                            </div>
                            <div class="mini-raffle-timer raffle-mini-timer-dyn" data-endtime="${raffle.end_time}">
                                <span>00</span><div class="timer-sep">:</div>
                                <span>00</span><div class="timer-sep">:</div>
                                <span>00</span>
                            </div>
                            <div class="mini-raffle-cta" style="margin-top: 6px; font-weight: bold; font-size: 11px;">Участвовать <i class="fa-solid fa-arrow-right"></i></div>
                        </div> <img src="${img}" class="mini-raffle-img">
                        ${dotsHTML} 
                    </div>
                `;
            });
            
            // 🔥 УБРАНА АНИМАЦИЯ ЗАТУХАНИЯ (opacity: 0) — ТЕПЕРЬ ОНО ПРОСТО МЕНЯЕТСЯ МГНОВЕННО 🔥
            container.innerHTML = slidesHTML;
            container.style.opacity = '1';

            if (raffleTimersInterval) clearInterval(raffleTimersInterval);
            if (raffleSlideInterval) clearInterval(raffleSlideInterval);

            const updateTimers = () => {
                container.querySelectorAll('.raffle-mini-timer-dyn').forEach(el => {
                    const diff = new Date(el.dataset.endtime) - new Date();
                    if (diff <= 0) { 
                        el.innerHTML = "<span style='color:#ff3b30; font-size:10px;'>ЗАВЕРШЕН</span>"; 
                        return; 
                    }
                    
                    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
                    const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
                    const m = Math.floor((diff / (1000 * 60)) % 60);
                    const s = Math.floor((diff / 1000) % 60);
                    
                    const spans = el.querySelectorAll('span');
                    if (spans.length === 3) {
                        spans[0].innerText = d > 0 ? `${d}д ${String(h).padStart(2, '0')}` : String(h).padStart(2, '0');
                        spans[1].innerText = String(m).padStart(2, '0');
                        spans[2].innerText = String(s).padStart(2, '0');
                    }
                });
            };
            updateTimers();
            raffleTimersInterval = setInterval(updateTimers, 1000);

            const slides = container.querySelectorAll('.mini-raffle-slide');
            if (slides.length > 1) {
                let cur = 0;
                raffleSlideInterval = setInterval(() => {
                    // Используем try/catch на случай, если слайды успели смениться
                    try {
                        slides[cur].classList.remove('active');
                        cur = (cur + 1) % slides.length;
                        slides[cur].classList.add('active');
                    } catch (e) {}
                }, 4000); 
            }
            
        } else {
            container.innerHTML = '<div style="width:100%; text-align:center; opacity:0.3;"><span style="font-size:11px; font-weight:800; color:#fff; text-transform:uppercase; line-height: 1.4;">Нет активных</span></div>';
        }
    };

    if (preloadedData) {
        renderRaffles(preloadedData);
        return;
    }

    try {
        const cachedBootstrap = JSON.parse(localStorage.getItem('cache_bootstrap') || '{}');
        if (cachedBootstrap && cachedBootstrap.raffles) {
            renderRaffles(cachedBootstrap.raffles);
        } else {
            container.innerHTML = '<div style="width:100%; text-align:center; opacity:0.3;"><span style="font-size:11px; font-weight:800; color:#fff; text-transform:uppercase; line-height: 1.4;">Нет активных</span></div>';
        }
    } catch(e) {
        container.innerHTML = '<div style="width:100%; text-align:center; opacity:0.5;"><span style="font-size:10px; font-weight:800; color:#ff3b30; line-height: 1.4;">ОШИБКА</span></div>';
    }
}

async function renderFullInterface(data) {
    userData = data.user || {}; 
    allQuests = data.quests || [];
    const menuContent = data.menu;

    window.activeFreeCases = data.my_active_cases || [];

    if (document.getElementById('ticketStats')) {
        let tNum = Number(userData.tickets || 0);
        document.getElementById('ticketStats').textContent = tNum % 1 === 0 ? tNum.toString() : tNum.toFixed(2).replace('.', ',');
    }
    
    // 👇 Безопасная проверка: обновляем только если элемент реально есть на странице
    const nameEl = document.getElementById('fullName');
    if (nameEl) nameEl.textContent = userData.full_name || "Профиль";
    
    const adminEl = document.getElementById('nav-admin');
    if (userData.is_admin && adminEl) adminEl.classList.remove('hidden');

    // 👇 БЕТОННЫЙ БЛОК ДЛЯ ФОТОГРАФИИ (С ЗАЩИТОЙ ОТ ERR_TIMED_OUT) 👇
    const avatarEl = document.getElementById('user-avatar');
    if (avatarEl) {
        // Функция для моментальной установки заглушки
        const setAvatarPlaceholder = (el) => {
            const firstLetter = (userData.full_name || "U").charAt(0).toUpperCase();
            el.src = `https://placehold.co/64x64/2c2c2e/FFD700?text=${firstLetter}`;
            el.onerror = null; // Защита от бесконечного цикла
        };

        // 1. Если картинка не загрузится (ошибка сети или 404)
        avatarEl.onerror = function() {
            console.warn("Аватарка ТГ заблокирована или не найдена. Ставим заглушку.");
            setAvatarPlaceholder(this);
        };

        // 2. ЗАЩИТА ОТ ТАЙМАУТА: если за 4 секунды фото не пришло — рубим ожидание
        const imgTimeout = setTimeout(() => {
            if (!avatarEl.complete || avatarEl.naturalWidth === 0) {
                console.warn("Таймаут загрузки аватарки. Ставим заглушку.");
                setAvatarPlaceholder(avatarEl);
            }
        }, 4000);

        // Если загрузилось вовремя — отменяем таймер
        avatarEl.onload = () => clearTimeout(imgTimeout);

        // 3. Пытаемся загрузить фото
        if (userData.photo_url) {
            avatarEl.src = userData.photo_url;
        } else {
            setAvatarPlaceholder(avatarEl);
        }
    }

    checkReferralAndWelcome(userData);

    if (menuContent) {
        if (menuContent.bonus_gift_enabled !== undefined) bonusGiftEnabled = menuContent.bonus_gift_enabled;
        // --- ДОБАВЛЯЕМ СЮДА ---
        if (menuContent.coins_purchases_enabled !== undefined) {
            window.coinsPurchasesEnabled = menuContent.coins_purchases_enabled;
        }
        // ----------------------
        const setupSlide = (id, enabled, url, link) => {
            const slide = document.querySelector(`[data-event="${id}"]`);
            if (slide) {
                const show = enabled || userData.is_admin; 
                slide.style.display = show ? '' : 'none';
                if (show) { 
                    if (link) slide.href = link; 
                    if (url) { 
                        const img = slide.querySelector('img'); 
                        if (img) img.src = url; 
                    } 
                }
            }
        };
        setupSlide('skin_race', menuContent.skin_race_enabled, menuContent.menu_banner_url);
        setupSlide('auction', menuContent.auction_enabled, menuContent.auction_banner_url || (menuContent.auction_slide_data ? menuContent.auction_slide_data.image_url : null), '/auction');
        
       // --- НОВАЯ ЛОГИКА CHECKPOINT ---
        const cpSlide = document.querySelector('[data-event="checkpoint"]');
        if (cpSlide) {
            // 1. Имя пользователя
            let displayName = "Игрок";
            if (userData.twitch_login) {
                displayName = userData.twitch_login;
            } else if (userData.full_name) {
                displayName = userData.full_name.split(' ')[0];
            }
            const cpNameEl = document.getElementById('cp-banner-name');
            if (cpNameEl) cpNameEl.textContent = displayName;

            // 2. Уровень БП
            const cpLevelEl = document.getElementById('cp-banner-level');
            if (cpLevelEl) cpLevelEl.textContent = userData.checkpoint_level || 0;

            // 3. Плашка выполненного квеста (актуальные награды)
            const cpAlertEl = document.getElementById('cp-banner-alert');
            if (cpAlertEl) {
                // Считаем количество выполненных, но не забранных квестов
                const unclaimedQuestsCount = Array.isArray(userData.bp_quests) 
                    ? userData.bp_quests.filter(q => q.is_completed === true && q.is_claimed === false).length 
                    : 0;

                if (unclaimedQuestsCount > 0) {
                    cpAlertEl.style.display = 'inline-block';
    
                    // Заменили текст, убрали счетчик и поставили иконку подарка
                    cpAlertEl.innerHTML = `<i class="fa-solid fa-gift fa-bounce" style="margin-right: 5px; color: #ff3b30;"></i>ЗАБЕРИ НАГРАДУ ЗА ЗАДАНИЕ`;
                    
                    // Накидываем "агрессивные" стили для привлечения внимания
                    cpAlertEl.style.background = '#FFD700'; // Золотой фон
                    cpAlertEl.style.color = '#000'; // Черный текст для контраста
                    cpAlertEl.style.fontWeight = '900';
                    cpAlertEl.style.boxShadow = '0 0 15px rgba(255, 215, 0, 0.6)'; // Золотое свечение вокруг
                    cpAlertEl.style.border = 'none';
                    cpAlertEl.style.animation = 'statusPulse 2s infinite'; // Твоя анимация пульсации
                } else {
                    cpAlertEl.style.display = 'none';
                }
            }

            // 4. Подтягиваем картинку из админки (JSON)
            const cpBannerImg = document.getElementById('checkpoint-banner-img');
            if (cpBannerImg && menuContent.checkpoint_banner_url) {
                cpBannerImg.src = menuContent.checkpoint_banner_url;
            }

            // 5. Статус отображения баннера
            const showCp = userData.is_checkpoint_globally_enabled || menuContent.checkpoint_enabled || userData.is_admin;
            cpSlide.style.display = showCp ? '' : 'none';
        }
        // --------------------------------
    }

    const eventSlide = document.querySelector('[data-event="cauldron"]');
    if (eventSlide && data.cauldron) { 
        const show = data.cauldron.is_visible_to_users || userData.is_admin; 
        eventSlide.style.display = show ? '' : 'none'; 
        if (show && data.cauldron.banner_image_url) {
            eventSlide.querySelector('img').src = data.cauldron.banner_image_url;
        }
    }

    // 🔥 Рендерим динамические промо-баннеры (партнерские + наши)
    renderPromoBanners(data.promo_banners || []);

    updateShortcutStatuses(userData, allQuests);
    updateShopTile(userData.active_trade_status || 'none');
    // 🎁 СТАРТОВОЕ ОКНО ДЛЯ НОВИЧКОВ (И ВСЕГДА ДЛЯ АДМИНА)
    if (data.matrix_quest !== undefined || data.welcome_config) {
        checkMatrixEvent(data.matrix_quest, data.welcome_config);
    }

    // 🔥 ОБНОВЛЕНИЕ МИНИ-БЛОКА ТРАСТА НА ГЛАВНОЙ 🔥
    const scoreVal = userData.trust_score !== undefined ? parseFloat(userData.trust_score) : 30.0;
    const miniStatusText = document.getElementById('mini-trust-status-text');
    const miniScoreVal = document.getElementById('mini-trust-score-val');
    const miniWarning = document.getElementById('mini-trust-warning');
    const miniMultVal = document.getElementById('mini-trust-mult-val');

    if (miniStatusText && miniScoreVal) {
        miniScoreVal.textContent = scoreVal.toFixed(1);

        if (scoreVal < 30) {
            miniStatusText.textContent = 'Пониженный';
            miniStatusText.style.color = '#ff3b30';
            if (miniWarning && miniMultVal) {
                miniWarning.style.display = 'block';
                miniMultVal.textContent = '3x';
            }
        } else if (scoreVal >= 70) {
            miniStatusText.textContent = 'Повышенный';
            miniStatusText.style.color = '#34c759';
            if (miniWarning) miniWarning.style.display = 'none';
        } else {
            miniStatusText.textContent = 'Базовый';
            miniStatusText.style.color = '#8e8e93';
            if (miniWarning && miniMultVal) {
                miniWarning.style.display = 'block';
                miniMultVal.textContent = '2x';
            }
        }
    }

    // ==========================================
    // ЛОГИКА ОТОБРАЖЕНИЯ СТАТУСА ПОДПИСКИ
    // ==========================================
    const premiumBtn = document.getElementById('premium-status-btn');
    if (premiumBtn) {
        // ПОКА ЧТО ВКЛЮЧАЕМ ТОЛЬКО ДЛЯ АДМИНА!
        if (userData.is_admin) {
            premiumBtn.classList.remove('hidden');
            
            // Заготовка на будущее
            const isPremium = false; 
            const icon = document.getElementById('premium-status-icon');
            const text = document.getElementById('premium-status-text');
            
            if (isPremium) {
                icon.style.color = '#ffd700';
                icon.style.filter = 'drop-shadow(0 0 5px rgba(255, 215, 0, 0.5))';
                text.style.color = '#ffd700';
                text.textContent = 'КРУТОЙ';
            } else {
                icon.style.color = '#8e8e93';
                icon.style.filter = 'none';
                text.style.color = '#fff';
                text.textContent = 'ОБЫЧНЫЙ';
            }
        } else {
            premiumBtn.classList.add('hidden');
        }
    }
} // <--- ЗДЕСЬ ДОЛЖНА БЫТЬ РОВНО ОДНА СКОБКА (Закрывает renderFullInterface)

window.loginWithTwitchWeb = async function(btnEl) {
    const origHtml = btnEl ? btnEl.innerHTML : '';
    if (btnEl) {
        btnEl.disabled = true;
        btnEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Переход на Twitch...';
    }
    try {
        const currentPath = window.location.pathname === '/' ? '/menu' : window.location.pathname;
        const res = await fetch(`/api/v1/auth/twitch_web/login?redirect=${encodeURIComponent(currentPath)}`);
        const data = await res.json();
        if (data.url) {
            window.location.href = data.url;
        } else {
            throw new Error(data.detail || "Не удалось получить ссылку авторизации");
        }
    } catch (e) {
        customAlert("Ошибка входа через Twitch: " + e.message);
        if (btnEl) {
            btnEl.disabled = false;
            btnEl.innerHTML = origHtml;
        }
    }
};

window.logoutWebUser = function() {
    localStorage.removeItem('tg_web_auth_token');
    localStorage.removeItem('cache_bootstrap');
    window.location.reload();
};

window.showWebAuthModal = function() {
    // 🛡️ АБСОЛЮТНЫЙ БЛОК ДЛЯ TELEGRAM НА ANDROID / IOS / DESKTOP
    const env = typeof detectEnvironmentSync === 'function' ? detectEnvironmentSync() : window.AppEnv;
    const ua = navigator.userAgent || '';
    const isInsideAndroidWebView = /Android.*(;\s*wv\)|Version\/\d+\.\d+)/i.test(ua);

    if (
        env?.isTelegramApp ||
        env?.isVkApp ||
        isInsideAndroidWebView ||
        Boolean(window.Telegram?.WebApp?.initData) ||
        Boolean(window.webkit?.messageHandlers?.performAction) ||
        typeof window.TelegramWebviewProxy !== 'undefined' ||
        typeof window.TelegramWebview !== 'undefined' ||
        sessionStorage.getItem('hatelavka_is_tg_session') === 'true'
    ) {
        console.log("🛡️ [AUTH GUARD] Блокировка открытия WebAuthModal внутри приложения Telegram!");
        document.body.classList.remove('browser-mode');
        document.body.classList.add('tg-mode');
        return;
    }

    if (document.getElementById('web-auth-modal')) return;

    const overlay = document.createElement('div');
    overlay.id = 'web-auth-modal';
    overlay.style.cssText = "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.88); z-index: 2147483647; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); opacity: 0; transition: opacity 0.35s ease;";

    overlay.innerHTML = `
        <div class="custom-confirm-box" style="padding: 28px 22px; width: 92%; max-width: 370px; background: linear-gradient(180deg, #242428 0%, #18181a 100%); border-radius: 22px; border: 1px solid rgba(255, 215, 0, 0.25); text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.9), 0 0 30px rgba(145, 70, 255, 0.15); position: relative;">
            
            <div style="display: flex; justify-content: center; align-items: center; gap: 12px; margin-bottom: 18px;">
                <div style="width: 54px; height: 54px; border-radius: 16px; background: rgba(145, 70, 255, 0.15); border: 1px solid rgba(145, 70, 255, 0.4); display: flex; align-items: center; justify-content: center; box-shadow: 0 0 20px rgba(145, 70, 255, 0.3);">
                    <i class="fa-brands fa-twitch" style="font-size: 26px; color: #9146ff;"></i>
                </div>
                <div style="color: #666; font-size: 14px; font-weight: 900;">ИЛИ</div>
                <div style="width: 54px; height: 54px; border-radius: 16px; background: rgba(42, 171, 238, 0.15); border: 1px solid rgba(42, 171, 238, 0.4); display: flex; align-items: center; justify-content: center; box-shadow: 0 0 20px rgba(42, 171, 238, 0.25);">
                    <i class="fa-brands fa-telegram" style="font-size: 26px; color: #2AABEE;"></i>
                </div>
            </div>

            <h3 style="color: #fff; font-size: 20px; margin: 0 0 8px 0; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;">Добро пожаловать в <span style="color: #FFD700;">HATElavka</span></h3>
            
            <div style="font-size: 12px; color: #aaa; line-height: 1.45; margin-bottom: 22px;">
                Выберите удобный способ входа. При входе через <b style="color: #b983ff;">Twitch</b> телеграмовский бот не требуется — ваш баланс, билеты и скины синхронизируются автоматически!
            </div>

            <!-- 1. КНОПКА ВХОДА ЧЕРЕЗ TWITCH (БЕЗ ТГ) -->
            <button onclick="loginWithTwitchWeb(this)" style="width: 100%; padding: 15px; background: linear-gradient(135deg, #9146ff 0%, #6441a5 100%); color: #fff; border: none; border-radius: 14px; font-weight: 900; font-size: 14px; text-transform: uppercase; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 6px 20px rgba(145, 70, 255, 0.45); margin-bottom: 12px; transition: transform 0.15s;">
                <i class="fa-brands fa-twitch" style="font-size: 18px;"></i> Войти через Twitch
            </button>

            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                <div style="flex-grow: 1; height: 1px; background: rgba(255,255,255,0.08);"></div>
                <span style="font-size: 10px; color: #666; font-weight: 800; text-transform: uppercase;">или через Telegram</span>
                <div style="flex-grow: 1; height: 1px; background: rgba(255,255,255,0.08);"></div>
            </div>

            <!-- 2. ПРЯМАЯ КНОПКА ОТКРЫТИЯ В TELEGRAM (БЕЗ ОШИБКИ BOT DOMAIN INVALID) -->
            <a href="https://t.me/HATElavka_bot" target="_blank" style="box-sizing: border-box; text-decoration: none; width: 100%; padding: 14px; background: rgba(42, 171, 238, 0.15); color: #2AABEE; border: 1px solid rgba(42, 171, 238, 0.35); border-radius: 14px; font-weight: 800; font-size: 13px; text-transform: uppercase; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 14px; transition: background 0.2s;">
                <i class="fa-brands fa-telegram" style="font-size: 17px;"></i> Открыть в Telegram
            </a>

            <!-- 3. ПРОДОЛЖИТЬ КАК ГОСТЬ -->
            <button id="close-web-auth-btn" style="width: 100%; padding: 12px; background: transparent; color: #777; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; font-weight: 700; font-size: 11px; text-transform: uppercase; cursor: pointer; transition: all 0.2s;">
                Посмотреть сайт как гость
            </button>
        </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.style.opacity = '1');

    overlay.querySelector('#close-web-auth-btn').onclick = function() {
        sessionStorage.setItem('web_guest_dismissed', 'true');
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 300);
    };
};

// Если юзер в браузере Гость — при клике на профиль или кнопку открываем окно входа
document.addEventListener('click', (e) => {
    if (document.body.classList.contains('browser-mode') && !localStorage.getItem('tg_web_auth_token')) {
        if (e.target.closest('#user-avatar') || e.target.closest('#fullName') || e.target.closest('a[href="/profile"]')) {
            e.preventDefault();
            e.stopPropagation();
            window.showWebAuthModal();
        }
    }
}, true);

// Глобальная функция, которую вызывает виджет Telegram при успешном логине
window.onTelegramWebAuth = function(user) {
    console.log("✅ Успешная веб-авторизация:", user);
    
    // Превращаем объект пользователя в строку, похожую на initData
    // Бэкенду придется валидировать hash из этого объекта!
    const authString = new URLSearchParams(user).toString();
    
    // Сохраняем в память
    localStorage.setItem('tg_web_auth_token', authString);
    
    // Закрываем окно и перезагружаем страницу, чтобы подтянуть юзера
    const modal = document.getElementById('web-auth-modal');
    if (modal) modal.remove();
    
    window.location.reload();
};

// ================================================================
// МОДУЛЬ ПОДПИСКИ (В РАЗРАБОТКЕ) - Вставь это ниже в файл
// ================================================================
window.openSubscriptionModal = () => {
    showShopModal({
        title: '<span style="color: #FFD700; font-weight: 900; text-shadow: 0 0 10px rgba(255, 215, 0, 0.4);"><i class="fa-solid fa-crown"></i> HATElavka Premium</span>',
        subtitle: `
            <div style="text-align: left; font-size: 12px; color: #ccc; line-height: 1.4;">
                <div style="text-align: center; margin-bottom: 15px; font-size: 13px; color: #fff; font-weight: bold;">
                    Модуль находится в разработке 🛠
                </div>
                Будущие преимущества подписки:<br><br>
                <i class="fa-solid fa-shield-halved" style="color: #34c759; width: 20px;"></i> Всегда <b style="color: #34c759;">зеленый</b> траст-фактор<br>
                <i class="fa-solid fa-box-open" style="color: #2AABEE; width: 20px;"></i> Бесплатный кейс раз в неделю<br>
                <i class="fa-solid fa-fire" style="color: #ff9500; width: 20px;"></i> Выделенный статус в Гринде<br>
                <i class="fa-solid fa-ticket" style="color: #9146ff; width: 20px;"></i> Закрытые Premium-розыгрыши
            </div>
        `,
        confirmText: "КУПИТЬ (СКОРО)",
        confirmClass: "btn-buy", 
        showCancel: true,
        onConfirm: (close) => {
            // Пока тут просто закрываем окно. Потом сюда повесим вызов кассы.
            close();
        }
    });
};

window.calculateCaseProfitChance = async function(caseName, casePrice) {
    try {
        const caseContents = await makeApiRequest(`/api/v1/shop/case_contents?case_name=${encodeURIComponent(caseName)}`, {}, 'GET', true);
        if (caseContents && caseContents.length > 0) {
            let totalWeight = 0;
            let goodDropWeight = 0;
            caseContents.forEach(item => {
                const itemPriceRub = parseFloat(item.price_rub) || 0;
                const weight = parseFloat(item.chance_weight) || 0;
                totalWeight += weight;
                
                // 40% от стоимости считаем "хорошим дропом"
                if (itemPriceRub >= (casePrice * 0.4)) { 
                    goodDropWeight += weight;
                }
            });
            if (totalWeight > 0) {
                return ((goodDropWeight / totalWeight) * 100).toFixed(1);
            }
        }
    } catch(e) {
        console.warn("Не удалось загрузить шансы для: " + caseName, e);
    }
    return "--"; // Возвращаем прочерк, если произошла ошибка
};

// ================================================================
// 1В1 ЛОГИКА КЕЙСОВ ИЗ SHOP.HTML
// ================================================================

window.openFolder = function(id) {
    loadCategory(id);
};

function formatItemName(name) {
    const splitIndex = name.indexOf('(');
    if (splitIndex !== -1) {
        const mainPart = name.substring(0, splitIndex).trim();
        const subPart = name.substring(splitIndex).trim();
        return `${escapeHTML(mainPart)}<span class="item-subtitle" style="display:block; margin-top:2px; font-size:10px; color:var(--primary-color);">${escapeHTML(subPart)}</span>`;
    }
    return escapeHTML(name);
}

async function loadCategory(catId, preloadedData = null) {
    window.currentCategoryId = catId; // 🔥 ЗАПОМИНАЕМ, что сейчас открыто
    if (catId === 2716312) isShopLoaded = true; // Фиксируем, что витрина уже загружена
    const container = document.getElementById('shop-grid');
    if (!container) return;

    let hasCachedData = false;

    // 1. МОМЕНТАЛЬНЫЙ РЕНДЕР: Ищем данные в оперативной памяти или localStorage
    if (preloadedData) {
        const prevJson = JSON.stringify(itemsCache[catId] || null);
        itemsCache[catId] = preloadedData;
        // Перерисовываем DOM только если товары реально изменились или сетка пустая
        if (prevJson !== JSON.stringify(preloadedData) || !container.children.length) {
            renderItems(preloadedData);
        }
        return; // Данные уже переданы — не дергаем сервер повторно
    } else if (itemsCache[catId]) {
        renderItems(itemsCache[catId]);
        hasCachedData = true;
    } else {
        // Достаем из жесткого кэша браузера
        const localCache = JSON.parse(localStorage.getItem('shop_items_cache') || '{}');
        if (localCache[catId] && localCache[catId].length > 0) {
            itemsCache[catId] = localCache[catId];
            renderItems(localCache[catId]);
            hasCachedData = true;
        }
    }

    // 2. ПОКАЗЫВАЕМ СКЕЛЕТОНЫ (Только если юзер зашел вообще в первый раз в жизни)
    if (!hasCachedData) {
        container.innerHTML = Array(6).fill('<div class="shop-item skeleton" style="height: 180px; background: transparent; border-radius: 12px; animation: pulse 1.5s infinite;"></div>').join('');
    }

    // 3. ФОНОВОЕ ОБНОВЛЕНИЕ: Тихо идем на сервер за свежими ценами и наличием
    try {
        const items = await makeApiRequest(`/api/v1/shop/goods?category_id=${catId}`, {}, 'GET', true);
        
        if (window.currentCategoryId === catId) {
            // 🔥 SHADOW PRELOAD: Качаем новые картинки в память 🔥
            const imagesToLoad = items.map(i => i.replaced_image_url || i.image_url).filter(Boolean);
            if (imagesToLoad.length > 0) {
                await preloadImages(imagesToLoad);
            }

            // Проверяем, изменились ли данные, чтобы не перерисовывать зря
            const oldDataStr = JSON.stringify(itemsCache[catId] || []);
            const newDataStr = JSON.stringify(items);

            if (oldDataStr !== newDataStr) {
                itemsCache[catId] = items;
                const newShopCache = JSON.parse(localStorage.getItem('shop_items_cache') || '{}');
                newShopCache[catId] = items;
                localStorage.setItem('shop_items_cache', JSON.stringify(newShopCache));

                // 🔥 Бесшовная перерисовка (лесенки не будет, картинки уже в RAM)
                renderItems(items); 
            }
        }
    } catch (e) {
        console.warn("Фоновое обновление кейсов не удалось:", e);
        // Показываем ошибку только если у нас вообще нет никаких данных (даже кэша)
        if (!hasCachedData) {
            container.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:#ff3b30; padding: 20px;">Ошибка загрузки</div>';
        }
    }
}

// ================================================================
// ФУНКЦИЯ ДЛЯ КРАСИВОГО ДИАЛОГА КУПОННОГО КЕЙСА
// ================================================================
window.showCouponCaseInfo = function(caseName) {
    showShopModal({
        title: "🎟️ Купонный кейс",
        subtitle: `<b>"${caseName}"</b> невозможно купить за обычные монеты или билеты.<br><br>Он выдается <b>исключительно</b> во время стримов, на специальных ивентах, аукционах или лично от Валька в виде промокодов!<br><br>Следите за трансляциями, чтобы забрать его бесплатно.`,
        confirmText: "ПОНЯТНО",
        confirmClass: "btn-purple-modal", // Если такого класса нет, будет просто обычная кнопка
        showCancel: false,
        onConfirm: (close) => close()
    });
};

function renderItems(items) {
    // 🔥 Защита от краша
    if (!Array.isArray(items)) items = []; 

    // ✅ НОВАЯ УМНАЯ ПРОВЕРКА ПО ТАБЛИЦЕ cs_codes
    const isItemFree = (itemName) => {
        return getAvailableCouponsForCase(itemName).length > 0;
    };

    // ============================================================
    // 👇 ЛОГИКА СЕКРЕТНЫХ КЕЙСОВ (is_secret) 👇
    // ============================================================
    items = items.filter(item => {
        if (item.is_secret) {
            return isItemFree(item.name); // ✅ ИСПОЛЬЗУЕМ НАШУ ФУНКЦИЮ
        }
        return true; 
    });
    // ============================================================

    const container = document.getElementById('shop-grid');
    container.innerHTML = '';

    if (!items || items.length === 0) {
        container.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:#888; padding: 20px;">Пусто</div>';
        return;
    }

    // 1. РАСЧЕТ ТРАСТ-ФАКТОРА (Только для цен, визуал теперь в HTML)
    const score = userData.trust_score !== undefined ? parseFloat(userData.trust_score) : 30.0;
    let trustMultiplier = 2; // Дефолт

    if (score < 30) {
        trustMultiplier = 3; 
    } else if (score >= 70) {
        trustMultiplier = 1; 
    } 

    // 2. 🔥 УМНАЯ ФИЛЬТРАЦИЯ ПО БАЛАНСУ 🔥
    if (window.isSmartFilterActive) {
        const currentCoins = parseInt(document.getElementById('user-balance')?.textContent.replace(/\s/g, '') || 0);
        const currentTickets = parseFloat(document.getElementById('ticketStats')?.textContent.replace(/\s/g, '').replace(',', '.')) || 0;

        items = items.filter(item => {
            if (item.is_folder) return true; 
            
            if (isItemFree(item.name)) return true; // ✅ ИСПОЛЬЗУЕМ НАШУ ФУНКЦИЮ

            const originalPrice = parseFloat(item.price) || 0;
            if (originalPrice === 9999) return false;

            const displayPriceCoins = originalPrice * trustMultiplier;
            const displayPriceTickets = (originalPrice * 2) * trustMultiplier;

            return currentCoins >= displayPriceCoins || currentTickets >= displayPriceTickets;
        });
    }

    // 3. Заглушка, если баланс совсем пустой
    if (items.length === 0) {
        container.innerHTML = `
            <div style="grid-column:1/-1; text-align:center; color:#8e8e93; padding: 40px 10px;">
                <i class="fa-solid fa-wallet" style="font-size:32px; margin-bottom:12px; opacity:0.3;"></i><br>
                <span style="font-size:14px; font-weight:800; color:#fff;">Не хватает баланса</span><br>
                <span style="font-size:11px; opacity:0.7;">Пока что вы не можете позволить себе ни один кейс. Подкопите монет или билетов!</span>
            </div>`;
        return;
    }

    // 🔥 УЛУЧШЕННАЯ СОРТИРОВКА: БЕСПЛАТНЫЕ ВСЕГДА ПЕРВЫЕ 🔥
    items.sort((a, b) => {
        if (a.is_folder && !b.is_folder) return -1;
        if (!a.is_folder && b.is_folder) return 1;

        const isFreeA = isItemFree(a.name); // ✅ ИСПОЛЬЗУЕМ НАШУ ФУНКЦИЮ
        const isFreeB = isItemFree(b.name); // ✅ ИСПОЛЬЗУЕМ НАШУ ФУНКЦИЮ

        if (isFreeA && !isFreeB) return -1;
        if (!isFreeA && isFreeB) return 1;

        const priceA = parseFloat(a.price) || 0;
        const priceB = parseFloat(b.price) || 0;
        
        if (priceA === 9999 && priceB !== 9999) return 1;
        if (priceA !== 9999 && priceB === 9999) return -1;
        
        return priceA - priceB;
    });

    const fragment = document.createDocumentFragment();

    let freeHeaderAdded = false;
    let regularHeaderAdded = false; 
    let couponHeaderAdded = false;
    let toggleAdded = false; // 🔥 Флаг для тумблера
    
    // 🔥 Обновленная функция: Тумблер + Кнопка Купона
    const getToggleHtml = () => {
        if (toggleAdded) return ''; 
        toggleAdded = true;
        
        const isActive = window.isSmartFilterActive;
        const color = isActive ? '#34c759' : '#8e8e93';
        const circlePos = isActive ? '12px' : '2px';
        const circleBg = isActive ? '#fff' : '#8e8e93';
        const swBg = isActive ? '#34c759' : 'rgba(255,255,255,0.1)';
        
        return `
            <!-- 🎁 КНОПКА КУПОНА (ПРИЖАТА ВЛЕВО) 🎁 -->
            <div style="position: absolute; top: -20px; left: 0; z-index: 10;">
                <div onclick="openCouponModal()" style="display: flex; align-items: center; gap: 5px; cursor: pointer; transition: opacity 0.2s;" onmousedown="this.style.opacity='0.5'" onmouseup="this.style.opacity='1'">
                    <i class="fa-solid fa-ticket-simple" style="color: #ffd700; font-size: 11px; filter: drop-shadow(0 0 5px rgba(255, 215, 0, 0.4));"></i>
                    <span style="font-size: 8px; font-weight: 900; color: #fff; text-transform: uppercase; letter-spacing: 0.5px;">Активировать купон</span>
                </div>
            </div>

            <!-- 🎛 ТУМБЛЕР (ПРИЖАТ ВПРАВО) 🎛 -->
            <div id="smart-filter-btn" onclick="toggleSmartFilter()" style="position: absolute; top: -20px; right: 0; display: flex; align-items: center; gap: 6px; cursor: pointer; z-index: 10;">
                <div style="display: flex; align-items: center; gap: 4px;">
                    <i class="fa-solid fa-wallet" id="smart-filter-icon" style="color: ${color}; font-size: 10px; transition: 0.3s;"></i>
                    <span id="smart-filter-text" style="font-size: 8px; font-weight: 800; color: ${color}; text-transform: uppercase; letter-spacing: 0.5px; transition: 0.3s;">Доступные кейсы</span>
                </div>
                <div id="smart-filter-switch" style="width: 24px; height: 14px; background: ${swBg}; border-radius: 10px; position: relative; transition: 0.3s;">
                    <div class="switch-circle" style="width: 10px; height: 10px; background: ${circleBg}; border-radius: 50%; position: absolute; top: 2px; left: ${circlePos}; transition: 0.3s cubic-bezier(0.25, 1, 0.5, 1);"></div>
                </div>
            </div>
        `;
    };

items.forEach(item => {
        const el = document.createElement('div');
        el.className = 'shop-item';
        
        // ⚡ ВАЖНО: Убираем отступы у главного контейнера и разрешаем выход за границы (для плашки)
        el.style.background = 'transparent'; 
        el.style.boxShadow = 'none';
        el.style.border = 'none';
        el.style.paddingTop = '0px'; // Перенесли внутрь обертки
        el.style.position = 'relative';
        el.style.overflow = 'visible'; 

        let buttonHtml = '';
        const upperName = (item.name || "").toUpperCase();
        const isCase = upperName.includes("КЕЙС") || upperName.includes("CASE");
        const safeName = item.name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const safeImg = item.image_url || "";
        const cleanName = item.name.replace(/^(Кейс|Case)\s*\|\s*/i, '').trim();

        const originalPrice = parseFloat(item.price) || 0;
        const displayPrice = originalPrice * trustMultiplier;
        const displayPriceTickets = (originalPrice * 2) * trustMultiplier;

        const availableCoupons = getAvailableCouponsForCase(item.name);
        const userOwnedCount = availableCoupons.length;
        const isFreeItem = userOwnedCount > 0;
        const bypassCount = availableCoupons.filter(c => typeof c === 'object' && c.bypass_lock === true).length;

        if (isCase) {
            console.log(`[DEBUG] Витрина: "${item.name}" | Всего: ${userOwnedCount} | Без условий: ${bypassCount} | Массив купонов:`, window.activeFreeCases);
        }

        let availableCountHtml = '';
        let titleTop = '4px'; 
        
        if (isCase && userOwnedCount >= 1) {
            // Эта плашка висит СНАРУЖИ обертки, поэтому ее ничего не обрезает
            let wrapperStyle = `position: absolute; top: -2px; left: 50%; transform: translate(-50%, -100%); z-index: 100; display: flex; flex-direction: column; align-items: center; gap: 4px; white-space: nowrap;`;

            if (bypassCount > 0) {
                let bypassText = bypassCount === userOwnedCount ? "БЕЗ УСЛОВИЙ" : `${bypassCount} БЕЗ УСЛОВИЙ`;
                availableCountHtml = `
                    <div style="${wrapperStyle}">
                        <div style="font-size: 8px; font-weight: 900; color: #34c759; text-transform: uppercase; text-shadow: 0 1px 4px #000, 0 0 8px rgba(0,0,0,0.9);">Доступно: ${userOwnedCount} шт</div>
                        <div style="font-size: 7px; font-weight: 800; color: #FFD700; text-transform: uppercase; background: rgba(20, 20, 20, 0.95); padding: 2px 5px; border-radius: 4px; border: 1px solid rgba(255,215,0,0.4); line-height: 1; display: flex; align-items: center; justify-content: center; gap: 3px; box-shadow: 0 2px 6px rgba(0,0,0,0.7);">
                            <i class="fa-solid fa-bolt" style="font-size: 6px;"></i> ${bypassText}
                        </div>
                    </div>`;
            } else {
                availableCountHtml = `
                    <div style="${wrapperStyle}">
                        <div style="font-size: 8px; font-weight: 900; color: #34c759; text-transform: uppercase; text-shadow: 0 1px 4px #000, 0 0 8px rgba(0,0,0,0.9);">Доступно: ${userOwnedCount} шт</div>
                    </div>`;
            }
        }

// 1. ЗАГОЛОВОК: БЕСПЛАТНОЕ ОТКРЫТИЕ
    if (isFreeItem && !freeHeaderAdded && !item.is_folder) {
        const headerEl = document.createElement('div');
        headerEl.style.cssText = "grid-column: 1 / -1; position: relative; margin: 20px 0 25px 0; display: flex; align-items: center; justify-content: center; gap: 15px;";
        headerEl.innerHTML = `
            ${getToggleHtml()}
            <div style="flex-grow: 1; height: 1px; background: linear-gradient(to right, transparent, rgba(255, 255, 255, 0.15));"></div>
            <span style="font-size: 14px; font-weight: 800; color: #8e8e93; text-transform: uppercase; letter-spacing: 1px;">Бесплатное открытие</span>
            <div style="flex-grow: 1; height: 1px; background: linear-gradient(to left, transparent, rgba(255, 255, 255, 0.15));"></div>
        `;
        fragment.appendChild(headerEl);
        freeHeaderAdded = true;
    }

        // 2. ЗАГОЛОВОК: ОСНОВНЫЕ КЕЙСЫ
    if (!isFreeItem && originalPrice !== 9999 && !regularHeaderAdded && !item.is_folder) {
        const sepEl = document.createElement('div');
        // Изменили нижний margin с 35px на 15px
        sepEl.style.cssText = "grid-column: 1 / -1; position: relative; margin: 25px 0 15px 0; display: flex; align-items: center; justify-content: center; gap: 15px;";
        sepEl.innerHTML = `
            ${getToggleHtml()}
            <div style="flex-grow: 1; height: 1px; background: linear-gradient(to right, transparent, rgba(255, 255, 255, 0.15));"></div>
            <span style="font-size: 14px; font-weight: 800; color: #8e8e93; text-transform: uppercase; letter-spacing: 1px;">Основные кейсы</span>
            <div style="flex-grow: 1; height: 1px; background: linear-gradient(to left, transparent, rgba(255, 255, 255, 0.15));"></div>
        `;
        fragment.appendChild(sepEl);
        regularHeaderAdded = true;
    }

        // 3. ЗАГОЛОВОК: КУПОННЫЕ КЕЙСЫ
        if (!isFreeItem && originalPrice === 9999 && !couponHeaderAdded && !item.is_folder) {
            const headerEl = document.createElement('div');
            // Изменили нижний margin с 25px на 15px
            headerEl.style.cssText = "grid-column: 1 / -1; position: relative; margin: 20px 0 15px 0; display: flex; align-items: center; justify-content: center; gap: 15px;";
            headerEl.innerHTML = `
                <div style="flex-grow: 1; height: 1px; background: linear-gradient(to right, transparent, rgba(255, 255, 255, 0.15));"></div>
                <span style="font-size: 14px; font-weight: 800; color: #8e8e93; text-transform: uppercase; letter-spacing: 1px;">Купонные кейсы</span>
                <div style="flex-grow: 1; height: 1px; background: linear-gradient(to left, transparent, rgba(255, 255, 255, 0.15));"></div>
            `;
            fragment.appendChild(headerEl);
            couponHeaderAdded = true;
        }

        // 🔥 МАГИЯ ТУТ: Создаем ВНУТРЕННЮЮ обертку с overflow: hidden, которая отрезает черный фон!
        // 🔥 В конец строки добавили background: rgba(0, 0, 0, 0.4);
        const innerWrapStyle = `position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; overflow: hidden; border-radius: 12px; padding-top: 32px; flex-grow: 1;`;

        if (item.is_folder) {
            el.innerHTML = `
                <div style="${innerWrapStyle}">
                    <div class="item-title" style="position: absolute; top: -7px; left: 50%; transform: translateX(-50%); width: max-content; font-size: 13px; font-weight: 800; color: #fff; text-align: center; white-space: nowrap; z-index: 10;">${escapeHTML(cleanName)}</div>
                    <div class="item-image-wrapper" onclick="openFolder(${item.id})" style="width: 100%; padding-top: 100%; position: relative; background: transparent; cursor: pointer;">
                        <img src="${safeImg}" class="item-image" loading="lazy" onload="this.classList.add('loaded')" style="position: absolute; top: 10%; left: 10%; width: 80%; height: 80%; object-fit: contain; opacity: 0; transition: opacity 0.3s;">
                    </div>
                    <div class="item-info" style="padding: 10px; display: flex; flex-direction: column; flex-grow: 1; gap: 4px; text-align: center; z-index: 8;">
                        <button class="action-btn btn-folder" onclick="openFolder(${item.id})" style="background: rgba(255, 255, 255, 0.1); color: #fff; width: 100%; height: 34px; min-height: 34px; flex-shrink: 0; margin-top: auto; border: none; border-radius: 8px; font-weight: 600; font-size: 11px;">Открыть <i class="fa-solid fa-chevron-right" style="font-size:10px; margin-left:3px;"></i></button>
                    </div>
                </div>
            `;
            
       } else if (isCase) {
            let showFreeButton = isFreeItem;
            
            // ⚡ 1. Кнопки снова чистые и прозрачные (без лишних фонов)
            if (showFreeButton) {
                buttonHtml = `<div class="case-buttons-container" style="display:flex; width:100%; height:35px; align-items:center; justify-content:center;">
                    <button class="action-btn btn-buy" onclick="openCase(${item.id}, ${originalPrice}, '${safeName}', '${safeImg}', 'coins')" style="background: transparent; color: #34c759; text-shadow: 0 0 10px rgba(52, 199, 89, 0.9), 0 0 20px rgba(52, 199, 89, 0.4); width: 100%; height: 100%; border: none; border-radius: 12px; font-weight: 900; display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.1; text-transform: uppercase; cursor: pointer; outline: none; transition: transform 0.2s ease;">
                        <span style="font-size: 9px; opacity: 0.9; margin-top: 12px;">ОТКРЫТЬ</span>
                        <span style="font-size: 13px;">БЕСПЛАТНО</span>
                    </button>
                </div>`;
            } else if (originalPrice === 9999) {
                buttonHtml = `<div class="case-buttons-container" style="display:flex; width:100%; height:35px; align-items:center; justify-content:center;">
                    <button class="action-btn" onclick="showCouponCaseInfo('${safeName}')" style="background: transparent; color: #9146FF; border: none; width: 100%; height: 100%; border-radius: 12px; font-weight: 900; font-size: 11px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; text-transform: uppercase; cursor: pointer; transition: 0.2s ease;"><i class="fa-solid fa-lock" style="font-size: 14px; margin-bottom: 2px;"></i>КУПОННЫЙ</button>
                </div>`;
            } else {
                const coinBtnHtml = window.coinsPurchasesEnabled 
                    ? `<button class="action-btn btn-buy" onclick="openCase(${item.id}, ${originalPrice}, '${safeName}', '${safeImg}', 'coins')" style="position: relative; background: linear-gradient(135deg, #ffd700 0%, #ffaa00 100%); color: #000; box-shadow: 0 2px 10px rgba(255, 204, 0, 0.2); width: 100%; height: 32px; min-height: 32px; flex-shrink: 0; border: none; border-radius: 8px; display: flex; align-items: center; justify-content: center; gap: 2px; transition: transform 0.1s;"><span style="font-size: 13px; font-weight: 900; margin-top: 1px;">${displayPrice}</span><i class="fa-solid fa-coins" style="font-size: 11px; color: #000 !important; filter: drop-shadow(0 1px 1px rgba(255,255,255,0.3));"></i></button>`
                    : `<button class="action-btn btn-disabled" onclick="customAlert('Покупки за монеты временно отключены 🛠')" style="position: relative; background: rgba(255, 255, 255, 0.05); color: rgba(255, 255, 255, 0.3); width: 100%; height: 32px; min-height: 32px; flex-shrink: 0; border: none; border-radius: 8px; display: flex; align-items: center; justify-content: center; gap: 4px;"><i class="fa-solid fa-lock" style="font-size: 8px;"></i><span style="font-size: 8px; font-weight: 800; letter-spacing: 0.5px;">ОТКЛЮЧЕНО</span></button>`;
                
                buttonHtml = `<div class="case-buttons-container" style="display:flex; flex-direction:column; gap:6px; width:100%;">
                    ${coinBtnHtml}
                    <button class="action-btn btn-buy-tickets" onclick="openCase(${item.id}, ${originalPrice * 2}, '${safeName}', '${safeImg}', 'tickets')" style="position: relative; background: linear-gradient(135deg, #6a11cb 0%, #2575fc 100%); color: #fff; box-shadow: 0 2px 10px rgba(37, 117, 252, 0.2); width: 100%; height: 32px; min-height: 32px; flex-shrink: 0; border: none; border-radius: 8px; display: flex; align-items: center; justify-content: center; gap: 2px; transition: transform 0.1s;"><span style="font-size: 13px; font-weight: 900; margin-top: 1px;">${displayPriceTickets}</span><i class="fa-solid fa-ticket" style="font-size: 11px; color: #fff; filter: drop-shadow(0 1px 1px rgba(0,0,0,0.3));"></i></button>
                </div>`;
            }
            
            const contentsPriceParam = originalPrice === 9999 ? 'null' : displayPrice;

            el.innerHTML = `
                ${availableCountHtml}
                <div style="${innerWrapStyle}">
                    <div class="item-title case-top-title" style="position: absolute; top: ${titleTop}; left: 50%; transform: translateX(-50%); z-index: 1; white-space: nowrap; pointer-events: none; width: auto !important; max-width: 95% !important; padding: 2px 8px !important; font-weight: 800; color: #fff; text-align: center; text-transform: uppercase; background: transparent !important;">${formatItemName(cleanName)}</div>
                    
                    <div class="item-image-wrapper case-img-wrap" onclick="openCaseContents(event, '${safeName}', ${contentsPriceParam})" style="background: transparent; padding-top: 80%;">
                        <!-- ⚡ ТО САМОЕ ЖИДКОЕ СТЕКЛО: Полупрозрачный черный (0.5) + блюр. Больше никакой черноты! ⚡ -->
                        <div class="case-info-overlay" style="background: rgba(0, 0, 0, 0.5); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);"><span>Посмотреть дроп</span></div>
                        <img src="${safeImg}" class="item-image case-zoom" loading="lazy" onload="this.classList.add('loaded')">
                    </div>
                    
                    <div class="item-info" style="padding: 0 10px 10px 10px; flex-grow: 1; position: relative; z-index: 8;">${buttonHtml}</div>
                </div>
            `;
            
        } else {
            let stockText = item.count === null ? '∞ шт.' : `${item.count} шт.`;
            let btnHtml = '';

            if (item.count === 0) {
                btnHtml = `<button class="action-btn btn-disabled" disabled style="background: rgba(255, 255, 255, 0.05); color: rgba(255, 255, 255, 0.3); width: 100%; height: 32px; min-height: 32px; flex-shrink: 0; margin-top: auto; border: none; border-radius: 8px; font-weight: 600; font-size: 11px;">Раскуплено</button>`;
            } else if (!window.coinsPurchasesEnabled) {
                btnHtml = `<button class="action-btn btn-disabled" onclick="customAlert('Покупки за монеты временно отключены 🛠')" style="background: rgba(255, 255, 255, 0.05); color: rgba(255, 255, 255, 0.3); width: 100%; height: 32px; min-height: 32px; flex-shrink: 0; margin-top: auto; border: none; border-radius: 8px; font-weight: 800; font-size: 9px; letter-spacing: 0.5px; display: flex; align-items: center; justify-content: center; gap: 4px;"><i class="fa-solid fa-lock" style="font-size: 9px;"></i> ОТКЛЮЧЕНО</button>`;
            } else {
                btnHtml = `<button class="action-btn btn-buy" onclick="buyItem(${item.id}, ${originalPrice}, '${safeName}', '${safeImg}')" style="position: relative; background: linear-gradient(135deg, #ffd700 0%, #ffaa00 100%); color: #000; box-shadow: 0 2px 10px rgba(255, 204, 0, 0.2); width: 100%; height: 32px; min-height: 32px; flex-shrink: 0; margin-top: auto; border: none; border-radius: 8px; display: flex; align-items: center; justify-content: center; gap: 2px; transition: transform 0.1s;"><span style="font-size: 13px; font-weight: 900; margin-top: 1px;">${displayPrice}</span><i class="fa-solid fa-coins" style="font-size: 11px; color: #000 !important; filter: drop-shadow(0 1px 1px rgba(255,255,255,0.3));"></i></button>`;
            }
            
            el.innerHTML = `
                <div style="${innerWrapStyle}">
                    <div class="item-title" style="position: absolute; top: 4px; left: 50%; transform: translateX(-50%); width: max-content; font-size: 11px; font-weight: 600; color: #fff; text-align: center; white-space: nowrap; z-index: 10;">${formatItemName(cleanName)}</div>
                    <div class="item-image-wrapper" onclick="openCaseContents(event, '${safeName}')" style="width: 100%; padding-top: 100%; position: relative; background: transparent; cursor: pointer;">
                        <img src="${safeImg}" class="item-image" loading="lazy" onload="this.classList.add('loaded')" style="position: absolute; top: 10%; left: 10%; width: 80%; height: 80%; object-fit: contain; opacity: 0; transition: opacity 0.3s;">
                    </div>
                    <div class="item-info" style="padding: 10px; display: flex; flex-direction: column; flex-grow: 1; gap: 4px; text-align: center; z-index: 8;">
                        <div class="item-meta" style="display: flex; flex-direction: column; align-items: center; gap: 2px; font-size: 10px; margin-bottom: 6px;">
                            <div class="item-stock" style="color: #8E8E93;">${stockText}</div>
                        </div>
                        ${btnHtml}
                    </div>
                </div>
            `;
        }
        fragment.appendChild(el);
    });
    
    container.appendChild(fragment);

    // 🔥 ВОЗВРАЩАЕМ АВТО-УМЕНЬШЕНИЕ ТЕКСТА 🔥
    container.querySelectorAll('.case-top-title').forEach(title => {
        let fontSize = 10; 
        while (title.scrollWidth > title.offsetWidth && fontSize > 5) {
            fontSize -= 0.5;
            title.style.fontSize = fontSize + 'px';
        }
    });
}

async function validateUserTradeLink() {
    // Если валидная ссылка уже есть в памяти — пропускаем за 0 мс без моргания лоадера
    if (userData?.trade_link && userData.trade_link.includes("partner=") && userData.trade_link.includes("token=")) {
        return true;
    }

    const loader = document.getElementById('purchase-loader');
    if (loader) { loader.querySelector('.loader-text').innerText = "Проверка профиля..."; loader.classList.add('active'); }
    try {
        const res = await makeApiRequest('/api/v1/user/me', {}, 'POST', true);
        const tLink = (res && res.trade_link) ? res.trade_link : "";
        if (tLink && userData) userData.trade_link = tLink;
        if (!tLink.includes("partner=") || !tLink.includes("token=")) {
            if (window.Telegram?.WebApp?.showPopup) {
                window.Telegram.WebApp.showPopup({ title: '❌ Нет трейд-ссылки', message: 'Зайдите в Профиль и привяжите Trade-ссылку Steam!', buttons: [{ id: 'ok', type: 'default', text: 'Понятно' }] });
            } else {
                customAlert('Зайдите в Профиль и привяжите Trade-ссылку Steam!');
            }
            return false; 
        }
        return true; 
    } catch(e) { return false; } finally { if (loader) loader.classList.remove('active'); }
}

// ================================================================
// ИНФО О ГАРАНТЕ И РАСЧЕТ ШАНСОВ
// ================================================================
window.showGuaranteeInfo = function() {
    if (typeof showTrustTooltip === 'function') {
        showTrustTooltip('Система Гаранта', `
            <div style="text-align: left; font-size: 12px; color: #ccc; line-height: 1.5;">
                <b style="color:#ffd700;">Что такое Гарант?</b><br>
                Каждое открытие кейса заполняет шкалу удачи. Когда шкала достигает максимума, система <b>гарантированно</b> выдает предмет, который стоит дороже самого кейса!<br><br>
                <b style="color:#ff3b30;">Важно:</b><br>
                • Чем дороже кейс, тем больше открытий нужно для срабатывания гаранта (от 5 до 10).<br>
                • Если ваш Траст-фактор в красной зоне (ниже 30 баллов), гарант <b>отключается</b>.
            </div>
        `);
    }
};

window.openCase = async function(id, price, name, imageUrl, currency = 'coins') {
    // 👇 ПРОВЕРКА ГОСТЯ В БРАУЗЕРЕ
    if (document.body.classList.contains('browser-mode') && !localStorage.getItem('tg_web_auth_token')) {
        return typeof showWebAuthModal === 'function' ? showWebAuthModal() : customAlert("Авторизуйтесь через Telegram!");
    }

    // --- БЛОКИРОВКА С ИСКЛЮЧЕНИЕМ ДЛЯ КУПОНОВ ---
    const availableCoupons = getAvailableCouponsForCase(name);
    const isFreeOpen = availableCoupons.length > 0;

    if (currency === 'coins' && !window.coinsPurchasesEnabled && !isFreeOpen) {
        return customAlert("🛠 Покупки за монеты в данный момент отключены!");
    }
    
    const isLinkValid = await validateUserTradeLink();
    if (!isLinkValid) return;

    // 🔥 РАСЧЕТ НАЦЕНКИ
    const score = userData.trust_score !== undefined ? parseFloat(userData.trust_score) : 30.0;
    let trustMultiplier = 2; // Дефолт (Серый)
    if (score < 30) trustMultiplier = 3; // Красный
    else if (score >= 70) trustMultiplier = 1; // Зеленый

    const displayPrice = price * trustMultiplier;

    // Достаем промокод
    let activeCoupon = null;
    if (isFreeOpen) {
        const couponObj = availableCoupons[0];
        activeCoupon = (typeof couponObj === 'object' && couponObj.code) ? couponObj.code : "FREE_BY_ID";
    }
    
    // ================================================================
    // 🔥 НОВЫЙ ПРОДАЮЩИЙ ДИАЛОГ (ПРЕМИУМ УЛЬТРА-КОМПАКТ) 🔥
    // ================================================================
    const overlay = document.createElement('div');
    overlay.style.cssText = "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.85); z-index: 9999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(15px); opacity: 0; transition: opacity 0.3s;";
    
    const currencyIcon = currency === 'coins' ? '<i class="fa-solid fa-coins" style="color: #ffd700;"></i>' : '🎟️';
    const basePrice = price;
    const cleanName = name.replace(/^(Кейс|Case)\s*\|\s*/i, '').trim();

    // 🔥 МАКСИМАЛЬНО СЖАТОЕ И КРАСИВОЕ ОКНО ЦЕНЫ 🔥
    let priceBlockHtml = '';
    
    if (isFreeOpen) {
        priceBlockHtml = `
            <div style="margin-bottom: 15px;">
                <div style="font-size: 22px; font-weight: 900; color: #4ade80; text-transform: uppercase; text-shadow: 0 0 10px rgba(74, 222, 128, 0.4);">Бесплатно</div>
                <div style="font-size: 9px; color: #aaa; text-transform: uppercase; margin-top: 2px;">Купон применен</div>
            </div>
        `;
    } else if (score >= 30) { // <--- ИСПРАВЛЕНИЕ: Обычная цена для базового и высокого траста (>= 30)
        priceBlockHtml = `
            <div style="margin-bottom: 15px; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 24px; font-weight: 900; color: #fff; text-shadow: 0 0 10px rgba(255,215,0,0.5);">
                ${displayPrice} <span style="font-size: 18px;">${currencyIcon}</span>
            </div>
        `;
    } else { // <--- ИСПРАВЛЕНИЕ: Красная табличка наценки только для траста < 30
        priceBlockHtml = `
            <div style="margin-bottom: 12px; display: flex; align-items: center; justify-content: center; gap: 14px; background: rgba(0,0,0,0.4); padding: 10px 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
                <div style="text-align: right;">
                    <div style="font-size: 18px; font-weight: 900; color: #ff3b30; display: flex; align-items: center; justify-content: flex-end; gap: 4px; text-shadow: 0 0 10px rgba(255,59,48,0.4);">
                        ${displayPrice} <span style="font-size: 14px;">${currencyIcon}</span>
                    </div>
                    <div style="font-size: 9px; color: #aaa; font-weight: 700; text-transform: uppercase;">С наценкой</div>
                </div>
                <div style="width: 1px; height: 24px; background: rgba(255,255,255,0.1);"></div>
                <div style="text-align: center;">
                    <div style="font-size: 14px; font-weight: 800; color: #8e8e93; display: flex; align-items: center; justify-content: center; gap: 4px;">
                        ${basePrice} <span style="font-size: 10px;">${currencyIcon}</span>
                    </div>
                    <div style="font-size: 9px; color: #666; font-weight: 700; text-transform: uppercase;">БЕЗ НАЦЕНКИ</div>
                </div>
            </div>
            
            <div style="font-size: 10px; font-weight: 600; color: #ff9500; line-height: 1.3; margin-bottom: 16px; max-width: 250px; text-align: center;">
                <i class="fa-solid fa-circle-exclamation"></i> Траст понижен. Подними его, чтобы убрать наценку и включить гарант. 
                <b style="display: block; margin-top: 6px; color:#fff; text-decoration: underline; cursor:pointer;" onclick="openTrustModal()">Подробнее</b>
            </div>
        `;
    }

    const needsTimer = !isFreeOpen && trustMultiplier > 1;

    // 🔥 Считаем макс. шаги до гаранта
    const trueBasePrice = currency === 'tickets' ? (price / 2) : price;
    let targetLacky = 5;
    if (trueBasePrice >= 250) targetLacky = 10;
    else if (trueBasePrice >= 100) targetLacky = 7;

    let statsBlockHTML = '';
    let isGuaranteeActive = false; // 🔥 ДОБАВЛЯЕМ ФЛАГ ДЛЯ ПРЕМИУМ-СТИЛЯ

    if (!isFreeOpen) {
        let guaranteeContent = '';
        
        if (score < 30) { // <--- ИСПРАВЛЕНИЕ ГАРАНТА: Отключаем только если траст < 30
            guaranteeContent = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4px 0;">
                    <span style="font-size: 10px; color: #888; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Система гаранта</span>
                    <span style="font-size: 13px; color: #ff3b30; font-weight: 900; text-transform: uppercase; margin-top: 2px;">Отключена</span>
                </div>
            `;
        } else {
            // Читаем текущий счетчик
            let currentLacky = 0;
            if (userData.case_counters && userData.case_counters[name] !== undefined) {
                currentLacky = parseInt(userData.case_counters[name]) || 0;
            }

            // 🔥 ЭМУЛИРУЕМ БЭКЕНД: Смотрим, что будет ПРИ НАЖАТИИ 🔥
            let nextLacky = currentLacky + 1;
            if (nextLacky > targetLacky) {
                nextLacky = 1; // Если круг был завершен, начинаем заново
            }
            
            // Сколько открытий останется ДО цели (уже с учетом будущего шага)
            const leftCount = targetLacky - nextLacky;
            
            if (leftCount === 0) {
                isGuaranteeActive = true; // 🔥 АКТИВИРУЕМ ПРЕМИУМ
                guaranteeContent = `
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4px 0; animation: statusPulse 2s infinite;">
                        <span style="font-size: 13px; color: #FFD700; font-weight: 900; text-transform: uppercase; text-shadow: 0 0 10px rgba(255,215,0,0.6); letter-spacing: 0.5px;">🔥 Гарант активен 🔥</span>
                        <span style="font-size: 9px; color: #fff; font-weight: 600; opacity: 0.8; margin-top: 3px;">Дроп равен или дороже кейса!</span>
                    </div>
                `;
            } else {
                const getDeclension = (n, titles) => { const cases = [2, 0, 1, 1, 1, 2]; return titles[(n % 100 > 4 && n % 100 < 20) ? 2 : cases[(n % 10 < 5) ? n % 10 : 5]]; };
                const caseWord = getDeclension(leftCount, ['кейс', 'кейса', 'кейсов']);
                
                guaranteeContent = `
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.2; padding: 4px 0;">
                        <span style="font-size: 10px; color: #aaa; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">До гарантированного дропа</span>
                        <div style="font-size: 13px; color: #fff; font-weight: 800; margin-top: 5px;">
                            осталось <b style="color: #FFD700; font-size: 15px; text-shadow: 0 0 8px rgba(255,215,0,0.4); margin: 0 2px;">${leftCount}</b> <span style="color: #ccc; font-size: 11px;">${caseWord}</span>
                        </div>
                    </div>
                `;
            }
        }

        // Обертка с абсолютным позиционированием иконки
        statsBlockHTML = `
            <div style="margin-bottom: 16px; background: rgba(0,0,0,0.4); border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); position: relative; width: 100%; padding: 8px 0;">
                ${guaranteeContent}
                <i class="fa-solid fa-circle-question" onclick="showGuaranteeInfo()" style="position: absolute; right: 14px; top: 50%; transform: translateY(-50%); color: #8e8e93; font-size: 15px; cursor: pointer; transition: color 0.2s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#8e8e93'"></i>
            </div>
        `;
    }
    
   // 🔥 НАЧАЛО ПРЕМИУМ-ВЁРСТКИ 🔥
    if (isGuaranteeActive) {
        // Темная виньетка: плавно затемняем углы, чтобы сливалось с фоном
        overlay.style.boxShadow = 'inset 0 0 60px rgba(0, 0, 0, 0.8)';
    }

    const premiumAnimHtml = isGuaranteeActive ? `
        <style>
            @keyframes premiumPulseBtn {
                0% { box-shadow: 0 0 15px rgba(255, 170, 0, 0.4), inset 0 2px 4px rgba(255,255,255,0.4); transform: scale(1); }
                50% { box-shadow: 0 0 35px rgba(255, 170, 0, 0.8), inset 0 2px 10px rgba(255,255,255,0.6); transform: scale(1.03); }
                100% { box-shadow: 0 0 15px rgba(255, 170, 0, 0.4), inset 0 2px 4px rgba(255,255,255,0.4); transform: scale(1); }
            }
            @keyframes goldShine {
                0% { background-position: -200% center; }
                100% { background-position: 200% center; }
            }
        </style>
    ` : '';

    overlay.innerHTML = `
        ${premiumAnimHtml}
        <div style="width: 100%; max-width: 320px; display: flex; flex-direction: column; align-items: center; text-align: center; padding: 20px; box-sizing: border-box; position: relative;">

            <img src="${imageUrl}" style="width: 140px; height: 140px; object-fit: contain; margin-bottom: 16px; filter: drop-shadow(0 10px 20px rgba(0,0,0,0.6));">
            
            <div style="font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; transition: 0.3s; ${isGuaranteeActive ? 'background: linear-gradient(to right, #FFD700, #ffaa00, #FFD700); background-size: 200% auto; color: transparent; -webkit-background-clip: text; animation: goldShine 3s linear infinite;' : 'color: #fff; text-shadow: 0 2px 10px rgba(0,0,0,0.5);'}">
                ${cleanName}
            </div>
            
            ${priceBlockHtml}
            
            ${statsBlockHTML}
            
            <div style="display: flex; gap: 10px; width: 100%;">
                <button id="case-cancel-btn" style="flex: 1; background: rgba(255,255,255,0.08); color: #fff; border: 1px solid rgba(255,255,255,0.15); border-radius: 14px; padding: 14px; font-size: 13px; font-weight: 800; cursor: pointer; text-transform: uppercase; backdrop-filter: blur(10px); transition: 0.2s;">Отмена</button>
                
                <button id="case-confirm-btn" ${needsTimer ? 'disabled' : ''} style="flex: 1; background: ${needsTimer ? '#3a3a3c' : (isGuaranteeActive ? 'linear-gradient(to bottom, #ffdb4d, #ff9500)' : '#ffcc00')}; color: ${needsTimer ? '#888' : '#000'}; border: none; border-radius: 14px; padding: 14px; font-size: 13px; font-weight: 900; cursor: ${needsTimer ? 'not-allowed' : 'pointer'}; text-transform: uppercase; transition: all 0.3s; display: flex; justify-content: center; align-items: center; gap: 6px; box-shadow: ${needsTimer ? 'none' : (isGuaranteeActive ? '0 0 20px rgba(255, 170, 0, 0.6), inset 0 2px 4px rgba(255,255,255,0.5)' : '0 0 15px rgba(255, 204, 0, 0.4)')}; ${isGuaranteeActive && !needsTimer ? 'animation: premiumPulseBtn 2.5s infinite;' : ''}">
                    ${isGuaranteeActive && !needsTimer ? '<i class="fa-solid fa-crown" style="font-size: 15px; margin-right: 2px;"></i> ' : ''} ОТКРЫТЬ ${needsTimer ? '<span id="case-timer-span" style="background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 6px; font-size: 10px; color: #fff;">3</span>' : ''}
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.style.opacity = '1');

    const cancelBtn = overlay.querySelector('#case-cancel-btn');
    const confirmBtn = overlay.querySelector('#case-confirm-btn');
    const timerSpan = overlay.querySelector('#case-timer-span');

    let timerInterval;
    if (needsTimer) {
        let timeLeft = 3;
        timerInterval = setInterval(() => {
            timeLeft--;
            if (timeLeft > 0) {
                timerSpan.innerText = timeLeft;
            } else {
                clearInterval(timerInterval);
                timerSpan.style.display = 'none';
                confirmBtn.disabled = false;
                confirmBtn.style.cursor = 'pointer';
                confirmBtn.style.background = '#ffcc00';
                confirmBtn.style.color = '#000';
                confirmBtn.style.boxShadow = '0 0 15px rgba(255, 204, 0, 0.4)';
            }
        }, 1000);
    }

    const closeDialog = () => {
        if (timerInterval) clearInterval(timerInterval);
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 300);
    };

    cancelBtn.onclick = closeDialog;
    
    confirmBtn.onclick = async () => {
        closeDialog();
        
        const loader = document.getElementById('purchase-loader');
        if (loader) { loader.querySelector('.loader-text').innerText = "Крутим барабан..."; loader.classList.add('active'); }

        if (!activeCoupon) {
            const balanceEl = currency === 'coins' ? document.getElementById('user-balance') : document.getElementById('ticketStats');
            if (balanceEl) {
                let currentVisualBalance = parseFloat(balanceEl.textContent.replace(/[\s\u202f\u00a0]/g, '').replace(',', '.')) || 0;
                
                if (currentVisualBalance < displayPrice) {
                    if (loader) loader.classList.remove('active');
                    return customAlert(`Недостаточно средств! Цена для вас: ${displayPrice}`);
                }

                let newBalance = currentVisualBalance - displayPrice;
                balanceEl.textContent = newBalance % 1 === 0 ? newBalance.toLocaleString('ru-RU') : newBalance.toFixed(2).replace('.', ',');
            }
        }

        try {
            const buyPayload = { item_id: id, price: price, title: name, image_url: imageUrl, currency: currency };
            if (activeCoupon) {
                buyPayload.coupon_code = activeCoupon;
            }

            const contentsPromise = makeApiRequest(`/api/v1/shop/case_contents?case_name=${encodeURIComponent(name)}`, {}, 'GET', true);
            // Передаем 4-м аргументом true (isSilent), чтобы на фоне не дергался главный #loader-overlay!
            const buyPromise = makeApiRequest('/api/v1/shop/buy', buyPayload, 'POST', true);
            
            const [contentsResp, resData] = await Promise.all([contentsPromise, buyPromise]);

            // 🔥 МАГИЯ: ОБНОВЛЯЕМ СЧЕТЧИК В ПАМЯТИ И СРАЗУ СИНХРОНИЗИРУЕМ С КЭШЕМ 🔥
            let oldLacky = 0;
            if (resData && resData.lacky !== undefined) {
                if (!userData.case_counters) userData.case_counters = {};
                oldLacky = userData.case_counters[name] || 0;
                userData.case_counters[name] = parseInt(resData.lacky);

                try {
                    const cb = JSON.parse(localStorage.getItem('cache_bootstrap') || '{}');
                    if (cb.user) {
                        cb.user.case_counters = userData.case_counters;
                        localStorage.setItem('cache_bootstrap', JSON.stringify(cb));
                        sessionStorage.setItem('session_bootstrap', JSON.stringify(cb));
                    }
                } catch (e) {}
            }

            const possibleItems = (contentsResp && contentsResp.length > 0) ? contentsResp : [{ name: "Mystery Item", image_url: imageUrl, rarity: "common" }];

            let winner = resData.winner || { name: "Ошибка", image_url: imageUrl, rarity: 'common' };

            let strip = [];
            for(let i=0; i<80; i++) strip.push(possibleItems[Math.floor(Math.random() * possibleItems.length)]);
            strip[60] = winner; 

            // 🔥 ПЕРЕДАЕМ isFreeOpen и oldLacky В РУЛЕТКУ 🔥
            launchRoulette(strip, winner, resData.messages || [], resData.lacky, name, resData.max_lacky || targetLacky, isFreeOpen, oldLacky);
            
            if (isFreeOpen) {
                const myId = typeof getMyUserIdStr === 'function' ? getMyUserIdStr() : String(window.Telegram?.WebApp?.initDataUnsafe?.user?.id || "");
                const indexToUpdate = window.activeFreeCases.findIndex(c => {
                    if (typeof c === 'object') return c.code === activeCoupon;
                    if (typeof c === 'string') return c.trim().toLowerCase() === (name || "").trim().toLowerCase();
                    return false;
                });

                if (indexToUpdate > -1) {
                    const coupon = window.activeFreeCases[indexToUpdate];
                    if (typeof coupon === 'object') {
                        if (!Array.isArray(coupon.used_by_ids)) coupon.used_by_ids = [];
                        coupon.used_by_ids.push(myId);
                        
                        if (Array.isArray(coupon.activated_by_ids)) {
                            const aIdx = coupon.activated_by_ids.indexOf(myId);
                            if (aIdx > -1) coupon.activated_by_ids.splice(aIdx, 1);
                        }
                    } else {
                        window.activeFreeCases.splice(indexToUpdate, 1);
                    }
                }
                // Откладываем перерисовку сетки до закрытия рулетки, чтобы фон не дергался во время прокрутки
                window._needsShopRerenderAfterRoulette = true;
            }

       } catch (err) { 
            if (typeof checkBalance === 'function') checkBalance(true, true);
            
            const systemLocks = ['Activity Lock', 'Trust Lock', 'Global Lock', 'Security Block', 'USER_BANNED', 'Bot Auth Required'];

            if (isFreeOpen && !systemLocks.includes(err.message)) {
                console.warn("Сброс бесплатного кейса из-за отказа сервера:", err.message);
                
                window.activeFreeCases = window.activeFreeCases.filter(n => {
                    if (typeof n === 'object') return n.code !== activeCoupon;
                    if (typeof n === 'string') return n.toLowerCase() !== name.toLowerCase();
                    return true;
                });
                
                localStorage.removeItem('active_coupon_data'); 
                
                if (typeof itemsCache !== 'undefined' && typeof window.currentCategoryId !== 'undefined') {
                    if (typeof renderItems === 'function') renderItems(itemsCache[window.currentCategoryId] || []);
                }
            }
        } finally { 
            if (loader) loader.classList.remove('active'); 
        }
    };
};

// 👇 В заголовке функции ожидаем maxLacky и флаг isFreeOpen
// 👇 В заголовке функции добавляем 8-й аргумент oldLacky
function launchRoulette(items, winner, extraMessages, lacky, rawCaseName, maxLacky = 5, isFreeOpen = false, oldLacky = 0) {
    const modal = document.getElementById('r-modal');
    const area = document.getElementById('r-area');
    const track = document.getElementById('r-track');
    const winScreen = document.getElementById('r-win');
    
    document.getElementById('r-case-name').innerText = (rawCaseName || "").replace(/^(Кейс|Case)\s*\|\s*/i, '').trim();
    
    const bottomProgress = document.getElementById('r-bottom-progress');
    const rModal = document.getElementById('r-modal');

    // Вспомогательная функция для падежей
    const getDeclension = (n, titles) => {
        const cases = [2, 0, 1, 1, 1, 2];
        return titles[ (n % 100 > 4 && n % 100 < 20) ? 2 : cases[(n % 10 < 5) ? n % 10 : 5] ];
    };

    // 🔥 НОВЫЙ ПРОГРЕСС-БАР ГАРАНТА 🔥
    const score = userData.trust_score !== undefined ? parseFloat(userData.trust_score) : 30.0;
    
    if (isFreeOpen) {
        // Для купонов полностью скрываем полоску гаранта
        bottomProgress.style.display = 'none';
    } else if (score < 30) {
        // Красный траст — гарант отключен (текст укорочен для компактности)
        bottomProgress.style.display = 'flex';
        bottomProgress.style.width = '100%';
        bottomProgress.style.justifyContent = 'center';
        bottomProgress.innerHTML = `
            <div style="width: 100%; display: flex; flex-direction: column; align-items: center; gap: 8px;">
                <div style="color: #ff3b30; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">🚫 Гарант недоступен 🚫</div>
                <div style="width: 60%; height: 6px; background: rgba(255, 59, 48, 0.2); border-radius: 4px; box-shadow: inset 0 1px 3px rgba(0,0,0,0.5);"></div>
            </div>
        `;
    } else {
        // Считаем прогресс: если до открытия был накоплен гарант, показываем его
        // Иначе показываем новый обновленный счетчик после открытия
        let currentLacky = lacky || 0; 
        const percent = Math.min((currentLacky / maxLacky) * 100, 100);
        const leftCount = maxLacky - currentLacky;
        
        bottomProgress.style.display = 'flex';
        bottomProgress.style.width = '100%';
        bottomProgress.style.justifyContent = 'center';

       if (currentLacky >= maxLacky) {
            // 💎 ГАРАНТ АКТИВЕН (Премиальный стиль) 💎
            bottomProgress.innerHTML = `
                <style>
                    @keyframes premiumGlow {
                        0% { box-shadow: 0 0 10px rgba(255, 215, 0, 0.2), inset 0 1px 3px rgba(0,0,0,0.5); }
                        50% { box-shadow: 0 0 25px rgba(255, 215, 0, 0.6), inset 0 1px 3px rgba(0,0,0,0.5); }
                        100% { box-shadow: 0 0 10px rgba(255, 215, 0, 0.2), inset 0 1px 3px rgba(0,0,0,0.5); }
                    }
                    @keyframes goldShimmer {
                        0% { background-position: -200% center; }
                        100% { background-position: 200% center; }
                    }
                </style>
                <div style="width: 100%; display: flex; flex-direction: column; align-items: center; gap: 8px;">
                    <div style="color: #ffcc00; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; text-shadow: 0 0 15px rgba(255, 204, 0, 0.8);">
                        ГАРАНТ АКТИВЕН
                    </div>
                    <div style="width: 60%; height: 6px; background: rgba(255, 255, 255, 0.1); border-radius: 4px; overflow: hidden; animation: premiumGlow 2.5s ease-in-out infinite;">
                        <div style="width: 100%; height: 100%; background: linear-gradient(90deg, #a67c00 0%, #ffdf00 25%, #ffffff 50%, #ffdf00 75%, #a67c00 100%); background-size: 200% auto; animation: goldShimmer 3s linear infinite; border-radius: 4px;"></div>
                    </div>
                </div>
            `;
            
            // Подсвечиваем фон рулетки золотым (Сохраняем старый фон, чтобы вернуть при закрытии)
            if (rModal) {
                rModal.dataset.origBg = rModal.style.background || '';
                rModal.style.background = 'radial-gradient(circle at center, rgba(255, 215, 0, 0.15) 0%, rgba(0, 0, 0, 0.9) 60%)';
            }
        } else {
            // ⏳ ОБЫЧНЫЙ ПРОГРЕСС ЗАПОЛНЕНИЯ ⏳
            const word = getDeclension(leftCount, ['открытие', 'открытия', 'открытий']);
            bottomProgress.innerHTML = `
                <div style="width: 100%; display: flex; flex-direction: column; align-items: center; gap: 8px;">
                    <div style="color: #aaa; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                        Осталось <span style="color: #fff; font-weight: 800;">${leftCount}</span> ${word}
                    </div>
                    <div style="width: 60%; height: 6px; background: rgba(255, 255, 255, 0.1); border-radius: 4px; overflow: hidden; box-shadow: inset 0 1px 3px rgba(0,0,0,0.5);">
                        <div style="width: ${percent}%; height: 100%; background: linear-gradient(90deg, #ff9500, #ffd700); border-radius: 4px; box-shadow: 0 0 10px rgba(255, 215, 0, 0.4); transition: width 0.5s ease-out;"></div>
                    </div>
                </div>
            `;
        }
    }

    document.getElementById('r-top-header').style.display = 'flex';
    track.style.transition = 'none'; track.style.transform = 'translateX(0)';
    area.style.display = 'block'; winScreen.style.display = 'none'; modal.style.display = 'flex';

    track.innerHTML = items.map(item => {
        let rClass = 'r-common'; const r = (item.rarity || 'common').toLowerCase();
        if (r.includes('blue') || r.includes('rare')) rClass = 'r-blue';
        else if (r.includes('purple') || r.includes('mythical')) rClass = 'r-purple';
        else if (r.includes('pink') || r.includes('legendary')) rClass = 'r-pink';
        else if (r.includes('red') || r.includes('ancient')) rClass = 'r-red';
        else if (r.includes('gold')) rClass = 'r-gold';
        return `<div class="r-card ${rClass}"><img src="${item.image_url}"><div class="r-card-name">${item.name.split('|').pop().trim()}</div></div>`;
    }).join('');

    setTimeout(() => {
        const ANIMATION_TIME = 11000;
        const finalPosition = -((60 * 148) + 74 - (window.innerWidth / 2) + ((Math.random() * 100) - 50));
        track.style.transition = `transform ${ANIMATION_TIME}ms cubic-bezier(0.15, 0, 0.05, 1)`; 
        track.style.transform = `translateX(${finalPosition}px)`;
        
        let tickInterval = 50, timer = 0;
        const haptic = window.Telegram?.WebApp?.HapticFeedback;
        const ticker = () => {
            if (timer >= ANIMATION_TIME - 300) return; 
            if (haptic) haptic.selectionChanged();
            timer += tickInterval;
            if (timer < ANIMATION_TIME * 0.6) tickInterval = 50; else if (timer < ANIMATION_TIME * 0.8) tickInterval = 120; else tickInterval += 50; 
            setTimeout(ticker, tickInterval);
        };
        ticker();

        setTimeout(() => {
            if (haptic) { haptic.impactOccurred('heavy'); setTimeout(() => haptic.notificationOccurred('success'), 800); }
            area.style.display = 'none'; 
            
            // Словарь для перевода качества
            const condMap = {
                'FN': 'Прямо с завода', 'MW': 'Немного поношенное',
                'FT': 'После полевых испытаний', 'WW': 'Поношенное', 'BS': 'Закаленное в боях'
            };
            
            // Проверка: скрываем качество для наклеек, граффити, нашивок, значков
            const isNoConditionItem = /sticker|наклейка|graffiti|граффити|patch|нашивка|charm|брелок|pin|значок/i.test(winner.name);
            const rawCond = winner.condition || 'FN';
            const winCondition = condMap[rawCond] || rawCond;
            const winPrice = winner.price_rub || winner.price || 0;
            
            const conditionHtml = isNoConditionItem 
                ? '' 
                : `<div style="font-size: 11px; color: #8e8e93; margin-bottom: 2px; text-align: center;">${escapeHTML(winCondition)}</div>`;

            winScreen.innerHTML = `
                <h2 style="color:#ffcc00; margin-bottom:10px; text-transform:uppercase; text-shadow:0 0 20px rgba(255,215,0,0.5);">ВЫПАЛО!</h2>
                <img src="${winner.image_url}" class="win-img">
                <h3 style="color:#fff; margin-top:15px; margin-bottom: 2px; font-weight: 700;">${winner.name.split('|').pop().trim()}</h3>
                
                ${conditionHtml}
                <div style="font-size: 12px; color: #cbd5e0; font-weight: 500; margin-bottom: 20px; text-align: center;">
                    ${winPrice} <i class="fa-solid fa-coins" style="color: #ffd700; font-size: 10px;"></i>
                </div>
                
                <button class="action-btn btn-buy" style="width: 220px; height: 48px; font-size: 14px; margin-bottom: 10px;" onclick="claimItem(${winner.id})">ЗАБРАТЬ В STEAM</button>
                <button class="action-btn" style="background: linear-gradient(135deg, #6a11cb, #2575fc); color: #fff; width: 220px; height: 44px; margin-bottom: 15px;" onclick="sellForTickets(${winner.id}, ${winner.price || 0})">ПРОДАТЬ ЗА ${winner.price || 0} 🎟️</button>
                <button class="action-btn btn-secondary-action" style="width: 220px;" onclick="closeRoulette()">Закрыть</button>
            `;
            winScreen.style.display = 'flex'; 
        }, ANIMATION_TIME); 
    }, 100);
}

window.closeRoulette = function() {
    const rModal = document.getElementById('r-modal');
    
    // Сбрасываем золотой фон гаранта обратно на дефолт
    if (rModal && rModal.dataset.origBg !== undefined) {
        rModal.style.background = rModal.dataset.origBg;
    }

    rModal.style.display = 'none';
    document.getElementById('r-top-header').style.display = 'none';
    document.getElementById('r-bottom-progress').style.display = 'none';

    // Если открывали бесплатный кейс — обновляем витрину сейчас, когда рулетка закрыта
    if (window._needsShopRerenderAfterRoulette) {
        window._needsShopRerenderAfterRoulette = false;
        if (typeof itemsCache !== 'undefined' && typeof window.currentCategoryId !== 'undefined') {
            if (typeof renderItems === 'function') renderItems(itemsCache[window.currentCategoryId] || []);
        }
    }

    // Второй аргумент true (forceSync) не дает старому кэшу баланса мигнуть перед запросом
    if (typeof checkBalance === 'function') checkBalance(true, true);
}
// ================================================================
// ВЫВОД, ПРОДАЖА И ЗАМЕНА
// ================================================================

window.toggleCaseFaq = function() {
    const content = document.getElementById('case-faq-content');
    const icon = document.getElementById('case-faq-icon');
    if (content.style.display === 'none') {
        content.style.display = 'flex';
        icon.style.transform = 'rotate(180deg)';
    } else {
        content.style.display = 'none';
        icon.style.transform = 'rotate(0deg)';
    }
};

window.claimItem = async function(itemId) {
    showShopModal({ title: "Вывести в Steam?", subtitle: "Ожидайте трейд в течение 30 минут.", confirmText: "ЗАБРАТЬ", confirmClass: "btn-yellow-modal", onConfirm: async (closeModal) => {
        const loader = document.getElementById('purchase-loader'); 
        const loaderText = loader ? loader.querySelector('.loader-text') : null;
        
        if (loader && loaderText) { 
            loader.classList.add('active'); 
            loaderText.innerText = "Подключаемся к продавцу..."; 
            
            // 🔥 Делаем лоадер "живым" 🔥
            setTimeout(() => { if (loader.classList.contains('active')) loaderText.innerText = "Ищем лучшую цену..."; }, 4000);
            setTimeout(() => { if (loader.classList.contains('active')) loaderText.innerText = "Вспоминаем про промокод HATElove на сайте topskin..."; }, 9000);
            setTimeout(() => { if (loader.classList.contains('active')) loaderText.innerText = "Почти готово..."; }, 14000);
        }
        try {
            const res = await makeApiRequest('/api/v1/user/inventory/withdraw', { history_id: itemId }, 'POST');
            if (res && res.status === 'offer_replacement') { closeModal(); if (loader) loader.classList.remove('active'); showReplacementChoice(res.options, itemId); return; }
            if (res) customAlert(`✅ Успешно! Ожидайте трейд.`);
            closeModal(); closeRoulette();
        } catch (e) { closeModal(); } finally { if (loader) loader.classList.remove('active'); }
    }});
}

window.sellForTickets = function(itemId, price) {
    showShopModal({ 
        title: `Продать за ${price} 🎟️?`, 
        subtitle: "Билеты начислятся моментально.", 
        confirmText: "ПРОДАТЬ", 
        confirmClass: "btn-purple-modal", 
        onConfirm: async (closeModal) => {
            const loader = document.getElementById('purchase-loader'); 
            if (loader) { 
                loader.classList.add('active'); 
                loader.querySelector('.loader-text').innerText = "Продаем..."; 
            }
            
            // ⚡ ОПТИМИСТИЧНОЕ НАЧИСЛЕНИЕ БИЛЕТОВ (ДО ЗАПРОСА)
            const ticketsEl = document.getElementById('ticketStats');
            if (ticketsEl) {
                const currentTickets = parseFloat(ticketsEl.textContent.replace(/\s/g, '').replace(',', '.')) || 0;
                renderBalanceUI(undefined, currentTickets + price);
            }

            try {
                await makeApiRequest('/api/v1/user/inventory/sell', { history_id: itemId }, 'POST');
                customAlert(`Успешно! +${price} билетов.`); 
                closeModal(); 
                closeRoulette(); 
                checkBalance(true); // Синхронизируем реальный баланс в фоне
            } catch (e) { 
                checkBalance(true); // Если ошибка - откатываем визуальный баланс назад
                closeModal(); 
            } finally { 
                if (loader) loader.classList.remove('active'); 
            }
        }
    });
}
window.openCaseContents = async function(event, caseName, casePriceCoins) {
    if (event) event.stopPropagation();
    
    const modal = document.getElementById('case-contents-modal'); 
    const list = document.getElementById('case-items-list'); 
    const loader = document.getElementById('contents-loader');
    
    let statsBlock = document.getElementById('case-stats-block');
    if (!statsBlock) {
        statsBlock = document.createElement('div');
        statsBlock.id = 'case-stats-block';
        list.parentNode.insertBefore(statsBlock, list);
    }

    modal.classList.remove('hidden'); 
    loader.style.display = 'block'; 
    list.innerHTML = '';
    statsBlock.innerHTML = '';

    try {
        const data = await makeApiRequest(`/api/v1/shop/case_contents?case_name=${encodeURIComponent(caseName)}`, {}, 'GET', true);
        
        data.sort((a,b) => (parseFloat(b.price_rub) || 0) - (parseFloat(a.price_rub) || 0));

        let totalWeight = 0;
        let goodDropWeight = 0;
        
        data.forEach(item => {
            const itemPriceRub = parseFloat(item.price_rub) || 0;
            const weight = parseFloat(item.chance_weight) || 0;
            totalWeight += weight;
            
            // Считаем хорошим скином тот, что дает хотя бы 40% от стоимости
            if (casePriceCoins && itemPriceRub >= (casePriceCoins * 0.4)) {
                goodDropWeight += weight;
            }
        });

        let profitChance = 0;
        if (totalWeight > 0) {
            profitChance = ((goodDropWeight / totalWeight) * 100).toFixed(1);
        }
        
        // 🔥 ДОБАВЛЯЕМ ЛОГИКУ ВИЗУАЛА ДЛЯ КУПОННЫХ КЕЙСОВ 🔥
        let priceDisplayHtml = casePriceCoins 
            ? `${casePriceCoins} <i class="fa-solid fa-coins" style="color: #ffd700; font-size: 15px;"></i>` 
            : `<span style="font-size: 14px; font-weight: 900; color: #9146FF; text-shadow: 0 0 10px rgba(145,70,255,0.4);"><i class="fa-solid fa-lock"></i> КУПОН</span>`;
            
        let chanceDisplayHtml = casePriceCoins
            ? `<div style="font-size: 18px; font-weight: 900; color: ${profitChance > 15 ? '#34c759' : '#ffcc00'};">${profitChance}%</div>`
            : `<div style="font-size: 18px; font-weight: 900; color: #8e8e93;">--</div>`;
        
        // Рендерим плашку с оптимизированным спойлером и премиальными иконками монет
        statsBlock.innerHTML = `
            <div style="background: rgba(255, 255, 255, 0.05); padding: 12px; border-radius: 12px; border: 1px solid rgba(255, 215, 0, 0.2); margin-bottom: 16px;">
                
                <div style="display: flex; justify-content: space-around; align-items: center;">
                    <div style="text-align: center;">
                        <div style="font-size: 10px; color: #8e8e93; text-transform: uppercase; margin-bottom: 4px;">Шанс на хороший скин</div>
                        ${chanceDisplayHtml}
                    </div>
                    <div style="width: 1px; height: 30px; background: rgba(255,255,255,0.1);"></div>
                    <div style="text-align: center;">
                        <div style="font-size: 10px; color: #8e8e93; text-transform: uppercase; margin-bottom: 4px;">Цена кейса</div>
                        <div style="font-size: 18px; font-weight: 900; color: #fff; display: flex; align-items: center; justify-content: center; gap: 5px;">
                            ${priceDisplayHtml}
                        </div>
                    </div>
                </div>

                <div style="margin-top: 12px; background: rgba(0, 0, 0, 0.25); border-radius: 8px; overflow: hidden;">
                    <div onclick="toggleCaseFaq()" style="padding: 10px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none;">
                        <div style="font-size: 11px; font-weight: 800; color: #ffd700; text-transform: uppercase; letter-spacing: 0.5px;">
                            <i class="fa-solid fa-circle-info" style="margin-right: 4px;"></i> Важно знать
                        </div>
                        <i id="case-faq-icon" class="fa-solid fa-chevron-down" style="color: #8e8e93; font-size: 10px; transition: transform 0.2s;"></i>
                    </div>
                    
                    <div id="case-faq-content" style="display: none; flex-direction: column; gap: 8px; padding: 0 10px 10px 10px; font-size: 10px; color: #ccc; line-height: 1.4;">
                        <div style="display: flex; align-items: flex-start; gap: 6px;">
                            <i class="fa-solid fa-circle-exclamation" style="color: #ffd700; font-size: 10px; margin-top: 2px;"></i>
                            <span><b>Окупаемость:</b> Считается строго от цены кейса в монетах (<i class="fa-solid fa-coins" style="color: #ffd700;"></i>).</span>
                        </div>
                        <div style="display: flex; align-items: flex-start; gap: 6px;">
                            <i class="fa-solid fa-ticket" style="color: #2AABEE; font-size: 10px; margin-top: 2px;"></i>
                            <span><b>Билеты (🎟️):</b> Валюта вашей активности. Скины на неё не равняются, и окуп по ним не считается.</span>
                        </div>
                        <div style="display: flex; align-items: flex-start; gap: 6px;">
    <i class="fa-solid fa-shield-halved" style="color: #34c759; font-size: 10px; margin-top: 2px;"></i>
    <span><b>Система Гаранта:</b> Защищает от минуса! Накопите необходимое количество открытий, и система гарантированно выдаст предмет по цене кейса (в монетках) либо дороже. Работает при открытии и за монеты, и за билеты.</span>
</div>
                        <div style="display: flex; align-items: flex-start; gap: 6px;">
                            <i class="fa-solid fa-gift" style="color: #ff9500; font-size: 10px; margin-top: 2px;"></i>
                            <span><b>Бесплатный проект:</b> Вы не тратите реальные деньги. Баланс настроен так, чтобы проект мог существовать и радовать вас дальше.</span>
                        </div>
                        <div style="display: flex; align-items: flex-start; gap: 6px;">
                            <i class="fa-brands fa-steam" style="color: #8e8e93; font-size: 10px; margin-top: 2px;"></i>
                            <span><b>Цены:</b> Ориентировочные и могут незначительно отличаться от Торговой площадки Steam.</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Рендерим сами предметы (со "Светофором" и иконкой fa-coins)
        list.innerHTML = data.map(item => {
            let rClass = 'blue'; 
            const r = (item.rarity || '').toLowerCase();
            if (r.includes('purple')) rClass = 'purple'; 
            else if (r.includes('pink')) rClass = 'pink'; 
            else if (r.includes('red')) rClass = 'red'; 
            else if (r.includes('gold')) rClass = 'gold';

            const itemPriceRub = parseFloat(item.price_rub) || 0;
            
            // Логика "Светофора"
            let priceColor = casePriceCoins ? '#ff3b30' : '#FFD700'; // Для купонных делаем золотым, для обычных — красный по умолчанию
            let optStyle = '';

            if (casePriceCoins) {
                if (itemPriceRub > casePriceCoins) {
                    // Зеленый (Окуп)
                    priceColor = '#34c759';
                    optStyle = `border: 1px solid rgba(52, 199, 89, 0.4); background: rgba(52, 199, 89, 0.05);`;
                } else if (itemPriceRub >= (casePriceCoins * 0.5)) {
                    // Желтый (Нормальный возврат: от 50% стоимости кейса)
                    priceColor = '#ffcc00';
                    optStyle = `border: 1px solid rgba(255, 204, 0, 0.4); background: rgba(255, 204, 0, 0.05);`;
                }
            }

            return `
                <div class="content-item ${rClass}" style="position: relative; ${optStyle}">
                    <img src="${item.image_url}" loading="lazy">
                    <div class="content-name">${item.name.split('|').pop().trim()}</div>
                    <div class="content-quality">${item.condition || 'FN'}</div>
                    <div style="margin-top: 6px; font-size: 13px; font-weight: 800; color: ${priceColor}; display: flex; align-items: center; justify-content: center; gap: 4px;">
                        ${itemPriceRub} <i class="fa-solid fa-coins" style="color: #ffd700; font-size: 12px;"></i>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (e) { 
        list.innerHTML = `<div style="text-align:center; grid-column:1/-1; color:#ff453a; padding: 20px;">Ошибка загрузки содержимого</div>`; 
    } finally { 
        loader.style.display = 'none'; 
    }
};

window.closeContentsModal = () => document.getElementById('case-contents-modal').classList.add('hidden');

window.showReplacementChoice = function(options, historyId) {
    const modal = document.getElementById('replacement-modal'); 
    const container = document.getElementById('replacement-options-list');
    
    container.innerHTML = options.map(item => {
        let r = (item.rarity || '').toLowerCase(), rClass = 'blue';
        if (r.includes('purple')) rClass = 'purple'; 
        else if (r.includes('pink')) rClass = 'pink'; 
        else if (r.includes('red')) rClass = 'red'; 
        else if (r.includes('gold')) rClass = 'gold';
        
        // Разбиваем имя на Тип (Наклейка/Граффити) и Название
        const parts = item.name_ru.split('|');
        const itemType = parts.length > 1 ? parts[0].trim() : ''; 
        const itemName = parts.length > 1 ? parts[1].trim() : item.name_ru;
        const safeFullName = item.name_ru.replace(/'/g, "");

        return `<div class="replacement-card ${rClass}" onclick="initiateReplacementConfirm(${historyId}, '${item.assetid}', '${safeFullName}')">
            <div class="replacement-image-wrapper">
                <img src="${item.icon_url}" loading="lazy">
            </div>
            <div class="replacement-text-zone">
                ${itemType ? `<div class="replacement-type">${escapeHTML(itemType)}</div>` : ''}
                <div class="replacement-name">${escapeHTML(itemName)}</div>
                <div class="replacement-condition">${escapeHTML(item.condition || '-')}</div>
            </div>
        </div>`;
    }).join('');
    
    modal.classList.remove('hidden');
}

window.closeReplacementModal = () => document.getElementById('replacement-modal').classList.add('hidden');

window.initiateReplacementConfirm = (historyId, assetid, itemName) => {
    showShopModal({ title: "Подтвердить выбор?", subtitle: `Вы выбрали "${itemName}". Трейд отправится моментально.`, confirmText: "ЗАБРАТЬ", confirmClass: "btn-yellow-modal", onConfirm: async (closeConfirm) => {
        const loader = document.getElementById('purchase-loader'); if (loader) loader.classList.add('active');
        try {
            const res = await makeApiRequest('/api/v1/user/inventory/confirm_replacement', { history_id: historyId, assetid: assetid }, 'POST');
            if (res.success) { customAlert("✅ Успешно! Проверьте Steam Трейды."); closeConfirm(); closeReplacementModal(); closeRoulette(); } 
            else { customAlert("❌ " + res.message); closeConfirm(); }
        } catch (e) { closeConfirm(); } finally { if (loader) loader.classList.remove('active'); }
    }});
}

// ================================================================
// P2P TRADE-IN ОБМЕН
// ================================================================
window.openP2PModal = async () => {
    // 🔥 ПРОВЕРКА ТРАСТ-ФАКТОРА (Пускаем от 40 баллов) 🔥
    const score = userData.trust_score !== undefined ? parseFloat(userData.trust_score) : 30.0;
    
    if (score < 40) {
        const targetScore = 40.0;
        const scoreLeft = Math.max(0, targetScore - score).toFixed(1);
        const progressPercent = Math.min(100, Math.max(0, (score / targetScore) * 100));

        const overlay = document.createElement('div');
        overlay.className = 'p2p-special-overlay'; 
        overlay.style.cssText = "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.8); z-index: 2147483647; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px); opacity: 0; transition: opacity 0.2s;";

        overlay.innerHTML = `
            <div style="padding: 24px 20px; width: 85%; max-width: 340px; background: #1c1c1e; border-radius: 16px; border: 1px solid rgba(255, 149, 0, 0.4); text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.8); display: flex; flex-direction: column; gap: 16px;">
                
                <div style="font-size: 44px; color: #ff9500; line-height: 1; text-shadow: 0 0 15px rgba(255, 149, 0, 0.4);">
                    <i class="fa-solid fa-lock"></i>
                </div>
                
                <div style="font-size: 18px; font-weight: 900; color: #fff; text-transform: uppercase; letter-spacing: 0.5px;">
                    Нужен траст
                </div>
                
                <div style="font-size: 12px; color: #ccc; line-height: 1.4;">
                    Обмен кейсов доступен только при <b style="color: #fff;">Траст-факторе от 40 баллов</b>.
                </div>

                <div style="width: 100%; background: rgba(255,255,255,0.03); border-radius: 10px; padding: 12px; box-sizing: border-box; border: 1px solid rgba(255,255,255,0.05);">
                    <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 800; color: #fff; margin-bottom: 8px; font-family: 'SF Mono', monospace;">
                        <span style="color: #aaa;">${score.toFixed(1)}</span>
                        <span style="color: #ff9500; font-size: 10px; text-transform: uppercase;">Осталось: ${scoreLeft}</span>
                        <span style="color: #aaa;">40.0</span>
                    </div>
                    <div style="width: 100%; height: 8px; border-radius: 4px; background: rgba(0,0,0,0.6); position: relative; overflow: hidden; box-shadow: inset 0 1px 3px rgba(0,0,0,0.5);">
                        <div style="position: absolute; top: 0; left: 0; height: 100%; width: ${progressPercent}%; background: linear-gradient(90deg, #ff3b30, #ff9500); border-radius: 4px; box-shadow: 0 0 10px rgba(255, 149, 0, 0.5);"></div>
                    </div>
                </div>

                <div style="font-size: 10px; color: #666; line-height: 1.3;">
                    Прояви немного активности на стримах и в чате, чтобы повысить уровень доверия и разблокировать функцию.
                </div>

                <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 5px;">
                    <button onclick="window.open('https://www.twitch.tv/hatelove_ttv', '_blank')" style="width: 100%; padding: 14px; font-size: 13px; background: #9146ff; color: #fff; border: none; border-radius: 12px; font-weight: 800; cursor: pointer; text-transform: uppercase; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 15px rgba(145, 70, 255, 0.3);">
                        <i class="fa-brands fa-twitch" style="font-size: 16px;"></i> Перейти на Twitch
                    </button>
                    
                    <button onclick="if(window.Telegram?.WebApp) { Telegram.WebApp.openTelegramLink('https://t.me/hatelovettv'); } else { window.open('https://t.me/hatelovettv', '_blank'); }" style="width: 100%; padding: 14px; font-size: 13px; background: #2AABEE; color: #fff; border: none; border-radius: 12px; font-weight: 800; cursor: pointer; text-transform: uppercase; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 15px rgba(42, 171, 238, 0.3);">
                        <i class="fa-brands fa-telegram" style="font-size: 16px;"></i> Чат Telegram
                    </button>

                    <button onclick="this.closest('.p2p-special-overlay').style.opacity='0'; setTimeout(() => { this.closest('.p2p-special-overlay').remove(); }, 200);" style="width: 100%; padding: 14px; font-size: 13px; background: rgba(255,255,255,0.05); color: #aaa; border: none; border-radius: 12px; font-weight: 700; cursor: pointer; text-transform: uppercase;">
                        Назад
                    </button>
                </div>
                
            </div>
        `;
        
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.style.opacity = '1');
        return;
    }

    // Если траст >= 40 — загружаем интерфейс обмена
    document.getElementById('p2p-modal').classList.remove('hidden');
    document.getElementById('p2p-quantity').value = 1; 
    document.getElementById('p2p-total').innerText = '0';
    
    const select = document.getElementById('p2p-case-select'); 
    select.innerHTML = '<option value="">Загрузка...</option>';
    
    try {
        cachedP2PCases = await makeApiRequest('/api/v1/p2p/cases', {}, 'GET', true) || [];
        select.innerHTML = '<option value="">-- Нажми, чтобы выбрать кейс --</option>' + cachedP2PCases.map(item => `<option value="${item.id}" data-price="${item.price_in_coins}" data-image="${item.image_url}" data-name="${item.case_name.replace(/"/g, '&quot;')}">${item.case_name}</option>`).join('');
    } catch(e) { 
        select.innerHTML = '<option value="">Ошибка загрузки</option>'; 
    }
    
    loadP2PHistoryData();
};
window.closeP2PModal = () => document.getElementById('p2p-modal').classList.add('hidden');

window.calculateP2P = () => {
    const select = document.getElementById('p2p-case-select'); const quantityInput = document.getElementById('p2p-quantity');
    const previewCard = document.getElementById('case-preview');
    if (!select.value) { previewCard.classList.remove('visible'); setTimeout(() => { if(!previewCard.classList.contains('visible')) previewCard.style.display = 'none'; }, 300); document.getElementById('p2p-price-per-item').innerText = 0; document.getElementById('p2p-total').innerText = 0; return; }
    const opt = select.options[select.selectedIndex]; const price = parseInt(opt.dataset.price) || 0; const q = parseInt(quantityInput.value) || 0;
    document.getElementById('p2p-price-per-item').innerText = price; document.getElementById('p2p-total').innerText = price * q;
    previewCard.style.display = 'flex'; requestAnimationFrame(() => previewCard.classList.add('visible'));
    document.getElementById('preview-img').src = opt.dataset.image; document.getElementById('preview-name').innerText = opt.dataset.name; document.getElementById('preview-price-text').innerText = price;
}

window.createP2PTrade = async () => {
    const select = document.getElementById('p2p-case-select'); const quantity = parseInt(document.getElementById('p2p-quantity').value);
    if (!select.value || quantity <= 0) return customAlert("Выберите кейс и количество!");
    try {
        await makeApiRequest('/api/v1/p2p/create', { case_id: parseInt(select.value), quantity: quantity }, 'POST');
        customAlert("✅ Заявка создана! Ждите подтверждения админа.");
        select.value = ""; document.getElementById('p2p-quantity').value = 1; window.calculateP2P(); loadP2PHistoryData(); checkActiveTradesBackground();
    } catch(e) {}
}

window.openHistoryModal = () => { document.getElementById('history-modal-window').classList.add('active'); loadP2PHistoryData(); }
window.closeHistoryModal = () => document.getElementById('history-modal-window').classList.remove('active');

async function loadP2PHistoryData() {
    const listContainer = document.getElementById('full-history-list'); const smartBtn = document.getElementById('smart-history-btn'); const smartBtnText = document.getElementById('smart-btn-text'); const smartBtnIcon = smartBtn.querySelector('.btn-icon');
    if (document.getElementById('history-modal-window').classList.contains('active')) listContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#666;"><i class="fa-solid fa-circle-notch fa-spin"></i> Загрузка...</div>';
    try {
        const trades = await makeApiRequest('/api/v1/p2p/my_trades', {}, 'POST', true);
        const priority = { 'active': 1, 'review': 2, 'pending': 3, 'completed': 4, 'canceled': 5 };
        trades.sort((a, b) => priority[a.status] - priority[b.status]);
        const activeTrade = trades.find(t => ['active', 'review', 'pending'].includes(t.status));

        if (activeTrade) {
            smartBtn.classList.add('active-trade');
            if (activeTrade.status === 'active') { smartBtnText.innerText = `🔥 ТРЕБУЕТ ДЕЙСТВИЯ`; smartBtnIcon.innerHTML = '<i class="fa-solid fa-fire"></i>'; } 
            else if (activeTrade.status === 'review') { smartBtnText.innerText = `👀 ПРОВЕРКА АДМИНОМ`; smartBtnIcon.innerHTML = '<i class="fa-solid fa-hourglass-half"></i>'; } 
            else { smartBtnText.innerText = `⏳ ОЖИДАНИЕ ЗАЯВКИ`; smartBtnIcon.innerHTML = '<i class="fa-regular fa-clock"></i>'; }
        } else { smartBtn.classList.remove('active-trade'); smartBtnText.innerText = 'История сделок'; smartBtnIcon.innerHTML = '<i class="fa-solid fa-clock-rotate-left"></i>'; }

        if (!trades || trades.length === 0) { listContainer.innerHTML = '<div style="text-align:center; margin-top:50px; color:#666;">История пуста</div>'; return; }
        listContainer.innerHTML = trades.map(t => {
            let caseName = t.case_name || (cachedP2PCases.find(c => c.id == t.case_id)?.case_name) || "Кейс #" + t.case_id;
            let statusBadge = '', actionHtml = '';
            switch(t.status) {
                case 'pending': statusBadge = '<span style="color:#aaa; background:rgba(255,255,255,0.1); padding:2px 8px; border-radius:4px; font-size:10px;">⏳ Ожидание</span>'; break;
                case 'active': statusBadge = '<span style="color:#000; background:#ffcc00; padding:2px 8px; border-radius:4px; font-size:10px; font-weight:bold;">🔥 Действуй</span>'; actionHtml = `<div style="margin-top:10px; background:rgba(255,204,0,0.1); padding:10px; border-radius:8px; border:1px dashed #ffcc00;"><div style="font-size:11px; color:#ccc; margin-bottom:8px;">1. Отправь трейд: <a href="${t.trade_url_given}" target="_blank" style="color:#2AABEE; font-weight:bold;">Открыть Steam</a></div><button onclick="confirmP2PSent(${t.id})" class="action-btn" style="width:100%; height:36px; background:#ffcc00; color:#000; border-radius:8px;">✅ Я передал скин</button></div>`; break;
                case 'review': statusBadge = '<span style="color:#fff; background:#2AABEE; padding:2px 8px; border-radius:4px; font-size:10px;">👀 Проверка</span>'; break;
                case 'completed': statusBadge = '<span style="color:#fff; background:#34c759; padding:2px 8px; border-radius:4px; font-size:10px;">✅ Готово</span>'; break;
                case 'canceled': statusBadge = '<span style="color:#fff; background:#ff3b30; padding:2px 8px; border-radius:4px; font-size:10px;">❌ Отмена</span>'; break;
            }
            return `<div style="background:#2c2c2e; border-radius:14px; padding:12px; border:1px solid rgba(255,255,255,0.05); margin-bottom:10px;"><div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:5px;"><div><div style="font-weight:700; font-size:14px; color:#fff;">${caseName}</div><div style="font-size:11px; color:#8E8E93;">Кол-во: ${t.quantity} шт.</div></div><div style="text-align:right;"><div style="color:#ffcc00; font-weight:700; font-size:14px;">+${t.total_coins}</div><div style="font-size:10px; color:#666;">#${t.id}</div></div></div><div style="display:flex; justify-content:space-between; align-items:center; margin-top:5px;">${statusBadge}<div style="font-size:10px; color:#666;">${new Date(t.created_at || Date.now()).toLocaleDateString()}</div></div>${actionHtml}</div>`;
        }).join('');
    } catch (e) { listContainer.innerHTML = `<div style="color:red; text-align:center;">Ошибка</div>`; }
}

window.confirmP2PSent = (tradeId) => {
    customConfirm("Вы точно передали предмет в Steam?", async (ok) => {
        if (!ok) return;
        try { await makeApiRequest('/api/v1/p2p/confirm_sent', { trade_id: parseInt(tradeId) }, 'POST'); customAlert("Отлично! Админ проверит поступление и начислит монеты."); loadP2PHistoryData(); checkActiveTradesBackground(); } catch (e) {}
    });
}

async function checkActiveTradesBackground(preloadedTrades = null) {
    try {
        let trades = preloadedTrades;
        if (!trades) {
            trades = await makeApiRequest('/api/v1/p2p/my_trades', {}, 'POST', true);
        }
        if(!trades) return;

        const activeTrades = trades.filter(t => ['pending', 'active', 'review'].includes(t.status)).sort((a, b) => ({'active':1,'review':2,'pending':3}[a.status] - {'active':1,'review':2,'pending':3}[b.status]));
        const btn = document.getElementById('open-p2p-modal-btn'); if (!btn) return;
        if (activeTrades.length > 0) {
            btn.classList.add('has-active-trade'); const t = activeTrades[0];
            btn.querySelector('.p2p-title').innerText = t.status === 'active' ? "ТРЕБУЕТСЯ ДЕЙСТВИЕ" : t.status === 'review' ? "ПРОВЕРКА АДМИНОМ" : "ЗАЯВКА СОЗДАНА";
            btn.querySelector('.p2p-subtitle').innerText = t.status === 'active' ? "Передайте скин в Steam" : t.status === 'review' ? "Ожидайте начисления монет" : "Ожидание принятия...";
            btn.querySelector('.p2p-icon-box').innerHTML = t.status === 'active' ? '<i class="fa-solid fa-fire"></i>' : t.status === 'review' ? '<i class="fa-solid fa-hourglass-half"></i>' : '<i class="fa-regular fa-clock"></i>';
        } else {
          btn.classList.remove('has-active-trade'); btn.querySelector('.p2p-title').innerText = "Trade-In"; btn.querySelector('.p2p-subtitle').innerHTML = `Обмен кейсов на <i class="fa-solid fa-coins" style="color: #ffd700;"></i>`; btn.querySelector('.p2p-icon-box').innerHTML = '<i class="fa-solid fa-arrow-right-arrow-left"></i>';
          }
    } catch(e) {}
}

// ================================================================
// АДМИНКА (СБРОС КЭША)
// ================================================================
window.toggleAdminMenu = () => { const btn = document.querySelector('.admin-fab-btn.toggle'); btn.classList.toggle('active'); document.getElementById('admin-menu-items').classList.toggle('show'); const i = btn.querySelector('i'); i.className = btn.classList.contains('active') ? 'fa-solid fa-xmark' : 'fa-solid fa-chevron-up'; }
window.openPassModal = () => { document.getElementById('password-modal').classList.remove('hidden'); document.getElementById('admin-pass-input').value = ''; }
window.closePassModal = () => { document.getElementById('password-modal').classList.add('hidden'); }
window.submitResetCache = () => {
    const pw = document.getElementById('admin-pass-input').value; if(!pw) return; closePassModal(); toggleAdminMenu();
    makeApiRequest('/api/v1/admin/shop/reset_cache', { password: pw }, 'POST').then(() => { customAlert("✅ Кэш очищен"); }).catch(()=>{});
}

// ================================================================
// СВАЙПЫ МЕЖДУ ВКЛАДКАМИ (ГЛАВНАЯ / КЕЙСЫ)
// ================================================================
function initSwipeTabs() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;
    
    let touchStartX = 0;
    let touchStartY = 0;

    mainContent.addEventListener('touchstart', (e) => {
        // Игнорируем свайпы на рулетке, слайдерах и горизонтальных списках
        if (e.target.closest('#main-slider-container') || e.target.closest('.r-game-area') || e.target.closest('.case-contents-grid')) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    mainContent.addEventListener('touchend', (e) => {
        if (touchStartX === 0) return;
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;

        const diffX = touchStartX - touchEndX;
        const diffY = touchStartY - touchEndY;

        // Если свайп горизонтальный и палец прошел больше 60 пикселей
        if (Math.abs(diffX) > 60 && Math.abs(diffX) > Math.abs(diffY)) {
            // Получаем все вкладки в виде массива
            const toggleOptions = Array.from(document.querySelectorAll('.toggle-option'));
            // Находим индекс текущей активной вкладки
            const currentIndex = toggleOptions.findIndex(opt => opt.classList.contains('active'));
            
            if (diffX > 0) {
                // Свайп влево (палец идет ←) -> Переключаем на СЛЕДУЮЩУЮ вкладку
                if (currentIndex < toggleOptions.length - 1) {
                    toggleOptions[currentIndex + 1].click();
                }
            } else {
                // Свайп вправо (палец идет →) -> Переключаем на ПРЕДЫДУЩУЮ вкладку
                if (currentIndex > 0) {
                    toggleOptions[currentIndex - 1].click();
                }
            }
        }
        touchStartX = 0; 
        touchStartY = 0;
    }, { passive: true });
}

// ================================================================
// ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ (Свайп-защита, P2R, Ивенты кнопок)
// ================================================================

// 1. Свайп-защита
document.body.addEventListener('touchmove', (e) => {
    // Добавили .custom-confirm-box и #wl-tasks-list в исключения!
    const isScrollable = e.target.closest('.main-content-scrollable') || e.target.closest('.modal-content') || e.target.closest('.case-contents-grid') || e.target.closest('.custom-confirm-box') || e.target.closest('#wl-tasks-list');
    if (!isScrollable && e.cancelable) e.preventDefault();
}, { passive: false });

// 2. ВОТ ФУНКЦИЯ, КОТОРУЮ ТЫ СЛУЧАЙНО УДАЛИЛ:
function initPullToRefresh() {
    const content = document.getElementById('main-content'); const ptr = document.getElementById('pull-to-refresh');
    if (!content || !ptr) return;
    let startY = 0, distance = 0, isPulling = false;
    content.addEventListener('touchstart', (e) => { if (content.scrollTop <= 0) { startY = e.touches[0].clientY; isPulling = true; content.style.transition = 'none'; ptr.style.transition = 'none'; } }, { passive: true });
    content.addEventListener('touchmove', (e) => {
        if (!isPulling) return; const diff = e.touches[0].clientY - startY;
        if (diff > 0 && content.scrollTop <= 0) { if (e.cancelable) e.preventDefault(); distance = Math.pow(diff, 0.85); if (distance > 150) distance = 150; content.style.transform = `translateY(${distance}px)`; ptr.style.transform = `translateY(${distance}px)`; }
    }, { passive: false });
    content.addEventListener('touchend', () => {
        if (!isPulling) return; isPulling = false; content.style.transition = 'transform 0.3s ease-out'; ptr.style.transition = 'transform 0.3s ease-out';
        if (distance > 80) { ptr.querySelector('i').classList.add('fa-spin'); if (window.Telegram?.WebApp?.HapticFeedback) Telegram.WebApp.HapticFeedback.notificationOccurred('success'); setTimeout(() => window.location.reload(), 500); } 
        else { content.style.transform = 'translateY(0)'; ptr.style.transform = 'translateY(0)'; } distance = 0;
    });
}

function initBottomSwipe() {
    const content = document.getElementById('main-content'); 
    if (!content) return;
    
    let startY = 0, isPullingBottom = false, wheelAccumulator = 0;
    let isAnimating = false; 

    const triggerThemeSwitch = () => {
        if (isAnimating) return;
        isAnimating = true; 
        isPullingBottom = false; 
        wheelAccumulator = 0;

        if (window.Telegram?.WebApp?.HapticFeedback) Telegram.WebApp.HapticFeedback.impactOccurred('heavy'); 
        
        const isLight = document.body.classList.toggle('light-theme');
        const darkWrap = document.getElementById('dark-wrapper');
        const lightWrap = document.getElementById('light-wrapper');

        // 🔥 ФИКС: Мгновенная смена без анимации (оставляем только это) 🔥
        const bPill = document.querySelector('.balance-pill');
        const bRow = document.querySelector('.balance-row');
        const burger = document.querySelector('.glass-burger');
        const burgerSpans = document.querySelectorAll('.glass-burger span');
        const logoTitle = document.querySelector('.top-header .logo-title');
        const logoSub = document.querySelector('.logo-subtitle');

        // 1. Убиваем все транзишены, чтобы цвета из CSS применились мгновенно
        const elementsToForce = [bPill, bRow, burger, logoTitle, logoSub, ...burgerSpans];
        elementsToForce.forEach(el => {
            if (el) el.style.transition = 'none';
        });

        // 2. Цвета теперь НЕ ставятся через JS. Они берутся из твоего CSS.
        // Блок принудительной установки цветов удален.

        // 3. Возвращаем родные анимации через 50мс
        setTimeout(() => {
            elementsToForce.forEach(el => {
                if (el) el.style.transition = '';
            });
        }, 50);

        // Плавно переключаем блоки контента (эта часть без изменений)
        if (darkWrap && lightWrap) {
            darkWrap.style.transition = 'opacity 0.2s ease-in-out';
            lightWrap.style.transition = 'opacity 0.2s ease-in-out';

            if (isLight) {
                darkWrap.style.opacity = '0';
                setTimeout(() => {
                    darkWrap.style.display = 'none';
                    lightWrap.style.display = 'block';
                    content.scrollTop = 0; 
                    setTimeout(() => {
                        lightWrap.style.opacity = '1';
                        setTimeout(() => isAnimating = false, 200);
                    }, 50); 
                }, 200);
            } else {
                lightWrap.style.opacity = '0';
                setTimeout(() => {
                    lightWrap.style.display = 'none';
                    darkWrap.style.display = 'block';
                    content.scrollTop = 0; 
                    setTimeout(() => {
                        darkWrap.style.opacity = '1';
                        setTimeout(() => isAnimating = false, 200);
                    }, 50);
                }, 200);
            }
        } else {
            isAnimating = false;
        }
    };

    const canSwipeBottom = () => {
        if (document.body.classList.contains('light-theme')) return true; 
        const dashboardView = document.getElementById('view-dashboard');
        return dashboardView && (dashboardView.classList.contains('active') || window.getComputedStyle(dashboardView).display !== 'none');
    };

    // ==========================================
    // 1. СЕНСОР (ТЕЛЕФОНЫ)
    // ==========================================
    content.addEventListener('touchmove', (e) => {
        if (isAnimating) return;
        
        const bottomDistance = content.scrollHeight - content.scrollTop - content.clientHeight;
        const isAtBottom = bottomDistance < 10; 
        
        if (isAtBottom) {
            if (!isPullingBottom) {
                startY = e.touches[0].clientY;
                isPullingBottom = true;
            }
            
            const diff = startY - e.touches[0].clientY; 
            
            if (diff > 0) { 
                if (canSwipeBottom()) {
                    if (e.cancelable) e.preventDefault(); 
                    if (diff > 40) triggerThemeSwitch();
                } else {
                    isPullingBottom = false; 
                }
            }
        } else {
            isPullingBottom = false;
        }
    }, { passive: false });
    
    content.addEventListener('touchend', () => { isPullingBottom = false; });

    // ==========================================
    // 2. ДЕСКТОП (КОЛЕСИКО ВНИЗ) - ОПТИМИЗИРОВАНО
    // ==========================================
    let wheelTimeout;
    let isWheelHandling = false; // Флаг для requestAnimationFrame

    content.addEventListener('wheel', (e) => {
        if (isAnimating || isWheelHandling) return;
        
        isWheelHandling = true;
        
        // Оборачиваем вычисления в requestAnimationFrame для плавности на десктопе
        requestAnimationFrame(() => {
            const bottomDistance = content.scrollHeight - content.scrollTop - content.clientHeight;
            
            if (bottomDistance < 10 && e.deltaY > 0) {
                if (canSwipeBottom()) {
                    if (e.cancelable) e.preventDefault();
                    wheelAccumulator += e.deltaY;
                    if (wheelAccumulator > 100) triggerThemeSwitch();
                    
                    clearTimeout(wheelTimeout);
                    wheelTimeout = setTimeout(() => { wheelAccumulator = 0; }, 200);
                }
            }
            isWheelHandling = false; // Освобождаем флаг для следующего кадра
        });
    }, { passive: false });
}

// 3. Безопасный клик (из-за которого была прошлая проблема)
document.body.addEventListener('click', async (event) => {
    // Ищем кнопку безопасно при клике
    const claimSuperBtn = event.target.closest('#claim-super-prize-btn'); 
    if (claimSuperBtn && !claimSuperBtn.disabled) {
        claimSuperBtn.disabled = true; 
        claimSuperBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        try { 
            const res = await makeApiRequest('/api/v1/user/weekly_goals/claim_super_prize', {}); 
            if (res.new_ticket_balance) document.getElementById('ticketStats').textContent = res.new_ticket_balance; 
            claimSuperBtn.textContent = 'Получено!'; 
            claimSuperBtn.classList.add('action-btn', 'btn-disabled'); 
            claimSuperBtn.disabled = true; 
            if(window.Telegram?.WebApp) customAlert("Суперприз получен!"); 
        } catch(e) { 
            claimSuperBtn.disabled = false; 
            claimSuperBtn.textContent = 'Забрать'; 
        }
    }
});

// Добавляем слушатели на кнопки подарков
document.getElementById('daily-gift-btn')?.addEventListener('click', () => { document.getElementById('gift-modal-overlay').classList.remove('hidden'); document.getElementById('gift-content-initial').classList.remove('hidden'); document.getElementById('gift-content-result').classList.add('hidden'); });
document.getElementById('gift-open-btn')?.addEventListener('click', async function() { 
    const btn = this;
    const originalHtml = btn.innerHTML; // Запоминаем исходный текст (например, "Открыть")
    
    try { 
        // 1. Мгновенно блокируем кнопку и показываем спиннер
        btn.disabled = true; 
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Открываем...';
        
        // 2. Делаем запрос к нашему новому бронебойному эндпоинту
        const res = await makeApiRequest('/api/v1/gift/claim', {}, 'POST'); 
        
        // 3. Рисуем результат (успех или просьба подписаться)
        renderGiftResult(res); 
        checkBalance(true); 
        
        // 4. Возвращаем кнопку в исходное состояние (на случай, если юзер не подписан 
        // и ему придется нажимать ее снова после подписки)
        btn.innerHTML = originalHtml;
        btn.disabled = false;

    } catch (e) { 
        // Если пришла ошибка (например, 400 "Уже забрал" или "Отключено")
        // makeApiRequest УЖЕ показал customAlert, поэтому нам остается только:
        
        btn.disabled = false; 
        btn.innerHTML = originalHtml;
        
        // Закрываем окно подарка, чтобы оно не висело на фоне ошибки
        document.getElementById('gift-modal-overlay').classList.add('hidden');
    } 
});
document.getElementById('gift-x-btn')?.addEventListener('click', () => document.getElementById('gift-modal-overlay').classList.add('hidden'));
document.getElementById('gift-close-btn')?.addEventListener('click', () => document.getElementById('gift-modal-overlay').classList.add('hidden'));

// 🔥 Глобальный флаг: запоминаем, показывали ли уже окно
window.hasShownBotAuthWarning = false;

window.showBotAuthWarning = function() {
    // Если окно уже открыто ИЛИ мы его уже показывали после загрузки страницы — блокируем
    if (window.hasShownBotAuthWarning || document.getElementById('bot-auth-modal')) return;

    // Ставим галочку, что мы предупредили юзера
    window.hasShownBotAuthWarning = true;

    const overlay = document.createElement('div');
    overlay.id = 'bot-auth-modal';
    
    // Делаем затемнение поверх всего
    overlay.style.cssText = "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.85); z-index: 99999999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px); opacity: 0; transition: opacity 0.3s;";

    overlay.innerHTML = `
        <div class="custom-confirm-box" style="padding: 24px 20px; width: 90%; max-width: 350px; background: #1c1c1e; border-radius: 16px; border: 1px solid rgba(42, 171, 238, 0.3); text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.8);">
            <i class="fa-brands fa-telegram" style="font-size:44px; color:#2AABEE; margin-bottom:15px; display:block; filter: drop-shadow(0 0 10px rgba(42, 171, 238, 0.4));"></i>
            <h3 style="color: #fff; font-size: 18px; margin-bottom: 10px; font-weight: 800;">HATElavka тебя не знает((</h3>
            
            <div style="margin-bottom: 15px; font-size: 13px; color: #bbb; line-height: 1.4; text-align: left;">
                По правилам Telegram боты <b>не могут писать первыми</b> и проверять твой профиль, пока ты сам с ними не поздороваешься.<br><br>
                Чтобы баланс обновлялся и покупки работали как часы, запусти основного <b>или</b> альтернативного бота:
            </div>

            <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; text-align: left;">
                
                <a href="https://t.me/HATElavka_bot" target="_blank" onclick="if(window.Telegram?.WebApp) { Telegram.WebApp.openTelegramLink('https://t.me/HATElavka_bot'); return false; }" style="display: flex; align-items: center; gap: 10px; background: rgba(42, 171, 238, 0.1); padding: 10px; border-radius: 10px; text-decoration: none; color: #fff; border: 1px solid rgba(42, 171, 238, 0.2); transition: background 0.2s;">
                    <i class="fa-solid fa-robot" style="color: #2AABEE; width: 24px; text-align: center; font-size: 16px;"></i>
                    <div style="flex-grow: 1;">
                        <div style="font-size: 13px; font-weight: 700;">Основной бот</div>
                        <div style="color: #888; font-size: 10px; margin-top: 2px;">Полный функционал проекта</div>
                    </div>
                </a>

                <a href="https://t.me/quest_hatelavka_bot" target="_blank" onclick="if(window.Telegram?.WebApp) { Telegram.WebApp.openTelegramLink('https://t.me/quest_hatelavka_bot'); return false; }" style="display: flex; align-items: center; gap: 10px; background: rgba(145, 70, 255, 0.1); padding: 10px; border-radius: 10px; text-decoration: none; color: #fff; border: 1px solid rgba(145, 70, 255, 0.2); transition: background 0.2s;">
                    <i class="fa-solid fa-user-ninja" style="color: #9146ff; width: 24px; text-align: center; font-size: 16px;"></i>
                    <div style="flex-grow: 1;">
                        <div style="font-size: 13px; font-weight: 700;">Альтернативный бот</div>
                        <div style="color: #888; font-size: 10px; margin-top: 2px; line-height: 1.2;">Никакой рекламы, только важные уведомления (можно выключить в профиле)</div>
                    </div>
                </a>
                
                <div style="width: 100%; height: 1px; background: rgba(255,255,255,0.05); margin: 4px 0;"></div>

                <a href="https://t.me/hatelove_ttv" target="_blank" onclick="if(window.Telegram?.WebApp) { Telegram.WebApp.openTelegramLink('https://t.me/hatelove_ttv'); return false; }" style="display: flex; align-items: center; gap: 10px; background: rgba(255, 215, 0, 0.05); padding: 10px; border-radius: 10px; text-decoration: none; color: #fff; border: 1px solid rgba(255, 215, 0, 0.1); transition: background 0.2s;">
                    <i class="fa-solid fa-bullhorn" style="color: #ffd700; width: 24px; text-align: center; font-size: 16px;"></i>
                    <div>
                        <div style="font-size: 13px; font-weight: 700;">Наш канал</div>
                        <div style="color: #888; font-size: 10px; margin-top: 2px;">@hatelove_ttv</div>
                    </div>
                </a>
                
                <a href="https://t.me/hatelovettv" target="_blank" onclick="if(window.Telegram?.WebApp) { Telegram.WebApp.openTelegramLink('https://t.me/hatelovettv'); return false; }" style="display: flex; align-items: center; gap: 10px; background: rgba(52, 199, 89, 0.05); padding: 10px; border-radius: 10px; text-decoration: none; color: #fff; border: 1px solid rgba(52, 199, 89, 0.1); transition: background 0.2s;">
                    <i class="fa-solid fa-comments" style="color: #34c759; width: 24px; text-align: center; font-size: 16px;"></i>
                    <div>
                        <div style="font-size: 13px; font-weight: 700;">Наш чат</div>
                        <div style="color: #888; font-size: 10px; margin-top: 2px;">@hatelovettv</div>
                    </div>
                </a>
            </div>

            <button id="close-bot-auth-btn" style="width: 100%; background: #333; color: #fff; border: none; border-radius: 10px; padding: 14px; font-size: 13px; font-weight: 600; cursor: pointer; transition: background 0.2s;">Я все понял, закрыть</button>
        </div>
    `;

    document.body.appendChild(overlay);
    
    // Плавное появление
    requestAnimationFrame(() => overlay.style.opacity = '1');

    // Кнопка закрытия
    overlay.querySelector('#close-bot-auth-btn').onclick = function() {
        this.innerHTML = 'Закрываем...';
        this.style.background = '#444';
        
        // Даем анимации прокрутиться и просто закрываем окно (без дергания API)
        setTimeout(() => {
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.remove();
            }, 300);
        }, 300);
    };
};

// Специальное окно для блокировки абузеров (с возможностью смены Trade-ссылки)
window.showSecurityBlock = function(message) {
    lockAppScroll(); 
    
    const old = document.getElementById('security-trade-modal');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'security-trade-modal';
    
    // 🔥 ЖЕСТКО ЗАДАЕМ Z-INDEX ПОВЕРХ ВСЕГО МИРА 🔥
    overlay.style.cssText = "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.95); z-index: 9999999999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(15px); opacity: 0; transition: opacity 0.3s;";
    
    overlay.innerHTML = `
        <div class="custom-confirm-box" style="padding: 24px 20px; width: 90%; max-width: 340px; background: #1c1c1e; border-radius: 16px; border: 1px solid rgba(255,59,48,0.3); text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.8);">
            <i class="fa-solid fa-shield-halved" style="font-size:44px; color:#ff3b30; margin-bottom:15px; display:block; filter: drop-shadow(0 0 10px rgba(255, 59, 48, 0.4));"></i>
            <h3 class="confirm-title" style="color: #ff3b30; font-size: 20px; margin-bottom: 10px; font-weight: 800;">Доступ ограничен</h3>
            <div class="confirm-subtitle" style="margin-bottom: 20px; font-size: 13px; color: #ddd; line-height: 1.4;">${message}</div>
            
            <div style="text-align: left; margin-bottom: 20px; background: rgba(0,0,0,0.4); padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
                <label style="font-size: 11px; color: #8e8e93; font-weight: 600; margin-bottom: 8px; display: block;">Обновите Trade-ссылку для разблокировки:</label>
                <input type="url" id="security-trade-input" placeholder="https://steamcommunity.com/tradeoffer/new/..." style="width: 100%; background: #2c2c2e; border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 12px; border-radius: 10px; font-size: 12px; outline: none; box-sizing: border-box; transition: border-color 0.2s;">
                <div style="text-align: right; margin-top: 6px;">
                    <a href="https://steamcommunity.com/id/me/tradeoffers/privacy#trade_offer_access_url" target="_blank" style="font-size: 11px; color: #2AABEE; text-decoration: none; font-weight: 500;"><i class="fa-solid fa-circle-question"></i> Где найти?</a>
                </div>
            </div>

            <div class="confirm-buttons" style="display: flex; flex-direction: column; gap: 10px;">
                <button class="confirm-btn btn-yellow-modal" id="security-save-btn" style="width: 100%; padding: 14px; font-size: 14px; background: #ffcc00; color: #000; border: none; border-radius: 10px; font-weight: 700;">Сохранить и продолжить</button>
                <button class="confirm-btn btn-cancel-modal" id="security-support-btn" style="width: 100%; background: rgba(255,255,255,0.05); color: #8e8e93; border: none; border-radius: 10px; padding: 14px; font-size: 13px; font-weight: 600;">Написать в поддержку</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.style.opacity = '1');

    const saveBtn = overlay.querySelector('#security-save-btn');
    const input = overlay.querySelector('#security-trade-input');
    
    input.addEventListener('input', (e) => {
        let val = e.target.value.trim();
        if (val.includes("https://") && !val.startsWith("https://")) {
            val = val.substring(val.indexOf("https://"));
            input.value = val;
        }
        
        if (val.length > 20 && (!val.startsWith("https://steamcommunity.com") || !val.includes("partner=") || !val.includes("token="))) {
            input.style.borderColor = '#ff3b30';
        } else {
            input.style.borderColor = 'rgba(255,255,255,0.1)';
        }
    });

    saveBtn.onclick = async () => {
        const v = input.value.trim();
        if (!v.startsWith("https://steamcommunity.com/tradeoffer/new") || !v.includes("partner=") || !v.includes("token=")) {
            input.style.borderColor = '#ff3b30';
            const originalText = saveBtn.innerHTML;
            saveBtn.innerText = "Неверный формат ссылки!";
            saveBtn.style.background = "#ff3b30";
            saveBtn.style.color = "#fff";
            
            setTimeout(() => {
                saveBtn.innerHTML = originalText;
                saveBtn.style.background = "#ffcc00";
                saveBtn.style.color = "#000";
            }, 2000);
            return;
        }

        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Сохранение...';

        try {
            const payload = getAuthPayload();
            const response = await fetch('/api/v1/user/trade_link/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trade_link: v, ...payload })
            });

            if (!response.ok) throw new Error("Save failed");
            
            saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Сохранено!';
            saveBtn.style.background = "#34c759";
            saveBtn.style.color = "#fff";
            
            // Если сохранили успешно - перезагружаем бота. Блок спадет сам.
            setTimeout(() => {
                window.location.reload();
            }, 1000);

        } catch (e) {
            saveBtn.disabled = false;
            saveBtn.innerText = "Ошибка сохранения";
            saveBtn.style.background = "#ff3b30";
            saveBtn.style.color = "#fff";
            
            setTimeout(() => {
                saveBtn.innerText = "Сохранить и продолжить";
                saveBtn.style.background = "#ffcc00";
                saveBtn.style.color = "#000";
            }, 2000);
        }
    };

    overlay.querySelector('#security-support-btn').onclick = () => {
        if (window.Telegram && Telegram.WebApp) {
            Telegram.WebApp.openTelegramLink("https://t.me/hatelove_twitch");
        } else {
            window.location.href = "https://t.me/hatelove_twitch";
        }
    };
};

// ================================================================
// УНИВЕРСАЛЬНЫЕ КАСТОМНЫЕ ДИАЛОГИ И FAQ
// ================================================================

// ================================================================
// ЛОГИКА РАСПИСАНИЯ СТРИМОВ
// ================================================================
const dayNames = {
    monday: "Понедельник", tuesday: "Вторник", wednesday: "Среда",
    thursday: "Четверг", friday: "Пятница", saturday: "Суббота", sunday: "Воскресенье"
};
let currentSchedule = {};
let isScheduleEditMode = false;

window.openScheduleModal = async () => {
    document.getElementById('modal-schedule').classList.add('modal-active');
    const container = document.getElementById('schedule-container');
    const btnEdit = document.getElementById('btn-edit-schedule');
    const btnSave = document.getElementById('btn-save-schedule');
    
    // Сброс состояния
    isScheduleEditMode = false;
    btnEdit.style.display = 'none';
    btnSave.style.display = 'none';
    btnEdit.style.color = "var(--text-sec)";
    container.innerHTML = '<div style="text-align:center; color:#888;"><i class="fa-solid fa-circle-notch fa-spin"></i> Загрузка...</div>';
    
    if (window.Telegram?.WebApp?.HapticFeedback) {
        Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }

    try {
        const res = await makeApiRequest('/api/v1/schedule/get', {}, 'POST', true);
        if (res) {
            currentSchedule = res.schedule;
            
            // Если бэкенд сказал, что это админ - показываем "скрытую" кнопку-карандаш
            if (res.is_admin) {
                btnEdit.style.display = 'block';
            }
            
            window.renderSchedule();
        } else {
            container.innerHTML = '<div style="text-align:center; color:var(--danger);">Ошибка загрузки расписания</div>';
        }
    } catch (e) {
        container.innerHTML = '<div style="text-align:center; color:var(--danger);">Ошибка сети</div>';
    }
};

window.closeScheduleModal = () => {
    document.getElementById('modal-schedule').classList.remove('modal-active');
};

window.renderSchedule = () => {
    const container = document.getElementById('schedule-container');
    container.innerHTML = '';

    // Определяем текущий день недели (0 - воскресенье, 1 - понедельник и т.д.)
    const daysMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayKey = daysMap[new Date().getDay()];

    Object.keys(dayNames).forEach(dayKey => {
        const dayText = dayNames[dayKey];
        const timeText = currentSchedule[dayKey] || "Выходной";
        
        // Проверяем, является ли этот день сегодняшним
        const isToday = dayKey === todayKey;
        const highlightStyle = isToday ? 'color: #FFD700; font-weight: 900; text-shadow: 0 0 10px rgba(255, 215, 0, 0.3);' : '';

        const row = document.createElement('div');
        row.className = 'schedule-row';
        if (isToday) row.style.background = 'rgba(255, 215, 0, 0.05)'; // Легкий фон для строки
        
        row.innerHTML = `
            <div class="schedule-day" style="${highlightStyle}">${dayText}</div>
            <div class="schedule-time" id="text-${dayKey}" style="${highlightStyle}">${escapeHTML(timeText)}</div>
            <input type="text" class="schedule-input" id="input-${dayKey}" value="${escapeHTML(timeText)}">
        `;
        container.appendChild(row);
    });
};

window.toggleScheduleEdit = () => {
    isScheduleEditMode = !isScheduleEditMode;
    const btnEdit = document.getElementById('btn-edit-schedule');
    const btnSave = document.getElementById('btn-save-schedule');
    
    if (window.Telegram?.WebApp?.HapticFeedback) {
        Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    }

    Object.keys(dayNames).forEach(dayKey => {
        const textEl = document.getElementById(`text-${dayKey}`);
        const inputEl = document.getElementById(`input-${dayKey}`);
        
        if (isScheduleEditMode) {
            textEl.style.display = 'none';
            inputEl.style.display = 'block';
        } else {
            // Если отменили редактирование, возвращаем старые значения
            inputEl.value = currentSchedule[dayKey];
            textEl.style.display = 'block';
            inputEl.style.display = 'none';
        }
    });

    if (isScheduleEditMode) {
        btnEdit.style.color = "var(--action)"; // Карандаш зеленеет
        btnSave.style.display = 'block';
    } else {
        btnEdit.style.color = "var(--text-sec)";
        btnSave.style.display = 'none';
    }
};

window.saveSchedule = async () => {
    const btnSave = document.getElementById('btn-save-schedule');
    const originalText = btnSave.innerHTML;
    btnSave.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> СОХРАНЕНИЕ...';
    btnSave.disabled = true;

    // Собираем новые данные из инпутов
    const newSchedule = {};
    Object.keys(dayNames).forEach(dayKey => {
        newSchedule[dayKey] = document.getElementById(`input-${dayKey}`).value.trim() || "Выходной";
    });

    try {
        const res = await makeApiRequest('/api/v1/admin/schedule/update', { schedule: newSchedule }, 'POST');
        if (res && res.success) {
            if (window.Telegram?.WebApp?.HapticFeedback) Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            customAlert("✅ Расписание успешно обновлено!");
            currentSchedule = newSchedule;
            window.toggleScheduleEdit(); 
            window.renderSchedule(); 
        }
    } catch(e) {
        // Ошибка уже покажется через customAlert внутри твоего makeApiRequest
    } finally {
        btnSave.innerHTML = originalText;
        btnSave.disabled = false;
    }
};

// ================================================================
// ЛОГИКА КУПОНОВ
// ================================================================
window.openCouponModal = () => {
    document.getElementById('coupon-modal').classList.remove('hidden');
    document.getElementById('coupon-input').value = '';
};

window.closeCouponModal = () => {
    document.getElementById('coupon-modal').classList.add('hidden');
};

window.pasteCoupon = async () => {
    try {
        const text = await navigator.clipboard.readText();
        document.getElementById('coupon-input').value = text;
        if (window.Telegram?.WebApp?.HapticFeedback) Telegram.WebApp.HapticFeedback.selectionChanged();
    } catch (err) {
        customAlert('Не удалось вставить текст. Проверьте разрешения браузера.');
    }
};

window.activateCouponSubmit = async () => {
    const input = document.getElementById('coupon-input');
    const code = input.value.trim(); // <--- Теперь фронт отправляет ровно то, что ввел юзер
    if (!code) return customAlert("Введите промокод!");

    const btn = document.getElementById('activate-coupon-btn');
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Проверка...';

    try {
        const res = await makeApiRequest('/api/cs/check_code', { code: code }, 'POST');
        
        if (res.valid) {
            customAlert("✅ " + res.message);
            closeCouponModal();
            
            // Добавляем в массив для моментального визуала
            if (res.target_case_name && !window.activeFreeCases.includes(res.target_case_name)) {
                window.activeFreeCases.push(res.target_case_name);
            }
            
            // Переходим в магазин
            const shopTab = document.querySelector('.toggle-option[data-target="view-shop"]');
            if (shopTab) shopTab.click();
            
            // 🔥 ЖЕЛЕЗОБЕТОННЫЙ ФИКС: Принудительно рендерим витрину из кэша памяти прямо сейчас, 
            // потому что массив activeFreeCases пополнился, а цены сервера могли не поменяться!
            if (window.currentCategoryId && itemsCache[window.currentCategoryId]) {
                renderItems(itemsCache[window.currentCategoryId]);
            }
            
            // А потом уже тихо обновляем с сервера для галочки
            if(typeof window.loadCategory === 'function') window.loadCategory(window.currentCategoryId || 2716312);

        } else {
            customAlert("❌ " + res.message);
        }
    } catch (e) {
        console.error("Ошибка активации:", e);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
    }
};

// ================================================================
// МОДУЛЬ ПОДПИСКИ (В РАЗРАБОТКЕ)
// ================================================================
window.openSubscriptionModal = () => {
    // В будущем здесь мы будем проверять реальный статус подписки юзера
    // const isPremium = userData.is_premium;

    showShopModal({
        title: '<span style="color: #FFD700; font-weight: 900; text-shadow: 0 0 10px rgba(255, 215, 0, 0.4);"><i class="fa-solid fa-crown"></i> HATElavka Premium</span>',
        subtitle: `
            <div style="text-align: left; font-size: 12px; color: #ccc; line-height: 1.4;">
                <div style="text-align: center; margin-bottom: 15px; font-size: 13px; color: #fff; font-weight: bold;">
                    Модуль находится в разработке 🛠
                </div>
                Будущие преимущества подписки:<br><br>
                <i class="fa-solid fa-shield-halved" style="color: #34c759; width: 20px;"></i> Всегда <b style="color: #34c759;">зеленый</b> траст-фактор<br>
                <i class="fa-solid fa-box-open" style="color: #2AABEE; width: 20px;"></i> Бесплатный кейс раз в неделю<br>
                <i class="fa-solid fa-fire" style="color: #ff9500; width: 20px;"></i> Выделенный статус в Гринде<br>
                <i class="fa-solid fa-ticket" style="color: #9146ff; width: 20px;"></i> Закрытые Premium-розыгрыши
            </div>
        `,
        confirmText: "КУПИТЬ (СКОРО)",
        confirmClass: "btn-buy", // Сделает кнопку золотой
        showCancel: true,
        onConfirm: (close) => {
            // Пока тут просто закрываем окно. Потом сюда повесим вызов кассы.
            close();
        }
    });
};

// ================================================================
// FAQ БОТА
// ================================================================
window.showFaq = function() {
    const faqHtml = '<div style="text-align: left; font-size: 13px; line-height: 1.35; color: #ddd; max-height: 60vh; overflow-y: auto; padding-right: 5px;">' +
        '<div>Добро пожаловать в <b>HATElavka</b>! Чтобы ты не запутался, вот краткий путеводитель:</div><br>' +
        
        '<div><b style="color: #fff;">💰 Валюта и прогресс</b><br>' +
        '<span style="color: #ffd700;">•</span> <b>Монетки:</b> Твоя основная валюта, с помощью них ты можешь открывать кейсы и участвовать в платных ивентах.<br>' +
        '<span style="color: #2AABEE;">•</span> <b>Билеты:</b> Это монета активности, открывает возможность пользоваться аукционом и розыгрышами.</div><br>' +
        
        '<div><b style="color: #fff;">📋 Как зарабатывать</b><br>' +
        '• <b>Задания и Челленджи:</b> Проявляй активность в TG/Twitch.<br>' +
        '• <b>Недельные испытания:</b> Выполняй цели за неделю и получай приз недели.</div><br>' +
        
        '<div><b style="color: #fff;">🎁 Активности и Ивенты</b><br>' +
        'Участвуй в различных <b>Ивентах</b>, делай ставки на <b>Аукционах</b> и крути <b>Рулетки</b> за скины.</div><br>' +
        
        '<div><b style="color: #fff;">🛒 TRADE IT</b><br>' +
        'Продавай кейсы в разделе кейсы.<br>' +
        '⚠️ <span style="color: #ff3b30; font-weight: 700;">Обязательно укажи актуальную Trade Link Steam в профиле для вывода скинов!</span></div>' +
        
        '<div style="background: rgba(255, 215, 0, 0.1); border-left: 3px solid #ffd700; padding: 6px 10px; border-radius: 4px; margin: 8px 0;">' +
        '⚠️ <b style="color: #ffd700;">Помним, что Валя — соло-разработчик, баги это нормально! 😉</b></div>' +
        
        '<div><b style="color: #fff;">🔗 Важно:</b> Для работы авто-заданий привяжи аккаунт Telegram к Twitch. Если что-то не считается — пиши Валентину!</div>' +
    '</div>';

    showShopModal({
        title: "📖 Как работает бот?",
        subtitle: faqHtml,
        confirmText: "Спасибо!",
        confirmClass: "btn-yellow-modal",
        showCancel: false,
        onConfirm: (close) => close()
    });
};


// ================================================================
// ГЛАВНЫЙ ЗАПУСК (СИНХРОННАЯ ЗАГРУЗКА ВСЕГО ЭКРАНА)
// ================================================================
async function main() {
    console.log("🚀 [MAIN] Старт инициализации приложения");
    
    // Если мы в ВК, сначала пытаемся догрузить конфиг из моста
    if (window.isVk && !window.vkParams) {
        await fetchVkParamsFromBridge();
    }

// 1. Первичная проверка среды
    let env = detectEnvironmentSync();

    // 2. Если скрипт Telegram SDK не загрузился (например, сбой сети), но есть признаки Telegram — экстренно догружаем SDK
    if (!env.isVkApp && typeof window.Telegram === 'undefined' && env.isTelegramApp) {
        console.warn("⚠️ Обнаружен клиент Telegram, но SDK не загружен. Запускаем резервную подгрузку...");
        await new Promise((resolve) => {
            const backupScript = document.createElement('script');
            backupScript.src = "https://telegram.org/js/telegram-web-app.js";
            backupScript.onload = resolve;
            backupScript.onerror = resolve;
            document.head.appendChild(backupScript);
            setTimeout(resolve, 2500);
        });
    }

    // 3. Если есть объект Telegram.WebApp, но initData еще пустой — ждем инициализацию моста
    if (!env.isVkApp && window.Telegram?.WebApp && !window.Telegram.WebApp.initData && !env.savedInitData) {
        try { window.Telegram.WebApp.ready(); } catch (e) {}
        // Если платформа не 'unknown' (значит мы 100% в клиенте ТГ), ждем до 2.5 секунд, а в обычном браузере — всего 0.4 сек
        const maxAttempts = (window.Telegram.WebApp.platform && window.Telegram.WebApp.platform !== 'unknown') ? 25 : 4;
        let attempts = 0;
        while (!window.Telegram.WebApp.initData && attempts < maxAttempts) {
            await new Promise(r => setTimeout(r, 100));
            attempts++;
        }
    }

    // 4. Финальный пересчет среды после ожидания SDK
    env = detectEnvironmentSync();
    let isBrowserMode = env.isWebBrowser;

    // 5. Чистим конфликтующие классы и выставляем точные классы среды на body
    if (isBrowserMode) {
        document.body.classList.remove('ios-mode', 'android-mode', 'desktop-mode', 'tg-mode');
        document.body.classList.add('browser-mode');
    } else if (env.isTelegramApp) {
        document.body.classList.remove('browser-mode');
        document.body.classList.add('tg-mode');
    }

    // Если это ВК и нет параметров — рубим
    if (env.isVkApp && !window.vkParams) {
        console.error("💀 ВК не отдал параметры, прерываем запуск.");
        if (dom.loaderOverlay) dom.loaderOverlay.classList.add('hidden'); 
        return;
    }

    console.log(`✅ [ENV DETECTOR] Среда: ${env.isVkApp ? 'VK' : (isBrowserMode ? 'WEB BROWSER' : 'TELEGRAM APP')} | ОС: ${env.osPlatform} | Устройство: ${env.deviceType}`);

// 👇 БРОНЕБОЙНЫЙ ОБХОД ДЛЯ ОБЫЧНОГО БРАУЗЕРА 👇
if (isBrowserMode) {
    document.body.classList.add('browser-mode');
    
    // 🔥 ПРОВЕРЯЕМ: ПК ЭТО ИЛИ ТЕЛЕФОН? 🔥
    const isPC = getPlatformType() === 'pc';

    // ЕСЛИ ЭТО ПК — ПРИМЕНЯЕМ ШИРОКИЙ ДИЗАЙН И СЛИЯНИЕ ВКЛАДОК
    if (isPC) {
        // =========================================================================
        // 🔥 НОВОЕ: ОБЪЕДИНЯЕМ ВКЛАДКИ (ГЛАВНАЯ + КЕЙСЫ) ДЛЯ WEB 🔥
        // =========================================================================
        const dashboard = document.getElementById('view-dashboard');
        const shop = document.getElementById('view-shop');
        
        if (dashboard && shop) {
            // Создаем красивый визуальный разделитель
            const separator = document.createElement('div');
            separator.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; gap: 15px; margin: 40px 16px 20px 16px;">
                    <div style="flex-grow: 1; height: 1px; background: linear-gradient(to right, transparent, rgba(255, 215, 0, 0.3));"></div>
                    <h2 style="color: #ffd700; font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; margin: 0; text-shadow: 0 0 10px rgba(255,215,0,0.4);">
                        <i class="fa-solid fa-box-open" style="margin-right: 5px;"></i> Магазин
                    </h2>
                    <div style="flex-grow: 1; height: 1px; background: linear-gradient(to left, transparent, rgba(255, 215, 0, 0.3));"></div>
                </div>
            `;
            dashboard.appendChild(separator);

            // Перекидываем всё содержимое из shop в dashboard (Trade-In, Swap, Фильтр, Сетку)
            while (shop.childNodes.length > 0) {
                dashboard.appendChild(shop.childNodes[0]);
            }
            shop.remove(); // Удаляем опустевший скрытый контейнер
        }

        // Лечим тумблер (оставляем только 2 кнопки: "ГЛАВНАЯ" и "ИГРЫ")
        const toggleWrapper = document.getElementById('mode-toggle');
        if (toggleWrapper) {
            // Удаляем саму кнопку "КЕЙСЫ"
            const shopToggle = toggleWrapper.querySelector('.toggle-option[data-target="view-shop"]');
            if (shopToggle) shopToggle.remove();

            // Добавляем стили для перерасчета ширины под 2 кнопки
            const style = document.createElement('style');
            style.innerHTML = `
                body.browser-mode #mode-toggle.toggle-wrapper { width: 200px !important; }
                body.browser-mode #mode-toggle .toggle-slider { width: calc(50% - 2.5px) !important; }
            `;
            document.head.appendChild(style);

            // Переназначаем логику кликов, чтобы слайдер не улетал за пределы (0% и 100%)
            const newToggleWrapper = toggleWrapper.cloneNode(true);
            toggleWrapper.parentNode.replaceChild(newToggleWrapper, toggleWrapper);
            
            const newOptions = newToggleWrapper.querySelectorAll('.toggle-option');
            const newSlider = newToggleWrapper.querySelector('.toggle-slider');
            const viewSections = document.querySelectorAll('.view-section');

            newOptions.forEach((option, index) => {
                option.addEventListener('click', () => {
                    newSlider.style.transform = `translateX(${index * 100}%)`;
                    newOptions.forEach(opt => opt.classList.remove('active'));
                    option.classList.add('active');

                    const targetId = option.getAttribute('data-target');
                    viewSections.forEach(section => {
                        if (section.id === targetId) section.classList.add('active');
                        else section.classList.remove('active');
                    });
                });
            });
        }

        // =========================================================================
        // 🔥 НОВОЕ: ПЛИТОЧНЫЙ ДИЗАЙН (БАННЕР СЛЕВА, КАРТОЧКИ СПРАВА) 🔥
        // =========================================================================
        const banner = document.getElementById('main-slider-container');
        const actionCards = document.querySelector('.action-cards-grid');
        
        if (banner && actionCards) {
            const heroGrid = document.createElement('div');
            heroGrid.className = 'browser-hero-grid';
            
            // Оборачиваем элементы в новую сетку
            banner.parentNode.insertBefore(heroGrid, banner);
            heroGrid.appendChild(banner);
            heroGrid.appendChild(actionCards);
        }
    } // <-- Конец блока if (isPC)

    // 🔥 АВТОМАТИЧЕСКОЕ ОКНО ВХОДА ПРИ ЗАХОДЕ НА САЙТ С БРАУЗЕРА 🔥
    if (!localStorage.getItem('tg_web_auth_token') && !sessionStorage.getItem('web_guest_dismissed')) {
        setTimeout(() => {
            if (typeof window.showWebAuthModal === 'function') {
                window.showWebAuthModal();
            }
        }, 400);
    }

    console.log("🛑 API запросы для браузера активны.");
}
    
    // 3. ТЕПЕРЬ БЕЗОПАСНО ЗАПУСКАЕМ ЗАПРОСЫ
    // 🔥 syncMyPromos УДАЛЕН, ОН БОЛЬШЕ НЕ НУЖЕН 🔥
    // УБРАНО: checkBalance(true); — теперь баланс приходит в bootstrap

    try {
        const activeTgInitData = window.Telegram?.WebApp?.initData || env.savedInitData || sessionStorage.getItem('hatelavka_tg_init_data') || localStorage.getItem('hatelavka_tg_init_data_backup') || '';
        // Никогда не включаем browser-mode, если env.isTelegramApp === true!
        if (!env.isVkApp && !env.isTelegramApp && !isBrowserMode && !activeTgInitData) { 
            console.warn("⚠️ Нет данных авторизации Telegram и нет мостов ТГ, включаем гостевой Web-режим.");
            isBrowserMode = true;
            document.body.classList.remove('tg-mode');
            document.body.classList.add('browser-mode');
        }
        
        let isCached = false;
        
        // 1. Читаем кэш (sessionStorage для текущей сессии + localStorage)
        const cachedBootstrap = JSON.parse(sessionStorage.getItem('session_bootstrap') || localStorage.getItem('cache_bootstrap') || 'null');
        const cachedShopRaw = JSON.parse(sessionStorage.getItem('session_shop_items') || localStorage.getItem('shop_items_cache') || '{}');
        const cachedShop = cachedShopRaw[2716312];
        const isSessionWarm = sessionStorage.getItem('hl_menu_session_loaded') === 'true';

        console.log(`🚀 [MAIN] Проверка кэша. Бутстрап: ${!!cachedBootstrap}, Магазин: ${!!cachedShop}, Сессия: ${isSessionWarm}`);

        // Если данные есть в кэше — рисуем и открываем экран МГНОВЕННО (0 мс)
        if (cachedBootstrap && !cachedBootstrap.maintenance && cachedShop) {
            console.log("🚀 [MAIN] Мгновенная отрисовка из кэша...");
            
            // СРАЗУ снимаем блокирующий стиль и прячем лоадер, не дожидаясь сети!
            const antiFlashNow = document.getElementById('anti-flash-style');
            if (antiFlashNow) antiFlashNow.remove();
            const maintScreenNow = document.getElementById('maintenance-screen-hardcore');
            if (maintScreenNow) maintScreenNow.style.display = 'none';
            document.body.style.overflow = '';
            if (dom.loaderOverlay) {
                dom.loaderOverlay.style.opacity = '0';
                dom.loaderOverlay.classList.add('hidden');
            }

            await renderFullInterface(cachedBootstrap);
            if (cachedBootstrap.user) {
                if (typeof window.renderBalanceUI === 'function') {
                    window.renderBalanceUI(cachedBootstrap.user.balance, cachedBootstrap.user.tickets);
                } else {
                    const balEl = document.getElementById('user-balance');
                    if (balEl && cachedBootstrap.user.balance !== undefined) {
                        balEl.textContent = Number(cachedBootstrap.user.balance).toLocaleString('ru-RU');
                    }
                    const tEl = document.getElementById('ticketStats');
                    if (tEl && cachedBootstrap.user.tickets !== undefined) {
                        tEl.textContent = Number(cachedBootstrap.user.tickets).toLocaleString('ru-RU');
                    }
                }
                const refreshIcon = document.getElementById('refresh-icon');
                if (refreshIcon) refreshIcon.classList.remove('fa-spin');
            }
            if (cachedBootstrap.unread_notifications !== undefined) {
                updateNotificationBadgeUI(cachedBootstrap.unread_notifications);
            }
            initDynamicRaffleSlider(cachedBootstrap.raffles || []);
            loadCategory(2716312, cachedShop);
            initDynamicAuction(cachedBootstrap.auctions || cachedBootstrap.active_auctions || []);
            if (cachedBootstrap.p2p_trades) checkActiveTradesBackground(cachedBootstrap.p2p_trades);
            setupSlider();
            
            isCached = true;

            // 🔥 Смотрим на метку _ts
            const cacheAge = Date.now() - (cachedBootstrap._ts || 0);
            if (cachedBootstrap._ts > 0 && cacheAge < 120000) {
                console.log("⚡ [MAIN] Кэш свежий. Фоново обновляем только динамику (Розыгрыши и Кейсы)...");
                loadGlobalStats();
                
                // 🔥 Теневое обновление без лоадеров 🔥
                setTimeout(async () => {
                    try {
                        const [freshRaffles, freshShop, freshBoot] = await Promise.all([
                            makeApiRequest('/api/v1/raffles/active', {}, 'POST', true).catch(() => null),
                            makeApiRequest('/api/v1/shop/goods?category_id=2716312', {}, 'GET', true).catch(() => null),
                            makeApiRequest('/api/v1/bootstrap', {}, 'POST', true).catch(() => null) // <--- Добавили бутстрап
                        ]);
                        
                        if (freshRaffles) initDynamicRaffleSlider(freshRaffles);
                        
                        // 🎁 Подхватываем стартовое окно, если в старом кэше его ещё не было
                        if (freshBoot && freshBoot.welcome_config) {
                            checkMatrixEvent(freshBoot.matrix_quest, freshBoot.welcome_config);
                        }

                        // 🔥 Проверяем, не прилетел ли нам бесплатный кейс пока нас не было
                        if (freshBoot && freshBoot.my_active_cases) {
                            const oldFreeCases = JSON.stringify(window.activeFreeCases || []);
                            const newFreeCases = JSON.stringify(freshBoot.my_active_cases);
                            if (oldFreeCases !== newFreeCases) {
                                window.activeFreeCases = freshBoot.my_active_cases;
                                // Если витрина открыта — перерисовываем, чтобы кейс стал бесплатным
                                if (window.currentCategoryId && itemsCache[window.currentCategoryId]) {
                                    renderItems(itemsCache[window.currentCategoryId]);
                                }
                            }
                        }

                        if (freshShop) loadCategory(2716312, freshShop);
                    } catch(e) {}
                }, 500);

                return;
            }
        } else {
            // Показываем лоадер ТОЛЬКО если кэша нет вообще (первый вход)
            if (dom.loaderOverlay) {
                dom.loaderOverlay.classList.remove('hidden');
                dom.loaderOverlay.style.opacity = '1';
            }
            updateLoading(10); 
        }      
        
        // 2. ЗАПРАШИВАЕМ ДАННЫЕ В ФОНЕ
        let bootstrapData, shopData;
        
        console.log("🚀 [MAIN] Отправляем фоновые запросы Promise.all...");
        [bootstrapData, shopData] = await Promise.all([
            makeApiRequest("/api/v1/bootstrap", {}, 'POST', true).catch(e => { console.error('Bootstrap error', e); throw e; }),
            makeApiRequest('/api/v1/shop/goods?category_id=2716312', {}, 'GET', true).catch(e => { console.warn('Shop error', e); return null; })
        ]);
        console.log("🚀 [MAIN] Ответы Promise.all получены!");

        // Запоминаем успешную загрузку в текущей сессии ВМЕСТЕ с меткой _ts
        if (bootstrapData && !bootstrapData.maintenance) {
            bootstrapData._ts = Date.now();
            sessionStorage.setItem('hl_menu_session_loaded', 'true');
            sessionStorage.setItem('hl_menu_sync_ts', String(bootstrapData._ts));
            sessionStorage.setItem('session_bootstrap', JSON.stringify(bootstrapData));
        }
        if (shopData) {
            const sessionShop = JSON.parse(sessionStorage.getItem('session_shop_items') || '{}');
            sessionShop[2716312] = shopData;
            sessionStorage.setItem('session_shop_items', JSON.stringify(sessionShop));
        }

        if (!isCached) updateLoading(60);

       // Обработка техработ
        if (bootstrapData && bootstrapData.maintenance) {
            const maintScreen = document.getElementById('maintenance-screen-hardcore');
            const maintText = document.getElementById('maintenance-hardcore-text');
            
            // Окно уже есть в HTML, просто показываем его
            if (maintScreen) maintScreen.style.display = 'flex';
            if (maintText) maintText.innerText = 'Валька уже исправляет (или ломает)...';
            
            // Резервный вариант, если окна по какой-то причине нет
            if (!maintScreen) {
                document.body.innerHTML = '<div style="position:fixed; top:0; left:0; display:flex; height:100vh; width:100vw; background:#141414; align-items:center; justify-content:center; flex-direction:column; z-index:2147483647;"><i class="fa-solid fa-gear fa-spin" style="font-size:60px; color:#34c759; margin-bottom:20px; filter: drop-shadow(0 0 15px rgba(52,199,89,0.5));"></i><span style="font-weight:900; font-size:26px; color:#fff; text-transform:uppercase; letter-spacing:1px;">Тех. работы</span><span style="color:#34c759; font-size:14px; margin-top:10px; font-weight:bold;">Валька устанавливает апдейт...</span></div>';
            }
            return; // Тормозим остальной рендер
        } else {
            // 🔥 ТЕХРАБОТ НЕТ! Снимаем броню, чтобы браузер нарисовал интерфейс
            const antiFlash = document.getElementById('anti-flash-style');
            if (antiFlash) antiFlash.remove(); // Удаляем стиль блокировки
            
            const maintScreen = document.getElementById('maintenance-screen-hardcore');
            if (maintScreen) maintScreen.style.display = 'none'; // Прячем зеленый экран
            
            document.body.style.overflow = ''; // Восстанавливаем скролл
        }
        
        // === 🔥 ПРЕДЗАГРУЗКА КАРТИНОК 🔥 ===
        if (!isCached) {
            let imagesToLoad = [];
            if (bootstrapData && bootstrapData.menu) {
                if (bootstrapData.menu.skin_race_enabled && bootstrapData.menu.menu_banner_url) imagesToLoad.push(bootstrapData.menu.menu_banner_url);
                if (bootstrapData.menu.auction_enabled && bootstrapData.menu.auction_banner_url) imagesToLoad.push(bootstrapData.menu.auction_banner_url);
                if (bootstrapData.menu.checkpoint_enabled && bootstrapData.menu.checkpoint_banner_url) imagesToLoad.push(bootstrapData.menu.checkpoint_banner_url);
            }
            if (shopData && Array.isArray(shopData)) {
                shopData.slice(0, 4).forEach(item => { if (item.image_url) imagesToLoad.push(item.image_url); });
            }
            await Promise.race([ preloadImages(imagesToLoad), new Promise(resolve => setTimeout(resolve, 2000)) ]);
            updateLoading(90);
        }

        // Сохраняем свежий кэш ВМЕСТЕ с меткой времени _ts (для синхронизации с bottom-nav.js)
        if (bootstrapData) {
            bootstrapData._ts = Date.now();
            localStorage.setItem('cache_bootstrap', JSON.stringify(bootstrapData));
        }
        if (shopData) {
            const newShopCache = JSON.parse(localStorage.getItem('shop_items_cache') || '{}');
            newShopCache[2716312] = shopData;
            localStorage.setItem('shop_items_cache', JSON.stringify(newShopCache));
        }

       // 3. РЕНДЕРИМ ВСЁ СИНХРОННО ЗА ОДИН ПРОХОД ИЗ FAT PAYLOAD
        if (bootstrapData) {
            // 1. Основной интерфейс
            await renderFullInterface(bootstrapData);
            initDynamicRaffleSlider(bootstrapData.raffles || []);
            initDynamicAuction(bootstrapData.auctions || bootstrapData.active_auctions || []);
          
            // 2. Баланс (из бутстрапа)
            if (bootstrapData.user) {
                renderBalanceUI(bootstrapData.user.balance, bootstrapData.user.tickets);
                
                // 🔥 ТОРМОЗИМ ИКОНКУ ПОСЛЕ ПЕРВОЙ ЗАГРУЗКИ 🔥
                const refreshIcon = document.getElementById('refresh-icon');
                if (refreshIcon) refreshIcon.classList.remove('fa-spin');
            }

            // 3. Уведомления (из бутстрапа)
            if (bootstrapData.unread_notifications !== undefined) {
                updateNotificationBadgeUI(bootstrapData.unread_notifications);
            }

            // 4. ПРЕМИАЛЬНАЯ КНОПКА ПОДАРКА (Создается через JS)
            const isGiftEnabled = (bonusGiftEnabled === true || String(bonusGiftEnabled).toLowerCase() === 'true');
            
            if (bootstrapData.gift_available && isGiftEnabled) {
                // Защита от дублей, если кнопка уже есть
                if (!document.getElementById('daily-gift-btn-premium')) {
                    const giftBtnContainer = document.createElement('div');
                    giftBtnContainer.id = 'daily-gift-btn-premium';
                    
                    // Стиль кнопки с плавным влетом справа
                    giftBtnContainer.style.cssText = `
                        position: fixed; 
                        right: -100px; /* Спрятана за экраном */
                        bottom: calc(env(safe-area-inset-bottom, 20px) + 85px); 
                        z-index: 1000;
                        transition: right 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    `;
                    
                    giftBtnContainer.innerHTML = `
                        <button style="
                            width: 56px; 
                            height: 56px; 
                            border-radius: 50%; 
                            background: linear-gradient(135deg, #FFD700 0%, #ffaa00 100%); 
                            border: 3px solid rgba(255, 255, 255, 0.3);
                            box-shadow: 0 4px 15px rgba(255, 215, 0, 0.5), inset 0 -4px 10px rgba(0,0,0,0.2); 
                            display: flex; 
                            align-items: center; 
                            justify-content: center; 
                            cursor: pointer;
                            animation: floatGift 3s ease-in-out infinite;
                            outline: none;
                        ">
                            <i class="fa-solid fa-gift" style="font-size: 24px; color: #000; text-shadow: 0 2px 4px rgba(255,255,255,0.4);"></i>
                        </button>
                    `;
                    
                    document.body.appendChild(giftBtnContainer);
                    
                    // Плавный выезд после рендера
                    requestAnimationFrame(() => {
                        setTimeout(() => {
                            giftBtnContainer.style.right = '20px';
                        }, 500);
                    });

                    giftBtnContainer.onclick = () => {
                        // Защита от двойного открытия
                        if (document.getElementById('premium-gift-modal')) return;

                        const overlay = document.createElement('div');
                        overlay.id = 'premium-gift-modal';
                        
                        // 🔥 ТЕМНЫЙ-ТЕМНЫЙ БЛЮР ФОНА БЕЗ РАМОК 🔥
                        overlay.style.cssText = "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.85); z-index: 999999999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px); opacity: 0; transition: opacity 0.3s ease;";

                        overlay.innerHTML = `
                            <style>
                                @keyframes giftPulse {
                                    0% { transform: scale(1); filter: drop-shadow(0 0 15px rgba(255, 215, 0, 0.4)); }
                                    50% { transform: scale(1.05); filter: drop-shadow(0 0 30px rgba(255, 215, 0, 0.8)); }
                                    100% { transform: scale(1); filter: drop-shadow(0 0 15px rgba(255, 215, 0, 0.4)); }
                                }
                                @keyframes popIn {
                                    0% { transform: scale(0.9); opacity: 0; }
                                    100% { transform: scale(1); opacity: 1; }
                                }
                                @keyframes floatGift {
                                    0% { transform: translateY(0px) scale(1); }
                                    50% { transform: translateY(-10px) scale(1.05); }
                                    100% { transform: translateY(0px) scale(1); }
                                }
                                @keyframes shakeGift {
                                    0% { transform: rotate(0deg); }
                                    25% { transform: rotate(-10deg) scale(1.1); }
                                    50% { transform: rotate(10deg) scale(1.1); }
                                    75% { transform: rotate(-10deg) scale(1.1); }
                                    100% { transform: rotate(0deg) scale(1); }
                                }
                            </style>
                            
                            <!-- 🔥 ОКНО БЕЗ ФОНА И РАМОК, ТОЛЬКО ТЕКСТ ПАРИТ В ВОЗДУХЕ 🔥 -->
                            <div style="width: 100%; max-width: 320px; background: transparent; border: none; text-align: center; box-shadow: none; animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); position: relative; padding: 20px;">
                                
                                <button id="pg-close-x" style="position: absolute; top: -30px; right: 10px; background: transparent; border: none; color: rgba(255,255,255,0.4); font-size: 24px; cursor: pointer; transition: color 0.2s;"><i class="fa-solid fa-xmark"></i></button>

                                <h3 id="pg-title" style="color: #fff; font-size: 22px; margin-bottom: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; text-shadow: 0 4px 15px rgba(0,0,0,0.8);">Ежедневный бонус</h3>
                                
                                <div id="pg-desc" style="font-size: 14px; color: #ccc; margin-bottom: 30px; line-height: 1.4; text-shadow: 0 2px 10px rgba(0,0,0,0.8);">
                                    Забирай монетки или билеты каждый день!
                                </div>
                                
                                <div id="pg-icon-container" style="height: 120px; display: flex; align-items: center; justify-content: center; margin-bottom: 40px;">
                                    <i id="pg-icon" class="fa-solid fa-gift" style="font-size: 90px; color: #FFD700; animation: giftPulse 2s infinite;"></i>
                                </div>
                                
                                <button id="pg-open-btn" style="width: 100%; padding: 18px; background: linear-gradient(135deg, #ffd700 0%, #ffaa00 100%); color: #000; border: none; border-radius: 16px; font-weight: 900; font-size: 16px; text-transform: uppercase; cursor: pointer; box-shadow: 0 8px 25px rgba(255, 204, 0, 0.4); transition: opacity 0.3s, transform 0.1s;"><i class="fa-solid fa-unlock" style="margin-right: 6px;"></i> ОТКРЫТЬ</button>
                            </div>
                        `;

                        document.body.appendChild(overlay);
                        requestAnimationFrame(() => overlay.style.opacity = '1');

                        overlay.querySelector('#pg-close-x').onclick = () => {
                            overlay.style.opacity = '0';
                            setTimeout(() => overlay.remove(), 300);
                        };

                        overlay.querySelector('#pg-open-btn').onclick = async function() {
                            const btn = this;
                            const haptic = window.Telegram?.WebApp?.HapticFeedback;
                            
                            // Прячем кнопку и выключаем возможность нажать еще раз
                            btn.style.opacity = '0';
                            btn.style.pointerEvents = 'none';

                            const descEl = overlay.querySelector('#pg-desc');
                            const iconEl = overlay.querySelector('#pg-icon');
                            
                            // Анимация отсчета/распаковки
                            const steps = [
                                "Развязываем ленточку...", 
                                "Открываем коробку...", 
                                "Заглядываем внутрь..."
                            ];
                            let currentStep = 0;
                            
                            // Стартовый вибро-удар и анимация тряски коробки
                            if(haptic) haptic.impactOccurred('medium');
                            iconEl.style.animation = 'shakeGift 0.6s infinite';

                            const animInterval = setInterval(() => {
                                if (currentStep < steps.length) {
                                    descEl.innerHTML = `<span style="color:#FFD700; font-weight:800; font-size:16px; text-shadow: 0 2px 10px rgba(255,215,0,0.4);">${steps[currentStep]}</span>`;
                                    if(haptic) haptic.impactOccurred('light');
                                    currentStep++;
                                }
                            }, 600);

                            try { 
                                // Отправляем запрос, но минимально ждем 2.2 секунды, чтобы юзер кайфанул от анимации распаковки
                                const resPromise = makeApiRequest('/api/v1/gift/claim', {}, 'POST'); 
                                const [res] = await Promise.all([
                                    resPromise,
                                    new Promise(r => setTimeout(r, 2200))
                                ]);
                                
                                clearInterval(animInterval);
                                // Тяжелый удар перед тем, как показать приз
                                if(haptic) haptic.impactOccurred('heavy');

                                const card = overlay.querySelector('div');
                                card.style.opacity = '0';
                                card.style.transform = 'scale(0.9)';
                                card.style.transition = 'all 0.3s ease';

                                setTimeout(() => {
                                    let iconHtml = '';
                                    let textHtml = '';
                                    let titleHtml = '';
                                    let btnHtml = '';

                                    // 🔥 УМНАЯ ФУНКЦИЯ ПАДЕЖЕЙ 🔥
                                    const getPlural = (number, one, two, five) => {
                                        let n = Math.abs(number) % 100;
                                        if (n >= 5 && n <= 20) return five;
                                        n %= 10;
                                        if (n === 1) return one;
                                        if (n >= 2 && n <= 4) return two;
                                        return five;
                                    };

                                    if (res.type === 'tickets') { 
                                        // Билеты стали Telegram-синими #2AABEE
                                        iconHtml = '<i class="fa-solid fa-ticket" style="font-size: 90px; color: #2AABEE; filter: drop-shadow(0 0 35px rgba(42, 171, 238, 0.8)); animation: floatGift 3s ease-in-out infinite;"></i>';
                                        const word = getPlural(res.value, 'билет', 'билета', 'билетов');
                                        textHtml = `Вы получили <b style="color: #2AABEE; font-size: 20px;">${res.value}</b> ${word}`; 
                                    } 
                                    else if (res.type === 'coins') { 
                                        iconHtml = '<i class="fa-solid fa-coins" style="font-size: 90px; color: #FFD700; filter: drop-shadow(0 0 35px rgba(255, 215, 0, 0.8)); animation: floatGift 3s ease-in-out infinite;"></i>';
                                        const word = getPlural(res.value, 'монетку', 'монетки', 'монеток');
                                        textHtml = `Вы получили <b style="color: #FFD700; font-size: 20px;">${res.value}</b> ${word}`; 
                                    }

                                    if (res.subscription_required) {
                                        titleHtml = '<div style="color: #ff3b30; font-weight: 900; font-size: 26px; letter-spacing: 1px; text-shadow: 0 0 20px rgba(255,59,48,0.7); text-transform: uppercase;">ПОЧТИ ТВОЁ!</div>';
                                        btnHtml = `<button id="pg-close-final" style="width: 100%; padding: 18px; background: linear-gradient(135deg, #2AABEE, #229ED9); color: #fff; border: none; border-radius: 16px; font-weight: 900; font-size: 15px; text-transform: uppercase; cursor: pointer; box-shadow: 0 8px 25px rgba(42, 171, 238, 0.5); transition: transform 0.2s;"><i class="fa-brands fa-telegram" style="margin-right: 6px;"></i> Подписаться</button>`;
                                    } else {
                                        titleHtml = '<div style="color: #34c759; font-weight: 900; font-size: 26px; letter-spacing: 1px; text-shadow: 0 0 20px rgba(52,199,89,0.7); text-transform: uppercase;">ПОЗДРАВЛЯЕМ!</div>';
                                        btnHtml = `<button id="pg-close-final" style="width: 100%; padding: 18px; background: rgba(255,255,255,0.15); color: #fff; border: 1px solid rgba(255,255,255,0.2); border-radius: 16px; font-weight: 900; font-size: 15px; text-transform: uppercase; cursor: pointer; transition: background 0.2s; backdrop-filter: blur(10px);">Круто, спасибо!</button>`;
                                        
                                        // Вибрация успеха при выпадении награды
                                        if (haptic) haptic.notificationOccurred('success');
                                        
                                        // Прячем изначальную кнопку с главной
                                        giftBtnContainer.style.right = '-100px';
                                        setTimeout(() => giftBtnContainer.remove(), 600);
                                    }

                                    card.innerHTML = `
                                        <div style="margin-bottom: 30px; margin-top: 10px;">${titleHtml}</div>
                                        <div style="height: 120px; display: flex; align-items: center; justify-content: center; margin-bottom: 30px;">${iconHtml}</div>
                                        <div style="font-size: 16px; color: #fff; margin-bottom: 40px; font-weight: 600; line-height: 1.4; text-shadow: 0 2px 10px rgba(0,0,0,0.8);">${textHtml}</div>
                                        ${btnHtml}
                                    `;

                                    card.style.opacity = '1';
                                    card.style.transform = 'scale(1)';

                                    card.querySelector('#pg-close-final').onclick = (e) => {
                                        if (res.subscription_required) {
                                            e.preventDefault(); 
                                            if (window.Telegram?.WebApp?.openTelegramLink) window.Telegram.WebApp.openTelegramLink("https://t.me/hatelove_ttv"); 
                                            else window.open("https://t.me/hatelove_ttv", "_blank");
                                        }
                                        overlay.style.opacity = '0';
                                        setTimeout(() => overlay.remove(), 300);
                                    };
                                }, 300);

                                if (typeof checkBalance === 'function') checkBalance(true); 
                            } catch (e) { 
                                clearInterval(animInterval);
                                overlay.style.opacity = '0';
                                setTimeout(() => overlay.remove(), 300);
                            } 
                        };
                    };
                }
            } else {
                const oldBtn = document.getElementById('daily-gift-btn-premium');
                if (oldBtn) {
                    oldBtn.style.right = '-100px';
                    setTimeout(() => oldBtn.remove(), 600);
                }
            }
            
            // 5. P2P трейды (из бутстрапа)
            if (bootstrapData.p2p_trades) {
                checkActiveTradesBackground(bootstrapData.p2p_trades);
            }
        }
        
        if (shopData) loadCategory(2716312, shopData);
        setupSlider();

        // УБРАНО: fetchNotificationsBadge(); — теперь бейджик ставится из бутстрапа выше

        // 👇 ДОБАВЛЯЕШЬ ЗАПУСК СТАТИСТИКИ СЮДА 👇
        loadGlobalStats(); 
        // 👆 --------------------------------- 👆

        if (!isCached) updateLoading(100);

       // =========================================================================
// 👇 ЖЕЛЕЗОБЕТОННОЕ АВТО-ОТКРЫТИЕ МАГАЗИНА 👇
// =========================================================================
const tgParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
const urlParam = new URLSearchParams(window.location.search).get('startapp'); 

const needsShop = localStorage.getItem('force_open_shop') === 'true' || tgParam === 'cases' || urlParam === 'cases';

if (needsShop) {
    localStorage.removeItem('force_open_shop');
    
    let attempts = 0;
    const shopInterval = setInterval(() => {
        const shopTab = document.querySelector('.toggle-option[data-target="view-shop"]');
        if (shopTab) {
            clearInterval(shopInterval);
            
            // 1. Принудительно меняем активные вкладки
            document.querySelectorAll('.toggle-option').forEach(opt => opt.classList.remove('active'));
            shopTab.classList.add('active');
            
            // 2. Скрываем главное меню, показываем магазин
            document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
            const targetView = document.getElementById('view-shop');
            if (targetView) targetView.classList.add('active');
            
            // 3. Сдвигаем ползунок на вторую вкладку
            const slider = document.querySelector('.toggle-slider');
            if (slider) slider.style.transform = 'translateX(100%)';
            
            // 4. Загружаем сами кейсы
            if (typeof loadCategory === 'function') loadCategory(2716312);
        }
        attempts++;
        if (attempts > 50) clearInterval(shopInterval);
    }, 100);
}
// =========================================================================

        if (!isCached && dom.loaderOverlay) {
            setTimeout(() => { 
                dom.loaderOverlay.style.opacity = '0';
                setTimeout(() => dom.loaderOverlay.classList.add('hidden'), 400); 
            }, 300);
        }

    } catch (e) {
        console.error("❌ [MAIN] КРИТИЧЕСКАЯ ОШИБКА:", e);
        
        // 🔥 УБИЙЦА БЕСКОНЕЧНОГО ЛОАДЕРА 🔥
        if (dom.loaderOverlay) {
            dom.loaderOverlay.style.opacity = '0';
            setTimeout(() => dom.loaderOverlay.classList.add('hidden'), 300);
        }

        // 🔥 БЕТОННЫЙ ФИКС: Если это блок ИЛИ бан — мгновенно выходим и ничего не рисуем поверх!
        if (e.message === "Security Block" || e.message === "USER_BANNED" || e.message === "Bot Auth Required") {
            return; 
        }

        // Если это обычная ошибка сети (и интерфейс не загружен)
        if (!document.querySelector('.shop-item')) { 
            if (dom.loadingText) dom.loadingText.textContent = "Критическая ошибка";
            document.body.innerHTML = `
                <div style="display:flex; height:100vh; width:100vw; background:#121212; align-items:center; justify-content:center; flex-direction:column; color:#ff3b30; font-family:sans-serif; text-align:center; padding:20px;">
                    <i class="fa-solid fa-triangle-exclamation" style="font-size:40px; margin-bottom:15px;"></i>
                    <b style="font-size:18px;">Ошибка соединения</b>
                    <p style="color:#888; margin-top:10px;">Проверьте интернет и попробуйте снова</p>
                    <button onclick="window.location.reload()" style="margin-top:25px; padding:12px 24px; background:#FFD700; color:#000; border:none; border-radius:12px; font-weight:900; text-transform:uppercase;">Перезагрузить</button>
                </div>
            `;
        }
    }
}

// ================================================================
// ГЛОБАЛЬНАЯ СТАТИСТИКА ПРОЕКТА
// ================================================================
async function loadGlobalStats() {
    try {
        // Делаем тихий запрос, чтобы не перекрывать экран лоадерами
        const stats = await makeApiRequest('/api/v1/stats/general', {}, 'GET', true);
        if (stats) {
            animateCounter('stat-cases-opened', stats.total_cases || 0);
            animateCounter('stat-skins-issued', stats.total_withdrawn || 0);
        }
    } catch (e) {
        console.warn("Не удалось загрузить статистику проекта:", e);
    }
}

// Красивая плавная анимация бегущих цифр
function animateCounter(elementId, endValue) {
    const el = document.getElementById(elementId);
    if (!el) return;
    
    // Убираем пробелы, если они там были, и парсим текущее значение
    let startValue = parseInt(el.textContent.replace(/\s/g, '')) || 0;
    if (startValue === endValue) return; // Если не изменилось — не крутим
    
    const duration = 1500; // Анимация длится 1.5 секунды
    let startTimestamp = null;
    
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        
        // easing (замедление к концу анимации)
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const current = Math.floor(easeOutQuart * (endValue - startValue) + startValue);
        
        // Форматируем красиво: 1 250 вместо 1250
        el.textContent = current.toLocaleString('ru-RU');
        
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            el.textContent = endValue.toLocaleString('ru-RU');
        }
    };
    
    window.requestAnimationFrame(step);
}

// ================================================================
// THE MATRIX EVENT (СИНЯЯ / КРАСНАЯ ПИЛЮЛЯ)
// ================================================================

window.claimMatrixReward = async function() {
    const btn = document.getElementById('matrix-claim-btn');
    if (!btn) return;
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    if (window.Telegram?.WebApp?.HapticFeedback) Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    
    try {
        // Дергаем бэкенд, чтобы он выдал призы
        await makeApiRequest('/api/v1/matrix/claim', {}, 'POST');
        
        if (window.Telegram?.WebApp?.HapticFeedback) Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        customAlert("Поздравляем! Кейс NUT-NUT и 10 🎟️ зачислены на твой аккаунт!");
        
        // Прячем баннер квеста
        const container = document.getElementById('matrix-quest-tracker');
        if (container) container.style.display = 'none';
        
        // Синхронизируем баланс билетов
        checkBalance(true);
        
    } catch (e) {
        btn.disabled = false;
        btn.innerText = 'ЗАБРАТЬ ПРИЗ';
        // Ошибка (если вдруг юзер еще не выполнил) покажется сама через makeApiRequest
    }
}

function checkMatrixEvent(matrixData, welcomeConfig) {
    if (document.body.classList.contains('browser-mode') && !localStorage.getItem('tg_web_auth_token')) {
        return;
    }

    const isAdmin = Boolean(userData?.is_admin);
    const existingModal = document.getElementById('matrix-event-modal');

    if (!welcomeConfig) {
        if (existingModal) existingModal.remove();
        return;
    }

    const isAdminTest = isAdmin && welcomeConfig.admin_test_mode !== false;
    const isForAll = Boolean(welcomeConfig.for_all);
    const pillStr = String(matrixData?.selected_pill || '');
    const alreadyClaimedNew = pillStr.startsWith('welcome_');

    if (isAdminTest) {
        if (window._welcomeClosedThisLoad) return;
    } else {
        const shouldHide = !welcomeConfig.enabled
            || sessionStorage.getItem('matrix_dismissed')
            || alreadyClaimedNew
            || (!isForAll && Boolean(pillStr));
        if (shouldHide) {
            if (existingModal) existingModal.remove();
            return;
        }
    }

    if (existingModal) return;

    const tasks = welcomeConfig.tasks || [];
    const requiredTasks = tasks.filter(t => t.required);
    const extraTasks = tasks.filter(t => !t.required);
    const tiers = [...(welcomeConfig.tiers || [])].sort((a, b) => a.min_extra - b.min_extra);
    const btnClaimPrefix = welcomeConfig.btn_claim_prefix || 'Забрать';

    let inChannel = false;
    let inChat = false;
    let isChecking = false;
    let isFirstRender = true;
    let isExtraOpen = false; // false = открыты основные (без вида спойлера), true = основные свёрнуты, открыты доп.
    let lastRenderedCaseName = '';
    const visitedTasks = new Set();
    const completedExtra = new Set();

    const getCurrentTier = () => {
        let current = tiers[0] || { case_name: 'Стартовый кейс', label: 'Базовый кейс' };
        for (const t of tiers) {
            if (completedExtra.size >= t.min_extra) current = t;
        }
        return current;
    };

    // Автоматический поиск картинки кейса: сначала из конфига, затем из кэша магазина
    const getCaseImageUrl = (tier) => {
        if (tier?.image_url) return tier.image_url;
        const target = String(tier?.case_name || '').trim().toLowerCase();
        if (!target) return '';

        const sources = [];
        if (typeof itemsCache !== 'undefined' && Array.isArray(itemsCache[2716312])) {
            sources.push(...itemsCache[2716312]);
        }
        try {
            const rawShop = JSON.parse(sessionStorage.getItem('session_shop_items') || localStorage.getItem('shop_items_cache') || '{}');
            Object.values(rawShop).forEach(arr => { if (Array.isArray(arr)) sources.push(...arr); });
        } catch (e) {}

        const found = sources.find(it => String(it?.name || '').trim().toLowerCase() === target);
        return found ? (found.replaced_image_url || found.image_url || '') : '';
    };

    const openTaskUrl = (url) => {
        if (!url) return;
        if (url.includes('t.me/') && window.Telegram?.WebApp?.openTelegramLink) {
            window.Telegram.WebApp.openTelegramLink(url);
        } else if (window.Telegram?.WebApp?.openLink) {
            window.Telegram.WebApp.openLink(url);
        } else {
            window.open(url, '_blank');
        }
    };

    const showWelcomeNotice = (type, title, message, btnText = 'Понятно', onClose = null) => {
        const oldNotice = document.getElementById('wl-notice-overlay');
        if (oldNotice) oldNotice.remove();

        const isSuccess = type === 'success';
        const iconHtml = isSuccess
            ? '<i class="fa-solid fa-circle-check" style="color: #34c759; filter: drop-shadow(0 0 10px rgba(52, 199, 89, 0.5));"></i>'
            : '<i class="fa-solid fa-circle-exclamation" style="color: #ff453a; filter: drop-shadow(0 0 10px rgba(255, 69, 58, 0.5));"></i>';

        const notice = document.createElement('div');
        notice.id = 'wl-notice-overlay';
        notice.style.cssText = "position: fixed; inset: 0; background: rgba(4, 4, 7, 0.88); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); z-index: 2147483647; display: flex; align-items: center; justify-content: center; padding: 14px; box-sizing: border-box; animation: wlOverlayFade 0.16s ease-out forwards;";

        notice.innerHTML = `
            <div style="width: 88%; max-width: 285px; text-align: center; animation: wlModalPop 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;">
                <div style="font-size: 28px; margin-bottom: 8px; line-height: 1;">${iconHtml}</div>
                <div style="font-size: 14.5px; font-weight: 800; color: #ffffff; letter-spacing: -0.25px; margin-bottom: 5px; text-shadow: 0 2px 8px rgba(0,0,0,0.9);">${escapeHTML(title)}</div>
                <div style="font-size: 11px; color: #f4f4f5; line-height: 1.45; letter-spacing: -0.1px; margin-bottom: 14px; text-shadow: 0 1px 4px rgba(0,0,0,0.9);">${message}</div>
                <button id="wl-notice-ok" style="width: 100%; padding: 9.5px 14px; border-radius: 10px; background: linear-gradient(135deg, rgba(139, 92, 246, 0.58) 0%, rgba(109, 40, 217, 0.42) 100%); border: 1px solid rgba(216, 180, 254, 0.58); box-shadow: 0 4px 16px rgba(124, 58, 237, 0.38), inset 0 1px 1px rgba(255, 255, 255, 0.34); color: #ffffff; font-size: 10.5px; font-weight: 700; letter-spacing: -0.1px; cursor: pointer;">
                    ${escapeHTML(btnText)}
                </button>
            </div>
        `;

        const closeNotice = () => {
            notice.style.opacity = '0';
            notice.style.transition = 'opacity 0.15s ease';
            setTimeout(() => {
                notice.remove();
                if (typeof onClose === 'function') onClose();
            }, 150);
        };

        notice.querySelector('#wl-notice-ok').onclick = closeNotice;
        notice.onclick = (e) => { if (e.target === notice) closeNotice(); };
        document.body.appendChild(notice);
    };

    const overlay = document.createElement('div');
    overlay.id = 'matrix-event-modal';
    overlay.style.cssText = "position: fixed; inset: 0; background: rgba(4, 4, 7, 0.88); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); z-index: 2147483646; display: flex; align-items: center; justify-content: center; padding: 12px; box-sizing: border-box; animation: wlOverlayFade 0.16s ease-out forwards;";

    const adminBadgeHtml = isAdminTest ? `<div class="wl-admin-pill">ADMIN TEST</div>` : '';

    overlay.innerHTML = `
        <style>
            @keyframes wlOverlayFade { 0% { opacity: 0; } 100% { opacity: 1; } }
            @keyframes wlModalPop { 0% { opacity: 0; transform: scale3d(0.92, 0.92, 1) translate3d(0, 8px, 0); } 100% { opacity: 1; transform: scale3d(1, 1, 1) translate3d(0, 0, 0); } }
            @keyframes wlCardPop { 0% { opacity: 0; transform: translateY(8px); } 100% { opacity: 1; transform: translateY(0); } }
            @keyframes wlCaseUpgrade { 0% { transform: scale(0.8); opacity: 0.3; } 60% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }

            .wl-modal-box {
                width: 92%;
                max-width: 320px;
                text-align: center;
                display: flex;
                flex-direction: column;
                align-items: center;
                max-height: 88vh;
                overflow: hidden;
                animation: wlModalPop 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
            }
            .wl-admin-pill {
                flex-shrink: 0;
                display: inline-flex; align-items: center;
                padding: 2.5px 9px; border-radius: 999px;
                font-size: 8.5px; font-weight: 800; letter-spacing: 0.6px;
                color: #fbbf24; background: rgba(251, 191, 36, 0.1);
                border: 1px solid rgba(251, 191, 36, 0.38);
                margin-bottom: 6px; text-transform: uppercase;
            }
            .wl-head {
                flex-shrink: 0;
                font-size: 14.5px; font-weight: 900; letter-spacing: -0.2px;
                color: #ffffff; margin: 0 0 6px 0; line-height: 1.15;
                text-transform: uppercase;
                text-shadow: 0 2px 8px rgba(0, 0, 0, 0.9);
            }
            .wl-case-showcase {
                flex-shrink: 0;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                margin-bottom: 8px;
                position: relative;
            }
            .wl-case-img-wrap {
                height: 118px;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-bottom: 2px;
            }
            .wl-case-img {
                max-height: 116px;
                max-width: 190px;
                object-fit: contain;
            }
            .wl-case-img.pop { animation: wlCaseUpgrade 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
            .wl-case-name-pill {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 2px 8px;
                border-radius: 999px;
                background: rgba(251, 191, 36, 0.08);
                border: 1px solid rgba(251, 191, 36, 0.28);
                font-size: 8.5px;
                font-weight: 700;
                color: #fbbf24;
                letter-spacing: 0.1px;
                text-shadow: 0 0 6px rgba(251, 191, 36, 0.3);
            }
            .wl-subtitle {
                flex-shrink: 0;
                font-size: 9.5px; font-weight: 600;
                color: #a1a1aa; margin: 0 0 10px 0; line-height: 1.35;
                text-shadow: 0 1px 4px rgba(0, 0, 0, 0.9);
            }
            #wl-tasks-list {
                flex: 1 1 auto;
                min-height: 0;
                width: 100%;
                display: flex;
                flex-direction: column;
                gap: 6px;
                overflow-y: auto;
                padding: 0 1px 6px;
                -webkit-overflow-scrolling: touch;
            }
            .wl-section-head {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 3px 2px 1px;
            }
            .wl-section-title {
                display: inline-flex; align-items: center; gap: 5px;
                font-size: 8.5px; font-weight: 800; text-transform: uppercase;
                letter-spacing: 0.55px; color: #a1a1aa;
            }
            .wl-section-tag {
                font-size: 8px; font-weight: 700; color: #a1a1aa;
                background: rgba(255, 255, 255, 0.06);
                border: 1px solid rgba(255, 255, 255, 0.08);
                padding: 1.5px 6px; border-radius: 5px;
            }
            /* СВЕРНУТАЯ ПЛАШКА ОБЯЗАТЕЛЬНЫХ (ПОЯВЛЯЕТСЯ ТОЛЬКО КОГДА ОТКРЫТ СПОЙЛЕР УЛУЧШЕНИЙ) */
            .wl-req-collapsed-bar {
                width: 100%;
                padding: 8px 10px;
                border-radius: 11px;
                background: rgba(255, 255, 255, 0.04);
                border: 1px solid rgba(255, 255, 255, 0.1);
                display: flex;
                align-items: center;
                justify-content: space-between;
                cursor: pointer;
                box-sizing: border-box;
                transition: background 0.15s ease;
            }
            .wl-req-collapsed-bar:active { transform: scale3d(0.98, 0.98, 1); }
            .wl-req-collapsed-bar.all-done {
                background: linear-gradient(135deg, rgba(52, 199, 89, 0.12) 0%, rgba(18, 18, 24, 0.7) 100%);
                border-color: rgba(74, 222, 128, 0.35);
            }
            .wl-req-collapsed-left {
                display: flex; align-items: center; gap: 6px;
                font-size: 9.5px; font-weight: 800; color: #e4e4e7;
                text-transform: uppercase; letter-spacing: 0.4px;
            }
            .wl-req-collapsed-right {
                display: flex; align-items: center; gap: 6px;
                font-size: 9px; font-weight: 700; color: #a1a1aa;
            }
            /* СПОЙЛЕР ДЛЯ ДОП. ЗАДАНИЙ */
            .wl-spoiler-toggle {
                width: 100%;
                margin-top: 4px;
                padding: 8px 10px;
                border-radius: 11px;
                background: linear-gradient(135deg, rgba(251, 191, 36, 0.09) 0%, rgba(18, 18, 24, 0.7) 100%);
                border: 1px solid rgba(251, 191, 36, 0.25);
                display: flex;
                align-items: center;
                justify-content: space-between;
                cursor: pointer;
                box-sizing: border-box;
                transition: background 0.15s ease;
            }
            .wl-spoiler-toggle:active { transform: scale3d(0.98, 0.98, 1); }
            .wl-spoiler-left {
                display: flex; align-items: center; gap: 6px;
                font-size: 9.5px; font-weight: 800; color: #fbbf24;
                text-transform: uppercase; letter-spacing: 0.4px;
            }
            .wl-spoiler-right {
                display: flex; align-items: center; gap: 6px;
                font-size: 9px; font-weight: 700; color: #fde68a;
            }
            .wl-spoiler-chevron {
                transition: transform 0.2s ease;
                font-size: 9px;
            }
            .wl-spoiler-toggle.open .wl-spoiler-chevron { transform: rotate(180deg); }
            .wl-spoiler-body {
                display: flex;
                flex-direction: column;
                gap: 6px;
                margin-top: 2px;
            }
            .wl-spoiler-body.collapsed { display: none; }

            .wl-task-card {
                display: flex; align-items: center; gap: 9px;
                background: rgba(255, 255, 255, 0.03);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 11px; padding: 7.5px 9px;
                text-align: left; box-sizing: border-box;
                transition: border-color 0.2s ease, background 0.2s ease;
            }
            .wl-task-card.is-extra-card {
                background: rgba(251, 191, 36, 0.025);
                border-color: rgba(251, 191, 36, 0.14);
            }
            .wl-task-card.is-done {
                background: linear-gradient(135deg, rgba(52, 199, 89, 0.14) 0%, rgba(16, 185, 129, 0.04) 100%);
                border-color: rgba(74, 222, 128, 0.4);
            }
            .wl-task-left {
                display: flex; align-items: center; gap: 9px;
                flex: 1; min-width: 0; cursor: pointer;
            }
            .wl-task-icon {
                width: 30px; height: 30px; border-radius: 8px;
                display: flex; align-items: center; justify-content: center;
                font-size: 13px; flex-shrink: 0; overflow: hidden;
            }
            .wl-task-icon img {
                width: 20px; height: 20px; object-fit: contain; border-radius: 4px;
            }
            .wl-task-info {
                display: flex; flex-direction: column; gap: 1.5px;
                flex: 1; min-width: 0;
            }
            .wl-task-title {
                font-size: 11px; font-weight: 700; color: #ffffff;
                letter-spacing: -0.1px; line-height: 1.2;
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            }
            .wl-task-sub {
                font-size: 9px; font-weight: 500; line-height: 1.2;
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            }
            .wl-pill-btn {
                flex-shrink: 0; padding: 5px 9px; border-radius: 8px;
                font-size: 9.5px; font-weight: 700; letter-spacing: -0.1px;
                color: #ffffff;
                background: linear-gradient(135deg, rgba(139, 92, 246, 0.52) 0%, rgba(109, 40, 217, 0.36) 100%);
                border: 1px solid rgba(196, 181, 253, 0.48);
                box-shadow: 0 2px 8px rgba(139, 92, 246, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.25);
                cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
                gap: 4px; white-space: nowrap; transition: transform 0.12s ease;
            }
            .wl-pill-btn:active { transform: scale3d(0.94, 0.94, 1); }
            .wl-pill-btn.is-extra-btn {
                background: linear-gradient(135deg, rgba(251, 191, 36, 0.28) 0%, rgba(217, 119, 6, 0.18) 100%);
                border-color: rgba(251, 191, 36, 0.45);
                color: #fde68a;
            }
            .wl-pill-btn.step-verify {
                background: linear-gradient(135deg, rgba(139, 92, 246, 0.72) 0%, rgba(109, 40, 217, 0.55) 100%);
                border-color: rgba(216, 180, 254, 0.68);
                color: #ffffff;
            }
            .wl-pill-btn.step-done {
                background: linear-gradient(135deg, rgba(52, 199, 89, 0.28) 0%, rgba(16, 185, 129, 0.16) 100%);
                border-color: rgba(74, 222, 128, 0.48);
                color: #4ade80; box-shadow: none; cursor: default;
            }
            .wl-footer-actions {
                flex-shrink: 0;
                width: 100%;
                margin-top: 14px;
                padding-top: 12px;
                border-top: 1px solid rgba(255, 255, 255, 0.08);
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 6px;
            }
            .wl-btn-claim {
                width: 100%;
                padding: 10.5px 14px; border-radius: 10px;
                background: linear-gradient(135deg, rgba(139, 92, 246, 0.58) 0%, rgba(109, 40, 217, 0.42) 100%);
                border: 1px solid rgba(216, 180, 254, 0.58);
                box-shadow: 0 4px 16px rgba(124, 58, 237, 0.38), inset 0 1px 1px rgba(255, 255, 255, 0.34);
                color: #ffffff; font-size: 11px; font-weight: 700;
                cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
            }
            .wl-btn-claim:active { transform: scale3d(0.96, 0.96, 1); }
            .wl-btn-claim.is-locked { opacity: 0.38; filter: grayscale(70%); box-shadow: none; }
            .wl-btn-close {
                background: transparent; border: none; color: #a1a1aa;
                font-size: 10.5px; font-weight: 600; padding: 6px 14px; cursor: pointer;
            }
        </style>

        <div class="wl-modal-box">
            ${adminBadgeHtml}
            <div class="wl-head">${escapeHTML(welcomeConfig.title || 'ПОЛУЧИ КЕЙС БЕСПЛАТНО!')}</div>

            <div class="wl-case-showcase">
                <div class="wl-case-img-wrap" id="wl-case-img-wrap"></div>
                <div class="wl-case-name-pill" id="wl-current-case"></div>
            </div>

            <div class="wl-subtitle">${escapeHTML(welcomeConfig.subtitle || 'Выполни простые действия и забери скин прямо сейчас')}</div>

            <div id="wl-tasks-list"></div>

            <div class="wl-footer-actions">
                <button id="wl-claim-btn" class="wl-btn-claim is-locked">
                    <i class="fa-solid fa-lock" style="font-size: 9.5px;"></i> ${escapeHTML(btnClaimPrefix)}
                </button>
                <button id="wl-close-btn" class="wl-btn-close">Закрыть</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const listEl = overlay.querySelector('#wl-tasks-list');
    const claimBtn = overlay.querySelector('#wl-claim-btn');
    const caseImgWrap = overlay.querySelector('#wl-case-img-wrap');
    const currentCaseEl = overlay.querySelector('#wl-current-case');

    const updateRewardUI = () => {
        const tier = getCurrentTier();
        const imgUrl = getCaseImageUrl(tier);
        const caseChanged = lastRenderedCaseName && lastRenderedCaseName !== tier.case_name;
        lastRenderedCaseName = tier.case_name;

        if (imgUrl) {
            caseImgWrap.innerHTML = `<img src="${escapeHTML(imgUrl)}" class="wl-case-img ${caseChanged ? 'pop' : ''}" alt="">`;
        } else {
            caseImgWrap.innerHTML = `<i class="fa-solid fa-gift ${caseChanged ? 'pop' : ''}" style="font-size: 46px; color: #d8b4fe;"></i>`;
        }

        const upgradeIcon = completedExtra.size > 0 ? '<i class="fa-solid fa-bolt"></i>' : '<i class="fa-solid fa-box-open"></i>';
        currentCaseEl.innerHTML = `${upgradeIcon} <span>${escapeHTML(tier.case_name)}</span>`;

        if (inChannel && inChat) {
            claimBtn.classList.remove('is-locked');
            claimBtn.innerHTML = `<i class="fa-solid fa-bolt" style="color:#fbbf24; font-size: 9.5px;"></i> ${escapeHTML(btnClaimPrefix)}`;
        } else {
            claimBtn.classList.add('is-locked');
            claimBtn.innerHTML = `<i class="fa-solid fa-lock" style="font-size: 9.5px;"></i> ${escapeHTML(btnClaimPrefix)}`;
        }
    };

    const renderTaskCardHtml = (t, idx, isExtra) => {
        let isDone = false;
        if (t.type === 'tg_channel') isDone = inChannel;
        else if (t.type === 'tg_chat') isDone = inChat;
        else isDone = completedExtra.has(t.id);

        const isVisited = visitedTasks.has(t.id);

        const subText = isDone
            ? (isExtra ? 'Выполнено • Кейс улучшен' : 'Подписка подтверждена')
            : (isExtra ? (t.badge || 'Улучшает награду') : 'Нужно для получения кейса');
        const subColor = isDone ? '#4ade80' : (isExtra ? '#fbbf24' : '#a1a1aa');

        const iconBg = isDone ? 'rgba(52, 199, 89, 0.16)' : `${t.color || '#9146FF'}20`;
        const iconBorder = isDone ? 'rgba(74, 222, 128, 0.4)' : `${t.color || '#9146FF'}45`;
        const iconColor = isDone ? '#4ade80' : (t.color || '#9146FF');

        const iconInner = t.icon_url
            ? `<img src="${escapeHTML(t.icon_url)}" alt="">`
            : `<i class="${escapeHTML(t.icon || 'fa-solid fa-link')}"></i>`;

        let pillClass = isExtra ? 'is-extra-btn' : '';
        let pillHtml = `Перейти <i class="fa-solid fa-chevron-right" style="font-size: 7.5px;"></i>`;
        if (isDone) {
            pillClass = 'step-done';
            pillHtml = `<i class="fa-solid fa-check" style="font-size: 8.5px;"></i> Готово`;
        } else if (isVisited) {
            pillClass = 'step-verify';
            pillHtml = `Проверить <i class="fa-solid fa-chevron-right" style="font-size: 7.5px;"></i>`;
        }

        const animStyle = isFirstRender
            ? `opacity: 0; animation: wlCardPop 0.28s cubic-bezier(0.16, 1, 0.3, 1) ${idx * 35}ms forwards;`
            : '';

        return `
            <div class="wl-task-card ${isExtra ? 'is-extra-card' : ''} ${isDone ? 'is-done' : ''}" data-id="${t.id}" style="${animStyle}">
                <div class="wl-task-left">
                    <div class="wl-task-icon" style="background: ${iconBg}; border: 1px solid ${iconBorder}; color: ${iconColor};">
                        ${iconInner}
                    </div>
                    <div class="wl-task-info">
                        <div class="wl-task-title">${escapeHTML(t.title)}</div>
                        <div class="wl-task-sub" style="color: ${subColor};">${escapeHTML(subText)}</div>
                    </div>
                </div>
                <button class="wl-pill-btn ${pillClass}" data-id="${t.id}">
                    ${pillHtml}
                </button>
            </div>
        `;
    };

    const renderTasks = () => {
        const reqDoneCount = (inChannel ? 1 : 0) + (inChat ? 1 : 0);
        const allReqDone = requiredTasks.length > 0 && reqDoneCount >= requiredTasks.length;
        let html = '';

        if (requiredTasks.length > 0) {
            if (isExtraOpen) {
                // Когда открыты доп. задания — основные аккуратно свернуты в компактную плашку
                html += `
                    <div class="wl-req-collapsed-bar ${allReqDone ? 'all-done' : ''}" id="wl-req-spoiler-btn">
                        <span class="wl-req-collapsed-left">
                            <i class="fa-solid ${allReqDone ? 'fa-circle-check' : 'fa-shield-halved'}" style="color: ${allReqDone ? '#4ade80' : '#d8b4fe'};"></i>
                            <span>Обязательно для кейса</span>
                        </span>
                        <span class="wl-req-collapsed-right" style="color: ${allReqDone ? '#4ade80' : '#a1a1aa'};">
                            <span>${reqDoneCount}/${requiredTasks.length}</span>
                            <i class="fa-solid fa-chevron-down" style="font-size: 9px;"></i>
                        </span>
                    </div>
                `;
            } else {
                // Когда основные открыты — они выглядят как обычный блок (не спойлер)
                html += `
                    <div class="wl-section-head">
                        <span class="wl-section-title"><i class="fa-solid fa-shield-halved" style="color:#d8b4fe;"></i> Обязательно для кейса</span>
                        <span class="wl-section-tag">${reqDoneCount}/${requiredTasks.length}</span>
                    </div>
                `;
                html += requiredTasks.map((t, i) => renderTaskCardHtml(t, i, false)).join('');
            }
        }

        if (extraTasks.length > 0) {
            html += `
                <div class="wl-spoiler-toggle ${isExtraOpen ? 'open' : ''}" id="wl-extra-spoiler-btn">
                    <span class="wl-spoiler-left">
                        <i class="fa-solid fa-arrow-trend-up"></i>
                        <span>Улучшить кейс • По желанию</span>
                    </span>
                    <span class="wl-spoiler-right">
                        <span>+${completedExtra.size}/${extraTasks.length}</span>
                        <i class="fa-solid fa-chevron-down wl-spoiler-chevron"></i>
                    </span>
                </div>
                <div class="wl-spoiler-body ${isExtraOpen ? '' : 'collapsed'}" id="wl-extra-spoiler-body">
                    ${extraTasks.map((t, i) => renderTaskCardHtml(t, requiredTasks.length + i, true)).join('')}
                </div>
            `;
        }

        listEl.innerHTML = html;
        isFirstRender = false;

        const reqSpoilerBtn = listEl.querySelector('#wl-req-spoiler-btn');
        if (reqSpoilerBtn) {
            reqSpoilerBtn.onclick = () => {
                isExtraOpen = false;
                if (window.Telegram?.WebApp?.HapticFeedback) {
                    try { Telegram.WebApp.HapticFeedback.impactOccurred('light'); } catch (e) {}
                }
                renderTasks();
                listEl.scrollTo({ top: 0, behavior: 'smooth' });
            };
        }

        const spoilerBtn = listEl.querySelector('#wl-extra-spoiler-btn');
        if (spoilerBtn) {
            spoilerBtn.onclick = () => {
                isExtraOpen = !isExtraOpen;
                if (window.Telegram?.WebApp?.HapticFeedback) {
                    try { Telegram.WebApp.HapticFeedback.impactOccurred('light'); } catch (e) {}
                }
                renderTasks();
                listEl.scrollTo({ top: 0, behavior: 'smooth' });
            };
        }

        listEl.querySelectorAll('.wl-task-left').forEach(leftEl => {
            leftEl.onclick = () => {
                const card = leftEl.closest('.wl-task-card');
                const task = tasks.find(x => x.id === card?.dataset.id);
                if (!task) return;
                openTaskUrl(task.url);
                if (!visitedTasks.has(task.id)) {
                    visitedTasks.add(task.id);
                    renderTasks();
                }
            };
        });

        listEl.querySelectorAll('.wl-pill-btn').forEach(btn => {
            btn.onclick = async (e) => {
                e.stopPropagation();
                const task = tasks.find(x => x.id === btn.dataset.id);
                if (!task) return;

                const isDone = (task.type === 'tg_channel' && inChannel) ||
                               (task.type === 'tg_chat' && inChat) ||
                               completedExtra.has(task.id);
                if (isDone) return;

                if (window.Telegram?.WebApp?.HapticFeedback) {
                    try { Telegram.WebApp.HapticFeedback.impactOccurred('light'); } catch (err) {}
                }

                // ЭТАП 1: Перейти
                if (!visitedTasks.has(task.id)) {
                    visitedTasks.add(task.id);
                    openTaskUrl(task.url);
                    renderTasks();
                    return;
                }

                // ЭТАП 2: Проверить
                btn.disabled = true;
                btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="font-size: 9px;"></i>`;

                if (task.type === 'tg_channel' || task.type === 'tg_chat') {
                    await checkTgSubs();
                    const nowDone = task.type === 'tg_channel' ? inChannel : inChat;
                    if (!nowDone) {
                        if (window.Telegram?.WebApp?.HapticFeedback) {
                            try { Telegram.WebApp.HapticFeedback.notificationOccurred('error'); } catch (err) {}
                        }
                        showWelcomeNotice(
                            'error',
                            task.type === 'tg_channel' ? 'Нет подписки' : 'Ты ещё не в чате',
                            task.type === 'tg_channel'
                                ? 'Подписка на канал ещё не найдена.<br>Подпишись и нажми <b>«Проверить»</b>.'
                                : 'Вступи в наш Telegram-чат и нажми <b>«Проверить»</b>.'
                        );
                    }
                } else {
                    setTimeout(() => {
                        completedExtra.add(task.id);
                        if (window.Telegram?.WebApp?.HapticFeedback) {
                            try { Telegram.WebApp.HapticFeedback.notificationOccurred('success'); } catch (err) {}
                        }
                        renderTasks();
                        updateRewardUI();
                    }, 900);
                }
            };
        });
    };

    const checkTgSubs = async () => {
        if (isChecking) return;
        isChecking = true;
        try {
            const res = await makeApiRequest('/api/v1/welcome/check_tg', {}, 'POST', true);
            inChannel = Boolean(res && res.in_channel);
            inChat = Boolean(res && res.in_chat);
        } catch (e) {
            inChannel = false;
            inChat = false;
        } finally {
            isChecking = false;
            renderTasks();
            updateRewardUI();
        }
    };

    const handleAutoReturnCheck = () => {
        if (!document.hidden && document.getElementById('matrix-event-modal') && (!inChannel || !inChat)) {
            checkTgSubs();
        }
    };
    document.addEventListener('visibilitychange', handleAutoReturnCheck);
    window.addEventListener('focus', handleAutoReturnCheck);

    const closeModal = () => {
        document.removeEventListener('visibilitychange', handleAutoReturnCheck);
        window.removeEventListener('focus', handleAutoReturnCheck);
        if (isAdminTest) {
            window._welcomeClosedThisLoad = true;
        } else {
            sessionStorage.setItem('matrix_dismissed', 'true');
        }
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.16s ease';
        setTimeout(() => overlay.remove(), 160);
    };

    overlay.querySelector('#wl-close-btn').onclick = closeModal;
    overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };

    claimBtn.onclick = async () => {
        if (!inChannel || !inChat) {
            await checkTgSubs();
            if (!inChannel || !inChat) {
                if (window.Telegram?.WebApp?.HapticFeedback) {
                    try { Telegram.WebApp.HapticFeedback.notificationOccurred('error'); } catch (e) {}
                }
                showWelcomeNotice(
                    'error',
                    'Условия не выполнены',
                    'Подпишись на <b>Telegram-канал</b> и вступи в <b>чат</b>, чтобы забрать кейс.'
                );
            }
            return;
        }

        claimBtn.disabled = true;
        claimBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="font-size: 9.5px;"></i> Выдаём...';

        try {
            const res = await makeApiRequest('/api/v1/welcome/claim', {
                completed_extra_ids: Array.from(completedExtra)
            }, 'POST', true);

            document.removeEventListener('visibilitychange', handleAutoReturnCheck);
            window.removeEventListener('focus', handleAutoReturnCheck);

            if (isAdminTest) {
                window._welcomeClosedThisLoad = true;
            } else {
                sessionStorage.setItem('matrix_dismissed', 'true');
            }

            localStorage.setItem('force_open_shop', 'true');
            localStorage.removeItem('cache_bootstrap');
            localStorage.removeItem('shop_items_cache');
            sessionStorage.removeItem('session_bootstrap');
            sessionStorage.removeItem('session_shop_items');

            if (window.Telegram?.WebApp?.HapticFeedback) {
                try { Telegram.WebApp.HapticFeedback.notificationOccurred('success'); } catch (e) {}
            }
            showWelcomeNotice(
                'success',
                'Кейс выдан',
                `Тебе начислен <b style="color:#fbbf24;">${escapeHTML(res.case_name)}</b>.<br>Открывай его прямо сейчас в магазине!`,
                'Перейти к кейсам',
                () => window.location.reload()
            );
        } catch (e) {
            claimBtn.disabled = false;
            updateRewardUI();
            if (window.Telegram?.WebApp?.HapticFeedback) {
                try { Telegram.WebApp.HapticFeedback.notificationOccurred('error'); } catch (err) {}
            }
            showWelcomeNotice('error', 'Ошибка', escapeHTML(e.message || 'Не удалось выдать кейс. Попробуй позже.'));
        }
    };

    renderTasks();
    updateRewardUI();
    checkTgSubs();
}

async function submitMatrixChoice(pill) {
    try {
        await makeApiRequest('/api/v1/matrix/choose', { choice: pill }, 'POST');
        sessionStorage.setItem('matrix_dismissed', 'true'); 

        // Скрываем окно выбора таблетки
        const modal = document.getElementById('matrix-event-modal');
        if (modal) {
            modal.style.opacity = '0';
            setTimeout(() => modal.remove(), 400);
        }

        if (pill === 'red') {
            // 1. Ставим флаг для авто-открытия вкладки магазина
            localStorage.setItem('force_open_shop', 'true');
            // 2. Жестко чистим кэши (и бутстрап, и магазин)
            localStorage.removeItem('cache_bootstrap'); 
            localStorage.removeItem('shop_items_cache'); 
            
            // 3. Показываем алерт
            customAlert("Ты выбрал путь ленивца. Траст снижен, кейс выдан.");
            
            // 4. Ждем 1.5 сек и обновляем страницу
            setTimeout(() => {
                window.location.reload();
            }, 1500);

        } else {
            customAlert("Путь развития принят! Выполняй задания для награды.");
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        }
        
    } catch (err) {
        console.error("Matrix choice error:", err);
        customAlert("Произошла ошибка при выборе пути.");
    }
}
// ================================================================
// SWAP (TRADE-UP КОНТРАКТ) 3 ЭТАПА
// ================================================================
let swapGivenItems = new Map(); // historyId -> { price, name, image_url }
let swapTargetItem = null; // { name, price, image_url }
let globalMarketItems = []; // Кэш витрины
let currentSwapStep = 1;

window.openSwapModal = async () => {
    const msgCount = userData.monthly_message_count || 0;
    const requiredMsgs = 300;
    
    const modal = document.getElementById('swap-modal');
    if (modal) modal.classList.remove('hidden');

    // Проверка на количество сообщений
    if (msgCount < requiredMsgs) {
        const loader = document.getElementById('swap-loader');
        if (loader) loader.style.display = 'none';
        
        document.getElementById('swap-content-area')?.classList.add('hidden');
        document.getElementById('swap-footer').style.display = 'none';
        
        const lockedArea = document.getElementById('swap-locked-area');
        if (lockedArea) {
            lockedArea.classList.remove('hidden');
            const p = lockedArea.querySelector('p');
            if (p) p.innerHTML = `Обменник доступен только активным зрителям. Для разблокировки нужно написать <b>300 сообщений</b> за месяц на Twitch.`;
        }
        
        const progressText = document.getElementById('swap-msg-progress');
        if (progressText) progressText.textContent = msgCount;
        
        const percent = Math.min((msgCount / requiredMsgs) * 100, 100);
        setTimeout(() => {
            const bar = document.getElementById('swap-msg-bar');
            if (bar) bar.style.width = percent + '%';
        }, 100);
        return; 
    }

    // Если сообщений хватает — готовим окно к загрузке
    document.getElementById('swap-locked-area')?.classList.add('hidden');
    document.getElementById('swap-footer').style.display = 'block';
    document.getElementById('swap-content-area')?.classList.add('hidden');
    
    const loader = document.getElementById('swap-loader');
    if (loader) {
        loader.style.display = 'flex';
        // Сбрасываем текст лоадера на случай, если там висит старая ошибка
        loader.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Загрузка инвентаря...';
    }
    
    swapGivenItems.clear();
    swapTargetItem = null;
    currentSwapStep = 1;
    globalMarketItems = []; // Чистим кэш
    
    try {
        let inventoryRes = [];

        try {
            // Запрашиваем инвентарь (тихий режим)
            inventoryRes = await makeApiRequest('/api/v1/user/inventory', {}, 'POST', true);
        } catch (err) {
            console.warn("Свап: ошибка загрузки инвентаря", err);
        }
        
        // 🔥 БРОНЯ 1: Безопасный парсинг (на случай, если бэк вернул объект, а не массив)
        let rawItems = [];
        if (Array.isArray(inventoryRes)) rawItems = inventoryRes;
        else if (inventoryRes && Array.isArray(inventoryRes.items)) rawItems = inventoryRes.items;
        else if (inventoryRes && Array.isArray(inventoryRes.data)) rawItems = inventoryRes.data;

        // 🔥 БРОНЯ 2: Защита от null-элементов, битых скинов, запрещенных источников И просрочки
        const amnestyDateMs = new Date("2026-07-15T00:00:00+03:00").getTime();
        const nowMs = Date.now();

        // 🔥 ВМЕСТО УДАЛЕНИЯ, МЫ ПОМЕЧАЕМ БЛОКИРОВКУ
        let processedItems = rawItems
            .filter(item => item && item.status && ['pending', 'available'].includes(item.status) && item.is_swapped !== true && item.image_url && item.image_url.startsWith('http'))
            .map(item => {
                // 1. Логика сгорания 1-в-1 как на Python-бэкенде
                let isExpired = false;
                if (item.updated_at) {
                    // JS отлично парсит ISO даты, которые отдает Supabase
                    const updatedTimeMs = new Date(item.updated_at).getTime();
                    let lifeDays = 14;
                    
                    // Если скин обновился после даты амнистии
                    if (updatedTimeMs >= amnestyDateMs) {
                        if (['raffle', 'auction', 'twitch'].includes(item.source)) {
                            lifeDays = 3;
                        } else {
                            lifeDays = 14;
                        }
                    }
                    
                    // Прибавляем нужное количество дней в миллисекундах
                    const expireTimeMs = updatedTimeMs + (lifeDays * 24 * 60 * 60 * 1000);
                    
                    // Если текущее время больше или равно времени сгорания — скин сгорел
                    isExpired = nowMs >= expireTimeMs;
                }

                // 2. Распределяем причины блокировки
                let isLocked = false;
                let lockReason = "";

                if (item.source === 'raffle') {
                    isLocked = true; 
                    lockReason = "С розыгрыша";
                } else if (item.source === 'auction') {
                    isLocked = true; 
                    lockReason = "С аукциона";
                } else if (isExpired) {
                    isLocked = true; 
                    lockReason = "Сгорел";
                }

                // Возвращаем предмет, добавив к нему флаги
                return { ...item, isLocked, lockReason };
            });

        // 🔥 СОРТИРОВКА: Доступные сверху, Заблокированные улетают вниз списка
        processedItems.sort((a, b) => {
            if (a.isLocked === b.isLocked) return 0;
            return a.isLocked ? 1 : -1;
        });
        
        // Отправляем массив с флагами на отрисовку
        renderSwapInventory(processedItems);
        
        if (loader) loader.style.display = 'none';
        document.getElementById('swap-content-area')?.classList.remove('hidden');
        
        // Переходим к первому шагу
        goToSwapStep(1);

    } catch (e) {
        // 🔥 Если вдруг упадет, мы точно увидим почему 🔥
        console.error("КРИТИЧЕСКАЯ ОШИБКА В СВАПЕ:", e);
        if (loader) {
            loader.innerHTML = '<span style="color:#ff3b30;">Ошибка интерфейса. Откройте консоль (F12)</span>';
            loader.style.display = 'flex';
        }
    }
};

window.closeSwapModal = () => document.getElementById('swap-modal').classList.add('hidden');

function goToSwapStep(step) {
    currentSwapStep = step;
    
    document.getElementById('swap-step-1').classList.add('hidden');
    document.getElementById('swap-step-2').classList.add('hidden');
    document.getElementById('swap-step-3').classList.add('hidden');
    
    document.getElementById(`swap-step-${step}`).classList.remove('hidden');
    
    const backBtn = document.getElementById('swap-back-btn');
    const mainBtn = document.getElementById('swap-main-btn');

    if (step === 1) {
        backBtn.classList.add('hidden');
        updateSwapBtnStep1();
    } else if (step === 2) {
        backBtn.classList.remove('hidden');
        renderSwapMarket(); 
        updateSwapBtnStep2();
    } else if (step === 3) {
        backBtn.classList.remove('hidden');
        renderSwapConfirmation();
        mainBtn.disabled = false;
        mainBtn.innerText = "ПОДТВЕРДИТЬ СВАП";
    }
}

window.swapGoBack = () => {
    if (currentSwapStep > 1) goToSwapStep(currentSwapStep - 1);
};

window.handleSwapMainBtn = async () => {
    // ==========================================
    // ЛОГИКА ШАГА 1 -> ПЕРЕХОД НА ШАГ 2
    // ==========================================
    if (currentSwapStep === 1) {
        const btn = document.getElementById('swap-main-btn');
        const originalText = btn.innerText;

        // Считаем сумму выбранных предметов (с правильным подсчетом копеек)
        const totalSum = Number(Array.from(swapGivenItems.values()).reduce((sum, item) => sum + item.price, 0).toFixed(2));
        
        if (totalSum <= 0) {
            return customAlert("Выберите хотя бы один предмет для обмена!");
        }

        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Подбор скинов...';
        btn.disabled = true;

        // 🔥 МАТЕМАТИКА КОМИССИИ (НАЦЕНКА 20%) 🔥
        // Юзер получает только 80% от суммы своих скинов
        const maxPrice = Number((totalSum * 0.80).toFixed(2)); 
        const minPrice = Number((totalSum * 0.40).toFixed(2)); // Снизили минималку, чтобы выбор был шире

        try {
            // Ищем скины на бэке по новым лимитам
            let rawMarket = await makeApiRequest(`/api/v1/shop/market_cache?min_price=${minPrice}&max_price=${maxPrice}`, {}, 'GET', true);
            
            let marketRes = [];
            if (Array.isArray(rawMarket)) marketRes = rawMarket;
            else if (rawMarket && Array.isArray(rawMarket.items)) marketRes = rawMarket.items;
            else if (rawMarket && Array.isArray(rawMarket.data)) marketRes = rawMarket.data;

            // Обновляем глобальный массив
            globalMarketItems = marketRes;
            goToSwapStep(2);
        } catch(e) {
            customAlert("Не удалось загрузить варианты для замены.");
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    } 
    // ==========================================
    // ЛОГИКА ОСТАЛЬНЫХ ШАГОВ
    // ==========================================
    else if (currentSwapStep === 2) {
        goToSwapStep(3);
    } 
    else if (currentSwapStep === 3) {
        executeSwap();
    }
};

window.toggleGiveItem = (historyId, price, name, imageUrl) => {
    const card = document.getElementById(`swap-inv-${historyId}`);
    if (!card) return;

    if (swapGivenItems.has(historyId)) {
        swapGivenItems.delete(historyId);
        card.style.borderColor = 'transparent';
        card.style.background = '#232325';
        card.querySelector('.swap-check').classList.add('hidden');
    } else {
        if (swapGivenItems.size >= 4) return customAlert("Максимум 4 предмета!");
        swapGivenItems.set(historyId, { price, name, image_url: imageUrl });
        card.style.borderColor = '#34c759';
        card.style.background = 'rgba(52,199,89,0.05)';
        card.querySelector('.swap-check').classList.remove('hidden');
    }
    
    const totalSum = Array.from(swapGivenItems.values()).reduce((sum, item) => sum + item.price, 0);
    if (swapTargetItem && swapTargetItem.price > totalSum) {
        swapTargetItem = null;
    }

    document.getElementById('swap-give-sum').innerText = totalSum;
    updateSwapBtnStep1();
    if (window.Telegram?.WebApp?.HapticFeedback) Telegram.WebApp.HapticFeedback.selectionChanged();
};

function renderSwapInventory(items) {
    const grid = document.getElementById('swap-inventory-grid');
    if (items.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; color: #888; font-size: 12px; margin-top: 20px; line-height: 1.4;">
                <i class="fa-solid fa-box-open" style="font-size: 24px; color: #555; margin-bottom: 10px;"></i><br>
                Нет доступных предметов
            </div>
        `;
        return;
    }
    
    grid.innerHTML = items.map(item => {
        // Подсчет цены с копейками
        const rawPrice = (parseFloat(item.replaced_price) > 0) ? parseFloat(item.replaced_price) : (parseFloat(item.price_rub) || 0);
        const price = Number(rawPrice.toFixed(2));
        
        const shortName = (item.name || "Скин").split('|').pop().trim();

        // 🔒 ОТРИСОВКА ЗАБЛОКИРОВАННОГО СКИНА (Серый, с причиной)
        if (item.isLocked) {
            return `
                <div class="swap-card-inv locked" onclick="customAlert('Этот предмет нельзя использовать в обмене! Причина: ${item.lockReason}')" 
                     style="background: #1c1c1e; border: 1px solid rgba(255, 59, 48, 0.3); border-radius: 10px; padding: 8px; text-align: center; cursor: not-allowed; position: relative; display: flex; flex-direction: column; align-items: center; height: 115px; justify-content: space-between; box-sizing: border-box; opacity: 0.5;">
                    
                    <img src="${item.image_url}" style="width: 100%; height: 50px; object-fit: contain; filter: grayscale(100%);">
                    
                    <div style="font-size: 9px; color: #888; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; margin-top: 4px;">${shortName}</div>
                    
                    <div style="font-size: 8px; color: #ff3b30; font-weight: bold; background: rgba(255,59,48,0.1); padding: 3px 2px; border-radius: 4px; display: flex; align-items: center; justify-content: center; gap: 3px; margin-top: auto; width: 100%; box-sizing: border-box;">
                        <i class="fa-solid fa-lock" style="font-size: 7px; flex-shrink: 0;"></i> 
                        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.lockReason}</span>
                    </div>
                </div>
            `;
        }

        // ✅ ОТРИСОВКА ОБЫЧНОГО СКИНА (Который можно выбрать)
        const isSelected = swapGivenItems.has(item.history_id);
        const border = isSelected ? '#34c759' : 'transparent';

        return `
            <div class="swap-card-inv" id="swap-inv-${item.history_id}" onclick="toggleGiveItem(${item.history_id}, ${price}, '${item.name.replace(/'/g, "\\'")}', '${item.image_url}')" 
                 style="background: #232325; border: 1px solid ${border}; border-radius: 10px; padding: 8px; text-align: center; cursor: pointer; position: relative; display: flex; flex-direction: column; align-items: center; height: 115px; justify-content: space-between; box-sizing: border-box; transition: 0.2s;">
                <img src="${item.image_url}" style="width: 100%; height: 50px; object-fit: contain;">
                <div style="font-size: 9px; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; margin-top: 4px;">${shortName}</div>
                <div style="font-size: 11px; color: #FFD700; font-weight: bold; display: flex; align-items: center; gap: 4px;">
                    ${price} <div style="width: 10px; height: 10px; background: #ffd700; border-radius: 50%;"></div>
                </div>
                <div class="swap-check ${isSelected ? '' : 'hidden'}" style="position: absolute; top: 4px; right: 4px; background: #34c759; color: #fff; width: 14px; height: 14px; border-radius: 50%; font-size: 8px; display: flex; align-items: center; justify-content: center;"><i class="fa-solid fa-check"></i></div>
            </div>
        `;
    }).join('');
}

window.toggleGiveItem = (historyId, price, name, imageUrl) => {
    const card = document.getElementById(`swap-inv-${historyId}`);
    if (!card) return;

    if (swapGivenItems.has(historyId)) {
        swapGivenItems.delete(historyId);
        card.style.borderColor = 'transparent';
        card.style.background = '#232325';
        card.querySelector('.swap-check').classList.add('hidden');
    } else {
        if (swapGivenItems.size >= 4) return customAlert("Максимум 4 предмета!");
        swapGivenItems.set(historyId, { price, name, image_url: imageUrl });
        card.style.borderColor = '#34c759';
        card.style.background = 'rgba(52,199,89,0.05)';
        card.querySelector('.swap-check').classList.remove('hidden');
    }
    
    // 🔥 ИСПРАВЛЕНИЕ: Аккуратный подсчет копеек
    const totalSum = Number(Array.from(swapGivenItems.values()).reduce((sum, item) => sum + item.price, 0).toFixed(2));
    if (swapTargetItem && swapTargetItem.price > totalSum) {
        swapTargetItem = null;
    }

    document.getElementById('swap-give-sum').innerText = totalSum;
    updateSwapBtnStep1(); 
    if (window.Telegram?.WebApp?.HapticFeedback) Telegram.WebApp.HapticFeedback.selectionChanged();
};


function updateSwapBtnStep1() {
    const btn = document.getElementById('swap-main-btn');
    if (swapGivenItems.size === 0) {
        btn.disabled = true;
        btn.innerText = "ВЫБЕРИТЕ СВОИ ПРЕДМЕТЫ";
    } else {
        btn.disabled = false;
        btn.innerText = "ВЫБРАТЬ СКИН НА ЗАМЕНУ";
    }
}

// ЭТАП 2: Выбор с маркета (С БРОНЕЙ ОТ МУСОРА И КЕЙСОВ)
window.renderSwapMarket = function() {
    const grid = document.getElementById('swap-market-grid');
    const searchInput = document.getElementById('swap-search-input');
    const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';

    const totalSum = Array.from(swapGivenItems.values()).reduce((sum, item) => sum + item.price, 0);

    // 🔥 ТА ЖЕ КОМИССИЯ ДЛЯ ФИЛЬТРА 🔥
    const maxPrice = totalSum * 0.80;
    const minPrice = totalSum * 0.40;

    // ЧЕРНЫЙ СПИСОК (Фронтенд-броня)
    const blacklist = [
        "sticker |", "graffiti |", "patch |", "music kit |", 
        "pin |", "charm |", "pass |", "case", "кейс",
        "capsule", "капсула", "terminal", "терминал", "token"
    ];

    const availableMarketItems = globalMarketItems.filter(item => {
        const priceRub = parseFloat(item.price_rub) || 0;
        
        // 1. Фильтр бюджета (теперь по maxPrice с учетом комсы!)
        if (totalSum <= 0 || priceRub > maxPrice || priceRub < minPrice) return false;

        const lowerName = item.market_hash_name.toLowerCase();
        
        // 2. Фильтр поиска
        if (searchQuery && !lowerName.includes(searchQuery)) return false;

        // 3. Фильтр мусора и кейсов
        if (blacklist.some(junk => lowerName.includes(junk))) return false;

        return true;
    });

    if (availableMarketItems.length === 0) {
        if (totalSum <= 0) {
            grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #888; font-size: 12px; margin-top: 20px;">Сначала выберите свои скины для обмена.</div>';
        } else if (searchQuery) {
            grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #888; font-size: 12px; margin-top: 20px;">По вашему запросу ничего не найдено.</div>';
        } else {
            grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #888; font-size: 12px; margin-top: 20px;">Нет скинов в диапазоне<br><b style="color:#ffd700;">от ${minPrice.toFixed(0)} до ${maxPrice.toFixed(0)} монеток</b>.</div>`;
        }
        return;
    }

    grid.innerHTML = availableMarketItems.map(item => {
        const priceRub = parseFloat(item.price_rub) || 0;
        const isSelected = swapTargetItem && swapTargetItem.name === item.market_hash_name;
        const border = isSelected ? '#ff9500' : 'transparent';

        let weapon = "";
        let skinName = item.market_hash_name;
        let condition = "";

        const match = item.market_hash_name.match(/^(.*?)\s*\|\s*(.*?)(?:\s*\((.*?)\))?$/);
        if (match) {
            weapon = match[1];            
            skinName = match[2];          
            condition = match[3] || "";   
        } else {
            skinName = item.market_hash_name.split('|').pop().trim();
        }

        const conditionHtml = condition 
            ? `<div style="font-size: 8px; color: #8e8e93; background: rgba(255,255,255,0.05); padding: 2px 4px; border-radius: 4px; margin-top: 4px;">${escapeHTML(condition)}</div>` 
            : '';
            
        const weaponHtml = weapon 
            ? `<div style="font-size: 9px; color: #aaa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; margin-top: 4px;">${escapeHTML(weapon)}</div>` 
            : '';

        // Защищаем кавычки в названии для data-id
        const safeDataId = item.market_hash_name.replace(/"/g, '&quot;');

        return `
            <div class="swap-card-inv market-card-item" data-id="${safeDataId}" onclick="selectTargetItem('${item.market_hash_name.replace(/'/g, "\\'")}', ${priceRub}, '${item.image_url}')"
                 style="background: #232325; border: 1px solid ${border}; border-radius: 10px; padding: 8px; text-align: center; cursor: pointer; position: relative; display: flex; flex-direction: column; align-items: center; height: 140px; justify-content: space-between; box-sizing: border-box; transition: border-color 0.2s; min-width: 0; overflow: hidden; width: 100%;">
                
                <img src="${item.image_url}" style="width: 100%; height: 50px; object-fit: contain; flex-shrink: 0;">
                
                ${weaponHtml}
                <div style="font-size: 10px; color: #fff; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; margin-top: ${weapon ? '2px' : '4px'};">${escapeHTML(skinName)}</div>
                ${conditionHtml}
                
                <div style="font-size: 11px; color: #ffcc00; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 4px; flex-shrink: 0; margin-top: auto; padding-top: 6px;">
                    ${priceRub} <div style="width: 10px; height: 10px; background: #ffd700; border-radius: 50%;"></div>
                </div>
                
                <div class="swap-check ${isSelected ? '' : 'hidden'}" style="position: absolute; top: 4px; right: 4px; background: #ff9500; color: #fff; width: 14px; height: 14px; border-radius: 50%; font-size: 8px; display: flex; align-items: center; justify-content: center;"><i class="fa-solid fa-check"></i></div>
            </div>
        `;
    }).join('');
};

window.selectTargetItem = (name, price, imageUrl) => {
    // 1. Обновляем данные о выбранном скине
    if (swapTargetItem && swapTargetItem.name === name) swapTargetItem = null;
    else swapTargetItem = { name, price, image_url: imageUrl };
    
    // 🔥 ИСПРАВЛЕНИЕ: Вывод цены с копейками (если они есть)
    document.getElementById('swap-take-price').innerText = swapTargetItem ? Number(swapTargetItem.price.toFixed(2)) : 0;
    
    // 2. СНИМАЕМ ВЫДЕЛЕНИЕ со всех карточек на витрине (чтобы снять рамки с прошлых кликов)
    document.querySelectorAll('#swap-market-grid .market-card-item').forEach(card => {
        card.style.borderColor = 'transparent';
        const check = card.querySelector('.swap-check');
        if (check) check.classList.add('hidden');
    });

    // 3. СТАВИМ ВЫДЕЛЕНИЕ на ту, которую кликнули (БЕЗ ПЕРЕЗАГРУЗКИ КАРТИНОК)
    if (swapTargetItem) {
        // Экранируем двойные кавычки для безопасного поиска
        const safeSelector = swapTargetItem.name.replace(/"/g, '\\"');
        const targetCard = document.querySelector(`#swap-market-grid .market-card-item[data-id="${safeSelector}"]`);
        
        if (targetCard) {
            targetCard.style.borderColor = '#ff9500';
            const check = targetCard.querySelector('.swap-check');
            if (check) check.classList.remove('hidden');
        }
    }
    
    // 4. Обновляем кнопку и дергаем виброотклик
    updateSwapBtnStep2();
    if (window.Telegram?.WebApp?.HapticFeedback) Telegram.WebApp.HapticFeedback.selectionChanged();
};

function updateSwapBtnStep2() {
    const btn = document.getElementById('swap-main-btn');
    if (!swapTargetItem) {
        btn.disabled = true;
        btn.innerText = "ВЫБЕРИТЕ СКИН С МАРКЕТА";
    } else {
        btn.disabled = false;
        btn.innerText = "ПЕРЕЙТИ К ОБМЕНУ";
    }
}

// ЭТАП 3: Подтверждение
function renderSwapConfirmation() {
    // 🔥 ИСПРАВЛЕНИЕ: Аккуратный подсчет суммы с копейками
    const totalSum = Number(Array.from(swapGivenItems.values()).reduce((sum, item) => sum + item.price, 0).toFixed(2));
    document.getElementById('swap-confirm-sum').innerText = totalSum;
    
    const giveGrid = document.getElementById('swap-confirm-give-grid');
    giveGrid.innerHTML = Array.from(swapGivenItems.values()).map(item => `
        <div style="background: rgba(0,0,0,0.3); border-radius: 6px; padding: 2px; text-align: center;">
            <img src="${item.image_url}" style="width: 30px; height: 30px; object-fit: contain;">
        </div>
    `).join('');

    if (swapTargetItem) {
        document.getElementById('swap-confirm-take-img').src = swapTargetItem.image_url;
        document.getElementById('swap-confirm-take-name').innerText = swapTargetItem.name.split('|').pop();
        // 🔥 ИСПРАВЛЕНИЕ: Вывод цены с копейками
        document.getElementById('swap-confirm-take-price').innerText = Number(swapTargetItem.price.toFixed(2));
    }
}

window.executeSwap = async () => {
    if (swapGivenItems.size === 0 || !swapTargetItem) return;

    const btn = document.getElementById('swap-main-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Выполняем...';

    try {
        const payload = {
            history_ids: Array.from(swapGivenItems.keys()),
            target_market_name: swapTargetItem.name
        };

        const res = await makeApiRequest('/api/v1/swap/execute', payload, 'POST');
        
        closeSwapModal();
        
        const modal = document.getElementById('r-modal');
        const area = document.getElementById('r-area');
        const winScreen = document.getElementById('r-win');
        const topHeader = document.getElementById('r-top-header');
        const bottomProgress = document.getElementById('r-bottom-progress');

        if (modal && winScreen && res.item) {
            if(topHeader) topHeader.style.display = 'none';
            if(bottomProgress) bottomProgress.style.display = 'none';
            if(area) area.style.display = 'none';

            const engCondMap = {
                'Factory New': 'Прямо с завода', 'Minimal Wear': 'Немного поношенное',
                'Field-Tested': 'После полевых испытаний', 'Well-Worn': 'Поношенное', 'Battle-Scarred': 'Закаленное в боях'
            };

            const isNoConditionItem = /sticker|наклейка|graffiti|граффити|patch|нашивка|charm|брелок|pin|значок/i.test(res.item.name);
            let swapSkinName = res.item.name;
            let swapCondition = "Прямо с завода";
            const match = res.item.name.match(/^(.*?)\s*\|\s*(.*?)(?:\s*\((.*?)\))?$/);
            
            if (match) {
                swapSkinName = `${match[1]} | ${match[2]}`;
                const engCond = match[3] || "Factory New";
                swapCondition = engCondMap[engCond] || engCond;
            } else {
                swapSkinName = res.item.name.split('|').pop().trim();
            }

            const conditionHtml = isNoConditionItem 
                ? '' 
                : `<div style="font-size: 11px; color: #8e8e93; margin-bottom: 2px; text-align: center;">${escapeHTML(swapCondition)}</div>`;

            winScreen.innerHTML = `
                <h2 style="color:#ffcc00; margin-bottom:10px; text-transform:uppercase; text-shadow:0 0 20px rgba(255,215,0,0.5);">ОБМЕН УСПЕШЕН!</h2>
                <img src="${res.item.image_url}" class="win-img" style="width: 150px; height: 150px; object-fit: contain;">
                <h3 style="color:#fff; margin-top:15px; margin-bottom: 2px; font-weight: 700; text-align: center; padding: 0 10px;">${escapeHTML(swapSkinName)}</h3>
                
                ${conditionHtml}
                <div style="font-size: 12px; color: #cbd5e0; font-weight: 500; margin-bottom: 20px; text-align: center;">
                    ${res.item.price} <i class="fa-solid fa-coins" style="color: #ffd700; font-size: 10px;"></i>
                </div>

                <button class="action-btn btn-buy" style="width: 220px; height: 48px; font-size: 14px; margin-bottom: 10px; box-shadow: 0 0 15px rgba(52, 199, 89, 0.4); background: #34c759; color: #000; border: none; font-weight: 800; border-radius: 8px;" 
                        onclick="closeRoulette(); claimItem(${res.item.id})">
                    ЗАБРАТЬ В STEAM
                </button>
                
                <button class="action-btn" style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); color: #ccc; width: 220px; height: 44px; margin-bottom: 15px; border-radius: 8px;" 
                        onclick="closeRoulette(); sellForTickets(${res.item.id}, ${res.item.price})">
                    ПРОДАТЬ ЗА ${res.item.price} 🎟️
                </button>
                
                <button class="action-btn btn-secondary-action" style="width: 220px; background: transparent; border: none; color: #888;" 
                        onclick="closeRoulette();">
                    Закрыть
                </button>
            `;
            
            winScreen.style.display = 'flex';
            modal.style.display = 'flex';
        } else {
            customAlert(`✅ Успешно! Вы получили:\n${swapTargetItem.name}`);
        }
        
        checkBalance(true); 
        if (typeof loadData === 'function') loadData(true); 
        
    } catch (e) {
        console.error("Ошибка свапа:", e);
    } finally {
        btn.disabled = false;
        btn.innerText = "ПОДТВЕРДИТЬ СВАП";
    }
};
// ================================================================
// СПЕЦИАЛЬНОЕ ОКНО ДЛЯ ИНФО-ПОДСКАЗОК (НЕ ЗАКРЫВАЕТ ТРАСТ-ФАКТОР)
// ================================================================
window.showTrustTooltip = function(title, htmlContent) {
    const overlay = document.createElement('div');
    overlay.className = 'trust-tooltip-overlay';
    overlay.style.cssText = "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.8); z-index: 2147483647; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px); opacity: 0; transition: opacity 0.2s;";
    
    overlay.innerHTML = `
        <div class="custom-confirm-box" style="padding: 20px; width: 85%; max-width: 340px; background: #1c1c1e; border-radius: 16px; border: 1px solid rgba(255, 215, 0, 0.3); text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.8);">
            <div style="font-size: 12px; color: #ddd; line-height: 1.4; text-align: left; margin-bottom: 20px;">${htmlContent}</div>
            <button onclick="this.closest('.trust-tooltip-overlay').style.opacity='0'; setTimeout(() => this.closest('.trust-tooltip-overlay').remove(), 200);" style="width: 100%; padding: 12px; font-size: 13px; background: #ffcc00; color: #000; border: none; border-radius: 10px; font-weight: 700; cursor: pointer; text-transform: uppercase;">ПОНЯТНО</button>
        </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.style.opacity = '1');
};

// ================================================================
// КРАСИВОЕ ОКНО: НУЖЕН АКТИВ ДЛЯ АМНИСТИИ
// ================================================================
window.showAmnestyLockAlert = function(msgsLeft) {
    const msgsDone = Math.max(0, 100 - msgsLeft);
    const progressPercent = Math.min(100, msgsDone);

    const overlay = document.createElement('div');
    overlay.className = 'amnesty-special-overlay'; // Изменили класс, чтобы не было конфликтов!
    overlay.style.cssText = "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.8); z-index: 2147483647; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px); opacity: 0; transition: opacity 0.2s;";

    overlay.innerHTML = `
        <div style="padding: 24px 20px; width: 85%; max-width: 340px; background: #1c1c1e; border-radius: 16px; border: 1px solid rgba(255, 149, 0, 0.4); text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.8); display: flex; flex-direction: column; gap: 16px;">
            
            <div style="font-size: 44px; color: #ff9500; line-height: 1; text-shadow: 0 0 15px rgba(255, 149, 0, 0.4);">
                <i class="fa-solid fa-lock"></i>
            </div>
            
            <div style="font-size: 18px; font-weight: 900; color: #fff; text-transform: uppercase; letter-spacing: 0.5px;">
                Нужен актив
            </div>
            
            <div style="font-size: 12px; color: #ccc; line-height: 1.4;">
                Для запроса амнистии необходимо написать <b style="color: #fff;">100 сообщений</b> на Твиче за активную сессию.
            </div>

            <!-- Прогресс-бар -->
            <div style="width: 100%; background: rgba(255,255,255,0.03); border-radius: 10px; padding: 12px; box-sizing: border-box; border: 1px solid rgba(255,255,255,0.05);">
                <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 800; color: #fff; margin-bottom: 8px; font-family: 'SF Mono', monospace;">
                    <span style="color: #aaa;">${msgsDone}</span>
                    <span style="color: #ff9500; font-size: 10px; text-transform: uppercase;">Осталось: ${msgsLeft}</span>
                    <span style="color: #aaa;">100</span>
                </div>
                <div style="width: 100%; height: 8px; border-radius: 4px; background: rgba(0,0,0,0.6); position: relative; overflow: hidden; box-shadow: inset 0 1px 3px rgba(0,0,0,0.5);">
                    <div style="position: absolute; top: 0; left: 0; height: 100%; width: ${progressPercent}%; background: linear-gradient(90deg, #ff3b30, #ff9500); border-radius: 4px; box-shadow: 0 0 10px rgba(255, 149, 0, 0.5);"></div>
                </div>
            </div>

            <div style="font-size: 10px; color: #666; line-height: 1.3;">
                Данные сбрасываются каждый день, поэтому актив нужно проявить за один стрим.
            </div>

            <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 5px;">
                <button onclick="window.open('https://www.twitch.tv/hatelove_ttv', '_blank')" style="width: 100%; padding: 14px; font-size: 13px; background: #9146ff; color: #fff; border: none; border-radius: 12px; font-weight: 800; cursor: pointer; text-transform: uppercase; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 15px rgba(145, 70, 255, 0.3);">
                    <i class="fa-brands fa-twitch" style="font-size: 16px;"></i> Перейти на Twitch
                </button>
                <button onclick="this.closest('.amnesty-special-overlay').style.opacity='0'; setTimeout(() => { this.closest('.amnesty-special-overlay').remove(); openTrustModal(); }, 200);" style="width: 100%; padding: 14px; font-size: 13px; background: rgba(255,255,255,0.05); color: #aaa; border: none; border-radius: 12px; font-weight: 700; cursor: pointer; text-transform: uppercase;">
                    Назад
                </button>
            </div>
            
        </div>
    `;
    
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.style.opacity = '1');
};

// ================================================================
// КРАСИВОЕ ОКНО: КРАСНАЯ ТАБЛЕТКА (ПУТЬ ЛЕНИВЦА)
// ================================================================
window.showAmnestyRedPillAlert = function() {
    const overlay = document.createElement('div');
    overlay.className = 'amnesty-special-overlay'; // Изменили класс
    overlay.style.cssText = "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.8); z-index: 2147483647; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px); opacity: 0; transition: opacity 0.2s;";

    overlay.innerHTML = `
        <div style="padding: 24px 20px; width: 85%; max-width: 340px; background: #1c1c1e; border-radius: 16px; border: 1px solid rgba(255, 59, 48, 0.3); text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.8); display: flex; flex-direction: column; gap: 16px;">
            
            <div style="font-size: 44px; color: #ff3b30; line-height: 1; text-shadow: 0 0 20px rgba(255, 59, 48, 0.5);">
                <i class="fa-solid fa-capsules"></i>
            </div>
            
            <div style="font-size: 18px; font-weight: 900; color: #fff; text-transform: uppercase; letter-spacing: 0.5px;">
                Путь ленивца
            </div>
            
            <div style="font-size: 13px; color: #ccc; line-height: 1.5;">
                Ты выбрал <b style="color: #ff3b30;">Красную таблетку</b>.<br><br>
                Функция амнистии для твоего аккаунта <b style="color: #fff;">недоступна навсегда</b>.
            </div>

            <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 5px;">
                <button onclick="this.closest('.amnesty-special-overlay').style.opacity='0'; setTimeout(() => { this.closest('.amnesty-special-overlay').remove(); openTrustModal(); }, 200);" style="width: 100%; padding: 14px; font-size: 13px; background: rgba(255, 59, 48, 0.1); border: 1px solid rgba(255, 59, 48, 0.4); color: #ff3b30; border-radius: 12px; font-weight: 800; cursor: pointer; text-transform: uppercase; box-shadow: 0 4px 15px rgba(255, 59, 48, 0.15); transition: background 0.2s;">
                    ПОНЯТНО
                </button>
            </div>
            
        </div>
    `;
    
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.style.opacity = '1');
};

// Единый обработчик клика по кнопке Амнистии
window.handleAmnestyClick = function(dailyMsgs, needed, tookRedPill) {
    // Сначала жестко сносим старое окно
    const oldModal = document.querySelector('.custom-confirm-overlay');
    if (oldModal) oldModal.remove();

    // Ждем 50мс, чтобы DOM успел отрендерить удаление и избежать конфликтов
    setTimeout(() => {
        if (tookRedPill) {
            showAmnestyRedPillAlert();
        } else if (dailyMsgs < needed) {
            showAmnestyLockAlert(needed - dailyMsgs);
        } else {
            claimTrustAmnesty();
        }
    }, 50);
};

// ================================================================
// ОКНО ТРАСТ-ФАКТОРА (КОМПАКТНЫЕ КНОПКИ + СТАТИСТИКА БАЛЛОВ)
// ================================================================
window.openTrustModal = () => {
    // Получаем баллы пользователя
    const score = userData.trust_score !== undefined ? parseFloat(userData.trust_score) : 30.0;
    const percent = Math.max(0, Math.min(100, score)); 
    
    // Статусы
    let levelText = 'Базовый';
    let levelColor = '#8e8e93';
    let multiplierText = 'Цены x2 🪙';
    
    if (score < 30) { 
        levelText = 'Пониженный'; 
        levelColor = '#ff3b30'; 
        multiplierText = 'Цены x3 💸';
    } else if (score >= 70) { 
        levelText = 'Повышенный'; 
        levelColor = '#34c759'; 
        multiplierText = 'Цены x1 💎';
    }

    // Вытаскиваем стату для калькулятора
    const twMsgs = userData.monthly_message_count || 0;
    const twMins = userData.monthly_uptime_minutes || 0;
    const tgMsgs = userData.telegram_monthly_message_count || 0;
    const streak = userData.streak_days || 0;
    const penalties = userData.penalty_points || 0;
    
    // Переменные для проверки Амнистии
    const dailyTwitchMsgs = userData.daily_message_count || 0;
    const messagesNeeded = 100;
    
    // 🔥 СЧИТАЕМ РЕАЛЬНО ЗАРАБОТАННЫЕ БАЛЛЫ (с учетом потолка) 🔥
    const twMsgsPoints = Math.min((twMsgs / 1500) * 40, 40).toFixed(1);
    const twMinsPoints = Math.min((twMins / 2400) * 40, 40).toFixed(1);
    const tgMsgsPoints = Math.min((tgMsgs / 3500) * 80, 80).toFixed(1);
    const streakPoints = (streak * 0.5).toFixed(1);

    // Берем данные матрицы из кэша бутстрапа (железобетонно работает везде)
    const cachedBootstrap = JSON.parse(localStorage.getItem('cache_bootstrap') || '{}');
    const tookRedPill = cachedBootstrap?.matrix_quest?.selected_pill === 'red';

    // 🔥 Собираем контент для всплывающего окна (ПРАВИЛА И СТАТИСТИКА)
    window.trustTooltipContent = `
        <div style="width: 100%; text-align: left; display: flex; flex-direction: column; gap: 8px; max-height: 65vh; overflow-y: auto; padding-right: 5px;">
            
            <div style="font-size: 16px; font-weight: 900; color: #fff; text-transform: uppercase; text-align: center; margin-bottom: 5px; letter-spacing: 0.5px;">
                ПРАВИЛА
            </div>
            <div style="font-size: 11px; color: #aaa; text-align: left; margin-bottom: 10px; line-height: 1.4;">
                Система поощряет активных зрителей. Ваш уровень Траста напрямую влияет на цены в магазине.<br><br>
                <b>Как заработать баллы:</b><br>
                • Twitch (сообщения + просмотр) — макс. 80 баллов.<br>
                • Telegram (общение в чате) — макс. 80 баллов.<br>
                • Ежедневный Гринд (стрик) — +0.5 балла/день.<br><br>
                <span style="color:#ff3b30; font-weight:600;">* Для «Пониженного» статуса нормы активности снижены в 2 раза, чтобы быстрее вернуться в Базовый.</span><br><br>
                <b style="color:#fff;">АМНИСТИЯ:</b><br>
                Если ваш Траст упал в красную зону (ниже 35), вы можете восстановить его до 35 баллов (Базовый статус). Доступно 1 раз в месяц.<br>
                <span style="color:#ff9500; font-weight:600;">Условие:</span> Нужно написать 100 сообщений на Твиче за активную сессию. Данные сбрасываются каждый день, пишите во время активного стрима.<br>
                <span style="color:#ff3b30; font-weight:600;">Внимание:</span> Те, кто выбрал Красную Таблетку, не могут запрашивать амнистию!
            </div>

            <div style="font-size: 16px; font-weight: 900; color: #fff; text-transform: uppercase; text-align: center; margin-top: 10px; margin-bottom: 5px; letter-spacing: 0.5px;">
                СТАТИСТИКА
            </div>

            <!-- Сообщения Twitch -->
            <div style="background: rgba(0,0,0,0.2); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); padding: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <div style="font-size: 12px; font-weight: 800; color: #fff; display: flex; align-items: center;">
                        <i class="fa-brands fa-twitch" style="color: #9146ff; width: 16px; text-align: center; margin-right: 6px;"></i> Сообщения (Twitch)
                    </div>
                    <div style="font-size: 12px; font-weight: 800; font-family: 'SF Mono', monospace; color: #fff;">${twMsgs} <span style="color:#666; font-size:9px;">/ 1500</span></div>
                </div>
                <div style="font-size: 10px; color: #aaa; line-height: 1.3;">
                    <span style="color:#888;">Формула: (Твои сообщения / 1500) * 40.</span>
                    <div style="margin-top: 5px; padding-top: 5px; border-top: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between;">
                        <span style="color:#FFD700; font-weight: 700;">Заработано: ${twMsgsPoints}</span>
                        <span style="color:#666; font-weight: 600;">Макс: 40</span>
                    </div>
                </div>
            </div>

            <!-- Время Twitch -->
            <div style="background: rgba(0,0,0,0.2); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); padding: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <div style="font-size: 12px; font-weight: 800; color: #fff; display: flex; align-items: center;">
                        <i class="fa-solid fa-clock" style="color: #9146ff; width: 16px; text-align: center; margin-right: 6px;"></i> Просмотр (Twitch)
                    </div>
                    <div style="font-size: 12px; font-weight: 800; font-family: 'SF Mono', monospace; color: #fff;">${twMins}м <span style="color:#666; font-size:9px;">/ 2400м</span></div>
                </div>
                <div style="font-size: 10px; color: #aaa; line-height: 1.3;">
                    <span style="color:#888;">Формула: (Твои минуты / 2400) * 40.</span>
                    <div style="margin-top: 5px; padding-top: 5px; border-top: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between;">
                        <span style="color:#FFD700; font-weight: 700;">Заработано: ${twMinsPoints}</span>
                        <span style="color:#666; font-weight: 600;">Макс: 40</span>
                    </div>
                </div>
            </div>

            <!-- Сообщения Telegram -->
            <div style="background: rgba(0,0,0,0.2); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); padding: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <div style="font-size: 12px; font-weight: 800; color: #fff; display: flex; align-items: center;">
                        <i class="fa-brands fa-telegram" style="color: #2AABEE; width: 16px; text-align: center; margin-right: 6px;"></i> Сообщения (TG)
                    </div>
                    <div style="font-size: 12px; font-weight: 800; font-family: 'SF Mono', monospace; color: #fff;">${tgMsgs} <span style="color:#666; font-size:9px;">/ 3500</span></div>
                </div>
                <div style="font-size: 10px; color: #aaa; line-height: 1.3;">
                    <span style="color:#888;">Формула: (Твои сообщения / 3500) * 80.</span>
                    <div style="margin-top: 5px; padding-top: 5px; border-top: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between;">
                        <span style="color:#FFD700; font-weight: 700;">Заработано: ${tgMsgsPoints}</span>
                        <span style="color:#666; font-weight: 600;">Макс: 80</span>
                    </div>
                </div>
            </div>

            <!-- Стрик -->
            <div style="background: rgba(0,0,0,0.2); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); padding: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <div style="font-size: 12px; font-weight: 800; color: #fff; display: flex; align-items: center;">
                        <i class="fa-solid fa-fire" style="color: #ff9500; width: 16px; text-align: center; margin-right: 6px;"></i> Гринд (Стрик)
                    </div>
                    <div style="font-size: 12px; font-weight: 800; font-family: 'SF Mono', monospace; color: #fff;">${streak} <span style="color:#666; font-size:9px;">дней</span></div>
                </div>
                <div style="font-size: 10px; color: #aaa; line-height: 1.3;">
                    За ежедневное посещение бота без пропусков.
                    <div style="margin-top: 5px; padding-top: 5px; border-top: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between;">
                        <span style="color:#FFD700; font-weight: 700;">Заработано: ${streakPoints}</span>
                        <span style="color:#666; font-weight: 600;">Без лимита</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    // 🔥 СЕТКА ИЗ ДВУХ КОМПАКТНЫХ КНОПОК 🔥
    let buttonsGridHtml = '';

    // 1. Кнопка Правил (всегда есть)
    const rulesBtn = `
        <div onclick="showTrustTooltip('Статистика и Правила', window.trustTooltipContent)" style="flex: 1; background: rgba(255,255,255,0.05); border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); padding: 12px 5px; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; transition: background 0.2s;">
            <i class="fa-solid fa-circle-question" style="color: #FFD700; font-size: 20px;"></i>
            <div style="font-size: 10px; font-weight: 800; color: #fff; text-transform: uppercase;">Правила</div>
        </div>
    `;

    // 2. Логика для второй кнопки (Амнистия) - Теперь кнопка ВСЕГДА выглядит одинаково красиво!
    let amnestyBtn = '';
    if (score < 35) {
        amnestyBtn = `
            <div onclick="handleAmnestyClick(${dailyTwitchMsgs}, ${messagesNeeded}, ${tookRedPill})" id="amnesty-trust-btn" style="flex: 1; background: linear-gradient(135deg, rgba(255, 59, 48, 0.15) 0%, rgba(255, 149, 0, 0.15) 100%); border: 1px solid rgba(255, 149, 0, 0.4); border-radius: 12px; padding: 12px 5px; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; transition: 0.2s;">
                <i class="fa-solid fa-handshake-angle" style="color: #ff9500; font-size: 20px;"></i>
                <div style="font-size: 10px; font-weight: 800; color: #fff; text-transform: uppercase;">Амнистия</div>
            </div>
        `;
    }

    // Собираем сетку (flex-контейнер)
    buttonsGridHtml = `
        <div style="display: flex; gap: 10px; width: 100%; margin-top: 15px; margin-bottom: 5px;">
            ${rulesBtn}
            ${amnestyBtn}
        </div>
    `;

    // Возвращаем твои оригинальные отступы и компактность (60vh)
    const html = `
        <div style="max-height: 60vh; overflow-y: auto; overflow-x: hidden; padding: 0 5px; text-align: center; color: #ddd; font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; flex-direction: column; align-items: center; gap: 4px; width: 100%; box-sizing: border-box;">
            
            <div style="font-size: 11px; color: #888; line-height: 1.3; width: 100%; text-align: center;">
Система поощряет активных зрителей.<br>Ваш уровень траста напрямую влияет на цены в магазине.
            </div>

            <div style="display: flex; justify-content: center; align-items: center; gap: 6px; font-size: 10px; line-height: 1; width: 100%;">
                <span style="color: #777; font-weight: 600;">СТАТУС:</span>
                <span style="color: ${levelColor}; font-weight: 800; text-transform: uppercase; background: ${levelColor}15; padding: 3px 6px; border-radius: 4px; border: 1px solid ${levelColor}40; letter-spacing: 0.5px;">${levelText}</span>
                <span style="color: #555;">•</span>
                <span style="color: #aaa; font-weight: 600;">${multiplierText}</span>
            </div>

            <div style="display: flex; align-items: flex-end; justify-content: center; line-height: 0.8;">
                <span style="font-size: 34px; font-weight: 900; color: ${levelColor}; font-family: 'SF Mono', Consolas, monospace; text-shadow: 0 0 12px ${levelColor}40; letter-spacing: -1px; margin: 0;">${score.toFixed(1)}</span>
                <span style="font-size: 11px; color: #666; font-weight: 700; margin-left: 3px; margin-bottom: 3px;">/ 100</span>
            </div>

            <div style="position: relative; width: 85%; margin-top: -20px; margin-bottom: 0;">
                <div style="position: absolute; top: 45px; left: ${percent}%; transform: translateX(-50%); color: #fff; font-size: 16px; z-index: 2; transition: left 0.4s ease; display: flex; justify-content: center; align-items: center; line-height: 1;">
                    <i class="fa-solid fa-caret-down"></i>
                </div>
                
                <div style="width: 100%; height: 6px; border-radius: 3px; background: linear-gradient(to right, #ff3b30 0%, #3a3a3c 30%, #3a3a3c 70%, #34c759 100%); box-shadow: 0 0 10px ${levelColor}40;"></div>
                
                <div style="position: relative; width: 100%; height: 10px; margin-top: -35px;">
                    <span style="position: absolute; top: 0; left: 0%; transform: translateX(-50%); color: #666; font-size: 10px; font-weight: 800; line-height: 1;">0</span>
                    <span style="position: absolute; top: 0; left: 30%; transform: translateX(-50%); color: #8e8e93; font-size: 10px; font-weight: 800; line-height: 1;">30</span>
                    <span style="position: absolute; top: 0; left: 70%; transform: translateX(-50%); color: #34c759; font-size: 10px; font-weight: 800; line-height: 1;">80</span>
                    <span style="position: absolute; top: 0; left: 100%; transform: translateX(-50%); color: #666; font-size: 10px; font-weight: 800; line-height: 1;">100</span>
                </div>
            </div>

            ${buttonsGridHtml}

        </div>
    `;
    
    showShopModal({
        title: `
            <div style="display:flex; justify-content:space-between; align-items:center; width:100%; font-size:15px; font-weight: 900; color: #fff; line-height: 1; letter-spacing: 0.5px;">
                ТРАСТ-ФАКТОР
                <i class="fa-solid fa-xmark" style="color:#8e8e93; font-size:16px; cursor:pointer; padding: 0 5px; transition: color 0.2s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#8e8e93'" onclick="document.querySelector('.custom-confirm-overlay').remove();"></i>
            </div>
        `,
        subtitle: html,
        confirmText: "ЗАКРЫТЬ",
        confirmClass: "btn-cancel-modal", 
        showCancel: false,
        onConfirm: (close) => close()
    });
};

// Функция вызова Амнистии
window.claimTrustAmnesty = async function() {
    customConfirm("Использовать Амнистию?\n\nТвои штрафы сгорят, а траст станет равен 35 (Базовый).\n\nЭту кнопку можно использовать только 1 раз в месяц!", async (ok) => {
        if (!ok) {
            // ФИКС БАГА: если окно закрылось при отмене, переоткрываем окно траста
            setTimeout(openTrustModal, 100);
            return;
        }
        
        const btn = document.getElementById('amnesty-trust-btn');
        if (btn) {
            btn.style.pointerEvents = 'none';
            btn.innerHTML = `
                <i class="fa-solid fa-spinner fa-spin" style="color: #ff9500; font-size: 20px;"></i>
                <div style="font-size: 10px; font-weight: 800; color: #fff; text-transform: uppercase;">Сбрасываем</div>
            `;
        }

        try {
            const res = await makeApiRequest('/api/v1/user/trust/amnesty', {}, 'POST');
            
            if (window.Telegram?.WebApp?.HapticFeedback) Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            
            // ТИХОЕ ОБНОВЛЕНИЕ ДАННЫХ ВМЕСТО РЕЛОАДА
            userData.trust_score = 35.0;
            userData.penalty_points = 0;
            refreshDataSilently(); // Фоново стягиваем свежие данные из БД
            
            // ФИКС БАГА: после успешной амнистии показываем алерт и переоткрываем окно с новыми цифрами
            customAlert("✅ Амнистия применена! Твой траст-фактор восстановлен до 35. Постарайся больше не падать в красную зону!", () => {
                setTimeout(openTrustModal, 100);
            });
            
        } catch (e) {
            if (btn) {
                btn.style.pointerEvents = 'auto';
                btn.innerHTML = `
                    <i class="fa-solid fa-handshake-angle" style="color: #ff9500; font-size: 20px;"></i>
                    <div style="font-size: 10px; font-weight: 800; color: #fff; text-transform: uppercase;">Амнистия</div>
                `;
            }
            // Вывод ошибки от бэкенда и возвращение окна траста
            customAlert("❌ " + (e.message || "Ошибка применения амнистии"), () => {
                setTimeout(openTrustModal, 100);
            });
        }
    });
};

// Глобальный флаг, чтобы окно не спамилось дублями
window.hasShownActivityWall = false;

window.showActivityWallModal = function(currentMsgs, requiredMsgs) {
    if (window.hasShownActivityWall || document.getElementById('activity-wall-modal')) return;
    window.hasShownActivityWall = true;

    if (typeof lockAppScroll === 'function') lockAppScroll(); 
    
    const overlay = document.createElement('div');
    overlay.id = 'activity-wall-modal';
    overlay.style.cssText = "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.85); z-index: 2147483647; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px); opacity: 0; transition: opacity 0.3s;";

    // Мега-список фактов, рофлов и сатиры про Твич, луркеров и HATElavka
    const facts = [
        "Факт: Шанс выбить нож выше, чем шанс увидеть твое сообщение в чате.",
        "Факт: Ниндзя позавидует твоей способности сидеть в тени стрима.",
        "Факт: HATElavka работает на энергии чата, а не на солнечных батареях.",
        "Факт: Если ты сейчас моргнешь — напиши об этом в чат, это уже актив!",
        "Факт: 50 сообщений пишутся быстрее, чем грузится катка в CS2.",
        "Факт: Пока ты молчишь, где-то грустит один невыбитый тайного качества скин.",
        "Факт: Самый дорогой лут падает тем, кто хотя бы здоровается в чате.",
        "Факт: В HATElavka нет скрытых комиссий, но есть налог на молчание.",
        "Факт: Стример питается твоими сообщениями. Не дай ему уйти в AFK!",
        "Факт: Твой актив в чате работает лучше, чем танец с бубном перед открытием кейса.",
        "Факт: Ученые выяснили, что луркеры на Твиче со временем эволюционируют в камни.",
        "Факт: Твоя клавиатура скоро покроется паутиной. Спасай ее — напиши в чат!",
        "Факт: Смайлики придумали специально для тех, кому лень писать слова. Пользуйся.",
        "Факт: По статистике, 90% зрителей придумывают идеальную шутку, но так и не отправляют её.",
        "Факт: Если бы за молчание на стриме давали сабки, ты бы уже был шейхом Твича.",
        "Факт: Твой ник в списке зрителей выглядит одиноко. Познакомь его с чатом.",
        "Факт: Чат летит так медленно, что можно успеть прочитать «Войну и мир». Исправляй.",
        "Факт: Стример не умеет читать мысли на расстоянии. Придется использовать клавиатуру.",
        "Факт: Если ты напишешь в чат, твой комп не взорвется. Мы проверяли.",
        "Факт: Быть луркером — это искусство. Но сегодня HATElavka спонсирует только ремесленников.",
        "Факт: Алгоритмы Твича начинают думать, что ты бот. Докажи обратное!",
        "Факт: Twitch Prime не освобождает от налога на актив в HATElavka.",
        "Факт: Легенда гласит, что за 10 000 сообщений можно получить модерку. (Спойлер: нет).",
        "Факт: Каждый раз, когда ты молчишь на стриме, где-то грустит один Каппа.",
        "Факт: Писать в чат полезно для мелкой моторики пальцев, особенно перед клатчем 1 в 3.",
        "Факт: Халява любит смелых. А смелые не стесняются писать в чат!",
        "Факт: Зрители делятся на два типа: те, кто делает контент в чате, и те, кто ждет халяву. Угадай, кто ты?",
        "Факт: В чате нет режима «инкогнито». Мы знаем, что ты здесь, луркер.",
        "Факт: Если написать «GG» в чат, твоя карма улучшится на 1%, а шанс дропа — на 0%. Но это не точно."
    ];
    const randomFact = facts[Math.floor(Math.random() * facts.length)];

    const percent = Math.min((currentMsgs / requiredMsgs) * 100, 100).toFixed(1);

    overlay.innerHTML = `
        <div class="custom-confirm-box" style="padding: 24px 20px; width: 90%; max-width: 350px; background: #1c1c1e; border-radius: 16px; border: 1px solid rgba(255, 215, 0, 0.3); text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.8);">
            
            <i class="fa-solid fa-lock" style="font-size:44px; color:#ffcc00; margin-bottom:15px; filter: drop-shadow(0 0 15px rgba(255, 204, 0, 0.4));"></i>
            <h3 style="color: #fff; font-size: 18px; margin-bottom: 10px; font-weight: 900; text-transform: uppercase;">Проекту нужен твой актив!</h3>
            
            <div style="font-size: 13px; color: #bbb; line-height: 1.5; text-align: left; margin-bottom: 20px;">
                Бюджет HATElavka не бесконечен. Сейчас покупки и выводы открыты <b>только для активного комьюнити</b>.<br><br>
                Чтобы разблокировать кейсы, прояви себя на стримах или в чате! Залетай и общайся.
            </div>

            <div style="background: rgba(0,0,0,0.4); padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); margin-bottom: 15px;">
                <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 800; color: #fff; margin-bottom: 8px;">
                    <span style="color: #aaa;">Мой актив за месяц</span>
                    <span style="color: #ffcc00;">${currentMsgs} / ${requiredMsgs}</span>
                </div>
                <div style="width: 100%; height: 8px; border-radius: 4px; background: rgba(0,0,0,0.6); overflow: hidden;">
                    <div style="height: 100%; width: ${percent}%; background: linear-gradient(90deg, #ff3b30, #ffcc00); border-radius: 4px; box-shadow: 0 0 10px rgba(255, 204, 0, 0.5);"></div>
                </div>
            </div>

            <div style="font-size: 13px; color: #e5e5ea; font-weight: 500; text-align: left; margin-bottom: 20px; background: rgba(255,255,255,0.08); padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
                <span style="color: #ffcc00; font-weight: 800; margin-right: 4px;">💡</span> ${randomFact}
            </div>

            <div style="display: flex; flex-direction: column; gap: 10px;">
                
                <!-- Блок с двумя кнопками (Twitch и Telegram) -->
                <div style="display: flex; gap: 10px; width: 100%;">
                    <button onclick="if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.openLink) { window.Telegram.WebApp.openLink('https://twitch.tv/hatelove_ttv'); } else { window.open('https://twitch.tv/hatelove_ttv', '_blank'); }" style="flex: 1; padding: 14px 10px; background: #9146ff; color: #fff; border: none; border-radius: 12px; font-weight: 800; font-size: 13px; text-transform: uppercase; cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 6px;">
                        <i class="fa-brands fa-twitch"></i> Twitch
                    </button>
                    
                    <button onclick="if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.openTelegramLink) { window.Telegram.WebApp.openTelegramLink('https://t.me/hatelovettv'); } else { window.open('https://t.me/hatelovettv', '_blank'); }" style="flex: 1; padding: 14px 10px; background: #2AABEE; color: #fff; border: none; border-radius: 12px; font-weight: 800; font-size: 13px; text-transform: uppercase; cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 6px;">
                        <i class="fa-brands fa-telegram"></i> Telegram
                    </button>
                </div>
                
                <button id="close-activity-wall-btn" style="width: 100%; padding: 14px; background: rgba(255,255,255,0.1); color: #fff; border: none; border-radius: 12px; font-weight: 700; text-transform: uppercase; cursor: pointer; transition: background 0.2s;">Понятно</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.style.opacity = '1');

    const closeBtn = overlay.querySelector('#close-activity-wall-btn');
    
    closeBtn.onmouseover = () => closeBtn.style.background = 'rgba(255,255,255,0.15)';
    closeBtn.onmouseout = () => closeBtn.style.background = 'rgba(255,255,255,0.1)';

    closeBtn.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation(); 
        overlay.style.opacity = '0';
        setTimeout(() => {
            overlay.remove();
            if (typeof unlockAppScroll === 'function') unlockAppScroll();
            window.hasShownActivityWall = false; 
        }, 300);
    };
};

// ================================================================
// ПОДСКАЗКА СВАЙПА ВПРАВО (ТОЛЬКО ДЛЯ ТЕЛЕФОНОВ)
// ================================================================
function initSwipeHint() {
    // 1. Проверяем, мобилка ли это. Если ПК - жестко отменяем.
    if (document.body.classList.contains('desktop-platform') || 
        document.body.classList.contains('desktop-mode') || 
        getPlatformType() === 'pc') return;

    // 2. Проверяем кэш (если юзер уже видел подсказку - не показываем)
    try { if (localStorage.getItem('swipe_hint_seen')) return; } catch(e) {}

    const toggleContainer = document.querySelector('.toggle-container');
    if (!toggleContainer) return;

    // 3. Создаем стили для плавной пульсирующей стрелочки вправо
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes swipe-right-anim {
            0% { transform: translateX(-4px); opacity: 0.4; }
            50% { transform: translateX(4px); opacity: 1; }
            100% { transform: translateX(-4px); opacity: 0.4; }
        }
        #swipe-hint-box i { 
            animation: swipe-right-anim 1.5s infinite ease-in-out; 
            color: #ffd700; 
            font-size: 12px; 
        }
    `;
    document.head.appendChild(style);

    // 4. Создаем саму надпись динамически
    const hintEl = document.createElement('div');
    hintEl.id = 'swipe-hint-box';
    hintEl.innerHTML = `<span>Свапни вправо для переключения</span> <i class="fa-solid fa-arrow-right-long"></i>`;
    hintEl.style.cssText = "text-align: center; font-size: 9px; color: #8e8e93; margin: -2px 0 12px 0; font-weight: 800; text-transform: uppercase; display: flex; align-items: center; justify-content: center; gap: 6px; transition: opacity 0.3s ease; opacity: 0; pointer-events: none;";

    // Вставляем ровно под тумблером (Главная | Кейсы | Игры)
    toggleContainer.parentNode.insertBefore(hintEl, toggleContainer.nextSibling);

    // Плавное появление через полсекунды
    requestAnimationFrame(() => { 
        setTimeout(() => { hintEl.style.opacity = '1'; }, 500); 
    });

    // 5. Логика мягкого скрытия с записью в кэш
    const hideHint = () => {
        if (hintEl.style.opacity === '0') return;
        hintEl.style.opacity = '0';
        setTimeout(() => { hintEl.remove(); style.remove(); }, 300);
        try { localStorage.setItem('swipe_hint_seen', 'true'); } catch(e) {}
    };

    // 6. Ловим любой горизонтальный свайп по экрану
    let startX = 0;
    document.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
    document.addEventListener('touchend', e => {
        // Если палец проехал больше 40 пикселей по горизонтали — прячем подсказку навсегда
        if (Math.abs(e.changedTouches[0].clientX - startX) > 40) hideHint();
    }, { passive: true });

    // Если человек не свайпнул, а просто тапнул пальцем по кнопке "Кейсы"
    const toggleWrapper = document.getElementById('mode-toggle');
    if (toggleWrapper) toggleWrapper.addEventListener('click', hideHint);
}

// ================================================================
// ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ (УНИВЕРСАЛЬНАЯ БРОНЯ)
// ================================================================
try {
    const bootEnv = detectEnvironmentSync();

    // 1. ИНИЦИАЛИЗАЦИЯ TELEGRAM (ТОЛЬКО если это реально приложение Telegram!)
    if (bootEnv.isTelegramApp && window.Telegram?.WebApp) {
        console.log("🤖 Инициализация Telegram SDK (Нативный режим)...");
        const tg = Telegram.WebApp;
        try { tg.ready(); } catch(e) {}
        try { tg.expand(); } catch(e) {}
        
        if (typeof tg.disableVerticalSwipes === 'function') {
            try { tg.disableVerticalSwipes(); } catch(e) {}
        }
        
        document.body.classList.remove('browser-mode');
        document.body.classList.add('tg-mode');

        const platform = bootEnv.osPlatform;
        if (platform === 'ios') document.body.classList.add('ios-mode');
        else if (platform === 'android' || platform === 'android_x') document.body.classList.add('android-mode');
        else document.body.classList.add('desktop-mode');

        if (bootEnv.deviceType === 'mobile' && tg.isVersionAtLeast && tg.isVersionAtLeast('6.1')) {
            if (typeof tg.requestFullscreen === 'function') {
                try { tg.requestFullscreen(); } catch (e) {}
            }
        }
    } 
    // 2. ИНИЦИАЛИЗАЦИЯ VK (только если флаг ВК активен)
    else if (bootEnv.isVkApp) {
        console.log("🚀 Инициализация VK SDK...");
        document.body.classList.add('vk-mode'); 
        if (typeof vkBridge !== 'undefined') {
            try { vkBridge.send('VKWebAppInit'); } catch(e) {}
        }
    }
    // 3. ИНИЦИАЛИЗАЦИЯ WEB-БРАУЗЕРА
    else {
        console.log("🌐 Инициализация Web-режима (Браузер)...");
        document.body.classList.add('browser-mode');
    }
    
    // 3. ОБЩИЙ ЗАПУСК ИНТЕРФЕЙСА (Работает везде)
    setupNewUI();
    initPullToRefresh();
    initBottomSwipe(); // Запускаем наш нижний свайп
    initSwipeTabs(); 
    initSwipeHint();   // <----- ДОБАВИТЬ ЭТУ СТРОЧКУ СЮДА

    // Запускаем основную логику загрузки данных
    main();

    // 4. ФОНОВЫЕ ПРОЦЕССЫ
    clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(() => { if (!document.hidden) refreshDataSilently(); }, 60000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshDataSilently(); });

} catch (e) { 
    console.error("Global init error", e); 
    
    // 🔥 БЕТОННЫЙ ЩИТ
    if (e.message === "Security Block" || e.message === "USER_BANNED") {
        if (dom.loaderOverlay) dom.loaderOverlay.classList.add('hidden');
    } else {
        customAlert("Критическая ошибка при запуске. Попробуйте перезагрузить приложение.");
    }
}
// ================================================================
// УМНЫЙ ФИЛЬТР КЕЙСОВ
// ================================================================
window.isSmartFilterActive = false;

window.toggleSmartFilter = () => {
    window.isSmartFilterActive = !window.isSmartFilterActive;
    
    const icon = document.getElementById('smart-filter-icon');
    const text = document.getElementById('smart-filter-text');
    const sw = document.getElementById('smart-filter-switch');
    const circle = sw.querySelector('.switch-circle');

    if (window.isSmartFilterActive) {
        // Включено (Зеленое)
        icon.style.color = '#34c759';
        text.style.color = '#34c759';
        sw.style.background = '#34c759';
        circle.style.left = '12px'; // Ползунок едет на 12px вместо 18px
        circle.style.background = '#fff';
    } else {
        // Выключено (Серое)
        icon.style.color = '#8e8e93';
        text.style.color = '#8e8e93';
        sw.style.background = 'rgba(255,255,255,0.1)';
        circle.style.left = '2px';
        circle.style.background = '#8e8e93';
    }

    if (window.Telegram?.WebApp?.HapticFeedback) Telegram.WebApp.HapticFeedback.selectionChanged();

    // 🔥 Даем ползунку отъехать (250мс), а затем обновляем сетку
    setTimeout(() => {
        if (typeof window.currentCategoryId !== 'undefined' && itemsCache[window.currentCategoryId]) {
            renderItems(itemsCache[window.currentCategoryId]);
        }
    }, 250);
};
