import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'rhythm.riot.babylovebabylove.com',
  appName: 'Rhythm Riot',
  webDir: 'dist',
  backgroundColor: '#05060f',
  android: {
    backgroundColor: '#05060f',
    // Rhythm games are unusable in landscape-lock scenarios on some devices;
    // portrait is enforced in the Android manifest, not here.
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      // Our own animated intro (Section 7) replaces the native splash quickly.
      launchShowDuration: 300,
      backgroundColor: '#05060f',
      showSpinner: false,
    },
  },
};

export default config;
