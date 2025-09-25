// static/js/game.js
const canvas = document.getElementById('puzzle-canvas');
const ctx = canvas.getContext('2d');
const messageDiv = document.getElementById('message');
const timerDiv = document.getElementById('timer');
const difficultySelectionDiv = document.getElementById('difficulty-selection');
const gameAreaDiv = document.getElementById('game-area');
const headerDiv = document.getElementById('game-header');

const WINDOW_SIZE = 600;
const SHOW_COMPLETE_DURATION = 5; // 完成図の表示時間（秒）
const TIME_LIMIT = 30; // 制限時間（秒）

let TILE_SIZE;
let GRID_SIZE;
let puzzleImage = new Image();
let positions = [];
let isGameActive = false;
let timerInterval;
let remainingTime;
let overlayMessage = ''; // キャンバスに表示するメッセージ
let showMenuButton = false; // メニューに戻るボタンを表示するか

const menuButtonRect = {
    x: WINDOW_SIZE / 2 - 150,
    y: WINDOW_SIZE / 2 + 60,
    width: 300,
    height: 50
};

// 画像が読み込まれたら描画を開始
puzzleImage.onload = () => {
    // 1. 完成図を5秒間表示
    showCompleteImageAndStart();
};

// ゲーム開始処理
async function startGame(gridSize) {
    GRID_SIZE = gridSize;
    TILE_SIZE = WINDOW_SIZE / GRID_SIZE;
    isGameActive = false; // まだゲームは開始しない

    // バックエンドにゲーム開始をリクエスト
    const response = await fetch('/api/start_game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grid_size: GRID_SIZE }),
    });
    const data = await response.json();

    positions = data.positions;
    puzzleImage.src = data.image_path; // これでonloadがトリガーされる

    // UIの切り替え
    difficultySelectionDiv.style.display = 'none';
    gameAreaDiv.style.display = 'block';
    headerDiv.style.display = 'none';
    overlayMessage = '';
    showMenuButton = false;
    messageDiv.textContent = ''; // 古いメッセージをクリア
    timerDiv.textContent = '';
}

// 完成図を表示し、ゲームを開始する関数
function showCompleteImageAndStart() {
    let countdown = SHOW_COMPLETE_DURATION;

    const showInterval = setInterval(() => {
        // 完成図を描画
        ctx.drawImage(puzzleImage, 0, 0, WINDOW_SIZE, WINDOW_SIZE);

        // 半透明のオーバーレイ
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, WINDOW_SIZE, WINDOW_SIZE);

        // メッセージを描画
        ctx.fillStyle = 'white';
        ctx.font = 'bold 40px "M PLUS Rounded 1c", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('完成図を覚えてね', WINDOW_SIZE / 2, WINDOW_SIZE / 2 - 20);

        ctx.fillStyle = 'yellow';
        ctx.font = '30px "M PLUS Rounded 1c", sans-serif';
        ctx.fillText(`あと ${countdown} 秒`, WINDOW_SIZE / 2, WINDOW_SIZE / 2 + 30);

        countdown--;

        if (countdown < 0) {
            clearInterval(showInterval);
            // 2. シャッフルされた盤面を描画してゲーム開始
            drawBoard();
            isGameActive = true;
            // 3. 制限時間タイマーを開始
            startTimer();
        }
    }, 1000);
}

// 制限時間タイマーを開始する関数
function startTimer() {
    remainingTime = TIME_LIMIT;
    drawBoard(); // 初期時間を描画

    timerInterval = setInterval(() => {
        remainingTime--;
        drawBoard(); // 盤面と時間を再描画

        if (remainingTime <= 0) {
            clearInterval(timerInterval);
            isGameActive = false;
            overlayMessage = 'もう少し！';
            drawBoard(); // 「もう少し！」メッセージを一度描画

            // 3秒後に解答アニメーションを開始
            setTimeout(() => {
                animateSolution();
            }, 3000);
        }
    }, 1000);
}

// アニメーションのためのスリープ関数
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 解答をアニメーションで表示する関数
async function animateSolution() {
    const animationSpeed = 100; // 1ステップあたりのミリ秒

    // 0番のピースから順番に正しい位置に配置していく
    for (let i = 0; i < positions.length; i++) {
        // ピース'i'が正しい位置にない場合
        if (positions[i] !== i) {
            // 正しいピース'i'が現在どこにあるかを探す
            const correctPieceCurrentPos = positions.indexOf(i);

            // 現在の位置にあるピースと、正しいピースを入れ替える
            [positions[i], positions[correctPieceCurrentPos]] = [positions[correctPieceCurrentPos], positions[i]];
            
            drawBoard();
            await sleep(animationSpeed);
        }
    }

    overlayMessage = 'また挑戦してね！';
    showMenuButton = true;
    drawBoard(); // 最終メッセージを描画
}
// 盤面を描画する関数
function drawBoard() {
    ctx.clearRect(0, 0, WINDOW_SIZE, WINDOW_SIZE);
    const emptyTileId = GRID_SIZE * GRID_SIZE - 1;

    for (let i = 0; i < positions.length; i++) {
        const pieceId = positions[i];
        if (pieceId === emptyTileId) {
            continue; // 空白ピースは描画しない
        }

        // 描画先のキャンバス上の位置
        const destX = (i % GRID_SIZE) * TILE_SIZE;
        const destY = Math.floor(i / GRID_SIZE) * TILE_SIZE;

        // 元画像の切り出し元の位置
        const sourceX = (pieceId % GRID_SIZE) * TILE_SIZE;
        const sourceY = Math.floor(pieceId / GRID_SIZE) * TILE_SIZE;

        ctx.drawImage(
            puzzleImage,
            sourceX, sourceY, TILE_SIZE, TILE_SIZE, // 切り出し元
            destX, destY, TILE_SIZE, TILE_SIZE      // 描画先
        );
    }

    // --- オーバーレイとテキストの描画 ---

    // ゲーム中の残り時間表示
    if (isGameActive) {
        const minutes = Math.floor(remainingTime / 60);
        const seconds = remainingTime % 60;
        const timerText = `残り時間: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        ctx.fillStyle = 'yellow';
        ctx.font = '24px "M PLUS Rounded 1c", sans-serif';
        ctx.textAlign = 'left';
        // 背景を少し暗くして文字を読みやすくする
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(5, 5, ctx.measureText(timerText).width + 10, 30);
        // テキストを描画
        ctx.fillStyle = 'yellow';
        ctx.fillText(timerText, 10, 30);
    }

    // ゲーム終了時のメッセージ表示
    if (overlayMessage) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, WINDOW_SIZE, WINDOW_SIZE);
        ctx.fillStyle = 'yellow';
        ctx.font = 'bold 50px "M PLUS Rounded 1c", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(overlayMessage, WINDOW_SIZE / 2, WINDOW_SIZE / 2);
    }

    // メニューに戻るボタンの描画
    if (showMenuButton) {
        ctx.fillStyle = '#3b82f6'; // ボタンの色 (Tailwind primary color)
        ctx.fillRect(menuButtonRect.x, menuButtonRect.y, menuButtonRect.width, menuButtonRect.height);
        
        ctx.fillStyle = 'white';
        ctx.font = 'bold 28px "M PLUS Rounded 1c", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle'; // 文字の垂直位置を中央に
        ctx.fillText('メニューに戻る', WINDOW_SIZE / 2, menuButtonRect.y + menuButtonRect.height / 2);
        ctx.textBaseline = 'alphabetic'; // リセット
    }
}

// クリックイベントの処理
canvas.addEventListener('click', async (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // 1. ゲーム終了後のボタンクリックをチェック
    if (showMenuButton) {
        // 「メニューに戻る」ボタンのクリック判定
        if (x >= menuButtonRect.x && x <= menuButtonRect.x + menuButtonRect.width &&
            y >= menuButtonRect.y && y <= menuButtonRect.y + menuButtonRect.height) {
            location.reload();
            return;
        }
    }

    // 2. ゲーム中でなければ、以降のピース移動処理はしない
    if (!isGameActive) return;

    // 3. ゲーム中のピース移動処理
    const col = Math.floor(x / TILE_SIZE);
    const row = Math.floor(y / TILE_SIZE);
    const index = row * GRID_SIZE + col;

    // バックエンドに移動をリクエスト
    const response = await fetch('/api/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index: index }),
    });
    const data = await response.json();

    if (data.moved) {
        positions = data.positions;
        drawBoard(); // 盤面を再描画

        if (data.is_solved) {
            isGameActive = false;
            clearInterval(timerInterval); // タイマーを停止
            overlayMessage = 'すごい！完成！';
            showMenuButton = true;
            drawBoard(); // 最終的な盤面とメッセージを描画
        }
    }
});
