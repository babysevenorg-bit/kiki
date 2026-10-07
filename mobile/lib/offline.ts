import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import type { Wallpaper } from './catalog';

const STORAGE_KEY = 'kiki.offline.v1';
export type SavedWallpaper = Wallpaper & { localUri: string };

export async function getOfflineWallpapers(): Promise<SavedWallpaper[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) as SavedWallpaper[] : [];
}

export async function downloadWallpaper(wallpaper: Wallpaper): Promise<SavedWallpaper> {
  if (!FileSystem.documentDirectory) throw new Error('Local storage is unavailable');
  const target = FileSystem.documentDirectory + 'wallpapers/' + wallpaper.id + '.jpg';
  await FileSystem.makeDirectoryAsync(FileSystem.documentDirectory + 'wallpapers/', { intermediates: true });
  const result = await FileSystem.downloadAsync(wallpaper.downloadUrl, target);
  const saved = { ...wallpaper, localUri: result.uri };
  const current = await getOfflineWallpapers();
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([saved, ...current.filter((item) => item.id !== wallpaper.id)]));
  return saved;
}

export async function removeOfflineWallpaper(id: string) {
  const current = await getOfflineWallpapers();
  const target = current.find((item) => item.id === id);
  if (target) await FileSystem.deleteAsync(target.localUri, { idempotent: true });
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current.filter((item) => item.id !== id)));
}
