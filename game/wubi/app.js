document.addEventListener('DOMContentLoaded', () => {
    const characterDisplay = document.getElementById('character-display');
    const timerDisplay = document.getElementById('timer');
    const inputBox = document.getElementById('input-box');
    const keyboardContainer = document.getElementById('keyboard');

    const wubiDict = {
        '一': 'ggll',
        '地': 'fsa',
        '在': 'd',
        '是': 'jgh',
        '不': 'g',
        '了': 'bnh',
        '有': 'd',
        '和': 'tkg',
        '人': 'ww',
        '这': 'yp',
        '中': 'khk',
        '大': 'd',
        '为': 'y',
        '上': 'h',
        '个': 'wh',
        '国': 'lgyi',
        '我': 'tr',
        '以': 'n',
        '要': 'sv',
        '他': 'w',
        '时': 'j',
        '来': 'go',
        '用': 'e',
        '们': 'w',
        '生': 't',
        '道': 'uthp',
        '作': 'w',
        '诗': 'yfg',
        '所': 'r',
        '然': 'qou'
    };
    const wubiChars = Object.keys(wubiDict);

    const keyboardLayout = [
        ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
        ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';'],
        ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/']
    ];

    let currentCharacter = '';
    let currentWubiCode = '';
    let timer;
    let timeLeft = 3;

    function initKeyboard() {
        keyboardContainer.innerHTML = '';
        keyboardLayout.forEach(row => {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'keyboard-row';
            row.forEach(key => {
                const keyButton = document.createElement('button');
                keyButton.className = 'key';
                keyButton.id = `key-${key}`;
                keyButton.textContent = key.toUpperCase();
                rowDiv.appendChild(keyButton);
            });
            keyboardContainer.appendChild(rowDiv);
        });
    }

    function newChallenge() {
        clearTimeout(timer);
        inputBox.value = '';
        inputBox.focus();
        resetAllKeys();

        const randomIndex = Math.floor(Math.random() * wubiChars.length);
        currentCharacter = wubiChars[randomIndex];
        currentWubiCode = wubiDict[currentCharacter];
        characterDisplay.textContent = currentCharacter;

        timeLeft = 3;
        timerDisplay.textContent = timeLeft;
        timer = setInterval(updateTimer, 1000);
    }

    function updateTimer() {
        timeLeft--;
        timerDisplay.textContent = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(timer);
            revealAnswer();
        }
    }

    function revealAnswer() {
        if (currentWubiCode) {
            currentWubiCode.split('').forEach((key, index) => {
                setTimeout(() => {
                    highlightKey(key);
                }, index * 300);
            });
        }
        setTimeout(newChallenge, 2000);
    }
    
    function highlightKey(key) {
        const keyElement = document.getElementById(`key-${key}`);
        if (keyElement) {
            keyElement.classList.add('highlight');
        }
    }

    function resetAllKeys() {
        const keys = document.querySelectorAll('.key');
        keys.forEach(key => key.classList.remove('highlight'));
    }
   
    inputBox.addEventListener('input', () => {
        if (inputBox.value.toLowerCase() === currentWubiCode) {
            clearInterval(timer);
            // Optional: Add some feedback for correct input
            setTimeout(newChallenge, 500);
        } else if (inputBox.value.length >= 4) {
            inputBox.classList.add('error');
            setTimeout(() => {
                inputBox.classList.remove('error');
                inputBox.value = '';
            }, 500);
        }
    });

    initKeyboard();
    newChallenge();
});