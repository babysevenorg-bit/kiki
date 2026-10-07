const fs = require('node:fs');
const path = require('node:path');
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');

const packageName = 'com.kiki.wallpaper';
const serviceName = '.KikiWallpaperService';

module.exports = function withKikiWallpaper(config) {
  config = withAndroidManifest(config, (mod) => {
    const app = mod.modResults.manifest.application[0];
    app.service = (app.service || []).filter((service) => service.$?.['android:name'] !== serviceName);
    app.service.push({
      $: {
        'android:name': serviceName,
        'android:label': 'Kiki',
        'android:permission': 'android.permission.BIND_WALLPAPER',
        'android:exported': 'true',
      },
      'intent-filter': [{ action: [{ $: { 'android:name': 'android.service.wallpaper.WallpaperService' } }] }],
      'meta-data': [{ $: { 'android:name': 'android.service.wallpaper', 'android:resource': '@xml/kiki_wallpaper' } }],
    });
    return mod;
  });

  return withDangerousMod(config, ['android', async (mod) => {
    const root = mod.modRequest.platformProjectRoot;
    const javaDir = path.join(root, 'app/src/main/java', ...packageName.split('.'));
    const xmlDir = path.join(root, 'app/src/main/res/xml');
    fs.mkdirSync(javaDir, { recursive: true });
    fs.mkdirSync(xmlDir, { recursive: true });
    fs.copyFileSync(path.join(__dirname, 'KikiWallpaperService.kt'), path.join(javaDir, 'KikiWallpaperService.kt'));
    fs.writeFileSync(path.join(xmlDir, 'kiki_wallpaper.xml'), '<wallpaper xmlns:android="http://schemas.android.com/apk/res/android" android:description="@string/app_name" android:thumbnail="@mipmap/ic_launcher" />');
    return mod;
  }]);
};
