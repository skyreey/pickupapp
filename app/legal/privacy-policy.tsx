// ============================================================
// 隐私政策
// ============================================================
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { FontSize, Spacing, BorderRadius, useColors } from '../../src/constants/theme';
import type { ColorScheme } from '../../src/constants/theme';

export default function PrivacyPolicyScreen() {
  const { colors } = useColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.lastUpdated}>最后更新：2026年5月28日</Text>

        <Section title="一、信息收集与使用" styles={styles}>
          <Text style={styles.body}>
            取件通（以下简称"本应用"）是一款本地快递包裹管理工具。我们高度重视您的隐私，特此说明本应用的信息处理方式。
          </Text>
          <Text style={styles.body}>
            <Text style={styles.bold}>短信内容读取：</Text>本应用会读取您手机中的快递相关短信，用于自动识别取件码、快递单号、取件地址等信息。所有解析过程完全在您的设备本地完成，短信内容不会上传到任何服务器。
          </Text>
          <Text style={styles.body}>
            <Text style={styles.bold}>通知监听：</Text>本应用会监听淘宝、京东、拼多多等购物App的推送通知，从中提取快递物流信息。通知内容同样仅在本地处理，不会上传。
          </Text>
          <Text style={styles.body}>
            <Text style={styles.bold}>Pro会员服务：</Text>开通Pro会员时，您可选填手机号用于换机恢复会员权益。手机号经SHA-256哈希处理后传输至服务器，服务器不存储原始手机号。
          </Text>
          <Text style={styles.body}>
            <Text style={styles.bold}>我们不收集的信息：</Text>本应用不注册账号、不收集位置信息、不获取通讯录、不获取相册（除非您主动使用OCR功能选择截图）。
          </Text>
        </Section>

        <Section title="二、数据存储" styles={styles}>
          <Text style={styles.body}>
            所有包裹数据（取件码、快递单号、地址等）均存储在您设备的本地 SQLite 数据库中。您可以随时在设置页导出、导入或清空这些数据。
          </Text>
        </Section>

        <Section title="三、权限说明" styles={styles}>
          <Text style={styles.body}>本应用申请以下权限及其用途：</Text>
          <Bullet>短信读取 — 自动识别快递取件码短信</Bullet>
          <Bullet>通知读取 — 获取购物App的物流推送通知</Bullet>
          <Bullet>后台运行 — 确保及时收到新的取件通知</Bullet>
          <Bullet>存储（可选）— 导出/导入包裹数据备份</Bullet>
        </Section>

        <Section title="四、第三方服务" styles={styles}>
          <Text style={styles.body}>
            本应用不使用任何第三方分析、广告或追踪服务。不集成任何第三方SDK（除Expo框架基础组件外）。不与任何第三方共享您的数据。
          </Text>
        </Section>

        <Section title="五、您的权利" styles={styles}>
          <Bullet>随时在系统设置中撤销已授予的权限</Bullet>
          <Bullet>随时导出或删除所有本地存储的包裹数据</Bullet>
          <Bullet>卸载应用即完全清除所有数据</Bullet>
        </Section>

        <Section title="六、免责声明" styles={styles}>
          <Text style={styles.body}>
            本应用为非官方的第三方工具，与任何快递公司（顺丰、圆通、中通、申通、韵达、极兔、菜鸟、丰巢等）无关。快递公司名称和标识均为其各自所有者的商标。
          </Text>
          <Text style={styles.body}>
            本应用通过用户主动授权的权限自动解析快递信息，解析结果仅供参考。如因短信格式变化导致解析错误，本应用不承担任何责任。
          </Text>
        </Section>

        <Section title="七、隐私政策更新" styles={styles}>
          <Text style={styles.body}>
            我们可能会不时更新本隐私政策。更新后的政策将在本页面公布，重大变更会通过应用内通知告知。
          </Text>
        </Section>

        <Section title="八、联系我们" styles={styles}>
          <Text style={styles.body}>
            如对本隐私政策有任何疑问或建议，请通过以下方式联系我们：
          </Text>
          <Bullet>邮箱：skyreey@163.com</Bullet>
          <Bullet>GitHub Issues：https://github.com/skyreey/PickupApp</Bullet>
        </Section>

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

function Section({ title, children, styles }: { title: string; children: React.ReactNode; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', marginBottom: 4, paddingLeft: 8 }}>
      <Text style={{ fontSize: FontSize.body, color: '#8E8E93', marginRight: 8 }}>  •</Text>
      <Text style={{ flex: 1, fontSize: FontSize.body, color: '#3C3C43', lineHeight: 22 }}>{children}</Text>
    </View>
  );
}

const createStyles = (colors: ColorScheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: Spacing.lg,
  },
  lastUpdated: {
    fontSize: FontSize.footnote,
    color: colors.textTertiary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: FontSize.headline,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  body: {
    fontSize: FontSize.body,
    color: '#3C3C43',
    lineHeight: 24,
    marginBottom: Spacing.sm,
  },
  bold: {
    fontWeight: '700',
  },
});
