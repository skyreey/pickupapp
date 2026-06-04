// ============================================================
// GeofenceBanner — 首页地理围栏提醒横幅
// "📍 附近有3个包裹待取 → 查看"
// ============================================================
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import { FontSize, Spacing, BorderRadius, useColors } from '../constants/theme';
import type { ColorScheme } from '../constants/theme';
import {
  checkGeofence, markNotified, buildGeofenceNotification, getGeofenceSettings,
} from '../services/geofence-service';
import type { GeofenceAlert } from '../services/geofence-service';

interface Props {
  onPress?: (alerts: GeofenceAlert[]) => void;
}

export function GeofenceBanner({ onPress }: Props) {
  const { colors } = useColors();
  const [alerts, setAlerts] = useState<GeofenceAlert[]>([]);
  const [loading, setLoading] = useState(false);

  const doCheck = useCallback(async () => {
    setLoading(true);
    try {
      const settings = await getGeofenceSettings();
      if (!settings.enabled) { setAlerts([]); return; }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setAlerts([]); return; }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const result = await checkGeofence({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      });

      if (result.length > 0) {
        setAlerts(result);
        await markNotified(result.map(a => a.address));
      } else {
        setAlerts([]);
      }
    } catch {
      setAlerts([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { doCheck(); }, [doCheck]);

  if (loading || alerts.length === 0) return null;

  const total = alerts.reduce((sum, a) => sum + a.packageCount, 0);
  const { body } = buildGeofenceNotification(alerts);

  return (
    <Pressable
      style={[styles.banner, { backgroundColor: '#34C759', borderColor: '#2DA84D' }]}
      onPress={() => onPress?.(alerts)}
    >
      <Text style={styles.icon}>📍</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>附近有 {total} 个包裹待取</Text>
        <Text style={styles.body} numberOfLines={1}>{body}</Text>
      </View>
      <Text style={styles.arrow}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.md,
  },
  icon: { fontSize: 24 },
  title: {
    fontSize: FontSize.subhead,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  body: {
    fontSize: FontSize.caption1,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  arrow: {
    fontSize: 22,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '300',
  },
});
