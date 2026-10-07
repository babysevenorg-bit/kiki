import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ImageBackground, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fallbackCatalog, loadCatalog, subscribeToCatalog, type Wallpaper } from '../lib/catalog';
import { downloadWallpaper, getOfflineWallpapers, removeOfflineWallpaper, type SavedWallpaper } from '../lib/offline';

const filters = ['For you', 'Nature', 'Abstract', 'Minimal'];
export default function HomeScreen() {
  const [activeFilter, setActiveFilter] = useState('For you');
  const [tab, setTab] = useState('Explore');
  const [query, setQuery] = useState('');
  const [saved, setSaved] = useState<string[]>([]);
  const [wallpapers, setWallpapers] = useState<Wallpaper[]>(fallbackCatalog);
  const [offline, setOffline] = useState<SavedWallpaper[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [online, setOnline] = useState(false);
  const router = useRouter();
  const refreshCatalog = async () => {
    try {
      const catalog = await loadCatalog();
      setWallpapers(catalog.wallpapers);
      setOnline(catalog.source === 'neon');
    } catch {
      setWallpapers(fallbackCatalog);
      setOnline(false);
    }
  };
  useEffect(() => {
    void refreshCatalog();
    void getOfflineWallpapers().then(setOffline);
    const unsubscribe = subscribeToCatalog(() => { void refreshCatalog(); });
    return unsubscribe;
  }, []);
  const visibleWallpapers = (tab === 'Downloads' ? offline : wallpapers).filter((wallpaper) => {
    const matchesFilter = activeFilter === 'For you' || wallpaper.category === activeFilter;
    const matchesSearch = (wallpaper.title + ' ' + wallpaper.creator + ' ' + wallpaper.category).toLowerCase().includes(query.trim().toLowerCase());
    return (tab === 'Downloads' || matchesFilter) && matchesSearch;
  });
  const handleDownload = async (wallpaper: Wallpaper) => {
    const existing = offline.find((item) => item.id === wallpaper.id);
    if (existing) {
      await removeOfflineWallpaper(wallpaper.id);
      setOffline((current) => current.filter((item) => item.id !== wallpaper.id));
      return;
    }
    setDownloadingId(wallpaper.id);
    try {
      const savedWallpaper = await downloadWallpaper(wallpaper);
      setOffline((current) => [savedWallpaper, ...current.filter((item) => item.id !== wallpaper.id)]);
    } catch {
      Alert.alert('Download failed', 'Check your connection and try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <View style={styles.topline}>
          <View>
            <Text style={styles.eyebrow}>YOUR LITTLE CORNER</Text>
            <Text style={styles.wordmark}>kiki<Text style={styles.dot}>.</Text></Text>
          </View>
          <Pressable style={styles.avatar} accessibilityLabel="Your profile"><Text style={styles.avatarText}>K</Text></Pressable>
        </View>

        <View style={styles.headlineRow}>
          <Text style={styles.headline}>{tab === 'Downloads' ? 'Your saved\nwallpapers.' : 'A fresh view,\nevery day.'}</Text>
          <Text style={styles.sparkle}>{tab === 'Downloads' ? '↓' : '✳'}</Text>
        </View>
        <Text style={styles.subhead}>{tab === 'Downloads' ? 'Ready to use, even when you are offline.' : 'Find a wallpaper that feels like you.'}</Text>

        {tab === 'Explore' && <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput value={query} onChangeText={setQuery} placeholder="Search HD wallpapers" placeholderTextColor="#9A968E" style={styles.searchInput} returnKeyType="search" />
          <Text style={styles.searchQuality}>HD</Text>
        </View>}

        {tab === 'Explore' && <View style={styles.filters}>
          {filters.map((filter) => (
            <Pressable key={filter} onPress={() => setActiveFilter(filter)} style={[styles.filter, activeFilter === filter && styles.filterActive]}>
              <Text style={[styles.filterText, activeFilter === filter && styles.filterTextActive]}>{filter}</Text>
            </Pressable>
          ))}
        </View>}

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{tab === 'Downloads' ? 'On this device' : 'Made for your mood'}</Text>
          <Text style={styles.seeAll}>{tab === 'Downloads' ? visibleWallpapers.length + ' SAVED' : online ? '● LIVE' : 'SAMPLE CATALOG'}</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
          {visibleWallpapers.map((wallpaper) => (
            <View key={wallpaper.id} style={styles.card} accessibilityLabel={'Preview ' + wallpaper.title}>
              <ImageBackground source={{ uri: ('localUri' in wallpaper ? wallpaper.localUri : undefined) || wallpaper.previewUrl }} style={styles.art} imageStyle={styles.artImage}>
                <View style={styles.artShade} />
                <View style={styles.artTop}><Text style={styles.artTag}>HD  ·  {wallpaper.tag}</Text><Pressable onPress={() => setSaved((current) => current.includes(wallpaper.id) ? current.filter((item) => item !== wallpaper.id) : [...current, wallpaper.id])} style={styles.heartButton}><Text style={[styles.heart, saved.includes(wallpaper.id) && styles.heartSaved]}>{saved.includes(wallpaper.id) ? '♥' : '♡'}</Text></Pressable></View>
                <View style={styles.previewClock}><Text style={styles.clockTime}>09:41</Text><Text style={styles.clockDate}>MONDAY · OCT 07</Text></View>
              </ImageBackground>
              <View style={styles.cardCaption}><View><Text style={styles.wallTitle}>{wallpaper.title}</Text><Text style={styles.byline}>by {wallpaper.creator}</Text></View><Pressable disabled={downloadingId === wallpaper.id} onPress={() => { void handleDownload(wallpaper); }} style={[styles.downloadButton, offline.some((item) => item.id === wallpaper.id) && styles.downloadedButton]}>{downloadingId === wallpaper.id ? <ActivityIndicator size="small" color="#706E66" /> : <Text style={styles.download}>{offline.some((item) => item.id === wallpaper.id) ? '✓' : '↓'}</Text>}</Pressable></View>
            </View>
          ))}
        </ScrollView>

        {visibleWallpapers.length === 0 && <View style={styles.emptyState}><Text style={styles.emptyTitle}>{tab === 'Downloads' ? 'Your offline library is empty' : 'No wallpapers found'}</Text><Text style={styles.emptyCopy}>{tab === 'Downloads' ? 'Download a wallpaper from Explore and it will be ready here.' : 'Try a different search or choose another category.'}</Text></View>}

        {tab === 'Explore' && <View style={styles.offlineBanner}>
          <View style={styles.offlineIcon}><Text style={styles.offlineIconText}>↓</Text></View>
          <View style={styles.offlineCopy}><Text style={styles.offlineTitle}>Your saved wallpapers go anywhere</Text><Text style={styles.offlineHint}>Download once, enjoy offline.</Text></View>
          <Text style={styles.arrow}>›</Text>
        </View>}

        {tab === 'Explore' && <Pressable style={styles.toolsBanner} onPress={() => router.push('/tools')}>
          <View style={styles.toolsMark}><Text style={styles.toolsMarkText}>◷</Text></View>
          <View style={styles.offlineCopy}><Text style={styles.offlineTitle}>Wallpaper rotation</Text><Text style={styles.offlineHint}>Make a slideshow from up to 8 images</Text></View>
          <Text style={styles.arrow}>›</Text>
        </Pressable>}

        {tab === 'Explore' && <Pressable style={styles.lockscreenBanner} onPress={() => router.push('/lockscreen')}>
          <View style={styles.lockscreenMark}><Text style={styles.lockscreenMarkText}>✦</Text></View>
          <View style={styles.offlineCopy}><Text style={styles.offlineTitle}>Kiki on your lock screen</Text><Text style={styles.offlineHint}>A glance, a reminder, a little more you</Text></View>
          <Text style={styles.arrow}>›</Text>
        </Pressable>}
      </ScrollView>

      <View style={styles.nav}>
        {[[ 'Explore', '⌂' ], [ 'Downloads', '↓' ], [ 'Tools', '◷' ]].map(([label, icon]) => (
          <Pressable key={label} onPress={() => { if (label === 'Tools') router.push('/tools'); else setTab(label); }} style={styles.navItem}>
            <Text style={[styles.navIcon, tab === label && styles.navSelected]}>{icon}</Text>
            <Text style={[styles.navLabel, tab === label && styles.navSelected]}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FBF9F5' }, page: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 22 },
  topline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, eyebrow: { fontSize: 9, letterSpacing: 2.2, color: '#8F8A82', fontWeight: '700' },
  wordmark: { color: '#25251F', fontSize: 34, fontWeight: '800', letterSpacing: -2 }, dot: { color: '#E98262' }, avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#EEE8DF', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#4E473F', fontSize: 16, fontWeight: '700' },
  headlineRow: { marginTop: 27, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }, headline: { color: '#24251F', fontSize: 35, lineHeight: 39, fontWeight: '700', letterSpacing: -1.4 }, sparkle: { color: '#E98262', fontSize: 35, marginRight: 12, marginTop: 6 }, subhead: { color: '#858078', fontSize: 14, marginTop: 8 },
  filters: { flexDirection: 'row', marginTop: 25, gap: 8 }, filter: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: '#F0EDE7' }, filterActive: { backgroundColor: '#292A24' }, filterText: { fontSize: 12, color: '#79766F', fontWeight: '600' }, filterTextActive: { color: '#FFFDF9' },
  searchBox: { height: 48, borderRadius: 15, backgroundColor: '#F0EDE7', marginTop: 18, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center' }, searchIcon: { fontSize: 24, color: '#706E66', marginRight: 8 }, searchInput: { flex: 1, color: '#292A24', fontSize: 13 }, searchQuality: { color: '#A96F58', fontSize: 10, fontWeight: '800', borderWidth: 1, borderColor: '#DCC3B5', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, marginBottom: 14 }, sectionTitle: { color: '#292A24', fontSize: 17, fontWeight: '700' }, seeAll: { color: '#9B7567', fontSize: 9, fontWeight: '800', letterSpacing: 0.7 }, cards: { gap: 14, paddingRight: 22 },
  card: { width: 210 }, art: { height: 270, borderRadius: 20, overflow: 'hidden', justifyContent: 'space-between', padding: 13, backgroundColor: '#A69F92' }, artImage: { borderRadius: 20 }, artShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,18,16,0.18)' }, artTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, artTag: { color: 'rgba(255,255,255,0.94)', fontSize: 8, fontWeight: '800', letterSpacing: 1.4 }, heart: { color: 'white', fontSize: 22, lineHeight: 24 }, previewClock: { alignItems: 'center', marginBottom: 11 }, clockTime: { color: 'rgba(255,255,255,0.9)', fontSize: 31, fontWeight: '300', letterSpacing: -1 }, clockDate: { color: 'rgba(255,255,255,0.75)', fontSize: 7, letterSpacing: 1.4, marginTop: 3 },
  cardCaption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 11, paddingHorizontal: 2 }, wallTitle: { color: '#303029', fontSize: 13, fontWeight: '700' }, byline: { color: '#938E85', fontSize: 10, marginTop: 3 }, download: { color: '#706E66', fontSize: 17, fontWeight: '700' }, heartButton: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(20,20,20,0.24)' }, heartSaved: { color: '#FFDBCB' }, downloadButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F0EDE7', alignItems: 'center', justifyContent: 'center' }, downloadedButton: { backgroundColor: '#E5EEE5' },
  emptyState: { borderRadius: 18, padding: 22, backgroundColor: '#F1EDE5', marginTop: 5 }, emptyTitle: { color: '#373831', fontSize: 14, fontWeight: '700' }, emptyCopy: { color: '#858078', fontSize: 11, lineHeight: 17, marginTop: 5 },
  offlineBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1EDE5', borderRadius: 16, padding: 14, marginTop: 24 }, offlineIcon: { width: 38, height: 38, backgroundColor: '#FBF9F5', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, offlineIconText: { color: '#B2755F', fontSize: 21, fontWeight: '600' }, offlineCopy: { flex: 1, marginLeft: 12 }, offlineTitle: { color: '#36352E', fontSize: 12, fontWeight: '700' }, offlineHint: { color: '#8E897F', fontSize: 10, marginTop: 3 }, arrow: { color: '#8E897F', fontSize: 25, paddingHorizontal: 4 },
  toolsBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8EEE8', borderRadius: 16, padding: 14, marginTop: 10 }, toolsMark: { width: 38, height: 38, backgroundColor: '#F7FAF5', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, toolsMarkText: { color: '#60856B', fontSize: 20 },
  lockscreenBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFE7E1', borderRadius: 16, padding: 14, marginTop: 10 }, lockscreenMark: { width: 38, height: 38, backgroundColor: '#FBF7F3', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, lockscreenMarkText: { color: '#B2755F', fontSize: 18 },
  nav: { flexDirection: 'row', borderTopColor: '#EEEAE3', borderTopWidth: 1, backgroundColor: '#FBF9F5', paddingTop: 9, paddingBottom: 7 }, navItem: { flex: 1, alignItems: 'center', gap: 3 }, navIcon: { color: '#A6A198', fontSize: 20, height: 22 }, navLabel: { color: '#A6A198', fontSize: 9, fontWeight: '600' }, navSelected: { color: '#D57B60' },
});
