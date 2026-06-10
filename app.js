(function() {
    const CARACAS_TZ = 'America/Caracas';
    const DAYS = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];
    const DAY_NAMES = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
    const CATEGORIES = [
        { id:'work', emoji:'💼', name:'Trabajo', bg:'#dbeafe', border:'#93c5fd', text:'#1e40af' },
        { id:'pareja', emoji:'💑', name:'Pareja', bg:'#fce7f3', border:'#f9a8d4', text:'#9d174d' },
        { id:'hijos', emoji:'👧', name:'Hijos', bg:'#e0f2fe', border:'#7dd3fc', text:'#075985' },
        { id:'familia', emoji:'👨‍👩‍👧', name:'Familia', bg:'#ffe4e6', border:'#fda4af', text:'#9f1239' },
        { id:'motos', emoji:'🏍️', name:'Mototurismo', bg:'#fef3c7', border:'#fcd34d', text:'#92400e' },
        { id:'aventuras', emoji:'🗺️', name:'Aventuras', bg:'#d1fae5', border:'#6ee7b7', text:'#065f46' },
        { id:'rrss', emoji:'📱', name:'Crear RRSS', bg:'#ede9fe', border:'#c4b5fd', text:'#5b21b6' }
    ];
    const FIXED = [
        { start:22, end:6, label:'Dormir', emoji:'😴' },
        { start:13, end:14, label:'Almuerzo', emoji:'🍽️' }
    ];
    const QUOTES = [
        "Un paso pequeño sigue siendo un paso.",
        "No necesitas ser perfecto, solo necesitas empezar.",
        "Tu cerebro no está roto, funciona diferente.",
        "Hoy puedes honrar lo que amas con 5 minutos de acción.",
        "La disciplina no es hacerlo todo, es hacer lo importante.",
        "El tiempo con los tuyos es el mejor proyecto.",
        "Las ideas sin acción son sueños; con acción, son vida."
    ];

    let weekData = JSON.parse(localStorage.getItem('timeflow_premium')) || {};
    let ideas = JSON.parse(localStorage.getItem('timeflow_ideas')) || [];
    let energy = JSON.parse(localStorage.getItem('timeflow_energy')) || { value: 3 };
    let darkMode = JSON.parse(localStorage.getItem('timeflow_dark')) || false;
    let currentDay = getCurrentDayCaracas();
    let selectedHour = null;
    let timerInterval = null;
    let timerSeconds = 300;

    function applyTheme() {
        if (darkMode) {
            document.body.classList.add('dark');
            document.getElementById('btn-dark-mode').textContent = '☀️';
        } else {
            document.body.classList.remove('dark');
            document.getElementById('btn-dark-mode').textContent = '🌓';
        }
    }

    function toggleTheme() {
        darkMode = !darkMode;
        localStorage.setItem('timeflow_dark', JSON.stringify(darkMode));
        applyTheme();
    }

    function getCaracasNow() {
        try {
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: CARACAS_TZ, hour12: false, hour:'2-digit', minute:'2-digit',
                weekday:'long', day:'2-digit', month:'2-digit', year:'numeric'
            });
            const parts = formatter.formatToParts(new Date());
            const obj = {};
            parts.forEach(p => { if(p.type !== 'literal') obj[p.type] = p.value; });
            return new Date(`${obj.year}-${obj.month}-${obj.day}T${obj.hour}:${obj.minute}:00-04:00`);
        } catch(e) {
            const now = new Date();
            const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
            return new Date(utc - (4 * 3600000));
        }
    }

    function getCurrentDayCaracas() {
        const dayIdx = (getCaracasNow().getDay() + 6) % 7;
        return DAYS[dayIdx];
    }

    function getWeekHoursLeft() {
        const now = getCaracasNow();
        const dayOfWeek = now.getDay();
        const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
        const endOfWeek = new Date(now);
        endOfWeek.setDate(now.getDate() + daysUntilSunday);
        endOfWeek.setHours(23, 59, 59, 999);
        return Math.max(0, Math.floor((endOfWeek - now) / 3600000));
    }

    function initializeData() {
        DAYS.forEach(day => {
            if (!weekData[day]) {
                weekData[day] = {};
                for (let h = 0; h < 24; h++) weekData[day][h] = 'free';
                FIXED.forEach(b => {
                    if (b.label === 'Dormir') {
                        for (let h = 22; h <= 23; h++) weekData[day][h] = 'fixed';
                        for (let h = 0; h <= 5; h++) weekData[day][h] = 'fixed';
                    } else if (b.label === 'Almuerzo') {
                        weekData[day][13] = 'fixed';
                    }
                });
            }
        });
        saveData();
    }

    function saveData() { localStorage.setItem('timeflow_premium', JSON.stringify(weekData)); }

    function renderAll() {
        updateClock();
        renderDayTabs();
        renderTimeline();
        renderLegend();
        updateProgress();
        checkNight();
        renderEnergy();
        document.getElementById('daily-quote').textContent = `“${QUOTES[Math.floor(Math.random() * QUOTES.length)]}”`;
    }

    function updateClock() {
        const now = getCaracasNow();
        let h = now.getHours(), m = String(now.getMinutes()).padStart(2, '0');
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        document.getElementById('live-clock').textContent = `${h}:${m} ${ampm}`;
    }

    function renderDayTabs() {
        const container = document.getElementById('day-tabs');
        container.innerHTML = DAYS.map(day => {
            const cls = day === currentDay ? 'day-tab active' : 'day-tab';
            return `<div class="${cls}" data-day="${day}">${DAY_NAMES[DAYS.indexOf(day)]}</div>`;
        }).join('');
        container.querySelectorAll('.day-tab').forEach(tab => {
            tab.addEventListener('click', () => switchDay(tab.dataset.day));
        });
    }

    function renderTimeline() {
        const data = weekData[currentDay] || {};
        const container = document.getElementById('timeline');
        let html = '';
        for (let h = 0; h < 24; h++) {
            const status = data[h] || 'free';
            const isFixed = status === 'fixed';
            let displayHour = h % 12 || 12, ampm = h < 12 ? 'AM' : 'PM';
            let bg = 'background:#fff; border:2px dashed #cbd5e1;';
            let label = 'Libre';
            if (isFixed) {
                bg = 'background:#f1f5f9; border-color:#e2e8f0; color:#64748b;';
                const fb = FIXED.find(b => (b.label==='Dormir' && (h>=22||h<=5)) || (b.label==='Almuerzo' && h===13));
                label = fb ? fb.emoji+' '+fb.label : 'Fijo';
            } else if (status === 'free') {
                bg = 'background:#fff; border:2px dashed #a5b4fc;';
            } else {
                const cat = CATEGORIES.find(c => c.id === status);
                if (cat) {
                    bg = `background:${cat.bg}; border:1px solid ${cat.border}; color:${cat.text};`;
                    label = cat.emoji + ' ' + cat.name;
                }
            }
            html += `<div class="timeline-slot ${isFixed ? 'fixed' : ''}" style="${bg}" data-hour="${h}">
                <span class="hour">${displayHour}:00 ${ampm}</span>
                <span class="label">${label}</span>
            </div>`;
        }
        container.innerHTML = html;
        container.querySelectorAll('.timeline-slot:not(.fixed)').forEach(slot => {
            slot.addEventListener('click', () => openModal(parseInt(slot.dataset.hour)));
        });
    }

    function renderLegend() {
        const container = document.getElementById('categories-legend');
        container.innerHTML = CATEGORIES.map(cat => {
            const today = countHours(cat.id, currentDay);
            const week = DAYS.reduce((sum, d) => sum + countHours(cat.id, d), 0);
            return `<div class="category-card" style="background:${cat.bg}; border-color:${cat.border}; color:${cat.text};">
                <span>${cat.emoji} ${cat.name}</span><span>Hoy ${today}h · Sem ${week}h</span>
            </div>`;
        }).join('');
    }

    function updateProgress() {
        const left = getWeekHoursLeft();
        const total = 7 * 24, elapsed = total - left;
        document.getElementById('week-hours-left').innerHTML = `${left}<span> horas restantes</span>`;
        document.getElementById('week-progress-bar').style.width = `${Math.round((elapsed / total) * 100)}%`;
        document.getElementById('current-day-badge').textContent = DAY_NAMES[DAYS.indexOf(currentDay)];
    }

    function countHours(catId, day) {
        let c = 0;
        const d = weekData[day] || {};
        for (let h = 0; h < 24; h++) if (d[h] === catId) c++;
        return c;
    }

    function checkNight() {
        const h = getCaracasNow().getHours();
        document.getElementById('night-warning').style.display = (h >= 0 && h < 6) ? 'block' : 'none';
    }

    function renderEnergy() {
        const slider = document.getElementById('energy-slider');
        const emoji = document.getElementById('energy-emoji');
        slider.value = energy.value;
        const emojis = ['😴','😐','🙂','💪','🚀'];
        emoji.textContent = emojis[energy.value - 1] || '⚡';
        slider.addEventListener('input', () => {
            energy.value = parseInt(slider.value);
            localStorage.setItem('timeflow_energy', JSON.stringify(energy));
            emoji.textContent = emojis[energy.value - 1];
        });
    }

    function switchDay(day) { currentDay = day; renderAll(); }

    function openModal(hour) {
        selectedHour = hour;
        const optionsContainer = document.getElementById('modal-options');
        optionsContainer.innerHTML = CATEGORIES.map(c =>
            `<div class="modal-option" style="background:${c.bg}; border-color:${c.border}; color:${c.text};" data-cat="${c.id}">${c.emoji} ${c.name}</div>`
        ).join('');
        optionsContainer.querySelectorAll('.modal-option').forEach(opt => {
            opt.addEventListener('click', () => assignCategory(opt.dataset.cat));
        });
        document.getElementById('modal-overlay').classList.add('active');
        setTimeout(() => document.getElementById('modal-content').classList.add('active'), 10);
    }

    function closeModal() {
        document.getElementById('modal-content').classList.remove('active');
        setTimeout(() => document.getElementById('modal-overlay').classList.remove('active'), 200);
        selectedHour = null;
    }

    function assignCategory(catId) {
        if (selectedHour !== null) {
            weekData[currentDay][selectedHour] = catId;
            saveData();
        }
        closeModal();
        renderAll();
    }

    function openIdeaModal() {
        document.getElementById('idea-modal-overlay').classList.add('active');
        setTimeout(() => document.getElementById('idea-modal-content').classList.add('active'), 10);
        renderIdeas();
    }

    function closeIdeaModal() {
        document.getElementById('idea-modal-content').classList.remove('active');
        setTimeout(() => document.getElementById('idea-modal-overlay').classList.remove('active'), 200);
    }

    function saveIdea() {
        const input = document.getElementById('idea-input');
        const text = input.value.trim();
        if (text) {
            ideas.unshift({ text, date: new Date().toISOString() });
            localStorage.setItem('timeflow_ideas', JSON.stringify(ideas));
            input.value = '';
            renderIdeas();
        }
    }

    function deleteIdea(index) {
        ideas.splice(index, 1);
        localStorage.setItem('timeflow_ideas', JSON.stringify(ideas));
        renderIdeas();
    }

    function renderIdeas() {
        const list = document.getElementById('ideas-list');
        list.innerHTML = ideas.map((idea, i) => `
            <div class="idea-item">
                <span>${idea.text}</span>
                <button class="delete-idea" data-index="${i}">✕</button>
            </div>`).join('');
        list.querySelectorAll('.delete-idea').forEach(btn => {
            btn.addEventListener('click', () => deleteIdea(parseInt(btn.dataset.index)));
        });
    }

    function startTimer() {
        timerSeconds = 300;
        document.getElementById('timer-panel').style.display = 'block';
        updateTimerDisplay();
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            timerSeconds--;
            updateTimerDisplay();
            if (timerSeconds <= 0) {
                clearInterval(timerInterval);
                timerInterval = null;
                if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
                alert('✨ ¡Lo lograste! Solo necesitabas empezar. Sigue así.');
                document.getElementById('timer-panel').style.display = 'none';
            }
        }, 1000);
    }

    function stopTimer() {
        if (timerInterval) clearInterval(timerInterval);
        document.getElementById('timer-panel').style.display = 'none';
    }

    function updateTimerDisplay() {
        const m = Math.floor(timerSeconds / 60);
        const s = timerSeconds % 60;
        document.getElementById('timer-display').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    function requestNotificationPermission() {
        if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            Notification.requestPermission();
        }
    }

    function scheduleEveningReminder() {
        const now = getCaracasNow();
        const reminderHour = 21;
        let reminderTime = new Date(now);
        reminderTime.setHours(reminderHour, 0, 0, 0);
        if (now > reminderTime) reminderTime.setDate(reminderTime.getDate() + 1);
        const msUntilReminder = reminderTime - now;
        setTimeout(() => {
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('TimeFlow', { body: '📅 Planifica tu día de mañana. Unos minutos ahora ahorran horas mañana.' });
            }
            scheduleEveningReminder();
        }, msUntilReminder);
    }

    // Event Listeners
    document.getElementById('btn-dark-mode').addEventListener('click', toggleTheme);
    document.getElementById('btn-focus').addEventListener('click', startTimer);
    document.getElementById('btn-cancel-timer').addEventListener('click', stopTimer);
    document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
    document.getElementById('modal-overlay').addEventListener('click', function(e) {
        if (e.target === this) closeModal();
    });
    document.getElementById('btn-idea').addEventListener('click', openIdeaModal);
    document.getElementById('btn-idea-cancel').addEventListener('click', closeIdeaModal);
    document.getElementById('btn-idea-save').addEventListener('click', saveIdea);
    document.getElementById('idea-modal-overlay').addEventListener('click', function(e) {
        if (e.target === this) closeIdeaModal();
    });

    // Registrar Service Worker (archivo externo sw.js)
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js')
                .then(reg => console.log('Service Worker registrado con éxito:', reg.scope))
                .catch(err => console.error('Error al registrar Service Worker:', err));
        });
    }

    applyTheme();
    initializeData();
    renderAll();
    requestNotificationPermission();
    scheduleEveningReminder();
    setInterval(updateClock, 1000);
    setInterval(() => { updateProgress(); checkNight(); }, 60000);
})();