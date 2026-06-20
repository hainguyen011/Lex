import socketio
import pyautogui
import socket
import os
import sys
import qrcode
import secrets
import ctypes
from urllib.parse import parse_qs
from aiohttp import web
import aiohttp_cors

def is_admin():
    try:
        return ctypes.windll.shell32.IsUserAnAdmin()
    except:
        return False

def get_local_git_sha():
    try:
        # Tìm thư mục .git ở thư mục cha hoặc thư mục hiện tại
        git_dir = None
        for p in ['.', '..', '../..']:
            path = os.path.abspath(os.path.join(os.path.dirname(__file__), p, '.git'))
            if os.path.exists(path):
                git_dir = path
                break
        if git_dir:
            head_path = os.path.join(git_dir, 'HEAD')
            if os.path.exists(head_path):
                with open(head_path, 'r', encoding='utf-8') as f:
                    head_content = f.read().strip()
                if head_content.startswith('ref:'):
                    ref_path = os.path.join(git_dir, head_content.split(' ')[1])
                    if os.path.exists(ref_path):
                        with open(ref_path, 'r', encoding='utf-8') as f:
                            return f.read().strip()
                else:
                    return head_content
    except Exception as e:
        print("Error getting local git SHA:", e)
    return None

# Tạo một key bảo mật ngẫu nhiên cho mỗi phiên chạy
SECRET_KEY = secrets.token_urlsafe(16)

def resource_path(relative_path):
    """ Get absolute path to resource, works for dev and for PyInstaller """
    try:
        # PyInstaller creates a temp folder and stores path in _MEIPASS
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")

    return os.path.join(base_path, relative_path)

www_dir = resource_path('www')

# Cấu hình PyAutoGUI
pyautogui.FAILSAFE = False
pyautogui.PAUSE = 0  # Tắt độ trễ mặc định của PyAutoGUI để di chuột mượt hơn

try:
    import vgamepad as vg
    has_gamepad = True
    
    # Map button names to vgamepad buttons
    VG_BUTTONS = {
        'A': vg.XUSB_BUTTON.XUSB_GAMEPAD_A,
        'B': vg.XUSB_BUTTON.XUSB_GAMEPAD_B,
        'X': vg.XUSB_BUTTON.XUSB_GAMEPAD_X,
        'Y': vg.XUSB_BUTTON.XUSB_GAMEPAD_Y,
        'L1': vg.XUSB_BUTTON.XUSB_GAMEPAD_LEFT_SHOULDER,
        'R1': vg.XUSB_BUTTON.XUSB_GAMEPAD_RIGHT_SHOULDER,
        'C': vg.XUSB_BUTTON.XUSB_GAMEPAD_LEFT_SHOULDER,  # Map C sang L1
        'Z': vg.XUSB_BUTTON.XUSB_GAMEPAD_RIGHT_SHOULDER, # Map Z sang R1
        'UP': vg.XUSB_BUTTON.XUSB_GAMEPAD_DPAD_UP,
        'DOWN': vg.XUSB_BUTTON.XUSB_GAMEPAD_DPAD_DOWN,
        'LEFT': vg.XUSB_BUTTON.XUSB_GAMEPAD_DPAD_LEFT,
        'RIGHT': vg.XUSB_BUTTON.XUSB_GAMEPAD_DPAD_RIGHT,
        'START': vg.XUSB_BUTTON.XUSB_GAMEPAD_START,
        'SELECT': vg.XUSB_BUTTON.XUSB_GAMEPAD_BACK,
        'L3': vg.XUSB_BUTTON.XUSB_GAMEPAD_LEFT_THUMB,
        'R3': vg.XUSB_BUTTON.XUSB_GAMEPAD_RIGHT_THUMB,
    }
except ImportError:
    has_gamepad = False
    VG_BUTTONS = {}
    print("WARNING: vgamepad not installed. Gamepad mode will not work. Please run: pip install vgamepad")

# Multiplayer Gamepad Management
active_players = {} # key: sid -> value: {'player_index': int, 'gamepad': vg.VX360Gamepad}
available_slots = [0, 1, 2, 3] # Player 1, 2, 3, 4

import asyncio

# Quản lý các phím đang được đè (pressed keys) và các task lặp lại của chúng
# key: (sid, key_lower) -> value: asyncio.Task
keyboard_repeat_tasks = {}

# Bảng mã phím ảo Win32 (Virtual Key Codes)
VK_MAPPING = {
    'space': 0x20,
    'shift': 0x10,
    'ctrl': 0x11,
    'control': 0x11,
    'alt': 0x12,
    'enter': 0x0D,
    'return': 0x0D,
    'backspace': 0x08,
    'tab': 0x09,
    'esc': 0x1B,
    'escape': 0x1B,
    'up': 0x26,
    'down': 0x28,
    'left': 0x25,
    'right': 0x27,
    'pgup': 0x21,
    'pgdn': 0x22,
    'pageup': 0x21,
    'pagedown': 0x22,
    'end': 0x23,
    'home': 0x24,
    'insert': 0x2D,
    'delete': 0x2E,
    'del': 0x2E,
    'capslock': 0x14,
}

def win32_key_down(key):
    vk = VK_MAPPING.get(key.lower())
    if vk is None and len(key) == 1:
        try:
            vk = ctypes.windll.user32.VkKeyScanW(ord(key)) & 0xFF
        except:
            pass
    if vk:
        ctypes.windll.user32.keybd_event(vk, 0, 0, 0)

def win32_key_up(key):
    vk = VK_MAPPING.get(key.lower())
    if vk is None and len(key) == 1:
        try:
            vk = ctypes.windll.user32.VkKeyScanW(ord(key)) & 0xFF
        except:
            pass
    if vk:
        ctypes.windll.user32.keybd_event(vk, 0, 0x0002, 0)

async def repeat_key_press(key_lower):
    try:
        while True:
            try:
                win32_key_down(key_lower)
            except:
                pass
            await asyncio.sleep(0.04) # Lặp lại mỗi 40ms để duy trì đè phím mượt mà
    except asyncio.CancelledError:
        pass

sio = socketio.AsyncServer(async_mode='aiohttp', cors_allowed_origins='*')
app = web.Application()
sio.attach(app)

# Cấu hình CORS cho aiohttp
cors = aiohttp_cors.setup(app, defaults={
    "*": aiohttp_cors.ResourceOptions(
        allow_credentials=True,
        expose_headers="*",
        allow_headers="*",
    )
})

@sio.event
async def connect(sid, environ):
    query_string = environ.get('QUERY_STRING', '')
    params = parse_qs(query_string)
    client_key = params.get('key', [''])[0]
    
    if client_key != SECRET_KEY:
        print(f"[{sid}] Connection rejected: Invalid Key!")
        raise socketio.exceptions.ConnectionRefusedError('Authentication failed')
        
    # Gán tay cầm cho người chơi mới nếu còn slot
    if has_gamepad and available_slots:
        player_idx = available_slots.pop(0)
        try:
            gp = vg.VX360Gamepad()
            active_players[sid] = {
                'player_index': player_idx,
                'gamepad': gp
            }
            print(f"[{sid}] Client connected successfully. Assigned Player {player_idx + 1}")
            # Gửi thông tin player_index về cho client ngay lập tức
            await sio.emit('player_assign', {'player_index': player_idx}, to=sid)
        except Exception as e:
            available_slots.insert(0, player_idx)
            print(f"[{sid}] Failed to initialize virtual gamepad for Player {player_idx + 1}: {e}")
    else:
        if not has_gamepad:
            print(f"[{sid}] Client connected successfully (Keyboard Mode Only - vgamepad is missing)")
        else:
            print(f"[{sid}] Client connected but no player slots available (Max 4 players)")
            
    # Gửi thông tin Git commit hiện tại của server
    local_sha = get_local_git_sha()
    await sio.emit('server_info', {
        'version': '6.0.0',
        'commit_sha': local_sha
    }, to=sid)

@sio.event
async def trigger_update(sid):
    print(f"[{sid}] Received update trigger from client.")
    try:
        # Đường dẫn thư mục gốc chứa .git
        root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
        
        # Thực hiện git pull origin main
        import subprocess
        print(f"Running git pull origin main in {root_dir}...")
        result = subprocess.run(
            ["git", "pull", "origin", "main"],
            cwd=root_dir,
            capture_output=True,
            text=True,
            check=True
        )
        
        stdout_msg = result.stdout
        print("Git pull success:", stdout_msg)
        
        # Lấy SHA mới sau khi pull
        new_sha = get_local_git_sha()
        
        # Gửi thông báo thành công về client
        await sio.emit('update_status', {
            'success': True,
            'message': 'Cập nhật Git thành công! Máy chủ sẽ tự động khởi động lại sau giây lát.',
            'new_sha': new_sha
        }, to=sid)
        
        # Đợi 1 giây rồi khởi động lại tiến trình Python
        async def restart_server():
            await asyncio.sleep(1.5)
            print("Restarting server wifi process...")
            os.execv(sys.executable, [sys.executable] + sys.argv)
            
        asyncio.create_task(restart_server())
        
    except Exception as e:
        err_msg = str(e)
        if hasattr(e, 'stderr') and e.stderr:
            err_msg += "\n" + e.stderr
        print("Update error:", err_msg)
        await sio.emit('update_status', {
            'success': False,
            'message': f'Lỗi khi thực hiện git pull: {err_msg}'
        }, to=sid)

@sio.event
async def disconnect(sid):
    # Dọn dẹp toàn bộ các phím đang giữ đè của client này để tránh kẹt phím trên PC
    to_remove = []
    for task_key, task in keyboard_repeat_tasks.items():
        if task_key[0] == sid:
            if task:
                task.cancel()
            to_remove.append(task_key)
            try:
                win32_key_up(task_key[1])
            except:
                pass
    for k in to_remove:
        keyboard_repeat_tasks.pop(k, None)

    if sid in active_players:
        player_info = active_players.pop(sid)
        idx = player_info['player_index']
        # Trả lại slot người chơi
        available_slots.append(idx)
        available_slots.sort()
        print(f"Client disconnected: {sid}. Freed Player {idx + 1}")
    else:
        print(f"Client disconnected: {sid}")

@sio.event
async def mouse_move(sid, data):
    dx = data.get('dx', 0)
    dy = data.get('dy', 0)
    try:
        # Sử dụng API Win32 trực tiếp qua ctypes để di chuột mượt mà nhất với độ trễ ~0ms
        ctypes.windll.user32.mouse_event(0x0001, int(dx), int(dy), 0, 0)
    except Exception as e:
        # Dự phòng bằng pyautogui nếu xảy ra lỗi
        pyautogui.move(dx, dy, _pause=False)

@sio.event
async def mouse_down(sid, data):
    button = data.get('button', 'left')
    pyautogui.mouseDown(button=button)

@sio.event
async def mouse_up(sid, data):
    button = data.get('button', 'left')
    pyautogui.mouseUp(button=button)

@sio.event
async def mouse_scroll(sid, data):
    dy = data.get('dy', 0)
    # pyautogui.scroll(dy) # Positive up, negative down
    # Chuyển đổi delta từ mobile sang scroll của pyautogui
    pyautogui.scroll(-dy)

@sio.event
async def key_press(sid, data):
    key = data.get('key')
    print(f"Key press: {key}")
    if key == 'Backspace':
        pyautogui.press('backspace')
    elif key == 'Enter':
        pyautogui.press('enter')
    elif len(key) == 1:
        pyautogui.write(key)
    else:
        # For other special keys if needed
        try:
            pyautogui.press(key.lower())
        except:
            pass

# --- GAMEPAD EVENTS ---
@sio.event
async def gamepad_joystick(sid, data):
    if not has_gamepad: return
    player = active_players.get(sid)
    if not player: return
    
    gp = player['gamepad']
    stick = data.get('stick', 'left')
    x = float(data.get('x', 0.0))
    y = float(data.get('y', 0.0))
    
    if stick == 'left':
        gp.left_joystick_float(x_value_float=x, y_value_float=y)
    elif stick == 'right':
        gp.right_joystick_float(x_value_float=x, y_value_float=y)
    gp.update()

@sio.event
async def gamepad_button_down(sid, data):
    if not has_gamepad: return
    player = active_players.get(sid)
    if not player: return
    
    gp = player['gamepad']
    btn_name = data.get('button', '')
    if btn_name in VG_BUTTONS:
        gp.press_button(button=VG_BUTTONS[btn_name])
        gp.update()

@sio.event
async def gamepad_button_up(sid, data):
    if not has_gamepad: return
    player = active_players.get(sid)
    if not player: return
    
    gp = player['gamepad']
    btn_name = data.get('button', '')
    if btn_name in VG_BUTTONS:
        gp.release_button(button=VG_BUTTONS[btn_name])
        gp.update()

@sio.event
async def gamepad_trigger(sid, data):
    if not has_gamepad: return
    player = active_players.get(sid)
    if not player: return
    
    gp = player['gamepad']
    trigger = data.get('trigger', 'L2')
    value = float(data.get('value', 0.0))
    
    if trigger == 'L2':
        gp.left_trigger_float(value_float=value)
    elif trigger == 'R2':
        gp.right_trigger_float(value_float=value)
    gp.update()

@sio.event
async def gamepad_key_down(sid, data):
    key = data.get('key')
    if not key: return
    key_lower = key.lower()
    task_key = (sid, key_lower)

    if task_key not in keyboard_repeat_tasks:
        try:
            win32_key_down(key_lower)
        except Exception as e:
            print(f"Error pressing down key {key}: {e}")
        
        # Khởi tạo background task để tự động gửi lại tín hiệu keyDown định kỳ (giữ đè)
        task = asyncio.create_task(repeat_key_press(key_lower))
        keyboard_repeat_tasks[task_key] = task

@sio.event
async def gamepad_key_up(sid, data):
    key = data.get('key')
    if not key: return
    key_lower = key.lower()
    task_key = (sid, key_lower)

    # Hủy vòng lặp gửi lại phím
    task = keyboard_repeat_tasks.pop(task_key, None)
    if task:
        task.cancel()

    try:
        win32_key_up(key_lower)
    except Exception as e:
        print(f"Error releasing key {key}: {e}")


async def get_server_ip_api(request):
    ip = get_ip()
    return web.json_response({'ip': ip})

app.router.add_get('/api/ip', get_server_ip_api)

# Static files (Angular build)
if os.path.exists(www_dir):
    async def serve_index(request):
        return web.FileResponse(os.path.join(www_dir, 'index.html'))
    
    async def static_handler(request):
        # Lấy đường dẫn file từ request
        filename = request.match_info.get('filename', '')
        if not filename:
            return await serve_index(request)
            
        file_path = os.path.join(www_dir, filename)
        
        # Nếu là file thật thì serve file đó
        if os.path.isfile(file_path):
            return web.FileResponse(file_path)
            
        # Nếu không thấy file, trả về index.html (SPA Routing)
        return await serve_index(request)

    # Đăng ký route
    app.router.add_get('/', serve_index)
    app.router.add_get('/{filename:.*}', static_handler)
else:
    async def index(request):
        return web.Response(text="Lex Server is running! (No UI found in www/)", content_type='text/html')
    app.router.add_get('/', index)

def get_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

def display_qr(ip):
    url = f"http://{ip}:5000?key={SECRET_KEY}"
    print("\n" + "="*40)
    print(f" LEX SERVER V6 - SECURED")
    print("="*40)
    print(f"Server IP: {ip}")
    print(f"Secret Key: {SECRET_KEY}")
    print("-" * 40)
    print("Scan QR code from Lex App to connect:")
    
    qr = qrcode.QRCode(version=1, box_size=10, border=2)
    qr.add_data(url)
    qr.make(fit=True)
    
    # In QR code ra terminal dưới dạng ASCII
    qr.print_ascii(invert=True)
    print("="*40 + "\n")

if __name__ == '__main__':
    if not is_admin():
        print("Yêu cầu nâng quyền Administrator để có khả năng can thiệp vào tất cả ứng dụng/game...")
        if getattr(sys, 'frozen', False):
            # Nếu chạy từ file EXE đã đóng gói (PyInstaller)
            ret = ctypes.windll.shell32.ShellExecuteW(None, "runas", sys.executable, None, None, 1)
        else:
            # Nếu chạy script Python thông thường (.py)
            ret = ctypes.windll.shell32.ShellExecuteW(None, "runas", sys.executable, f'"{os.path.abspath(__file__)}"', None, 1)
        
        if int(ret) > 32:
            # Khởi chạy phiên bản Admin thành công, thoát phiên bản thường này
            sys.exit(0)
        else:
            print("Cảnh báo: Không có quyền Administrator. Một số game/ứng dụng bảo mật cao có thể không nhận phím.")

    ip = get_ip()
    display_qr(ip)
    web.run_app(app, host='0.0.0.0', port=5000)
