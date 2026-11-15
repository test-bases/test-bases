// =========================================================================
// 🛡️ 0. ГЛОБАЛЬНОЕ ЯДРО HATELAVKA: ЗАЩИТА АККАУНТА, ДЕДУПЛИКАЦИЯ И 0-МС RAM-КЭШ
// =========================================================================
(function initGlobalHatelavkaCore() {
    if (window.__hatelavkaCoreInitialized) return;
    window.__hatelavkaCoreInitialized = true;

    const ua = navigator.userAgent || navigator.vendor || window.opera || '';
    const hash = window.location.hash || '';
    const search = window.location.search || '';

    // 1. Уникальный Device ID (кэшируем в памяти, чтобы не дергать localStorage на каждый запрос)
    let cachedDeviceId = '';
    try {
        cachedDeviceId = localStorage.getItem('frontend_device_id') || '';
        if (!cachedDeviceId) {
            cachedDeviceId = typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : 'dev_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            localStorage.setItem('frontend_device_id', cachedDeviceId);
        }
    } catch (e) {}

    // 2. Перехват web_token после авторизации через Twitch на любой странице
    try {
        if (search.includes('web_token=')) {
            const urlParams = new URLSearchParams(search);
            const webToken = urlParams.get('web_token');
            if (webToken) {
                localStorage.setItem('tg_web_auth_token', webToken);
                localStorage.removeItem('cache_bootstrap');
                sessionStorage.removeItem('__hl_fast_api_cache__');
                sessionStorage.removeItem('rfl_fast_cache');
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        }
    } catch (e) {}

    // 3. Извлечение и бронирование initData в памяти и хранилищах
    let memoryInitData = '';
    function extractSavedInitData() {
        const liveTgData = window.Telegram?.WebApp?.initData || '';
        if (liveTgData) {
            memoryInitData = liveTgData;
        }

        if (!memoryInitData && hash.includes('tgWebAppData=')) {
            try {
                const hashParams = new URLSearchParams(hash.replace(/^#/, ''));
                memoryInitData = hashParams.get('tgWebAppData') || '';
            } catch (e) {}
        }

        if (!memoryInitData) {
            try {
                const rawInitParams = sessionStorage.getItem('__telegram__initParams');
                if (rawInitParams) {
                    const parsed = JSON.parse(rawInitParams);
                    if (parsed.tgWebAppData) memoryInitData = parsed.tgWebAppData;
                }
            } catch (e) {}
        }

        if (!memoryInitData) {
            try {
                memoryInitData = sessionStorage.getItem('hatelavka_tg_init_data')
                    || localStorage.getItem('hatelavka_tg_init_data_backup')
                    || '';
            } catch (e) {}
        }

        if (memoryInitData && !window.__hlInitDataPersisted) {
            window.__hlInitDataPersisted = true;
            try {
                sessionStorage.setItem('hatelavka_tg_init_data', memoryInitData);
                localStorage.setItem('hatelavka_tg_init_data_backup', memoryInitData);
                sessionStorage.setItem('hatelavka_is_tg_session', 'true');
                localStorage.setItem('hatelavka_ever_had_tg', 'true');

                if (!sessionStorage.getItem('__telegram__initParams')) {
                    sessionStorage.setItem('__telegram__initParams', JSON.stringify({
                        tgWebAppData: memoryInitData,
                        tgWebAppPlatform: (/iphone|ipad|ipod/i.test(ua) ? 'ios' : (/android/i.test(ua) ? 'android' : 'tdesktop'))
                    }));
                }
            } catch (e) {}
        }

        return memoryInitData;
    }

    // 4. Восстановление объекта user из initData или кэша бутстрапа
    function parseUserFromInitData(rawInitData) {
        try {
            if (rawInitData) {
                const params = new URLSearchParams(rawInitData);
                const userStr = params.get('user');
                if (userStr) return JSON.parse(userStr);
            }
        } catch (e) {}
        try {
            const cachedBoot = JSON.parse(localStorage.getItem('cache_bootstrap') || '{}');
            if (cachedBoot?.user && (cachedBoot.user.id || cachedBoot.user.telegram_id)) {
                return {
                    id: cachedBoot.user.telegram_id || cachedBoot.user.id,
                    first_name: cachedBoot.user.full_name || 'Игрок',
                    username: cachedBoot.user.username || '',
                    photo_url: cachedBoot.user.photo_url || ''
                };
            }
        } catch (e) {}
        return null;
    }

    const savedInitData = extractSavedInitData();
    const isVk = Boolean(window.isVk || search.includes('vk_app_id=') || search.includes('vk_user_id='));
    const hasNativeTgBridge = Boolean(
        typeof window.TelegramWebviewProxy !== 'undefined' ||
        typeof window.TelegramWebview !== 'undefined' ||
        typeof window.TelegramWebviewProxyProto !== 'undefined' ||
        (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.performAction) ||
        sessionStorage.getItem('hatelavka_is_tg_session') === 'true' ||
        (localStorage.getItem('hatelavka_ever_had_tg') === 'true' && /; wv\)/i.test(ua)) ||
        /Telegram/i.test(ua) ||
        (/Android.*(;\s*wv\)|Version\/\d+\.\d+\s+Chrome\/)/i.test(ua) && !isVk)
    );

    const isTelegramEnv = !isVk && (Boolean(savedInitData) || hasNativeTgBridge);
    const deviceType = (/android|ipad|iphone|ipod/i.test(ua)) ? 'mobile' : 'pc';
    const detectedPlatform = isTelegramEnv
        ? (/iphone|ipad|ipod/i.test(ua) ? 'ios' : (/android/i.test(ua) ? 'android' : 'tdesktop'))
        : 'web';

    // 5. Реанимация window.Telegram.WebApp (защита от 404 на /api/v1/telegram-js)
    if (!window.Telegram) window.Telegram = {};
    if (!window.Telegram.WebApp) {
        const parsedUser = parseUserFromInitData(savedInitData);
        window.Telegram.WebApp = {
            initData: savedInitData,
            initDataUnsafe: {
                user: parsedUser,
                start_param: new URLSearchParams(search).get('tgWebAppStartParam') || new URLSearchParams(search).get('startapp') || ''
            },
            platform: detectedPlatform,
            version: '7.0',
            isExpanded: true,
            ready: function() {},
            expand: function() {},
            close: function() { window.history.back(); },
            openLink: function(url) { window.open(url, '_blank'); },
            openTelegramLink: function(url) { window.location.href = url; },
            showAlert: function(msg) { alert(msg); },
            showPopup: function(params) { alert(params?.message || ''); },
            BackButton: { show: function() {}, hide: function() {}, onClick: function() {}, offClick: function() {} },
            HapticFeedback: {
                impactOccurred: function() {},
                notificationOccurred: function() {},
                selectionChanged: function() {}
            }
        };

        if (isTelegramEnv && !document.querySelector('script[src*="telegram.org/js/telegram-web-app.js"]')) {
            const s = document.createElement('script');
            s.src = 'https://telegram.org/js/telegram-web-app.js';
            s.async = true;
            document.head.appendChild(s);
        }
    } else {
        if (!window.Telegram.WebApp.initData && savedInitData) {
            try {
                Object.defineProperty(window.Telegram.WebApp, 'initData', {
                    get: () => extractSavedInitData() || savedInitData,
                    configurable: true
                });
            } catch (e) {
                window.Telegram.WebApp.initData = savedInitData;
            }
        }
        if (!window.Telegram.WebApp.initDataUnsafe?.user && savedInitData) {
            const parsedUser = parseUserFromInitData(savedInitData);
            if (parsedUser) {
                window.Telegram.WebApp.initDataUnsafe = {
                    ...(window.Telegram.WebApp.initDataUnsafe || {}),
                    user: parsedUser
                };
            }
        }
        if (isTelegramEnv && (!window.Telegram.WebApp.platform || window.Telegram.WebApp.platform === 'unknown')) {
            try {
                Object.defineProperty(window.Telegram.WebApp, 'platform', {
                    get: () => detectedPlatform,
                    configurable: true
                });
            } catch (e) {}
        }
    }

    // 6. Принудительная защита от browser-mode внутри Telegram
    if (isTelegramEnv) {
        const enforceTgMode = () => {
            if (document.body) {
                document.body.classList.remove('browser-mode');
                document.body.classList.add('tg-mode');
            }
            const strayWebModal = document.getElementById('web-auth-modal');
            if (strayWebModal) strayWebModal.remove();
        };
        if (document.body) enforceTgMode();
        else document.addEventListener('DOMContentLoaded', enforceTgMode, { once: true });
    }

    // 7. Глобальная функция получения авторизационного пэйлоада
    window.getGlobalAuthPayload = function() {
        const freshInitData = extractSavedInitData();
        if (isVk) {
            return { initData: window.vkParams || '', platform: 'vk', platform_type: deviceType };
        }
        if (isTelegramEnv || freshInitData) {
            return { initData: freshInitData, platform: 'tg', platform_type: deviceType };
        }
        return {
            initData: localStorage.getItem('tg_web_auth_token') || '',
            platform: 'web',
            platform_type: deviceType
        };
    };

    // =========================================================================
    // ⚡ 8. СВЕРХБЫСТРЫЙ RAM + SESSION КЭШ И ДЕДУПЛИКАЦИЯ ЗАПРОСОВ
    // =========================================================================
    const FAST_CACHE_KEY = '__hl_fast_api_cache__';
    const CACHE_TTL_MS = 30000; // 30 секунд мгновенной отдачи из RAM при переходах
    const ramCache = new Map();
    const inflightRequests = new Map();
    let syncTimer = null;
    let cacheEpoch = 0;

    // Делаем хранилище и сброс доступными глобально для всех страниц
    window.__hlFastCacheStore = ramCache;

    // При старте страницы 1 раз поднимаем кэш из sessionStorage в RAM Map
    try {
        const rawStore = sessionStorage.getItem(FAST_CACHE_KEY);
        if (rawStore) {
            const parsedStore = JSON.parse(rawStore);
            const now = Date.now();
            for (const [k, v] of Object.entries(parsedStore)) {
                if (v && (now - v.ts < CACHE_TTL_MS)) {
                    ramCache.set(k, v);
                }
            }
        }
    } catch (e) {}

    // Асинхронная запись RAM-кэша в sessionStorage без блокировки рендера
    function scheduleStorageSync() {
        if (syncTimer) return;
        syncTimer = setTimeout(() => {
            syncTimer = null;
            try {
                const obj = {};
                const now = Date.now();
                for (const [k, v] of ramCache.entries()) {
                    if (now - v.ts < CACHE_TTL_MS) {
                        obj[k] = v;
                    }
                }
                sessionStorage.setItem(FAST_CACHE_KEY, JSON.stringify(obj));
            } catch (e) {}
        }, 80);
    }

    function buildCacheKey(method, rawUrl, bodyObj) {
        try {
            const u = new URL(rawUrl, window.location.origin);
            u.searchParams.delete('initData');
            u.searchParams.delete('platform');
            u.searchParams.delete('platform_type');

            let bodyPart = '';
            if (bodyObj && typeof bodyObj === 'object') {
                const cleanBody = {};
                const keys = Object.keys(bodyObj).sort();
                for (let i = 0; i < keys.length; i++) {
                    const k = keys[i];
                    if (k !== 'initData' && k !== 'platform' && k !== 'platform_type') {
                        cleanBody[k] = bodyObj[k];
                    }
                }
                bodyPart = JSON.stringify(cleanBody);
            }
            return `${method}:${u.pathname}${u.search}:${bodyPart}`;
        } catch (e) {
            return `${method}:${rawUrl}`;
        }
    }

    function getFastCache(key) {
        const entry = ramCache.get(key);
        if (!entry) return null;
        if (Date.now() - entry.ts > CACHE_TTL_MS) {
            ramCache.delete(key);
            return null;
        }
        return entry.jsonText;
    }

    function setFastCacheRaw(key, jsonText, customTs) {
        if (!jsonText || typeof jsonText !== 'string') return;
        if (ramCache.size >= 35 && !ramCache.has(key)) {
            const oldestKey = ramCache.keys().next().value;
            if (oldestKey) ramCache.delete(oldestKey);
        }
        ramCache.set(key, { ts: customTs || Date.now(), jsonText: jsonText });
        scheduleStorageSync();
    }

    // Синхронизация свежих ответов /api/v1/user/me и /api/v1/raffles/active обратно в cache_bootstrap
    function syncEndpointToBootstrapStorage(lowerUrl, bodyText) {
        try {
            if (lowerUrl.includes('/api/v1/bootstrap')) {
                const parsedBoot = JSON.parse(bodyText);
                if (parsedBoot && typeof parsedBoot === 'object') {
                    parsedBoot._ts = Date.now();
                    localStorage.setItem('cache_bootstrap', JSON.stringify(parsedBoot));
                    seedFromBootstrapData(parsedBoot, true);
                }
            } else if (lowerUrl.includes('/api/v1/user/me')) {
                const parsedUser = JSON.parse(bodyText);
                if (parsedUser && typeof parsedUser === 'object' && (parsedUser.id || parsedUser.telegram_id || parsedUser.tickets !== undefined)) {
                    const existingBoot = JSON.parse(localStorage.getItem('cache_bootstrap') || '{}');
                    existingBoot.user = Object.assign({}, existingBoot.user || {}, parsedUser);
                    existingBoot._ts = Date.now();
                    localStorage.setItem('cache_bootstrap', JSON.stringify(existingBoot));

                    if (parsedUser.balance !== undefined || parsedUser.tickets !== undefined) {
                        const prevBal = JSON.parse(localStorage.getItem('smart_balance_cache') || '{}');
                        localStorage.setItem('smart_balance_cache', JSON.stringify({
                            balance: parsedUser.balance !== undefined ? parsedUser.balance : (prevBal.balance ?? 0),
                            tickets: parsedUser.tickets !== undefined ? parsedUser.tickets : (prevBal.tickets ?? 0)
                        }));
                    }
                }
            } else if (lowerUrl.includes('/api/v1/raffles/active')) {
                sessionStorage.setItem('rfl_fast_cache', bodyText);
                const parsedRaffles = JSON.parse(bodyText);
                if (Array.isArray(parsedRaffles)) {
                    const existingBoot = JSON.parse(localStorage.getItem('cache_bootstrap') || '{}');
                    existingBoot.raffles = parsedRaffles;
                    existingBoot._ts = Date.now();
                    localStorage.setItem('cache_bootstrap', JSON.stringify(existingBoot));
                }
            }
        } catch (e) {}
    }

    function clearFastCache() {
        cacheEpoch++;
        if (syncTimer) {
            clearTimeout(syncTimer);
            syncTimer = null;
        }
        ramCache.clear();
        inflightRequests.clear();
        try {
            sessionStorage.removeItem(FAST_CACHE_KEY);
            sessionStorage.removeItem('rfl_fast_cache');
            // Помечаем cache_bootstrap как устаревший для seedFromBootstrapData, сохраняя только базовую шапку
            const existingBoot = JSON.parse(localStorage.getItem('cache_bootstrap') || 'null');
            if (existingBoot && typeof existingBoot === 'object') {
                existingBoot._ts = 0;
                delete existingBoot.raffles;
                localStorage.setItem('cache_bootstrap', JSON.stringify(existingBoot));
            }
        } catch (e) {}
    }

    window.clearGlobalFastCache = clearFastCache;

    // Кросс-прогрев кэша из данных bootstrap (только если данные свежие и в ramCache еще нет более новых)
    function seedFromBootstrapData(bootData, forceOverwrite = false) {
        if (!bootData || typeof bootData !== 'object') return;
        const bootTs = Number(bootData._ts || 0);
        const now = Date.now();

        // Не засеваем RAM-кэш из старого localStorage при перезагрузке страницы
        if (!forceOverwrite && (!bootTs || (now - bootTs > CACHE_TTL_MS))) {
            return;
        }

        try {
            const userKey = 'POST:/api/v1/user/me:{}';
            const isFullUser = bootData.user && (
                bootData.user.id !== undefined ||
                bootData.user.telegram_id !== undefined ||
                bootData.user.has_raffles_premium !== undefined ||
                bootData.user.free_raffle_passes !== undefined
            );
            if (isFullUser && (forceOverwrite || !ramCache.has(userKey))) {
                const userJson = JSON.stringify(bootData.user);
                setFastCacheRaw(userKey, userJson, bootTs || now);
            }

            const rflKey = 'POST:/api/v1/raffles/active:{}';
            if (Array.isArray(bootData.raffles) && (forceOverwrite || !ramCache.has(rflKey))) {
                const rflJson = JSON.stringify(bootData.raffles);
                setFastCacheRaw(rflKey, rflJson, bootTs || now);
                try { sessionStorage.setItem('rfl_fast_cache', rflJson); } catch (e) {}
            }
        } catch (e) {}
    }

    // Если в localStorage есть свежий bootstrap (младше 30 сек) и ключей еще нет в ramCache — засеваем
    try {
        const existingBoot = JSON.parse(localStorage.getItem('cache_bootstrap') || 'null');
        if (existingBoot) seedFromBootstrapData(existingBoot, false);
    } catch (e) {}

    // Ключевые слова мутирующих запросов (сбрасывают кэш мгновенно)
    const MUTATION_KEYWORDS = [
        '/join', '/buy', '/claim', '/sell', '/withdraw', '/activate',
        '/choose', '/amnesty', '/save', '/create', '/confirm', '/delete',
        '/update', '/reset', '/check_code', '/execute', '/bid', '/bet',
        '/spin', '/open', '/upgrade', '/complete', '/start', '/submit'
    ];

    // Служебные запросы, которые никогда не кэшируются
    const NEVER_CACHE_KEYWORDS = [
        '/heartbeat', '/telegram-js', '/payment/', '/oauth',
        '/login', '/check_subscription', '/notifications/read', '/admin/'
    ];

    // 9. ГЛОБАЛЬНЫЙ ПЕРЕХВАТЧИК FETCH
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async function(input, init = {}) {
        let url = typeof input === 'string' ? input : (input?.url || '');

        const isInternalApi = (
            url.startsWith('/api/') ||
            url.includes(window.location.origin + '/api/') ||
            url.includes('api.hatelavka.online/api/')
        ) && !url.includes('supabase.co');

        if (!isInternalApi) {
            return nativeFetch(input, init);
        }

        let cacheKey = null;
        let isCacheableRead = false;
        const lowerUrl = url.toLowerCase();

        try {
            const auth = window.getGlobalAuthPayload();
            init.headers = Object.assign({}, init.headers || {}, {
                'X-Device-Id': cachedDeviceId
            });

            const method = (init.method || 'GET').toUpperCase();
            let parsedBodyObj = {};

            if (method === 'POST' || method === 'PUT') {
                if (typeof init.body === 'string' && init.body.trim().startsWith('{')) {
                    try { parsedBodyObj = JSON.parse(init.body); } catch (e) {}
                }
                if (!parsedBodyObj.initData && auth.initData) {
                    parsedBodyObj.initData = auth.initData;
                }
                if (!parsedBodyObj.platform) {
                    parsedBodyObj.platform = auth.platform;
                }
                if (!parsedBodyObj.platform_type) {
                    parsedBodyObj.platform_type = auth.platform_type;
                }
                init.body = JSON.stringify(parsedBodyObj);
            } else if (method === 'GET' && typeof input === 'string') {
                if (!url.includes('initData=') && auth.initData) {
                    const sep = url.includes('?') ? '&' : '?';
                    input = `${url}${sep}initData=${encodeURIComponent(auth.initData)}&platform=${encodeURIComponent(auth.platform)}&platform_type=${encodeURIComponent(auth.platform_type)}`;
                    url = input;
                }
            }

            const isMutation = MUTATION_KEYWORDS.some(k => lowerUrl.includes(k));
            const isExcluded = NEVER_CACHE_KEYWORDS.some(k => lowerUrl.includes(k));

            if (isMutation) {
                clearFastCache();
            } else if (!isExcluded && (method === 'GET' || method === 'POST')) {
                isCacheableRead = true;
                cacheKey = buildCacheKey(method, url, parsedBodyObj);

                // А) Отдача из RAM-кэша за 0 мс + фоновая ревалидация (если не передан __bypassFastCache)
                if (!init.__bypassFastCache) {
                    const cachedJsonText = getFastCache(cacheKey);
                    if (cachedJsonText !== null) {
                        if (!inflightRequests.has(cacheKey)) {
                            const reqEpoch = cacheEpoch;
                            const bgInit = Object.assign({}, init, { __bypassFastCache: true });
                            const bgPromise = nativeFetch(input, bgInit)
                                .then(async r => {
                                    if (r.ok && reqEpoch === cacheEpoch) {
                                        const text = await r.text();
                                        if (text && reqEpoch === cacheEpoch) {
                                            setFastCacheRaw(cacheKey, text);
                                            syncEndpointToBootstrapStorage(lowerUrl, text);
                                        }
                                    }
                                })
                                .catch(() => {})
                                .finally(() => inflightRequests.delete(cacheKey));
                            inflightRequests.set(cacheKey, bgPromise);
                        }

                        return new Response(cachedJsonText, {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' }
                        });
                    }

                    // Б) Склейка одновременных одинаковых запросов (Request Deduplication)
                    if (inflightRequests.has(cacheKey)) {
                        const sharedResult = await inflightRequests.get(cacheKey);
                        if (sharedResult && sharedResult.bodyText !== undefined) {
                            return new Response(sharedResult.bodyText, {
                                status: sharedResult.status,
                                headers: { 'Content-Type': 'application/json' }
                            });
                        }
                    }
                }
            }
        } catch (err) {
            console.warn('Fetch guard warning:', err);
        }

        // Выполняем сетевой запрос и ВСЕГДА обновляем кэш свежим ответом (даже при __bypassFastCache: true)
        if (isCacheableRead && cacheKey) {
            const reqEpoch = cacheEpoch;
            const networkPromise = (async () => {
                const fetchInit = init.__bypassFastCache
                    ? Object.assign({}, init, { cache: 'no-store' })
                    : init;
                const res = await nativeFetch(input, fetchInit);
                const bodyText = await res.text();
                if (res.ok && bodyText && (init.__bypassFastCache || reqEpoch === cacheEpoch)) {
                    setFastCacheRaw(cacheKey, bodyText);
                    syncEndpointToBootstrapStorage(lowerUrl, bodyText);
                }
                return { status: res.status, bodyText };
            })();

            if (!init.__bypassFastCache) {
                inflightRequests.set(cacheKey, networkPromise);
            }
            try {
                const result = await networkPromise;
                return new Response(result.bodyText, {
                    status: result.status,
                    headers: { 'Content-Type': 'application/json' }
                });
            } finally {
                if (!init.__bypassFastCache) {
                    inflightRequests.delete(cacheKey);
                }
            }
        }

        return nativeFetch(input, init);
    };
})();


// =========================================================================
// 🎨 1. НАВИГАЦИОННЫЙ БАР, ИГРОВОЙ СТАТУС И ДВИЖОК МГНОВЕННЫХ ПЕРЕХОДОВ
// =========================================================================
(function initBottomNavAndPrewarmer() {
    function mountBottomNav() {
        // Защита от повторного рендера
        if (document.querySelector('.floating-bottom-bar')) return;

        let androidPadding = "0px";
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.platform === 'android') {
            androidPadding = "25px";
        }

        // 1. Подключение шрифта Montserrat
        if (!document.querySelector('link[href*="Montserrat"]')) {
            const fontLink = document.createElement('link');
            fontLink.rel = 'stylesheet';
            fontLink.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;900&display=swap';
            document.head.appendChild(fontLink);
        }

        // 2. Стили нижнего меню
        const style = document.createElement('style');
        style.innerHTML = `
            .floating-bottom-bar,
            .floating-bottom-bar span,
            .floating-bottom-bar .comic-badge {
                font-family: 'Montserrat', sans-serif !important;
            }

            .bottom-fade-shadow {
                position: fixed;
                bottom: 0;
                left: 0;
                width: 100%;
                height: calc(110px + ${androidPadding});
                background: linear-gradient(to top, rgba(5, 5, 5, 0.9) 0%, rgba(5, 5, 5, 0.5) 45%, rgba(5, 5, 5, 0) 100%);
                pointer-events: none;
                z-index: 998;
            }

            .floating-bottom-bar {
                position: fixed;
                bottom: calc(15px + ${androidPadding});
                left: 50vw;
                transform: translateX(-50%);
                width: 85vw;
                max-width: 360px;
                box-sizing: border-box;
                background: rgba(40, 40, 40, 0.95);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 35px;
                display: flex;
                justify-content: space-around;
                align-items: center;
                padding: 6px 12px;
                z-index: 1000;
            }

            @supports (backdrop-filter: blur(20px)) or (-webkit-backdrop-filter: blur(20px)) {
                .floating-bottom-bar {
                    background: rgba(25, 25, 28, 0.65);
                    backdrop-filter: blur(25px) saturate(150%);
                    -webkit-backdrop-filter: blur(25px) saturate(150%);
                    border-top: 1px solid rgba(255, 255, 255, 0.15);
                }
            }

            .nav-item {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: #8E8E93;
                text-decoration: none;
                gap: 2px;
                padding: 6px 10px;
                border-radius: 20px;
                transition: all 0.2s ease;
                position: relative;
                -webkit-tap-highlight-color: transparent;
                user-select: none;
            }

            .nav-item i { font-size: 18px; transition: all 0.2s ease; }
            .nav-item span { font-size: 9px; font-weight: 600; transition: all 0.2s ease; }
            .nav-item.active { background: transparent; color: #FFFFFF; }

            .comic-badge {
                position: absolute;
                top: -26px;
                left: 50%;
                transform: translateX(-50%);
                background: linear-gradient(135deg, #ff3b30, #ff4d4d);
                color: #fff;
                font-size: 7px;
                font-weight: 900;
                text-transform: uppercase;
                padding: 4px 6px;
                border-radius: 6px;
                line-height: 1.1;
                text-align: center;
                white-space: nowrap;
                border: 1px solid #cc0000;
                pointer-events: none;
                opacity: 0;
                visibility: hidden;
                transition: opacity 0.3s ease, transform 0.3s ease;
                animation: comicPulse 1.5s infinite ease-in-out;
                z-index: 10;
            }

            .comic-badge::after {
                content: '';
                position: absolute;
                bottom: -4px;
                left: 50%;
                transform: translateX(-50%);
                border-width: 5px 5px 0;
                border-style: solid;
                border-color: #ff3b30 transparent transparent transparent;
            }

            @keyframes comicPulse {
                0% { transform: translateX(-50%) scale(1) rotate(-2deg); }
                50% { transform: translateX(-50%) scale(1.05) rotate(2deg); }
                100% { transform: translateX(-50%) scale(1) rotate(-2deg); }
            }

            .nav-item.game-live .comic-badge {
                opacity: 1;
                visibility: visible;
            }

            .nav-item.game-live i {
                color: #ff4d4d !important;
                filter: drop-shadow(0 0 10px rgba(255, 77, 77, 0.8));
                animation: shakeIcon 2s infinite;
            }

            .nav-item.game-live span {
                color: #ff4d4d !important;
                font-weight: 900;
                text-shadow: 0 0 5px rgba(255, 77, 77, 0.4);
            }

            @keyframes shakeIcon {
                0% { transform: rotate(0deg); }
                10% { transform: rotate(-10deg); }
                20% { transform: rotate(10deg); }
                30% { transform: rotate(-10deg); }
                40% { transform: rotate(10deg); }
                50% { transform: rotate(0deg); }
                100% { transform: rotate(0deg); }
            }
        `;
        document.head.appendChild(style);

        // 3. Мгновенно проверяем закэшированный статус игры, чтобы бейдж не мигал при переходах
        const isCachedGameLive = sessionStorage.getItem('__hl_game_live__') === '1';

        const navHTML = `
            <div class="bottom-fade-shadow"></div>
            <nav class="floating-bottom-bar">
                <a href="/leaderboard" class="nav-item" data-path="leaderboard">
                    <i class="fa-solid fa-trophy"></i><span>Топ</span>
                </a>
                <a href="/quests" class="nav-item" data-path="quests">
                    <i class="fa-solid fa-check-double"></i><span>Задания</span>
                </a>
                <a href="/" class="nav-item" data-path="/">
                    <i class="fa-solid fa-house"></i><span>Главная</span>
                </a>
                <a href="/events" class="nav-item" data-path="events">
                    <i class="fa-solid fa-fire"></i><span>Гринд</span>
                </a>
                <a href="/event_page.html" class="nav-item ${isCachedGameLive ? 'game-live' : ''}" data-path="event_page" id="nav-games-btn">
                    <div class="comic-badge">ИГРА<br>НАЧАЛАСЬ</div>
                    <i class="fa-solid fa-gamepad"></i><span>Игры</span>
                </a>
            </nav>
        `;
        document.body.insertAdjacentHTML('beforeend', navHTML);

        // 4. Подсветка активной вкладки и мгновенный отклик
        let currentPath = window.location.pathname.replace('.html', '');
        if (currentPath === '/menu' || currentPath === '' || currentPath === '/index') {
            currentPath = '/';
        }

        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.classList.remove('active');
            const dataPath = item.getAttribute('data-path');
            const isCurrentTab = (dataPath === '/' && currentPath === '/') || (dataPath !== '/' && currentPath.includes(dataPath));

            if (isCurrentTab) {
                item.classList.add('active');
            }

            item.addEventListener('pointerdown', () => {
                navItems.forEach(n => n.classList.remove('active'));
                item.classList.add('active');
                if (window.Telegram?.WebApp?.HapticFeedback) {
                    try { window.Telegram.WebApp.HapticFeedback.selectionChanged(); } catch (e) {}
                }
            });

            // Защита от лишней перезагрузки, если юзер нажал на уже открытую вкладку
            item.addEventListener('click', (e) => {
                if (isCurrentTab) {
                    e.preventDefault();
                    const mainScroll = document.getElementById('main-content');
                    if (mainScroll) mainScroll.scrollTo({ top: 0, behavior: 'smooth' });
                }
            });
        });

        // 5. Оптимизированная проверка статуса игры в Supabase (с троттлингом между переходами и паузой в фоне)
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5ZXVja2pjcnNpYXNleXFyc2VrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0NzEyOTgsImV4cCI6MjA3MDA0NzI5OH0.srRwuUygiF7jr3-b2AwyRNAmrChlW3Bzp3I-9Ju2TVg';
        const sbHeaders = {
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_KEY
        };

        const checkGameStatus = async (force = false) => {
            if (document.hidden) return;
            try {
                const lastCheck = parseInt(sessionStorage.getItem('__hl_game_check_ts__') || '0', 10);
                if (!force && (Date.now() - lastCheck < 8000)) return;
                sessionStorage.setItem('__hl_game_check_ts__', String(Date.now()));

                const [guessRes, settingsRes] = await Promise.all([
                    fetch('https://pyeuckjcrsiaseyqrsek.supabase.co/rest/v1/guess_state?id=eq.1&select=is_active', { headers: sbHeaders }),
                    fetch('https://pyeuckjcrsiaseyqrsek.supabase.co/rest/v1/settings?key=in.(twitch_status_883996654,twitch_status_755238101)&select=value', { headers: sbHeaders })
                ]);

                if (!guessRes.ok || !settingsRes.ok) return;

                const guessData = await guessRes.json();
                const settingsData = await settingsRes.json();
                const gamesBtn = document.getElementById('nav-games-btn');

                if (gamesBtn && Array.isArray(guessData) && guessData.length > 0) {
                    const isStreamOnline = Array.isArray(settingsData) && settingsData.some(s => s.value === true || s.value === 'true');
                    const isLive = Boolean(guessData[0].is_active && isStreamOnline);

                    sessionStorage.setItem('__hl_game_live__', isLive ? '1' : '0');
                    if (isLive) {
                        gamesBtn.classList.add('game-live');
                    } else {
                        gamesBtn.classList.remove('game-live');
                    }
                }
            } catch (e) {}
        };

        checkGameStatus(false);
        setInterval(() => checkGameStatus(true), 12000);

        // =========================================================================
        // 🚀 6. ДВИЖОК 0-МС PRERENDER + ФОНОВЫЙ ПРОГРЕВ ВСЕХ СТРАНИЦ И API
        // =========================================================================
        const allCoreUrls = [
            '/',
            '/leaderboard',
            '/quests',
            '/events',
            '/event_page.html',
            '/raffles',
            '/auction',
            '/profile',
            '/checkpoint'
        ];

        // А) Нативный Chromium Speculation Rules (без prerender для страниц с частыми мутациями)
        if (HTMLScriptElement.supports && HTMLScriptElement.supports('speculationrules')) {
            try {
                const specScript = document.createElement('script');
                specScript.type = 'speculationrules';
                specScript.textContent = JSON.stringify({
                    prefetch: [{
                        source: 'list',
                        urls: allCoreUrls,
                        eagerness: 'moderate'
                    }]
                });
                document.head.appendChild(specScript);
            } catch (e) {}
        }

        // Б) Мгновенная подгрузка любой внутренней ссылки при касании пальцем (до события click)
        const prefetchedLinks = new Set();
        document.body.addEventListener('pointerdown', (e) => {
            const linkEl = e.target.closest('a[href]');
            if (!linkEl) return;
            const href = linkEl.getAttribute('href');
            if (!href || !href.startsWith('/') || href.startsWith('//') || prefetchedLinks.has(href)) return;
            prefetchedLinks.add(href);

            const l = document.createElement('link');
            l.rel = 'prefetch';
            l.href = href;
            l.as = 'document';
            document.head.appendChild(l);
        }, { passive: true });

        // В) Фоновый прогрев HTML и API-данных всех разделов после отрисовки стартового экрана
        function runBackgroundPrewarm() {
            if (sessionStorage.getItem('__hl_prewarm_done__') === '1') return;
            sessionStorage.setItem('__hl_prewarm_done__', '1');

            allCoreUrls.forEach((url, i) => {
                if (window.location.pathname === url) return;
                setTimeout(() => {
                    prefetchedLinks.add(url);
                    const link = document.createElement('link');
                    link.rel = 'prefetch';
                    link.href = url;
                    link.as = 'document';
                    document.head.appendChild(link);
                }, i * 90);
            });

            const auth = window.getGlobalAuthPayload ? window.getGlobalAuthPayload() : { initData: '' };
            if (auth.initData) {
                const runIdle = window.requestIdleCallback || ((cb) => setTimeout(cb, 250));
                runIdle(() => {
                    const postOpts = {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(auth)
                    };
                    fetch('/api/v1/user/me', postOpts).catch(() => {});
                    fetch('/api/v1/raffles/active', postOpts).catch(() => {});
                    if (currentPath !== '/') {
                        fetch('/api/v1/bootstrap', postOpts).catch(() => {});
                    }
                });
            }
        }

        if (document.readyState === 'complete') {
            setTimeout(runBackgroundPrewarm, 200);
        } else {
            window.addEventListener('load', () => setTimeout(runBackgroundPrewarm, 200), { once: true });
        }
    }

    // Надежный запуск независимо от того, подключен скрипт с defer или без него
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountBottomNav, { once: true });
    } else {
        mountBottomNav();
    }
})();
