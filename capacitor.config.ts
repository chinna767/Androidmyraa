import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ai.myraa.voice',
  appName: 'MYRAA',
  webDir: 'dist',
  server: {
    url: 'https://androidmyraa.onrender.com',
    cleartext: false
  }
};

export default config;
