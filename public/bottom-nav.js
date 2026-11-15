// =========================================================================
// 🛡️ 0. ГЛОБАЛЬНЫЙ ЩИТ АККАУНТА, АВТОРИЗАЦИИ И МОСТОВ TELEGRAM (0 МС)
// =========================================================================
(function initGlobalHatelavkaCore() {
    if (window.__hatelavkaCoreInitialized) return;
    window.__hatelavkaCoreInitialized = true;

    const ua = navigator.userAgent || navigator.vendor || window.opera || '';
    const hash = window.location.hash || '';
    const search = window.location.search || '';

    // 1. Гарантируем наличие уникального Device ID на любой странице
    try {
        if (!localStorage.getItem('frontend_device_id')) {
            const uuid = typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : 'dev_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            localStorage.setItem('frontend_device_id', uuid);
        }
    } catch (e) {}

    // 2. Перехватываем web_token после входа через Twitch на любой странице
    try {
        const urlParams = new URLSearchParams(search);
        const webToken = urlParams.get('web_token');
        if (webToken) {
            localStorage.setItem('tg_web_auth_token', webToken);
            localStorage.removeItem('cache_bootstrap');
            sessionStorage.removeItem('__hl_fast_api_cache__');
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    } catch (e) {}

    // 3. Вытаскиваем и бронируем initData из всех доступных источников
    function extractSavedInitData() {
        let data = window.Telegram?.WebApp?.initData || '';

        if (!data && hash.includes('tgWebAppData=')) {
            try {
                const hashParams = new URLSearchParams(hash.replace(/^#/, ''));
                data = hashParams.get('tgWebAppData') || '';
            } catch (e) {}
        }

        if (!data) {
            try {
                const rawInitParams = sessionStorage.getItem('__telegram__initParams');
                if (rawInitParams) {
                    const parsed = JSON.parse(rawInitParams);
                    if (parsed.tgWebAppData) data = parsed.tgWebAppData;
                }
            } catch (e) {}
        }

        if (!data) {
            try {
                data = sessionStorage.getItem('hatelavka_tg_init_data')
                    || localStorage.getItem('hatelavka_tg_init_data_backup')
                    || '';
            } catch (e) {}
        }

        // Если нашли живой initData — сохраняем во все резервные хранилища
        if (data) {
            try {
                sessionStorage.setItem('hatelavka_tg_init_data', data);
                localStorage.setItem('hatelavka_tg_init_data_backup', data);
                sessionStorage.setItem('hatelavka_is_tg_session', 'true');
                localStorage.setItem('hatelavka_ever_had_tg', 'true');

                if (!sessionStorage.getItem('__telegram__initParams')) {
                    sessionStorage.setItem('__telegram__initParams', JSON.stringify({
                        tgWebAppData: data,
                        tgWebAppPlatform: (/iphone|ipad|ipod/i.test(ua) ? 'ios' : (/android/i.test(ua) ? 'android' : 'tdesktop'))
                    }));
                }
            } catch (e) {}
        }

        return data;
    }

    // 4. Восстанавливаем объект user из строки initData или кэша бутстрапа
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
            if (cachedBoot?.user) {
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

    // 5. РЕАНИМАЦИЯ window.Telegram.WebApp (Если /api/v1/telegram-js отдал 404 Not Found)
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

        // Если скрипт не загрузился из-за 404 на /api/v1/telegram-js — подгружаем официальный SDK
        if (isTelegramEnv && !document.querySelector('script[src*="telegram.org/js/telegram-web-app.js"]')) {
            const s = document.createElement('script');
            s.src = 'https://telegram.org/js/telegram-web-app.js';
            s.async = true;
            document.head.appendChild(s);
        }
    } else {
        // Если SDK есть, но потерял initData или platform при переходе между страницами — возвращаем!
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

    // 6. Защита от ложного включения browser-mode внутри Telegram
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
        else document.addEventListener('DOMContentLoaded', enforceTgMode);
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

    // 8. БЫСТРЫЙ КЭШ API В ПАМЯТИ (0 МС ОТКРЫТИЕ ВКЛАДОК)
    const FAST_CACHE_KEY = '__hl_fast_api_cache__';
    const CACHE_TTL_MS = 20000; // 20 секунд мгновенной отдачи при переходах

    function getFastCache(urlKey) {
        try {
            const store = JSON.parse(sessionStorage.getItem(FAST_CACHE_KEY) || '{}');
            const entry = store[urlKey];
            if (entry && (Date.now() - entry.ts < CACHE_TTL_MS)) {
                return entry.data;
            }
        } catch (e) {}
        return null;
    }

    function setFastCache(urlKey, data) {
        try {
            const store = JSON.parse(sessionStorage.getItem(FAST_CACHE_KEY) || '{}');
            store[urlKey] = { ts: Date.now(), data: data };
            sessionStorage.setItem(FAST_CACHE_KEY, JSON.stringify(store));
        } catch (e) {}
    }

    function clearFastCache() {
        try { sessionStorage.removeItem(FAST_CACHE_KEY); } catch (e) {}
    }

    // Список мутирующих действий, которые сбрасывают кэш, чтобы баланс и статусы обновлялись сразу
    const MUTATION_KEYWORDS = [
        '/join', '/buy', '/claim', '/sell', '/withdraw', '/activate',
        '/choose', '/amnesty', '/save', '/create', '/confirm', '/delete',
        '/read', '/update', '/reset', '/check_code', '/execute'
    ];

    // Список эндпоинтов чтения, которые можно отдавать за 0 мс при переходе по вкладкам
    const READ_CACHEABLE_ENDPOINTS = [
        '/api/v1/user/me',
        '/api/v1/raffles/active',
        '/api/v1/bootstrap',
        '/api/v1/stats/general',
        '/api/v1/schedule/get'
    ];

    // 9. ГЛОБАЛЬНЫЙ ПЕРЕХВАТЧИК FETCH (АВТО-ПОДПИСЬ ЗАПРОСОВ И 0 МС КЭШ)
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async function(input, init = {}) {
        let url = typeof input === 'string' ? input : (input?.url || '');

        // Проверяем, что это запрос к нашему бэкенду (НЕ трогаем Supabase и внешние API)
        const isInternalApi = (
            url.startsWith('/api/') ||
            url.includes(window.location.origin + '/api/') ||
            url.includes('api.hatelavka.online/api/')
        ) && !url.includes('supabase.co');

        if (isInternalApi) {
            try {
                const auth = window.getGlobalAuthPayload();
                const deviceId = localStorage.getItem('frontend_device_id') || '';

                init.headers = Object.assign({}, init.headers || {}, {
                    'X-Device-Id': deviceId
                });

                const method = (init.method || 'GET').toUpperCase();

                if (method === 'POST' || method === 'PUT') {
                    let bodyObj = {};
                    if (typeof init.body === 'string' && init.body.trim().startsWith('{')) {
                        try { bodyObj = JSON.parse(init.body); } catch (e) {}
                    }
                    // Если страница отправила пустой initData — автоматически вшиваем наш сохранённый!
                    if (!bodyObj.initData && auth.initData) {
                        bodyObj.initData = auth.initData;
                    }
                    if (!bodyObj.platform) {
                        bodyObj.platform = auth.platform;
                    }
                    if (!bodyObj.platform_type) {
                        bodyObj.platform_type = auth.platform_type;
                    }
                    init.body = JSON.stringify(bodyObj);
                } else if (method === 'GET' && typeof input === 'string') {
                    if (!url.includes('initData=') && auth.initData) {
                        const sep = url.includes('?') ? '&' : '?';
                        input = `${url}${sep}initData=${encodeURIComponent(auth.initData)}&platform=${encodeURIComponent(auth.platform)}&platform_type=${encodeURIComponent(auth.platform_type)}`;
                        url = input;
                    }
                }

                // Если это действие игрока (покупка, вход в розыгрыш, вывод) — сбрасываем быстрый кэш
                if (MUTATION_KEYWORDS.some(k => url.includes(k))) {
                    clearFastCache();
                } else {
                    // Проверяем, можно ли отдать мгновенный ответ из прогретого кэша (0 мс)
                    const matchedEndpoint = READ_CACHEABLE_ENDPOINTS.find(ep => url.includes(ep));
                    if (matchedEndpoint && !init.__bypassFastCache) {
                        const cachedData = getFastCache(matchedEndpoint);
                        if (cachedData) {
                            // Фоном тихо обновляем кэш для следующего раза (Stale-While-Revalidate)
                            const bgInit = Object.assign({}, init, { __bypassFastCache: true });
                            nativeFetch(input, bgInit)
                                .then(r => r.ok ? r.json() : null)
                                .then(fresh => {
                                    if (fresh) {
                                        setFastCache(matchedEndpoint, fresh);
                                        if (matchedEndpoint === '/api/v1/raffles/active' && Array.isArray(fresh)) {
                                            try { sessionStorage.setItem('rfl_fast_cache', JSON.stringify(fresh)); } catch (e) {}
                                        }
                                    }
                                })
                                .catch(() => {});

                            // Возвращаем ответ за 0 мс без ожидания сети!
                            return new Response(JSON.stringify(cachedData), {
                                status: 200,
                                headers: { 'Content-Type': 'application/json' }
                            });
                        }
                    }
                }
            } catch (err) {
                console.warn('Fetch guard warning:', err);
            }
        }

        const response = await nativeFetch(input, init);

        // Сохраняем свежие ответы в быстрый кэш
        if (isInternalApi && response.ok) {
            const matchedEndpoint = READ_CACHEABLE_ENDPOINTS.find(ep => url.includes(ep));
            if (matchedEndpoint) {
                response.clone().json().then(data => {
                    if (data) {
                        setFastCache(matchedEndpoint, data);
                        if (matchedEndpoint === '/api/v1/raffles/active' && Array.isArray(data)) {
                            try { sessionStorage.setItem('rfl_fast_cache', JSON.stringify(data)); } catch (e) {}
                        }
                        if (matchedEndpoint === '/api/v1/bootstrap' && data.raffles) {
                            setFastCache('/api/v1/raffles/active', data.raffles);
                            if (data.user) setFastCache('/api/v1/user/me', data.user);
                            try { sessionStorage.setItem('rfl_fast_cache', JSON.stringify(data.raffles)); } catch (e) {}
                        }
                    }
                }).catch(() => {});
            }
        }

        return response;
    };
})();


// =========================================================================
// 🎨 ТВОЙ ОРИГИНАЛЬНЫЙ КОД НИЖНЕГО МЕНЮ + МГНОВЕННЫЙ ОТКЛИК
// =========================================================================
document.addEventListener("DOMContentLoaded", () => {
    // 🔥 ОПРЕДЕЛЯЕМ ПЛАТФОРМУ 🔥
    // На андроиде делаем отступ в 14px, чтобы поднять над системными кнопками
    let androidPadding = "0px";
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.platform === 'android') {
        androidPadding = "25px"; 
    }

    // 1. Надежное подключение шрифта (если его еще нет на странице)
    if (!document.querySelector('link[href*="Montserrat"]')) {
        const fontLink = document.createElement('link');
        fontLink.rel = 'stylesheet';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;900&display=swap';
        document.head.appendChild(fontLink);
    }

    // 2. Вставляем стили
    const style = document.createElement('style');
    style.innerHTML = `
        /* 🔥 ИЗОЛЯЦИЯ ШРИФТА ТОЛЬКО ДЛЯ ТЕКСТА 🔥 */
        /* Применяем Montserrat только к самому бару и текстовым блокам, НЕ трогая <i> с иконками */
        .floating-bottom-bar,
        .floating-bottom-bar span,
        .floating-bottom-bar .comic-badge {
            font-family: 'Montserrat', sans-serif !important;
        }

        /* --- ПЛАВНАЯ ТЕНЬ ПОД НИЖНИМ БАРОМ --- */
        .bottom-fade-shadow {
            position: fixed;
            bottom: 0;
            left: 0;
            width: 100%;
            height: calc(110px + ${androidPadding}); /* Учитываем паддинг андроида */
            /* Аккуратный градиент, чтобы не было "прям темени" */
            background: linear-gradient(to top, rgba(5, 5, 5, 0.9) 0%, rgba(5, 5, 5, 0.5) 45%, rgba(5, 5, 5, 0) 100%);
            pointer-events: none; /* КРИТИЧЕСКИ ВАЖНО: пропускает клики сквозь себя на карточки */
            z-index: 998; /* Ставим прямо под навигационным баром */
        }

        .floating-bottom-bar {
            /* 🔥 ЖЕЛЕЗОБЕТОННАЯ ШИРИНА И ЦЕНТРОВКА (Игнорирует скроллбар) 🔥 */
            position: fixed; 
            bottom: calc(15px + ${androidPadding}); 
            left: 50vw; 
            transform: translateX(-50%); 
            width: 85vw; 
            max-width: 360px;
            box-sizing: border-box;

            /* БАЗОВЫЙ ФОН ДЛЯ СТАРЫХ/СЛАБЫХ УСТРОЙСТВ */
            background: rgba(40, 40, 40, 0.95); 
            border: 1px solid rgba(255, 255, 255, 0.1); 
            border-radius: 35px; 
            /* Тень полностью убрана */
            display: flex; justify-content: space-around; align-items: center; 
            padding: 6px 12px; z-index: 1000;
        }

        /* 🔥 СОЧНЫЙ ЭФФЕКТ СТЕКЛА ТОЛЬКО ДЛЯ НОВЫХ УСТРОЙСТВ 🔥 */
        @supports (backdrop-filter: blur(20px)) or (-webkit-backdrop-filter: blur(20px)) {
            .floating-bottom-bar {
                background: rgba(25, 25, 28, 0.65); /* Больше прозрачности, чтобы блюр было видно */
                backdrop-filter: blur(25px) saturate(150%);
                -webkit-backdrop-filter: blur(25px) saturate(150%);
                border-top: 1px solid rgba(255, 255, 255, 0.15); /* Легкий блик света сверху */
            }
        }
        
        .nav-item { 
            display: flex; flex-direction: column; align-items: center; justify-content: center; 
            color: #8E8E93; text-decoration: none; gap: 2px; padding: 6px 10px; 
            border-radius: 20px; transition: all 0.3s ease; position: relative;
            -webkit-tap-highlight-color: transparent;
            user-select: none;
        }
        
        .nav-item i { font-size: 18px; transition: all 0.3s ease; }
        .nav-item span { font-size: 9px; font-weight: 600; transition: all 0.3s ease; }
        .nav-item.active { background: transparent; color: #FFFFFF; }

        /* --- БЕЙДЖ ДЛЯ ИГРЫ --- */
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

        /* КОГДА ИГРА АКТИВНА */
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

    // 3. Вставляем HTML меню (ВМЕСТЕ С ТЕНЬЮ)
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
            <a href="/event_page.html" class="nav-item" data-path="event_page" id="nav-games-btn">
                <div class="comic-badge">ИГРА<br>НАЧАЛАСЬ</div>
                <i class="fa-solid fa-gamepad"></i><span>Игры</span>
            </a>
        </nav>
    `;
    document.body.insertAdjacentHTML('beforeend', navHTML);

    // 4. Умная логика подсветки активной кнопки и добавление вибрации
    let currentPath = window.location.pathname.replace('.html', '');
    
    // Приводим пути главной к одному виду
    if (currentPath === '/menu' || currentPath === '' || currentPath === '/index') {
        currentPath = '/';
    }

    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.classList.remove('active');
        const dataPath = item.getAttribute('data-path');
        
        if (dataPath === '/' && currentPath === '/') {
            item.classList.add('active');
        } else if (dataPath !== '/' && currentPath.includes(dataPath)) {
            item.classList.add('active');
        }

        // 🔥 МГНОВЕННАЯ ВИБРАЦИЯ И ОТКЛИК В 0 МС ПРИ КАСАНИИ 🔥
        item.addEventListener('pointerdown', () => {
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback) {
                try { window.Telegram.WebApp.HapticFeedback.selectionChanged(); } catch (e) {}
            }
        });
    });

    // 5. АВТОНОМНАЯ ПРОВЕРКА СТАТУСА ИГРЫ И СТРИМА (МУЛЬТИАККАУНТ)
    const checkGameStatus = async () => {
        try {
            const headers = { 
                'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5ZXVja2pjcnNpYXNleXFyc2VrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0NzEyOTgsImV4cCI6MjA3MDA0NzI5OH0.srRwuUygiF7jr3-b2AwyRNAmrChlW3Bzp3I-9Ju2TVg', 
                'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5ZXVja2pjcnNpYXNleXFyc2VrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0NzEyOTgsImV4cCI6MjA3MDA0NzI5OH0.srRwuUygiF7jr3-b2AwyRNAmrChlW3Bzp3I-9Ju2TVg' 
            };

            // 🔥 Запрашиваем ОДНОВРЕМЕННО статус игры и статусы обоих стримеров
            const [guessRes, settingsRes] = await Promise.all([
                fetch('https://pyeuckjcrsiaseyqrsek.supabase.co/rest/v1/guess_state?id=eq.1&select=is_active', { headers }),
                fetch('https://pyeuckjcrsiaseyqrsek.supabase.co/rest/v1/settings?key=in.(twitch_status_883996654,twitch_status_755238101)&select=value', { headers })
            ]);

            const guessData = await guessRes.json();
            const settingsData = await settingsRes.json();
            
            const gamesBtn = document.getElementById('nav-games-btn');
            
            if (gamesBtn && guessData && guessData.length > 0) {
                // Проверяем, есть ли хотя бы один стрим со статусом true
                // (учитываем, что value может прийти как boolean или как строка 'true')
                const isStreamOnline = settingsData && settingsData.some(s => s.value === true || s.value === 'true') || false;
                
                // Если игра активна И хотя бы один канал онлайн -> показываем бейдж
                if (guessData[0].is_active && isStreamOnline) {
                    gamesBtn.classList.add('game-live');
                } else {
                    gamesBtn.classList.remove('game-live');
                }
            }
        } catch(e) {
            console.warn('Game status checker error:', e);
        }
    };
    
    checkGameStatus();
    setInterval(checkGameStatus, 10000);

    // =========================================================================
    // 🚀 6. ДВИЖОК 0 МС PRERENDER (SPECULATION RULES) + ФОНОВЫЙ ПРОГРЕВ ВСЕХ СТРАНИЦ
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

    // А) Включаем нативный Chromium Prerender (страницы рендерятся в памяти до клика = 0 мс переход)
    if (HTMLScriptElement.supports && HTMLScriptElement.supports('speculationrules')) {
        try {
            const specScript = document.createElement('script');
            specScript.type = 'speculationrules';
            specScript.textContent = JSON.stringify({
                prerender: [{
                    source: 'list',
                    urls: ['/leaderboard', '/quests', '/', '/events', '/event_page.html', '/raffles', '/profile'],
                    eagerness: 'eager'
                }],
                prefetch: [{
                    source: 'list',
                    urls: allCoreUrls,
                    eagerness: 'eager'
                }]
            });
            document.head.appendChild(specScript);
        } catch (e) {}
    }

    // Б) Фоновый прогрев HTML и API-данных всех разделов на старте
    function runBackgroundPrewarm() {
        if (sessionStorage.getItem('__hl_prewarm_done__') === '1') return;
        sessionStorage.setItem('__hl_prewarm_done__', '1');

        // 1. Кладем HTML всех вкладок в кэш браузера
        allCoreUrls.forEach((url, i) => {
            if (window.location.pathname === url) return;
            setTimeout(() => {
                const link = document.createElement('link');
                link.rel = 'prefetch';
                link.href = url;
                link.as = 'document';
                document.head.appendChild(link);
            }, i * 120);
        });

        // 2. Прогреваем API-ответы (user/me, raffles/active, bootstrap) в 0-мс кэш
        const auth = window.getGlobalAuthPayload ? window.getGlobalAuthPayload() : { initData: '' };
        if (auth.initData) {
            setTimeout(() => {
                fetch('/api/v1/user/me', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(auth) }).catch(() => {});
                fetch('/api/v1/raffles/active', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(auth) }).catch(() => {});
            }, 400);
        }
    }

    if (document.readyState === 'complete') {
        setTimeout(runBackgroundPrewarm, 300);
    } else {
        window.addEventListener('load', () => setTimeout(runBackgroundPrewarm, 300));
    }
});
