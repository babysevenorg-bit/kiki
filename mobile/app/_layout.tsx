import { Stack } from 'expo-router';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';

export default function RootLayout() {
  const router = useRouter();
  useEffect(() => {
    if (Platform.OS === 'web' || isRunningInExpoGo()) return;
    let active = true;
    let removeListener: (() => void) | undefined;
    void import('expo-notifications').then((Notifications) => {
      if (!active) return;
      const openLockscreen = (notification: { request: { content: { data: Record<string, unknown> } } }) => {
        if (notification.request.content.data?.screen === '/lockscreen') router.push('/lockscreen');
      };
      const last = Notifications.getLastNotificationResponse();
      if (last) openLockscreen(last.notification);
      const subscription = Notifications.addNotificationResponseReceivedListener((response) => openLockscreen(response.notification));
      removeListener = () => subscription.remove();
    });
    return () => { active = false; removeListener?.(); };
  }, [router]);
  return <Stack screenOptions={{ headerShown: false }} />;
}
