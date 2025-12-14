import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.posbakum.app',
  appName: 'Antrian Pintar LBH Nusantara Sepakat',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    // Basic plugin configuration if needed in the future
  }
};

export default config;
