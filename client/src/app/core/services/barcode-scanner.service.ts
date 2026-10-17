import { Injectable } from '@angular/core';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';

export interface ScannedBarcodeResult {
  code: string;
  format: string;
  timestamp: number;
}

export interface VideoDeviceOption {
  deviceId: string;
  label: string;
  isRear: boolean;
}

export type ScannerStatus =
  | 'idle'
  | 'camera_starting'
  | 'scanning'
  | 'detected'
  | 'permission_denied'
  | 'no_camera'
  | 'stopped'
  | 'error';

export interface ScannerSessionConfig {
  videoElement: HTMLVideoElement;
  preferredDeviceId?: string;
  preferRear?: boolean;
  soundEnabled?: boolean;
  onScan: (result: ScannedBarcodeResult) => void;
  onError: (errorMessage: string) => void;
  onStatusChange?: (status: ScannerStatus, displayMessage: string) => void;
}

export interface ScannerSession {
  stop: () => void;
  setTorch: (enable: boolean) => Promise<boolean>;
  isTorchSupported: () => boolean;
  switchDevice: (deviceId: string) => Promise<void>;
  unlockScan: () => void;
}

@Injectable({
  providedIn: 'root',
})
export class BarcodeScannerService {
  private nativeDetector: any = null;
  private isNativeDetectorSupported: boolean = false;
  private audioCtx: AudioContext | null = null;

  constructor() {
    this.checkNativeDetector();
  }

  /**
   * Detects whether browser has native hardware-accelerated BarcodeDetector (Chrome/Edge/Android)
   */
  private async checkNativeDetector(): Promise<void> {
    try {
      if ('BarcodeDetector' in window) {
        const supported = await (window as any).BarcodeDetector.getSupportedFormats();
        if (supported && supported.length > 0) {
          this.nativeDetector = new (window as any).BarcodeDetector({
            formats: [
              'ean_13',
              'ean_8',
              'upc_a',
              'upc_e',
              'code_128',
              'code_39',
              'itf',
              'codabar',
              'qr_code',
              'data_matrix',
            ],
          });
          this.isNativeDetectorSupported = true;
        }
      }
    } catch {
      this.isNativeDetectorSupported = false;
      this.nativeDetector = null;
    }
  }

  /**
   * Creates a properly configured ZXing MultiFormat reader with all retail barcode formats and TRY_HARDER enabled.
   */
  createZxingReader(): BrowserMultiFormatReader {
    const hints = new Map<DecodeHintType, any>();
    const formats: BarcodeFormat[] = [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.ITF,
      BarcodeFormat.CODABAR,
      BarcodeFormat.QR_CODE,
      BarcodeFormat.DATA_MATRIX,
    ];
    hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
    hints.set(DecodeHintType.TRY_HARDER, true);

    // Scan every 120ms for fast responsive feedback
    return new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 });
  }

  /**
   * Retrieves all available camera devices with human-friendly labels
   */
  async getAvailableVideoDevices(): Promise<VideoDeviceOption[]> {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) {
        return [];
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === 'videoinput');

      return videoInputs.map((d, index) => {
        const label = d.label.toLowerCase();
        const isRear =
          label.includes('back') ||
          label.includes('rear') ||
          label.includes('environment') ||
          label.includes('facing back');

        let displayLabel = d.label;
        if (!displayLabel) {
          displayLabel = isRear ? `Rear Camera (${index + 1})` : `Camera ${index + 1}`;
        }

        return {
          deviceId: d.deviceId,
          label: displayLabel,
          isRear,
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * Requests a camera stream with multi-level fallbacks (continuous autofocus, HD resolution, specific device)
   */
  async requestCameraStream(preferredDeviceId?: string, preferRear = true): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera access API (getUserMedia) is not supported in this browser or context is insecure.');
    }

    const constraintProfiles: MediaStreamConstraints[] = [];

    // Profile 1: Specific Device ID if requested
    if (preferredDeviceId) {
      constraintProfiles.push({
        video: {
          deviceId: { exact: preferredDeviceId },
          width: { ideal: 1920, min: 640 },
          height: { ideal: 1080, min: 480 },
        },
        audio: false,
      });
      constraintProfiles.push({
        video: { deviceId: { exact: preferredDeviceId } },
        audio: false,
      });
    }

    // Profile 2: High resolution environment / rear camera with autofocus
    if (preferRear) {
      constraintProfiles.push({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920, min: 640 },
          height: { ideal: 1080, min: 480 },
        },
        audio: false,
      });
      constraintProfiles.push({
        video: { facingMode: 'environment' },
        audio: false,
      });
    }

    // Profile 3: Standard resolution (ideal for laptops and basic webcams)
    constraintProfiles.push({
      video: {
        width: { ideal: 1280, min: 640 },
        height: { ideal: 720, min: 480 },
      },
      audio: false,
    });

    // Profile 4: Universal fallback
    constraintProfiles.push({
      video: true,
      audio: false,
    });

    let stream: MediaStream | null = null;
    let lastError: any = null;

    for (const constraints of constraintProfiles) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (stream) break;
      } catch (err: any) {
        lastError = err;
      }
    }

    if (!stream) {
      if (lastError?.name === 'NotAllowedError' || lastError?.name === 'PermissionDeniedError') {
        throw new Error('Camera permission was denied. Please allow camera access in your browser settings.');
      } else if (lastError?.name === 'NotFoundError' || lastError?.name === 'DevicesNotFoundError') {
        throw new Error('No camera device was detected on your system.');
      } else if (lastError?.name === 'NotReadableError' || lastError?.name === 'TrackStartError') {
        throw new Error('Camera is already in use by another application or browser tab.');
      } else {
        throw new Error(lastError?.message || 'Unable to access camera.');
      }
    }

    // Apply continuous autofocus if hardware capability is present
    try {
      const track = stream.getVideoTracks()[0];
      const capabilities = (track as any)?.getCapabilities?.();
      if (capabilities && capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
        await (track as any).applyConstraints({
          advanced: [{ focusMode: 'continuous' }],
        });
      }
    } catch {
      // Focus constraint application optional
    }

    return stream;
  }

  /**
   * Checks if the active video stream supports torch/flashlight
   */
  supportsTorch(stream: MediaStream | null): boolean {
    if (!stream) return false;
    try {
      const track = stream.getVideoTracks()[0];
      const capabilities = (track as any)?.getCapabilities?.();
      return !!(capabilities && 'torch' in capabilities);
    } catch {
      return false;
    }
  }

  /**
   * Toggles the torch / flashlight on or off
   */
  async setTorch(stream: MediaStream | null, enable: boolean): Promise<boolean> {
    if (!stream) return false;
    try {
      const track = stream.getVideoTracks()[0];
      await (track as any).applyConstraints({
        advanced: [{ torch: enable }],
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Fast detection using native BarcodeDetector if supported by the browser engine
   */
  async detectWithNative(videoEl: HTMLVideoElement): Promise<ScannedBarcodeResult | null> {
    if (!this.isNativeDetectorSupported || !this.nativeDetector) return null;
    try {
      if (videoEl.readyState >= 2) {
        const barcodes = await this.nativeDetector.detect(videoEl);
        if (barcodes && barcodes.length > 0) {
          const raw = barcodes[0].rawValue;
          if (raw) {
            const clean = this.cleanBarcode(raw);
            return {
              code: clean,
              format: barcodes[0].format?.toUpperCase() || 'BARCODE',
              timestamp: Date.now(),
            };
          }
        }
      }
    } catch {
      // Fall back to ZXing
    }
    return null;
  }

  /**
   * Normalizes barcode string: preserves all leading zeros, trims whitespace, never casts to number
   */
  cleanBarcode(raw: string): string {
    if (!raw) return '';
    return raw.trim();
  }

  /**
   * Identifies the barcode symbology family based on standard retail formats
   */
  identifyFormat(code: string): string {
    if (!code) return 'Unknown';
    const isDigitsOnly = /^\d+$/.test(code);

    if (isDigitsOnly) {
      if (code.length === 13) return 'EAN-13';
      if (code.length === 12) return 'UPC-A';
      if (code.length === 8) return 'EAN-8';
      if (code.length === 6) return 'UPC-E';
      if (code.length === 14) return 'ITF-14';
    }

    if (/^[0-9A-Z\-.$/+% ]+$/.test(code) && code.length >= 3 && code.length <= 43) {
      return 'Code-39';
    }

    if (/^[\x00-\x7F]+$/.test(code)) {
      return 'Code-128';
    }

    return 'Barcode';
  }

  /**
   * Validates standard EAN-13 or UPC-A modulo-10 checksum
   */
  validateChecksum(code: string): { valid: boolean; format: string } {
    if (!/^\d+$/.test(code)) {
      return { valid: true, format: this.identifyFormat(code) };
    }

    if (code.length === 13) {
      let sum = 0;
      for (let i = 0; i < 12; i++) {
        const digit = parseInt(code.charAt(i), 10);
        sum += i % 2 === 0 ? digit : digit * 3;
      }
      const checkDigit = (10 - (sum % 10)) % 10;
      const isValid = checkDigit === parseInt(code.charAt(12), 10);
      return { valid: isValid, format: 'EAN-13' };
    }

    if (code.length === 12) {
      let sum = 0;
      for (let i = 0; i < 11; i++) {
        const digit = parseInt(code.charAt(i), 10);
        sum += i % 2 === 0 ? digit * 3 : digit;
      }
      const checkDigit = (10 - (sum % 10)) % 10;
      const isValid = checkDigit === parseInt(code.charAt(11), 10);
      return { valid: isValid, format: 'UPC-A' };
    }

    if (code.length === 8) {
      let sum = 0;
      for (let i = 0; i < 7; i++) {
        const digit = parseInt(code.charAt(i), 10);
        sum += i % 2 === 0 ? digit * 3 : digit;
      }
      const checkDigit = (10 - (sum % 10)) % 10;
      const isValid = checkDigit === parseInt(code.charAt(7), 10);
      return { valid: isValid, format: 'EAN-8' };
    }

    return { valid: true, format: this.identifyFormat(code) };
  }

  /**
   * Plays a crisp retail pos beep and triggers haptic vibration
   */
  playFeedback(soundEnabled = true): void {
    if (navigator.vibrate) {
      navigator.vibrate(100);
    }

    if (!soundEnabled) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        if (!this.audioCtx || this.audioCtx.state === 'suspended') {
          this.audioCtx = new AudioCtx();
        }
        const ctx = this.audioCtx;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(1600, now);
        osc.frequency.exponentialRampToValueAtTime(1900, now + 0.08);

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.1);
      }
    } catch {
      // Browser autoplay policy
    }
  }

  /**
   * Starts a high-performance scanner session with automatic hardware acceleration,
   * ZXing fallback with 1D product barcode optimization, autofocus, status updates,
   * and clean lifecycle management.
   */
  async startSession(config: ScannerSessionConfig): Promise<ScannerSession> {
    let currentStream: MediaStream | null = null;
    let zxingControls: IScannerControls | null = null;
    let nativeInterval: any = null;
    let isStopped = false;
    let isLocked = false;
    const soundEnabled = config.soundEnabled !== false;

    config.onStatusChange?.('camera_starting', 'Camera starting...');

    const startWithDevice = async (deviceId?: string) => {
      // Clean up previous stream and controls if switching or restarting
      if (zxingControls) {
        zxingControls.stop();
        zxingControls = null;
      }
      if (nativeInterval) {
        clearInterval(nativeInterval);
        nativeInterval = null;
      }
      if (currentStream) {
        currentStream.getTracks().forEach((t) => t.stop());
        currentStream = null;
      }

      currentStream = await this.requestCameraStream(deviceId, config.preferRear);
      config.videoElement.srcObject = currentStream;
      await config.videoElement.play();

      config.onStatusChange?.('scanning', 'Place the complete barcode inside the scanning area. Keep the camera steady and ensure the barcode is well lit.');

      const handleSuccessfulHit = (rawCode: string, formatName: string) => {
        if (isStopped || isLocked) return;
        const clean = this.cleanBarcode(rawCode);
        if (!clean) return;

        isLocked = true;
        this.playFeedback(soundEnabled);
        const identifiedFormat = this.identifyFormat(clean);
        const finalFormat = formatName && formatName !== 'BARCODE' ? formatName : identifiedFormat;

        config.onStatusChange?.('detected', `Barcode detected successfully: ${clean} (${finalFormat})`);
        config.onScan({
          code: clean,
          format: finalFormat,
          timestamp: Date.now(),
        });
      };

      // Engine 1: Native BarcodeDetector (Chrome Android / Windows Hardware Accelerated)
      if (this.isNativeDetectorSupported && this.nativeDetector) {
        nativeInterval = setInterval(async () => {
          if (isStopped || isLocked) return;
          try {
            const result = await this.detectWithNative(config.videoElement);
            if (result && result.code) {
              handleSuccessfulHit(result.code, result.format);
            }
          } catch {
            // Ignore native frame errors
          }
        }, 120);
      }

      // Engine 2: ZXing Multi-format Reader configured with TRY_HARDER
      const reader = this.createZxingReader();
      try {
        zxingControls = await reader.decodeFromVideoElement(config.videoElement, (result, err) => {
          if (isStopped || isLocked) return;
          if (result) {
            const raw = result.getText();
            const format = result.getBarcodeFormat() ? BarcodeFormat[result.getBarcodeFormat()] : 'BARCODE';
            handleSuccessfulHit(raw, format);
          }
        });
      } catch (zxingErr: any) {
        console.warn('ZXing reader error:', zxingErr);
      }
    };

    try {
      await startWithDevice(config.preferredDeviceId);
    } catch (err: any) {
      const msg = err?.message || 'Unable to access camera';
      if (msg.includes('permission')) {
        config.onStatusChange?.('permission_denied', 'Camera permission denied. Please allow camera access in browser settings.');
      } else if (msg.includes('detected') || msg.includes('found')) {
        config.onStatusChange?.('no_camera', 'No camera available on this device.');
      } else {
        config.onStatusChange?.('error', msg);
      }
      config.onError(msg);
      throw err;
    }

    const session: ScannerSession = {
      stop: () => {
        isStopped = true;
        if (nativeInterval) {
          clearInterval(nativeInterval);
          nativeInterval = null;
        }
        if (zxingControls) {
          zxingControls.stop();
          zxingControls = null;
        }
        if (currentStream) {
          currentStream.getTracks().forEach((t) => t.stop());
          currentStream = null;
        }
        if (config.videoElement) {
          config.videoElement.srcObject = null;
        }
        config.onStatusChange?.('stopped', 'Camera stopped.');
      },
      setTorch: async (enable: boolean) => {
        return this.setTorch(currentStream, enable);
      },
      isTorchSupported: () => {
        return this.supportsTorch(currentStream);
      },
      switchDevice: async (newDeviceId: string) => {
        isLocked = false;
        await startWithDevice(newDeviceId);
      },
      unlockScan: () => {
        isLocked = false;
        config.onStatusChange?.('scanning', 'Place the complete barcode inside the scanning area. Keep the camera steady and ensure the barcode is well lit.');
      },
    };

    return session;
  }
}
