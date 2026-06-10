// --- Estado Global ---
const state = {
    currentDate: new Date(),
    blocks: [], // { id, dayIndex (0-6), hour, duration, title, category, color }
    categories: [
        { id: 'work', name: 'Trabajo', color: '#3b82f6' },
        { id: 'study', name: 'Estudio', color: '#10b981' },
        { id: 'personal', name: 'Personal', color: '#f59e0b' },
        { id: 'health', name: 'Salud', color: '#ef4444' },
        { id: 'rest', name: 'Descanso', color: '#8b5cf6' }
    ],
    goals: {}, // { categoryId: hours }
    settings: { sound: 'none', volume: 0.5 },
    viewOffset: 0 // Semanas desplazadas
};

let chartInstance = null;
let audioContext = null;
let oscillator = null;
let focusTimer = null;
let isFocusActive = false;

// --- Inicialización ---
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    initNavigation();
    initModals();
    initSettings();
    initStats();
    initFocusMode();
    requestNotificationPermission();
    renderTimeline();
    startReminderLoop();
});

// --- Navegación y Renderizado ---
function initNavigation() {
    document.getElementById('prev-week').onclick = () => { state.viewOffset--; updateWeekLabel(); renderTimeline(); };
    document.getElementById('next-week').onclick = () => { state.viewOffset++; updateWeekLabel(); renderTimeline(); };
    document.getElementById('fab-add').onclick = () => openBlockModal();
    
    // Botón dinámico para modo enfoque si hay tarea ahora
    setInterval(() => {
        const now = new Date();
        const currentHour = now.getHours();
        const dayIndex = now.getDay(); // 0 Dom - 6 Sab
        // Ajuste simple para vista actual
        const hasTask = state.blocks.some(b => b.hour === currentHour && b.dayIndex === dayIndex && state.viewOffset === 0);
        document.getElementById('fab-focus').style.display = hasTask ? 'flex' : 'none';
        if(hasTask) {
            const task = state.blocks.find(b => b.hour === currentHour && b.dayIndex === dayIndex);
            document.getElementById('fab-focus').onclick = () => startFocusMode(task.title);
        }
    }, 60000);
}

function updateWeekLabel() {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + (state.viewOffset * 7));
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    const options = { month: 'short', day: 'numeric' };
    document.getElementById('current-week-label').textContent = 
        `${startOfWeek.toLocaleDateString('es-ES', options)} - ${endOfWeek.toLocaleDateString('es-ES', options)}`;
}

function renderTimeline() {
    const daysHeader = document.getElementById('days-header');
    const timelineBody = document.getElementById('timeline-body');
    
    daysHeader.innerHTML = '';
    timelineBody.innerHTML = '';
    
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + (state.viewOffset * 7));
    
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    
    // Header Días
    for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        const div = document.createElement('div');
        div.className = 'day-col';
        div.textContent = `${dayNames[i]} ${date.getDate()}`;
        daysHeader.appendChild(div);
    }
    
    // Cuerpo (Horas 6 AM a 10 PM)
    for (let hour = 6; hour <= 22; hour++) {
        const row = document.createElement('div');
        row.className = 'time-row';
        
        const label = document.createElement('div');
        label.className = 'time-label';
        label.textContent = `${hour}:00`;
        row.appendChild(label);
        
        for (let day = 0; day < 7; day++) {
            const cell = document.createElement('div');
            cell.className = 'day-cell';
            cell.dataset.day = day;
            cell.dataset.hour = hour;
            
            // Drag & Drop Events
            cell.ondragover = (e) => e.preventDefault();
            cell.ondrop = (e) => handleDrop(e, day, hour);
            
            // Click para crear
            cell.onclick = (e) => {
                if(e.target === cell) openBlockModal(day, hour);
            };
            
            row.appendChild(cell);
        }
        timelineBody.appendChild(row);
        
        // Render Bloques
        state.blocks.forEach(block => {
            if (block.hour === hour && block.dayIndex === day) {
                const blockEl = createBlockElement(block);
                // Posicionamiento absoluto dentro de la celda correspondiente sería complejo,
                // así que lo insertamos en la celda específica buscando en el DOM
                // Nota: Simplificación para este ejemplo: Los bloques se dibujan sobre las celdas
                // En una implementación real de grid, se usaría grid-row-start.
                // Aquí usaremos un enfoque de superposición absoluta calculada.
            }
        });
    }
    
    // Re-renderizar bloques sobre el contenedor absoluto para mejor control de altura
    // Limpiamos bloques anteriores si los hubiera en un contenedor dedicado
    const existingBlocks = document.querySelectorAll('.time-block');
    existingBlocks.forEach(b => b.remove());

    state.blocks.forEach(block => {
        const dayCol = document.querySelector(`.day-cell[data-day="${block.dayIndex}"]`);
        // Buscamos la fila de la hora correcta. 
        // Como las filas son horas enteras, necesitamos calcular el offset vertical si queremos medias horas.
        // Para simplificar: Cada fila es 60px.
        const rowHeight = 60;
        const topOffset = (block.hour - 6) * rowHeight; 
        
        // Encontrar la celda correcta en el DOM (la primera celda de ese día en esa hora no existe directamente así)
        // Mejor estrategia: Calcular posición absoluta respecto al timeline-body
        const dayIndexInRow = block.dayIndex;
        const rowIndex = block.hour - 6;
        const rows = document.querySelectorAll('.time-row');
        if(rows[rowIndex]) {
            const cells = rows[rowIndex].querySelectorAll('.day-cell');
            const targetCell = cells[dayIndexInRow];
            
            const blockEl = createBlockElement(block);
            blockEl.style.top = '2px';
            blockEl.style.height = `${(block.duration * rowHeight) - 4}px`;
            targetCell.appendChild(blockEl);
        }
    });
}

function createBlockElement(block) {
    const div = document.createElement('div');
    div.className = 'time-block';
    div.style.backgroundColor = block.color || '#4f46e5';
    div.draggable = true;
    div.innerHTML = `
        <div class="block-title">${block.title}</div>
        <div class="block-time">${block.hour}:00 - ${block.hour + block.duration}:00</div>
    `;
    
    div.onclick = (e) => { e.stopPropagation(); openBlockModal(null, null, block); };
    
    div.ondragstart = (e) => {
        div.classList.add('dragging');
        e.dataTransfer.setData('text/plain', JSON.stringify(block));
    };
    
    div.ondragend = () => div.classList.remove('dragging');
    
    return div;
}

function handleDrop(e, targetDay, targetHour) {
    e.preventDefault();
    const data = e.dataTransfer.getData('text/plain');
    if (!data) return;
    
    const block = JSON.parse(data);
    
    // Actualizar posición
    block.dayIndex = targetDay;
    block.hour = targetHour;
    
    saveData();
    renderTimeline();
}

// --- Gestión de Bloques (Modal) ---
function initModals() {
    // Lógica genérica de cierre
    document.querySelectorAll('.modal .btn-secondary, .modal .btn-danger').forEach(btn => {
        if(btn.id !== 'btn-delete-block' && btn.id !== 'btn-reset-app') {
            btn.onclick = () => document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
        }
    });
    
    // Formulario
    document.getElementById('block-form').onsubmit = (e) => {
        e.preventDefault();
        saveBlockFromForm();
    };
    
    document.getElementById('btn-delete-block').onclick = () => {
        const id = document.getElementById('block-id').value;
        if(id) {
            state.blocks = state.blocks.filter(b => b.id != id);
            saveData();
            renderTimeline();
            document.getElementById('modal-block').classList.remove('active');
        }
    };
}

function openBlockModal(day = null, hour = null, block = null) {
    const modal = document.getElementById('modal-block');
    const titleEl = document.getElementById('modal-title');
    const form = document.getElementById('block-form');
    
    // Llenar categorías
    const catSelect = document.getElementById('block-category');
    catSelect.innerHTML = '';
    state.categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.id;
        opt.textContent = cat.name;
        catSelect.appendChild(opt);
    });

    if (block) {
        titleEl.textContent = 'Editar Bloque';
        document.getElementById('block-id').value = block.id;
        document.getElementById('block-title').value = block.title;
        document.getElementById('block-category').value = block.category;
        document.getElementById('block-duration').value = block.duration;
        document.getElementById('block-day').value = block.dayIndex;
        document.getElementById('block-hour').value = block.hour;
        document.getElementById('btn-delete-block').style.display = 'block';
    } else {
        titleEl.textContent = 'Nuevo Bloque';
        form.reset();
        document.getElementById('block-id').value = '';
        document.getElementById('block-day').value = day !== null ? day : 0;
        document.getElementById('block-hour').value = hour !== null ? hour : 9;
        document.getElementById('btn-delete-block').style.display = 'none';
    }
    
    modal.classList.add('active');
}

function saveBlockFromForm() {
    const id = document.getElementById('block-id').value;
    const title = document.getElementById('block-title').value;
    const category = document.getElementById('block-category').value;
    const duration = parseFloat(document.getElementById('block-duration').value);
    const day = parseInt(document.getElementById('block-day').value);
    const hour = parseInt(document.getElementById('block-hour').value);
    
    const catObj = state.categories.find(c => c.id === category);
    
    if (id) {
        const block = state.blocks.find(b => b.id == id);
        if (block) {
            block.title = title;
            block.category = category;
            block.color = catObj ? catObj.color : '#4f46e5';
            block.duration = duration;
        }
    } else {
        state.blocks.push({
            id: Date.now(),
            dayIndex: day,
            hour: hour,
            duration: duration,
            title: title,
            category: category,
            color: catObj ? catObj.color : '#4f46e5'
        });
    }
    
    saveData();
    renderTimeline();
    document.getElementById('modal-block').classList.remove('active');
}

// --- Configuración ---
function initSettings() {
    document.getElementById('btn-settings').onclick = () => {
        document.getElementById('modal-settings').classList.add('active');
        renderSettingsTabs();
    };
    
    document.getElementById('btn-close-settings').onclick = () => {
        document.getElementById('modal-settings').classList.remove('active');
    };

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
        };
    });

    // Categorías
    document.getElementById('btn-add-category').onclick = () => {
        const name = prompt("Nombre de la nueva categoría:");
        if(name) {
            state.categories.push({ id: name.toLowerCase(), name, color: '#'+Math.floor(Math.random()*16777215).toString(16) });
            saveData();
            renderSettingsTabs();
        }
    };

    // Sonidos
    document.getElementById('sound-select').value = state.settings.sound;
    document.getElementById('sound-volume').value = state.settings.volume * 100;
    
    document.getElementById('sound-select').onchange = (e) => { state.settings.sound = e.target.value; saveData(); };
    document.getElementById('sound-volume').oninput = (e) => { state.settings.volume = e.target.value / 100; saveData(); };
    document.getElementById('btn-test-sound').onclick = playTestSound;

    // Backup
    document.getElementById('btn-export').onclick = exportData;
    document.getElementById('file-import').onchange = importData;
    document.getElementById('btn-reset-app').onclick = () => {
        if(confirm("¿Borrar todo?")) { localStorage.clear(); location.reload(); }
    };
}

function renderSettingsTabs() {
    // Categorías
    const catList = document.getElementById('categories-list');
    catList.innerHTML = '';
    state.categories.forEach((cat, idx) => {
        const div = document.createElement('div');
        div.className = 'category-item';
        div.innerHTML = `
            <input type="color" class="color-picker" value="${cat.color}" onchange="updateCategoryColor('${cat.id}', this.value)">
            <span>${cat.name}</span>
            <button class="btn-small btn-danger" onclick="removeCategory('${cat.id}')">X</button>
        `;
        catList.appendChild(div);
    });

    // Metas
    const goalsList = document.getElementById('goals-list');
    goalsList.innerHTML = '';
    state.categories.forEach(cat => {
        const currentVal = state.goals[cat.id] || 0;
        const div = document.createElement('div');
        div.className = 'goal-item';
        div.innerHTML = `
            <span style="width:100px">${cat.name}</span>
            <input type="number" min="0" step="0.5" value="${currentVal}" 
                onchange="updateGoal('${cat.id}', this.value)" style="width:60px"> hrs/sem
        `;
        goalsList.appendChild(div);
    });
}

window.updateCategoryColor = (id, color) => {
    const cat = state.categories.find(c => c.id === id);
    if(cat) { cat.color = color; saveData(); renderTimeline(); }
};
window.removeCategory = (id) => {
    if(confirm('¿Eliminar categoría?')) {
        state.categories = state.categories.filter(c => c.id !== id);
        saveData();
        renderSettingsTabs();
    }
};
window.updateGoal = (id, val) => {
    state.goals[id] = parseFloat(val);
    saveData();
};

// --- Estadísticas ---
function initStats() {
    document.getElementById('btn-stats').onclick = () => {
        document.getElementById('modal-stats').classList.add('active');
        renderStats();
    };
    document.getElementById('btn-close-stats').onclick = () => document.getElementById('modal-stats').classList.remove('active');
    
    document.getElementById('stats-prev').onclick = () => { state.viewOffset--; updateWeekLabel(); renderStats(); };
    document.getElementById('stats-next').onclick = () => { state.viewOffset++; updateWeekLabel(); renderStats(); };
    
    document.getElementById('btn-export-ics').onclick = exportToICS;
}

function renderStats() {
    const ctx = document.getElementById('stats-chart').getContext('2d');
    const labels = state.categories.map(c => c.name);
    const data = labels.map((_, i) => {
        const catId = state.categories[i].id;
        return state.blocks
            .filter(b => b.category === catId)
            .reduce((sum, b) => sum + b.duration, 0);
    });

    if(chartInstance) chartInstance.destroy();
    
    chartInstance = new Chart(ctx, {
        type: 'bar',
         {
            labels: labels,
            datasets: [{
                label: 'Horas',
                 data,
                backgroundColor: state.categories.map(c => c.color),
                borderRadius: 6
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // Detalles
    const details = document.getElementById('stats-details');
    details.innerHTML = '<h4>Progreso de Metas</h4>';
    state.categories.forEach(cat => {
        const total = data[labels.indexOf(cat.name)];
        const goal = state.goals[cat.id] || 0;
        const percent = goal > 0 ? Math.min(100, Math.round((total / goal) * 100)) : 0;
        
        const row = document.createElement('div');
        row.className = 'stat-row';
        row.innerHTML = `
            <span>${cat.name}: <strong>${total}h</strong></span>
            <span style="color:${percent >= 100 ? 'var(--success)' : 'var(--text-muted)'}">
                ${goal > 0 ? `${percent}% de ${goal}h` : 'Sin meta'}
            </span>
        `;
        details.appendChild(row);
    });
}

// --- Modo Enfoque ---
function initFocusMode() {
    document.getElementById('btn-pause-focus').onclick = togglePauseFocus;
    document.getElementById('btn-stop-focus').onclick = stopFocusMode;
}

function startFocusMode(taskName) {
    document.getElementById('modal-focus').classList.add('active');
    document.getElementById('focus-task-name').textContent = taskName || 'Tiempo de Enfoque';
    document.getElementById('btn-pause-focus').textContent = 'Pausar';
    
    let timeLeft = 25 * 60;
    const timerDisplay = document.getElementById('focus-timer');
    
    isFocusActive = true;
    playAmbientSound();
    
    if(focusTimer) clearInterval(focusTimer);
    
    focusTimer = setInterval(() => {
        if(!isFocusActive) return;
        timeLeft--;
        const m = Math.floor(timeLeft / 60).toString().padStart(2,'0');
        const s = (timeLeft % 60).toString().padStart(2,'0');
        timerDisplay.textContent = `${m}:${s}`;
        
        if(timeLeft <= 0) {
            stopFocusMode();
            alert("¡Tiempo terminado!");
            playNotificationSound();
        }
    }, 1000);
}

function togglePauseFocus() {
    isFocusActive = !isFocusActive;
    document.getElementById('btn-pause-focus').textContent = isFocusActive ? 'Pausar' : 'Reanudar';
}

function stopFocusMode() {
    isFocusActive = false;
    clearInterval(focusTimer);
    document.getElementById('modal-focus').classList.remove('active');
    stopAmbientSound();
}

// --- Sonidos (Web Audio API Simple) ---
function playAmbientSound() {
    stopAmbientSound();
    if(state.settings.sound === 'none') return;
    
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Simulación básica de ruido blanco/rosa o tonos suaves según selección
    // Para una app real, aquí se cargarían archivos MP3.
    // Usaremos un oscilador de baja frecuencia para "Ruido Blanco" simulado o tono drone
    oscillator.type = 'sine';
    oscillator.frequency.value = state.settings.sound === 'white' ? 100 : 200;
    
    gainNode.gain.value = state.settings.volume * 0.1; // Volumen bajo
    oscillator.start();
}

function stopAmbientSound() {
    if(oscillator) { try { oscillator.stop(); } catch(e){} oscillator = null; }
    if(audioContext) { try { audioContext.close(); } catch(e){} audioContext = null; }
}

function playTestSound() {
    playAmbientSound();
    setTimeout(stopAmbientSound, 2000);
}

function playNotificationSound() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
}

// --- Notificaciones y Recordatorios ---
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function startReminderLoop() {
    setInterval(() => {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMin = now.getMinutes();
        const dayIndex = now.getDay();
        
        // Recordatorio 30 min antes
        if(currentMin === 30) {
            const nextHour = currentHour + 1;
            const upcoming = state.blocks.find(b => b.dayIndex === dayIndex && b.hour === nextHour && state.viewOffset === 0);
            if(upcoming && Notification.permission === 'granted') {
                new Notification("Próxima actividad", { body: `En 30 min: ${upcoming.title}` });
            }
        }
        
        // Recordatorio nocturno 21:00
        if(currentHour === 21 && currentMin === 0) {
             if(Notification.permission === 'granted') {
                new Notification("Planifica mañana", { body: "¿Has organizado tu día siguiente?" });
            }
        }
    }, 60000);
}

// --- Persistencia y Utilidades ---
function saveData() {
    localStorage.setItem('timeflow_data', JSON.stringify({
        blocks: state.blocks,
        categories: state.categories,
        goals: state.goals,
        settings: state.settings
    }));
}

function loadData() {
    const data = localStorage.getItem('timeflow_data');
    if(data) {
        const parsed = JSON.parse(data);
        state.blocks = parsed.blocks || [];
        state.categories = parsed.categories || state.categories;
        state.goals = parsed.goals || {};
        state.settings = parsed.settings || state.settings;
    }
    updateWeekLabel();
}

function exportData() {
    const dataStr = "text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
        blocks: state.blocks,
        categories: state.categories,
        goals: state.goals,
        settings: state.settings,
        exportDate: new Date().toISOString()
    }));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "timeflow_backup.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

function importData(event) {
    const file = event.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const imported = JSON.parse(e.target.result);
            if(imported.blocks) state.blocks = imported.blocks;
            if(imported.categories) state.categories = imported.categories;
            if(imported.goals) state.goals = imported.goals;
            if(imported.settings) state.settings = imported.settings;
            saveData();
            renderTimeline();
            alert("Datos importados correctamente.");
        } catch(err) { alert("Error al importar archivo."); }
    };
    reader.readAsText(file);
}

function exportToICS() {
    let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//TimeFlow//ES\n";
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + (state.viewOffset * 7));

    state.blocks.forEach(block => {
        const eventDate = new Date(startOfWeek);
        eventDate.setDate(startOfWeek.getDate() + block.dayIndex);
        eventDate.setHours(block.hour, 0, 0);
        
        const end = new Date(eventDate);
        end.setHours(eventDate.getHours() + block.duration);
        
        const format = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        
        icsContent += "BEGIN:VEVENT\n";
        icsContent += `SUMMARY:${block.title}\n`;
        icsContent += `DTSTART:${format(eventDate)}\n`;
        icsContent += `DTEND:${format(end)}\n`;
        icsContent += `DESCRIPTION:Categoría: ${block.category}\n`;
        icsContent += "END:VEVENT\n";
    });
    
    icsContent += "END:VCALENDAR";
    
    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'timeflow_semana.ics';
    a.click();
}
