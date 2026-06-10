(function() {
    const CARACAS_TZ = 'America/Caracas';
    const DAYS = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];
    const DAY_NAMES = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];

    // Categorías base + Procrastín (se añade dinámicamente si check-in activo)
    const BASE_CATEGORIES = [
        { id:'work', emoji:'💼', name:'Trabajo', bg:'#dbeafe', border:'#93c5fd', text:'#1e40af' },
        { id:'pareja', emoji:'💑', name:'Pareja', bg:'#fce7f3', border:'#f9a8d4', text:'#9d174d' },
        { id:'hijos', emoji:'👧', name:'Hijos', bg:'#e0f2fe', border:'#7dd3fc', text:'#075985' },
        { id:'familia', emoji:'👨‍👩‍👧', name:'Familia', bg:'#ffe4e6', border:'#fda4af', text:'#9f1239' },
        { id:'motos', emoji:'🏍️', name:'Mototurismo', bg:'#fef3c7', border:'#fcd34d', text:'#92400e' },
        { id:'aventuras', emoji:'🗺️', name:'Aventuras', bg:'#d1fae5', border:'#6ee7b7', text:'#065f46' },
        { id:'rrss', emoji:'📱', name:'Crear RRSS', bg:'#ede9fe', border:'#c4b5fd', text:'#5b21b6' }
    ];

    const PROCRASTIN_CATEGORY = { id:'procrastin', emoji:'👾', name:'Procrastín', bg:'#fee2e2', border:'#fca5a5', text:'#991b1b' };

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

    // Estado
    let weekData = JSON.parse(localStorage.getItem('timeflow_premium')) || {};
    let ideas = JSON.parse(localStorage.getItem('timeflow_ideas')) || [];
    let energy = JSON.parse(localStorage.getItem('timeflow_energy')) || { value: 3, history: [] };
    let darkMode = JSON.parse(localStorage.getItem('timeflow_dark')) || false;
    let weeklyGoals = JSON.parse(localStorage.getItem('timeflow_goals')) || {};
    let customCategories = JSON.parse(localStorage.getItem('timeflow_custom_cats')) || [];
    let checkinEnabled = JSON.parse(localStorage.getItem('timeflow_checkin')) || false;

    // Combinar categorías
    let CATEGORIES = [...BASE_CATEGORIES];
    if (checkinEnabled) CATEGORIES.push(PROCRASTIN_CATEGORY);
    CATEGORIES = CATEGORIES.concat(customCategories);

    let currentDay = getCurrentDayCaracas();
    let selectedHour = null;
    let timerInterval = null;
    let timerSeconds = 300;

    let deferredPrompt = null;
    const btnInstall = document.getElementById('btn-install');
    const btnInstallHelp = document.getElementById('btn-install-help');
    const btnNotify = document.getElementById('btn-notify');
    const btnCheckinToggle = document.getElementById('btn-checkin-toggle');
    const btnCheckinNow = document.getElementById('btn-checkin-now');

    // Actualizar categorías cuando se cambia check-in o se añaden personalizadas
    function refreshCategories() {
        CATEGORIES = [...BASE_CATEGORIES];
        if (checkinEnabled) CATEGORIES.push(PROCRASTIN_CATEGORY);
        CATEGORIES = CATEGORIES.concat(customCategories);
    }

    // Modo oscuro
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

    // Hora Caracas
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

    // Inicialización de datos
    function initializeData() {
        DAYS.forEach(day => {
            if (!weekData[day]) {
                weekData[day] = {};
                for (let h = 0; h < 24; h++) weekData[day][h] = { category: 'free', verified: false };
                FIXED.forEach(b => {
                    if (b.label === 'Dormir') {
                        for (let h = 22; h <= 23; h++) weekData[day][h] = { category: 'fixed', verified: true };
                        for (let h = 0; h <= 5; h++) weekData[day][h] = { category: 'fixed', verified: true };
                    } else if (b.label === 'Almuerzo') {
                        weekData[day][13] = { category: 'fixed', verified: true };
                    }
                });
            }
        });

        if (Object.keys(weeklyGoals).length === 0) {
            CATEGORIES.forEach(c => weeklyGoals[c.id] = 0);
            localStorage.setItem('timeflow_goals', JSON.stringify(weeklyGoals));
        }
        saveData();
    }

    function saveData() {
        localStorage.setItem('timeflow_premium', JSON.stringify(weekData));
    }

    function saveGoals() {
        localStorage.setItem('timeflow_goals', JSON.stringify(weeklyGoals));
        renderLegend();
    }

    // Energía con historial
    function saveEnergy() {
        const today = new Date().toISOString().split('T')[0];
        const existing = energy.history.find(h => h.date === today);
        if (existing) {
            existing.value = energy.value;
        } else {
            energy.history.push({ date: today, value: energy.value });
        }
        // Mantener solo últimos 30 días
        if (energy.history.length > 30) energy.history.shift();
        localStorage.setItem('timeflow_energy', JSON.stringify(energy));
        renderEnergyAverage();
    }

    function renderEnergyAverage() {
        const container = document.getElementById('energy-average');
        if (!energy.history.length) return;
        const thisWeek = energy.history.filter(h => {
            const d = new Date(h.date);
            const now = getCaracasNow();
            const dayOfWeek = now.getDay();
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
            return d >= startOfWeek;
        });
        if (thisWeek.length === 0) return;
        const avg = thisWeek.reduce((sum, h) => sum + h.value, 0) / thisWeek.length;
        const emojis = ['😴','😐','🙂','💪','🚀'];
        const avgEmoji = emojis[Math.round(avg) - 1] || '⚡';
        container.textContent = `Tu energía promedio: ${avgEmoji} ${avg.toFixed(1)}`;
    }

    // Metas semanales
    window.editGoal = function(catId) {
        const current = weeklyGoals[catId] || 0;
        const input = prompt(`Define la meta semanal de horas para esta categoría:\nActual: ${current}h`, current);
        if (input !== null) {
            const val = parseInt(input);
            if (!isNaN(val) && val >= 0) {
                weeklyGoals[catId] = val;
                saveGoals();
            } else {
                alert("Por favor ingresa un número válido de horas.");
            }
        }
    };

    // Renderizado principal
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
            const slot = data[h] || { category: 'free', verified: false };
            const isFixed = slot.category === 'fixed';
            let displayHour = h % 12 || 12, ampm = h < 12 ? 'AM' : 'PM';
            let bg = 'background:#fff; border:2px dashed #cbd5e1;';
            let label = 'Libre';
            if (isFixed) {
                bg = 'background:#f1f5f9; border-color:#e2e8f0; color:#64748b;';
                const fb = FIXED.find(b => (b.label==='Dormir' && (h>=22||h<=5)) || (b.label==='Almuerzo' && h===13));
                label = fb ? fb.emoji+' '+fb.label : 'Fijo';
            } else if (slot.category === 'free') {
                bg = 'background:#fff; border:2px dashed #a5b4fc;';
            } else {
                const cat = CATEGORIES.find(c => c.id === slot.category);
                if (cat) {
                    bg = `background:${cat.bg}; border:1px solid ${cat.border}; color:${cat.text};`;
                    label = cat.emoji + ' ' + cat.name;
                    if (checkinEnabled && !slot.verified && slot.category !== 'procrastin') {
                        label += ' ⚠️';
                    }
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
        container.style.gridTemplateColumns = '1fr';
        container.innerHTML = CATEGORIES.map(cat => {
            const today = countHours(cat.id, currentDay);
            const weekTotal = DAYS.reduce((sum, d) => sum + countHours(cat.id, d), 0);
            const goal = weeklyGoals[cat.id] || 0;
            let percent = 0;
            if (goal > 0) percent = Math.min(100, Math.round((weekTotal / goal) * 100));
            const barColor = weekTotal >= goal && goal > 0 ? '#10b981' : cat.text;

            return `
            <div class="category-card" style="background:${cat.bg}; border-color:${cat.border}; color:${cat.text}; flex-direction:column; align-items:stretch; padding:0.8rem;">
                <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                    <span style="font-weight:600;">${cat.emoji} ${cat.name}</span>
                    <button onclick="editGoal('${cat.id}')" style="background:none;border:none;cursor:pointer;font-size:1.1rem;padding:0;" title="Editar meta">🎯</button>
                </div>
                <div style="font-size:0.75rem; margin-bottom:6px; opacity:0.9;">
                    Hoy: ${today}h · Sem: ${weekTotal}${goal > 0 ? '/'+goal+'h' : 'h'}
                </div>
                ${goal > 0 ? `
                <div style="width:100%; height:4px; background:rgba(0,0,0,0.1); border-radius:2px; overflow:hidden;">
                    <div style="width:${percent}%; height:100%; background:${barColor}; transition:width 0.5s;"></div>
                </div>` : '<div style="font-size:0.7rem; font-style:italic; opacity:0.7;">Toca 🎯 para fijar meta</div>'}
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
        for (let h = 0; h < 24; h++) {
            if (d[h] && d[h].category === catId) c++;
        }
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
            emoji.textContent = emojis[energy.value - 1];
            saveEnergy();
        });
        renderEnergyAverage();
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
            const dayData = weekData[currentDay];
            dayData[selectedHour] = { category: catId, verified: false };
            saveData();
        }
        closeModal();
        renderAll();
    }

    // Check-in
    function toggleCheckin() {
        checkinEnabled = !checkinEnabled;
        localStorage.setItem('timeflow_checkin', JSON.stringify(checkinEnabled));
        refreshCategories();
        if (checkinEnabled) {
            btnCheckinToggle.style.color = '#10b981';
            btnCheckinNow.style.display = 'block';
            alert('Check-in activado. Cada hora te preguntaré si realmente hiciste lo planeado.');
        } else {
            btnCheckinToggle.style.color = '';
            btnCheckinNow.style.display = 'none';
            // Limpiar procrastín si se desactiva
            DAYS.forEach(day => {
                const d = weekData[day] || {};
                for (let h = 0; h < 24; h++) {
                    if (d[h] && d[h].category === 'procrastin') {
                        d[h] = { category: 'free', verified: false };
                    }
                }
            });
            saveData();
        }
        renderAll();
    }

    function checkinNow() {
        const dayData = weekData[currentDay] || {};
        const unverified = [];
        for (let h = 0; h < 24; h++) {
            const slot = dayData[h] || { category: 'free', verified: false };
            if (slot.category !== 'free' && slot.category !== 'fixed' && !slot.verified) {
                unverified.push(h);
            }
        }
        if (unverified.length === 0) {
            alert('✅ Todas las horas están verificadas. ¡Buen trabajo!');
            return;
        }
        // Preguntar por cada hora no verificada
        let message = 'Horas no verificadas hoy:\n';
        unverified.forEach(h => {
            const cat = CATEGORIES.find(c => c.id === dayData[h].category);
            const name = cat ? cat.name : dayData[h].category;
            message += `• ${h}:00 - ${name}\n`;
        });
        message += '\n¿Quieres marcarlas como realizadas? (Aceptar = Sí, Cancelar = No, pasarán a Procrastín)';
        if (confirm(message)) {
            unverified.forEach(h => {
                dayData[h].verified = true;
            });
        } else {
            unverified.forEach(h => {
                dayData[h] = { category: 'procrastin', verified: true };
            });
        }
        saveData();
        renderAll();
    }

    // Categorías personalizadas
    function openNewCategoryModal() {
        document.getElementById('new-category-modal-overlay').classList.add('active');
        document.getElementById('new-category-modal-content').classList.add('active');
    }

    function closeNewCategoryModal() {
        document.getElementById('new-category-modal-content').classList.remove('active');
        setTimeout(() => document.getElementById('new-category-modal-overlay').classList.remove('active'), 200);
    }

    function saveNewCategory() {
        const name = document.getElementById('new-cat-name').value.trim();
        const emoji = document.getElementById('new-cat-emoji').value.trim() || '📌';
        if (!name) return alert('El nombre es obligatorio.');
        const id = 'custom_' + Date.now();
        const colors = ['#fef3c7','#d1fae5','#ede9fe','#fce7f3','#e0f2fe','#ffe4e6'];
        const bg = colors[Math.floor(Math.random() * colors.length)];
        const newCat = { id, emoji, name, bg, border: '#e2e8f0', text: '#1e293b' };
        customCategories.push(newCat);
        localStorage.setItem('timeflow_custom_cats', JSON.stringify(customCategories));
        refreshCategories();
        closeNewCategoryModal();
        renderAll();
    }

    // Ideas
    function openIdeaModal() {
        document.getElementById('idea-modal-overlay').classList.add('active');
        document.getElementById('idea-modal-content').classList.add('active');
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

    // Notificaciones
    function enableNotifications() {
        if ('Notification' in window) {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    btnNotify.style.display = 'none';
                    scheduleEveningReminder();
                }
            });
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

    if ('Notification' in window && Notification.permission === 'default') {
        if (btnNotify) btnNotify.style.display = 'block';
    }

    // Instalación nativa
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (btnInstall) {
            btnInstall.style.display = 'block';
            btnInstall.addEventListener('click', async () => {
                if (deferredPrompt) {
                    deferredPrompt.prompt();
                    const { outcome } = await deferredPrompt.userChoice;
                    console.log(`Instalación: ${outcome}`);
                    deferredPrompt = null;
                    btnInstall.style.display = 'none';
                    if (btnInstallHelp) btnInstallHelp.style.display = 'none';
                }
            });
        }
    });

    window.addEventListener('appinstalled', () => {
        if (btnInstall) btnInstall.style.display = 'none';
        if (btnInstallHelp) btnInstallHelp.style.display = 'none';
        deferredPrompt = null;
    });

    setTimeout(() => {
        if (!deferredPrompt && btnInstall && btnInstall.style.display === 'none') {
            if (btnInstallHelp) {
                btnInstallHelp.style.display = 'block';
                btnInstallHelp.addEventListener('click', () => {
                    alert('Para instalar la app: toca el menú ⋮ → "Agregar a la pantalla de inicio".');
                });
            }
        }
    }, 3000);

    // Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js')
                .then(reg => console.log('SW registrado'))
                .catch(err => console.warn('Error SW', err));
        });
    }

    // Event Listeners
    document.getElementById('btn-dark-mode').addEventListener('click', toggleTheme);
    document.getElementById('btn-notify').addEventListener('click', enableNotifications);
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

    // Nuevos listeners
    btnCheckinToggle.addEventListener('click', toggleCheckin);
    btnCheckinNow.addEventListener('click', checkinNow);
    document.getElementById('btn-add-category').addEventListener('click', openNewCategoryModal);
    document.getElementById('btn-new-cat-cancel').addEventListener('click', closeNewCategoryModal);
    document.getElementById('btn-new-cat-save').addEventListener('click', saveNewCategory);
    document.getElementById('new-category-modal-overlay').addEventListener('click', function(e) {
        if (e.target === this) closeNewCategoryModal();
    });

    // Check-in automático cada hora (si está activo)
    setInterval(() => {
        if (checkinEnabled && document.visibilityState === 'visible') {
            checkinNow();
        }
    }, 3600000);

    // Inicio
    refreshCategories();
    applyTheme();
    initializeData();
    renderAll();
    setInterval(updateClock, 1000);
    setInterval(() => { updateProgress(); checkNight(); }, 60000);
})();
