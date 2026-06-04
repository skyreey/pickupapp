// ============================================================
// 导航工具 — 打开地图 App 导航、拨打电话
// ============================================================
import { Linking, Alert } from 'react-native';

/** 去掉地址/站点名尾部的快递品牌名，避免干扰地图搜索 */
function cleanAddressForNavigation(text: string): string {
  return text
    .replace(
      /(?:兔喜(?:生活|快递|超市)?|菜鸟(?:驿站|裹裹)?|丰巢(?:快递柜|智能柜)?|妈妈驿站|韵达超市|快递超市|邻里驿站|自提柜|代收点|快递柜|驿站)/g,
      '',
    )
    .replace(/\s+/g, '')
    .trim();
}

/** 根据地址打开地图导航，依次尝试高德 → 百度 → 腾讯 → Apple Maps → geo URI */
export async function navigateToAddress(address: string, stationName?: string | null): Promise<void> {
  const cleanedAddress = cleanAddressForNavigation(address);
  if (!cleanedAddress) {
    Alert.alert('无法导航', '缺少取件地址');
    return;
  }

  // 只用纯地址导航，不拼站点名（兔喜生活/菜鸟驿站等品牌名会干扰地图定位）
  const destination = cleanedAddress;

  // 高德地图
  const gaode = `amapuri://route/plan/?dlat=&dlon=&dname=${encodeURIComponent(destination)}&dev=0&t=0`;
  if (await canOpen(gaode)) { await Linking.openURL(gaode); return; }

  // 百度地图
  const baidu = `baidumap://map/direction?destination=${encodeURIComponent(destination)}&mode=driving&coord_type=gcj02&src=com.carl.pickupapp`;
  if (await canOpen(baidu)) { await Linking.openURL(baidu); return; }

  // 腾讯地图
  const qq = `qqmap://map/routeplan?to=${encodeURIComponent(destination)}&type=drive&referer=com.carl.pickupapp`;
  if (await canOpen(qq)) { await Linking.openURL(qq); return; }

  // 最终回退：通用 geo URI
  const geo = `geo:0,0?q=${encodeURIComponent(destination)}`;
  if (await canOpen(geo)) {
    await Linking.openURL(geo);
  } else {
    Alert.alert('无法导航', '未检测到可用的地图应用');
  }
}

/** 拨打取件点电话 */
export async function callPhoneNumber(phone: string): Promise<void> {
  const cleaned = phone.replace(/[\s\-\(\)（）]/g, '');
  const telUri = `tel:${cleaned}`;
  if (await canOpen(telUri)) {
    await Linking.openURL(telUri);
  } else {
    Alert.alert('无法拨号', '设备不支持拨号功能');
  }
}

async function canOpen(url: string): Promise<boolean> {
  try { return await Linking.canOpenURL(url); } catch { return false; }
}

/**
 * 导航前确认对话框
 * 建议用户先打电话确认位置，再导航
 */
export function navigateWithConfirm(
  address: string,
  phone: string | null | undefined,
  stationName?: string | null,
): void {
  const name = stationName || '驿站';
  const buttons: Array<{ text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }> = [
    { text: '取消', style: 'cancel' },
    {
      text: '直接导航',
      onPress: () => navigateToAddress(address, stationName),
    },
  ];

  if (phone) {
    buttons.splice(1, 0, {
      text: `拨打 ${phone}`,
      onPress: () => callPhoneNumber(phone),
    });
  }

  Alert.alert(
    `导航到 ${name}`,
    phone
      ? `建议先打电话确认位置\n\n📞 ${phone}`
      : '建议先打电话确认位置',
    buttons,
  );
}
