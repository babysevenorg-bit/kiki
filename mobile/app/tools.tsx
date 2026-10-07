import { useEffect, useState } from 'react';
import { Alert, ImageBackground, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { getOfflineWallpapers, type SavedWallpaper } from '../lib/offline';
import { openAndroidWallpaperPicker } from '../lib/android-wallpaper';

const intervals = ['1 sec', '5 sec', '30 sec', '1 min', '1 hour', 'Daily'];
const intervalValue: Record<string, number> = { '1 sec': 1000, '5 sec': 5000, '30 sec': 30000, '1 min': 60000, '1 hour': 3600000, Daily: 86400000 };

export default function ToolsScreen() {
  const router = useRouter();
  const [library, setLibrary] = useState<SavedWallpaper[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [interval, setInterval] = useState('1 sec');
  useEffect(() => { void getOfflineWallpapers().then(setLibrary); }, []);
  function toggleImage(id: string) {
    setSelected((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : current.length < 8 ? [...current, id] : current);
  }
  async function startSlideshow() {
    const chosen = library.filter((item) => selected.includes(item.id));
    if (chosen.length < 2) {
      Alert.alert('Choose at least two', 'Download and select at least two wallpapers for a slideshow.');
      return;
    }
    if (Platform.OS !== 'android') {
      Alert.alert('iPhone wallpaper setup', 'Save these images to Photos, then use iOS Wallpaper settings or a Shortcuts automation to switch between them.');
      return;
    }
    try {
      await openAndroidWallpaperPicker(chosen.map((item) => item.localUri), intervalValue[interval]);
    } catch {
      Alert.alert('Could not open wallpaper picker', 'Try again from your Android device settings.');
    }
  }
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹  Kiki tools</Text></Pressable>
        <Text style={styles.kicker}>MAKE IT YOURS</Text>
        <Text style={styles.title}>Wallpaper{"\n"}rotation</Text>
        <Text style={styles.intro}>Choose up to 8 wallpapers and let your phone cycle through them.</Text>
        <View style={styles.panel}>
          <View style={styles.panelTop}><View><Text style={styles.panelTitle}>Your slideshow</Text><Text style={styles.panelSub}>{selected.length} of 8 selected · downloaded images</Text></View><Text style={styles.count}>{selected.length}/8</Text></View>
          <View style={styles.thumbRow}>
            {library.filter((item) => selected.includes(item.id)).map((item) => <ImageBackground key={item.id} source={{ uri: item.localUri }} style={styles.thumb} imageStyle={styles.thumbImage} />)}
            {selected.length === 0 && <Text style={styles.muted}>Pick wallpapers below to begin.</Text>}
          </View>
        </View>
        <Text style={styles.section}>Change wallpaper every</Text>
        <View style={styles.intervalWrap}>{intervals.map((item) => <Pressable key={item} onPress={() => setInterval(item)} style={[styles.interval, interval === item && styles.intervalActive]}><Text style={[styles.intervalText, interval === item && styles.intervalTextActive]}>{item}</Text></Pressable>)}</View>
        <View style={styles.note}><Text style={styles.noteText}>Android Kiki live wallpaper cycles through your downloaded images while the wallpaper is visible. iPhone setup uses Photos, Wallpaper settings, or a user-created Shortcuts automation.</Text></View>
        <Pressable onPress={() => { void startSlideshow(); }} style={styles.button}><Text style={styles.buttonText}>Set up on this phone</Text></Pressable>
        <Text style={styles.demo}>Android opens the system wallpaper picker so you can confirm Kiki and choose Home or Lock screen.</Text>
        <View style={styles.sectionRow}><Text style={styles.section}>Choose images</Text><Text style={styles.limit}>Up to {8 - selected.length} more</Text></View>
        {library.length === 0 ? <View style={styles.emptyLibrary}><Text style={styles.panelTitle}>Your downloaded library is empty</Text><Text style={styles.panelSub}>Download wallpapers first, then come back to build a rotation.</Text></View> : <View style={styles.grid}>
          {library.map((item) => {
            const checked = selected.includes(item.id);
            return <Pressable key={item.id} onPress={() => toggleImage(item.id)} style={styles.tile}>
              <ImageBackground source={{ uri: item.localUri }} style={styles.art} imageStyle={styles.artImage}><Text style={styles.hd}>HD</Text><View style={[styles.check, checked && styles.checked]}><Text style={styles.checkText}>{checked ? '✓' : '+'}</Text></View></ImageBackground>
              <Text style={styles.name} numberOfLines={1}>{item.title}</Text>
            </Pressable>;
          })}
        </View>}
        <Pressable onPress={() => router.back()}><Text style={styles.link}>Browse and download wallpapers  ›</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FBF9F5' }, page: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 36 },
  back: { color: '#827D74', fontSize: 14, fontWeight: '600', marginBottom: 25 }, kicker: { color: '#9B7567', fontSize: 9, letterSpacing: 2, fontWeight: '800' },
  title: { color: '#24251F', fontSize: 36, lineHeight: 39, letterSpacing: -1.4, fontWeight: '700', marginTop: 7 }, intro: { color: '#858078', fontSize: 13, lineHeight: 19, marginTop: 9 },
  panel: { backgroundColor: '#F1EDE5', padding: 15, borderRadius: 18, marginTop: 22 }, panelTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  panelTitle: { fontSize: 14, color: '#33332C', fontWeight: '700' }, panelSub: { fontSize: 10, color: '#8E897F', marginTop: 4 }, count: { color: '#6F766B', fontWeight: '700', fontSize: 10, backgroundColor: '#FBF9F5', padding: 8, borderRadius: 9 },
  thumbRow: { flexDirection: 'row', gap: 8, marginTop: 14, minHeight: 51, alignItems: 'center' }, thumb: { width: 40, height: 51, borderRadius: 9, overflow: 'hidden' }, thumbImage: { borderRadius: 9 }, muted: { color: '#8E897F', fontSize: 11 },
  section: { color: '#292A24', fontSize: 15, fontWeight: '700', marginTop: 23 }, intervalWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }, interval: { borderRadius: 18, paddingVertical: 9, paddingHorizontal: 13, backgroundColor: '#F0EDE7' }, intervalActive: { backgroundColor: '#292A24' }, intervalText: { fontSize: 11, color: '#79766F', fontWeight: '600' }, intervalTextActive: { color: '#FFFDF9' },
  note: { backgroundColor: '#EAF0EA', borderRadius: 14, padding: 13, marginTop: 18 }, noteText: { color: '#657366', fontSize: 10, lineHeight: 15 },
  button: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#D57B60', height: 49, borderRadius: 15, marginTop: 16 }, buttonText: { color: '#FFFDF9', fontSize: 13, fontWeight: '700' }, demo: { textAlign: 'center', color: '#969188', fontSize: 9, lineHeight: 14, marginTop: 8 }, emptyLibrary: { backgroundColor: '#F1EDE5', borderRadius: 15, padding: 15, marginTop: 12 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, limit: { color: '#9B7567', fontSize: 10, marginTop: 23, fontWeight: '700' }, grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 13 }, tile: { width: '23%', marginBottom: 13 },
  art: { height: 108, borderRadius: 12, overflow: 'hidden', justifyContent: 'space-between', padding: 7 }, artImage: { borderRadius: 12 }, hd: { color: 'white', fontSize: 7, fontWeight: '800', backgroundColor: '#FFFFFF55', alignSelf: 'flex-start', padding: 4, borderRadius: 5 }, check: { alignSelf: 'flex-end', width: 21, height: 21, borderRadius: 11, backgroundColor: '#0005', alignItems: 'center', justifyContent: 'center' }, checked: { backgroundColor: '#D57B60' }, checkText: { color: 'white', fontSize: 12, fontWeight: '700' }, name: { color: '#59574F', fontSize: 9, fontWeight: '600', marginTop: 6 }, link: { color: '#9B7567', fontSize: 12, fontWeight: '700', marginTop: 10, marginBottom: 15 },
});
