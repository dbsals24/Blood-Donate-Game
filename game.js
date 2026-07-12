
/**
 * [game.js] - 좌표 기반 판정 시스템 (수정 완료)
 */
let currentLevel = 1;
let score = 300; 
const MAX_SCORE = 1000; 

let audio = new Audio();
let isPlaying = false;
let spawnIndex = 0;
let activeNotes = []; 

let hasNonPerfect = false; // perfect가 아닌 다른 판정이 나왔는지 체크하는 깃발

// 배경 상의 실제 판정선 위치 좌표
const HIT_LINE_X = 1100; 

// 하트 캔버스 내부에서 '하트'가 그려져 있는 상대적 X좌표 위치
const HEART_OFFSET_IN_CANVAS = 500; 

// 판정 범위
const JUDGMENT_RANGE = {
    perfect: 20,
    great: 60,
    good:100
};

// DOM 캐싱
const elStartScreen = document.getElementById('screen-start');
const elLevelScreen = document.getElementById('screen-level');
const elBtnBackToStart = document.getElementById('btn-back-to-start'); 
const elInfoPopup = document.getElementById('info-popup');
const elStoryScreen = document.getElementById('screen-story');
const elGameScreen = document.getElementById('screen-game');
const elResultScreen = document.getElementById('screen-result');

const elLane = document.getElementById('lane');
const elTxtScore = document.getElementById('txt-score');
const elBloodFluid = document.getElementById('blood-fluid');
const elNoteContainer = document.getElementById('note-container');
const elJudgmentDisplay = document.getElementById('judgment-display');
const elImgJudgment = document.getElementById('img-judgment');

function showScreen(screenToShow) {
    const screens = [elStartScreen, elLevelScreen, elStoryScreen, elGameScreen, elResultScreen];
    screens.forEach(s => s.classList.add('hidden'));
    screenToShow.classList.remove('hidden');
    if (screenToShow !== elLevelScreen) {
        elInfoPopup.classList.add('hidden');
    }
}

/* --- 이벤트 리스너 기본 흐름 정의 --- */
document.getElementById('btn-start').addEventListener('click', () => showScreen(elLevelScreen));

// 🛠️ 기존에 복잡하게 얽혀있던 .level-buttons 이벤트 리스너와 elLevelScreen 중복 로직을 
// 하나의 완성된 흐름으로 일치시켜 elLevelScreen 전체에서 처리하도록 병합하고 정돈했습니다.
document.getElementById('btn-info-next').addEventListener('click', (e) => { e.stopPropagation(); showScreen(elStoryScreen); });
document.getElementById('btn-story-next').addEventListener('click', () => { showScreen(elGameScreen); startEverything(); });
document.getElementById('btn-retry').addEventListener('click', () => { resetGameData(); showScreen(elStartScreen); });

// ─── 🚀 [핵심] 레벨 선택 화면 통합 클릭 이벤트 리스너 ───
elLevelScreen.addEventListener('click', (e) => {
    // 1. 화면 크기 및 좌표 계산 (1500 * 1125 비율 매핑)
    const rect = elLevelScreen.getBoundingClientRect();
    const scaleX = 1500 / rect.width;
    const scaleY = 1125 / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    const blockWidth = 1500 / 4;  // 375px
    const blockHeight = 1125 / 3; // 375px

    // 우측 하단 구역 판정 (3x4 그리드 중 가장 우측 아래 칸)
    const isRightColumn = clickX >= blockWidth * 3 && clickX <= 1500;
    const isBottomRow = clickY >= blockHeight * 2 && clickY <= 1125;

    // ─── 조건 A: 이미 설명 팝업이 등장해 있는 상태 ───
    if (!elInfoPopup.classList.contains('hidden')) {
        
        if (isRightColumn && isBottomRow) {
            // 1. 오직 오른쪽 아래를 눌렀을 때만: 팝업과 돌아가기 버튼을 동시에 제거하고 다시 레벨 선택 유도
            elInfoPopup.classList.add('hidden');
            elBtnBackToStart.style.display = 'none';
        } else {
            // 2. 팝업 상태에서 오른쪽 아래가 아닌 '아무 곳이나' 누르면 다음 장면(스토리)으로 전환
            const currentStory = SONG_DATA[currentLevel].storyText || "스토리 데이터가 없습니다.";
            document.getElementById('story-text').innerText = currentStory;
            
            elBtnBackToStart.style.display = 'none'; // 다음 장면 가기 전 버튼 숨김
            showScreen(elStoryScreen);
        }
        return; // 처리 완료 후 즉시 종료하여 하단의 레벨 재선택 로직 실행 방지
    }

    // ─── 조건 B: 평상시 (팝업이 닫혀있어 레벨을 골라야 하는 상태) ───
    if (isRightColumn && isBottomRow) {
        // 레벨 고르기 전 초기 상태에서 오른쪽 아래를 누르면 최초 타이틀 화면으로 완전히 이동
        showScreen(elStartScreen);
        return;
    }

    // 순수한 레벨 선택 영역 지정 (세로 4등분 로직)
    const zoneHeight = 1125 / 4; 
    if (clickY >= 0 && clickY < zoneHeight) currentLevel = 1;
    else if (clickY >= zoneHeight && clickY < zoneHeight * 2) currentLevel = 2;
    else if (clickY >= zoneHeight * 2 && clickY < zoneHeight * 3) currentLevel = 3;
    else if (clickY >= zoneHeight * 3 && clickY <= 1125) currentLevel = 4;

    // 🛠️ 레벨 선택 시: 설명 팝업과 돌아가기 버튼이 한 번에 동시에 등장!
    document.getElementById('info-text',).innerText = SONG_DATA[currentLevel].infoText;
    elInfoPopup.classList.remove('hidden');       // 설명 팝업 등장
    elBtnBackToStart.style.display = 'block';     // 돌아가기 버튼 등장
});



function startEverything() {
    resetGameData();

    hasNonPerfect = false;

    audio.src = SONG_DATA[currentLevel].audioSrc;
    audio.load();
    
    audio.oncanplaythrough = () => {
        // 🛠️ [핵심 추가] 노래가 재생 가능한 상태가 되면, 이 예약(이벤트)을 즉시 삭제하여 중복 실행을 막습니다.
        audio.oncanplaythrough = null; 

        audio.play().then(() => {
            isPlaying = true; 
            requestAnimationFrame(updateGame); 
            runVisualCountdown(); 
        }).catch(error => {
            isPlaying = true;
            requestAnimationFrame(updateGame);
            runVisualCountdown();
        });
    };
}



function runVisualCountdown() {
    const elCount = document.getElementById('countdown');
    elCount.classList.remove('hidden');
    let count = 3; elCount.innerText = count;
    let interval = setInterval(() => {
        count--;
        if (count > 0) elCount.innerText = count;
        else { clearInterval(interval); elCount.classList.add('hidden'); }
    }, 1000);
}

function resetGameData() {
    score = 300; spawnIndex = 0; activeNotes = [];
    elNoteContainer.innerHTML = ''; updateScoreUI();
    audio.pause(); audio.currentTime = 0;
}

// 위치 기반 업데이트 함수
function updateGame() {
    if (!isPlaying) return;

    let currentSongTime = audio.currentTime;
    let currentNotes = SONG_DATA[currentLevel].notes;

    while (spawnIndex < currentNotes.length && currentSongTime >= currentNotes[spawnIndex]["시작 시간"]) {
        createNoteDOM(currentNotes[spawnIndex]);
        spawnIndex++;
    }

    let startLineX = 400; 
    let canvasStartLeft = startLineX - HEART_OFFSET_IN_CANVAS;
    let canvasHitLeft = HIT_LINE_X - HEART_OFFSET_IN_CANVAS;

    for (let i = activeNotes.length - 1; i >= 0; i--) {
        let noteObj = activeNotes[i];
        
        let totalDuration = noteObj.data["도착 시간"] - noteObj.data["시작 시간"];
        let elapsed = currentSongTime - noteObj.data["시작 시간"];
        let progress = elapsed / totalDuration; 

        let currentLeft = canvasStartLeft + (canvasHitLeft - canvasStartLeft) * progress;
        noteObj.element.style.left = currentLeft + 'px';
        noteObj.currentHeartX = currentLeft + HEART_OFFSET_IN_CANVAS;

        
        if (noteObj.currentHeartX > HIT_LINE_X + 45) {
            applyJudgment('miss');
            noteObj.element.remove();
            activeNotes.splice(i, 1);
        }
    }

    if (audio.ended) { endGame(true); return; }
    requestAnimationFrame(updateGame);
}

function createNoteDOM(noteData) {
    const noteEl = document.createElement('div');
    noteEl.classList.add('note');
    elNoteContainer.appendChild(noteEl);

    activeNotes.push({
        element: noteEl,
        data: noteData,
        currentHeartX: 0
    });
}

elGameScreen.addEventListener('pointerdown', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    if (!isPlaying || activeNotes.length === 0) return;

    // [1번 요구사항 반영] 살아있는 하트 중 무조건 '가장 먼저 생성된 하트'만 조준
    let targetNote = activeNotes[0];
    
    let pixelDiff2 = targetNote.currentHeartX - HIT_LINE_X; // 양수면 지나침, 음수면 도달 전
    let pixelDiff = Math.abs(pixelDiff2);

    // [2번 요구사항 반영] 판정선 도달 전이고 너무 멀다면 미스 주지 않고 무시(얼리 미스 방지)
    if (pixelDiff2 < 0 && pixelDiff > JUDGMENT_RANGE.good) {
        console.log('하트가 아직 멀리 있어 입력을 무시합니다.');
        return; 
    }

    // 🎯 정상 판정 범위 (Perfect / Great / Good)
    if (pixelDiff <= JUDGMENT_RANGE.perfect) {
        applyJudgment('perfect');
        removeTargetNote();
    } else if (pixelDiff <= JUDGMENT_RANGE.great) {
        applyJudgment('great');
        removeTargetNote();
    } else if (pixelDiff <= JUDGMENT_RANGE.good) {
        applyJudgment('good');
        removeTargetNote();
    } 
    // [2번 요구사항 반영] 오직 판정선을 이미 '지나쳤을 때만' miss 처리
    else if (pixelDiff2 > 0) {
        applyJudgment('miss');
        removeTargetNote();
    }
});

function removeTargetNote() {
    if (activeNotes.length > 0) {
        activeNotes[0].element.remove();
        activeNotes.shift();
    }
}

function applyJudgment(type) {
    if (type === 'perfect') score += 60;
    else if (type === 'great') score += 50;
    else if (type === 'good') score += 40;
    else if (type === 'miss') score -= 50;

    if (score < 0) score = 0;
    updateScoreUI();
    showJudgmentVisual(type);

    if (score === 0) endGame(false);

    if (type !== 'perfect') {
        hasNonPerfect = true;
    }
}

function updateScoreUI() {
    elTxtScore.innerText = score;
    let fillPercent = (score / MAX_SCORE) * 100;
    if (fillPercent > 100) fillPercent = 100;
    elBloodFluid.style.height = fillPercent + '%';
}

function showJudgmentVisual(type) {
    elImgJudgment.src = `images/judge_${type}.png`;
    elJudgmentDisplay.classList.remove('hidden');
    clearTimeout(elJudgmentDisplay.timer);
    elJudgmentDisplay.timer = setTimeout(() => { elJudgmentDisplay.classList.add('hidden'); }, 500);
}

// ─── 🚀 [수정] 게임 종료 연출 처리 함수 ───
function endGame(isSuccess) {
    isPlaying = false; 
    audio.pause();

    const elGameOverDisplay = document.getElementById('game-over-display');
    const elImgGameOver = document.getElementById('img-game-over'); 
    const elResultBg = document.getElementById('img-result-bg');
    const elResultMsg = document.getElementById('result-message');

    // 1. 연출 레이어 보이기
    elGameOverDisplay.classList.remove('hidden');

    // 2. 성공/실패 여부 및 판정 조건 체크
    if (isSuccess && score > 0) {
        // 🛠️ 수정: 성공했고, perfect 이외의 판정이 단 한 번도 없었다면?
        if (!hasNonPerfect) {
            elImgGameOver.src = 'images/all_perfect.png'; // 올퍼펙트 이미지
        } else {
            elImgGameOver.src = 'images/clear.png';        // 일반 클리어 이미지
        }

        // 최종 결과창 데이터 준비
        elResultBg.src = 'images/bg_success.png';
        elResultMsg.innerText = SONG_DATA[currentLevel].successMsg;
    } else {
        // 실패 시
        elImgGameOver.src = 'images/fail.png';
        elResultBg.src = 'images/bg_fail.png';
        elResultMsg.innerText = SONG_DATA[currentLevel].failMsg;
    }

    // 3. 2초 동안 연출 후 결과 화면으로 전환
    setTimeout(() => {
        elGameOverDisplay.classList.add('hidden'); 
        showScreen(elResultScreen);                
    }, 2000); 
}




function resizeGame() {
    const container = document.getElementById('game-container');
    if (!container) return;

    const targetWidth = 1500;
    const targetHeight = 1125;

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    const scaleX = windowWidth / targetWidth;
    const scaleY = windowHeight / targetHeight;
    const scale = Math.min(scaleX, scaleY);

    // CSS transform scale을 사용하여 컨테이너 전체를 화면 비율에 맞춰 깔끔하게 축소/확대시킵니다.
    container.style.transform = `scale(${scale})`;
}

window.addEventListener('resize', resizeGame);
window.addEventListener('DOMContentLoaded', resizeGame);
resizeGame(); // 혹시 모를 타이밍을 위해 강제 호출 한 줄 추가
