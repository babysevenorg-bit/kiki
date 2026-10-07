import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';

export async function openAndroidWallpaperPicker(localUris: string[], intervalMs: number) {
  if (!FileSystem.documentDirectory) throw new Error('Local storage is unavailable');
  const configPath = FileSystem.documentDirectory + 'kiki-wallpaper-playlist.json';
  await FileSystem.writeAsStringAsync(configPath, JSON.stringify({ localUris, intervalMs }));
  return IntentLauncher.startActivityAsync('android.service.wallpaper.LIVE_WALLPAPER_CHOOSER');
}
