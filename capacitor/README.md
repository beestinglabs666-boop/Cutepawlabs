# CutePaw Labs — App Store Setup

## Prerequisites
- macOS (required for iOS builds)
- Xcode 15+ installed
- Android Studio installed
- Node 18+

## One-time setup

```bash
# From project root
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
npm install @capacitor/splash-screen @capacitor/status-bar

# Copy capacitor config to project root
cp capacitor/capacitor.config.json ./capacitor.config.json

# Build the web app first
npm run build

# Add native platforms
npx cap add ios
npx cap add android
```

## Every time you update the app

```bash
npm run build          # rebuild web app
npx cap sync           # copy dist/ into native projects
```

## Run on device / simulator

```bash
npx cap open ios       # opens Xcode — run from there
npx cap open android   # opens Android Studio — run from there
```

## App Store submission checklist

### iOS (App Store Connect)
- [ ] Bundle ID: com.cutepawlabs.app
- [ ] Set version + build number in Xcode
- [ ] Add app icons (1024×1024 + all sizes) — use https://appicon.co
- [ ] Add splash screen assets
- [ ] Set NSCameraUsageDescription in Info.plist: "Take a photo of your pet to create a sticker"
- [ ] Set NSPhotoLibraryUsageDescription: "Upload a photo of your pet"
- [ ] Archive → Distribute → App Store Connect
- [ ] Fill in App Store listing (description, screenshots, keywords)

### Android (Google Play Console)
- [ ] Package name: com.cutepawlabs.app
- [ ] Generate signed APK / AAB in Android Studio
- [ ] Add app icons + feature graphic
- [ ] Fill in Play Store listing
- [ ] Upload AAB to Play Console → Production

## Push notifications (future)
Add @capacitor/push-notifications when ready for:
- "Your sticker is ready!" after generation
- "Your order shipped!" when Printful dispatches
