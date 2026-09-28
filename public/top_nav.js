(function() {
    // ==========================================
    // 1. CSS ШАПКИ И МЕНЮ 
    // ==========================================
    const navStyles = `
        :root {
            --bg-main: #121212; 
            --surface-glass: rgba(255, 255, 255, 0.12); 
            --border-glass: rgba(255, 255, 255, 0.06);
            --text-primary: #ffffff;
            --text-muted: #8e8e93;
            --radius-pill: 40px;
            --radius-card: 24px; 
            --primary-color: #ffd700;
            --rarity-blue: #4b69ff;
            --rarity-purple: #8847ff;
            --rarity-pink: #d32ce6;
            --rarity-red: #eb4b4b;
            --rarity-gold: #ffd700;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }

        html, body {
            width: 100vw; height: 100vh; height: var(--tg-viewport-height, 100vh); 
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            overflow: hidden; background-color: var(--bg-main); color: var(--text-primary);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            overflow-x: hidden;
            overscroll-behavior-x: none !important;

            display: flex;
            flex-direction: column;
        }

        .hidden { display: none !important; }

        .main-content-scrollable {
            flex: 1;
            height: auto; 

            overflow-y: auto; overflow-x: hidden;
            -webkit-overflow-scrolling: touch; padding-bottom: 0; 
            overscroll-behavior-x: none !important;
        }
        .main-content-scrollable::after {
            content: ''; display: block; height: 160px; width: 100%; flex-shrink: 0; pointer-events: none;
        }

       /* ==========================================
           ШАПКА (ОПУСКАЕМ И СЖИМАЕМ)
        ========================================== */
        .top-header {
            display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; 
            padding-top: calc(var(--tg-content-safe-area-inset-top, var(--tg-safe-area-inset-top, env(safe-area-inset-top, 24px))) + 74px) !important;
            margin-bottom: 22px; 
            position: relative; z-index: 100;
        }
        body.android-mode .top-header { padding-top: calc(var(--tg-content-safe-area-inset-top, 0px) + 72px) !important; }
        body.desktop-platform .top-header { padding-top: 41px !important; margin-bottom: 10px !important; }

        .logo-wrapper { display: flex; align-items: center; gap: 14px; cursor: pointer; }
        .app-logo { width: 28px; height: 28px; border-radius: 0; background: transparent; object-fit: contain; }
        .logo-text { display: flex; flex-direction: column; justify-content: center; }
        .logo-title { font-size: 13px; font-weight: 900; color: #fff; line-height: 1; text-transform: uppercase; letter-spacing: 0.3px; }
        .logo-subtitle { font-size: 7px; color: rgba(255, 255, 255, 0.4); font-weight: 800; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.5px; }

        .header-right-group { display: flex; align-items: center; gap: 6px; }
        .balance-pill { background: rgba(30, 30, 32, 0.5); backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 16px; padding: 3px 4px 3px 10px; display: flex; align-items: center; gap: 8px; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.1); transition: transform 0.1s, background 0.2s; width: auto; min-width: max-content; white-space: nowrap; }
        .balance-pill:active { transform: scale(0.96); background: rgba(40, 40, 42, 0.7); }
        .balance-col { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
        .balance-row { display: flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 800; line-height: 1; color: #fff; font-family: 'SF Mono', 'Roboto Mono', monospace; }
        .refresh-icon-wrapper { background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.02); width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        #refresh-icon { font-size: 9px; color: #8E8E93; transition: color 0.2s; }
        .balance-pill:active #refresh-icon { color: #fff; }
        .user-avatar { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(255,255,255,0.1); cursor: pointer; }
        .glass-burger { width: 28px; height: 28px; border-radius: 8px; background: rgba(255, 255, 255, 0.02); backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px); border: 1px solid rgba(255, 255, 255, 0.06); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.1); padding: 0; }
        .glass-burger span { display: block; width: 12px; height: 1.5px; background-color: rgba(255, 255, 255, 0.85); border-radius: 2px; box-shadow: 0 0 4px rgba(255,255,255,0.2); }
        .glass-burger:active { transform: scale(0.92); background: rgba(255,255,255,0.1); }

        .side-menu-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.4); backdrop-filter: blur(5px); z-index: 9999; opacity: 0; pointer-events: none; transition: opacity 0.3s ease; }
        .side-menu-overlay.active { opacity: 1; pointer-events: auto; }

        .side-menu-content { position: absolute; top: 0; right: -100%; width: 100%; height: 100%; background: rgba(28, 28, 30, 0.75); backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px); transition: right 0.4s cubic-bezier(0.25, 1, 0.5, 1); padding: calc(var(--tg-content-safe-area-inset-top, env(safe-area-inset-top, 24px)) + 85px) 20px 20px 20px; box-sizing: border-box; display: flex; flex-direction: column; }
        .side-menu-overlay.active .side-menu-content { right: 0; }
        .side-menu-header { display: flex; justify-content: flex-end; align-items: center; margin-bottom: 10px; padding-top: 0px; }
        .icon-btn { background: transparent; border: none; color: #fff; font-size: 20px; cursor: pointer; outline: none; }

        .side-nav { display: flex; flex-direction: column; gap: 4px; }
        .side-nav a { display: flex; align-items: center; gap: 10px; color: var(--text-primary); text-decoration: none; font-size: 12px; font-weight: 600; padding: 8px 12px; border-radius: 8px; background: rgba(255, 255, 255, 0.08); transition: background 0.2s; }
        .side-nav a:active { background: rgba(255, 255, 255, 0.15); }

        .side-nav-bottom { margin-top: auto; display: flex; flex-direction: column; gap: 4px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.05); }
        .side-nav-bottom a { display: flex; align-items: center; gap: 10px; color: var(--text-muted); text-decoration: none; font-size: 11px; font-weight: 600; padding: 8px 12px; border-radius: 8px; transition: background 0.2s, color 0.2s; }
        .side-nav-bottom a:active { background: rgba(255, 255, 255, 0.05); color: #fff; }
        .side-nav-bottom a#nav-admin { background: rgba(255, 59, 48, 0.1); color: #ff3b30; font-size: 12px; margin-top: 5px; }
        .side-nav-bottom a#nav-admin:active { background: rgba(255, 59, 48, 0.2); }

        .modal { 
            position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
            background: rgba(0,0,0,0.95); 
            backdrop-filter: blur(8px); 
            z-index: 10002; opacity: 0; visibility: hidden; 
            transition: opacity 0.3s ease, visibility 0.3s ease; 
            display: flex; align-items: center; justify-content: center; 
        }
        .modal:not(.hidden) { opacity: 1; visibility: visible; }
        .modal.visible { opacity: 1 !important; visibility: visible !important; pointer-events: auto !important; }
        .modal-content { background: #1c1c1e; width: 90%; max-width: 360px; border-radius: 24px; border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 20px 50px rgba(0,0,0,0.7); padding: 24px; display: flex; flex-direction: column; gap: 16px; position: relative; z-index: 10000; }
        .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; }

        .custom-confirm-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 90000; background: rgba(0,0,0,0.7); backdrop-filter: blur(5px); display: flex; align-items: center; justify-content: center; opacity: 0; visibility: hidden; transition: 0.2s; }
        .custom-confirm-overlay.visible { opacity: 1; visibility: visible; pointer-events: auto; }
        .custom-confirm-box { background: #1c1c1e; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 24px; width: 85%; max-width: 320px; text-align: center; transform: scale(0.9); transition: 0.2s; }
        .custom-confirm-overlay.visible .custom-confirm-box { transform: scale(1); }
        .confirm-title { color: #fff; font-size: 18px; font-weight: 700; margin: 0 0 8px; }
        .confirm-subtitle { color: #8E8E93; font-size: 13px; margin: 0 0 20px; line-height: 1.4; }
        .confirm-buttons { display: flex; gap: 12px; }
        .confirm-btn { flex: 1; padding: 12px; border-radius: 10px; font-size: 14px; font-weight: 700; cursor: pointer; border: none; transition: transform 0.1s; }
        .confirm-btn:active { transform: scale(0.95); }
        .btn-cancel-modal { background: rgba(255,255,255,0.1); color: #fff; }
        .btn-yellow-modal { background: #ffcc00; color: #000; }

        @media (min-width: 768px) { body { max-width: 480px; margin: 0 auto; border-left: 1px solid rgba(255,255,255,0.1); border-right: 1px solid rgba(255,255,255,0.1); position: relative; } }
        html.vk-mode, html.vk-mode body { position: fixed !important; overflow: hidden !important; background-color: #000; }

        /* ==========================================
           ТРАСТ И ЛИМИТЫ (РАЗДЕЛЁННЫЕ)
        ========================================== */
        .activity-status-bar {
            position: absolute;
            top: calc(var(--tg-content-safe-area-inset-top, var(--tg-safe-area-inset-top, env(safe-area-inset-top, 24px))) + 55px);
            left: 16px; 
            right: 16px;
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            background: transparent; border: none; box-shadow: none; padding: 0;
            transition: opacity 0.2s, transform 0.1s;
        }
        body.android-mode .activity-status-bar { top: calc(var(--tg-content-safe-area-inset-top, 0px) + 52px); }
        body.desktop-platform .activity-status-bar { top: 22px; }

        .status-left { display: flex; align-items: center; gap: 4px; font-size: 8px; font-weight: 800; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.5px; }
        .status-left:active { background: rgba(255, 255, 255, 0.1) !important; transform: scale(0.98); }

        .status-right { display: flex; align-items: center; gap: 4px; font-size: 9px; font-weight: 800; color: #fff; text-transform: uppercase; line-height: 1; }
        .status-right:active { background: rgba(255, 255, 255, 0.1) !important; transform: scale(0.98); }

        .status-chevron { font-size: 8px; color: #ffd700; margin-left: 2px; }

        .trust-dot { width: 6px; height: 6px; border-radius: 50%; box-shadow: 0 0 6px currentColor; }
        .trust-green { color: #34c759; background: #34c759; }
        .trust-gray { color: #8e8e93; background: #8e8e93; }
        .trust-red { color: #ff3b30; background: #ff3b30; }

        /* ==========================================
           МОДАЛКА ACTIVITY LOCK (СЖАТАЯ, БЕЗ ФОНА)
        ========================================== */
        .lock-modal-content { 
            max-width: 320px; 
            padding: 10px; 
            text-align: left; 
            background: transparent !important; 
            border: none !important; 
            box-shadow: none !important; 
        }
        .lock-header-icon { font-size: 24px; text-align: center; margin-bottom: 4px; color: #ffd700; }

        .lock-subtitle { text-align: center; font-size: 16px; font-weight: 800; color: #fff; margin-bottom: 14px; text-transform: uppercase; line-height: 1.1; }

        .lock-section { margin-bottom: 8px; padding: 0; background: transparent; border: none; }
        .lock-section-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2px; }
        .lock-section-title { font-size: 11px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 4px; }
        .lock-section-value { font-size: 11px; font-weight: 800; font-family: 'SF Mono', monospace; color: #fff; line-height: 1; }

        .progress-track { width: 100%; height: 4px; background: rgba(255,255,255,0.08); border-radius: 4px; overflow: hidden; }
        .progress-fill { height: 100%; border-radius: 4px; transition: width 0.8s cubic-bezier(0.2, 0.8, 0.2, 1); }
        .fill-money, .fill-items, .fill-msgs { background: linear-gradient(90deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.9) 100%); box-shadow: 0 0 10px rgba(255,255,255,0.2); }
        .fill-danger { background: linear-gradient(90deg, rgba(255,69,58,0.5) 0%, rgba(255,69,58,0.9) 100%) !important; box-shadow: 0 0 10px rgba(255,69,58,0.3) !important; }

        .lock-info-text { font-size: 10px; color: #a1a1aa; margin-top: 2px; line-height: 1.2; }
        .lock-info-text strong { color: #fff; font-weight: 700; }

        .exceptions-block { margin-top: 4px; padding-top: 6px; border-top: 1px dashed rgba(255,255,255,0.1); font-size: 10px; color: #a1a1aa; line-height: 1.2; text-align: left; }
        .exceptions-title { font-size: 10px; font-weight: 800; color: #34c759; margin-bottom: 2px; display: flex; align-items: center; gap: 4px; text-transform: uppercase;}
        .exceptions-block strong { color: #fff; font-weight: 700; }

        /* ==========================================
           КНОПКИ В ОДИН РЯД С ЛОГОТИПОМ (ТОЛЬКО WEB-ПК)
        ========================================== */
        #desktop-shop-actions { display: none; }

        @media (min-width: 768px) {
            body.browser-mode #desktop-shop-actions { 
                display: flex !important; 
                align-items: center !important; 
                gap: 8px !important; 
                margin-left: 14px !important; 
            }

            body.browser-mode #desktop-shop-actions .premium-exchange-btn { 
                flex: 0 0 auto !important; 
                width: auto !important; 
                margin: 0 !important; 
                height: 24px !important; 
                min-height: 24px !important; 
                padding: 0 10px !important; 
                border-radius: 6px !important; 
                display: flex !important; 
                align-items: center !important; 
                box-shadow: 0 2px 6px rgba(0,0,0,0.2) !important; 
            }

            body.browser-mode #desktop-shop-actions .p2p-icon-box { 
                width: 14px !important; 
                height: 14px !important; 
                font-size: 8px !important; 
                margin-right: 4px !important; 
                border-radius: 3px !important; 
                background: rgba(255,255,255,0.2) !important; 
                box-shadow: none !important; 
                display: flex !important; 
                align-items: center !important; 
                justify-content: center !important; 
            }

            body.browser-mode #desktop-shop-actions .p2p-text-box { 
                justify-content: center !important; 
                margin-top: 1px !important; 
            }

            body.browser-mode #desktop-shop-actions .p2p-title { 
                font-size: 10px !important; 
                line-height: 1 !important; 
                font-weight: 800 !important; 
                letter-spacing: 0.5px !important; 
                color: #fff !important; 
            }

            body.browser-mode #desktop-shop-actions .p2p-subtitle, 
            body.browser-mode #desktop-shop-actions .p2p-arrow { 
                display: none !important; 
            }
        }

        /* --- LIQUID GLASS МОДАЛКА КУПОНА --- */
        .coupon-modal-overlay {
            position: fixed; inset: 0; background: rgba(0,0,0,0.7);
            backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
            z-index: 10005; display: flex; align-items: center; justify-content: center;
            opacity: 1; visibility: visible; transition: opacity 0.3s ease, visibility 0.3s ease;
        }
        /* Переопределяем глобальный .hidden для сохранения красивой анимации старого кода */
        .coupon-modal-overlay.hidden { display: flex !important; opacity: 0; visibility: hidden; pointer-events: none; }
        
        .coupon-custom-popup {
            background: rgba(18, 18, 20, 0.75); backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px);
            border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 24px; padding: 24px;
            width: 90%; max-width: 320px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.9);
            transform: scale(1); transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
            text-align: center; position: relative;
        }
        .coupon-modal-overlay.hidden .coupon-custom-popup { transform: scale(0.95); }
        
        .coupon-sheet-close {
            position: absolute; top: 16px; right: 16px; background: rgba(255,255,255,0.05); 
            border: 1px solid rgba(255, 255, 255, 0.08); color: #fff; width: 30px; height: 30px; border-radius: 50%;
            cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s; outline: none; padding: 0;
        }
        .coupon-sheet-close i { margin-top: 1px; font-size: 14px; color: #8e8e93; }
        .coupon-sheet-close:active { transform: scale(0.9); background: rgba(255,255,255,0.1); }
        
        .coupon-icon-anim {
            font-size: 44px; margin-bottom: 12px; filter: drop-shadow(0 0 15px rgba(52, 199, 89, 0.3));
            display: inline-block; animation: floatIcon 3s ease-in-out infinite;
        }
        @keyframes floatIcon { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        
        .coupon-popup-title { margin: 0 0 8px 0; font-size: 18px; font-weight: 800; color: #fff; text-transform: uppercase; }
        .coupon-popup-subtitle { font-size: 12px; color: #8e8e93; margin-bottom: 20px; line-height: 1.4; padding: 0 10px; }
        
        .coupon-reward-code-box {
            display: flex; align-items: center; gap: 8px; background: rgba(0, 0, 0, 0.4);
            border: 1px dashed rgba(255, 255, 255, 0.15); border-radius: 12px; 
            padding: 6px 6px 6px 14px; margin-bottom: 20px; transition: border 0.3s;
        }
        .coupon-reward-code-box:focus-within { border-color: rgba(52, 199, 89, 0.5); }
        .coupon-reward-code-input {
            flex-grow: 1; background: transparent; border: none; outline: none; color: #fff; 
            font-family: monospace; font-size: 14px; font-weight: 800; text-shadow: 0 0 10px rgba(255,255,255,0.2); 
            letter-spacing: 1px; width: 100%;
        }
        .coupon-reward-code-input::placeholder { color: rgba(255,255,255,0.2); }
        
        .coupon-btn-paste {
            background: rgba(255,255,255,0.08); color: #fff; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px;
            width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;
            cursor: pointer; transition: 0.2s; flex-shrink: 0; font-size: 14px;
        }
        .coupon-btn-paste:active { transform: scale(0.9); background: rgba(255,255,255,0.15); }
        
        .coupon-btn-activate {
            width: 100%; border: 1px solid rgba(52, 199, 89, 0.3); padding: 14px; border-radius: 14px;
            font-size: 14px; font-weight: 800; cursor: pointer; transition: 0.2s;
            background: rgba(52, 199, 89, 0.15); color: #34c759; text-transform: uppercase;
            box-shadow: 0 4px 15px rgba(52, 199, 89, 0.1); display: block;
        }
        .coupon-btn-activate:active { transform: scale(0.95); background: rgba(52, 199, 89, 0.25); }
        .coupon-btn-activate:disabled { opacity: 0.6; pointer-events: none; }
    `;

    // ==========================================
    // 2. HTML ШАПКИ, БОКОВОГО МЕНЮ И ACTIVITY LOCK
    // ==========================================
    const navHtml = `
        <!-- БОКОВОЕ МЕНЮ -->
        <div id="side-menu-overlay" class="side-menu-overlay">
            <div class="side-menu-content">
                <div class="side-menu-header">
                    <button id="close-menu-btn" class="icon-btn"><i class="fa-solid fa-xmark"></i></button>
                </div>

                <nav class="side-nav">
                    <a href="public/profile/profile_menu.html"><i class="fa-solid fa-user"></i> Мой Профиль</a>
                    <a href="/quests"><i class="fa-solid fa-check-double"></i> Задания</a>
                    <a href="/leaderboard"><i class="fa-solid fa-trophy"></i> Лидербоард</a>
                    <a href="/menu"><i class="fa-solid fa-gear"></i> Настройки</a>
                    <a href="#" onclick="if(typeof showFaq === 'function') showFaq(); return false;"><i class="fa-solid fa-circle-question"></i> Как пользоваться приложением?</a>
                    <a href="#" onclick="if(typeof openCouponModal === 'function') openCouponModal(); return false;">
                        <i class="fa-solid fa-ticket-simple" style="color: #34c759;"></i> Активировать купон
                    </a>
                </nav>

                <nav class="side-nav-bottom">
                    <a href="/agreement.html"><i class="fa-solid fa-file-contract"></i> Оферта и Правила</a>
                    <a href="/privacy-policy.html"><i class="fa-solid fa-shield-halved"></i> Политика безопасности</a>

                    <a href="/admin" id="nav-admin" class="hidden"><i class="fa-solid fa-shield"></i> Админ панель</a>
                </nav>
            </div>
        </div>

        <!-- МОДАЛКА КУПОНОВ (LIQUID GLASS) -->
        <div id="coupon-modal" class="coupon-modal-overlay hidden" onclick="if(event.target===this) closeCouponModal()">
            <div class="coupon-custom-popup">
                <button class="coupon-sheet-close" onclick="closeCouponModal()">
                    <i class="fa-solid fa-xmark"></i>
                </button>
                
                <div class="coupon-icon-anim">🎟️</div>
                <h3 class="coupon-popup-title">Активация</h3>
                <p class="coupon-popup-subtitle">Введите секретный код купона, чтобы получить бонус на ваш аккаунт</p>
                
                <div class="coupon-reward-code-box">
                    <input type="text" id="coupon-input" class="coupon-reward-code-input" placeholder="КОД КУПОНА" autocomplete="off" spellcheck="false">
                    <button class="coupon-btn-paste" onclick="pasteCoupon()" title="Вставить">
                        <i class="fa-solid fa-paste"></i>
                    </button>
                </div>
                
                <button id="activate-coupon-btn" class="coupon-btn-activate" onclick="activateCouponSubmit()">
                    Активировать
                </button>
            </div>
        </div>

        <!-- 🔥 ГЛАВНАЯ ШАПКА 🔥 -->
        <header class="top-header" id="universal-top-header">

            <div class="activity-status-bar" style="cursor: default; pointer-events: auto;">
                <div class="status-left" onclick="window.openTrustModal(); event.stopPropagation();" style="cursor: pointer; padding: 4px; margin-left: -4px; border-radius: 6px;">
                    <div id="ui-trust-dot" class="trust-dot trust-gray"></div>
                    <span id="ui-trust-text">УРОВЕНЬ: БАЗОВЫЙ</span>
                </div>
                <div class="status-right" onclick="window.openActivityLockModal(); event.stopPropagation();" style="cursor: pointer; padding: 4px; margin-right: -4px; border-radius: 6px;">
                    <span id="ui-limits-summary" style="display: flex; gap: 4px; align-items: center;">
                        <span style="color: #a1a1aa; font-weight: 700; font-size: 8px;">ДОСТУПНЫЙ ВЫВОД:</span> Загрузка...
                    </span>
                    <i class="fa-solid fa-chevron-right status-chevron"></i>
                </div>
            </div>

            <div class="logo-wrapper">
                <img src="https://i.postimg.cc/T3J3WhZL/6d40575f-80b0-49ba-a3ce-84890db9a196.png" alt="Logo" class="app-logo">
                <div class="logo-text">
                    <span class="logo-title">HATElavka</span>
                    <span class="logo-subtitle">
                        <a href="https://www.twitch.tv/hatelove_ttv" target="_blank" onclick="if(window.Telegram?.WebApp) { Telegram.WebApp.openLink('https://www.twitch.tv/hatelove_ttv'); return false; }" style="color: #9146ff; text-decoration: none; font-weight: 700;">TWITCH</a> 
                        <span style="color: inherit; margin: 0 2px;">|</span> 
                        <a href="https://t.me/hatelove_ttv" target="_blank" onclick="if(window.Telegram?.WebApp) { Telegram.WebApp.openTelegramLink('https://t.me/hatelove_ttv'); return false; }" style="color: #2AABEE; text-decoration: none; font-weight: 700;">TELEGRAM</a>
                    </span>
                </div>
                <div id="desktop-shop-actions" onclick="event.stopPropagation();" style="cursor: default;"></div>
            </div>

            <div class="header-right-group">
                <div class="balance-pill" onclick="if(typeof checkBalance === 'function') checkBalance(true)">
                    <div class="balance-col">
                        <div class="balance-row"><span id="user-balance"><i class="fa-solid fa-spinner fa-spin" style="font-size: 10px;"></i></span> <i class="fa-solid fa-coins" style="color: #FFD700;"></i></div>
                        <div class="balance-row"><span id="ticketStats"><i class="fa-solid fa-spinner fa-spin" style="font-size: 10px;"></i></span> <i class="fa-solid fa-ticket" style="color: #bdecff;"></i></div>
                    </div>
                    <div class="refresh-icon-wrapper">
                        <i class="fa-solid fa-rotate-right" id="refresh-icon"></i>
                    </div>
                </div>
                <img src="https://via.placeholder.com/64x64/555555/ffffff?text=U" alt="Avatar" class="user-avatar" id="user-avatar" onclick="window.location.href='public/profile/profile_menu.html'">
                <button id="open-menu-btn" class="glass-burger">
                    <span></span><span></span><span></span>
                </button>
            </div>
        </header>

        <!-- 🔥 3. МОДАЛКА ACTIVITY LOCK С ИСКЛЮЧЕНИЯМИ 🔥 -->
        <div id="activity-lock-modal" class="modal hidden" style="z-index: 10005;">
            <div class="modal-content lock-modal-content">
                <div class="modal-header" style="margin-bottom: 0;">
                    <div style="width: 20px;"></div>
                    <button onclick="window.closeActivityLockModal()" class="icon-btn" style="font-size: 18px;"><i class="fa-solid fa-xmark"></i></button>
                </div>

                <div class="lock-header-icon"><i class="fa-solid fa-shield-halved" style="color: #fff; opacity: 0.8; filter: drop-shadow(0 0 10px rgba(255,255,255,0.3));"></i></div>
                <div class="lock-subtitle">Динамические лимиты экономики лавки</div>

                <div class="lock-section">
                    <div class="lock-section-header">
                        <span class="lock-section-title"><i class="fa-solid fa-wallet" style="color: rgba(255,255,255,0.5);"></i> Бюджет на вывод</span>
                        <span class="lock-section-value" id="modal-money-val">0 / 0 ₽</span>
                    </div>
                    <div class="progress-track">
                        <div class="progress-fill fill-money" id="modal-money-bar"></div>
                    </div>
                    <div class="lock-info-text" id="modal-money-desc">Финансовый потолок за 7 дней. Зависит от запасов лавки и <strong>Траста</strong>.</div>
                </div>

                <div class="lock-section">
                    <div class="lock-section-header">
                        <span class="lock-section-title"><i class="fa-solid fa-box-open" style="color: rgba(255,255,255,0.5);"></i> Лимит предметов</span>
                        <span class="lock-section-value" id="modal-items-val">0 / 0 шт.</span>
                    </div>
                    <div class="progress-track">
                        <div class="progress-fill fill-items" id="modal-items-bar"></div>
                    </div>
                    <div class="lock-info-text">Количество скинов, доступных для вывода в неделю.</div>
                </div>

                <div class="lock-section">
                    <div class="lock-section-header">
                        <span class="lock-section-title"><i class="fa-solid fa-comment-dots" style="color: rgba(255,255,255,0.5);"></i> Активность за месяц</span>
                        <span class="lock-section-value" id="modal-msgs-val">0 / 0</span>
                    </div>
                    <div class="progress-track">
                        <div class="progress-fill fill-msgs" id="modal-msgs-bar"></div>
                    </div>
                    <div class="lock-info-text" id="modal-msgs-desc">Сообщения в TG и Twitch за месяц.</div>
                </div>

                <!-- 🔥 ИЗМЕНЕННЫЙ БЛОК ДЛЯ ТАЙМЕРА И ДЕТАЛЕЙ СГОРАНИЯ 🔥 -->
                <div style="text-align: center; margin-top: 4px; min-height: 24px;">
                    <div id="modal-unlock-time" style="font-size: 10px; color: #ffcc00; font-weight: 700;"></div>
                    <div id="modal-unlock-details" style="font-size: 9px; color: #a1a1aa; margin-top: 4px; display: none; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 4px;"></div>
                </div>

                <div class="exceptions-block">
                    <div class="exceptions-title"><i class="fa-solid fa-circle-info"></i> Исключения из правил</div>
                    Ивентовые скины не расходуют ваши лимиты и доступны всегда. К ним относятся: <strong>Аукционы</strong>, <strong>Розыгрыши</strong> и предметы из <strong>различных ивентов</strong> (Battle Pass, котел и т.п).
                </div>
            </div>
        </div>
    `;

    // ==========================================
    // 3. ДОМИНАНТНАЯ ЛОГИКА И ЗАЩИТА СИСТЕМЫ
    // ==========================================
    let isInitialized = false;

    function lockGlobalFunction(name, fn) {
        if (window[name]) return;
        Object.defineProperty(window, name, {
            value: fn,
            writable: false,      
            configurable: false   
        });
    }

    function injectDOM() {
        if (window.location.pathname.includes('/admin')) return;
        if (document.getElementById('universal-top-header')) return; 

        if (!document.getElementById('hatelavka-global-styles')) {
            const styleEl = document.createElement('style');
            styleEl.id = 'hatelavka-global-styles';
            styleEl.innerHTML = navStyles;
            document.head.appendChild(styleEl);
        }

        const container = document.createElement('div');
        container.innerHTML = navHtml;
        while (container.firstChild) {
            document.body.insertBefore(container.firstChild, document.body.firstChild);
        }

        bindEvents();
        loadCachedAvatar();
    }

    function moveShopButtonsToHeader() {
        const isPC = !(/android/i.test(navigator.userAgent) || /iPad|iPhone|iPod/.test(navigator.userAgent));
        if (!isPC) return; 

        const tryMove = () => {
            if (!document.body.classList.contains('browser-mode')) return false;

            const targetContainer = document.getElementById('desktop-shop-actions');
            const exchangeBtns = document.querySelectorAll('.premium-exchange-btn');

            if (targetContainer && exchangeBtns.length > 0 && targetContainer.children.length === 0) {
                const oldContainer = document.querySelector('.shop-actions');
                if (oldContainer) oldContainer.style.display = 'none';

                exchangeBtns.forEach(btn => {
                    btn.style.width = '';
                    btn.style.height = '';
                    targetContainer.appendChild(btn);
                });
                return true;
            }
            return targetContainer && targetContainer.children.length > 0;
        };

        if (!tryMove()) {
            const interval = setInterval(() => {
                if (tryMove()) clearInterval(interval);
            }, 100);
            setTimeout(() => clearInterval(interval), 5000);
        }
    }

    function bindEvents() {
        const menuBtn = document.getElementById('open-menu-btn');
        const closeMenuBtn = document.getElementById('close-menu-btn');
        const sideMenu = document.getElementById('side-menu-overlay');

        let touchStartX = 0;
        let touchEndX = 0;

        if (sideMenu) {
            sideMenu.addEventListener('touchstart', (e) => {
                touchStartX = e.changedTouches[0].screenX;
            }, { passive: true });

            sideMenu.addEventListener('touchend', (e) => {
                touchEndX = e.changedTouches[0].screenX;
                if (touchEndX - touchStartX > 70) { 
                    toggleMenu(false); 
                }
            }, { passive: true });
        }

        const tgBackBtnHandler = () => {
            toggleMenu(false);
        };

        const toggleMenu = (show, fromPopState = false) => {
            if (!sideMenu) return;
            if (show) { 
                sideMenu.classList.add('active'); 
                document.body.style.overflow = 'hidden'; 

                if (!fromPopState) {
                    history.pushState({ sideMenuOpen: true }, '');
                }

                if (window.Telegram?.WebApp?.BackButton) {
                    window.Telegram.WebApp.BackButton.show();
                    window.Telegram.WebApp.BackButton.onClick(tgBackBtnHandler);
                }
            } else { 
                sideMenu.classList.remove('active'); 
                document.body.style.overflow = ''; 

                if (history.state?.sideMenuOpen && !fromPopState) {
                    history.back(); 
                }

                if (window.Telegram?.WebApp?.BackButton) {
                    window.Telegram.WebApp.BackButton.offClick(tgBackBtnHandler);
                    window.Telegram.WebApp.BackButton.hide();
                }
            }
        };

        window.addEventListener('popstate', (e) => {
            if (sideMenu && sideMenu.classList.contains('active') && !e.state?.sideMenuOpen) {
                toggleMenu(false, true); 
            }
        });

        if (menuBtn) menuBtn.onclick = () => toggleMenu(true);
        if (closeMenuBtn) closeMenuBtn.onclick = () => toggleMenu(false);
        if (sideMenu) sideMenu.onclick = (e) => { 
            if (e.target === sideMenu) toggleMenu(false); 
        };
    }

    function loadCachedAvatar() {
        try {
            const cached = JSON.parse(localStorage.getItem('cache_bootstrap') || '{}');
            if (cached && cached.user && cached.user.photo_url) {
                const avatarEl = document.getElementById('user-avatar');
                if (avatarEl) avatarEl.src = cached.user.photo_url;
            }
        } catch(e){}
    }

    function detectPlatforms() {
        window.isVk = false; window.vkParams = null;
        const checkString = (str) => str && (str.includes('vk_app_id') || str.includes('vk_user_id'));
        let rawParams = window.location.search.replace('?', '') || window.location.hash.replace('#', '');

        if (!checkString(rawParams) && checkString(window.name)) rawParams = window.name;
        if (!checkString(rawParams) && checkString(document.referrer)) {
            try { rawParams = new URL(document.referrer).search.replace('?', ''); } catch(e){}
        }

        if (checkString(rawParams) || checkString(window.location.href)) {
            window.isVk = true;
            document.documentElement.classList.add('vk-mode');
            window.vkParams = rawParams;
        }

        if (!window.isVk && window.Telegram && window.Telegram.WebApp) {
            const tg = window.Telegram.WebApp;
            const platform = tg.platform || 'unknown';
            if (platform === 'tdesktop' || platform === 'macos' || platform === 'web' || platform === 'webk') {
                document.body.classList.add('desktop-platform', 'desktop-mode');
            } else if (platform === 'ios') {
                document.body.classList.add('ios-mode');
            } else if (platform === 'android') {
                document.body.classList.add('android-mode');
            } else {
                document.body.classList.add('desktop-mode');
            }
        }
    }

    async function checkAdminAccess() {
        const adminNav = document.getElementById('nav-admin');
        if (!adminNav) return;

        try {
            const cached = JSON.parse(localStorage.getItem('cache_bootstrap') || '{}');
            if (cached?.user?.is_admin) {
                adminNav.classList.remove('hidden');
                return; 
            }
        } catch (e) {}

        try {
            if (typeof window.makeApiRequest === 'function') {
                const userData = await window.makeApiRequest('/api/v1/user/me', {}, 'POST', true);
                if (userData && userData.is_admin) {
                    adminNav.classList.remove('hidden');
                    try {
                        const cached = JSON.parse(localStorage.getItem('cache_bootstrap') || '{}');
                        if (!cached.user) cached.user = {};
                        cached.user.is_admin = true;
                        localStorage.setItem('cache_bootstrap', JSON.stringify(cached));
                    } catch(e){}
                }
            }
        } catch (e) {
            console.warn("Не удалось проверить статус админа", e);
        }
    }

    function waitForDependencies(callback) {
        let attempts = 0;
        const maxAttempts = 50; 

        const check = setInterval(() => {
            attempts++;
            const isTgReady = window.isVk || (window.Telegram?.WebApp?.initData);
            const isApiReady = typeof window.makeApiRequest === 'function';

            if ((isTgReady && isApiReady) || attempts >= maxAttempts) {
                clearInterval(check);
                callback(); 
            }
        }, 100);
    }

    // ==========================================
    // 4. ГЛОБАЛЬНЫЕ ЗАЩИЩЕННЫЕ ФУНКЦИИ
    // ==========================================

    lockGlobalFunction('showTrustTooltip', function(title, htmlContent) {
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
    });

    lockGlobalFunction('showAmnestyLockAlert', function(msgsLeft) {
        const msgsDone = Math.max(0, 100 - msgsLeft);
        const progressPercent = Math.min(100, msgsDone);

        const overlay = document.createElement('div');
        overlay.className = 'amnesty-special-overlay';
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
                    <button onclick="this.closest('.amnesty-special-overlay').style.opacity='0'; setTimeout(() => { this.closest('.amnesty-special-overlay').remove(); window.openTrustModal(); }, 200);" style="width: 100%; padding: 14px; font-size: 13px; background: rgba(255,255,255,0.05); color: #aaa; border: none; border-radius: 12px; font-weight: 700; cursor: pointer; text-transform: uppercase;">
                        Назад
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.style.opacity = '1');
    });

    lockGlobalFunction('showAmnestyRedPillAlert', function() {
        const overlay = document.createElement('div');
        overlay.className = 'amnesty-special-overlay';
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
                    <button onclick="this.closest('.amnesty-special-overlay').style.opacity='0'; setTimeout(() => { this.closest('.amnesty-special-overlay').remove(); window.openTrustModal(); }, 200);" style="width: 100%; padding: 14px; font-size: 13px; background: rgba(255, 59, 48, 0.1); border: 1px solid rgba(255, 59, 48, 0.4); color: #ff3b30; border-radius: 12px; font-weight: 800; cursor: pointer; text-transform: uppercase; box-shadow: 0 4px 15px rgba(255, 59, 48, 0.15); transition: background 0.2s;">
                        ПОНЯТНО
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.style.opacity = '1');
    });

    lockGlobalFunction('handleAmnestyClick', function(dailyMsgs, needed, tookRedPill) {
        const oldModal = document.querySelector('.custom-confirm-overlay');
        if (oldModal) oldModal.remove();

        setTimeout(() => {
            if (tookRedPill) {
                window.showAmnestyRedPillAlert();
            } else if (dailyMsgs < needed) {
                window.showAmnestyLockAlert(needed - dailyMsgs);
            } else {
                window.claimTrustAmnesty();
            }
        }, 50);
    });

    lockGlobalFunction('openTrustModal', function() {
        const cachedBootstrap = JSON.parse(localStorage.getItem('cache_bootstrap') || '{}');
        const userData = cachedBootstrap.user || window.userData || {};

        const score = userData.trust_score !== undefined ? parseFloat(userData.trust_score) : 30.0;
        const percent = Math.max(0, Math.min(100, score)); 

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

        const twMsgs = userData.monthly_message_count || 0;
        const twMins = userData.monthly_uptime_minutes || 0;
        const tgMsgs = userData.telegram_monthly_message_count || 0;
        const streak = userData.streak_days || 0;

        const dailyTwitchMsgs = userData.daily_message_count || 0;
        const messagesNeeded = 100;

        const twMsgsPoints = Math.min((twMsgs / 1500) * 40, 40).toFixed(1);
        const twMinsPoints = Math.min((twMins / 2400) * 40, 40).toFixed(1);
        const tgMsgsPoints = Math.min((tgMsgs / 3500) * 80, 80).toFixed(1);
        const streakPoints = (streak * 0.5).toFixed(1);

        const tookRedPill = cachedBootstrap?.matrix_quest?.selected_pill === 'red';

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

        let buttonsGridHtml = '';

        const rulesBtn = `
            <div onclick="window.showTrustTooltip('Статистика и Правила', window.trustTooltipContent)" style="flex: 1; background: rgba(255,255,255,0.05); border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); padding: 12px 5px; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; transition: background 0.2s;">
                <i class="fa-solid fa-circle-question" style="color: #FFD700; font-size: 20px; pointer-events: none;"></i>
                <div style="font-size: 10px; font-weight: 800; color: #fff; text-transform: uppercase; pointer-events: none;">Правила</div>
            </div>
        `;

        let amnestyBtn = '';
        if (score < 35) {
            amnestyBtn = `
                <div onclick="window.handleAmnestyClick(${dailyTwitchMsgs}, ${messagesNeeded}, ${tookRedPill})" id="amnesty-trust-btn" style="flex: 1; background: linear-gradient(135deg, rgba(255, 59, 48, 0.15) 0%, rgba(255, 149, 0, 0.15) 100%); border: 1px solid rgba(255, 149, 0, 0.4); border-radius: 12px; padding: 12px 5px; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; transition: 0.2s;">
                    <i class="fa-solid fa-handshake-angle" style="color: #ff9500; font-size: 20px; pointer-events: none;"></i>
                    <div style="font-size: 10px; font-weight: 800; color: #fff; text-transform: uppercase; pointer-events: none;">Амнистия</div>
                </div>
            `;
        }

        buttonsGridHtml = `
            <div style="display: flex; gap: 10px; width: 100%; margin-top: 15px; margin-bottom: 5px; position: relative; z-index: 50; pointer-events: auto;">
                ${rulesBtn}
                ${amnestyBtn}
            </div>
        `;

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
                <div style="display: flex; align-items: flex-end; justify-content: center; line-height: 0.8; padding-bottom: 15px;">
                    <span style="font-size: 34px; font-weight: 900; color: ${levelColor}; font-family: 'SF Mono', Consolas, monospace; text-shadow: 0 0 12px ${levelColor}40; letter-spacing: -1px; margin: 0;">${score.toFixed(1)}</span>
                    <span style="font-size: 11px; color: #666; font-weight: 700; margin-left: 3px; margin-bottom: 3px;">/ 100</span>
                </div>
                <div style="position: relative; width: 85%; pointer-events: none; margin-bottom: 10px;">
                    <div style="position: absolute; top: -14px; left: ${percent}%; transform: translateX(-50%); color: #fff; font-size: 16px; z-index: 2; transition: left 0.4s ease; display: flex; justify-content: center; align-items: center; line-height: 1;"><i class="fa-solid fa-caret-down"></i></div>
                    <div style="width: 100%; height: 6px; border-radius: 3px; background: linear-gradient(to right, #ff3b30 0%, #3a3a3c 30%, #3a3a3c 70%, #34c759 100%); box-shadow: 0 0 10px ${levelColor}40;"></div>
                    <div style="position: relative; width: 100%; height: 12px; margin-top: 4px;"><span style="position: absolute; top: 0; left: 0%; transform: translateX(-50%); color: #666; font-size: 10px; font-weight: 800; line-height: 1;">0</span><span style="position: absolute; top: 0; left: 30%; transform: translateX(-50%); color: #8e8e93; font-size: 10px; font-weight: 800; line-height: 1;">30</span><span style="position: absolute; top: 0; left: 70%; transform: translateX(-50%); color: #34c759; font-size: 10px; font-weight: 800; line-height: 1;">80</span><span style="position: absolute; top: 0; left: 100%; transform: translateX(-50%); color: #666; font-size: 10px; font-weight: 800; line-height: 1;">100</span></div>
                </div>
                ${buttonsGridHtml}
            </div>
        `;

        window.showShopModal({
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
    });

    lockGlobalFunction('claimTrustAmnesty', async function() {
        window.customConfirm("Использовать Амнистию?\n\nТвои штрафы сгорят, а траст станет равен 35 (Базовый).\n\nЭту кнопку можно использовать только 1 раз в месяц!", async (ok) => {
            if (!ok) {
                setTimeout(window.openTrustModal, 100);
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
                if(typeof window.makeApiRequest !== 'function') throw new Error("API недоступно");
                await window.makeApiRequest('/api/v1/user/trust/amnesty', {}, 'POST');

                if (window.Telegram?.WebApp?.HapticFeedback) Telegram.WebApp.HapticFeedback.notificationOccurred('success');

                if (window.userData) {
                    window.userData.trust_score = 35.0;
                    window.userData.penalty_points = 0;
                }
                const cachedBootstrap = JSON.parse(localStorage.getItem('cache_bootstrap') || '{}');
                if(cachedBootstrap.user) {
                    cachedBootstrap.user.trust_score = 35.0;
                    cachedBootstrap.user.penalty_points = 0;
                    localStorage.setItem('cache_bootstrap', JSON.stringify(cachedBootstrap));
                }

                if (typeof window.refreshDataSilently === 'function') window.refreshDataSilently();

                window.customAlert("✅ Амнистия применена! Твой траст-фактор восстановлен до 35. Постарайся больше не падать в красную зону!", () => {
                    setTimeout(window.openTrustModal, 100);
                });

            } catch (e) {
                if (btn) {
                    btn.style.pointerEvents = 'auto';
                    btn.innerHTML = `
                        <i class="fa-solid fa-handshake-angle" style="color: #ff9500; font-size: 20px;"></i>
                        <div style="font-size: 10px; font-weight: 800; color: #fff; text-transform: uppercase;">Амнистия</div>
                    `;
                }
                window.customAlert("❌ " + (e.message || "Ошибка применения амнистии"), () => {
                    setTimeout(window.openTrustModal, 100);
                });
            }
        });
    });

    lockGlobalFunction('showShopModal', function({ title, subtitle, confirmText, confirmClass, showCancel = true, onConfirm }) {
        const old = document.querySelector('.custom-confirm-overlay'); if (old) old.remove();
        const overlay = document.createElement('div'); overlay.className = 'custom-confirm-overlay';

        let cancelBtnHtml = showCancel ? `<button class="confirm-btn btn-cancel-modal" id="modal-cancel">Отмена</button>` : '';

        overlay.innerHTML = `
            <div class="custom-confirm-box">
                <h3 class="confirm-title">${title}</h3>
                <div class="confirm-subtitle" style="white-space: pre-wrap;">${subtitle}</div>
                <div class="confirm-buttons">
                    ${cancelBtnHtml}
                    <button class="confirm-btn ${confirmClass || 'btn-yellow-modal'}" id="modal-confirm">${confirmText}</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('visible'));

        const close = () => { overlay.classList.remove('visible'); setTimeout(() => overlay.remove(), 200); };
        if (showCancel) overlay.querySelector('#modal-cancel').onclick = close;

        const confirmBtn = overlay.querySelector('#modal-confirm');
        confirmBtn.onclick = () => { 
            if (confirmBtn.dataset.clicked) return; 
            confirmBtn.dataset.clicked = "true";    
            confirmBtn.style.opacity = "0.7";       
            onConfirm(close);                       
        };
        overlay.onclick = (e) => { if(e.target === overlay && showCancel) close(); };
    });

    lockGlobalFunction('customAlert', function(message, callback) {
        window.showShopModal({
            title: "Внимание", subtitle: message, confirmText: "ПОНЯТНО", confirmClass: "btn-yellow-modal", showCancel: false, 
            onConfirm: (close) => { close(); if(callback) callback(); }
        });
    });

    lockGlobalFunction('customConfirm', function(message, callback) {
        window.showShopModal({
            title: "Подтверждение", subtitle: message, confirmText: "ДА", confirmClass: "btn-yellow-modal", showCancel: true,
            onConfirm: (close) => { close(); if (callback) callback(true); }
        });
    });

    lockGlobalFunction('renderBalanceUI', function(coins, tickets) {
        const displayBalance = (coins !== undefined && coins !== null && coins !== '')
            ? Number(coins).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
            : '<i class="fa-solid fa-spinner fa-spin" style="font-size: 10px;"></i>';

        const balanceEl = document.getElementById('user-balance');
        if (balanceEl && balanceEl.innerHTML !== displayBalance) { 
            balanceEl.innerHTML = displayBalance; 
        }

        const displayTickets = (tickets !== undefined && tickets !== null && tickets !== '')
            ? Number(tickets).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
            : '<i class="fa-solid fa-spinner fa-spin" style="font-size: 10px;"></i>';

        const ticketsEl = document.getElementById('ticketStats');
        if (ticketsEl && ticketsEl.innerHTML !== displayTickets) { 
            ticketsEl.innerHTML = displayTickets; 
        }
    });

    let isBalanceLoading = false;
    lockGlobalFunction('checkBalance', async function(updateUI = true, forceSync = false) {
        if (!window.isVk && (!window.Telegram || !window.Telegram.WebApp || !window.Telegram.WebApp.initData)) return Promise.resolve();

        if (isBalanceLoading) return Promise.resolve();
        isBalanceLoading = true;

        const iconCoins = document.getElementById('refresh-icon');
        if (iconCoins) iconCoins.classList.add('fa-spin');

        if (updateUI && !forceSync) {
            try {
                const cached = JSON.parse(localStorage.getItem('smart_balance_cache'));
                if (cached) window.renderBalanceUI(cached.balance, cached.tickets);

                const cachedLimits = JSON.parse(localStorage.getItem('activity_limits_cache'));
                if (cachedLimits && typeof window.updateActivityLockUI === 'function') {
                    window.updateActivityLockUI(cachedLimits);
                }
            } catch(e) {}
        }

        try {
            if(typeof window.makeApiRequest !== 'function') throw new Error("makeApiRequest not found");

            const url = forceSync ? '/api/v1/shop/smart_balance?force=true' : '/api/v1/shop/smart_balance';

            const [data, limitsData] = await Promise.all([
                window.makeApiRequest(url, {}, 'POST', true),
                window.makeApiRequest('/api/v1/user/limits', {}, 'POST', true).catch(() => null)
            ]);

            if (updateUI && data) {
                localStorage.setItem('smart_balance_cache', JSON.stringify(data));
                window.renderBalanceUI(data.balance, data.tickets);
            }

            if (limitsData && typeof window.updateActivityLockUI === 'function') {
                localStorage.setItem('activity_limits_cache', JSON.stringify(limitsData));
                window.updateActivityLockUI(limitsData);
            }

        } catch (err) {
            console.error("Ошибка баланса/лимитов:", err);
        } finally {
            isBalanceLoading = false; 
            setTimeout(() => { 
                const currentIcon = document.getElementById('refresh-icon');
                if (currentIcon) currentIcon.classList.remove('fa-spin'); 
            }, 500); 
        }
    });

    lockGlobalFunction('openCouponModal', () => {
        const m = document.getElementById('coupon-modal');
        if(m) m.classList.remove('hidden');
        const i = document.getElementById('coupon-input');
        if(i) i.value = '';
    });

    lockGlobalFunction('closeCouponModal', () => {
        const m = document.getElementById('coupon-modal');
        if(m) m.classList.add('hidden');
    });

    lockGlobalFunction('pasteCoupon', async () => {
        try {
            const text = await navigator.clipboard.readText();
            const i = document.getElementById('coupon-input');
            if(i) i.value = text;
            if (window.Telegram?.WebApp?.HapticFeedback) Telegram.WebApp.HapticFeedback.selectionChanged();
        } catch (err) {
            window.customAlert('Не удалось вставить текст. Проверьте разрешения браузера.');
        }
    });

    lockGlobalFunction('activateCouponSubmit', async () => {
        const input = document.getElementById('coupon-input');
        if(!input) return;
        const code = input.value.trim(); 
        if (!code) return window.customAlert("Введите промокод!");

        const btn = document.getElementById('activate-coupon-btn');
        const originalHtml = btn ? btn.innerHTML : '';
        if(btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Проверка...'; }

        try {
            if(typeof window.makeApiRequest !== 'function') throw new Error("makeApiRequest not found");
            const res = await window.makeApiRequest('/api/cs/check_code', { code: code }, 'POST');
            if (res.valid) {
                window.customAlert("✅ " + res.message);
                window.closeCouponModal();
                if (!window.activeFreeCases) window.activeFreeCases = [];
                if (res.target_case_name && !window.activeFreeCases.includes(res.target_case_name)) {
                    window.activeFreeCases.push(res.target_case_name);
                }
                const shopTab = document.querySelector('.toggle-option[data-target="view-shop"]');
                if (shopTab) shopTab.click();
                if(typeof window.loadCategory === 'function') window.loadCategory(window.currentCategoryId || 2716312); 
            } else {
                window.customAlert("❌ " + res.message);
            }
        } catch (e) {
            console.error(e);
        } finally {
            if(btn) { btn.disabled = false; btn.innerHTML = originalHtml; }
        }
    });

    lockGlobalFunction('showFaq', function() {
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

        window.showShopModal({
            title: "📖 Как работает бот?",
            subtitle: faqHtml,
            confirmText: "Спасибо!",
            confirmClass: "btn-yellow-modal",
            showCancel: false,
            onConfirm: (close) => close()
        });
    });

    lockGlobalFunction('openActivityLockModal', () => {
        const m = document.getElementById('activity-lock-modal');
        if(m) m.classList.remove('hidden');

        setTimeout(() => {
            document.getElementById('modal-money-bar').style.width = window._al_money_percent || '0%';
            document.getElementById('modal-items-bar').style.width = window._al_items_percent || '0%';
            document.getElementById('modal-msgs-bar').style.width = window._al_msgs_percent || '0%';
        }, 50);
    });

    lockGlobalFunction('closeActivityLockModal', () => {
        const m = document.getElementById('activity-lock-modal');
        if(m) m.classList.add('hidden');

        document.getElementById('modal-money-bar').style.width = '0%';
        document.getElementById('modal-items-bar').style.width = '0%';
        document.getElementById('modal-msgs-bar').style.width = '0%';
    });

    // 🔥 ГЛАВНАЯ ФУНКЦИЯ ОБНОВЛЕНИЯ ДАННЫХ 🔥
    lockGlobalFunction('updateActivityLockUI', (data) => {
        if(!data) return;

        const dot = document.getElementById('ui-trust-dot');
        const text = document.getElementById('ui-trust-text');
        const summary = document.getElementById('ui-limits-summary');

        if (dot && text) {
            // 1. Достаем точный счет (из пришедших лимитов или из кэша)
            let scoreVal = 30.0;
            if (data.trust_score !== undefined) {
                scoreVal = parseFloat(data.trust_score);
            } else {
                try {
                    const cached = JSON.parse(localStorage.getItem('cache_bootstrap') || '{}');
                    if (cached?.user?.trust_score !== undefined) scoreVal = parseFloat(cached.user.trust_score);
                    else if (window.userData?.trust_score !== undefined) scoreVal = parseFloat(window.userData.trust_score);
                } catch(e) {}
            }

            // 2. Убираем десятичные (округляем вниз до целого)
            const intScore = Math.floor(scoreVal);

            dot.className = 'trust-dot'; 
            if(data.trust_level === 'green' || intScore >= 70) { 
                dot.style.background = '#34c759';
                dot.style.boxShadow = '0 0 12px rgba(52, 199, 89, 0.8)';
                text.innerText = `ТРАСТ: ${intScore} (ВЫС)`; 
                text.style.color = '#34c759'; 
                text.style.textShadow = '0 0 10px rgba(52, 199, 89, 0.5)'; 
            }
            else if(data.trust_level === 'red' || intScore < 30) { 
                dot.style.background = '#ff453a'; 
                dot.style.boxShadow = '0 0 8px rgba(255,69,58,0.6)'; 
                text.innerText = `ТРАСТ: ${intScore} (НИЗК)`; 
                text.style.color = '#ff453a'; 
                text.style.textShadow = 'none';
            }
            else { 
                dot.style.background = '#8e8e93'; 
                dot.style.boxShadow = 'none'; 
                text.innerText = `ТРАСТ: ${intScore} (БАЗ)`; 
                text.style.color = '#8e8e93'; 
                text.style.textShadow = 'none';
            }
        }
        if (summary) {
            const prefix = '<span style="color: #8e8e93; font-weight: 800; font-size: 8px; letter-spacing: 0.5px;">ЛИМИТ ВЫВОДА:</span>';

            if (data.spent_money >= data.money_limit || data.spent_items >= data.items_limit) {
                summary.innerHTML = `${prefix} <span style="color: #ff453a; font-weight: 800;">ИСЧЕРПАН</span>`;
            } else {
                summary.innerHTML = `${prefix} <span style="color: #fff; font-weight: 800;">${data.spent_items}/${data.items_limit} ШТ</span> <span style="color: rgba(255,255,255,0.2); margin: 0 2px;">•</span> <span style="color: #fff; font-weight: 800;">${Math.round(data.spent_money)}/${data.money_limit} ₽</span>`;
            }
        }

        const moneyPercent = Math.min((data.spent_money / data.money_limit) * 100, 100);
        const itemsPercent = Math.min((data.spent_items / data.items_limit) * 100, 100);
        const msgsPercent = Math.min((data.current_msgs / data.required_msgs) * 100, 100);

        window._al_money_percent = `${moneyPercent}%`;
        window._al_items_percent = `${itemsPercent}%`;
        window._al_msgs_percent = `${msgsPercent}%`;

        const moneyTitleEl = document.querySelector('.lock-section-title i.fa-wallet')?.parentNode;
        const moneyDescEl = document.getElementById('modal-money-desc');

        if (moneyTitleEl) {
            if (data.is_critical) {
                moneyTitleEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color: #ff453a;"></i> БЮДЖЕТ БОТА (на всех)`;
                moneyTitleEl.style.color = "#ff453a";
                if (moneyDescEl) moneyDescEl.innerHTML = `Суточный лимит выводов. Разделяется между <strong>всеми игроками</strong>.`;
            } else {
                moneyTitleEl.innerHTML = `<i class="fa-solid fa-wallet" style="color: rgba(255,255,255,0.5);"></i> Бюджет на вывод`;
                moneyTitleEl.style.color = "#fff";
                if (moneyDescEl) moneyDescEl.innerHTML = `Личный финансовый потолок за 7 дней. Зависит от <strong>Траста</strong>.`;
            }
        }

        document.getElementById('modal-money-val').innerText = `${Math.round(data.spent_money)} / ${data.money_limit} ₽`;
        document.getElementById('modal-items-val').innerText = `${data.spent_items} / ${data.items_limit} шт.`;
        document.getElementById('modal-msgs-val').innerText = `${data.current_msgs} / ${data.required_msgs}`;

        const moneyBar = document.getElementById('modal-money-bar');
        const itemsBar = document.getElementById('modal-items-bar');
        const msgsBar = document.getElementById('modal-msgs-bar');

        if(moneyPercent >= 100) moneyBar.classList.add('fill-danger'); else moneyBar.classList.remove('fill-danger');
        if(itemsPercent >= 100) itemsBar.classList.add('fill-danger'); else itemsBar.classList.remove('fill-danger');

        if(msgsPercent < 100) {
            msgsBar.classList.remove('fill-danger');
            document.getElementById('modal-msgs-desc').innerHTML = `Осталось <b style="color:#fff">${data.required_msgs - data.current_msgs}</b> сообщений.`;
        } else {
            document.getElementById('modal-msgs-desc').innerHTML = `<span style="color: #fff; font-weight: 800; text-shadow: 0 0 10px rgba(255,255,255,0.3);"><i class="fa-solid fa-check" style="margin-right: 4px;"></i> Активность выполнена</span>`;
        }

        if (window.alTimer) clearInterval(window.alTimer);
        const timeEl = document.getElementById('modal-unlock-time');
        const detailsEl = document.getElementById('modal-unlock-details');

        timeEl.innerHTML = "";
        if (detailsEl) detailsEl.style.display = 'none'; // По умолчанию скрываем

        // 🔥 НОВАЯ ЛОГИКА: ТАЙМЕР + ДЕТАЛИ СГОРАНИЯ 🔥
        // ИСПРАВЛЕНИЕ: Теперь показываем таймер всегда, если есть дата (data.unlock_time_iso)
        if (data.unlock_time_iso) {
            const targetDate = new Date(data.unlock_time_iso).getTime();

            if (detailsEl) {
                if (data.is_critical) {
                    // Теперь для общака тоже показываем точную сумму возврата!
                    detailsEl.innerHTML = `Из суточного лимита лавки сгорит старая покупка. Для вывода будет доступно: <b style="color:#34c759">+${Math.round(data.next_unlock_money)} ₽</b>`;
                    detailsEl.style.display = 'block';
                } else if (data.next_unlock_money) {
                    detailsEl.innerHTML = `Ближайшая покупка сгорит и освободит: <b style="color:#34c759">+${Math.round(data.next_unlock_money)} ₽</b> и <b style="color:#34c759">+1 шт.</b>`;
                    detailsEl.style.display = 'block';
                }
            }

            const tick = () => {
                const now = new Date().getTime();
                const dist = targetDate - now;

                if (dist <= 0) {
                    clearInterval(window.alTimer);
                    timeEl.innerHTML = `<span style="color: #34c759; font-weight: 800;">Лимиты обновлены! Обновите страницу.</span>`;
                    if (detailsEl) detailsEl.style.display = 'none';
                    return;
                }

                const d = Math.floor(dist / (1000 * 60 * 60 * 24));
                const h = Math.floor((dist % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const m = Math.floor((dist % (1000 * 60 * 60)) / (1000 * 60));
                const s = Math.floor((dist % (1000 * 60)) / 1000);

                const hh = String(h).padStart(2, '0');
                const mm = String(m).padStart(2, '0');
                const ss = String(s).padStart(2, '0');

                const timerText = d > 0 ? `${d} дн. ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`;

                // Если лимит заблокирован полностью (150/150), пишем строго. Если еще есть место (135/150) — мягко.
                const isBlocked = (moneyPercent >= 100 || itemsPercent >= 100);
                const prefix = isBlocked ? "ЗАБРАТЬ СКИН МОЖНО ЧЕРЕЗ:" : "СЛЕДУЮЩЕЕ ВОССТАНОВЛЕНИЕ:";
                const color = isBlocked ? "#ffcc00" : "#34c759";

                timeEl.innerHTML = `<span style="color: rgba(255,255,255,0.5);">${prefix}</span> <span style="color: ${color}; font-weight: 800; font-family: 'SF Mono', monospace;">${timerText}</span>`;
            };

            tick();
            window.alTimer = setInterval(tick, 1000);

        } else if (data.unlock_time) {
            // Если покупок нет вообще (0/150), просто пишем статус
            timeEl.innerHTML = `<span style="color: rgba(255,255,255,0.5);">Статус:</span> <span style="color: #fff; font-weight: 800;">${data.unlock_time}</span>`;
        }
    });

    // ==========================================
    // 5. ИНИЦИАЛИЗАЦИЯ И ЗАЩИТА DOM
    // ==========================================
    function bootstrap() {
        if (isInitialized) return;
        isInitialized = true;

        injectDOM();
        detectPlatforms();

        waitForDependencies(() => {
            window.checkBalance(true);
            checkAdminAccess();
        });

        moveShopButtonsToHeader();

        const observer = new MutationObserver(() => {
            if (window.location.pathname.includes('/admin')) return;
            if (!document.getElementById('universal-top-header')) {
                console.warn('HATElavka: Обнаружено удаление шапки. Восстанавливаем...');
                injectDOM();
            }
            moveShopButtonsToHeader();
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
        bootstrap();
    }
})();
