import socketio
import pyautogui
import socket
import os
import qrcode
from aiohttp import web
import aiohttp_cors

# Cấu hình PyAutoGUI
pyautogui.FAILSAFE = False
pyautogui.PAUSE = 0  # Tắt độ trễ mặc định của PyAutoGUI để di chuột mượt hơn

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
    print(f"Client connected: {sid}")

@sio.event
async def disconnect(sid):
    print(f"Client disconnected: {sid}")

@sio.event
async def mouse_move(sid, data):
    dx = data.get('dx', 0)
    dy = data.get('dy', 0)
    # Sử dụng move thay vì moveRel có thể ổn định hơn trong một số trường hợp
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

# Static files (Angular build)
if os.path.exists('www'):
    async def serve_index(request):
        return web.FileResponse('www/index.html')
    
    async def static_handler(request):
        # Lấy đường dẫn file từ request
        filename = request.match_info.get('filename', '')
        if not filename:
            return await serve_index(request)
            
        file_path = os.path.join('www', filename)
        
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
        return web.Response(text="MobileControl Server is running! (No UI found in www/)", content_type='text/html')
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
    url = f"http://{ip}:5000"
    print("\n" + "="*40)
    print(f" MOBILE CONTROL SERVER V6")
    print("="*40)
    print(f"Server IP: {ip}")
    print("-" * 40)
    print("Scan QR code to connect (or enter IP manually):")
    
    qr = qrcode.QRCode(version=1, box_size=10, border=2)
    qr.add_data(url)
    qr.make(fit=True)
    
    # In QR code ra terminal dưới dạng ASCII
    qr.print_ascii(invert=True)
    print("="*40 + "\n")

if __name__ == '__main__':
    ip = get_ip()
    display_qr(ip)
    web.run_app(app, host='0.0.0.0', port=5000)
