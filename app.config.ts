import type { ExpoConfig } from 'expo/config'

// ビルドは2系統（正本 §0.10「バックエンドの分離」・§12-7）。
//   personal … 本番バックエンド。本人の端末にしか入れない。配布しない。
//   demo     … デモ環境のみ。公開する APK はこちら。**本番に触れる経路はゼロ。**
// どちらを読むかは APP_PROFILE と、渡された EXPO_PUBLIC_* の値で決まる（このファイルは値を持たない）。
// 値は .env.demo / .env.prod（いずれも git 管理外）から環境変数として渡す。
const profile = process.env.APP_PROFILE === 'personal' ? 'personal' : 'demo'

const config: ExpoConfig = {
  name: profile === 'personal' ? 'Grow' : 'Grow (demo)',
  slug: 'grow-mobile',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'growmobile',
  userInterfaceStyle: 'dark',
  ios: { supportsTablet: false, bundleIdentifier: 'jp.growapp.mobile' },
  android: {
    package: 'jp.growapp.mobile',
    adaptiveIcon: {
      backgroundColor: '#0b0f18',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: { bundler: 'metro', favicon: './assets/favicon.png' },
  plugins: ['expo-router', 'expo-status-bar', 'expo-secure-store'],
  experiments: { typedRoutes: true },
  extra: { profile },
}

export default config
