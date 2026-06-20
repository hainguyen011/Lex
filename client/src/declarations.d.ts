declare module 'html5-qrcode' {
  export class Html5QrcodeScanner {
    constructor(elementId: string, config: any, verbose: boolean);
    render(onScanSuccess: (decodedText: string, result: any) => void, onScanFailure: any): void;
    clear(): Promise<void>;
  }
}
