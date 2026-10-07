import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Alert, ImageBackground, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { isRunningInExpoGo } from 'expo';
import { fallbackCatalog } from '../lib/catalog';

const REMINDERS_KEY = 'kiki.lockscreen.reminders.v1';
const PREFERENCES_KEY = 'kiki.lockscreen.preferences.v1';
const reminders = [
  { label: '15 min', seconds: 15 * 60 },
  { label: '1 hour', seconds: 60 * 60 },
  { label: 'Tomorrow', seconds: 24 * 60 * 60 },
];

type Reminder = { id: string; text: string; dueAt: number };

export default function LockscreenScreen() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [scheduled, setScheduled] = useState<Reminder[]>([]);
  const [aiBrief, setAiBrief] = useState(true);
  const [quietHours, setQuietHours] = useState(true);
  const [busy, setBusy] = useState(false);
  const wallpaper = fallbackCatalog[2] ?? fallbackCatalog[0];

  useEffect(() => {
    void AsyncStorage.getItem(REMINDERS_KEY).then((raw) => {
      if (raw) setScheduled(JSON.parse(raw) as Reminder[]);
    });
    void AsyncStorage.getItem(PREFERENCES_KEY).then((raw) => {
      if (!raw) return;
      const preferences = JSON.parse(raw) as { aiBrief?: boolean; quietHours?: boolean };
      if (typeof preferences.aiBrief === 'boolean') setAiBrief(preferences.aiBrief);
      if (typeof preferences.quietHours === 'boolean') setQuietHours(preferences.quietHours);
    });
    if (Platform.OS === 'android' && !isRunningInExpoGo()) {
      void import('expo-notifications').then((Notifications) => Notifications.setNotificationChannelAsync('kiki-reminders', {
        name: 'Kiki reminders',
        description: 'Gentle reminders you choose to see on your lock screen.',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 120],
        lightColor: '#D57B60',
      }));
    }
  }, []);

  async function scheduleReminder(seconds: number) {
    const message = text.trim();
    if (!message) {
      Alert.alert('Add a reminder', 'Write a short note first, like “Take a stretch break.”');
      return;
    }
    if (Platform.OS === 'web') {
      Alert.alert('Use a phone for reminders', 'Local lock-screen reminders need the Kiki mobile app.');
      return;
    }
    if (isRunningInExpoGo()) {
      Alert.alert('Reminder preview', 'The lock-screen preview works in Expo Go. To schedule real reminders, open Kiki in its Android development build.');
      return;
    }
    setBusy(true);
    try {
      const Notifications = await import('expo-notifications');
      const now = Date.now();
      const target = new Date(now + seconds * 1000);
      const isQuietTime = quietHours && (target.getHours() >= 22 || target.getHours() < 8);
      if (isQuietTime) {
        if (target.getHours() >= 22) target.setDate(target.getDate() + 1);
        target.setHours(8, 0, 0, 0);
      }
      const deliverySeconds = Math.max(1, Math.ceil((target.getTime() - now) / 1000));
      const current = await Notifications.getPermissionsAsync();
      const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Notifications are off', 'Allow Kiki notifications in your phone settings to receive lock-screen reminders.');
        return;
      }
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'A small moment for you',
          body: message,
          data: { screen: '/lockscreen' },
          ...(Platform.OS === 'android' ? { channelId: 'kiki-reminders' } : {}),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: deliverySeconds,
        },
      });
      const next = [{ id, text: message, dueAt: now + deliverySeconds * 1000 }, ...scheduled];
      setScheduled(next);
      await AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(next));
      setText('');
      if (isQuietTime) Alert.alert('Quiet hours protected', 'Kiki will send this reminder at 8:00 AM.');
    } catch {
      Alert.alert('Could not schedule this reminder', 'Please try again from your phone.');
    } finally {
      setBusy(false);
    }
  }

  function savePreferences(next: { aiBrief: boolean; quietHours: boolean }) {
    setAiBrief(next.aiBrief);
    setQuietHours(next.quietHours);
    void AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(next));
  }

  async function removeReminder(item: Reminder) {
    if (!isRunningInExpoGo()) {
      const Notifications = await import('expo-notifications');
      await Notifications.cancelScheduledNotificationAsync(item.id).catch(() => {});
    }
    const next = scheduled.filter((entry) => entry.id !== item.id);
    setScheduled(next);
    await AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(next));
  }

  const dateLabel = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
  const timeLabel = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date());

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹  Kiki</Text></Pressable>
        <View style={styles.titleRow}>
          <View><Text style={styles.kicker}>YOUR PHONE, MORE YOU</Text><Text style={styles.title}>Lock screen</Text></View>
          <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveText}>STUDIO</Text></View>
        </View>
        <Text style={styles.intro}>A calmer glance at what matters. You choose what shows up.</Text>

        <View style={styles.previewFrame}>
          <ImageBackground source={{ uri: wallpaper.previewUrl }} style={styles.preview} imageStyle={styles.previewImage}>
            <View style={styles.scrim} />
            <View style={styles.previewTop}><Text style={styles.previewBrand}>kiki <Text style={styles.previewBrandDot}>✳</Text></Text><Text style={styles.previewStatus}>◉  82%</Text></View>
            <View style={styles.clockBlock}><Text style={styles.previewDate}>{dateLabel.toUpperCase()}</Text><Text style={styles.previewTime}>{timeLabel}</Text></View>
            {aiBrief && <View style={styles.glanceCard}>
              <View style={styles.glanceIcon}><Text style={styles.glanceIconText}>✦</Text></View>
              <View style={styles.glanceText}><Text style={styles.glanceLabel}>KIKI MOMENT</Text><Text style={styles.glanceTitle}>Make space for a fresh start.</Text></View>
              <Text style={styles.glanceArrow}>›</Text>
            </View>}
            <View style={styles.previewBottom}><View style={styles.previewButton}><Text style={styles.previewButtonText}>◉</Text></View><View style={styles.unlockLine} /><View style={styles.previewButton}><Text style={styles.previewButtonText}>⌕</Text></View></View>
          </ImageBackground>
        </View>
        <Text style={styles.previewCaption}>PREVIEW · YOUR PHONE CONTROLS WHAT IS VISIBLE</Text>

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Kiki at a glance</Text><Text style={styles.sectionMeta}>YOUR CHOICE</Text></View>
        <View style={styles.settingCard}>
          <View style={styles.settingIcon}><Text style={styles.settingIconText}>✦</Text></View>
          <View style={styles.settingCopy}><Text style={styles.settingTitle}>AI brief preview</Text><Text style={styles.settingSub}>Show the concept in your preview</Text></View>
          <Switch value={aiBrief} onValueChange={(value) => savePreferences({ aiBrief: value, quietHours })} trackColor={{ false: '#D9D4CB', true: '#D99B84' }} thumbColor={aiBrief ? '#FFFDF9' : '#FFFDF9'} />
        </View>
        <View style={styles.settingCard}>
          <View style={[styles.settingIcon, styles.settingIconSage]}><Text style={[styles.settingIconText, styles.sageText]}>☾</Text></View>
          <View style={styles.settingCopy}><Text style={styles.settingTitle}>Quiet hours</Text><Text style={styles.settingSub}>Move night reminders to 8:00 AM</Text></View>
          <Switch value={quietHours} onValueChange={(value) => savePreferences({ aiBrief, quietHours: value })} trackColor={{ false: '#D9D4CB', true: '#9FB09D' }} thumbColor="#FFFDF9" />
        </View>

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>A reminder, your way</Text><Text style={styles.sectionMeta}>ON THIS DEVICE</Text></View>
        <View style={styles.reminderCard}>
          <Text style={styles.reminderLabel}>WHAT SHOULD KIKI REMIND YOU?</Text>
          <TextInput value={text} onChangeText={setText} placeholder="Take a stretch break…" placeholderTextColor="#A19B91" style={styles.input} maxLength={100} returnKeyType="done" />
          <View style={styles.quickIdeas}>
            <Pressable onPress={() => setText('Take a slow breath and reset.')} style={styles.ideaChip}><Text style={styles.ideaChipText}>✦  Gentle reset</Text></Pressable>
            <Pressable onPress={() => setText('Look away from your screen and rest your eyes.')} style={styles.ideaChip}><Text style={styles.ideaChipText}>◌  Eye break</Text></Pressable>
          </View>
          <Text style={styles.whenLabel}>REMIND ME</Text>
          <View style={styles.whenRow}>{reminders.map((item) => <Pressable disabled={busy} key={item.label} onPress={() => { void scheduleReminder(item.seconds); }} style={styles.whenButton}><Text style={styles.whenText}>{item.label}  ›</Text></Pressable>)}</View>
          <Text style={styles.privacyNote}>Reminders are scheduled on this phone. Android and iOS settings decide whether their details appear while locked.</Text>
        </View>

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Coming up</Text><Text style={styles.sectionMeta}>{scheduled.length} SAVED</Text></View>
        {scheduled.length ? scheduled.map((item) => <View key={item.id} style={styles.savedReminder}><View style={styles.reminderClock}><Text style={styles.reminderClockText}>◷</Text></View><View style={styles.savedCopy}><Text style={styles.savedText} numberOfLines={1}>{item.text}</Text><Text style={styles.savedTime}>{new Date(item.dueAt).toLocaleString()}</Text></View><Pressable onPress={() => { void removeReminder(item); }} accessibilityLabel="Cancel reminder"><Text style={styles.removeReminder}>×</Text></Pressable></View>) : <View style={styles.emptyReminder}><Text style={styles.emptyGlyph}>◷</Text><Text style={styles.emptyText}>Your next reminder will show up here.</Text></View>}

        <View style={styles.aiCard}>
          <View style={styles.aiTop}><View style={styles.aiIcon}><Text style={styles.aiIconText}>✦</Text></View><Text style={styles.aiLabel}>KIKI AI · NEXT UP</Text><Text style={styles.soonPill}>SOON</Text></View>
          <Text style={styles.aiTitle}>A thoughtful moment, right when you need it.</Text>
          <Text style={styles.aiCopy}>Kiki can turn your routines into helpful briefs and reminders. You’ll control timing, content, and lock-screen privacy.</Text>
        </View>

        <View style={styles.systemNote}><Text style={styles.systemIcon}>⌁</Text><Text style={styles.systemCopy}>Set Kiki as your live wallpaper from Tools. Android and iPhone each control which lock-screen features apps can display.</Text></View>
        <Pressable onPress={() => router.push('/tools')} style={styles.toolsLink}><Text style={styles.toolsLinkText}>Set up wallpaper rotation  ›</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FBF9F5' }, page: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 38 },
  back: { color: '#827D74', fontSize: 14, fontWeight: '600', marginBottom: 22 }, titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { color: '#9B7567', fontSize: 9, letterSpacing: 2, fontWeight: '800' }, title: { color: '#24251F', fontSize: 32, letterSpacing: -1, fontWeight: '700', marginTop: 5 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, backgroundColor: '#EAF0EA' }, liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#70866F' }, liveText: { color: '#70866F', fontSize: 8, fontWeight: '800', letterSpacing: 1 }, intro: { color: '#858078', fontSize: 12, lineHeight: 18, marginTop: 9 },
  previewFrame: { width: '76%', alignSelf: 'center', marginTop: 21, padding: 6, borderRadius: 31, backgroundColor: '#EAE5DC', shadowColor: '#342F25', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 7 } }, preview: { height: 390, borderRadius: 26, overflow: 'hidden', paddingHorizontal: 16, paddingTop: 18, justifyContent: 'space-between', backgroundColor: '#777' }, previewImage: { borderRadius: 26 }, scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(18, 20, 18, 0.25)' },
  previewTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, previewBrand: { color: '#FFFDF9', fontSize: 13, fontWeight: '800', letterSpacing: -0.4 }, previewBrandDot: { color: '#FFD7C8' }, previewStatus: { color: '#FFFDF9', fontSize: 9 }, clockBlock: { alignItems: 'center', marginTop: 18 }, previewDate: { color: '#F5F1E9', fontSize: 7, letterSpacing: 1.5, fontWeight: '700' }, previewTime: { color: '#FFFDF9', fontSize: 64, lineHeight: 72, letterSpacing: -3, fontWeight: '300' },
  glanceCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(249,247,239,0.91)', padding: 10, borderRadius: 16, marginBottom: 8 }, glanceIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#F1DED4', alignItems: 'center', justifyContent: 'center' }, glanceIconText: { color: '#AA6F5A', fontSize: 14 }, glanceText: { flex: 1, marginLeft: 9 }, glanceLabel: { color: '#A07868', fontSize: 7, fontWeight: '800', letterSpacing: 1 }, glanceTitle: { color: '#33332C', fontSize: 10, fontWeight: '700', marginTop: 3 }, glanceArrow: { color: '#8F887D', fontSize: 20, marginHorizontal: 5 }, previewBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }, previewButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }, previewButtonText: { color: 'white', fontSize: 15 }, unlockLine: { width: 78, height: 3, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.8)' }, previewCaption: { color: '#A59E93', fontSize: 7, fontWeight: '700', letterSpacing: 1, textAlign: 'center', marginTop: 9 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 26, marginBottom: 10 }, sectionTitle: { color: '#292A24', fontSize: 15, fontWeight: '700' }, sectionMeta: { color: '#A07868', fontSize: 8, fontWeight: '800', letterSpacing: 0.8 },
  settingCard: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 11, borderRadius: 15, backgroundColor: '#F1EDE5', marginTop: 7 }, settingIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#F4E2D9', alignItems: 'center', justifyContent: 'center' }, settingIconText: { color: '#B27661', fontSize: 16 }, settingIconSage: { backgroundColor: '#E3EAE1' }, sageText: { color: '#70866F' }, settingCopy: { flex: 1, marginLeft: 10 }, settingTitle: { color: '#36352E', fontSize: 11, fontWeight: '700' }, settingSub: { color: '#8E897F', fontSize: 9, marginTop: 3 },
  reminderCard: { borderRadius: 17, backgroundColor: '#F1EDE5', padding: 14 }, reminderLabel: { color: '#9B7567', fontSize: 8, fontWeight: '800', letterSpacing: 1 }, input: { height: 43, borderRadius: 12, backgroundColor: '#FBF9F5', paddingHorizontal: 11, color: '#38372F', fontSize: 11, marginTop: 9 }, quickIdeas: { flexDirection: 'row', gap: 7, marginTop: 9 }, ideaChip: { borderRadius: 12, paddingHorizontal: 9, paddingVertical: 7, backgroundColor: '#FBF9F5' }, ideaChipText: { color: '#86776B', fontSize: 8, fontWeight: '600' }, whenLabel: { color: '#9B7567', fontSize: 8, fontWeight: '800', letterSpacing: 1, marginTop: 15 }, whenRow: { flexDirection: 'row', gap: 7, marginTop: 8 }, whenButton: { flex: 1, backgroundColor: '#D57B60', borderRadius: 11, paddingVertical: 10, alignItems: 'center' }, whenText: { color: '#FFFDF9', fontSize: 9, fontWeight: '700' }, privacyNote: { color: '#918A80', fontSize: 8, lineHeight: 12, marginTop: 10 },
  emptyReminder: { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 14, padding: 13, backgroundColor: '#F1EDE5' }, emptyGlyph: { color: '#A07868', fontSize: 18 }, emptyText: { color: '#8E897F', fontSize: 10 }, savedReminder: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1EDE5', borderRadius: 14, padding: 10, marginTop: 6 }, reminderClock: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#FBF9F5', alignItems: 'center', justifyContent: 'center' }, reminderClockText: { color: '#A07868', fontSize: 15 }, savedCopy: { flex: 1, marginLeft: 9 }, savedText: { color: '#36352E', fontSize: 10, fontWeight: '700' }, savedTime: { color: '#928B80', fontSize: 8, marginTop: 3 }, removeReminder: { color: '#A19B91', fontSize: 20, paddingHorizontal: 5 },
  aiCard: { backgroundColor: '#2D3732', borderRadius: 17, padding: 15, marginTop: 25 }, aiTop: { flexDirection: 'row', alignItems: 'center' }, aiIcon: { width: 26, height: 26, borderRadius: 9, backgroundColor: '#49584D', alignItems: 'center', justifyContent: 'center' }, aiIconText: { color: '#D8C5A6', fontSize: 13 }, aiLabel: { flex: 1, marginLeft: 8, color: '#D8C5A6', fontSize: 8, fontWeight: '800', letterSpacing: 1 }, soonPill: { color: '#DFD6C8', fontSize: 7, fontWeight: '800', letterSpacing: 0.7, borderRadius: 7, borderWidth: 1, borderColor: '#647067', overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 4 }, aiTitle: { color: '#FFFDF9', fontSize: 15, lineHeight: 20, fontWeight: '700', marginTop: 13 }, aiCopy: { color: '#C5CDC4', fontSize: 10, lineHeight: 15, marginTop: 6 },
  systemNote: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 14, backgroundColor: '#EAF0EA', padding: 12, marginTop: 12 }, systemIcon: { color: '#70866F', fontSize: 16, marginRight: 8 }, systemCopy: { flex: 1, color: '#657366', fontSize: 9, lineHeight: 14 }, toolsLink: { alignItems: 'center', paddingVertical: 13 }, toolsLinkText: { color: '#9B7567', fontSize: 11, fontWeight: '700' },
});
