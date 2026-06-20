import os
import shutil
import subprocess
import sys

# Path to artifact image
artifact_path = r"C:\Users\Admin\.gemini\antigravity-ide\brain\8ab1b3e4-06a4-4fc5-bf64-cea862034a65\lex_logo_metaphor_1781998868310.png"
root_dir = os.path.dirname(os.path.abspath(__file__))
target_png = os.path.join(root_dir, "app.png")
target_ico = os.path.join(root_dir, "app.ico")
server_ico = os.path.join(root_dir, "server", "app.ico")

print("--------------------------------------")
print("PROCESS: CREATING APPLICATION ICON AT ROOT")
print("--------------------------------------")

# Copy the image from agent artifacts to root folder
if os.path.exists(artifact_path):
    try:
        shutil.copy2(artifact_path, target_png)
        print(f"[OK] Da sao chep logo tu artifacts sang {target_png}")
    except Exception as e:
        print(f"[WARNING] Khong the sao chep logo: {e}")
else:
    print("[INFO] Khong tim thay file logo trong artifacts, su dung logo hien tai neu co.")

# Install Pillow if not present
try:
    from PIL import Image
except ImportError:
    print("[INFO] Khong tim thay thu vien Pillow. Dang tien hanh cai dat...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
        from PIL import Image
        print("[OK] Cai dat Pillow thanh cong!")
    except Exception as e:
        print(f"[ERROR] Khong the cai dat Pillow: {e}")
        sys.exit(1)

# Convert PNG to ICO and make background transparent
if os.path.exists(target_png):
    try:
        print("Dang lam trong suot nen den va chuyen doi sang app.ico...")
        img = Image.open(target_png).convert("RGBA")
        datas = img.getdata()
        
        newData = []
        for item in datas:
            r, g, b, a = item
            # Calculate brightness of the pixel
            brightness = (r + g + b) / 3.0
            
            # If the pixel is very dark (close to black), make it transparent
            # Use smooth alpha blending transition at the glowing edges
            if brightness < 35.0:
                new_a = int((brightness / 35.0) * a)
                newData.append((r, g, b, new_a))
            else:
                newData.append(item)
                
        img.putdata(newData)
        
        # Save to root directory
        img.save(target_ico, format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
        print(f"[OK] Da tao thanh cong file icon tai {target_ico}!")
        
        # Also copy/save to server directory for PyInstaller build
        os.makedirs(os.path.join(root_dir, "server"), exist_ok=True)
        img.save(server_ico, format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
        print(f"[OK] Da copy file icon vao thu muc server phuc vu build: {server_ico}")
        
    except Exception as e:
        print(f"[ERROR] Chuyen doi icon that bai: {e}")
else:
    print("[ERROR] Khong tim thay file app.png de chuyen doi.")

print("--------------------------------------")
