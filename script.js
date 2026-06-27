let taskQueue = [];
let activeAlarms = JSON.parse(localStorage.getItem('studyAlarms')) || [];
let audioCtx = null;
let alarmInterval = null;

const { LocalNotifications } = Capacitor.Plugins;

async function requestAndroidPermissions() {
    if (LocalNotifications) {
        const permission = await LocalNotifications.requestPermissions();
        if (permission.display !== 'granted') {
            alert('Please allow notification permissions in your Android settings for alarms to work.');
        }
    }
}

window.addEventListener('load', () => {
    requestAndroidPermissions();
    updateAlarmsDisplay();
});

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function ringAlarm() {
    initAudio();
    if (alarmInterval) return;

    alarmInterval = setInterval(() => {
        let osc = audioCtx.createOscillator();
        let gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime);
        
        gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.12);
    }, 250);
}

function stopAlarm() {
    if (alarmInterval) {
        clearInterval(alarmInterval);
        alarmInterval = null;
    }
    document.getElementById('alarmBanner').style.display = 'none';
}

async function scheduleNativeAndroidNotification(title, timestamp) {
    if (LocalNotifications) {
        try {
            await LocalNotifications.schedule({
                notifications: [
                    {
                        title: "Study Planner Alarm",
                        body: "TIME FOR: " + title.toUpperCase(),
                        id: Math.floor(Math.random() * 100000),
                        schedule: { at: new Date(timestamp) },
                        sound: 'default',
                        vibrate: true,
                        importance: 5
                    }
                ]
            });
        } catch (error) {
            console.error("Failed to schedule notification natively: ", error);
        }
    }
}

setInterval(() => {
    const rightNow = new Date().getTime();
    let updated = false;

    activeAlarms.forEach((alarm) => {
        if (!alarm.triggered && rightNow >= alarm.time) {
            alarm.triggered = true;
            updated = true;
            
            if (!document.hidden) {
                document.getElementById('alarmText').innerText = "TIME FOR: " + alarm.title.toUpperCase();
                document.getElementById('alarmBanner').style.display = 'block';
                ringAlarm();
            }
        }
    });

    if (updated) {
        localStorage.setItem('studyAlarms', JSON.stringify(activeAlarms));
        updateAlarmsDisplay();
    }
}, 1000);

function updateAlarmsDisplay() {
    const listDiv = document.getElementById('activeAlarmsList');
    if (activeAlarms.length === 0) {
        listDiv.innerHTML = "No active alarms running.";
        return;
    }
    
    listDiv.innerHTML = activeAlarms.map(a => {
        let statusText = a.triggered ? 'Done' : 'Waiting...';
        let formattedTime = new Date(a.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        return `<div style="margin-bottom:6px;">Alarm [${formattedTime}] <strong>${a.title}</strong> - <span style="color:var(--accent-pink)">${statusText}</span></div>`;
    }).join('');
}

async function clearAllAlarms() {
    activeAlarms = [];
    localStorage.removeItem('studyAlarms');
    if (LocalNotifications) {
        const pending = await LocalNotifications.getPending();
        if (pending.notifications.length > 0) {
            await LocalNotifications.cancel(pending);
        }
    }
    updateAlarmsDisplay();
    alert("All saved alarms cleared.");
}

function addManualReminder() {
    initAudio();
    const titleInput = document.getElementById('manualTitle').value.trim();
    const timeInput = document.getElementById('manualTime').value;
    
    if (!titleInput || !timeInput) {
        alert("Please type a title and pick a time first.");
        return;
    }

    const targetTimestamp = new Date(timeInput).getTime();
    if (targetTimestamp < new Date().getTime()) {
        alert("Cannot set alarms in the past.");
        return;
    }

    activeAlarms.push({ title: titleInput, time: targetTimestamp, triggered: false });
    localStorage.setItem('studyAlarms', JSON.stringify(activeAlarms));
    
    scheduleNativeAndroidNotification(titleInput, targetTimestamp);
    
    updateAlarmsDisplay();
    document.getElementById('manualTitle').value = '';
    document.getElementById('manualTime').value = '';
    alert("Alarm configured successfully.");
}

function addTaskQueue() {
    const title = document.getElementById('taskTitle').value.trim();
    const difficulty = document.getElementById('taskDifficulty').value;

    if (!title) {
        alert("Please enter a name for your task.");
        return;
    }

    let studyMinutes = 30;
    if (difficulty === 'medium') studyMinutes = 60;
    if (difficulty === 'hard') studyMinutes = 90;

    taskQueue.push({ title, difficulty, duration: studyMinutes });
    displayQueueList();
    document.getElementById('taskTitle').value = '';
}

function displayQueueList() {
    const container = document.getElementById('queueDisplay');
    if (taskQueue.length === 0) {
        container.innerHTML = "No tasks added to the queue yet.";
        return;
    }
    container.innerHTML = taskQueue.map((t, idx) => 
        `<div>[Slot ${idx + 1}] ${t.title} (${t.difficulty.toUpperCase()} - ${t.duration}m)</div>`
    ).join('');
}

function generateSchedules() {
    initAudio();
    const startTimeVal = document.getElementById('scheduleStartTime').value;
    if (!startTimeVal) {
        alert("Pick a start time so the system knows when you are starting.");
        return;
    }
    if (taskQueue.length === 0) {
        alert("Your task queue is empty. Add tasks first.");
        return;
    }

    const baseStartTime = new Date(startTimeVal).getTime();
    const outputContainer = document.getElementById('scheduleOptionsContainer');
    outputContainer.innerHTML = "<h2 style='text-align:center; color:var(--accent-purple); margin-top:15px;'>3 Custom Layout Strategies Generated</h2>";

    let strategy1 = [...taskQueue].sort((a, b) => {
        const difficultyWeight = { hard: 3, medium: 2, easy: 1 };
        return difficultyWeight[b.difficulty] - difficultyWeight[a.difficulty];
    });
    renderOptionBlock(outputContainer, "Option A: Hardest First Strategy (Heavy Load First)", strategy1, baseStartTime);

    let strategy2 = [...taskQueue].sort((a, b) => {
        const difficultyWeight = { hard: 3, medium: 2, easy: 1 };
        return difficultyWeight[a.difficulty] - difficultyWeight[b.difficulty];
    });
    renderOptionBlock(outputContainer, "Option B: Easiest First Strategy (Build Momentum)", strategy2, baseStartTime);

    let strategy3 = [];
    let hards = taskQueue.filter(t => t.difficulty === 'hard');
    let mediums = taskQueue.filter(t => t.difficulty === 'medium');
    let easies = taskQueue.filter(t => t.difficulty === 'easy');
    
    let maxLoops = taskQueue.length;
    for(let i = 0; i < maxLoops; i++) {
        if (hards.length > 0) strategy3.push(hards.shift());
        if (easies.length > 0) strategy3.push(easies.shift());
        if (mediums.length > 0) strategy3.push(mediums.shift());
    }
    strategy3 = [...new Set(strategy3.concat(taskQueue))];

    renderOptionBlock(outputContainer, "Option C: Interleaved Mix (Balanced Alternation)", strategy3, baseStartTime);
}

function renderOptionBlock(parentContainer, optionTitleName, sortedTasks, startTime) {
    let trackingTime = startTime;
    const studentRestPeriod = 10 * 60 * 1000;
    
    let blockHtml = `
        <div class="student-card option-box">
            <h3 class="option-title">${optionTitleName}</h3>
    `;

    let scheduleDataArray = [];

    sortedTasks.forEach(task => {
        let displayStart = new Date(trackingTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        let calculatedEndTime = trackingTime + (task.duration * 60 * 1000);
        let displayEnd = new Date(calculatedEndTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        blockHtml += `
            <div class="time-slot">
                <span><strong>${displayStart} - ${displayEnd}</strong>: ${task.title}</span>
                <span style="color:var(--accent-pink)">[${task.difficulty}]</span>
            </div>
        `;

        scheduleDataArray.push({ title: task.title, timestamp: trackingTime });
        trackingTime = calculatedEndTime + studentRestPeriod;
    });

    let serializedData = encodeURIComponent(JSON.stringify(scheduleDataArray));

    blockHtml += `
        <button class="action-btn" style="margin-top:15px;" onclick="applySchedulesToAlarms('${serializedData}')">
            Lock This Layout Into My Alarms
        </button>
    </div>`;
    
    parentContainer.innerHTML += blockHtml;
}

function applySchedulesToAlarms(serializedData) {
    const parsedData = JSON.parse(decodeURIComponent(serializedData));
    
    parsedData.forEach(item => {
        let isDuplicate = activeAlarms.some(a => a.title === "Study: " + item.title && a.time === item.timestamp);
        if(!isDuplicate) {
            activeAlarms.push({
                title: "Study: " + item.title,
                time: item.timestamp,
                triggered: false
            });
            scheduleNativeAndroidNotification("Study: " + item.title, item.timestamp);
        }
    });

    localStorage.setItem('studyAlarms', JSON.stringify(activeAlarms));
    updateAlarmsDisplay();
    alert("Schedules mapped to alarms successfully.");
}
