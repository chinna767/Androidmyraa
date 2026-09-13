import { ScreenFrameData } from '../../types';

export class ScreenFrameProcessor {
  private static instance: ScreenFrameProcessor | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  private constructor() {
    if (typeof document !== 'undefined') {
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    }
  }

  public static getInstance(): ScreenFrameProcessor {
    if (!ScreenFrameProcessor.instance) {
      ScreenFrameProcessor.instance = new ScreenFrameProcessor();
    }
    return ScreenFrameProcessor.instance;
  }

  /**
   * Process and compress a video frame into an optimized ScreenFrameData object for Gemini.
   */
  public processVideoFrame(video: HTMLVideoElement, maxDimension = 1280): ScreenFrameData | null {
    if (!this.canvas || !this.ctx || video.videoWidth === 0 || video.videoHeight === 0) {
      return null;
    }

    const srcWidth = video.videoWidth;
    const srcHeight = video.videoHeight;

    // Calculate scaled dimensions maintaining aspect ratio
    let targetWidth = srcWidth;
    let targetHeight = srcHeight;

    if (srcWidth > maxDimension || srcHeight > maxDimension) {
      if (srcWidth > srcHeight) {
        targetWidth = maxDimension;
        targetHeight = Math.round((srcHeight * maxDimension) / srcWidth);
      } else {
        targetHeight = maxDimension;
        targetWidth = Math.round((srcWidth * maxDimension) / srcHeight);
      }
    }

    this.canvas.width = targetWidth;
    this.canvas.height = targetHeight;

    // Draw video frame to canvas
    this.ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

    // Compute perceptual hash for change detection
    const frameHash = this.computePerceptualHash(this.canvas, this.ctx);

    // Export as optimized JPEG base64 (quality 0.85)
    const mimeType = 'image/jpeg';
    const dataUrl = this.canvas.toDataURL(mimeType, 0.85);
    const rawBase64 = dataUrl.replace(/^data:image\/[a-zA-Z]+;base64,/, '');

    return {
      dataUrl,
      rawBase64,
      mimeType,
      width: targetWidth,
      height: targetHeight,
      timestamp: Date.now(),
      frameHash,
    };
  }

  /**
   * Fast 8x8 average perceptual hash for detecting whether the screen has changed.
   */
  public computePerceptualHash(sourceCanvas: HTMLCanvasElement, sourceCtx: CanvasRenderingContext2D): string {
    try {
      const hashCanvas = document.createElement('canvas');
      hashCanvas.width = 8;
      hashCanvas.height = 8;
      const hashCtx = hashCanvas.getContext('2d');
      if (!hashCtx) return `${Date.now()}`;

      hashCtx.drawImage(sourceCanvas, 0, 0, 8, 8);
      const imgData = hashCtx.getImageData(0, 0, 8, 8).data;

      // Compute average luminance
      let totalLum = 0;
      const lums: number[] = [];
      for (let i = 0; i < imgData.length; i += 4) {
        const lum = imgData[i] * 0.299 + imgData[i + 1] * 0.587 + imgData[i + 2] * 0.114;
        lums.push(lum);
        totalLum += lum;
      }
      const avgLum = totalLum / 64;

      // 64-bit binary hash represented in 16 hex chars
      let hash = '';
      let currentNibble = 0;
      for (let i = 0; i < 64; i++) {
        const bit = lums[i] >= avgLum ? 1 : 0;
        currentNibble = (currentNibble << 1) | bit;
        if ((i + 1) % 4 === 0) {
          hash += currentNibble.toString(16);
          currentNibble = 0;
        }
      }
      return hash;
    } catch {
      return `${Date.now()}`;
    }
  }

  /**
   * Calculates difference (Hamming distance) between two 16-hex frame hashes.
   * Returns a normalized difference value between 0.0 (identical) and 1.0 (completely different).
   */
  public calculateHashDifference(hash1?: string, hash2?: string): number {
    if (!hash1 || !hash2 || hash1.length !== hash2.length) return 1.0;
    let diffBits = 0;
    for (let i = 0; i < hash1.length; i++) {
      const v1 = parseInt(hash1[i], 16);
      const v2 = parseInt(hash2[i], 16);
      let xor = v1 ^ v2;
      while (xor > 0) {
        diffBits += xor & 1;
        xor >>= 1;
      }
    }
    return diffBits / 64;
  }
}

export const screenFrameProcessor = ScreenFrameProcessor.getInstance();
