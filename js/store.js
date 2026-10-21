const $ = id => document.getElementById(id);
const clone = x => JSON.parse(JSON.stringify(x));

const storeCache = new Map();
function readCachedJSON(key, fallback) {
  if (storeCache.has(key)) return storeCache.get(key);
  try {
    const raw = localStorage.getItem(key);
    const val = raw ? JSON.parse(raw) : fallback;
    storeCache.set(key, val);
    return val;
  } catch(e) {
    return fallback;
  }
}
function writeCachedJSON(key, value) {
  storeCache.set(key, value);
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch(e) {}
}
function removeCachedKey(key) {
  storeCache.delete(key);
  try {
    localStorage.removeItem(key);
  } catch(e) {}
}

let currentPlan = [];
let editorPlan = [];
let ptSteps = [];
let ptIndex = 0;
let timer = null;
let remaining = 0;
let totalDuration = 0;
let timerTargetEndTime = 0;
let wakeLock = null;
let lastSaveExerciseTimestamp = 0;
let ptSessionActive = false;
let ptResumeRemaining = null;
let calendarMonthCursor = null;
let deferredInstallPrompt = null;

const EXERCISES = [
  {"id": "ex001", "name": "맨몸 스쿼트", "part": "하체/둔근", "type": "reps", "equipment": "맨몸", "level": "beginner", "sets": 3, "reps": 15, "duration": 0, "rest": 60, "weight": "맨몸", "gym": true, "home": true, "cues": ["가슴을 들어 흉추를 편다", "발바닥 전체로 바닥을 민다", "일어날 때 무릎을 바깥으로 벌린다"], "mistakes": ["허리가 말림", "무릎이 안쪽으로 모임", "발가락에만 힘이 실림"], "substitutes": {"knee": "박스 스쿼트", "fatigue": "세트 1개 감소"}},
  {"id": "ex002", "name": "맨몸 런지", "part": "하체/균형", "type": "reps", "equipment": "맨몸", "level": "beginner", "sets": 2, "reps": 8, "duration": 0, "rest": 60, "weight": "맨몸", "gym": true, "home": true, "cues": ["상체는 위아래로 수직 이동", "앞발 뒤꿈치를 누른다", "뒷발 앞꿈치를 안정적으로 누른다"], "mistakes": ["발가락에 과도하게 힘 줌", "상체가 앞으로 쏠림", "무릎이 흔들림"], "substitutes": {"knee": "스텝박스 오르내리기", "ankle": "스텝박스 오르내리기", "fatigue": "리버스 런지 6회"}},
  {"id": "ex003", "name": "스텝박스 오르내리기", "part": "하체/유산소", "type": "reps", "equipment": "스텝박스", "level": "beginner", "sets": 2, "reps": 12, "duration": 0, "rest": 45, "weight": "맨몸", "gym": true, "home": false, "cues": ["발 전체를 박스 위에 올린다", "무릎이 안쪽으로 무너지지 않게 한다", "내려올 때 천천히 컨트롤한다"], "mistakes": ["발 앞쪽만 올림", "반동으로 올라감", "내려올 때 털썩 떨어짐"], "substitutes": {"home": "제자리 무릎 올리기", "knee": "낮은 계단 오르기"}},
  {"id": "ex004", "name": "버피", "part": "전신/심폐", "type": "reps", "equipment": "맨몸", "level": "beginner", "sets": 2, "reps": 8, "duration": 0, "rest": 60, "weight": "맨몸", "gym": true, "home": true, "cues": ["동작을 빠르게보다 정확하게 한다", "코어 힘을 유지한다", "착지 시 무릎 충격을 줄인다"], "mistakes": ["허리 처짐", "손목에 과부하", "착지 충격 큼"], "substitutes": {"wrist": "스쿼트+암리치", "knee": "스쿼트+암리치", "fatigue": "노점프 버피"}},
  {"id": "ex005", "name": "버피 플랭크", "part": "전신/코어", "type": "mixed", "equipment": "맨몸", "level": "beginner", "sets": 2, "reps": 5, "duration": 10, "rest": 60, "weight": "맨몸", "gym": true, "home": true, "cues": ["플랭크에서 배에 힘을 준다", "어깨에 기대지 않는다", "허리가 꺾이지 않게 한다"], "mistakes": ["허리 처짐", "어깨로 버팀", "속도만 빠름"], "substitutes": {"wrist": "팔꿈치 플랭크", "fatigue": "플랭크만 수행"}},
  {"id": "ex006", "name": "플랭크", "part": "코어", "type": "time", "equipment": "맨몸", "level": "beginner", "sets": 2, "reps": 0, "duration": 20, "rest": 45, "weight": "맨몸", "gym": true, "home": true, "cues": ["복부를 단단히 조인다", "허리가 꺾이지 않게 한다", "엉덩이를 너무 높이 들지 않는다"], "mistakes": ["허리 과신전", "엉덩이 과도하게 들림", "목에 힘 과다"], "substitutes": {"wrist": "팔꿈치 플랭크", "back": "데드버그"}},
  {"id": "ex007", "name": "암워킹", "part": "코어/어깨 안정", "type": "reps", "equipment": "맨몸", "level": "beginner", "sets": 3, "reps": 8, "duration": 0, "rest": 60, "weight": "맨몸", "gym": true, "home": true, "cues": ["어깨에 기대지 않는다", "배에 힘을 잡는다", "손으로 한 걸음씩 전진한다"], "mistakes": ["손목 통증 유발", "허리 처짐", "속도만 빠름"], "substitutes": {"wrist": "데드버그", "shoulder": "버드독"}},
  {"id": "ex008", "name": "코어 니리프트", "part": "코어", "type": "time", "equipment": "맨몸", "level": "beginner", "sets": 6, "reps": 0, "duration": 10, "rest": 20, "weight": "맨몸", "gym": true, "home": true, "cues": ["무릎을 바닥에서 약간 띄운다", "팔꿈치로 바닥을 눌러 등을 민다", "복직근이 튀어나오지 않게 한다"], "mistakes": ["엉덩이가 너무 올라감", "허리 말림", "복압 풀림"], "substitutes": {"back": "데드버그", "wrist": "데드버그"}},
  {"id": "ex009", "name": "슈퍼맨", "part": "후면사슬/등", "type": "time", "equipment": "맨몸", "level": "beginner", "sets": 6, "reps": 0, "duration": 10, "rest": 20, "weight": "맨몸", "gym": true, "home": true, "cues": ["허리가 아니라 엉덩이로 다리를 든다", "상체는 등 힘으로 든다", "목과 승모를 과하게 쓰지 않는다"], "mistakes": ["허리로만 들어올림", "목 젖힘", "반동 사용"], "substitutes": {"back": "버드독", "fatigue": "상체/하체 분리 수행"}},
  {"id": "ex010", "name": "스미스머신 숄더프레스", "part": "어깨", "type": "reps", "equipment": "스미스머신", "level": "beginner", "sets": 3, "reps": 12, "duration": 0, "rest": 75, "weight": "0~5kg", "gym": true, "home": false, "cues": ["팔꿈치를 외회전한다", "광배와 전거근을 단단히 잡는다", "바는 어깨선 위아래로 수직 이동"], "mistakes": ["허리 과신전", "팔꿈치가 안쪽으로 말림", "어깨 아닌 승모로 밀기"], "substitutes": {"shoulder": "밴드 익스터널 로테이션", "home": "덤벨 숄더프레스"}},
  {"id": "ex011", "name": "덤벨 숄더프레스", "part": "어깨", "type": "reps", "equipment": "덤벨", "level": "beginner", "sets": 3, "reps": 12, "duration": 0, "rest": 75, "weight": "2.5~5kg", "gym": true, "home": true, "cues": ["팔꿈치를 살짝 앞으로 둔다", "몸통을 단단히 고정한다", "내릴 때 버틴다"], "mistakes": ["허리 꺾임", "반동 사용", "덤벨 궤적 흔들림"], "substitutes": {"shoulder": "사이드 레터럴 레이즈 가볍게", "fatigue": "2세트로 감소"}},
  {"id": "ex012", "name": "사이드 레터럴 레이즈", "part": "어깨 측면", "type": "reps", "equipment": "덤벨", "level": "beginner", "sets": 3, "reps": 15, "duration": 0, "rest": 45, "weight": "2~2.5kg", "gym": true, "home": true, "cues": ["던지지 말고 들어올린다", "내릴 때 천천히 버틴다", "가슴을 편다"], "mistakes": ["승모로 들어올림", "반동 사용", "너무 높이 듦"], "substitutes": {"shoulder": "밴드 레이즈", "fatigue": "횟수 12회"}},
  {"id": "ex013", "name": "프론트 레이즈", "part": "어깨 전면", "type": "reps", "equipment": "덤벨", "level": "beginner", "sets": 3, "reps": 15, "duration": 0, "rest": 45, "weight": "2~2.5kg", "gym": true, "home": true, "cues": ["팔을 던지지 않는다", "어깨 높이까지만 올린다", "몸통 반동을 줄인다"], "mistakes": ["허리 반동", "승모 과사용", "내릴 때 힘 풀림"], "substitutes": {"shoulder": "밴드 프론트 레이즈", "fatigue": "2세트"}},
  {"id": "ex014", "name": "밴드 익스터널 로테이션", "part": "회전근개", "type": "reps", "equipment": "밴드", "level": "beginner", "sets": 1, "reps": 50, "duration": 0, "rest": 30, "weight": "밴드", "gym": true, "home": false, "cues": ["팔꿈치를 몸통 옆에 고정한다", "어깨가 올라가지 않게 한다", "작은 범위에서 정확히 회전한다"], "mistakes": ["몸통 회전", "팔꿈치 벌어짐", "승모 긴장"], "substitutes": {"home": "수건 외회전 등척성"}},
  {"id": "ex015", "name": "롱풀", "part": "등/광배", "type": "reps", "equipment": "케이블", "level": "beginner", "sets": 3, "reps": 15, "duration": 0, "rest": 75, "weight": "20~40lb", "gym": true, "home": false, "cues": ["발판을 밀고 힙힌지를 잡는다", "정수리부터 엉덩이까지 일자로 유지", "가슴을 더 들어 광배로 당긴다"], "mistakes": ["손목으로 당김", "허리 말림", "풀어줄 때 힘이 탁 풀림"], "substitutes": {"home": "덤벨 로우", "back": "밴드 로우"}},
  {"id": "ex016", "name": "프론트 로우", "part": "등/광배", "type": "reps", "equipment": "머신/케이블", "level": "beginner", "sets": 3, "reps": 15, "duration": 0, "rest": 75, "weight": "20~30lb", "gym": true, "home": false, "cues": ["롱풀과 같은 힙힌지 자세", "광배로 잡아당긴다", "풀어줄 때 신장성 수축을 느낀다"], "mistakes": ["팔로만 당김", "끝에서 힘 풀림", "가슴 무너짐"], "substitutes": {"home": "덤벨 로우", "back": "밴드 로우"}},
  {"id": "ex017", "name": "랫풀다운", "part": "등/광배", "type": "reps", "equipment": "케이블/머신", "level": "beginner", "sets": 3, "reps": 12, "duration": 0, "rest": 75, "weight": "20~40lb 또는 10~20kg", "gym": true, "home": false, "cues": ["무릎패드를 허벅지에 밀착한다", "가슴을 들어 등에 텐션을 만든다", "팔꿈치를 바닥으로 찍어 누른다"], "mistakes": ["팔로만 당김", "몸이 뒤로 과하게 젖음", "가슴이 무너짐"], "substitutes": {"home": "문틀철봉 데드행 또는 밴드 풀다운", "shoulder": "가벼운 로우"}},
  {"id": "ex018", "name": "레그 익스텐션", "part": "대퇴사두", "type": "reps", "equipment": "머신", "level": "beginner", "sets": 3, "reps": 15, "duration": 0, "rest": 60, "weight": "30~50lb", "gym": true, "home": false, "cues": ["발끝을 몸쪽으로 당긴다", "가슴 편 상태를 유지한다", "다리 올릴 때 튕기지 않는다"], "mistakes": ["반동 사용", "엉덩이 뜸", "무릎 뒤가 패드에서 과하게 뜸"], "substitutes": {"home": "월싯", "knee": "짧은 범위 월싯"}},
  {"id": "ex019", "name": "힙쓰러스트", "part": "둔근", "type": "reps", "equipment": "벤치/머신", "level": "beginner", "sets": 3, "reps": 12, "duration": 0, "rest": 60, "weight": "0kg부터", "gym": true, "home": true, "cues": ["무릎과 발목이 일직선 되는 위치", "엉덩이를 수직으로 끌어올린다", "허리 과신전 없이 엉덩이를 조인다"], "mistakes": ["허리로 들어올림", "발 위치가 너무 멂", "엉덩이 수축 부족"], "substitutes": {"home": "글루트 브릿지", "back": "글루트 브릿지 짧은 범위"}},
  {"id": "ex020", "name": "레그프레스", "part": "하체", "type": "reps", "equipment": "머신", "level": "beginner", "sets": 3, "reps": 15, "duration": 0, "rest": 90, "weight": "40~60kg", "gym": true, "home": false, "cues": ["발 높이와 각도를 양쪽 동일하게 맞춘다", "복압을 잡고 내려간다", "무릎을 100% 잠그지 않는다"], "mistakes": ["무릎 완전 잠금", "복압 풀림", "발 위치 비대칭"], "substitutes": {"home": "박스 스쿼트", "knee": "글루트 브릿지"}},
  {"id": "ex021", "name": "스쿼트 프레스", "part": "하체", "type": "reps", "equipment": "머신", "level": "beginner", "sets": 3, "reps": 12, "duration": 0, "rest": 90, "weight": "20~60kg", "gym": true, "home": false, "cues": ["엉덩이를 패드에 박아 넣는다", "손잡이를 당기며 가슴을 든다", "복압 유지 후 발판을 민다"], "mistakes": ["무릎 완전 잠금", "허리 말림", "손잡이 고정 부족"], "substitutes": {"home": "고블릿 스쿼트 또는 박스 스쿼트"}},
  {"id": "ex022", "name": "레그컬", "part": "햄스트링", "type": "reps", "equipment": "머신", "level": "beginner", "sets": 2, "reps": 15, "duration": 0, "rest": 60, "weight": "30~40lb", "gym": true, "home": false, "cues": ["엉덩이 쪽으로 밀고 햄스트링으로 당긴다", "앞허벅지가 펴지는 느낌을 받는다", "반동 없이 조절한다"], "mistakes": ["허리 뜸", "반동 사용", "발끝 힘 과다"], "substitutes": {"home": "힙브릿지 햄스트링 워크아웃"}},
  {"id": "ex023", "name": "이너타이", "part": "내전근", "type": "reps", "equipment": "머신", "level": "beginner", "sets": 3, "reps": 15, "duration": 0, "rest": 60, "weight": "30~50lb", "gym": true, "home": false, "cues": ["허리가 말리지 않게 한다", "골반을 고정한다", "천천히 모으고 천천히 연다"], "mistakes": ["허리 말림", "반동 사용", "상체 흔들림"], "substitutes": {"home": "사이드 라잉 레그리프트"}},
  {"id": "ex024", "name": "덤벨 로우", "part": "등/광배", "type": "reps", "equipment": "덤벨", "level": "beginner", "sets": 3, "reps": 15, "duration": 0, "rest": 60, "weight": "4~5kg", "gym": true, "home": true, "cues": ["가슴을 열고 등을 평평하게 유지", "팔꿈치를 뒤로 보낸다", "내릴 때 광배 힘을 풀지 않는다"], "mistakes": ["허리 말림", "손목으로 당김", "상체 회전 과다"], "substitutes": {"back": "밴드 로우"}},
  {"id": "ex025", "name": "푸쉬업", "part": "가슴/삼두/코어", "type": "reps", "equipment": "맨몸", "level": "beginner", "sets": 3, "reps": 10, "duration": 0, "rest": 60, "weight": "맨몸", "gym": true, "home": true, "cues": ["몸통을 일자로 유지한다", "팔꿈치를 과하게 벌리지 않는다", "가슴으로 바닥을 밀어낸다"], "mistakes": ["허리 처짐", "목만 앞으로 감", "팔꿈치 과벌림"], "substitutes": {"wrist": "벽 푸쉬업", "shoulder": "인클라인 푸쉬업"}},
  {"id": "ex026", "name": "덤벨 체스트 프레스", "part": "가슴", "type": "reps", "equipment": "덤벨", "level": "beginner", "sets": 3, "reps": 15, "duration": 0, "rest": 60, "weight": "3~5kg", "gym": true, "home": true, "cues": ["손목을 세운다", "어깨가 귀 쪽으로 올라가지 않게 한다", "내릴 때 천천히 버틴다"], "mistakes": ["손목 꺾임", "어깨 말림", "반동 사용"], "substitutes": {"shoulder": "벽 푸쉬업"}},
  {"id": "ex027", "name": "케틀벨 스윙", "part": "후면사슬/심폐", "type": "reps", "equipment": "케틀벨", "level": "intermediate", "sets": 3, "reps": 20, "duration": 0, "rest": 75, "weight": "가벼운 케틀벨", "gym": true, "home": false, "cues": ["스쿼트가 아니라 힙힌지", "엉덩이 힘으로 케틀벨을 보낸다", "허리 중립 유지"], "mistakes": ["팔로 들어올림", "허리 굽힘", "무릎 위주 동작"], "substitutes": {"home": "힙힌지 굿모닝", "back": "글루트 브릿지"}},
  {"id": "ex028", "name": "월싯", "part": "하체/지구력", "type": "time", "equipment": "벽", "level": "beginner", "sets": 2, "reps": 0, "duration": 25, "rest": 45, "weight": "맨몸", "gym": true, "home": true, "cues": ["허리를 벽에 붙인다", "무릎이 안으로 모이지 않게 한다", "발 전체로 버틴다"], "mistakes": ["무릎 안쪽 붕괴", "발끝에만 힘", "상체 무너짐"], "substitutes": {"knee": "각도 얕게 수행"}},
  {"id": "ex029", "name": "로잉머신", "part": "유산소/전신", "type": "cardio", "equipment": "로잉머신", "level": "beginner", "sets": 1, "reps": 0, "duration": 15, "rest": 0, "weight": "저강도", "gym": false, "home": true, "cues": ["다리-몸통-팔 순서", "등을 말지 않는다", "호흡을 일정하게 유지"], "mistakes": ["팔로만 당김", "허리 말림", "초반 과속"], "substitutes": {"fatigue": "로잉머신 10분 저강도"}},
  {"id": "ex031", "name": "데드버그", "part": "코어 안정", "type": "reps", "equipment": "맨몸", "level": "beginner", "sets": 2, "reps": 10, "duration": 0, "rest": 45, "weight": "맨몸", "gym": true, "home": true, "cues": ["허리를 바닥에 가볍게 고정", "팔다리를 천천히 뻗는다", "복압을 유지한다"], "mistakes": ["허리 뜸", "속도 빠름", "호흡 멈춤"], "substitutes": {}},
  {"id": "ex032", "name": "버드독", "part": "코어/후면사슬", "type": "reps", "equipment": "맨몸", "level": "beginner", "sets": 2, "reps": 10, "duration": 0, "rest": 45, "weight": "맨몸", "gym": true, "home": true, "cues": ["골반이 흔들리지 않게 한다", "팔과 다리를 길게 뻗는다", "허리를 꺾지 않는다"], "mistakes": ["골반 회전", "허리 과신전", "목 젖힘"], "substitutes": {}},
  {"id": "ex033", "name": "전신 스트레칭", "part": "쿨다운", "type": "stretch", "equipment": "맨몸", "level": "beginner", "sets": 1, "reps": 0, "duration": 300, "rest": 0, "weight": "맨몸", "gym": true, "home": true, "cues": ["호흡을 길게 유지", "통증이 아닌 당김 범위까지만", "운동 후 심박을 천천히 낮춘다"], "mistakes": ["반동으로 늘림", "통증 참기", "호흡 멈춤"], "substitutes": {}},
  {"id": "ex034", "name": "관절 워밍업", "part": "워밍업", "type": "warmup", "equipment": "맨몸", "level": "beginner", "sets": 1, "reps": 0, "duration": 300, "rest": 0, "weight": "맨몸", "gym": true, "home": true, "cues": ["목-어깨-고관절-발목 순서", "통증 없는 범위", "천천히 체온을 올린다"], "mistakes": ["차가운 상태에서 바로 고강도", "반동 큰 동작", "통증 무시"], "substitutes": {}}
];

const PROGRAM = {
  "users": {
    "friend": {"label": "초보", "profile": {"sex": "여", "age": 39, "weight": 80, "experience": "초보", "targetFatLossKg": 3, "equipment": ["맨몸"]}},
    "me": {"label": "비기너", "profile": {"sex": "여", "age": 39, "weight": 91, "experience": "비기너", "targetFatLossKg": 5, "equipment": ["5kg 아령", "로잉머신", "문틀철봉", "맨몸"]}}
  },
  "weeks": [
    {
      "week": 1,
      "theme": "자세 학습/적응",
      "days": [
        {"day": "월", "location": "홈트", "together": false, "title": "초보 홈트 / 비기너 개인운동",
         "friend": [{"exerciseId": "ex034", "name": "관절 워밍업", "type": "warmup", "sets": 1, "reps": 0, "duration": 240, "rest": 0, "note": ""}, {"exerciseId": "ex001", "name": "맨몸 스쿼트", "type": "reps", "sets": 2, "reps": 12, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex008", "name": "코어 니리프트", "type": "time", "sets": 2, "reps": 0, "duration": 10, "rest": 30, "note": ""}, {"exerciseId": "ex006", "name": "플랭크", "type": "time", "sets": 2, "reps": 0, "duration": 20, "rest": 45, "note": ""}],
         "me": [{"exerciseId": "ex034", "name": "관절 워밍업", "type": "warmup", "sets": 1, "reps": 0, "duration": 300, "rest": 0, "note": ""}, {"exerciseId": "ex029", "name": "로잉머신", "type": "cardio", "sets": 1, "reps": 0, "duration": 720, "rest": 0, "note": ""}, {"exerciseId": "ex011", "name": "덤벨 숄더프레스", "type": "reps", "sets": 3, "reps": 12, "duration": 0, "rest": 75, "note": ""}, {"exerciseId": "ex024", "name": "덤벨 로우", "type": "reps", "sets": 3, "reps": 15, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex006", "name": "플랭크", "type": "time", "sets": 3, "reps": 0, "duration": 30, "rest": 45, "note": ""}, {"exerciseId": "ex033", "name": "전신 스트레칭", "type": "stretch", "sets": 1, "reps": 0, "duration": 240, "rest": 0, "note": ""}]},
        {"day": "화", "location": "헬스장", "together": true, "title": "공동 전신 A - 하체/등/코어",
         "friend": [{"exerciseId": "ex034", "name": "관절 워밍업", "type": "warmup", "sets": 1, "reps": 0, "duration": 300, "rest": 0, "note": ""}, {"exerciseId": "ex001", "name": "맨몸 스쿼트", "type": "reps", "sets": 3, "reps": 12, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex003", "name": "스텝박스 오르내리기", "type": "reps", "sets": 2, "reps": 10, "duration": 0, "rest": 45, "note": ""}, {"exerciseId": "ex015", "name": "롱풀", "type": "reps", "sets": 3, "reps": 12, "duration": 0, "rest": 75, "note": ""}, {"exerciseId": "ex006", "name": "플랭크", "type": "time", "sets": 2, "reps": 0, "duration": 20, "rest": 45, "note": ""}, {"exerciseId": "ex033", "name": "전신 스트레칭", "type": "stretch", "sets": 1, "reps": 0, "duration": 240, "rest": 0, "note": ""}],
         "me": [{"exerciseId": "ex034", "name": "관절 워밍업", "type": "warmup", "sets": 1, "reps": 0, "duration": 300, "rest": 0, "note": ""}, {"exerciseId": "ex001", "name": "맨몸 스쿼트", "type": "reps", "sets": 4, "reps": 14, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex017", "name": "랫풀다운", "type": "reps", "sets": 3, "reps": 12, "duration": 0, "rest": 75, "note": ""}, {"exerciseId": "ex015", "name": "롱풀", "type": "reps", "sets": 3, "reps": 15, "duration": 0, "rest": 75, "note": ""}, {"exerciseId": "ex006", "name": "플랭크", "type": "time", "sets": 3, "reps": 0, "duration": 30, "rest": 45, "note": ""}, {"exerciseId": "ex033", "name": "전신 스트레칭", "type": "stretch", "sets": 1, "reps": 0, "duration": 240, "rest": 0, "note": ""}]},
        {"day": "수", "location": "홈트", "together": false, "title": "초보 회복 홈트 / 비기너 선택 휴식",
         "friend": [{"exerciseId": "ex034", "name": "관절 워밍업", "type": "warmup", "sets": 1, "reps": 0, "duration": 180, "rest": 0, "note": ""}, {"exerciseId": "ex009", "name": "슈퍼맨", "type": "time", "sets": 2, "reps": 0, "duration": 10, "rest": 30, "note": ""}, {"exerciseId": "ex009", "name": "슈퍼맨", "type": "time", "sets": 3, "reps": 0, "duration": 10, "rest": 20, "note": ""}, {"exerciseId": "ex003", "name": "스텝박스 오르내리기", "type": "reps", "sets": 2, "reps": 10, "duration": 0, "rest": 45, "note": ""}],
         "me": [{"exerciseId": "ex034", "name": "관절 워밍업", "type": "warmup", "sets": 1, "reps": 0, "duration": 180, "rest": 0, "note": ""}, {"exerciseId": "ex008", "name": "코어 니리프트", "type": "time", "sets": 2, "reps": 0, "duration": 10, "rest": 30, "note": ""}, {"exerciseId": "ex033", "name": "전신 스트레칭", "type": "stretch", "sets": 1, "reps": 0, "duration": 240, "rest": 0, "note": ""}]},
        {"day": "목", "location": "헬스장", "together": true, "title": "공동 전신 B - 하체/어깨/둔근",
         "friend": [{"exerciseId": "ex034", "name": "관절 워밍업", "type": "warmup", "sets": 1, "reps": 0, "duration": 300, "rest": 0, "note": ""}, {"exerciseId": "ex002", "name": "맨몸 런지", "type": "reps", "sets": 2, "reps": 6, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex018", "name": "레그 익스텐션", "type": "reps", "sets": 3, "reps": 12, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex019", "name": "힙쓰러스트", "type": "reps", "sets": 3, "reps": 12, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex011", "name": "덤벨 숄더프레스", "type": "reps", "sets": 2, "reps": 10, "duration": 0, "rest": 75, "note": ""}, {"exerciseId": "ex033", "name": "전신 스트레칭", "type": "stretch", "sets": 1, "reps": 0, "duration": 240, "rest": 0, "note": ""}],
         "me": [{"exerciseId": "ex034", "name": "관절 워밍업", "type": "warmup", "sets": 1, "reps": 0, "duration": 300, "rest": 0, "note": ""}, {"exerciseId": "ex020", "name": "레그프레스", "type": "reps", "sets": 3, "reps": 12, "duration": 0, "rest": 90, "note": ""}, {"exerciseId": "ex019", "name": "힙쓰러스트", "type": "reps", "sets": 3, "reps": 12, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex010", "name": "스미스머신 숄더프레스", "type": "reps", "sets": 3, "reps": 12, "duration": 0, "rest": 75, "note": ""}, {"exerciseId": "ex012", "name": "사이드 레터럴 레이즈", "type": "reps", "sets": 3, "reps": 15, "duration": 0, "rest": 45, "note": ""}, {"exerciseId": "ex033", "name": "전신 스트레칭", "type": "stretch", "sets": 1, "reps": 0, "duration": 240, "rest": 0, "note": ""}]},
        {"day": "금", "location": "개인/홈트", "together": false, "title": "비기너 개인운동 / 초보 가벼운 홈트",
         "friend": [{"exerciseId": "ex034", "name": "관절 워밍업", "type": "warmup", "sets": 1, "reps": 0, "duration": 180, "rest": 0, "note": ""}, {"exerciseId": "ex001", "name": "맨몸 스쿼트", "type": "reps", "sets": 2, "reps": 12, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex006", "name": "플랭크", "type": "time", "sets": 2, "reps": 0, "duration": 20, "rest": 45, "note": ""}],
         "me": [{"exerciseId": "ex034", "name": "관절 워밍업", "type": "warmup", "sets": 1, "reps": 0, "duration": 300, "rest": 0, "note": ""}, {"exerciseId": "ex029", "name": "로잉머신", "type": "cardio", "sets": 1, "reps": 0, "duration": 720, "rest": 0, "note": ""}, {"exerciseId": "ex024", "name": "덤벨 로우", "type": "reps", "sets": 3, "reps": 15, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex026", "name": "덤벨 체스트 프레스", "type": "reps", "sets": 3, "reps": 12, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex007", "name": "암워킹", "type": "reps", "sets": 2, "reps": 8, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex033", "name": "전신 스트레칭", "type": "stretch", "sets": 1, "reps": 0, "duration": 240, "rest": 0, "note": ""}]},
        {"day": "토", "location": "휴식", "together": false, "title": "회복일",
         "friend": [{"exerciseId": "ex033", "name": "전신 스트레칭", "type": "stretch", "sets": 1, "reps": 0, "duration": 240, "rest": 0, "note": ""}],
         "me": [{"exerciseId": "ex033", "name": "전신 스트레칭", "type": "stretch", "sets": 1, "reps": 0, "duration": 240, "rest": 0, "note": ""}]},
        {"day": "일", "location": "헬스장", "together": true, "title": "공동 전신 C - 순환/체력",
         "friend": [{"exerciseId": "ex034", "name": "관절 워밍업", "type": "warmup", "sets": 1, "reps": 0, "duration": 300, "rest": 0, "note": ""}, {"exerciseId": "ex001", "name": "맨몸 스쿼트", "type": "reps", "sets": 3, "reps": 12, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex004", "name": "버피", "type": "reps", "sets": 2, "reps": 6, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex016", "name": "프론트 로우", "type": "reps", "sets": 3, "reps": 12, "duration": 0, "rest": 75, "note": ""}, {"exerciseId": "ex006", "name": "플랭크", "type": "time", "sets": 2, "reps": 0, "duration": 20, "rest": 45, "note": ""}, {"exerciseId": "ex033", "name": "전신 스트레칭", "type": "stretch", "sets": 1, "reps": 0, "duration": 240, "rest": 0, "note": ""}],
         "me": [{"exerciseId": "ex034", "name": "관절 워밍업", "type": "warmup", "sets": 1, "reps": 0, "duration": 300, "rest": 0, "note": ""}, {"exerciseId": "ex021", "name": "스쿼트 프레스", "type": "reps", "sets": 3, "reps": 12, "duration": 0, "rest": 90, "note": ""}, {"exerciseId": "ex017", "name": "랫풀다운", "type": "reps", "sets": 3, "reps": 12, "duration": 0, "rest": 75, "note": ""}, {"exerciseId": "ex025", "name": "푸쉬업", "type": "reps", "sets": 3, "reps": 8, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex006", "name": "플랭크", "type": "time", "sets": 3, "reps": 0, "duration": 30, "rest": 45, "note": ""}, {"exerciseId": "ex029", "name": "로잉머신", "type": "cardio", "sets": 1, "reps": 0, "duration": 720, "rest": 0, "note": ""}, {"exerciseId": "ex033", "name": "전신 스트레칭", "type": "stretch", "sets": 1, "reps": 0, "duration": 240, "rest": 0, "note": ""}]}
      ]
    },
    {
      "week": 2,
      "theme": "자세 안정/반복",
      "days": [
        {"day": "월", "location": "홈트", "together": false, "title": "초보 홈트 / 비기너 개인운동",
         "friend": [{"exerciseId": "ex034", "name": "관절 워밍업", "type": "warmup", "sets": 1, "reps": 0, "duration": 240, "rest": 0, "note": ""}, {"exerciseId": "ex001", "name": "맨몸 스쿼트", "type": "reps", "sets": 2, "reps": 15, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex008", "name": "코어 니리프트", "type": "time", "sets": 2, "reps": 0, "duration": 10, "rest": 30, "note": ""}, {"exerciseId": "ex006", "name": "플랭크", "type": "time", "sets": 2, "reps": 0, "duration": 25, "rest": 45, "note": ""}],
         "me": [{"exerciseId": "ex034", "name": "관절 워밍업", "type": "warmup", "sets": 1, "reps": 0, "duration": 300, "rest": 0, "note": ""}, {"exerciseId": "ex029", "name": "로잉머신", "type": "cardio", "sets": 1, "reps": 0, "duration": 900, "rest": 0, "note": ""}, {"exerciseId": "ex011", "name": "덤벨 숄더프레스", "type": "reps", "sets": 3, "reps": 13, "duration": 0, "rest": 75, "note": ""}, {"exerciseId": "ex024", "name": "덤벨 로우", "type": "reps", "sets": 3, "reps": 15, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex006", "name": "플랭크", "type": "time", "sets": 3, "reps": 0, "duration": 35, "rest": 45, "note": ""}, {"exerciseId": "ex033", "name": "전신 스트레칭", "type": "stretch", "sets": 1, "reps": 0, "duration": 240, "rest": 0, "note": ""}]},
        {"day": "화", "location": "헬스장", "together": true, "title": "공동 전신 A - 하체/등/코어",
         "friend": [{"exerciseId": "ex034", "name": "관절 워밍업", "type": "warmup", "sets": 1, "reps": 0, "duration": 300, "rest": 0, "note": ""}, {"exerciseId": "ex001", "name": "맨몸 스쿼트", "type": "reps", "sets": 3, "reps": 15, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex003", "name": "스텝박스 오르내리기", "type": "reps", "sets": 2, "reps": 12, "duration": 0, "rest": 45, "note": ""}, {"exerciseId": "ex015", "name": "롱풀", "type": "reps", "sets": 3, "reps": 13, "duration": 0, "rest": 75, "note": ""}, {"exerciseId": "ex006", "name": "플랭크", "type": "time", "sets": 2, "reps": 0, "duration": 25, "rest": 45, "note": ""}, {"exerciseId": "ex033", "name": "전신 스트레칭", "type": "stretch", "sets": 1, "reps": 0, "duration": 240, "rest": 0, "note": ""}],
         "me": [{"exerciseId": "ex034", "name": "관절 워밍업", "type": "warmup", "sets": 1, "reps": 0, "duration": 300, "rest": 0, "note": ""}, {"exerciseId": "ex001", "name": "맨몸 스쿼트", "type": "reps", "sets": 4, "reps": 17, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex017", "name": "랫풀다운", "type": "reps", "sets": 3, "reps": 13, "duration": 0, "rest": 75, "note": ""}, {"exerciseId": "ex015", "name": "롱풀", "type": "reps", "sets": 3, "reps": 15, "duration": 0, "rest": 75, "note": ""}, {"exerciseId": "ex006", "name": "플랭크", "type": "time", "sets": 3, "reps": 0, "duration": 35, "rest": 45, "note": ""}, {"exerciseId": "ex033", "name": "전신 스트레칭", "type": "stretch", "sets": 1, "reps": 0, "duration": 240, "rest": 0, "note": ""}]},
        {"day": "수", "location": "홈트", "together": false, "title": "초보 회복 홈트 / 비기너 선택 휴식",
         "friend": [{"exerciseId": "ex034", "name": "관절 워밍업", "type": "warmup", "sets": 1, "reps": 0, "duration": 180, "rest": 0, "note": ""}, {"exerciseId": "ex009", "name": "슈퍼맨", "type": "time", "sets": 2, "reps": 0, "duration": 10, "rest": 30, "note": ""}, {"exerciseId": "ex009", "name": "슈퍼맨", "type": "time", "sets": 3, "reps": 0, "duration": 12, "rest": 20, "note": ""}, {"exerciseId": "ex003", "name": "스텝박스 오르내리기", "type": "reps", "sets": 2, "reps": 10, "duration": 0, "rest": 45, "note": ""}],
         "me": [{"exerciseId": "ex034", "name": "관절 워밍업", "type": "warmup", "sets": 1, "reps": 0, "duration": 180, "rest": 0, "note": ""}, {"exerciseId": "ex008", "name": "코어 니리프트", "type": "time", "sets": 2, "reps": 0, "duration": 10, "rest": 30, "note": ""}, {"exerciseId": "ex033", "name": "전신 스트레칭", "type": "stretch", "sets": 1, "reps": 0, "duration": 240, "rest": 0, "note": ""}]},
        {"day": "목", "location": "헬스장", "together": true, "title": "공동 전신 B - 하체/어깨/둔근",
         "friend": [{"exerciseId": "ex034", "name": "관절 워밍업", "type": "warmup", "sets": 1, "reps": 0, "duration": 300, "rest": 0, "note": ""}, {"exerciseId": "ex002", "name": "맨몸 런지", "type": "reps", "sets": 2, "reps": 8, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex018", "name": "레그 익스텐션", "type": "reps", "sets": 3, "reps": 13, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex019", "name": "힙쓰러스트", "type": "reps", "sets": 3, "reps": 13, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex011", "name": "덤벨 숄더프레스", "type": "reps", "sets": 2, "reps": 11, "duration": 0, "rest": 75, "note": ""}, {"exerciseId": "ex033", "name": "전신 스트레칭", "type": "stretch", "sets": 1, "reps": 0, "duration": 240, "rest": 0, "note": ""}],
         "me": [{"exerciseId": "ex034", "name": "관절 워밍업", "type": "warmup", "sets": 1, "reps": 0, "duration": 300, "rest": 0, "note": ""}, {"exerciseId": "ex020", "name": "레그프레스", "type": "reps", "sets": 3, "reps": 13, "duration": 0, "rest": 90, "note": ""}, {"exerciseId": "ex019", "name": "힙쓰러스트", "type": "reps", "sets": 3, "reps": 13, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex010", "name": "스미스머신 숄더프레스", "type": "reps", "sets": 3, "reps": 13, "duration": 0, "rest": 75, "note": ""}, {"exerciseId": "ex012", "name": "사이드 레터럴 레이즈", "type": "reps", "sets": 3, "reps": 16, "duration": 0, "rest": 45, "note": ""}, {"exerciseId": "ex033", "name": "전신 스트레칭", "type": "stretch", "sets": 1, "reps": 0, "duration": 240, "rest": 0, "note": ""}]},
        {"day": "금", "location": "개인/홈트", "together": false, "title": "비기너 개인운동 / 초보 가벼운 홈트",
         "friend": [{"exerciseId": "ex034", "name": "관절 워밍업", "type": "warmup", "sets": 1, "reps": 0, "duration": 180, "rest": 0, "note": ""}, {"exerciseId": "ex001", "name": "맨몸 스쿼트", "type": "reps", "sets": 2, "reps": 15, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex006", "name": "플랭크", "type": "time", "sets": 2, "reps": 0, "duration": 25, "rest": 45, "note": ""}],
         "me": [{"exerciseId": "ex034", "name": "관절 워밍업", "type": "warmup", "sets": 1, "reps": 0, "duration": 300, "rest": 0, "note": ""}, {"exerciseId": "ex029", "name": "로잉머신", "type": "cardio", "sets": 1, "reps": 0, "duration": 900, "rest": 0, "note": ""}, {"exerciseId": "ex024", "name": "덤벨 로우", "type": "reps", "sets": 3, "reps": 15, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex026", "name": "덤벨 체스트 프레스", "type": "reps", "sets": 3, "reps": 13, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex007", "name": "암워킹", "type": "reps", "sets": 2, "reps": 9, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex033", "name": "전신 스트레칭", "type": "stretch", "sets": 1, "reps": 0, "duration": 240, "rest": 0, "note": ""}]},
        {"day": "토", "location": "휴식", "together": false, "title": "회복일",
         "friend": [{"exerciseId": "ex033", "name": "전신 스트레칭", "type": "stretch", "sets": 1, "reps": 0, "duration": 240, "rest": 0, "note": ""}],
         "me": [{"exerciseId": "ex033", "name": "전신 스트레칭", "type": "stretch", "sets": 1, "reps": 0, "duration": 240, "rest": 0, "note": ""}]},
        {"day": "일", "location": "헬스장", "together": true, "title": "공동 전신 C - 순환/체력",
         "friend": [{"exerciseId": "ex034", "name": "관절 워밍업", "type": "warmup", "sets": 1, "reps": 0, "duration": 300, "rest": 0, "note": ""}, {"exerciseId": "ex001", "name": "맨몸 스쿼트", "type": "reps", "sets": 3, "reps": 15, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex004", "name": "버피", "type": "reps", "sets": 2, "reps": 7, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex016", "name": "프론트 로우", "type": "reps", "sets": 3, "reps": 13, "duration": 0, "rest": 75, "note": ""}, {"exerciseId": "ex006", "name": "플랭크", "type": "time", "sets": 2, "reps": 0, "duration": 25, "rest": 45, "note": ""}, {"exerciseId": "ex033", "name": "전신 스트레칭", "type": "stretch", "sets": 1, "reps": 0, "duration": 240, "rest": 0, "note": ""}],
         "me": [{"exerciseId": "ex034", "name": "관절 워밍업", "type": "warmup", "sets": 1, "reps": 0, "duration": 300, "rest": 0, "note": ""}, {"exerciseId": "ex021", "name": "스쿼트 프레스", "type": "reps", "sets": 3, "reps": 13, "duration": 0, "rest": 90, "note": ""}, {"exerciseId": "ex017", "name": "랫풀다운", "type": "reps", "sets": 3, "reps": 13, "duration": 0, "rest": 75, "note": ""}, {"exerciseId": "ex025", "name": "푸쉬업", "type": "reps", "sets": 3, "reps": 9, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex006", "name": "플랭크", "type": "time", "sets": 3, "reps": 0, "duration": 35, "rest": 45, "note": ""}, {"exerciseId": "ex029", "name": "로잉머신", "type": "cardio", "sets": 1, "reps": 0, "duration": 900, "rest": 0, "note": ""}, {"exerciseId": "ex033", "name": "전신 스트레칭", "type": "stretch", "sets": 1, "reps": 0, "duration": 240, "rest": 0, "note": ""}]}
      ]
    },
    {
      "week": 3,
      "theme": "근력·체력 증가",
      "days": [
        {"day": "월", "location": "홈트", "together": false, "title": "초보 홈트 / 비기너 개인운동",
         "friend": [{"exerciseId": "ex034", "name": "관절 워밍업", "type": "warmup", "sets": 1, "reps": 0, "duration": 240, "rest": 0, "note": ""}, {"exerciseId": "ex001", "name": "맨몸 스쿼트", "type": "reps", "sets": 2, "reps": 18, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex008", "name": "코어 니리프트", "type": "time", "sets": 2, "reps": 0, "duration": 10, "rest": 30, "note": ""}, {"exerciseId": "ex006", "name": "플랭크", "type": "time", "sets": 2, "reps": 0, "duration": 30, "rest": 45, "note": ""}],
         "me": [{"exerciseId": "ex034", "name": "관절 워밍업", "type": "warmup", "sets": 1, "reps": 0, "duration": 300, "rest": 0, "note": ""}, {"exerciseId": "ex029", "name": "로잉머신", "type": "cardio", "sets": 1, "reps": 0, "duration": 1080, "rest": 0, "note": ""}, {"exerciseId": "ex011", "name": "덤벨 숄더프레스", "type": "reps", "sets": 3, "reps": 14, "duration": 0, "rest": 75, "note": ""}, {"exerciseId": "ex024", "name": "덤벨 로우", "type": "reps", "sets": 3, "reps": 15, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex006", "name": "플랭크", "type": "time", "sets": 3, "reps": 0, "duration": 40, "rest": 45, "note": ""}, {"exerciseId": "ex033", "name": "전신 스트레칭", "type": "stretch", "sets": 1, "reps": 0, "duration": 240, "rest": 0, "note": ""}]},
        {"day": "화", "location": "헬스장", "together": true, "title": "공동 전신 A - 하체/등/코어",
         "friend": [{"exerciseId": "ex034", "name": "관절 워밍업", "type": "warmup", "sets": 1, "reps": 0, "duration": 300, "rest": 0, "note": ""}, {"exerciseId": "ex001", "name": "맨몸 스쿼트", "type": "reps", "sets": 3, "reps": 18, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex003", "name": "스텝박스 오르내리기", "type": "reps", "sets": 2, "reps": 14, "duration": 0, "rest": 45, "note": ""}, {"exerciseId": "ex015", "name": "롱풀", "type": "reps", "sets": 3, "reps": 14, "duration": 0, "rest": 75, "note": ""}, {"exerciseId": "ex006", "name": "플랭크", "type": "time", "sets": 2, "reps": 0, "duration": 30, "rest": 45, "note": ""}, {"exerciseId": "ex033", "name": "전신 스트레칭", "type": "stretch", "sets": 1, "reps": 0, "duration": 240, "rest": 0, "note": ""}],
         "me": [{"exerciseId": "ex034", "name": "관절 워밍업", "type": "warmup", "sets": 1, "reps": 0, "duration": 300, "rest": 0, "note": ""}, {"exerciseId": "ex001", "name": "맨몸 스쿼트", "type": "reps", "sets": 4, "reps": 20, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex017", "name": "랫풀다운", "type": "reps", "sets": 3, "reps": 14, "duration": 0, "rest": 75, "note": ""}, {"exerciseId": "ex015", "name": "롱풀", "type": "reps", "sets": 3, "reps": 15, "duration": 0, "rest": 75, "note": ""}, {"exerciseId": "ex006", "name": "플랭크", "type": "time", "sets": 3, "reps": 0, "duration": 40, "rest": 45, "note": ""}, {"exerciseId": "ex033", "name": "전신 스트레칭", "type": "stretch", "sets": 1, "reps": 0, "duration": 240, "rest": 0, "note": ""}]},
        {"day": "수", "location": "홈트", "together": false, "title": "초보 회복 홈트 / 비기너 선택 휴식",
         "friend": [{"exerciseId": "ex034", "name": "관절 워밍업", "type": "warmup", "sets": 1, "reps": 0, "duration": 180, "rest": 0, "note": ""}, {"exerciseId": "ex009", "name": "슈퍼맨", "type": "time", "sets": 2, "reps": 0, "duration": 10, "rest": 30, "note": ""}, {"exerciseId": "ex009", "name": "슈퍼맨", "type": "time", "sets": 3, "reps": 0, "duration": 14, "rest": 20, "note": ""}, {"exerciseId": "ex003", "name": "스텝박스 오르내리기", "type": "reps", "sets": 2, "reps": 10, "duration": 0, "rest": 45, "note": ""}],
         "me": [{"exerciseId": "ex034", "name": "관절 워밍업", "type": "warmup", "sets": 1, "reps": 0, "duration": 180, "rest": 0, "note": ""}, {"exerciseId": "ex008", "name": "코어 니리프트", "type": "time", "sets": 2, "reps": 0, "duration": 10, "rest": 30, "note": ""}, {"exerciseId": "ex033", "name": "전신 스트레칭", "type": "stretch", "sets": 1, "reps": 0, "duration": 240, "rest": 0, "note": ""}]},
        {"day": "목", "location": "헬스장", "together": true, "title": "공동 전신 B - 하체/어깨/둔근",
         "friend": [{"exerciseId": "ex034", "name": "관절 워밍업", "type": "warmup", "sets": 1, "reps": 0, "duration": 300, "rest": 0, "note": ""}, {"exerciseId": "ex002", "name": "맨몸 런지", "type": "reps", "sets": 2, "reps": 10, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex018", "name": "레그 익스텐션", "type": "reps", "sets": 3, "reps": 14, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex019", "name": "힙쓰러스트", "type": "reps", "sets": 3, "reps": 14, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex011", "name": "덤벨 숄더프레스", "type": "reps", "sets": 2, "reps": 12, "duration": 0, "rest": 75, "note": ""}, {"exerciseId": "ex033", "name": "전신 스트레칭", "type": "stretch", "sets": 1, "reps": 0, "duration": 240, "rest": 0, "note": ""}],
         "me": [{"exerciseId": "ex034", "name": "관절 워밍업", "type": "warmup", "sets": 1, "reps": 0, "duration": 300, "rest": 0, "note": ""}, {"exerciseId": "ex020", "name": "레그프레스", "type": "reps", "sets": 3, "reps": 14, "duration": 0, "rest": 90, "note": ""}, {"exerciseId": "ex019", "name": "힙쓰러스트", "type": "reps", "sets": 3, "reps": 14, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex010", "name": "스미스머신 숄더프레스", "type": "reps", "sets": 3, "reps": 14, "duration": 0, "rest": 75, "note": ""}, {"exerciseId": "ex012", "name": "사이드 레터럴 레이즈", "type": "reps", "sets": 3, "reps": 17, "duration": 0, "rest": 45, "note": ""}, {"exerciseId": "ex033", "name": "전신 스트레칭", "type": "stretch", "sets": 1, "reps": 0, "duration": 240, "rest": 0, "note": ""}]},
        {"day": "금", "location": "개인/홈트", "together": false, "title": "비기너 개인운동 / 초보 가벼운 홈트",
         "friend": [{"exerciseId": "ex034", "name": "관절 워밍업", "type": "warmup", "sets": 1, "reps": 0, "duration": 180, "rest": 0, "note": ""}, {"exerciseId": "ex001", "name": "맨몸 스쿼트", "type": "reps", "sets": 2, "reps": 18, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex006", "name": "플랭크", "type": "time", "sets": 2, "reps": 0, "duration": 30, "rest": 45, "note": ""}],
         "me": [{"exerciseId": "ex034", "name": "관절 워밍업", "type": "warmup", "sets": 1, "reps": 0, "duration": 300, "rest": 0, "note": ""}, {"exerciseId": "ex029", "name": "로잉머신", "type": "cardio", "sets": 1, "reps": 0, "duration": 1080, "rest": 0, "note": ""}, {"exerciseId": "ex024", "name": "덤벨 로우", "type": "reps", "sets": 3, "reps": 15, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex026", "name": "덤벨 체스트 프레스", "type": "reps", "sets": 3, "reps": 14, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex007", "name": "암워킹", "type": "reps", "sets": 2, "reps": 10, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex033", "name": "전신 스트레칭", "type": "stretch", "sets": 1, "reps": 0, "duration": 240, "rest": 0, "note": ""}]},
        {"day": "토", "location": "휴식", "together": false, "title": "회복일",
         "friend": [{"exerciseId": "ex033", "name": "전신 스트레칭", "type": "stretch", "sets": 1, "reps": 0, "duration": 240, "rest": 0, "note": ""}],
         "me": [{"exerciseId": "ex033", "name": "전신 스트레칭", "type": "stretch", "sets": 1, "reps": 0, "duration": 240, "rest": 0, "note": ""}]},
        {"day": "일", "location": "헬스장", "together": true, "title": "공동 전신 C - 순환/체력",
         "friend": [{"exerciseId": "ex034", "name": "관절 워밍업", "type": "warmup", "sets": 1, "reps": 0, "duration": 300, "rest": 0, "note": ""}, {"exerciseId": "ex001", "name": "맨몸 스쿼트", "type": "reps", "sets": 3, "reps": 18, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex004", "name": "버피", "type": "reps", "sets": 2, "reps": 8, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex016", "name": "프론트 로우", "type": "reps", "sets": 3, "reps": 14, "duration": 0, "rest": 75, "note": ""}, {"exerciseId": "ex006", "name": "플랭크", "type": "time", "sets": 2, "reps": 0, "duration": 30, "rest": 45, "note": ""}, {"exerciseId": "ex033", "name": "전신 스트레칭", "type": "stretch", "sets": 1, "reps": 0, "duration": 240, "rest": 0, "note": ""}],
         "me": [{"exerciseId": "ex034", "name": "관절 워밍업", "type": "warmup", "sets": 1, "reps": 0, "duration": 300, "rest": 0, "note": ""}, {"exerciseId": "ex021", "name": "스쿼트 프레스", "type": "reps", "sets": 3, "reps": 14, "duration": 0, "rest": 90, "note": ""}, {"exerciseId": "ex017", "name": "랫풀다운", "type": "reps", "sets": 3, "reps": 14, "duration": 0, "rest": 75, "note": ""}, {"exerciseId": "ex025", "name": "푸쉬업", "type": "reps", "sets": 3, "reps": 10, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex006", "name": "플랭크", "type": "time", "sets": 3, "reps": 0, "duration": 40, "rest": 45, "note": ""}, {"exerciseId": "ex029", "name": "로잉머신", "type": "cardio", "sets": 1, "reps": 0, "duration": 1080, "rest": 0, "note": ""}, {"exerciseId": "ex033", "name": "전신 스트레칭", "type": "stretch", "sets": 1, "reps": 0, "duration": 240, "rest": 0, "note": ""}]}
      ]
    },
    {
      "week": 4,
      "theme": "완성/체력 테스트",
      "days": [
        {"day": "월", "location": "홈트", "together": false, "title": "초보 홈트 / 비기너 개인운동",
         "friend": [{"exerciseId": "ex034", "name": "관절 워밍업", "type": "warmup", "sets": 1, "reps": 0, "duration": 240, "rest": 0, "note": ""}, {"exerciseId": "ex001", "name": "맨몸 스쿼트", "type": "reps", "sets": 2, "reps": 20, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex008", "name": "코어 니리프트", "type": "time", "sets": 2, "reps": 0, "duration": 10, "rest": 30, "note": ""}, {"exerciseId": "ex006", "name": "플랭크", "type": "time", "sets": 2, "reps": 0, "duration": 35, "rest": 45, "note": ""}],
         "me": [{"exerciseId": "ex034", "name": "관절 워밍업", "type": "warmup", "sets": 1, "reps": 0, "duration": 300, "rest": 0, "note": ""}, {"exerciseId": "ex029", "name": "로잉머신", "type": "cardio", "sets": 1, "reps": 0, "duration": 1200, "rest": 0, "note": ""}, {"exerciseId": "ex011", "name": "덤벨 숄더프레스", "type": "reps", "sets": 3, "reps": 15, "duration": 0, "rest": 75, "note": ""}, {"exerciseId": "ex024", "name": "덤벨 로우", "type": "reps", "sets": 3, "reps": 15, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex006", "name": "플랭크", "type": "time", "sets": 3, "reps": 0, "duration": 45, "rest": 45, "note": ""}, {"exerciseId": "ex033", "name": "전신 스트레칭", "type": "stretch", "sets": 1, "reps": 0, "duration": 240, "rest": 0, "note": ""}]},
        {"day": "화", "location": "헬스장", "together": true, "title": "공동 전신 A - 하체/등/코어",
         "friend": [{"exerciseId": "ex034", "name": "관절 워밍업", "type": "warmup", "sets": 1, "reps": 0, "duration": 300, "rest": 0, "note": ""}, {"exerciseId": "ex001", "name": "맨몸 스쿼트", "type": "reps", "sets": 3, "reps": 20, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex003", "name": "스텝박스 오르내리기", "type": "reps", "sets": 2, "reps": 15, "duration": 0, "rest": 45, "note": ""}, {"exerciseId": "ex015", "name": "롱풀", "type": "reps", "sets": 3, "reps": 15, "duration": 0, "rest": 75, "note": ""}, {"exerciseId": "ex006", "name": "플랭크", "type": "time", "sets": 2, "reps": 0, "duration": 35, "rest": 45, "note": ""}, {"exerciseId": "ex033", "name": "전신 스트레칭", "type": "stretch", "sets": 1, "reps": 0, "duration": 240, "rest": 0, "note": ""}],
         "me": [{"exerciseId": "ex034", "name": "관절 워밍업", "type": "warmup", "sets": 1, "reps": 0, "duration": 300, "rest": 0, "note": ""}, {"exerciseId": "ex001", "name": "맨몸 스쿼트", "type": "reps", "sets": 4, "reps": 22, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex017", "name": "랫풀다운", "type": "reps", "sets": 3, "reps": 15, "duration": 0, "rest": 75, "note": ""}, {"exerciseId": "ex015", "name": "롱풀", "type": "reps", "sets": 3, "reps": 15, "duration": 0, "rest": 75, "note": ""}, {"exerciseId": "ex006", "name": "플랭크", "type": "time", "sets": 3, "reps": 0, "duration": 45, "rest": 45, "note": ""}, {"exerciseId": "ex033", "name": "전신 스트레칭", "type": "stretch", "sets": 1, "reps": 0, "duration": 240, "rest": 0, "note": ""}]},
        {"day": "수", "location": "홈트", "together": false, "title": "초보 회복 홈트 / 비기너 선택 휴식",
         "friend": [{"exerciseId": "ex034", "name": "관절 워밍업", "type": "warmup", "sets": 1, "reps": 0, "duration": 180, "rest": 0, "note": ""}, {"exerciseId": "ex009", "name": "슈퍼맨", "type": "time", "sets": 2, "reps": 0, "duration": 10, "rest": 30, "note": ""}, {"exerciseId": "ex009", "name": "슈퍼맨", "type": "time", "sets": 3, "reps": 0, "duration": 15, "rest": 20, "note": ""}, {"exerciseId": "ex003", "name": "스텝박스 오르내리기", "type": "reps", "sets": 2, "reps": 10, "duration": 0, "rest": 45, "note": ""}],
         "me": [{"exerciseId": "ex034", "name": "관절 워밍업", "type": "warmup", "sets": 1, "reps": 0, "duration": 180, "rest": 0, "note": ""}, {"exerciseId": "ex008", "name": "코어 니리프트", "type": "time", "sets": 2, "reps": 0, "duration": 10, "rest": 30, "note": ""}, {"exerciseId": "ex033", "name": "전신 스트레칭", "type": "stretch", "sets": 1, "reps": 0, "duration": 240, "rest": 0, "note": ""}]},
        {"day": "목", "location": "헬스장", "together": true, "title": "공동 전신 B - 하체/어깨/둔근",
         "friend": [{"exerciseId": "ex034", "name": "관절 워밍업", "type": "warmup", "sets": 1, "reps": 0, "duration": 300, "rest": 0, "note": ""}, {"exerciseId": "ex002", "name": "맨몸 런지", "type": "reps", "sets": 2, "reps": 12, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex018", "name": "레그 익스텐션", "type": "reps", "sets": 3, "reps": 15, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex019", "name": "힙쓰러스트", "type": "reps", "sets": 3, "reps": 15, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex011", "name": "덤벨 숄더프레스", "type": "reps", "sets": 2, "reps": 13, "duration": 0, "rest": 75, "note": ""}, {"exerciseId": "ex033", "name": "전신 스트레칭", "type": "stretch", "sets": 1, "reps": 0, "duration": 240, "rest": 0, "note": ""}],
         "me": [{"exerciseId": "ex034", "name": "관절 워밍업", "type": "warmup", "sets": 1, "reps": 0, "duration": 300, "rest": 0, "note": ""}, {"exerciseId": "ex020", "name": "레그프레스", "type": "reps", "sets": 3, "reps": 15, "duration": 0, "rest": 90, "note": ""}, {"exerciseId": "ex019", "name": "힙쓰러스트", "type": "reps", "sets": 3, "reps": 15, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex010", "name": "스미스머신 숄더프레스", "type": "reps", "sets": 3, "reps": 15, "duration": 0, "rest": 75, "note": ""}, {"exerciseId": "ex012", "name": "사이드 레터럴 레이즈", "type": "reps", "sets": 3, "reps": 18, "duration": 0, "rest": 45, "note": ""}, {"exerciseId": "ex033", "name": "전신 스트레칭", "type": "stretch", "sets": 1, "reps": 0, "duration": 240, "rest": 0, "note": ""}]},
        {"day": "금", "location": "개인/홈트", "together": false, "title": "비기너 개인운동 / 초보 가벼운 홈트",
         "friend": [{"exerciseId": "ex034", "name": "관절 워밍업", "type": "warmup", "sets": 1, "reps": 0, "duration": 180, "rest": 0, "note": ""}, {"exerciseId": "ex001", "name": "맨몸 스쿼트", "type": "reps", "sets": 2, "reps": 20, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex006", "name": "플랭크", "type": "time", "sets": 2, "reps": 0, "duration": 35, "rest": 45, "note": ""}],
         "me": [{"exerciseId": "ex034", "name": "관절 워밍업", "type": "warmup", "sets": 1, "reps": 0, "duration": 300, "rest": 0, "note": ""}, {"exerciseId": "ex029", "name": "로잉머신", "type": "cardio", "sets": 1, "reps": 0, "duration": 1200, "rest": 0, "note": ""}, {"exerciseId": "ex024", "name": "덤벨 로우", "type": "reps", "sets": 3, "reps": 15, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex026", "name": "덤벨 체스트 프레스", "type": "reps", "sets": 3, "reps": 15, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex007", "name": "암워킹", "type": "reps", "sets": 2, "reps": 12, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex033", "name": "전신 스트레칭", "type": "stretch", "sets": 1, "reps": 0, "duration": 240, "rest": 0, "note": ""}]},
        {"day": "토", "location": "휴식", "together": false, "title": "회복일",
         "friend": [{"exerciseId": "ex033", "name": "전신 스트레칭", "type": "stretch", "sets": 1, "reps": 0, "duration": 240, "rest": 0, "note": ""}],
         "me": [{"exerciseId": "ex033", "name": "전신 스트레칭", "type": "stretch", "sets": 1, "reps": 0, "duration": 240, "rest": 0, "note": ""}]},
        {"day": "일", "location": "헬스장", "together": true, "title": "공동 전신 C - 순환/체력",
         "friend": [{"exerciseId": "ex034", "name": "관절 워밍업", "type": "warmup", "sets": 1, "reps": 0, "duration": 300, "rest": 0, "note": ""}, {"exerciseId": "ex001", "name": "맨몸 스쿼트", "type": "reps", "sets": 3, "reps": 20, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex004", "name": "버피", "type": "reps", "sets": 2, "reps": 9, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex016", "name": "프론트 로우", "type": "reps", "sets": 3, "reps": 15, "duration": 0, "rest": 75, "note": ""}, {"exerciseId": "ex006", "name": "플랭크", "type": "time", "sets": 2, "reps": 0, "duration": 35, "rest": 45, "note": ""}, {"exerciseId": "ex033", "name": "전신 스트레칭", "type": "stretch", "sets": 1, "reps": 0, "duration": 240, "rest": 0, "note": ""}],
         "me": [{"exerciseId": "ex034", "name": "관절 워밍업", "type": "warmup", "sets": 1, "reps": 0, "duration": 300, "rest": 0, "note": ""}, {"exerciseId": "ex021", "name": "스쿼트 프레스", "type": "reps", "sets": 3, "reps": 15, "duration": 0, "rest": 90, "note": ""}, {"exerciseId": "ex017", "name": "랫풀다운", "type": "reps", "sets": 3, "reps": 15, "duration": 0, "rest": 75, "note": ""}, {"exerciseId": "ex025", "name": "푸쉬업", "type": "reps", "sets": 3, "reps": 10, "duration": 0, "rest": 60, "note": ""}, {"exerciseId": "ex006", "name": "플랭크", "type": "time", "sets": 3, "reps": 0, "duration": 45, "rest": 45, "note": ""}, {"exerciseId": "ex029", "name": "로잉머신", "type": "cardio", "sets": 1, "reps": 0, "duration": 1200, "rest": 0, "note": ""}, {"exerciseId": "ex033", "name": "전신 스트레칭", "type": "stretch", "sets": 1, "reps": 0, "duration": 240, "rest": 0, "note": ""}]}
      ]
    }
  ]
};

const RULES = [
  {"id":"rule_knee","condition":"pain includes knee","action":"런지·레그프레스 강도 감소, 런지는 스텝박스 오르내리기 또는 맨몸 스쿼트 저강도로 조정","substitute":{"맨몸 런지":"스텝박스 오르내리기","레그프레스":"맨몸 스쿼트"}},
  {"id":"rule_shoulder","condition":"pain includes shoulder","action":"숄더프레스 강도 감소, 밴드 익스터널 로테이션 또는 등 운동 저강도로 전환","substitute":{"스미스머신 숄더프레스":"밴드 익스터널 로테이션","덤벨 숄더프레스":"밴드 익스터널 로테이션","푸쉬업":"덤벨 체스트 프레스"}},
  {"id":"rule_wrist","condition":"pain includes wrist","action":"버피·암워킹·푸쉬업을 플랭크 또는 코어 니리프트로 변경","substitute":{"버피":"맨몸 스쿼트","암워킹":"코어 니리프트","푸쉬업":"플랭크"}},
  {"id":"rule_back","condition":"pain includes back","action":"허리 부담 운동을 줄이고 플랭크·코어 니리프트 등 안정화 운동으로 조정","substitute":{"슈퍼맨":"코어 니리프트","케틀벨 스윙":"힙쓰러스트","코어 니리프트":"플랭크"}},
  {"id":"rule_low_completion","condition":"weeklyCompletion < 70","action":"다음 주 세트 또는 반복수 10~20% 감소"},
  {"id":"rule_easy","condition":"운동 강도 낮음 2회 연속","action":"다음 같은 운동 반복수 10% 또는 시간 5초 증가"},
  {"id":"rule_hard","condition":"운동 강도 높음","action":"다음 운동은 세트 1개 감소 또는 유산소 5분 감소"}
];

const EXERCISE_GUIDE = {
  "맨몸 스쿼트": {summary:"의자 없이 앉았다 일어나는 하체 기본 동작입니다.", purpose:"허벅지·둔근·코어를 함께 쓰는 기본 움직임을 익힙니다.", steps:["발을 어깨너비 정도로 두고 선다.","가슴을 들고 고관절을 접으며 앉는다.","발바닥 전체로 바닥을 밀며 일어난다.","무릎이 안쪽으로 모이지 않게 유지한다."]},
  "맨몸 런지": {summary:"한 발을 앞에 두고 몸을 위아래로 내렸다 올리는 하체 균형 운동입니다.", purpose:"한쪽 다리 힘과 골반 안정성을 같이 익힙니다.", steps:["한 발을 앞으로 내딛고 보폭을 잡는다.","상체를 세운 채 아래로 내려간다.","앞발 뒤꿈치로 바닥을 누르며 올라온다.","무릎과 발끝 방향을 맞춘다."]},
  "스텝박스 오르내리기": {summary:"낮은 박스나 계단에 올라갔다 내려오는 하체·유산소 운동입니다.", purpose:"하체 근력과 심폐를 동시에 올리고 런지 대체로도 씁니다.", steps:["발 전체를 박스 위에 올린다.","올라가는 다리의 발바닥으로 박스를 민다.","내려올 때 무릎이 무너지지 않게 천천히 내려온다."]},
  "버피": {summary:"서기에서 바닥 자세로 내려갔다 다시 일어나는 전신 심폐 운동입니다.", purpose:"짧은 시간에 전신 체력과 심폐 반응을 올립니다.", steps:["쪼그려 앉아 손을 바닥에 짚는다.","다리를 뒤로 보내 플랭크 자세를 만든다.","다리를 다시 몸쪽으로 가져온다.","일어나며 동작을 마무리한다."]},
  "버피 플랭크": {summary:"버피 동작 중 플랭크 자세를 유지하는 전신·코어 운동입니다.", purpose:"심폐와 코어 안정성을 함께 훈련합니다.", steps:["버피처럼 바닥 자세로 내려간다.","플랭크에서 배에 힘을 주고 잠시 버틴다.","허리가 처지지 않게 유지한다.","다시 일어나 다음 반복을 준비한다."]},
  "플랭크": {summary:"팔꿈치 또는 손으로 바닥을 짚고 몸통을 일자로 버티는 코어 운동입니다.", purpose:"복압, 견갑 안정, 허리 보호 능력을 기릅니다.", steps:["팔꿈치 또는 손을 어깨 아래에 둔다.","머리부터 발뒤꿈치까지 일직선을 만든다.","배를 단단히 조이고 호흡을 유지한다.","허리 처짐이나 엉덩이 과상승을 피한다."]},
  "암워킹": {summary:"서서 손을 바닥에 짚고 앞으로 걸어가 플랭크 자세를 만드는 운동입니다.", purpose:"코어, 어깨 안정성, 햄스트링 유연성을 함께 씁니다.", steps:["서서 상체를 숙여 손을 바닥에 짚는다.","손으로 한 걸음씩 앞으로 이동한다.","플랭크 자세에서 코어를 잡는다.","다시 손으로 되돌아온다."]},
  "코어 니리프트": {summary:"팔꿈치 지지 자세에서 무릎을 살짝 띄워 버티는 코어 운동입니다.", purpose:"복압과 몸통 고정 능력을 낮은 범위에서 익힙니다.", steps:["팔꿈치와 무릎을 바닥에 두고 준비한다.","팔꿈치로 바닥을 누르며 등을 안정시킨다.","무릎을 바닥에서 아주 조금 띄운다.","허리 말림과 과신전을 모두 피한다."]},
  "슈퍼맨": {summary:"엎드려 상체와 다리를 들어 후면사슬을 쓰는 운동입니다.", purpose:"등, 둔근, 햄스트링의 후면 연결을 깨웁니다.", steps:["엎드려 팔과 다리를 길게 둔다.","목에 힘을 빼고 시선은 아래쪽에 둔다.","등과 엉덩이 힘으로 상·하체를 살짝 든다.","반동 없이 천천히 내린다."]},
  "스미스머신 숄더프레스": {summary:"고정된 바를 어깨 위로 밀어 올리는 어깨 운동입니다.", purpose:"어깨 미는 힘과 견갑 안정성을 기릅니다.", steps:["바가 어깨선 근처에 오도록 세팅한다.","가슴을 들고 복부에 힘을 준다.","팔꿈치가 안쪽으로 말리지 않게 위로 민다.","허리가 꺾이지 않게 조절한다."]},
  "덤벨 숄더프레스": {summary:"덤벨을 어깨 높이에서 머리 위로 밀어 올리는 운동입니다.", purpose:"어깨 근력과 좌우 균형을 함께 훈련합니다.", steps:["덤벨을 어깨 옆에 둔다.","복부와 등을 고정한다.","덤벨을 위로 밀고 천천히 내린다.","승모로 으쓱하지 않게 한다."]},
  "사이드 레터럴 레이즈": {summary:"덤벨을 몸 옆으로 들어 어깨 측면을 쓰는 운동입니다.", purpose:"어깨 측면 자극과 팔 경로를 익힙니다.", steps:["덤벨을 몸 옆에 들고 선다.","팔꿈치를 살짝 굽힌다.","어깨 높이 근처까지 옆으로 들어올린다.","반동 없이 천천히 내린다."]},
  "프론트 레이즈": {summary:"덤벨을 앞으로 들어 어깨 전면을 쓰는 운동입니다.", purpose:"어깨 전면의 조절 능력을 익힙니다.", steps:["덤벨을 허벅지 앞에 둔다.","복부에 힘을 주고 몸통을 고정한다.","어깨 높이까지 앞으로 들어올린다.","허리를 젖히거나 반동을 쓰지 않는다."]},
  "밴드 익스터널 로테이션": {summary:"밴드를 잡고 팔을 바깥쪽으로 돌려 어깨 회전근개를 쓰는 운동입니다.", purpose:"어깨 안정화와 숄더프레스 전 준비운동으로 좋습니다.", steps:["팔꿈치를 몸 옆에 붙인다.","밴드를 잡고 팔꿈치 각도를 유지한다.","손을 바깥쪽으로 천천히 벌린다.","어깨가 으쓱하지 않게 한다."]},
  "롱풀": {summary:"앉아서 손잡이를 몸쪽으로 당기는 등 운동입니다.", purpose:"광배와 등 중앙을 쓰는 감각을 익힙니다.", steps:["가슴을 들고 앉는다.","어깨를 먼저 내리고 손잡이를 몸쪽으로 당긴다.","팔보다 등을 먼저 쓴다고 생각한다.","돌아갈 때도 천천히 버틴다."]},
  "프론트 로우": {summary:"앞쪽 손잡이를 몸쪽으로 당겨 등을 쓰는 운동입니다.", purpose:"견갑 안정과 광배 사용을 익힙니다.", steps:["가슴을 들고 몸통을 고정한다.","팔꿈치를 뒤로 보낸다는 느낌으로 당긴다.","어깨가 귀 쪽으로 올라가지 않게 한다.","천천히 원위치한다."]},
  "랫풀다운": {summary:"위쪽 바를 아래로 당겨 광배를 쓰는 등 운동입니다.", purpose:"상체 당기기와 등 사용 감각을 익힙니다.", steps:["바를 잡고 가슴을 든다.","어깨를 내린 뒤 팔꿈치를 아래로 끌어내린다.","바를 쇄골 앞쪽으로 당긴다.","몸을 과하게 뒤로 젖히지 않는다."]},
  "레그 익스텐션": {summary:"앉아서 무릎을 펴 앞허벅지를 쓰는 머신 운동입니다.", purpose:"대퇴사두근 자극과 무릎 펴는 힘을 익힙니다.", steps:["기구 축과 무릎 위치를 맞춘다.","엉덩이를 시트에 붙인다.","발끝을 몸쪽으로 당기고 다리를 편다.","내릴 때 천천히 버틴다."]},
  "힙쓰러스트": {summary:"엉덩이를 위로 들어 둔근을 강하게 쓰는 운동입니다.", purpose:"둔근 사용 감각과 고관절 펴는 힘을 만듭니다.", steps:["등 상부를 벤치나 패드에 둔다.","발은 무릎 아래쪽에 둔다.","엉덩이를 위로 들어 올린다.","허리를 꺾지 말고 둔근으로 마무리한다."]},
  "레그프레스": {summary:"기구에 앉아 발판을 밀어 하체를 쓰는 운동입니다.", purpose:"스쿼트보다 안정적으로 하체 힘을 기릅니다.", steps:["발판에 발 전체를 올린다.","무릎과 발끝 방향을 맞춘다.","발판을 밀고 천천히 내려온다.","무릎을 완전히 잠그지 않는다."]},
  "스쿼트 프레스": {summary:"발판을 밀어내는 하체 프레스 계열 운동입니다.", purpose:"하체 전반의 밀기 힘을 기릅니다.", steps:["발 위치와 무릎 방향을 맞춘다.","허리가 들뜨지 않게 몸을 고정한다.","발바닥 전체로 밀어낸다.","내려올 때 컨트롤한다."]},
  "레그컬": {summary:"무릎을 접어 뒤허벅지를 쓰는 머신 운동입니다.", purpose:"햄스트링 힘과 무릎 뒤쪽 안정성을 기릅니다.", steps:["패드 위치를 발목 근처에 맞춘다.","골반과 허벅지를 고정한다.","무릎을 접어 패드를 당긴다.","돌아갈 때 천천히 버틴다."]},
  "이너타이": {summary:"다리를 안쪽으로 모아 허벅지 안쪽을 쓰는 머신 운동입니다.", purpose:"내전근과 골반 안정성을 보강합니다.", steps:["등과 골반을 시트에 붙인다.","무릎 위치를 안정시킨다.","다리를 안쪽으로 모은다.","반동 없이 천천히 벌린다."]},
  "덤벨 로우": {summary:"덤벨을 몸쪽으로 당겨 등을 쓰는 운동입니다.", purpose:"집에서도 가능한 등 운동 대체입니다.", steps:["상체를 숙이고 허리를 중립으로 둔다.","덤벨을 팔꿈치로 뒤쪽에 보낸다.","어깨가 올라가지 않게 한다.","천천히 내린다."]},
  "푸쉬업": {summary:"손으로 바닥을 밀어 가슴·팔·코어를 쓰는 운동입니다.", purpose:"상체 밀기와 몸통 고정을 같이 익힙니다.", steps:["손을 어깨보다 약간 넓게 둔다.","몸을 일자로 만들고 배에 힘을 준다.","가슴을 바닥 쪽으로 내린다.","바닥을 밀며 올라온다."]},
  "덤벨 체스트 프레스": {summary:"누워서 덤벨을 위로 밀어 가슴을 쓰는 운동입니다.", purpose:"푸쉬업보다 안정적으로 가슴 미는 힘을 기릅니다.", steps:["벤치나 바닥에 누워 덤벨을 든다.","팔꿈치를 너무 벌리지 않는다.","덤벨을 위로 밀어 올린다.","내릴 때 천천히 조절한다."]},
  "케틀벨 스윙": {summary:"고관절을 접었다 펴며 케틀벨을 흔드는 후면사슬 운동입니다.", purpose:"둔근, 햄스트링, 심폐 반응을 함께 올립니다.", steps:["발을 안정적으로 두고 고관절을 접는다.","허리가 아니라 엉덩이를 뒤로 보낸다.","둔근으로 고관절을 펴며 케틀벨을 보낸다.","허리가 아프면 중단한다."]},
  "월싯": {summary:"벽에 기대 앉은 자세로 버티는 하체 지구력 운동입니다.", purpose:"허벅지 지구력과 자세 버티기를 훈련합니다.", steps:["등을 벽에 붙인다.","무릎 각도를 가능한 범위에서 낮춘다.","발바닥 전체로 버틴다.","무릎이 안쪽으로 모이지 않게 한다."]},
  "로잉머신": {summary:"다리로 밀고 손잡이를 당기는 전신 유산소 운동입니다.", purpose:"심폐와 등·하체 협응을 같이 사용합니다.", steps:["발을 고정하고 손잡이를 잡는다.","다리로 먼저 밀고 몸통을 세운다.","마지막에 손잡이를 몸쪽으로 당긴다.","돌아갈 때는 팔-몸통-다리 순서로 복귀한다."]},
  "데드버그": {summary:"누워서 팔과 다리를 교차로 내리는 코어 안정 운동입니다.", purpose:"플랭크가 어렵거나 허리가 불안할 때 코어를 익히기 좋습니다.", steps:["누워서 무릎을 90도로 든다.","허리가 바닥에서 뜨지 않게 배에 힘을 준다.","반대 팔과 다리를 천천히 내린다.","다시 돌아와 반대쪽도 반복한다."]},
  "버드독": {summary:"네발기기 자세에서 반대 팔과 다리를 드는 코어·후면사슬 운동입니다.", purpose:"허리 안정성과 좌우 균형을 기릅니다.", steps:["손과 무릎을 바닥에 둔다.","배에 힘을 주고 몸통을 흔들리지 않게 한다.","반대 팔과 다리를 천천히 뻗는다.","골반이 돌아가지 않게 조절한다."]},
  "전신 스트레칭": {summary:"운동 후 전신 긴장을 낮추는 쿨다운입니다.", purpose:"회복을 돕고 다음 운동의 부담을 줄입니다.", steps:["호흡을 천천히 낮춘다.","하체, 둔근, 등, 어깨 순서로 풀어준다.","통증이 아닌 당김 정도에서 멈춘다.","반동 없이 유지한다."]},
  "관절 워밍업": {summary:"운동 전 관절을 부드럽게 움직이는 준비운동입니다.", purpose:"몸을 데우고 부상 위험을 줄입니다.", steps:["목, 어깨, 고관절, 무릎, 발목을 가볍게 움직인다.","통증 없는 범위에서 반복한다.","호흡을 유지하며 점점 범위를 넓힌다.","본운동 전 몸이 따뜻해지는 정도로 진행한다."]}
};

function getLastBackupDate() {
  return localStorage.getItem('fitmate_last_backup_date') || '';
}

function setLastBackupDate(dstr = todayISO()) {
  localStorage.setItem('fitmate_last_backup_date', dstr);
}

function needBackupReminder() {
  const logs = getLogs();
  if (logs.length < 3) return false;
  const last = getLastBackupDate();
  if (!last) return true;
  return daysBetween(last, todayISO()) >= 7;
}

function todayISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function selectedDate() {
  return todayISO();
}

function lockToday() {
  const d = todayISO();
  if ($('workoutDate')) $('workoutDate').value = d;
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const x = new Date(d + 'T00:00:00');
  const dayName = isNaN(x) ? '월' : days[x.getDay()];
  if ($('workoutDateDisplay')) $('workoutDateDisplay').value = `${d} (${dayName}요일)`;
  if ($('daySelect')) $('daySelect').value = dayName;
  if ($('todayDateSubtitle')) $('todayDateSubtitle').textContent = `${d} (${dayName}) 오늘의 맞춤 운동`;
}

function dateLabel(d) {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const x = new Date(d + 'T00:00:00');
  return `${d} (${days[x.getDay()]})`;
}

function syncDayFromDate() {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const d = selectedDate();
  const x = new Date(d + 'T00:00:00');
  if (!isNaN(x) && $('daySelect')) $('daySelect').value = days[x.getDay()];
}

function monthISO(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function daysBetween(a, b) {
  const A = new Date(a + 'T00:00:00'), B = new Date(b + 'T00:00:00');
  return Math.floor((B - A) / 86400000);
}

function weekRangeOf(dstr = todayISO()) {
  const d = new Date(dstr + 'T00:00:00');
  const day = d.getDay();
  const start = new Date(d);
  start.setDate(d.getDate() - day);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const iso = x => monthISO(x.getFullYear(), x.getMonth(), x.getDate());
  return { start: iso(start), end: iso(end) };
}

function monthRange() {
  const cursor = calendarMonthCursor || new Date();
  const y = cursor.getFullYear(), m = cursor.getMonth();
  return {
    start: monthISO(y, m, 1),
    end: monthISO(y, m, new Date(y, m + 1, 0).getDate()),
    y,
    m
  };
}

function typeLabel(t) {
  return ({
    reps: '횟수 운동',
    time: '시간 운동',
    mixed: '복합 운동',
    cardio: '유산소',
    stretch: '스트레칭',
    warmup: '워밍업',
    rest: '휴식'
  }[t] || t || '-');
}

function escAttr(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtTime(s) {
  s = Math.max(0, Math.floor(s));
  return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : String(s);
}

function num(id) {
  const el = $(id);
  if (!el) return null;
  const v = el.value;
  return v === '' ? null : +v;
}

function downloadTextFile(filename, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function planKey() {
  return `${$('userSelect')?.value || 'friend'}_w${$('weekSelect')?.value || '1'}_${$('daySelect')?.value || '월'}`;
}

function getCustomPlans() {
  return readCachedJSON('fitmate_custom_program_v14', {});
}

function getPlanForCurrent() {
  const obj = getDayObj();
  const user = $('userSelect')?.value || 'friend';
  const custom = getCustomPlans()[planKey()];
  return custom ? clone(custom) : clone(obj?.[user] || []);
}

function savePlanForCurrent(plan) {
  const all = getCustomPlans();
  all[planKey()] = clone(plan);
  writeCachedJSON('fitmate_custom_program_v14', all);
}

function resetPlanForCurrent() {
  const all = getCustomPlans();
  delete all[planKey()];
  writeCachedJSON('fitmate_custom_program_v14', all);
}

function getDayObj() {
  const week = +($('weekSelect')?.value || 1);
  const day = $('daySelect')?.value || '월';
  const w = PROGRAM.weeks.find(x => x.week === week) || PROGRAM.weeks[0];
  return w.days.find(d => d.day === day) || w.days[0];
}

function getCurrentWeights() {
  return readCachedJSON('fitmate_current_weight_v38', {});
}

function getCurrentWeightMeta() {
  return readCachedJSON('fitmate_current_weight_meta_v314', {});
}

function getCurrentWeight(user) {
  const all = getCurrentWeights();
  const v = all[user || ($('userSelect')?.value || 'friend')];
  return v ? Number(v) : null;
}

function setCurrentWeight(user, weight, source = 'manual', date = todayISO()) {
  if (!weight || Number(weight) <= 0) return;
  const all = getCurrentWeights();
  all[user] = Number(weight);
  writeCachedJSON('fitmate_current_weight_v38', all);
  const meta = getCurrentWeightMeta();
  meta[user] = { source, date, updatedAt: new Date().toISOString() };
  writeCachedJSON('fitmate_current_weight_meta_v314', meta);
}

function currentWeightSourceLabel(user) {
  const meta = getCurrentWeightMeta()[user] || {};
  const map = { wizard: '초기 설정', inbody: '인바디', manual: '직접 입력' };
  return meta.source ? `${map[meta.source] || meta.source}${meta.date ? ' · ' + meta.date : ''}` : '시작 설정 기준';
}

function defaultGoal(user) {
  return user === 'me' ? { metric: 'weight', target: 86 } : { metric: 'weight', target: 77 };
}

function getGoalSettings() {
  const user = $('userSelect')?.value || 'friend';
  const all = readCachedJSON('fitmate_goal_settings_v21', {});
  return all[user] || defaultGoal(user);
}

function setGoalSettings(goal) {
  const user = $('userSelect')?.value || 'friend';
  const all = readCachedJSON('fitmate_goal_settings_v21', {});
  all[user] = goal;
  writeCachedJSON('fitmate_goal_settings_v21', all);
}

function metricInfo(metric) {
  const map = {
    weight: { label: '체중', unit: 'kg' },
    body_fat_mass: { label: '체지방량', unit: 'kg' },
    percent_body_fat: { label: '체지방률', unit: '%p' },
    skeletal_muscle_mass: { label: '골격근량', unit: 'kg' },
    inbody_score: { label: '인바디점수', unit: '점' }
  };
  return map[metric] || map.weight;
}

function getLogs() {
  return readCachedJSON('fitmate_logs_v14', []);
}

function clearWorkoutLogs(targetUser = null) {
  const user = targetUser || $('userSelect')?.value || null;
  if (user) {
    const logs = getLogs().filter(l => l.user !== user);
    writeCachedJSON('fitmate_logs_v14', logs);
    const exLogs = getExerciseLogs().filter(l => l.user !== user);
    setExerciseLogs(exLogs);
  } else {
    removeCachedKey('fitmate_logs_v14');
    clearExerciseLogs();
  }
  renderRecords();
}

function getExerciseLogs() {
  return readCachedJSON('fitmate_exercise_logs_v23', []);
}

function setExerciseLogs(a) {
  writeCachedJSON('fitmate_exercise_logs_v23', a);
}

function clearExerciseLogs() {
  removeCachedKey('fitmate_exercise_logs_v23');
}

function exerciseTargetValue(e) {
  if (['time', 'stretch', 'warmup', 'cooldown'].includes(e.type)) return e.duration || 0;
  if (e.type === 'cardio') return Math.round((e.duration || 0) / 60);
  return e.reps || 0;
}

function exerciseTargetUnit(e) {
  if (['time', 'stretch', 'warmup', 'cooldown'].includes(e.type)) return '초';
  if (e.type === 'cardio') return '분';
  return '회';
}

function getInbodySettings() {
  return readCachedJSON('fitmate_inbody_settings_v18', { dueDay: 0, interval: 7 });
}

function saveInbodySettings() {
  const st = {
    dueDay: +($('inbodyDueDay')?.value ?? 0),
    interval: +($('inbodyInterval')?.value ?? 7)
  };
  writeCachedJSON('fitmate_inbody_settings_v18', st);
  renderInbodyReminder();
}

function currentUserInbodyRecords() {
  const user = $('userSelect')?.value || 'friend';
  return getIB().filter(r => !r.user || r.user === user).sort((a, b) => a.date.localeCompare(b.date));
}

function getIB() {
  return readCachedJSON('fitmate_inbody_v14', []);
}

function setIB(a) {
  writeCachedJSON('fitmate_inbody_v14', a);
  renderInbody();
}

function inbodyStatus() {
  const st = getInbodySettings();
  const today = todayISO();
  const day = new Date(today + 'T00:00:00').getDay();
  const arr = currentUserInbodyRecords();
  const last = arr.length ? arr[arr.length - 1] : null;
  const days = last ? daysBetween(last.date, today) : 999;
  const dueToday = day === st.dueDay;
  const doneThisWeek = last && days < st.interval;
  const overdue = days >= st.interval;
  const mustCheck = (dueToday && !doneThisWeek) || (last && overdue) || (!last && dueToday);
  return { today, day, last, days, dueToday, doneThisWeek, overdue, mustCheck, settings: st };
}

function latestInbodyWithWeight(user = $('userSelect')?.value || 'friend') {
  const arr = getIB().filter(r => (r.user || user) === user && r.weight != null && Number(r.weight) > 0).sort((a, b) => a.date.localeCompare(b.date));
  return arr.length ? arr[arr.length - 1] : null;
}

function getVideoMap() {
  return readCachedJSON('fitmate_exercise_video_links_v34', readCachedJSON('fitmate_exercise_video_links_v33', {}));
}

function setVideoMap(o) {
  writeCachedJSON('fitmate_exercise_video_links_v34', o || {});
  writeCachedJSON('fitmate_exercise_video_links_v33', o || {});
}

function getExerciseVideoUrl(ex) {
  const map = getVideoMap();
  return map[ex.id] || ex.videoUrl || '';
}

function getGuide(ex) {
  return EXERCISE_GUIDE[ex.name] || {
    summary: `${ex.part || '해당 부위'} 중심의 ${typeLabel(ex.type)} 운동입니다.`,
    purpose: `${ex.part || '목표 부위'}의 기본 움직임과 기초체력을 기릅니다.`,
    steps: ["낮은 강도로 시작합니다.", "핵심 자세 큐를 먼저 확인합니다.", "통증이 있으면 범위나 강도를 줄입니다."]
  };
}

function ptSessionKey() {
  return 'fitmate_pt_session_v313_' + todayISO() + '_' + ($('userSelect')?.value || 'friend') + '_' + ($('weekSelect')?.value || '1') + '_' + ($('daySelect')?.value || '월');
}

function savePTSession(extra = {}) {
  try {
    if (!ptSteps.length) return;
    const data = {
      date: todayISO(),
      user: $('userSelect')?.value || 'friend',
      week: +($('weekSelect')?.value || 1),
      day: $('daySelect')?.value || '',
      ptIndex,
      remaining,
      totalDuration,
      active: true,
      ...extra
    };
    localStorage.setItem(ptSessionKey(), JSON.stringify(data));
    ptSessionActive = true;
  } catch(e) {}
}

function loadPTSession() {
  try {
    return JSON.parse(localStorage.getItem(ptSessionKey()) || 'null');
  } catch(e) {
    return null;
  }
}

function clearPTSession() {
  try {
    localStorage.removeItem(ptSessionKey());
    ptSessionActive = false;
  } catch(e) {}
}

function hasActivePTSession() {
  const s = loadPTSession();
  return !!(s && s.active && s.ptIndex >= 0 && s.ptIndex < Math.max(1, makeSteps().length));
}

function todayCompletedPTLogs() {
  const user = $('userSelect')?.value || 'friend';
  return getLogs().filter(l => l.date === todayISO() && l.user === user && l.memo === 'PT 모드 완료');
}

function exportBackup() {
  const data = { version: '3.16-compact', exportedAt: new Date().toISOString(), localStorage: {} };
  [
    'fitmate_logs_v14',
    'fitmate_exercise_logs_v23',
    'fitmate_inbody_v14',
    'fitmate_current_weight_v38',
    'fitmate_goal_settings_v21',
    'fitmate_inbody_settings_v18',
    'fitmate_inbody_check_day_v18',
    'fitmate_custom_program_v14',
    'fitmate_custom_plans_v14',
    'fitmate_exercise_video_links_v34',
    'fitmate_exercise_video_links_v33',
    'fitmate_setup_v32',
    'fitmate_setup_done_v32',
    'fitmate_current_weight_meta_v314',
    'fitmate_pds_theme'
  ].forEach(k => { data.localStorage[k] = localStorage.getItem(k); });
  localStorage.setItem('fitmate_last_backup_at_v316', data.exportedAt);
  setLastBackupDate(todayISO());
  downloadTextFile('fitmate_compact_backup_' + todayISO() + '.json', JSON.stringify(data, null, 2));
  const st = $('backupStatus');
  if (st) st.textContent = '백업 파일을 안전하게 저장했습니다.';
  renderBackupReminder();
}

function captureFitmateSnapshot() {
  const snapshot = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('fitmate_') && k !== 'fitmate_restore_rollback_snapshot') {
      snapshot[k] = localStorage.getItem(k);
    }
  }
  return snapshot;
}

function rollbackLastRestore() {
  const raw = localStorage.getItem('fitmate_restore_rollback_snapshot');
  if (!raw) {
    alert('되돌릴 이전 백업 스냅샷이 없습니다.');
    return;
  }
  try {
    const prev = JSON.parse(raw);
    storeCache.clear();
    // 현재 fitmate_ 키 정리
    const currentKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('fitmate_') && k !== 'fitmate_restore_rollback_snapshot') {
        currentKeys.push(k);
      }
    }
    currentKeys.forEach(k => localStorage.removeItem(k));
    // 이전 스냅샷 복원
    Object.keys(prev).forEach(k => {
      localStorage.setItem(k, prev[k]);
    });
    localStorage.removeItem('fitmate_restore_rollback_snapshot');
    const st = $('backupStatus');
    if (st) st.textContent = '복원 이전 상태로 되돌렸습니다.';
    renderToday();
    renderRecords();
    renderInbody();
    renderLibrary();
    showToast('복원 이전 상태로 안전하게 되돌렸습니다.', 'info');
  } catch (e) {
    alert('스냅샷 롤백 중 오류가 발생했습니다.');
  }
}

function importBackup(ev) {
  const f = ev.target.files && ev.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || typeof data !== 'object' || !data.localStorage || typeof data.localStorage !== 'object') {
        alert('올바른 FitMate 백업 파일(JSON) 형식이 아닙니다.');
        return;
      }
      const store = data.localStorage;
      const fitmateKeys = Object.keys(store).filter(k => k.startsWith('fitmate_'));
      if (fitmateKeys.length === 0) {
        alert('백업 파일 내에 유효한 FitMate 데이터가 없습니다.');
        return;
      }

      // 복원 전 안전 스냅샷 생성
      const preSnapshot = captureFitmateSnapshot();
      localStorage.setItem('fitmate_restore_rollback_snapshot', JSON.stringify(preSnapshot));

      storeCache.clear();
      fitmateKeys.forEach(k => {
        if (store[k] === null || store[k] === undefined) {
          localStorage.removeItem(k);
        } else {
          localStorage.setItem(k, store[k]);
        }
      });

      const st = $('backupStatus');
      if (st) st.innerHTML = '백업을 성공적으로 복원했습니다. <button type="button" class="btn secondary" style="padding:2px 8px;font-size:11px;margin-left:8px;" onclick="rollbackLastRestore()">복원 취소(원복)</button>';
      renderToday();
      renderRecords();
      renderInbody();
      renderLibrary();
      showToast('백업이 정상 복원되었습니다. (원복 스냅샷 생성됨)', 'success');
    } catch(e) {
      alert('백업 파일을 읽는 중 오류가 발생했습니다: ' + (e.message || ''));
    }
  };
  reader.readAsText(f);
}

function exportRecordsCsv() {
  const logs = getExerciseLogs();
  const headers = ['date', 'user', 'week', 'day', 'exercise', 'type', 'sets', 'completedSets', 'reps', 'duration', 'rest', 'target', 'targetValue', 'targetUnit', 'rpe', 'memo'];
  const rows = [headers.join(',')].concat(logs.map(l => headers.map(h => `"${String(l[h] ?? '').replace(/"/g, '""')}"`).join(',')));
  downloadTextFile('fitmate_records_' + todayISO() + '.csv', rows.join('\n'), 'text/csv;charset=utf-8');
  const st = $('backupStatus');
  if (st) st.textContent = '운동별 기록 CSV를 저장했습니다.';
}

function exportProgramCsv() {
  const headers = ['week', 'theme', 'day', 'profile', 'together', 'title', 'order', 'exercise', 'type', 'sets', 'reps', 'duration_sec', 'rest_sec', 'target', 'note'];
  const rows = [headers.join(',')];
  PROGRAM.weeks.forEach(w => w.days.forEach(d => ['friend', 'me'].forEach(user => {
    (d[user] || []).forEach((e, i) => rows.push([
      w.week, w.theme, d.day, PROGRAM.users[user].label, d.together ? 'Y' : 'N', d.title, i + 1, e.name, e.type, e.sets || '', e.reps || '', e.duration || '', e.rest || '', formatTarget(e), e.note || ''
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')));
  })));
  downloadTextFile('fitmate_program_' + todayISO() + '.csv', rows.join('\n'), 'text/csv;charset=utf-8');
}

function exportVideoLinksCsv() {
  const headers = ['exercise_id', 'exercise_name', 'part', 'equipment', 'level', 'youtube_url'];
  const rows = [headers.join(',')].concat(EXERCISES.map(e => {
    const vals = [e.id, e.name, e.part || '', e.equipment || '', e.level || '', getExerciseVideoUrl(e) || ''];
    return vals.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');
  }));
  downloadTextFile('fitmate_video_links_' + todayISO() + '.csv', rows.join('\n'), 'text/csv;charset=utf-8');
  const st = $('backupStatus');
  if (st) st.textContent = '영상 링크 CSV를 저장했습니다.';
}
