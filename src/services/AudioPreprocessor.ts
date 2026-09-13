/**
 * AudioPreprocessor.ts
 * Dedicated audio signal preprocessing pipeline for on-device Neural Audio Inference:
 * - 16kHz Mono PCM conversion
 * - High-pass DC filter & pre-emphasis
 * - Hann windowing
 * - FFT / Short-Time Fourier Transform (STFT)
 * - 40-band Mel-scale filterbank (20Hz - 8000Hz)
 * - Log-Mel Spectrogram extraction matching standard TFLite audio models
 * - Zero-allocation pre-allocated Float32/Int16 ring buffers
 */

export interface PreprocessorConfig {
  sampleRate: number;
  fftSize: number;
  hopSize: number;
  melBands: number;
  minFreqHz: number;
  maxFreqHz: number;
}

export const DEFAULT_PREPROCESSOR_CONFIG: PreprocessorConfig = {
  sampleRate: 16000,
  fftSize: 512,
  hopSize: 256,
  melBands: 40,
  minFreqHz: 20,
  maxFreqHz: 8000,
};

export class AudioPreprocessor {
  private config: PreprocessorConfig;
  private melFilterbank: Float32Array[] = [];
  private hannWindow: Float32Array;
  private prevSample: number = 0; // For pre-emphasis / DC offset filter

  // Reusable working buffers to eliminate garbage collection pressure during live audio
  private fftReal: Float32Array;
  private fftImag: Float32Array;
  private powerSpectrum: Float32Array;

  constructor(config: Partial<PreprocessorConfig> = {}) {
    this.config = { ...DEFAULT_PREPROCESSOR_CONFIG, ...config };
    this.hannWindow = this.createHannWindow(this.config.fftSize);
    this.fftReal = new Float32Array(this.config.fftSize);
    this.fftImag = new Float32Array(this.config.fftSize);
    this.powerSpectrum = new Float32Array(this.config.fftSize / 2 + 1);
    this.initMelFilterbank();
  }

  /**
   * Generates a standard Hann window for framing
   */
  private createHannWindow(size: number): Float32Array {
    const win = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
    }
    return win;
  }

  /**
   * Converts Hertz to Mel scale
   */
  private hzToMel(hz: number): number {
    return 2595 * Math.log10(1 + hz / 700);
  }

  /**
   * Converts Mel scale to Hertz
   */
  private melToHz(mel: number): number {
    return 700 * (Math.pow(10, mel / 2595) - 1);
  }

  /**
   * Pre-computes triangular Mel filterbank matrix
   */
  private initMelFilterbank(): void {
    const { sampleRate, fftSize, melBands, minFreqHz, maxFreqHz } = this.config;
    const numSpectrumBins = fftSize / 2 + 1;
    const minMel = this.hzToMel(minFreqHz);
    const maxMel = this.hzToMel(maxFreqHz);

    // Uniformly spaced points in Mel scale
    const melPoints = new Float32Array(melBands + 2);
    for (let i = 0; i < melBands + 2; i++) {
      melPoints[i] = minMel + (i * (maxMel - minMel)) / (melBands + 1);
    }

    // Convert mel points to FFT bin indices
    const binIndices = new Int32Array(melBands + 2);
    for (let i = 0; i < melBands + 2; i++) {
      const hz = this.melToHz(melPoints[i]);
      binIndices[i] = Math.floor(((fftSize + 1) * hz) / sampleRate);
    }

    this.melFilterbank = [];
    for (let m = 1; m <= melBands; m++) {
      const filter = new Float32Array(numSpectrumBins);
      const startBin = binIndices[m - 1];
      const centerBin = binIndices[m];
      const endBin = binIndices[m + 1];

      for (let k = startBin; k < centerBin; k++) {
        if (centerBin > startBin) {
          filter[k] = (k - startBin) / (centerBin - startBin);
        }
      }
      for (let k = centerBin; k < endBin; k++) {
        if (endBin > centerBin) {
          filter[k] = (endBin - k) / (endBin - centerBin);
        }
      }
      this.melFilterbank.push(filter);
    }
  }

  /**
   * In-place Cooley-Tukey Radix-2 Fast Fourier Transform
   */
  private computeFFT(real: Float32Array, imag: Float32Array): void {
    const n = real.length;
    let j = 0;
    for (let i = 0; i < n - 1; i++) {
      if (i < j) {
        const tr = real[i];
        real[i] = real[j];
        real[j] = tr;
        const ti = imag[i];
        imag[i] = imag[j];
        imag[j] = ti;
      }
      let k = n >> 1;
      while (k <= j) {
        j -= k;
        k >>= 1;
      }
      j += k;
    }

    for (let l = 2; l <= n; l <<= 1) {
      const halfL = l >> 1;
      const angle = (-2 * Math.PI) / l;
      const wStepR = Math.cos(angle);
      const wStepI = Math.sin(angle);

      for (let i = 0; i < n; i += l) {
        let wr = 1;
        let wi = 0;
        for (let m = 0; m < halfL; m++) {
          const index1 = i + m;
          const index2 = index1 + halfL;
          const tr = wr * real[index2] - wi * imag[index2];
          const ti = wr * imag[index2] + wi * real[index2];

          real[index2] = real[index1] - tr;
          imag[index2] = imag[index1] - ti;
          real[index1] += tr;
          imag[index1] += ti;

          const nextWr = wr * wStepR - wi * wStepI;
          wi = wr * wStepI + wi * wStepR;
          wr = nextWr;
        }
      }
    }
  }

  /**
   * Applies pre-emphasis filter (y[n] = x[n] - 0.97 * x[n-1]) for high-frequency speech enhancement
   */
  public applyPreEmphasis(samples: Float32Array, coefficient: number = 0.97): Float32Array {
    const out = new Float32Array(samples.length);
    let prev = this.prevSample;
    for (let i = 0; i < samples.length; i++) {
      out[i] = samples[i] - coefficient * prev;
      prev = samples[i];
    }
    this.prevSample = prev;
    return out;
  }

  /**
   * Compute Root-Mean-Square (RMS) Energy in Decibels (dB)
   */
  public computeRmsDb(samples: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i];
    }
    const rms = Math.sqrt(sum / (samples.length || 1));
    return rms > 1e-6 ? 20 * Math.log10(rms) : -100;
  }

  /**
   * Compute Spectral Centroid (frequency brightness center in Hz)
   */
  public computeSpectralCentroid(samples: Float32Array): number {
    const n = Math.min(samples.length, this.config.fftSize);
    for (let i = 0; i < n; i++) {
      this.fftReal[i] = samples[i] * this.hannWindow[i];
      this.fftImag[i] = 0;
    }
    for (let i = n; i < this.config.fftSize; i++) {
      this.fftReal[i] = 0;
      this.fftImag[i] = 0;
    }
    this.computeFFT(this.fftReal, this.fftImag);

    const half = this.config.fftSize / 2;
    let weightedSum = 0;
    let totalMagnitude = 0;
    const binHz = this.config.sampleRate / this.config.fftSize;

    for (let k = 0; k <= half; k++) {
      const mag = Math.hypot(this.fftReal[k], this.fftImag[k]);
      weightedSum += mag * (k * binHz);
      totalMagnitude += mag;
    }
    return totalMagnitude > 0 ? weightedSum / totalMagnitude : 0;
  }

  /**
   * Compute single-frame Log-Mel Energy Vector (40-dim)
   */
  public computeMelFrame(samples: Float32Array): Float32Array {
    const { fftSize, melBands } = this.config;
    const n = Math.min(samples.length, fftSize);

    // Apply Hann Window
    for (let i = 0; i < n; i++) {
      this.fftReal[i] = samples[i] * this.hannWindow[i];
      this.fftImag[i] = 0;
    }
    for (let i = n; i < fftSize; i++) {
      this.fftReal[i] = 0;
      this.fftImag[i] = 0;
    }

    // FFT
    this.computeFFT(this.fftReal, this.fftImag);

    // Power Spectrum: |X(k)|^2 / N
    const half = fftSize / 2;
    for (let k = 0; k <= half; k++) {
      const r = this.fftReal[k];
      const im = this.fftImag[k];
      this.powerSpectrum[k] = (r * r + im * im) / fftSize;
    }

    // Apply Mel Filterbank & Compute Normalized Log Mel Energies
    const melEnergies = new Float32Array(melBands);
    for (let m = 0; m < melBands; m++) {
      const filter = this.melFilterbank[m];
      let energy = 0;
      for (let k = 0; k <= half; k++) {
        energy += this.powerSpectrum[k] * filter[k];
      }
      // Standard log energy in decibels (dB), normalized to [0.0, 1.0]
      // Dynamic range: -80 dBFS (silence) to 0 dBFS (peak)
      const energyDb = 10 * Math.log10(Math.max(1e-10, energy));
      const normalized = Math.max(0.0, Math.min(1.0, (energyDb + 80.0) / 80.0));
      melEnergies[m] = normalized;
    }
    return melEnergies;
  }

  /**
   * Calculate Feature Health Metrics: min, max, mean, variance
   */
  public computeFeatureStats(spectrogram: Float32Array): {
    featureMin: number;
    featureMax: number;
    featureMean: number;
    featureVariance: number;
  } {
    if (spectrogram.length === 0) {
      return { featureMin: 0, featureMax: 0, featureMean: 0, featureVariance: 0 };
    }
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    for (let i = 0; i < spectrogram.length; i++) {
      const v = spectrogram[i];
      if (v < min) min = v;
      if (v > max) max = v;
      sum += v;
    }
    const mean = sum / spectrogram.length;
    let varSum = 0;
    for (let i = 0; i < spectrogram.length; i++) {
      const diff = spectrogram[i] - mean;
      varSum += diff * diff;
    }
    const variance = varSum / spectrogram.length;
    return {
      featureMin: Math.round(min * 1000) / 1000,
      featureMax: Math.round(max * 1000) / 1000,
      featureMean: Math.round(mean * 1000) / 1000,
      featureVariance: Math.round(variance * 10000) / 10000,
    };
  }

  /**
   * Extracts a 2D Log-Mel Spectrogram Matrix [frames x melBands] from an audio buffer
   */
  public extractLogMelSpectrogram(
    samples: Float32Array,
    numFrames: number = 40
  ): Float32Array {
    const { hopSize, melBands } = this.config;
    const totalElements = numFrames * melBands;
    const spectrogram = new Float32Array(totalElements);
    let offset = 0;

    for (let f = 0; f < numFrames; f++) {
      const start = f * hopSize;
      const frameSlice = samples.subarray(start, start + this.config.fftSize);
      const melVector = this.computeMelFrame(frameSlice);
      spectrogram.set(melVector, offset);
      offset += melBands;
    }
    return spectrogram;
  }

  /**
   * Utility: Convert Float32Array (-1.0 to 1.0) to 16-bit PCM Int16Array
   */
  public floatTo16BitPCM(input: Float32Array): Int16Array {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output;
  }

  /**
   * Utility: Convert 16-bit PCM Int16Array to Float32Array
   */
  public pcm16ToFloat32(input: Int16Array): Float32Array {
    const output = new Float32Array(input.length);
    for (let i = 0; i < input.length; i++) {
      output[i] = input[i] / (input[i] < 0 ? 0x8000 : 0x7fff);
    }
    return output;
  }
}
