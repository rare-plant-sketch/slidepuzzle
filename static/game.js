// static/js/game.js
const canvas = document.getElementById('puzzle-canvas');
const ctx = canvas.getContext('2d');
const timerDiv = document.getElementById('timer');
const difficultySelectionDiv = document.getElementById('difficulty-selection');
const gameAreaDiv = document.getElementById('game-area');
const headerDiv = document.getElementById('game-header');
const gameControls = document.getElementById('game-controls');

const SHOW_COMPLETE_DURATION = 5; // 完成図の表示時間（秒）
const TIME_LIMIT = 60; // 制限時間（秒）

let TILE_SIZE;
let GRID_SIZE;
let puzzleImage = new Image();
let positions = [];
let isGameActive = false;
let timerInterval;
let remainingTime;
let overlayMessage = ''; // キャンバスに表示するメッセージ
let showMenuButton = false; // メニューに戻るボタンを表示するか
let menuButtonRect = {};

// 画像が読み込まれたら描画を開始
puzzleImage.onload = () => {
    // 1. 完成図を5秒間表示
    showCompleteImageAndStart();
};

// ゲーム開始処理
async function startGame(gridSize) {
    GRID_SIZE = gridSize;
    isGameActive = false; // まだゲームは開始しない

    // UIの切り替え
    difficultySelectionDiv.style.display = 'none';
    gameAreaDiv.style.display = 'block';
    headerDiv.style.display = 'none';

    // Canvasの描画サイズをCSSで決まった表示サイズに合わせる
    setCanvasSize();

    // バックエンドにゲーム開始をリクエスト
    const response = await fetch('/api/start_game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grid_size: GRID_SIZE }),
    });
    const data = await response.json();

    positions = data.positions;
    puzzleImage.src = data.image_path; // これでonloadがトリガーされる

    overlayMessage = '';
    showMenuButton = false;
    updateTimerDisplay(); // タイマー表示を初期化
}

// Canvasのサイズを設定し、関連する変数を更新する関数
function setCanvasSize() {
    const size = canvas.clientWidth; // CSSによって決まった表示サイズを取得
    canvas.width = size;  // 描画解像度を実際の表示サイズに合わせる
    canvas.height = size; // これをしないと描画がぼやける
    TILE_SIZE = size / GRID_SIZE;
    menuButtonRect = { x: size / 2 - 150, y: size / 2 + 60, width: 300, height: 50 };
}

// 完成図を表示し、ゲームを開始する関数
function showCompleteImageAndStart() {
    let countdown = SHOW_COMPLETE_DURATION;

    const showInterval = setInterval(() => {
        // 完成図を描画
        ctx.drawImage(puzzleImage, 0, 0, canvas.width, canvas.height);

        // 半透明のオーバーレイ
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // メッセージを描画
        ctx.fillStyle = 'white';
        ctx.font = 'bold 40px "M PLUS Rounded 1c", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('完成図を覚えてね', canvas.width / 2, canvas.height / 2 - 20);

        ctx.fillStyle = 'yellow';
        ctx.font = '30px "M PLUS Rounded 1c", sans-serif';
        ctx.fillText(`あと ${countdown} 秒`, canvas.width / 2, canvas.height / 2 + 30);

        countdown--;

        if (countdown < 0) {
            clearInterval(showInterval);
            // 2. シャッフルされた盤面を描画してゲーム開始
            gameControls.style.display = 'flex'; // タイマーとボタンを表示
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
    updateTimerDisplay();

    timerInterval = setInterval(() => {
        remainingTime--;
        updateTimerDisplay();

        if (remainingTime <= 0) {
            stopTimer();
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

// タイマーを停止する関数
function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
}

// タイマー表示を更新する関数
function updateTimerDisplay() {
    if (!timerDiv) return;
    const minutes = Math.floor(remainingTime / 60);
    const seconds = remainingTime % 60;
    timerDiv.textContent = `残り時間: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
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
    ctx.clearRect(0, 0, canvas.width, canvas.height);
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

    // ゲーム終了時のメッセージ表示
    if (overlayMessage) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'yellow';
        ctx.font = 'bold 50px "M PLUS Rounded 1c", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(overlayMessage, canvas.width / 2, canvas.height / 2);
    }

    // メニューに戻るボタンの描画
    if (showMenuButton) {
        ctx.fillStyle = '#3b82f6'; // ボタンの色 (Tailwind primary color)
        ctx.fillRect(menuButtonRect.x, menuButtonRect.y, menuButtonRect.width, menuButtonRect.height);
        
        ctx.fillStyle = 'white';
        ctx.font = 'bold 28px "M PLUS Rounded 1c", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle'; // 文字の垂直位置を中央に
        ctx.fillText('メニューに戻る', canvas.width / 2, menuButtonRect.y + menuButtonRect.height / 2);
        ctx.textBaseline = 'alphabetic'; // リセット
    }
}

// ピース移動をアニメーションさせる関数
function animateMove(fromIndex, toIndex) {
    isGameActive = false; // アニメーション中は操作を無効化

    const pieceId = positions[fromIndex];
    const emptyTileId = positions[toIndex];

    const startX = (fromIndex % GRID_SIZE) * TILE_SIZE;
    const startY = Math.floor(fromIndex / GRID_SIZE) * TILE_SIZE;
    const endX = (toIndex % GRID_SIZE) * TILE_SIZE;
    const endY = Math.floor(toIndex / GRID_SIZE) * TILE_SIZE;

    const duration = 150; // アニメーション時間 (ミリ秒)
    let startTime = null;

    function animationStep(timestamp) {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);

        // 現在のピースの位置を計算
        const currentX = startX + (endX - startX) * progress;
        const currentY = startY + (endY - startY) * progress;

        // 盤面を再描画
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // 動かすピースと空白以外のピースを描画
        for (let i = 0; i < positions.length; i++) {
            if (i !== fromIndex && i !== toIndex) {
                const pId = positions[i];
                const destX = (i % GRID_SIZE) * TILE_SIZE;
                const destY = Math.floor(i / GRID_SIZE) * TILE_SIZE;
                const sourceX = (pId % GRID_SIZE) * TILE_SIZE;
                const sourceY = Math.floor(pId / GRID_SIZE) * TILE_SIZE;
                ctx.drawImage(puzzleImage, sourceX, sourceY, TILE_SIZE, TILE_SIZE, destX, destY, TILE_SIZE, TILE_SIZE);
            }
        }

        // 動かすピースを計算した位置に描画
        const sourceX = (pieceId % GRID_SIZE) * TILE_SIZE;
        const sourceY = Math.floor(pieceId / GRID_SIZE) * TILE_SIZE;
        ctx.drawImage(puzzleImage, sourceX, sourceY, TILE_SIZE, TILE_SIZE, currentX, currentY, TILE_SIZE, TILE_SIZE);

        // アニメーションが完了していなければ次のフレームを要求
        if (progress < 1) {
            requestAnimationFrame(animationStep);
        } else {
            // アニメーション完了後
            // サーバーからのレスポンスを待ってから最終的な盤面を描画するため、
            // ここでは操作可能に戻すだけ。
            isGameActive = true;
        }
    }

    // アニメーションの最初のフレームを要求
    requestAnimationFrame(animationStep);
}

// ゲームクリア時の処理
function handleGameWin() {
    isGameActive = false;
    stopTimer();
    overlayMessage = 'すごい！完成！';
    showMenuButton = true;
    drawBoard(); // 最終的な盤面とメッセージを描画
}

// メニューに戻る関数
function returnToMenu() {
    location.reload();
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
            returnToMenu();
            return;
        }
    }

    // 2. ゲーム中でなければ、以降のピース移動処理はしない
    if (!isGameActive) return;

    // 3. ゲーム中のピース移動処理
    const col = Math.floor(x / TILE_SIZE);
    const row = Math.floor(y / TILE_SIZE);
    const index = row * GRID_SIZE + col;
    
    // --- 移動ロジック ---
    const emptyTileId = GRID_SIZE * GRID_SIZE - 1;
    const emptyIndex = positions.indexOf(emptyTileId);

    // クリックしたピースが空白ピースに隣接しているかクライアント側でチェック
    const clickedRow = Math.floor(index / GRID_SIZE);
    const clickedCol = index % GRID_SIZE;
    const emptyRow = Math.floor(emptyIndex / GRID_SIZE);
    const emptyCol = emptyIndex % GRID_SIZE;

    const isMovable = (clickedRow === emptyRow && Math.abs(clickedCol - emptyCol) === 1) ||
                      (clickedCol === emptyCol && Math.abs(clickedRow - emptyRow) === 1);

    if (isMovable) {
        // アニメーションを開始
        animateMove(index, emptyIndex);

        // バックエンドに移動をリクエスト（アニメーションと並行して実行）
        const response = await fetch('/api/move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ index: index }),
        });
        const data = await response.json();

        positions = data.positions; // サーバーからの最新の状態で更新
        drawBoard(); // アニメーション完了後に最終的な盤面を描画

        if (data.is_solved) {
            handleGameWin(); // ゲームクリア処理を呼び出す
        }
    }
});
