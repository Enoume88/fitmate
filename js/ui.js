let sharedAudioContext = null;
function getAudioContext() {
  if (!sharedAudioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) sharedAudioContext = new AudioCtx();
  }
  if (sharedAudioContext && sharedAudioContext.state === 'suspended') {
    sharedAudioContext.resume().catch(() => {});
  }
  return sharedAudioContext;
}

function initPdsTheme() {
  const saved = localStorage.getItem('fitmate_pds_theme') || 'light';
  applyPdsTheme(saved);
}

function togglePdsTheme() {
  const root = document.getElementById('pdsRoot');
  const current = root ? (root.getAttribute('data-theme') || 'light') : 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  applyPdsTheme(next);
  try { localStorage.setItem('fitmate_pds_theme', next); } catch(e){}
  showToast(next === 'dark' ? '🌙 다크 모드로 전환되었습니다.' : '☀️ 라이트 모드로 전환되었습니다.', 'info');
  drawAllCharts(currentUserInbodyRecords());
}

function applyPdsTheme(theme) {
  const root = document.getElementById('pdsRoot');
  if (root) root.setAttribute('data-theme', theme);
  const btn = document.getElementById('themeToggleBtn');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.setAttribute('content', theme === 'dark' ? '#171a1f' : '#f5f7fa');
}

function showToast(message, type = 'info') {
  let container = document.getElementById('pdsToastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'pdsToastContainer';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `pds-toast ${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 250);
  }, 2600);
}

window.alert = function(msg) {
  showToast(msg, 'info');
};

function playPTBeep(freq = 660, duration = 0.12) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch(e) {}
}

function nav(id, btn) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = $(id);
  if (target) target.classList.add('active');

  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(t => t.classList.remove('active'));

  if (btn) {
    btn.classList.add('active');
  } else {
    const matchingTab = document.querySelector(`.tab[onclick*="'${id}'"]`);
    if (matchingTab) matchingTab.classList.add('active');
    else if (id === 'editor' || id === 'library') {
      tabs[3]?.classList.add('active');
    }
  }

  if (id === 'today') renderToday();
  if (id === 'records') renderRecords();
  if (id === 'inbody') renderInbody();
  if (id === 'settings') renderGoalSettings();
  if (id === 'editor') loadEditorPlan();
  if (id === 'library') renderLibrary();

  window.scrollTo({ top: 0, behavior: 'instant' });
}

function formatTarget(e) {
  if (['time', 'stretch', 'warmup', 'cooldown'].includes(e.type)) return `${e.sets || 1}세트 × ${e.duration || 0}초`;
  if (e.type === 'cardio') return `${Math.round((e.duration || 0) / 60)}분`;
  return `${e.sets || 1}세트 × ${e.reps || 0}회`;
}

function onProfileChange() {
  lockToday();
  renderToday();
  renderRecords();
  renderInbody();
  renderGoalSettings();
}

function renderToday(recalc = true) {
  lockToday();
  const base = getPlanForCurrent();
  const rxResult = applyPrescription(base);
  currentPlan = rxResult.plan;

  const briefing = $('briefing');
  if (briefing) {
    briefing.innerHTML = rxResult.notes.map(n => `<div>• ${n}</div>`).join('');
  }

  const obj = getDayObj();
  const user = $('userSelect')?.value || 'friend';
  const stats = planStats(currentPlan);

  const planTitle = $('todayPlanTitle');
  if (planTitle) {
    planTitle.textContent = `${obj.day}요일 · ${obj.title}`;
  }

  const metaEl = $('todayMeta');
  if (metaEl) {
    metaEl.textContent = `${PROGRAM.users[user].label} · ${obj.location} · 운동 ${stats.count}개 · 총 ${stats.sets}세트 · 약 ${stats.minutes}분`;
  }

  renderStabilityPanel();
  renderBackupReminder();

  const list = $('exerciseList');
  if (!list) return;

  if (!currentPlan.length) {
    list.innerHTML = '<div class="card muted" style="text-align:center;padding:30px">오늘 등록된 운동이 없습니다.</div>';
    return;
  }

  const items = currentPlan.map((e, idx) => {
    const video = getExerciseVideoUrl(e);
    const videoBtn = video
      ? `<a class="miniBtn" href="${video}" target="_blank" rel="noopener" style="text-decoration:none">영상 보기</a>`
      : `<button class="miniBtn" onclick="openYoutubeSearch('${e.name.replace(/'/g, "\\'")}')">영상 검색</button>`;

    return `
      <div class="exercise">
        <div class="badge">${idx + 1}</div>
        <div style="flex:1">
          <div class="row">
            <b>${e.name}</b>
            <span class="pill">${typeLabel(e.type)}</span>
          </div>
          <div class="muted small" style="margin-top:2px">${formatTarget(e)}${e.rest ? ` · 휴식 ${e.rest}초` : ''}</div>
          ${e.note ? `<div class="cue small" style="margin-top:6px">${e.note}</div>` : ''}
          <div class="row" style="margin-top:10px;gap:6px">
            <button class="miniBtn" onclick="substituteExercise(${idx})">대체</button>
            <button class="miniBtn" onclick="openExerciseDetail('${e.exerciseId || e.name}')">상세</button>
            ${videoBtn}
          </div>
        </div>
      </div>
    `;
  });

  list.innerHTML = items.join('');
}

function substituteExercise(idx) {
  const result = substituteExerciseInPlan(currentPlan, idx);
  if (!result) {
    showToast('대체 가능한 운동 항목을 찾지 못했습니다.', 'warn');
    return;
  }
  renderToday(false);
  showToast(`[${result.prevName}]을(를) [${result.newName}](으)로 대체했습니다.`, 'info');
}

function renderStabilityPanel() {
  const panel = $('todayStabilityPanel');
  if (!panel) return;
  const s = loadPTSession();
  if (s && s.active && s.ptIndex >= 0 && s.ptIndex < ptSteps.length) {
    panel.innerHTML = `
      <div class="warnbox" style="margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
        <div>
          <b>진행 중인 PT 세션이 있습니다.</b>
          <div class="small" style="margin-top:2px">${s.ptIndex + 1}/${ptSteps.length} 단계 진행 중</div>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn primary" style="min-height:34px;padding:6px 12px;font-size:13px" onclick="startPT('resume')">이어서 계속</button>
          <button class="btn secondary" style="min-height:34px;padding:6px 12px;font-size:13px" onclick="clearPTSession();renderStabilityPanel()">새로 시작</button>
        </div>
      </div>
    `;
  } else {
    panel.innerHTML = '';
  }
}

function startPT(mode = 'auto') {
  if (!enforceInbodyBeforePT()) return;
  clearInterval(timer);
  if ($('ptMainBtn')) $('ptMainBtn').disabled = false;
  if (!currentPlan.length) renderToday();
  ptSteps = makeSteps();

  const doneLogs = todayCompletedPTLogs();
  if (doneLogs.length && mode === 'auto') {
    const msg = '오늘 PT 완료 기록이 이미 있습니다.\n\n확인: 추가 운동으로 다시 시작\n취소: 기록 화면으로 이동';
    if (confirm(msg)) {
      mode = 'additional';
    } else {
      nav('records', document.querySelectorAll('.tab')[1]);
      renderDateRecordDetail(todayISO());
      return;
    }
  }

  const saved = loadPTSession();
  if (mode !== 'fresh' && mode !== 'additional' && saved && saved.active && saved.ptIndex >= 0 && saved.ptIndex < ptSteps.length) {
    const e = ptSteps[saved.ptIndex];
    const label = e?.name ? ` (${saved.ptIndex + 1}/${ptSteps.length} · ${e.name})` : '';
    if (mode === 'resume' || confirm('중간에 닫은 PT 진행상황이 있습니다' + label + '. 이어서 시작할까요?\n\n취소하면 처음부터 새로 시작합니다.')) {
      ptIndex = saved.ptIndex;
      ptResumeRemaining = saved.remaining > 0 ? saved.remaining : null;
      totalDuration = saved.totalDuration || 0;
    } else {
      clearPTSession();
      ptIndex = 0;
      ptResumeRemaining = null;
    }
  } else {
    if (mode === 'fresh' || mode === 'additional') clearPTSession();
    ptIndex = 0;
    ptResumeRemaining = null;
  }

  $('ptOverlay')?.classList.add('active');
  renderPTStep();
  savePTSession({ paused: false, running: false, updatedAt: new Date().toISOString() });
  renderStabilityPanel();
}

function closePT(force = false) {
  if (!force && $('ptOverlay')?.classList.contains('active') && ptSessionActive && ptSteps.length && ptIndex < ptSteps.length) {
    const keep = confirm('운동이 아직 완료되지 않았습니다.\n진행상황을 저장하고 닫을까요?\n\n확인: 저장하고 닫기\n취소: 계속 운동하기');
    if (!keep) return;
  }
  clearInterval(timer);
  timer = null;
  timerTargetEndTime = 0;
  releaseWakeLock();
  if (ptSteps.length && ptSessionActive) {
    savePTSession({ remaining, totalDuration, paused: true, running: false, updatedAt: new Date().toISOString() });
  }
  remaining = 0;
  totalDuration = 0;
  if ($('ptMainBtn')) $('ptMainBtn').disabled = false;
  $('ptOverlay')?.classList.remove('active');
  renderStabilityPanel();
}

function prevStep() {
  if (ptIndex > 0) {
    ptIndex--;
    ptResumeRemaining = null;
    renderPTStep();
    savePTSession();
  }
}

function nextStep() {
  clearInterval(timer);
  timer = null;
  timerTargetEndTime = 0;
  releaseWakeLock();
  ptResumeRemaining = null;
  if (ptIndex < ptSteps.length - 1) {
    ptIndex++;
    renderPTStep();
    savePTSession();
  } else {
    clearPTSession();
    saveAutoCompletion();
    const ptBody = $('ptBody');
    if (ptBody) {
      ptBody.innerHTML = '<div class="goodbox" style="text-align:center;padding:24px 12px"><b>🎉 오늘 PT를 성공적으로 완료했습니다!</b><div class="small" style="margin-top:8px">운동 강도와 완료율을 저장하면 다음 주 맞춤 처방이 더 정밀해집니다.</div></div>';
    }
    const mainBtn = $('ptMainBtn');
    if (mainBtn) {
      mainBtn.textContent = '운동 평가 작성';
      mainBtn.onclick = () => {
        closePT(true);
        showRpeModal();
      };
    }
  }
}

function ptAction() {
  nextStep();
}

function renderPTStep() {
  const step = ptSteps[ptIndex];
  if (!step) return;

  const total = ptSteps.length;
  $('ptSub').textContent = `${ptIndex + 1} / ${total} 단계`;

  const mainBtn = $('ptMainBtn');
  mainBtn.textContent = ptIndex === total - 1 ? '완료' : '다음';
  mainBtn.onclick = () => ptAction();

  if (step.kind === 'rest') {
    $('ptName').textContent = '휴식 시간';
    remaining = ptResumeRemaining != null ? ptResumeRemaining : (step.duration || 60);
    totalDuration = step.duration || 60;
    ptResumeRemaining = null;

    $('ptBody').innerHTML = `
      <div class="timerBox">
        <div class="timer-gauge-wrapper">
          <svg class="timer-gauge-svg" viewBox="0 0 140 140">
            <circle class="timer-gauge-bg" cx="70" cy="70" r="64"></circle>
            <circle id="timerCircle" class="timer-gauge-progress" cx="70" cy="70" r="64"></circle>
          </svg>
          <div class="timer-gauge-content">
            <div id="timerNum" class="timerNum">${fmtTime(remaining)}</div>
            <div class="timer-gauge-label">남은 시간</div>
          </div>
        </div>
        <div class="row" style="margin-top:14px;gap:8px">
          <button class="miniBtn" onclick="adjustPTTimer(-10)">-10초</button>
          <button class="miniBtn" onclick="adjustPTTimer(10)">+10초</button>
        </div>
      </div>
      <div class="muted small" style="text-align:center;margin-top:10px">
        다음: <b>${step.nextExercise || '다음 운동'}</b> ${step.nextSetNo ? `(${step.nextSetNo}세트)` : ''}
      </div>
    `;
    updatePTGauge();
    startTimer();
    return;
  }

  $('ptName').textContent = step.name;
  const isTime = ['time', 'stretch', 'warmup', 'cooldown'].includes(step.kind);
  const isCardio = step.kind === 'cardio';

  if (isTime || isCardio) {
    const defaultSec = isCardio ? (step.duration || 1200) : (step.duration || 30);
    remaining = ptResumeRemaining != null ? ptResumeRemaining : defaultSec;
    totalDuration = defaultSec;
    ptResumeRemaining = null;

    $('ptBody').innerHTML = `
      <div class="timerBox">
        <div class="timer-gauge-wrapper">
          <svg class="timer-gauge-svg" viewBox="0 0 140 140">
            <circle class="timer-gauge-bg" cx="70" cy="70" r="64"></circle>
            <circle id="timerCircle" class="timer-gauge-progress" cx="70" cy="70" r="64"></circle>
          </svg>
          <div class="timer-gauge-content">
            <div id="timerNum" class="timerNum">${fmtTime(remaining)}</div>
            <div class="timer-gauge-label">${isCardio ? '유산소 진행' : '버티기 진행'}</div>
          </div>
        </div>
        <div class="row" style="margin-top:14px;gap:8px">
          <button class="miniBtn" onclick="adjustPTTimer(-10)">-10초</button>
          <button class="miniBtn" onclick="adjustPTTimer(10)">+10초</button>
        </div>
      </div>
      <div class="stat" style="margin-top:14px"><span>진행 세트</span><b>${step.setNo} / ${step.totalSets} 세트</b></div>
      ${step.note ? `<div class="cue small" style="margin-top:8px">${step.note}</div>` : ''}
    `;
    updatePTGauge();
    startTimer();
  } else {
    clearInterval(timer);
    $('ptBody').innerHTML = `
      <div class="card" style="text-align:center;padding:24px 12px;background:var(--pds-surface-secondary)">
        <div style="font-size:36px;font-weight:800;color:var(--pds-color-primary)">${step.reps || 12}<span style="font-size:20px;font-weight:600"> 회</span></div>
        <div class="small muted" style="margin-top:6px">${step.setNo} / ${step.totalSets} 세트 수행</div>
      </div>
      ${step.note ? `<div class="cue small" style="margin-top:10px">${step.note}</div>` : ''}
    `;
  }
}

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {
        wakeLock = null;
      });
    }
  } catch (e) {
    wakeLock = null;
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    try {
      wakeLock.release();
    } catch(e) {}
    wakeLock = null;
  }
}

function startTimer() {
  if (timer) clearInterval(timer);
  playPTBeep(520, 0.08);
  requestWakeLock();
  timerTargetEndTime = Date.now() + (remaining * 1000);

  // 250ms 주기로 시간 동기화하여 초 단위 지연 최소화
  timer = setInterval(() => {
    tickTimer();
  }, 250);
}

function tickTimer() {
  if (!timerTargetEndTime) return;
  const now = Date.now();
  const leftMs = timerTargetEndTime - now;
  const newRemaining = Math.max(0, Math.ceil(leftMs / 1000));

  if (newRemaining !== remaining) {
    remaining = newRemaining;
    const timerNum = $('timerNum');
    if (timerNum) timerNum.textContent = fmtTime(remaining);
    updatePTGauge();

    if (remaining === 3 || remaining === 2 || remaining === 1) {
      playPTBeep(880, 0.08);
    }
  }

  if (leftMs <= 0) {
    clearInterval(timer);
    timer = null;
    timerTargetEndTime = 0;
    releaseWakeLock();
    playPTBeep(1320, 0.28);
    nextStep();
  }
}

function adjustPTTimer(delta) {
  if (remaining == null || remaining <= 0) return;
  remaining = Math.max(1, remaining + delta);
  if (delta > 0) totalDuration += delta;
  timerTargetEndTime = Date.now() + (remaining * 1000);
  const timerNum = $('timerNum');
  if (timerNum) timerNum.textContent = fmtTime(remaining);
  updatePTGauge();
  showToast(`${delta > 0 ? '+' : ''}${delta}초 조정되었습니다.`, 'info');
}

// 화면 복귀(앱 전환, 잠금 해제) 시 즉시 시간 동기화
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && timer && timerTargetEndTime > 0) {
    tickTimer();
  }
});

function updatePTGauge() {
  const circle = $('timerCircle');
  if (circle && totalDuration > 0) {
    const circumference = 402.12;
    const pct = Math.max(0, Math.min(100, ((totalDuration - remaining) / totalDuration) * 100));
    const offset = circumference - (pct / 100) * circumference;
    circle.style.strokeDashoffset = offset;
  }
}

function saveAutoCompletion() {
  lockToday();
  let logs = getLogs();
  const user = $('userSelect')?.value || 'friend';
  const today = todayISO();
  const exists = logs.some(l => l.date === today && l.user === user && l.memo === 'PT 모드 완료');
  if (!exists) {
    logs.push({
      date: today,
      user,
      week: +($('weekSelect')?.value || 1),
      day: $('daySelect')?.value || '월',
      rpe: null,
      completion: 100,
      memo: 'PT 모드 완료'
    });
    writeCachedJSON('fitmate_logs_v14', logs);
  }
  saveExerciseCompletionRecords(true);
  renderRecords();
}

function saveExerciseCompletionRecords(silent = false) {
  lockToday();
  if (!currentPlan.length) renderToday();

  // 3초 이내 중복 클릭 연타 방지
  const now = Date.now();
  if (now - lastSaveExerciseTimestamp < 3000) {
    return;
  }
  lastSaveExerciseTimestamp = now;

  const user = $('userSelect')?.value || 'friend';
  const today = todayISO();
  const week = +($('weekSelect')?.value || 1);
  const day = $('daySelect')?.value || '월';
  const sessionStamp = now;

  // 기존 기록을 임의로 삭제하지 않고 온전히 보존
  let logs = getExerciseLogs();
  currentPlan.forEach((e, idx) => {
    logs.push({
      recordKey: `${today}_${user}_w${week}_${day}_${sessionStamp}_${idx}`,
      date: today,
      user,
      week,
      day,
      exerciseId: e.exerciseId,
      name: e.name,
      type: e.type,
      sets: e.sets || 1,
      completedSets: e.sets || 1,
      reps: e.reps || 0,
      duration: e.duration || 0,
      rest: e.rest || 0,
      target: formatTarget(e),
      targetValue: exerciseTargetValue(e),
      targetUnit: exerciseTargetUnit(e),
      rpe: null,
      memo: 'PT 자동 기록'
    });
  });
  setExerciseLogs(logs);
  if (!silent) showToast('오늘 운동별 상세 기록이 저장되었습니다.', 'success');
}

function showRpeModal() {
  lockToday();
  document.querySelectorAll('#postPainChecks input').forEach(x => { x.checked = false; });
  $('rpeOverlay')?.classList.add('active');
}

function hideRpeModal() {
  $('rpeOverlay')?.classList.remove('active');
}

function saveRpe() {
  lockToday();
  const pain = selectedPostPain();
  const log = {
    date: todayISO(),
    user: $('userSelect')?.value || 'friend',
    week: +($('weekSelect')?.value || 1),
    day: $('daySelect')?.value || '월',
    rpe: +($('rpeSelect')?.value || 6),
    completion: +($('completionSelect')?.value || 100),
    pain,
    memo: $('workoutMemo')?.value || '',
    savedAt: new Date().toISOString()
  };
  let logs = getLogs();
  logs.push(log);
  writeCachedJSON('fitmate_logs_v14', logs);
  hideRpeModal();
  renderRecords();
  showToast('운동 평가가 안전하게 저장되었습니다.', 'success');
}

function moveCalendarMonth(delta) {
  const cur = calendarMonthCursor || todayISO().slice(0, 7);
  const [y, m] = cur.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  const nextY = d.getFullYear();
  const nextM = String(d.getMonth() + 1).padStart(2, '0');
  calendarMonthCursor = `${nextY}-${nextM}`;
  renderAttendanceCalendar();
}

function resetCalendarMonth() {
  calendarMonthCursor = todayISO().slice(0, 7);
  renderAttendanceCalendar();
}

function renderAttendanceCalendar() {
  const box = $('attendanceCalendar');
  if (!box) return;

  const currentMonthStr = calendarMonthCursor || todayISO().slice(0, 7);
  const [yStr, mStr] = currentMonthStr.split('-');
  const y = Number(yStr);
  const m = Number(mStr);

  const firstDay = new Date(y, m - 1, 1).getDay();
  const daysInMonth = new Date(y, m, 0).getDate();

  const user = $('userSelect')?.value || 'friend';
  const logs = getLogs().filter(l => l.user === user && (l.date || '').startsWith(currentMonthStr));
  const doneDates = new Set(logs.map(l => l.date));
  const today = todayISO();

  const parts = [
    '<div class="calendar-nav-bar">',
      '<button class="miniBtn" onclick="moveCalendarMonth(-1)">◀ 이전달</button>',
      '<div class="calendar-month-title">',
        `<span onclick="resetCalendarMonth()" style="cursor:pointer" title="이번 달로 돌아가기">${y}년 ${m}월</span>`,
      '</div>',
      '<button class="miniBtn" onclick="moveCalendarMonth(1)">다음달 ▶</button>',
    '</div>',
    '<div class="calendar-grid">'
  ];

  const dayHeaders = ['일', '월', '화', '수', '목', '금', '토'];
  for (let dh of dayHeaders) {
    parts.push(`<div class="cal-head ${dh === '일' ? 'sun' : (dh === '토' ? 'sat' : '')}">${dh}</div>`);
  }

  for (let i = 0; i < firstDay; i++) {
    parts.push('<div class="cal-cell empty"></div>');
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dstr = `${currentMonthStr}-${String(d).padStart(2, '0')}`;
    const isDone = doneDates.has(dstr);
    const isToday = dstr === today;
    const dayOfWeek = (firstDay + d - 1) % 7;
    const isSun = dayOfWeek === 0;
    const isSat = dayOfWeek === 6;

    let cellClass = 'cal-cell';
    if (isToday) cellClass += ' today';
    if (isDone) cellClass += ' done';
    if (isSun) cellClass += ' sun';
    if (isSat) cellClass += ' sat';

    parts.push(
      `<div class="${cellClass}" onclick="renderDateRecordDetail('${dstr}')">`,
        `<div class="cal-day-num">${d}</div>`,
        isDone ? '<div class="cal-stamp-icon">✔</div>' : '',
      '</div>'
    );
  }
  parts.push('</div>');
  box.innerHTML = parts.join('');
}

function renderDateRecordDetail(dateStr) {
  const box = $('dateRecordDetail');
  const title = $('selectedDateTitle');
  if (!box) return;

  if (title) title.textContent = `${dateLabel(dateStr)} 상세`;

  const user = $('userSelect')?.value || 'friend';
  const sessionLogs = getLogs().filter(l => l.user === user && l.date === dateStr);
  const exLogs = getExerciseLogs().filter(l => l.user === user && l.date === dateStr);
  const ibLogs = currentUserInbodyRecords().filter(r => r.date === dateStr);

  if (!sessionLogs.length && !exLogs.length && !ibLogs.length) {
    box.innerHTML = `<div class="muted small">${dateStr}에 저장된 운동 또는 인바디 기록이 없습니다.</div>`;
    return;
  }

  const parts = [];

  if (sessionLogs.length) {
    sessionLogs.forEach(sl => {
      parts.push(`
        <div class="goodbox" style="margin-bottom:8px">
          <div class="row"><b>${sl.memo || '운동 완료'}</b><span class="pill">완료율 ${sl.completion || 100}%</span></div>
          <div class="small muted" style="margin-top:4px">Week ${sl.week || 1} · ${sl.day || ''}요일 ${sl.rpe ? `· 운동강도 RPE ${sl.rpe}` : ''}</div>
          ${sl.pain && sl.pain.length ? `<div class="warnbox small" style="margin-top:6px">불편 부위: ${painLabel(sl.pain)}</div>` : ''}
        </div>
      `);
    });
  }

  if (ibLogs.length) {
    const ib = ibLogs[0];
    parts.push(`
      <div class="card" style="margin-bottom:8px;background:var(--pds-surface-secondary);padding:10px">
        <div class="small"><b>⚖️ 당일 인바디 측정 결과</b></div>
        <div class="stat" style="margin-top:4px"><span>체중</span><b>${ib.weight || '-'}kg</b></div>
        <div class="stat"><span>골격근량</span><b>${ib.skeletal_muscle_mass || '-'}kg</b></div>
        <div class="stat"><span>체지방량</span><b>${ib.body_fat_mass || '-'}kg</b></div>
      </div>
    `);
  }

  if (exLogs.length) {
    parts.push('<div class="small" style="font-weight:700;margin:10px 0 6px">수행 운동 내역</div>');
    exLogs.forEach(el => {
      parts.push(`
        <div class="recordLine">
          <b>${el.name}</b>
          <div class="muted small">${el.target || ''} · ${el.completedSets || 0}/${el.sets || 1}세트 완료</div>
          ${el.memo && el.memo !== 'PT 자동 기록' ? `<div class="small">${el.memo}</div>` : ''}
        </div>
      `);
    });
  }

  box.innerHTML = parts.join('');
}

function renderMonthStatsSummary() {
  const box = $('monthStatsSummary');
  if (!box) return;

  const currentMonthStr = calendarMonthCursor || todayISO().slice(0, 7);
  const user = $('userSelect')?.value || 'friend';
  const logs = getLogs().filter(l => l.user === user && (l.date || '').startsWith(currentMonthStr));
  const doneDays = new Set(logs.map(l => l.date)).size;

  const exLogs = getExerciseLogs().filter(l => l.user === user && (l.date || '').startsWith(currentMonthStr));
  const totalSets = exLogs.reduce((acc, cur) => acc + (cur.completedSets || 0), 0);

  const rpes = logs.map(l => l.rpe).filter(Boolean);
  const avgRpe = rpes.length ? (rpes.reduce((a, b) => a + b, 0) / rpes.length).toFixed(1) : '-';

  box.innerHTML = `
    <div class="grid2">
      <div class="stat"><span>출석 일수</span><b>${doneDays}일</b></div>
      <div class="stat"><span>완료 세트</span><b>${totalSets}세트</b></div>
      <div class="stat"><span>총 기록 수</span><b>${logs.length}회</b></div>
      <div class="stat"><span>평균 강도</span><b>RPE ${avgRpe}</b></div>
    </div>
  `;
}

function renderExerciseTrendOptions() {
  const sel = $('trendExerciseSelect');
  if (!sel) return;
  const user = $('userSelect')?.value || 'friend';
  const logs = getExerciseLogs().filter(l => l.user === user);
  const names = [];
  const seen = new Set();
  logs.forEach(l => {
    const key = l.exerciseId + '|' + l.name;
    if (!seen.has(key)) {
      seen.add(key);
      names.push({ key, name: l.name });
    }
  });
  names.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  const prev = sel.value;
  sel.innerHTML = names.length ? names.map(x => `<option value="${x.key}">${x.name}</option>`).join('') : '<option value="">기록된 운동 없음</option>';
  if (prev && names.some(x => x.key === prev)) sel.value = prev;
}

function renderExerciseTrend() {
  const box = $('exerciseTrendBox');
  const sel = $('trendExerciseSelect');
  if (!box || !sel) return;
  const user = $('userSelect')?.value || 'friend';
  const key = sel.value;
  if (!key) {
    box.innerHTML = '<div class="muted small">아직 운동별 기록이 없습니다.</div>';
    return;
  }
  const [eid, name] = key.split('|');
  const arr = getExerciseLogs().filter(l => l.user === user && String(l.exerciseId) === eid && l.name === name).sort((a, b) => a.date.localeCompare(b.date));
  if (!arr.length) {
    box.innerHTML = '<div class="muted small">선택한 운동 기록이 없습니다.</div>';
    return;
  }
  const metrics = arr.map(l => ({ ...l, ...trendMetric(l) }));
  const first = metrics[0], last = metrics[metrics.length - 1];
  const best = metrics.reduce((a, b) => b.value > a.value ? b : a, metrics[0]);
  const max = Math.max(...metrics.map(x => x.value), 1);
  const change = last.value - first.value;

  const rows = metrics.slice(-6).map(x => `
    <div class="trendRow" style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <div class="small" style="width:48px">${x.date.slice(5)}</div>
      <div style="flex:1;background:var(--pds-surface-secondary);border-radius:4px;height:8px;overflow:hidden">
        <div style="background:var(--pds-color-primary);height:100%;width:${Math.max(6, Math.round(x.value / max * 100))}%"></div>
      </div>
      <div class="small" style="width:64px;text-align:right"><b>${x.value}</b>${x.unit}</div>
    </div>
  `).join('');

  box.innerHTML = `
    <div class="grid2" style="margin-bottom:12px">
      <div class="stat"><span>최고 기록</span><b>${best.value}${best.unit}</b></div>
      <div class="stat"><span>최근 기록</span><b>${last.value}${last.unit}</b></div>
      <div class="stat"><span>누적 횟수</span><b>${metrics.length}회</b></div>
      <div class="stat"><span>변화량</span><b>${change >= 0 ? '+' : ''}${change}${last.unit}</b></div>
    </div>
    ${rows}
  `;
}

function renderAdaptiveAdviceSummary() {
  const box = $('adaptiveAdviceSummary');
  if (!box) return;
  const changes = buildPrescriptionChanges();
  if (!changes.length) {
    box.innerHTML = '<div class="goodbox">현재 운동 강도와 회복 상태가 우수합니다. 현재 루틴을 유지하세요.</div>';
  } else {
    box.innerHTML = `
      <div class="warnbox">
        <b>💡 ${changes.length}건의 스마트 처방 변경안이 있습니다.</b>
        <div class="small" style="margin-top:4px">${changes[0].summary}</div>
      </div>
    `;
  }
}

function showPrescriptionPreview() {
  const overlay = $('prescriptionPreviewOverlay');
  const list = $('prescriptionPreviewList');
  if (!overlay || !list) return;
  const changes = buildPrescriptionChanges();
  window.pendingPrescriptionChanges = changes;
  if (!changes.length) {
    list.innerHTML = '<div class="goodbox">현재 운동표에 적용할 자동 처방이 없습니다. 현재 강도를 유지하세요.</div>';
  } else {
    list.innerHTML = changes.map((c, i) => {
      const checked = c.mode === 'substitute' ? 'checked' : '';
      const pain = c.pain?.length ? `<span class="pill">통증: ${c.pain.join(', ')}</span>` : '';
      return `
        <div class="card" style="margin-bottom:8px;background:var(--pds-surface-secondary)">
          <label style="display:flex;gap:8px;align-items:flex-start;margin:0;cursor:pointer">
            <input type="checkbox" class="rxApplyCheck" data-i="${i}" ${checked} style="margin-top:3px">
            <div style="flex:1">
              <b>${c.before.name}</b> <span class="pill">${c.label}</span> ${pain}
              <div class="muted small" style="margin-top:4px">${formatTarget(c.before)} → <b>${formatTarget(c.after)}</b></div>
              <div class="small" style="margin-top:4px">${c.summary}</div>
            </div>
          </label>
        </div>
      `;
    }).join('');
  }
  overlay.classList.add('active');
}

function hidePrescriptionPreview() {
  $('prescriptionPreviewOverlay')?.classList.remove('active');
}

function renderRecords() {
  renderAttendanceCalendar();
  renderDateRecordDetail(todayISO());
  renderMonthStatsSummary();
  renderExerciseTrendOptions();
  renderExerciseTrend();
  renderAdaptiveAdviceSummary();
}

function drawAllCharts(arr) {
  drawChart('chartWeight', arr, 'weight', '체중 kg');
  drawChart('chartFat', arr, 'body_fat_mass', '체지방량 kg');
  drawChart('chartMuscle', arr, 'skeletal_muscle_mass', '골격근량 kg');
}

function drawChart(id, arr, key, label) {
  const c = $(id);
  if (!c) return;
  const rect = c.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  c.width = rect.width * dpr;
  c.height = 180 * dpr;
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, rect.width, 180);

  const isDark = document.getElementById('pdsRoot')?.getAttribute('data-theme') === 'dark';
  const bgColor = isDark ? '#22272e' : '#ffffff';
  const gridColor = isDark ? '#404955' : '#dbe2ea';
  const textColor = isDark ? '#eef2f7' : '#1f2937';
  const mutedColor = isDark ? '#aeb7c2' : '#64748b';

  let strokeColor = isDark ? '#93c5fd' : '#1d4ed8';
  let pointColor = isDark ? '#bfdbfe' : '#1e40af';
  let gradStart = isDark ? 'rgba(147, 197, 253, 0.22)' : 'rgba(29, 78, 216, 0.16)';
  let gradEnd = isDark ? 'rgba(147, 197, 253, 0.0)' : 'rgba(29, 78, 216, 0.0)';

  if (key === 'body_fat_mass') {
    strokeColor = isDark ? '#fca5a5' : '#b91c1c';
    pointColor = isDark ? '#f87171' : '#991b1b';
    gradStart = isDark ? 'rgba(252, 165, 165, 0.22)' : 'rgba(185, 28, 28, 0.16)';
    gradEnd = isDark ? 'rgba(252, 165, 165, 0.0)' : 'rgba(185, 28, 28, 0.0)';
  } else if (key === 'skeletal_muscle_mass') {
    strokeColor = isDark ? '#86efac' : '#166534';
    pointColor = isDark ? '#bbf7d0' : '#14532d';
    gradStart = isDark ? 'rgba(134, 239, 172, 0.22)' : 'rgba(22, 101, 52, 0.16)';
    gradEnd = isDark ? 'rgba(134, 239, 172, 0.0)' : 'rgba(22, 101, 52, 0.0)';
  }

  const valid = arr.map(r => ({ date: r.date, v: num(r[key]) })).filter(x => x.v !== null);
  const badgeMap = { 'weight': 'latestWeightBadge', 'body_fat_mass': 'latestFatBadge', 'skeletal_muscle_mass': 'latestMuscleBadge' };
  const badgeEl = $(badgeMap[key]);
  if (badgeEl) {
    badgeEl.textContent = valid.length ? `${valid[valid.length - 1].v} kg` : '기록 없음';
  }
  if (!valid.length) {
    ctx.fillStyle = mutedColor;
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${label} 데이터가 아직 없습니다.`, rect.width / 2, 90);
    return;
  }

  const vals = valid.map(x => x.v);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = (max - min) || 1;
  const padT = 32, padB = 30, padX = 36;
  const usableH = 180 - padT - padB;
  const usableW = rect.width - padX * 2;

  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 3; i++) {
    const y = padT + (usableH / 3) * i;
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(rect.width - padX, y);
    ctx.stroke();
    const gridVal = (max - (range / 3) * i).toFixed(1);
    ctx.fillStyle = mutedColor;
    ctx.font = '10px tabular-nums sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(gridVal, padX - 6, y + 3);
  }

  const pts = valid.map((p, i) => {
    const x = valid.length === 1 ? rect.width / 2 : padX + (usableW / (valid.length - 1)) * i;
    const y = padT + usableH - ((p.v - min) / range) * usableH;
    return { x, y, v: p.v, date: p.date };
  });

  if (pts.length > 1) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = i > 0 ? pts[i - 1] : pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = i !== pts.length - 2 ? pts[i + 2] : p2;
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }
    ctx.lineTo(pts[pts.length - 1].x, padT + usableH);
    ctx.lineTo(pts[0].x, padT + usableH);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, padT, 0, padT + usableH);
    grad.addColorStop(0, gradStart);
    grad.addColorStop(1, gradEnd);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  ctx.beginPath();
  if (pts.length === 1) {
    ctx.arc(pts[0].x, pts[0].y, 4, 0, Math.PI * 2);
  } else {
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = i > 0 ? pts[i - 1] : pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = i !== pts.length - 2 ? pts[i + 2] : p2;
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }
  }
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();

  pts.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = bgColor;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = pointColor;
    ctx.stroke();

    ctx.fillStyle = textColor;
    ctx.font = 'bold 11px tabular-nums sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${p.v}`, p.x, p.y - 9);

    ctx.fillStyle = mutedColor;
    ctx.font = '10px sans-serif';
    ctx.fillText(p.date.slice(5), p.x, padT + usableH + 16);
  });
}

function renderGoalProgress() {
  const user = $('userSelect')?.value || 'friend';
  const goal = getGoalSettings();
  const info = metricInfo(goal.metric);
  const arr = currentUserInbodyRecords().filter(r => r[goal.metric] != null).sort((a, b) => a.date.localeCompare(b.date));
  const box = $('goalProgressBox');
  if (!box) return;

  if (!arr.length) {
    box.innerHTML = `<div class="warnbox"><b>인바디 기록 필요</b><div class="small" style="margin-top:4px">${info.label} 목표 진행률은 1회 이상 측정해야 계산됩니다.</div></div>`;
    return;
  }
  const first = arr[0], last = arr[arr.length - 1];
  const startVal = Number(first[goal.metric]);
  const nowVal = Number(last[goal.metric]);
  const targetVal = Number(goal.target ?? 75);
  const direction = targetVal >= startVal ? 'increase' : 'decrease';
  const totalNeeded = Math.max(0.0001, Math.abs(targetVal - startVal));
  let progressed = direction === 'increase' ? nowVal - startVal : startVal - nowVal;
  progressed = Math.max(0, progressed || 0);
  const pct = Math.min(100, Math.round(progressed / totalNeeded * 100));

  box.innerHTML = `
    <div class="stat"><span>목표 항목</span><b>${info.label}</b></div>
    <div class="stat"><span>목표값</span><b>${targetVal.toFixed(1)}${info.unit}</b></div>
    <div class="progress" style="margin:8px 0"><div class="bar" style="width:${pct}%"></div></div>
    <div class="stat"><span>목표 달성률</span><b>${pct}%</b></div>
    <div class="stat"><span>시작 → 현재</span><b>${startVal.toFixed(1)} → ${nowVal.toFixed(1)}${info.unit}</b></div>
  `;
}

function saveInbody() {
  const user = $('userSelect')?.value || 'friend';
  const date = $('ibDate')?.value || todayISO();
  const rec = {
    user,
    date,
    weight: num('ibWeight'),
    skeletal_muscle_mass: num('ibSMM'),
    body_fat_mass: num('ibBFM'),
    percent_body_fat: num('ibPBF'),
    bmi: num('ibBMI'),
    inbody_score: num('ibScore'),
    bmr: num('ibBMR'),
    visceral_fat_level: num('ibVFL'),
    whr: num('ibWHR')
  };
  let arr = getIB().filter(x => !(x.date === rec.date && (x.user || user) === user));
  arr.push(rec);
  arr.sort((a, b) => a.date.localeCompare(b.date));
  setIB(arr);

  if (rec.weight && rec.weight > 0) {
    setCurrentWeight(user, rec.weight, 'inbody', rec.date);
  }
  showToast('인바디 측정값이 저장되었습니다.', 'success');
}

function renderInbodyReminder() {
  const box = $('inbodyReminderBox');
  if (!box) return;
  const status = inbodyStatus();
  if (status.mustCheck) {
    box.innerHTML = `
      <div class="badbox" style="margin-bottom:12px">
        <b>⚠️ 주간 인바디 체크 요일입니다.</b>
        <div class="small" style="margin-top:2px">인바디를 저장한 후 오늘 운동을 시작하세요.</div>
      </div>
    `;
  } else {
    box.innerHTML = '';
  }
}

function enforceInbodyBeforePT() {
  const status = inbodyStatus();
  if (status.mustCheck) {
    nav('inbody', document.querySelectorAll('.tab')[2]);
    showToast('주간 인바디 체크일입니다. 측정값을 저장해 주세요.', 'warn');
    return false;
  }
  return true;
}

function renderInbodyTable() {
  const box = $('inbodyTableBox');
  if (!box) return;
  const arr = currentUserInbodyRecords().slice().reverse();
  if (!arr.length) {
    box.innerHTML = '<div class="muted small">저장된 인바디 이력이 없습니다.</div>';
    return;
  }
  const rows = arr.map((r, i) => `
    <div class="recordLine" style="display:flex;justify-content:space-between;align-items:center">
      <div>
        <b>${r.date}</b>
        <div class="muted small">체중 ${r.weight || '-'}kg · 골격근 ${r.skeletal_muscle_mass || '-'}kg · 체지방 ${r.body_fat_mass || '-'}kg</div>
      </div>
      <button class="miniBtn" onclick="deleteInbody('${r.date}')">삭제</button>
    </div>
  `).join('');
  box.innerHTML = rows;
}

function deleteInbody(date) {
  if (!confirm(`${date} 인바디 기록을 삭제할까요?`)) return;
  const user = $('userSelect')?.value || 'friend';
  let arr = getIB().filter(x => !(x.date === date && (x.user || user) === user));
  setIB(arr);
  showToast('인바디 기록이 삭제되었습니다.', 'info');
}

function renderInbody() {
  renderInbodyReminder();
  const arr = currentUserInbodyRecords();
  drawAllCharts(arr);
  renderGoalProgress();
  renderInbodyTable();
}

function renderGoalSettings() {
  const g = getGoalSettings();
  if ($('goalMetric')) $('goalMetric').value = g.metric || 'weight';
  if ($('goalAmount')) $('goalAmount').value = g.target ?? 75;
}

function saveGoalSettings() {
  const target = +($('goalAmount')?.value || 0);
  if (!target || target <= 0) {
    showToast('올바른 목표값을 입력하세요.', 'warn');
    return;
  }
  const goal = { metric: $('goalMetric')?.value || 'weight', target };
  setGoalSettings(goal);
  renderGoalProgress();
  showToast('목표 설정이 저장되었습니다.', 'success');
}

function renderBackupReminder() {
  const box = $('backupReminderBox');
  if (!box) return;
  if (!needBackupReminder()) {
    box.innerHTML = '';
    return;
  }
  box.innerHTML = `
    <div class="warnbox" style="margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
      <div>
        <b>💾 데이터 백업 권장</b>
        <div class="small">운동 기록이 쌓였습니다. 브라우저 캐시 삭제에 대비하세요.</div>
      </div>
      <button class="btn secondary" style="min-height:32px;padding:4px 10px;font-size:12px" onclick="exportBackup()">원클릭 백업</button>
    </div>
  `;
}

function fillExerciseSelect() {
  const sel = $('addExerciseSelect');
  if (!sel) return;
  sel.innerHTML = EXERCISES.map(e => `<option value="${e.id}">${e.name} (${e.part})</option>`).join('');
}

function loadEditorPlan() {
  editorPlan = getPlanForCurrent();
  renderEditorList();
}

function renderEditorList() {
  const box = $('editorList');
  if (!box) return;
  if (!editorPlan.length) {
    box.innerHTML = '<div class="muted small">등록된 운동이 없습니다.</div>';
    return;
  }
  box.innerHTML = editorPlan.map((e, i) => `
    <div class="card" style="margin-bottom:8px;background:var(--pds-surface-secondary)">
      <div class="row">
        <b>${i + 1}. ${e.name}</b>
        <button class="miniBtn" onclick="deleteEditor(${i})">삭제</button>
      </div>
      <div class="grid2" style="margin-top:6px">
        <div><label>세트</label><input type="number" value="${e.sets || 1}" onchange="editField(${i},'sets',this.value)"></div>
        <div><label>횟수</label><input type="number" value="${e.reps || 0}" onchange="editField(${i},'reps',this.value)"></div>
      </div>
      <div class="grid2" style="margin-top:6px">
        <div><label>시간(초)</label><input type="number" value="${e.duration || 0}" onchange="editField(${i},'duration',this.value)"></div>
        <div><label>휴식(초)</label><input type="number" value="${e.rest || 0}" onchange="editField(${i},'rest',this.value)"></div>
      </div>
    </div>
  `).join('');
}

function editField(i, k, v) {
  if (editorPlan[i]) editorPlan[i][k] = Math.max(0, Number(v) || 0);
}

function deleteEditor(i) {
  editorPlan.splice(i, 1);
  renderEditorList();
}

function addEditorExercise() {
  const id = $('addExerciseSelect')?.value;
  const ex = EXERCISES.find(e => e.id === id);
  if (!ex) return;
  editorPlan.push({
    exerciseId: ex.id,
    name: ex.name,
    type: ex.type,
    sets: +($('addSets')?.value || 3),
    reps: +($('addReps')?.value || 12),
    duration: +($('addDuration')?.value || 0),
    rest: +($('addRest')?.value || 60)
  });
  renderEditorList();
  showToast(`${ex.name} 운동을 추가했습니다.`, 'info');
}

function saveEditorPlan() {
  savePlanForCurrent(editorPlan);
  renderToday();
  showToast('운동표 편집 내용이 저장되었습니다.', 'success');
}

function resetEditorPlan() {
  if (!confirm('현재 요일의 운동표를 기본값으로 되돌릴까요?')) return;
  resetPlanForCurrent();
  loadEditorPlan();
  renderToday();
  showToast('기본 운동표로 복원되었습니다.', 'info');
}

function renderLibrary() {
  const list = $('libraryList');
  if (!list) return;
  const q = ($('searchEx')?.value || '').trim();
  const filtered = EXERCISES.filter(e => !q || e.name.includes(q) || (e.part || '').includes(q) || (e.equipment || '').includes(q));

  if (!filtered.length) {
    list.innerHTML = '<div class="muted small">검색 결과가 없습니다.</div>';
    return;
  }

  list.innerHTML = filtered.map(e => {
    const video = getExerciseVideoUrl(e);
    return `
      <div class="exercise">
        <div class="badge">${e.type}</div>
        <div style="flex:1">
          <div class="row">
            <b>${e.name}</b>
            <span class="pill">${e.part}</span>
          </div>
          <div class="muted small" style="margin-top:2px">${e.equipment} · 기본 ${formatTarget(e)}</div>
          <div class="row" style="margin-top:8px;gap:6px">
            <button class="miniBtn" onclick="openExerciseDetail('${e.id}')">자세 가이드</button>
            ${video ? `<a class="miniBtn" href="${video}" target="_blank" rel="noopener" style="text-decoration:none">영상 열기</a>` : `<button class="miniBtn" onclick="openYoutubeSearch('${e.name.replace(/'/g, "\\'")}')">유튜브 검색</button>`}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function openExerciseDetail(id) {
  const ex = EXERCISES.find(x => x.id === id || x.name === id);
  if (!ex) return;
  const guide = getGuide(ex);
  const video = getExerciseVideoUrl(ex);

  $('detailName').textContent = ex.name;
  $('detailMeta').textContent = `${ex.part || '-'} · ${ex.equipment || '-'} · ${typeLabel(ex.type)}`;

  $('detailBody').innerHTML = `
    <div class="goodbox"><b>요약 안내</b><br>${guide.summary}</div>
    <div class="goodbox" style="margin-top:8px"><b>운동 목적</b><br>${guide.purpose}</div>
    <h3 style="margin-top:14px">수행 순서</h3>
    ${(guide.steps || []).map((c, i) => `<div class="cue"><b>${i + 1}.</b> ${c}</div>`).join('')}
    <h3 style="margin-top:14px">핵심 큐</h3>
    ${(ex.cues || []).map((c, i) => `<div class="cue"><b>${i + 1}.</b> ${c}</div>`).join('') || '<div class="muted small">등록된 큐 없음</div>'}
    <h3 style="margin-top:14px">유튜브 자세 영상 등록</h3>
    <input id="detailVideoInput" value="${video}" placeholder="https://www.youtube.com/watch?v=...">
    <div class="row" style="margin-top:8px;gap:6px">
      <button class="btn secondary" onclick="saveExerciseVideoUrl('${ex.id}')">영상 링크 저장</button>
      <button class="btn secondary" onclick="openYoutubeSearch('${ex.name.replace(/'/g, "\\'")}')">유튜브에서 검색</button>
    </div>
  `;
  $('exerciseDetailOverlay')?.classList.add('active');
}

function saveExerciseVideoUrl(id) {
  const val = ($('detailVideoInput')?.value || '').trim();
  const map = getVideoMap();
  if (val) map[id] = val;
  else delete map[id];
  setVideoMap(map);
  renderLibrary();
  showToast('영상 링크가 저장되었습니다.', 'success');
}

function closeExerciseDetail() {
  $('exerciseDetailOverlay')?.classList.remove('active');
}

function openYoutubeSearch(q) {
  window.open('https://www.youtube.com/results?search_query=' + encodeURIComponent(q + ' 운동 자세'), '_blank', 'noopener');
}

function openSetupWizard(force = false) {
  if ($('wizardUser')) $('wizardUser').value = $('userSelect')?.value || 'friend';
  if ($('wizardCurrentWeight')) $('wizardCurrentWeight').value = getCurrentWeight() || 80;
  $('setupWizardOverlay')?.classList.add('active');
}

function completeSetupWizard() {
  const user = $('wizardUser')?.value || 'friend';
  const weight = +($('wizardCurrentWeight')?.value || 80);
  const metric = $('wizardGoalMetric')?.value || 'weight';
  const target = +($('wizardGoalTarget')?.value || 75);

  if ($('userSelect')) $('userSelect').value = user;
  setCurrentWeight(user, weight, 'wizard');
  setGoalSettings({ metric, target });
  localStorage.setItem('fitmate_setup_done_v32', '1');

  $('setupWizardOverlay')?.classList.remove('active');
  onProfileChange();
  showToast('초기 설정이 완료되었습니다.', 'success');
}

function skipSetupWizard() {
  localStorage.setItem('fitmate_setup_done_v32', '1');
  $('setupWizardOverlay')?.classList.remove('active');
}
