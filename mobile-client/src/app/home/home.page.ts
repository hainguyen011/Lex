import { Component, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { io, Socket } from 'socket.io-client';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnDestroy {
  @ViewChild('hiddenInput') hiddenInput!: ElementRef<HTMLTextAreaElement>;

  connected = false;
  serverIp = ''; 
  private socket: Socket | null = null;
  
  private lastX = 0;
  private lastY = 0;
  private lastSendTime = 0;
  private readonly THROTTLE_MS = 5; 

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

  constructor(private toastCtrl: ToastController) {
    const savedIp = localStorage.getItem('server_ip');
    if (savedIp) this.serverIp = savedIp;

    const savedSens = localStorage.getItem('sensitivity');
    if (savedSens) this.sensitivity = parseFloat(savedSens);

    const savedScrollSens = localStorage.getItem('scroll_sensitivity');
    if (savedScrollSens) this.scrollSensitivity = parseFloat(savedScrollSens);
  }

  saveSettings() {
    localStorage.setItem('sensitivity', this.sensitivity.toString());
    localStorage.setItem('scroll_sensitivity', this.scrollSensitivity.toString());
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
    if (!this.serverIp) return this.showToast('Nhập IP đã Anh ơi!');
    localStorage.setItem('server_ip', this.serverIp);
    const serverUrl = `http://${this.serverIp}:5000`;
    this.socket = io(serverUrl, { transports: ['websocket'], timeout: 5000 });
    this.socket.on('connect', () => { this.connected = true; this.showToast('Đã kết nối! 🚀'); });
    this.socket.on('disconnect', () => this.connected = false);
  }

  disconnect() {
    if (this.socket) { this.socket.disconnect(); this.socket = null; }
    this.connected = false;
  }

  // --- Logic Bàn phím V6 (Phương pháp Hai Dấu Cách) ---
  openKeyboard() {
    const input = this.hiddenInput.nativeElement;
    input.value = this.KEY_HINT;
    input.focus();
    // Đặt con trỏ ở cuối
    input.setSelectionRange(2, 2);
  }

  onKeyInput(event: any) {
    if (!this.socket || !this.connected) return;

    const input = this.hiddenInput.nativeElement;
    const currentValue = input.value;

    // 1. Nếu giá trị ngắn hơn 2 -> Anh vừa nhấn Backspace
    if (currentValue.length < 2) {
      const diff = 2 - currentValue.length;
      for (let i = 0; i < diff; i++) {
        this.socket.emit('key_press', { key: 'Backspace' });
      }
    } 

    // 2. Nếu dài hơn 2 -> Anh vừa gõ chữ hoặc nhấn Enter
    else if (currentValue.length > 2) {
      const newChar = currentValue.substring(2);
      
      if (newChar === "\n") {
        this.socket.emit('key_press', { key: 'Enter' });
      } else {
        this.socket.emit('key_press', { key: newChar });
      }
    }

    // Luôn reset về trạng thái 2 dấu cách
    input.value = this.KEY_HINT;
    input.setSelectionRange(2, 2);
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

  private async showToast(message: string) {
    const toast = await this.toastCtrl.create({ message, duration: 1500, position: 'bottom', color: 'dark' });
    await toast.present();
  }

  ngOnDestroy() { this.disconnect(); }
}
