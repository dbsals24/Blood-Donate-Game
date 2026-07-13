let currentLevel = 1;
let score = 300; 
const MAX_SCORE = 1000; 

let audio = new Audio();
let isPlaying = false;
let spawnIndex = 0;
let activeNotes = []; 

let hasNonPerfect = false;

// 배경 상의 실제 판정선 위치 좌표
const HIT_LINE_X = 1100; 

// 하트 캔버스 내부에서 '하트'가 그려져 있는 상대적 X좌표 위치
const HEART_OFFSET_IN_CANVAS = 500; 

// 판정 범위
const JUDGMENT_RANGE = {
    perfect: 35,
    great: 70,
    good:100
};

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

document.getElementById('btn-start').addEventListener('click', () => showScreen(elLevelScreen));

document.getElementById('btn-info-next').addEventListener('click', (e) => { e.stopPropagation(); showScreen(elStoryScreen); });
document.getElementById('btn-story-next').addEventListener('click', () => { showScreen(elGameScreen); startEverything(); });
document.getElementById('btn-retry').addEventListener('click', () => { resetGameData(); showScreen(elStartScreen); });


elLevelScreen.addEventListener('click', (e) => {
    
    const rect = elLevelScreen.getBoundingClientRect();
    const scaleX = 1500 / rect.width;
    const scaleY = 1125 / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    const blockWidth = 1500 / 4;  // 375px
    const blockHeight = 1125 / 3; // 375px

    
    const isRightColumn = clickX >= blockWidth * 3 && clickX <= 1500;
    const isBottomRow = clickY >= blockHeight * 2 && clickY <= 1125;

    
    if (!elInfoPopup.classList.contains('hidden')) {
        
        if (isRightColumn && isBottomRow) {
            
            elInfoPopup.classList.add('hidden');
            elBtnBackToStart.style.display = 'none';
        } else {
            
            const currentStory = SONG_DATA[currentLevel].storyText || "스토리 데이터가 없습니다.";
            document.getElementById('story-text').innerText = currentStory;
            elBtnBackToStart.style.display = 'none';
            showScreen(elStoryScreen);
        }
        return; 
    }

    if (isRightColumn && isBottomRow) {
        showScreen(elStartScreen);
        return;
    }

    const zoneHeight = 1125 / 4; 
    if (clickY >= 0 && clickY < zoneHeight) currentLevel = 1;
    else if (clickY >= zoneHeight && clickY < zoneHeight * 2) currentLevel = 2;
    else if (clickY >= zoneHeight * 2 && clickY < zoneHeight * 3) currentLevel = 3;
    else if (clickY >= zoneHeight * 3 && clickY <= 1125) currentLevel = 4;

    document.getElementById('info-text',).innerText = SONG_DATA[currentLevel].infoText;
    elInfoPopup.classList.remove('hidden');  
    elBtnBackToStart.style.display = 'block'; 
});



function startEverything() {
    resetGameData();

    hasNonPerfect = false;

    audio.src = SONG_DATA[currentLevel].audioSrc;
    audio.load();
    
    audio.oncanplaythrough = () => {
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

    let targetNote = activeNotes[0];
    
    let pixelDiff2 = targetNote.currentHeartX - HIT_LINE_X;
    let pixelDiff = Math.abs(pixelDiff2);

    if (pixelDiff2 < 0 && pixelDiff > JUDGMENT_RANGE.good) {
        console.log('하트가 아직 멀리 있어 입력을 무시합니다.');
        return; 
    }

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


function endGame(isSuccess) {
    isPlaying = false; 
    audio.pause();

    const elGameOverDisplay = document.getElementById('game-over-display');
    const elImgGameOver = document.getElementById('img-game-over'); 
    const elResultBg = document.getElementById('img-result-bg');
    const elResultMsg = document.getElementById('result-message');

    elGameOverDisplay.classList.remove('hidden');

    if (isSuccess && score > 0) {
        if (!hasNonPerfect) {
            elImgGameOver.src = 'images/all_perfect.png';
        } else {
            elImgGameOver.src = 'images/clear.png';  
        }

        elResultBg.src = 'images/bg_success.png';
        elResultMsg.innerText = SONG_DATA[currentLevel].successMsg;
    } else {
        elImgGameOver.src = 'images/fail.png';
        elResultBg.src = 'images/bg_fail.png';
        elResultMsg.innerText = SONG_DATA[currentLevel].failMsg;
    }

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

    container.style.transform = `scale(${scale})`;
}

window.addEventListener('resize', resizeGame);
window.addEventListener('DOMContentLoaded', resizeGame);
resizeGame();
