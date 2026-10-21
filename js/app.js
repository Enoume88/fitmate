function init() {
  initPdsTheme();

  const ws = $('weekSelect');
  if (ws && !ws.options.length) {
    for (let i = 1; i <= 4; i++) {
      ws.innerHTML += `<option value="${i}">Week ${i}</option>`;
    }
  }

  lockToday();
  if ($('ibDate')) $('ibDate').value = todayISO();
  fillExerciseSelect();
  renderToday(false);
  renderRecords();
  renderInbody();
  renderGoalSettings();

  if (!localStorage.getItem('fitmate_setup_done_v32')) {
    openSetupWizard(false);
  }

  const hash = window.location.hash.replace('#', '');
  if (hash && $(hash)) {
    const tabBtn = document.querySelector(`.tab[onclick*="'${hash}'"]`);
    nav(hash, tabBtn);
  }
}

function installPWA() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(choiceResult => {
      if (choiceResult.outcome === 'accepted') {
        showToast('홈 화면에 오늘 PT 앱이 추가되었습니다.', 'success');
      }
      deferredInstallPrompt = null;
    });
  } else {
    const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent);
    if (isIos) {
      showToast('Safari 하단 공유 버튼 [↑] 클릭 후 [홈 화면에 추가]를 선택하세요.', 'info');
    } else {
      showToast('Chrome 브라우저 우측 상단 메뉴 [⋮] 클릭 후 [홈 화면에 추가]를 선택하세요.', 'info');
    }
  }
}

window.addEventListener('beforeunload', function(e) {
  if (ptSessionActive && ptSteps.length && $('ptOverlay')?.classList.contains('active')) {
    try {
      savePTSession({ remaining, totalDuration, paused: true, running: false, updatedAt: new Date().toISOString() });
    } catch(err) {}
    e.preventDefault();
    e.returnValue = '운동이 진행 중입니다. 진행 상황은 안전하게 저장됩니다.';
    return e.returnValue;
  }
});

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  showToast('오늘 PT 앱이 성공적으로 설치되었습니다.', 'success');
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then(() => {})
      .catch(() => {});
  });
}

document.addEventListener('DOMContentLoaded', init);
