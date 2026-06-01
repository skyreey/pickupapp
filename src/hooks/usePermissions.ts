// ============================================================
// 权限状态 Hook
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { Platform, Linking } from 'react-native';
import { hasPermission as hasSmsPermission } from '../../modules/expo-sms-reader';
import {
  hasPermission as hasNotifPermission,
  requestPermission as requestNotifPermission,
} from '../../modules/expo-notification-reader';

interface PermissionState {
  sms: 'granted' | 'denied' | 'unknown' | 'unsupported';
  notification: 'granted' | 'denied' | 'unknown' | 'unsupported';
}

export function usePermissions() {
  const [perms, setPerms] = useState<PermissionState>({
    sms: 'unknown',
    notification: 'unknown',
  });

  useEffect(() => {
    checkAll();
  }, []);

  const checkAll = useCallback(async () => {
    if (Platform.OS !== 'android') {
      setPerms({ sms: 'unsupported', notification: 'unsupported' });
      return;
    }

    const [sms, notif] = await Promise.all([
      Promise.resolve(hasSmsPermission()),
      hasNotifPermission(),
    ]);

    setPerms({
      sms: sms ? 'granted' : 'denied',
      notification: notif ? 'granted' : 'denied',
    });
  }, []);

  const requestSmsPermission = useCallback(async () => {
    if (Platform.OS !== 'android') return false;
    // SMS 权限需要通过系统设置页授予
    Linking.openSettings();
    await checkAll();
    return true;
  }, [checkAll]);

  const requestNotificationPermission = useCallback(async () => {
    if (Platform.OS !== 'android') return false;
    requestNotifPermission();
    await checkAll();
    return true;
  }, [checkAll]);

  return {
    perms,
    requestSmsPermission,
    requestNotificationPermission,
    refresh: checkAll,
  };
}
