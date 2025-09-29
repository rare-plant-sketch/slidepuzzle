# app.py
import os
import random
from flask import Flask, render_template, jsonify, request, session

app = Flask(__name__)
# sessionを使うためにSECRET_KEYの設定が必須
app.secret_key = os.urandom(24) 

IMAGE_DIR = os.path.join('static', 'images')
DEFAULT_GRID_SIZE = 3
SHUFFLE_MOVE_MULTIPLIER = 10

def get_shuffled_board(grid_size):
    """パズルをシャッフルして、ピースの配置リストを返す"""
    positions = list(range(grid_size * grid_size))
    empty_index = grid_size * grid_size - 1
    
    shuffle_moves = grid_size * grid_size * SHUFFLE_MOVE_MULTIPLIER
    for _ in range(shuffle_moves):
        possible_moves = []
        row, col = empty_index // grid_size, empty_index % grid_size
        if row > 0: possible_moves.append(empty_index - grid_size)
        if row < grid_size - 1: possible_moves.append(empty_index + grid_size)
        if col > 0: possible_moves.append(empty_index - 1)
        if col < grid_size - 1: possible_moves.append(empty_index + 1)
        
        if not possible_moves: continue
        move_index = random.choice(possible_moves)
        positions[empty_index], positions[move_index] = positions[move_index], positions[empty_index]
        empty_index = move_index
        
    return positions

@app.route('/')
def index():
    """ゲームのメインページをレンダリングする"""
    return render_template('index.html')

@app.route('/api/start_game', methods=['POST'])
def start_game():
    """新しいゲームを開始し、初期状態を返す"""
    data = request.get_json()
    grid_size = int(data.get('grid_size', DEFAULT_GRID_SIZE))

    # 常に新しい画像を選択し、前回と違う画像を選ぶ
    image_files = [f for f in os.listdir(IMAGE_DIR) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
    
    if not image_files:
        # 画像がない場合はデフォルト画像を使用
        image_path = os.path.join('static', 'swiss.jpg')
    else:
        previous_image_filename = None
        if 'image_path' in session:
            # セッションから前回の画像のファイル名を取得
            previous_image_filename = os.path.basename(session['image_path'])

        # 前回と異なる画像を選択するための候補リストを作成
        possible_images = [f for f in image_files if f != previous_image_filename]
        if not possible_images:
            # 候補がない場合（画像が1枚しかないなど）は、全画像を対象にする
            possible_images = image_files
            
        new_image_filename = random.choice(possible_images)
        image_path = os.path.join(IMAGE_DIR, new_image_filename)

    # 今回選択した画像をセッションに保存（次回比較用）
    session['image_path'] = image_path.replace('\\', '/') # Windowsのパス区切り文字対策

    # ゲーム状態をセッションに保存
    session['grid_size'] = grid_size
    session['positions'] = get_shuffled_board(grid_size)
    session['correct_positions'] = list(range(grid_size * grid_size))
    session['image_path'] = image_path.replace('\\', '/') # Windowsのパス区切り文字対策

    return jsonify({
        'grid_size': session['grid_size'],
        'positions': session['positions'],
        'image_path': image_path,
    })

@app.route('/api/move', methods=['POST'])
def move_tile():
    """ピースの移動処理"""
    if 'positions' not in session:
        return jsonify({'error': 'Game not started'}), 400

    data = request.get_json()
    index = data.get('index')

    positions = session['positions']
    grid_size = session['grid_size']
    empty_tile_id = grid_size * grid_size - 1
    empty_index = positions.index(empty_tile_id)

    # 既に解決済みの場合は移動させない
    if positions == session['correct_positions']:
        return jsonify({'positions': positions, 'is_solved': True, 'moved': False})

    # 隣接しているかチェック
    clicked_row, clicked_col = index // grid_size, index % grid_size
    empty_row, empty_col = empty_index // grid_size, empty_index % grid_size
    is_movable = (clicked_row == empty_row and abs(clicked_col - empty_col) == 1) or \
                 (clicked_col == empty_col and abs(clicked_row - empty_row) == 1)
    
    if is_movable:
        # クリックされた位置にあるピースのIDを取得
        clicked_tile_id = positions[index]
        # クリックされた位置と空きピースの位置の値を交換
        positions[empty_index] = clicked_tile_id
        positions[index] = empty_tile_id
        session['positions'] = positions
        
    is_solved = (positions == session['correct_positions'])

    return jsonify({
        'positions': positions,
        'is_solved': is_solved,
        'moved': is_movable
    })

if __name__ == '__main__':
    app.run(debug=True)
