import { Component, OnDestroy, ViewChild, ElementRef, OnInit, NgZone, ChangeDetectorRef, HostListener } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { io, Socket } from 'socket.io-client';
import { Html5QrcodeScanner } from 'html5-qrcode';

console.log("=== LEX HOME PAGE FILE LOADED ===");

interface Profile {
  id: string;
  name: string;
  isKeyboardMode: boolean;
  useJoystick: boolean;
  actionButtonsCount: 4 | 6;
  mappings: { [btn: string]: string };
}

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit, OnDestroy {
  @ViewChild('keyboardInput') keyboardInput!: ElementRef<HTMLInputElement>;

  connected = false;
  playerIndex: number | null = null;
  serverIp = '';
  secretKey = '';
  isScanning = false;
  private scanner: Html5QrcodeScanner | null = null;
  private socket: Socket | null = null;

  appMode: 'overview' | 'touchpad' | 'gamepad' = 'overview';

  // Update logic state
  updateAvailable = false;
  latestSha = '';
  commitMessage = '';
  currentSha = '';
  updating = false;

  // PWA installation state
  deferredPrompt: any = null;
  showInstallBtn = false;

  // Profiles
  profiles: Profile[] = [];
  currentProfileId: string = 'default';
  isSettingsOpen = false;

  readonly defaultMappings: { [key: string]: string } = {
    'A': 'space', 'B': 'shift', 'X': 'r', 'Y': 'e',
    'C': 'f', 'Z': 'g',
    'UP': 'w', 'DOWN': 's', 'LEFT': 'a', 'RIGHT': 'd',
    'L1': 'q', 'R1': 'e', 'L2': '1', 'R2': '2',
    'START': 'esc', 'SELECT': 'tab'
  };

  // Gamepad state
  joyX = 0;
  joyY = 0;
  private joyRadius = 60; // 120px / 2
  private joyCenterX = 0;
  private joyCenterY = 0;
  private isJoyActive = false;
  private joyTouchId: number | null = null;
  private activeJoyKeys = new Set<string>();
  private pressedButtons = new Set<string>();
  private joystickStickEl: HTMLElement | null = null;
  private gamepadTouches = new Map<number, string>();
  @ViewChild('joystickBase') joystickBase!: ElementRef<HTMLDivElement>;

  private lastX = 0;
  private lastY = 0;
  private lastSendTime = 0;
  private readonly THROTTLE_MS = 8; // Tần số gửi tối ưu ~125Hz qua WiFi tránh lag-spike

  // Cấu hình độ nhạy động
  sensitivity = 2.2;
  scrollSensitivity = 0.8;

  private touchStartTime = 0;
  private touchStartX = 0;
  private touchStartY = 0;
  private hasMovedSignificantly = false;
  private isTwoFinger = false;
  private lastScrollY = 0;

  // Hằng số cho bộ gõ mới
  private readonly KEY_HINT = "  "; // 2 dấu cách

  isKeyboardActive = false;
  typedText = '';
  lastTypedText = '';

  constructor(private toastCtrl: ToastController, private zone: NgZone, private cdr: ChangeDetectorRef) {
    console.log("=== HomePage Constructor ===");
    const savedIp = localStorage.getItem('server_ip');
    if (savedIp) this.serverIp = savedIp;

    const savedKey = localStorage.getItem('secret_key');
    if (savedKey) this.secretKey = savedKey;

    const savedSens = localStorage.getItem('sensitivity');
    if (savedSens) this.sensitivity = parseFloat(savedSens);

    const savedScrollSens = localStorage.getItem('scroll_sensitivity');
    if (savedScrollSens) this.scrollSensitivity = parseFloat(savedScrollSens);
  }

  ngOnInit() {
    console.log("=== HomePage ngOnInit ===");
    this.loadProfiles();
    this.setupGlobalTouchListeners();
    this.setupPwaInstallPrompt();
    setTimeout(() => {
      this.checkUrlParams();
    }, 300);
  }

  checkUrlParams() {
    try {
      const currentUrl = window.location.href;
      console.log("Current Browser URL:", currentUrl);

      // 1. Tìm key bằng Regex trong toàn bộ URL (hỗ trợ cả URL thường và Hash routing)
      const keyMatch = currentUrl.match(/[?&]key=([^&]+)/);
      if (keyMatch) {
        let key = keyMatch[1];
        try {
          key = decodeURIComponent(key);
        } catch (e) {
          key = keyMatch[1];
        }
        key = key.replace(/^["']|["']$/g, '');
        this.secretKey = key;
        localStorage.setItem('secret_key', key);
      }

      // 2. Lấy IP từ hostname của trình duyệt (tránh đè mất IP thật bằng localhost)
      const hostname = window.location.hostname;
      if (hostname) {
        const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
        if (!isLocal || !this.serverIp) {
          this.serverIp = hostname;
          localStorage.setItem('server_ip', hostname);
        }

        // 3. Nếu đang mở qua localhost/127.0.0.1, gọi API lấy IP mạng LAN thực tế của PC Server
        if (isLocal) {
          fetch('/api/ip')
            .then(res => res.json())
            .then(data => {
              if (data && data.ip && data.ip !== '127.0.0.1') {
                this.zone.run(() => {
                  this.serverIp = data.ip;
                  localStorage.setItem('server_ip', data.ip);
                  this.cdr.detectChanges();
                });
              }
            })
            .catch(err => console.error("Error fetching LAN IP from server:", err));
        }
      }

      this.cdr.detectChanges();
    } catch (e) {
      console.error("Error checking URL params:", e);
    }
  }

  // --- Profiles Logic ---
  loadProfiles() {
    const saved = localStorage.getItem('gamepad_profiles');
    if (saved) {
      this.profiles = JSON.parse(saved);
      this.profiles.forEach(p => {
        if (p.useJoystick === undefined) p.useJoystick = true;
        if (p.actionButtonsCount === undefined) p.actionButtonsCount = 4;
        if (p.mappings['C'] === undefined) p.mappings['C'] = 'f';
        if (p.mappings['Z'] === undefined) p.mappings['Z'] = 'g';
      });
    } else {
      this.profiles = [
        { id: 'default', name: 'Mặc định (Xbox)', isKeyboardMode: false, useJoystick: true, actionButtonsCount: 4, mappings: { ...this.defaultMappings } },
        { id: 'keyboard_1', name: 'Bàn phím cơ bản', isKeyboardMode: true, useJoystick: false, actionButtonsCount: 4, mappings: { ...this.defaultMappings } }
      ];
    }
    const savedId = localStorage.getItem('current_profile_id');
    if (savedId && this.profiles.find(p => p.id === savedId)) {
      this.currentProfileId = savedId;
    } else {
      this.currentProfileId = this.profiles[0].id;
    }
  }

  saveProfiles() {
    localStorage.setItem('gamepad_profiles', JSON.stringify(this.profiles));
    localStorage.setItem('current_profile_id', this.currentProfileId);
  }

  addProfile() {
    const newId = 'prof_' + Date.now();
    this.profiles.push({
      id: newId,
      name: 'Hồ sơ mới',
      isKeyboardMode: true,
      useJoystick: true,
      actionButtonsCount: 4,
      mappings: { ...this.defaultMappings }
    });
    this.currentProfileId = newId;
    this.saveProfiles();
  }

  toggleLeftControl() {
    const prof = this.currentProfile;
    if (prof) {
      prof.useJoystick = !prof.useJoystick;
      this.saveProfiles();
      this.cdr.detectChanges();
    }
  }

  deleteProfile(id: string) {
    if (this.profiles.length <= 1) return;
    this.profiles = this.profiles.filter(p => p.id !== id);
    if (this.currentProfileId === id) this.currentProfileId = this.profiles[0].id;
    this.saveProfiles();
  }

  onProfileChange() {
    this.saveProfiles();
  }

  get currentProfile(): Profile | undefined {
    return this.profiles.find(p => p.id === this.currentProfileId);
  }

  openSettings() { this.isSettingsOpen = true; }
  closeSettings() { this.isSettingsOpen = false; this.saveProfiles(); }

  saveSettings() {
    localStorage.setItem('sensitivity', this.sensitivity.toString());
    localStorage.setItem('scroll_sensitivity', this.scrollSensitivity.toString());
    localStorage.setItem('server_ip', this.serverIp);
    localStorage.setItem('secret_key', this.secretKey);
  }

  toggleScanner() {
    this.isScanning = !this.isScanning;
    if (this.isScanning) {
      setTimeout(() => {
        try {
          const scannerInstance = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
          this.scanner = scannerInstance;
          scannerInstance.render((decodedText: string) => {
            // Xử lý text quét được (URL)
            try {
              const cleanText = decodedText.trim();
              console.log("Scanned QR Text:", cleanText);

              let ip = '';
              let key = '';

              // 1. Tìm Secret Key bằng Regex
              const keyMatch = cleanText.match(/[?&]key=([^&]+)/);
              if (keyMatch) {
                try {
                  // Giải mã URL encode (ví dụ: %22 -> ")
                  key = decodeURIComponent(keyMatch[1]);
                } catch (e) {
                  key = keyMatch[1];
                }
                // Loại bỏ dấu ngoặc kép hoặc ngoặc đơn bọc ngoài nếu có (ví dụ: "123" -> 123)
                key = key.replace(/^["']|["']$/g, '');
              }

              // 2. Tìm IP/Host bằng Regex (loại bỏ http/https, port, path)
              const hostMatch = cleanText.match(/(?:https?:\/\/)?([^:/?#\s]+)/);
              if (hostMatch) {
                ip = hostMatch[1];
                ip = ip.replace(/^["']|["']$/g, '');
              }

              console.log("Parsed result - IP:", ip, "Key:", key);

              if (!ip) {
                throw new Error('Could not parse IP from QR');
              }

              this.zone.run(() => {
                this.serverIp = ip;
                this.secretKey = key;

                // Đồng bộ ngay lập tức vào localStorage
                localStorage.setItem('server_ip', ip);
                localStorage.setItem('secret_key', key);

                this.toggleScanner(); // Tắt quét
                this.cdr.detectChanges(); // Ép buộc cập nhật giao diện
                this.showToast(`Đã quét thành công: ${ip}`);
              });
            } catch (e) {
              console.error("QR parse error:", e);
              this.zone.run(() => {
                this.showToast('Mã QR không đúng định dạng!');
              });
            }
          }, (errorMessage: string) => {
            // Bỏ qua error callback liên tục khi quét để tránh tràn console log
          });
        } catch (err) {
          console.error("Failed to initialize scanner:", err);
          this.zone.run(() => {
            this.showToast("Lỗi khởi tạo Camera! Vui lòng kiểm tra quyền truy cập.");
            this.isScanning = false;
          });
        }
      }, 150);
    } else {
      if (this.scanner) {
        const currentScanner = this.scanner;
        this.scanner = null;
        // Defer clearing to avoid race conditions inside html5-qrcode
        setTimeout(() => {
          currentScanner.clear().catch((err) => {
            console.error("Error clearing scanner:", err);
          });
        }, 100);
      }
    }
  }

  toggleConnect() {
    if (!this.connected) {
      this.saveSettings();
      this.connect();
    } else {
      this.disconnect();
    }
  }


  async connect() {
    if (!this.serverIp || !this.secretKey) return this.showToast('Nhập IP và Secret Key nha Anh ơi!');
    const serverUrl = `http://${this.serverIp}:5000`;

    // Gửi secretKey trong query params
    this.socket = io(serverUrl, {
      transports: ['websocket'],
      timeout: 5000,
      query: { key: this.secretKey }
    });

    this.socket.on('connect', () => {
      this.zone.run(() => {
        this.connected = true;
        this.showToast('Đã kết nối! 🚀');
      });
    });
    this.socket.on('player_assign', (data: any) => {
      this.zone.run(() => {
        this.playerIndex = data.player_index;
        this.showToast(`Bạn được gán làm Player ${data.player_index + 1}! 🎮`);
        this.cdr.detectChanges();
      });
    });
    this.socket.on('server_info', (data: any) => {
      console.log("Server Info received:", data);
      if (data && data.commit_sha) {
        this.currentSha = data.commit_sha;
        this.checkGithubUpdate();
      }
    });
    this.socket.on('update_status', (data: any) => {
      this.zone.run(() => {
        this.updating = false;
        if (data.success) {
          this.showToast('Cập nhật thành công! Server đang khởi động lại...');
          this.updateAvailable = false;
        } else {
          this.showToast(`Cập nhật thất bại: ${data.message}`);
        }
        this.cdr.detectChanges();
      });
    });
    this.socket.on('disconnect', () => {
      this.zone.run(() => {
        this.connected = false;
        this.playerIndex = null;
        this.showToast('Đã ngắt kết nối!');
        this.updateAvailable = false;
        if (this.appMode === 'gamepad') {
          this.setAppMode('overview');
        }
      });
    });
    this.socket.on('connect_error', (err) => {
      this.zone.run(() => {
        this.showToast('Lỗi: Sai Key hoặc IP!');
        this.disconnect();
      });
    });
  }

  checkGithubUpdate() {
    if (!this.currentSha) return;
    fetch('https://api.github.com/repos/hainguyen011/Lex/commits/main')
      .then(res => res.json())
      .then(data => {
        if (data && data.sha) {
          this.latestSha = data.sha;
          this.commitMessage = data.commit?.message || '';
          if (this.latestSha !== this.currentSha) {
            this.zone.run(() => {
              this.updateAvailable = true;
              this.cdr.detectChanges();
            });
          } else {
            this.zone.run(() => {
              this.updateAvailable = false;
              this.cdr.detectChanges();
            });
          }
        }
      })
      .catch(err => console.error("Error checking GitHub update:", err));
  }

  triggerUpdate() {
    if (!this.socket || !this.connected) return;
    this.updating = true;
    this.socket.emit('trigger_update');
    this.showToast('Đang tiến hành cập nhật...');
  }

  disconnect() {
    if (this.socket) { this.socket.disconnect(); this.socket = null; }
    this.connected = false;
    this.playerIndex = null;
    this.updateAvailable = false;
    if (this.appMode === 'gamepad') {
      this.setAppMode('overview');
    }
  }

  async setAppMode(mode: 'overview' | 'touchpad' | 'gamepad') {
    const prevMode = this.appMode;
    this.appMode = mode;
    if (mode === 'gamepad') {
      await this.enterFullscreen();
    } else {
      if (prevMode === 'gamepad') {
        // Nhả tất cả các nút đang nhấn trên server tránh bị kẹt phím
        for (const btn of this.gamepadTouches.values()) {
          this.onGpadUp(btn);
        }
        this.gamepadTouches.clear();

        if (this.isJoyActive) {
          this.onJoyEnd();
        }
      }
      await this.exitFullscreen();
    }
    this.cdr.detectChanges();
  }

  async enterFullscreen() {
    try {
      const docEl = document.documentElement as any;
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen();
      } else if (docEl.webkitRequestFullscreen) {
        await docEl.webkitRequestFullscreen();
      } else if (docEl.msRequestFullscreen) {
        await docEl.msRequestFullscreen();
      }

      // Khóa màn hình xoay ngang (Landscape) nếu thiết bị hỗ trợ
      if (window.screen && (window.screen as any).orientation && (window.screen as any).orientation.lock) {
        await (window.screen as any).orientation.lock('landscape').catch((err: any) => {
          console.warn('Orientation lock was rejected or not supported:', err);
        });
      }
    } catch (e) {
      console.warn('Không thể kích hoạt Fullscreen:', e);
    }
  }

  async exitFullscreen() {
    try {
      const doc = document as any;
      const isFullscreen = !!(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.msFullscreenElement
      );
      if (isFullscreen) {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen();
        }
      }

      // Mở khóa màn hình
      if (window.screen && (window.screen as any).orientation && (window.screen as any).orientation.unlock) {
        (window.screen as any).orientation.unlock();
      }
    } catch (e) {
      console.warn('Không thể thoát Fullscreen:', e);
    }
  }

  @HostListener('document:fullscreenchange', ['$event'])
  @HostListener('document:webkitfullscreenchange', ['$event'])
  @HostListener('document:msfullscreenchange', ['$event'])
  onFullscreenChange() {
    const isFullscreen = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).msFullscreenElement
    );
    if (!isFullscreen && this.appMode === 'gamepad') {
      this.zone.run(() => {
        this.appMode = 'touchpad';
        this.cdr.detectChanges();
      });
    }
  }

  // --- Logic Bàn phím gõ hiển thị (Input Bar Vercel) ---
  openKeyboard() {
    this.isKeyboardActive = true;
    this.typedText = '';
    this.lastTypedText = '';
    setTimeout(() => {
      if (this.keyboardInput) {
        this.keyboardInput.nativeElement.focus();
      }
    }, 120);
  }

  closeKeyboard() {
    this.isKeyboardActive = false;
    this.typedText = '';
    this.lastTypedText = '';
  }

  clearKeyboardText() {
    this.typedText = '';
    this.lastTypedText = '';
    if (this.keyboardInput) {
      this.keyboardInput.nativeElement.focus();
    }
  }

  onKeyboardEnter() {
    if (this.socket && this.connected) {
      this.socket.emit('key_press', { key: 'Enter' });
    }
    // Reset lại ô nhập liệu trên mobile sau khi gửi Enter
    this.typedText = '';
    this.lastTypedText = '';
  }

  onKeyboardInputChange(event: any) {
    if (!this.socket || !this.connected) return;
    const currentText = this.typedText;
    const oldText = this.lastTypedText;

    if (currentText === oldText) return;

    // 1. Nếu dài hơn -> người dùng gõ thêm hoặc paste chữ
    if (currentText.length > oldText.length) {
      if (currentText.startsWith(oldText)) {
        const added = currentText.substring(oldText.length);
        for (let char of added) {
          if (char === '\n') {
            this.socket.emit('key_press', { key: 'Enter' });
          } else {
            this.socket.emit('key_press', { key: char });
          }
        }
      } else {
        // Dự phòng khi con trỏ nhảy hoặc paste thay thế
        const added = currentText.substring(oldText.length);
        this.socket.emit('key_press', { key: added });
      }
    }
    // 2. Nếu ngắn hơn -> người dùng xóa chữ
    else if (currentText.length < oldText.length) {
      const diff = oldText.length - currentText.length;
      for (let i = 0; i < diff; i++) {
        this.socket.emit('key_press', { key: 'Backspace' });
      }
    }

    this.lastTypedText = currentText;
  }

  // --- Logic Touchpad ---
  onTouchStart(event: TouchEvent) {
    if (event.touches.length === 1) {
      this.isTwoFinger = false;
      this.lastX = event.touches[0].clientX;
      this.lastY = event.touches[0].clientY;
      this.touchStartX = this.lastX;
      this.touchStartY = this.lastY;
      this.touchStartTime = Date.now();
      this.hasMovedSignificantly = false;
    } else if (event.touches.length === 2) {
      this.isTwoFinger = true;
      this.lastScrollY = (event.touches[0].clientY + event.touches[1].clientY) / 2;
    }
  }

  onTouchMove(event: TouchEvent) {
    if (!this.connected || !this.socket) return;
    if (event.touches.length === 1 && !this.isTwoFinger) {
      const currentX = event.touches[0].clientX;
      const currentY = event.touches[0].clientY;
      const dx = Math.round((currentX - this.lastX) * this.sensitivity);
      const dy = Math.round((currentY - this.lastY) * this.sensitivity);
      if (Math.abs(currentX - this.touchStartX) > 5 || Math.abs(currentY - this.touchStartY) > 5) this.hasMovedSignificantly = true;
      if ((dx !== 0 || dy !== 0) && Date.now() - this.lastSendTime > this.THROTTLE_MS) {
        this.socket.emit('mouse_move', { dx, dy });
        this.lastX = currentX;
        this.lastY = currentY;
        this.lastSendTime = Date.now();
      }
    } else if (event.touches.length === 2) {
      const currentScrollY = (event.touches[0].clientY + event.touches[1].clientY) / 2;
      const deltaY = Math.round((this.lastScrollY - currentScrollY) * 15 * this.scrollSensitivity);
      if (Math.abs(deltaY) > 0 && Date.now() - this.lastSendTime > 30) {
        this.socket.emit('mouse_scroll', { dy: deltaY });
        this.lastScrollY = currentScrollY;
        this.lastSendTime = Date.now();
      }
    }
  }

  onTouchEnd() {
    const duration = Date.now() - this.touchStartTime;
    if (this.connected && !this.hasMovedSignificantly && !this.isTwoFinger && duration < 200) {
      this.socket?.emit('mouse_down', { button: 'left' });
      setTimeout(() => this.socket?.emit('mouse_up', { button: 'left' }), 10);
    }
  }

  onButtonDown(button: 'left' | 'right') { if (this.connected && this.socket) this.socket.emit('mouse_down', { button }); }
  onButtonUp(button: 'left' | 'right') { if (this.connected && this.socket) this.socket.emit('mouse_up', { button }); }

  private safePreventDefault(event: any) {
    if (event && event.cancelable) {
      try {
        event.preventDefault();
      } catch (e) {
        // Nuốt lỗi passive event listener trên thiết bị di động
      }
    }
  }

  // --- Gamepad Logic ---
  onGpadDown(btn: string, event?: TouchEvent) {
    if (!this.connected || !this.socket) return;
    const prof = this.currentProfile;
    if (!prof) return;

    // Chan spam/double trigger bang cach check trang thai dang nhan
    if (this.pressedButtons.has(btn)) return;
    this.pressedButtons.add(btn);

    if (prof.isKeyboardMode) {
      const key = prof.mappings[btn];
      if (key) this.socket.emit('gamepad_key_down', { key });
    } else {
      if (btn === 'L2' || btn === 'R2') {
        this.socket.emit('gamepad_trigger', { trigger: btn, value: 1.0 });
      } else {
        this.socket.emit('gamepad_button_down', { button: btn });
      }
    }
  }

  onGpadUp(btn: string, event?: TouchEvent) {
    if (!this.connected || !this.socket) return;
    const prof = this.currentProfile;
    if (!prof) return;

    // Chi cho phep nha phim khi dang co ghi nhan nhan phim
    if (!this.pressedButtons.has(btn)) return;
    this.pressedButtons.delete(btn);

    if (prof.isKeyboardMode) {
      const key = prof.mappings[btn];
      if (key) this.socket.emit('gamepad_key_up', { key });
    } else {
      if (btn === 'L2' || btn === 'R2') {
        this.socket.emit('gamepad_trigger', { trigger: btn, value: 0.0 });
      } else {
        this.socket.emit('gamepad_button_up', { button: btn });
      }
    }
  }

  // --- PWA Installation Logic ---
  setupPwaInstallPrompt() {
    if (this.isStandalone()) {
      this.showInstallBtn = false;
      return;
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('assets/sw.js')
        .then(reg => console.log('Service Worker Registered!', reg))
        .catch(err => console.error('Service Worker registration failed:', err));
    }

    window.addEventListener('beforeinstallprompt', (e: any) => {
      console.log('beforeinstallprompt event fired');
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallBtn = true;
      this.cdr.detectChanges();
    });

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (isIOS) {
      this.showInstallBtn = true;
    }
  }

  isStandalone(): boolean {
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches;
    const isNavStandalone = (navigator as any).standalone === true;
    return isStandaloneMode || isNavStandalone;
  }

  async addToHomeScreen() {
    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      this.deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the PWA install prompt');
          this.showInstallBtn = false;
        } else {
          console.log('User dismissed the PWA install prompt');
        }
        this.deferredPrompt = null;
        this.cdr.detectChanges();
      });
    } else {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      if (isIOS) {
        const toast = await this.toastCtrl.create({
          message: 'Thêm vào MH chính: Bấm nút "Chia sẻ" (Share ở Safari) -> Chọn "Thêm vào MH chính" (Add to Home Screen) -> Bấm "Thêm" ở góc phải.',
          duration: 10000,
          position: 'bottom',
          buttons: [{ text: 'OK', role: 'cancel' }],
          color: 'dark'
        });
        await toast.present();
      } else {
        const toast = await this.toastCtrl.create({
          message: 'Cài đặt ứng dụng: Bấm vào dấu 3 chấm ở góc trình duyệt -> Chọn "Cài đặt ứng dụng" hoặc "Thêm vào màn hình chính".',
          duration: 7000,
          position: 'bottom',
          buttons: [{ text: 'OK', role: 'cancel' }],
          color: 'dark'
        });
        await toast.present();
      }
    }
  }

  setupGlobalTouchListeners() {
    this.zone.runOutsideAngular(() => {
      window.addEventListener('touchstart', (e: TouchEvent) => {
        if (this.appMode !== 'gamepad') return;
        this.handleTouchStart(e);
      }, { passive: false });

      window.addEventListener('touchmove', (e: TouchEvent) => {
        if (this.appMode !== 'gamepad') return;
        this.handleTouchMove(e);
      }, { passive: false });

      window.addEventListener('touchend', (e: TouchEvent) => {
        if (this.appMode !== 'gamepad') return;
        this.handleTouchEnd(e);
      }, { passive: false });

      window.addEventListener('touchcancel', (e: TouchEvent) => {
        if (this.appMode !== 'gamepad') return;
        this.handleTouchEnd(e);
      }, { passive: false });
    });
  }

  private handleTouchStart(e: TouchEvent) {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const target = touch.target as HTMLElement;
      if (!target || typeof target.closest !== 'function') continue;

      const joyBase = target.closest('.joystick-base');

      if (joyBase && !this.isJoyActive) {
        if (e.cancelable) e.preventDefault();
        this.onJoyStart(touch, joyBase as HTMLElement);
      } else {
        const btnEl = target.closest('[data-btn]');
        if (btnEl) {
          const btnName = btnEl.getAttribute('data-btn');
          if (btnName) {
            if (e.cancelable) e.preventDefault();
            this.gamepadTouches.set(touch.identifier, btnName);
            this.onGpadDown(btnName);
          }
        }
      }
    }
  }

  private handleTouchMove(e: TouchEvent) {
    if (e.cancelable) e.preventDefault();
    if (this.isJoyActive) {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.joyTouchId) {
          this.updateJoy(touch.clientX, touch.clientY);
          break;
        }
      }
    }
  }

  private handleTouchEnd(e: TouchEvent) {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];

      if (this.isJoyActive && touch.identifier === this.joyTouchId) {
        if (e.cancelable) e.preventDefault();
        this.onJoyEnd();
      } else {
        const btnName = this.gamepadTouches.get(touch.identifier);
        if (btnName) {
          if (e.cancelable) e.preventDefault();
          this.onGpadUp(btnName);
          this.gamepadTouches.delete(touch.identifier);
        }
      }
    }
  }

  onJoyStart(touch: Touch, joyBase: HTMLElement) {
    this.isJoyActive = true;
    this.joyTouchId = touch.identifier;
    this.joystickStickEl = joyBase.querySelector('.joystick-stick') as HTMLElement;

    const rect = joyBase.getBoundingClientRect();
    const currentRadius = rect.width / 2;
    this.joyRadius = currentRadius;
    this.joyCenterX = rect.left + currentRadius;
    this.joyCenterY = rect.top + currentRadius;

    this.updateJoy(touch.clientX, touch.clientY);
  }

  onJoyEnd() {
    this.isJoyActive = false;
    this.joyTouchId = null;
    this.joyX = 0;
    this.joyY = 0;

    if (this.joystickStickEl) {
      this.joystickStickEl.style.transform = 'translate(0px, 0px)';
      this.joystickStickEl = null;
    }

    const prof = this.currentProfile;
    if (prof && prof.isKeyboardMode) {
      for (const k of this.activeJoyKeys) {
        this.socket?.emit('gamepad_key_up', { key: k });
      }
      this.activeJoyKeys.clear();
    } else if (this.connected && this.socket) {
      this.socket.emit('gamepad_joystick', { stick: 'left', x: 0, y: 0 });
    }
  }

  private updateJoy(clientX: number, clientY: number) {
    let dx = clientX - this.joyCenterX;
    let dy = clientY - this.joyCenterY;

    // Bù trừ tọa độ khi giao diện bị xoay 90 độ (CSS rotate) trên màn hình dọc
    if (window.innerWidth < window.innerHeight && this.appMode === 'gamepad') {
      const tempX = dx;
      const tempY = dy;
      dx = tempY;
      dy = -tempX;
    }

    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > this.joyRadius) {
      dx = (dx / distance) * this.joyRadius;
      dy = (dy / distance) * this.joyRadius;
    }

    this.joyX = dx;
    this.joyY = dy;

    // Cập nhật DOM trực tiếp để tối ưu hóa hiệu năng
    if (this.joystickStickEl) {
      this.joystickStickEl.style.transform = `translate(${dx}px, ${dy}px)`;
    }

    let normX = dx / this.joyRadius;
    let normY = -(dy / this.joyRadius);

    const prof = this.currentProfile;
    if (prof && prof.isKeyboardMode && this.connected && this.socket) {
      const newActive = new Set<string>();
      
      const upKey = prof.mappings['UP'];
      const downKey = prof.mappings['DOWN'];
      const rightKey = prof.mappings['RIGHT'];
      const leftKey = prof.mappings['LEFT'];

      // UP Key with hysteresis
      if (upKey) {
        const limit = this.activeJoyKeys.has(upKey) ? 0.2 : 0.45;
        if (normY > limit) newActive.add(upKey);
      }
      
      // DOWN Key with hysteresis
      if (downKey) {
        const limit = this.activeJoyKeys.has(downKey) ? -0.2 : -0.45;
        if (normY < limit) newActive.add(downKey);
      }
      
      // RIGHT Key with hysteresis
      if (rightKey) {
        const limit = this.activeJoyKeys.has(rightKey) ? 0.2 : 0.45;
        if (normX > limit) newActive.add(rightKey);
      }
      
      // LEFT Key with hysteresis
      if (leftKey) {
        const limit = this.activeJoyKeys.has(leftKey) ? -0.2 : -0.45;
        if (normX < limit) newActive.add(leftKey);
      }

      for (const k of this.activeJoyKeys) {
        if (!newActive.has(k)) this.socket.emit('gamepad_key_up', { key: k });
      }
      for (const k of newActive) {
        if (!this.activeJoyKeys.has(k)) this.socket.emit('gamepad_key_down', { key: k });
      }
      this.activeJoyKeys = newActive;
    } else {
      if (Date.now() - this.lastSendTime > this.THROTTLE_MS && this.connected && this.socket) {
        this.socket.emit('gamepad_joystick', { stick: 'left', x: normX, y: normY });
        this.lastSendTime = Date.now();
      }
    }
  }

  async showToast(message: string) {
    const toast = await this.toastCtrl.create({ message, duration: 1500, position: 'bottom', color: 'dark' });
    await toast.present();
  }

  ngOnDestroy() { this.disconnect(); }
}
