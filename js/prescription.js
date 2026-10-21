const PAIN_PATTERNS = [
  { part: '무릎', regex: /무릎|슬개|앞무릎|무릅/ },
  { part: '어깨', regex: /어깨|승모|견갑/ },
  { part: '손목', regex: /손목|손바닥/ },
  { part: '허리', regex: /허리|요추|과신전|말림/ },
  { part: '발목', regex: /발목|발가락/ }
];

function substituteExerciseInPlan(plan, index) {
  if (!plan || !plan[index]) return null;
  const cur = plan[index];
  const candids = EXERCISES.filter(e => e.id !== cur.exerciseId && (e.part === cur.part || !cur.part));
  if (!candids.length) return null;
  const foundIdx = candids.findIndex(c => c.name === cur.name);
  const nextEx = candids[(foundIdx + 1) % candids.length];
  const prevName = cur.name;
  cur.exerciseId = nextEx.id;
  cur.name = nextEx.name;
  cur.part = nextEx.part || cur.part;
  cur.type = nextEx.type || cur.type;
  cur.note = `기구 대체 (${prevName} 대신)`;
  cur.isSubstituted = true;
  return { prevName, newName: nextEx.name };
}

function makeSteps() {
  let steps = [];
  currentPlan.forEach((e, idx) => {
    let sets = e.sets || 1;
    if (e.type === 'cardio') sets = 1;
    for (let s = 1; s <= sets; s++) {
      steps.push({
        ...e,
        setNo: s,
        totalSets: sets,
        kind: e.type,
        actualReps: e.reps || 0,
        actualDuration: e.duration || 0
      });
      if (e.rest && s < sets) {
        steps.push({
          name: '휴식',
          kind: 'rest',
          duration: e.rest,
          seconds: e.rest,
          setNo: s,
          totalSets: sets,
          nextExercise: e.name,
          nextSetNo: s + 1
        });
      }
    }
    if (e.rest && e !== currentPlan.at(-1)) {
      const nextIdx = idx + 1;
      const nextE = currentPlan[nextIdx];
      steps.push({
        name: '운동 간 휴식',
        kind: 'rest',
        duration: e.rest,
        seconds: e.rest,
        nextExercise: nextE ? nextE.name : '',
        nextSetNo: 1
      });
    }
  });
  return steps;
}

function selectedPain() {
  return [...document.querySelectorAll('#painChecks input:checked')].map(x => x.value);
}

function selectedPostPain() {
  const checks = [...document.querySelectorAll('#postPainChecks input:checked')].map(x => x.value);
  if (checks.includes('none')) return [];
  return checks;
}

function painLabel(arr) {
  if (!arr || !arr.length) return '없음';
  const map = { knee: '무릎', back: '허리', shoulder: '어깨', wrist: '손목', ankle: '발목', other: '기타' };
  return arr.map(x => map[x] || x).join(', ');
}

function painKeywordsForMemo(memo) {
  const t = String(memo || '');
  if (!t) return [];
  return PAIN_PATTERNS.filter(p => p.regex.test(t)).map(p => p.part);
}

function adjustExerciseClone(e, mode) {
  const x = clone(e);
  if (mode === 'increase') {
    if (['time', 'stretch', 'warmup', 'cooldown'].includes(x.type)) x.duration = Math.round((x.duration || 20) + 5);
    else if (x.type === 'cardio') x.duration = Math.round((x.duration || 600) + 300);
    else x.reps = Math.max(1, Math.round((x.reps || 10) * 1.1));
    x.note = (x.note ? x.note + ' / ' : '') + '자동처방: 수행 원활로 소폭 증가';
  }
  if (mode === 'decrease') {
    if ((x.sets || 1) > 1) x.sets = Math.max(1, (x.sets || 1) - 1);
    else if (['time', 'stretch', 'warmup', 'cooldown'].includes(x.type)) x.duration = Math.max(10, Math.round((x.duration || 20) - 5));
    else if (x.type === 'cardio') x.duration = Math.max(300, Math.round((x.duration || 600) - 300));
    else x.reps = Math.max(5, Math.round((x.reps || 10) * 0.85));
    x.note = (x.note ? x.note + ' / ' : '') + '자동처방: 고강도/피로도로 감량';
  }
  return x;
}

function substituteExerciseForPain(e, pain) {
  const rules = {
    '무릎': { '맨몸 런지': '스텝박스 오르내리기', '레그프레스': '맨몸 스쿼트', '스쿼트 프레스': '맨몸 스쿼트' },
    '발목': { '맨몸 런지': '스텝박스 오르내리기', '버피': '스쿼트+암리치' },
    '어깨': { '스미스머신 숄더프레스': '밴드 익스터널 로테이션', '덤벨 숄더프레스': '밴드 익스터널 로테이션', '푸쉬업': '덤벨 체스트 프레스', '사이드 레터럴 레이즈': '밴드 익스터널 로테이션' },
    '손목': { '버피': '맨몸 스쿼트', '암워킹': '코어 니리프트', '푸쉬업': '플랭크' },
    '허리': { '슈퍼맨': '코어 니리프트', '케틀벨 스윙': '힙쓰러스트', '코어 니리프트': '플랭크' }
  };
  const target = rules[pain]?.[e.name];
  if (!target) return null;
  const ex = EXERCISES.find(x => x.name === target);
  if (!ex) return null;
  return {
    exerciseId: ex.id,
    name: ex.name,
    type: ex.type,
    sets: Math.min(e.sets || 2, 2),
    reps: ex.reps || e.reps || 10,
    duration: ex.duration || e.duration || 0,
    rest: e.rest || 45,
    note: `자동처방: ${pain} 불편 대체`
  };
}

function recentExerciseEntries(exerciseId, name, limit = 5) {
  const user = $('userSelect')?.value || 'friend';
  return getExerciseLogs()
    .filter(l => l.user === user && (l.exerciseId === exerciseId || l.exercise === name))
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    .slice(-limit);
}

function trendMetric(l) {
  if (['time', 'stretch', 'warmup', 'cooldown'].includes(l.type)) return { value: l.duration || 0, unit: '초' };
  if (l.type === 'cardio') return { value: Math.round((l.duration || 0) / 60), unit: '분' };
  return { value: l.reps || 0, unit: '회' };
}

function analyzeExerciseForPrescription(e) {
  const arr = recentExerciseEntries(e.exerciseId, e.name, 5);
  if (!arr.length) {
    return { exercise: e, level: 'info', title: '기록 대기', summary: '누적 기록 생성 후 자동 처방이 최적화됩니다.', mode: 'keep', reasons: ['최근 기록 0회'], pain: [] };
  }
  const last3 = arr.slice(-3);
  const rpes = last3.map(x => x.rpe).filter(Boolean);
  const avgR = rpes.length ? Math.round(rpes.reduce((a, b) => a + b, 0) / rpes.length * 10) / 10 : null;
  const avgComplete = Math.round(last3.reduce((a, b) => a + ((+b.completedSets || 0) / (+b.sets || 1) * 100), 0) / last3.length);
  const pains = [...new Set(last3.flatMap(x => painKeywordsForMemo(x.memo)))];
  const values = last3.map(trendMetric).map(x => x.value);
  const increasing = values.length >= 2 && values[values.length - 1] >= values[0];
  let level = 'good', title = '적정 강도 유지', summary = '현재 강도와 반복수가 안정적입니다.', mode = 'keep', reasons = [];
  if (avgR) reasons.push(`평균 강도 RPE ${avgR}`);
  reasons.push(`평균 완료율 ${avgComplete}%`);

  if (pains.length) {
    level = 'bad';
    title = '대체운동 제안';
    mode = 'substitute';
    summary = `최근 메모에서 ${pains.join(', ')} 불편 키워드가 감지되었습니다.`;
  } else if (avgR && avgR >= 8) {
    level = 'warn';
    title = '피로도 감량 추천';
    mode = 'decrease';
    summary = '수행 강도가 높아 볼륨 또는 반복수 감량을 권장합니다.';
  } else if (avgComplete < 70) {
    level = 'warn';
    title = '볼륨 조절 추천';
    mode = 'decrease';
    summary = '완료율이 낮아 세트를 줄여 완주율을 높이는 것을 권장합니다.';
  } else if (avgComplete >= 90 && avgR && avgR <= 6) {
    level = 'good';
    title = '강도 점진적 증량';
    mode = 'increase';
    summary = '완료율이 높고 여유가 있어 10% 증량을 권장합니다.';
  } else if (avgComplete >= 90 && avgR && avgR <= 7 && increasing) {
    level = 'good';
    title = '안정적 성장 중';
    mode = 'increase';
    summary = '기록이 점진적으로 향상되고 있습니다. 현재 기조를 유지합니다.';
  }
  return { exercise: e, level, title, summary, mode, reasons, pain: pains, avgR, avgComplete };
}

function buildPrescriptionForCurrentPlan() {
  if (!currentPlan.length) renderToday();
  return currentPlan.filter(e => !['warmup', 'cooldown', 'stretch'].includes(e.type)).map(analyzeExerciseForPrescription);
}

function buildPrescriptionChanges() {
  if (!currentPlan.length) renderToday();
  const rx = buildPrescriptionForCurrentPlan();
  const plan = getPlanForCurrent();
  const changes = [];
  plan.forEach((e, idx) => {
    const r = rx.find(x => x.exercise.exerciseId === e.exerciseId && x.exercise.name === e.name);
    if (!r || r.mode === 'keep') return;
    let next = null, label = '';
    if (r.mode === 'substitute') {
      const sub = (r.pain || []).map(p => substituteExerciseForPain(e, p)).find(Boolean);
      next = sub || adjustExerciseClone(e, 'decrease');
      label = sub ? '대체운동' : '감량';
    } else {
      next = adjustExerciseClone(e, r.mode);
      label = r.mode === 'increase' ? '증가' : '감량';
    }
    const changed = JSON.stringify({ name: e.name, type: e.type, sets: e.sets, reps: e.reps, duration: e.duration }) !== JSON.stringify({ name: next.name, type: next.type, sets: next.sets, reps: next.reps, duration: next.duration });
    if (changed) {
      changes.push({ index: idx, before: e, after: next, mode: r.mode, label, summary: r.summary, reasons: r.reasons || [], pain: r.pain || [] });
    }
  });
  return changes;
}

function applyPrescription(plan) {
  let p = clone(plan);
  const pain = selectedPain();
  const fatigue = $('fatigueSelect')?.value || 'normal';
  let notes = [];

  if (pain.includes('knee')) {
    p = p.map(e => e.name.includes('런지') ? { ...e, name: '스텝박스 오르내리기', exerciseId: 'ex003', note: '무릎 보호: 런지 대체' } : e);
    p = p.map(e => (e.name.includes('레그프레스') || e.name.includes('스쿼트 프레스')) ? { ...e, name: '맨몸 스쿼트', exerciseId: 'ex001', note: '무릎 보호: 머신프레스 대체' } : e);
    notes.push('무릎 보호 모드: 하체 관절 부하 완화 동작으로 자동 전환');
  }
  if (pain.includes('shoulder')) {
    p = p.filter(e => !['숄더프레스', '사이드 레터럴 레이즈', '프론트 레이즈'].some(k => e.name.includes(k)));
    notes.push('어깨 보호 모드: 오버헤드 프레스 및 레이즈 계열 제외');
  }
  if (pain.includes('wrist')) {
    p = p.map(e => (e.name.includes('버피') || e.name.includes('암워킹') || e.name.includes('푸쉬업')) ? { ...e, sets: Math.max(1, (e.sets || 1) - 1), note: '손목 보호: 볼륨 감소' } : e);
    notes.push('손목 보호 모드: 체중 부하 동작 볼륨 감소');
  }
  if (pain.includes('back')) {
    p = p.filter(e => !e.name.includes('슈퍼맨'));
    notes.push('허리 보호 모드: 척추 신전 동작 제외 및 코어 안정화 우선');
  }
  if (fatigue === 'very_tired') {
    p = p.map(e => ({
      ...e,
      sets: e.sets ? Math.max(1, Math.floor(e.sets * 0.75)) : e.sets,
      duration: e.duration ? Math.max(10, Math.floor(e.duration * 0.8)) : e.duration,
      note: (e.note ? e.note + ' / ' : '') + '피로도 높음: 20% 감량'
    }));
    notes.push('고피로도 완화: 전체 볼륨 약 20% 감량 적용');
  }
  if (fatigue === 'good') {
    p = p.map(e => ({
      ...e,
      reps: e.reps ? Math.ceil(e.reps * 1.1) : e.reps,
      duration: e.duration ? Math.ceil(e.duration * 1.08) : e.duration
    }));
    notes.push('최적 컨디션: 반복수 및 세트 유지 시간 10% 증가');
  }

  if (!notes.length) notes.push('기본 프로그램 유지. 호흡과 자세 큐를 우선합니다.');
  return { plan: p, notes };
}

function applySelectedPrescription() {
  const changes = window.pendingPrescriptionChanges || [];
  if (!changes.length) {
    hidePrescriptionPreview();
    return;
  }
  let plan = getPlanForCurrent();
  let changed = 0;
  document.querySelectorAll('.rxApplyCheck:checked').forEach(chk => {
    const c = changes[Number(chk.dataset.i)];
    if (c && plan[c.index]) {
      plan[c.index] = clone(c.after);
      changed++;
    }
  });
  if (!changed) {
    showToast('선택된 처방 항목이 없습니다.', 'warn');
    return;
  }
  savePlanForCurrent(plan);
  currentPlan = applyPrescription(plan).plan;
  hidePrescriptionPreview();
  renderToday();
  renderEditor();
  renderRecords();
  showToast(`자동 처방 ${changed}건이 운동표에 반영되었습니다.`, 'success');
}

function estimatePlanSeconds(plan) {
  return (plan || []).reduce((sum, e) => {
    const sets = e.type === 'cardio' ? 1 : (e.sets || 1);
    let active = 0;
    if (['time', 'stretch', 'warmup', 'cooldown', 'cardio'].includes(e.type)) active = (e.duration || 0) * sets;
    else active = (e.reps || 0) * 4 * sets;
    const rest = (e.rest || 0) * Math.max(0, sets - 1) + (e.rest || 0);
    return sum + active + rest;
  }, 0);
}

function minutesOfExercise(e) {
  const sets = e.sets || 1, rest = e.rest || 0;
  if (['cardio', 'warmup', 'stretch', 'cooldown', 'time'].includes(e.type)) {
    return Math.round(((e.duration || 0) * sets + rest * Math.max(0, sets - 1)) / 60);
  }
  return Math.round((sets * 55 + rest * Math.max(0, sets - 1)) / 60);
}

function planStats(plan) {
  const p = plan || [];
  const sets = p.reduce((a, e) => a + (e.type === 'cardio' ? 1 : (e.sets || 1)), 0);
  const cardio = p.filter(e => e.type === 'cardio').reduce((a, e) => a + (e.duration || 0), 0);
  return {
    count: p.length,
    sets,
    minutes: Math.max(1, Math.round(estimatePlanSeconds(p) / 60)),
    cardioMin: Math.round(cardio / 60)
  };
}
