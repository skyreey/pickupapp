// ============================================================
// 用户协议
// ============================================================
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { FontSize, Spacing, useColors } from '../../src/constants/theme';
import type { ColorScheme } from '../../src/constants/theme';

export default function UserAgreementScreen() {
  const { colors } = useColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.lastUpdated}>最后更新：2026年5月28日</Text>

        <Section title="一、服务说明" styles={styles}>
          <Text style={styles.body}>
            取件通（以下简称"本应用"）是一款本地快递包裹管理工具，帮助用户自动识别快递取件码、追踪包裹状态。
            本应用为非官方的第三方工具，与任何快递公司（包括但不限于顺丰、圆通、中通、申通、韵达、极兔、菜鸟、丰巢等）无任何关联、合作或代理关系。
          </Text>
        </Section>

        <Section title="二、服务范围" styles={styles}>
          <Bullet>自动解析快递短信，提取取件码和取件地址</Bullet>
          <Bullet>监听购物App通知，追踪快递物流动态</Bullet>
          <Bullet>本地包裹管理（列表、搜索、筛选、统计）</Bullet>
          <Bullet>取件提醒和超时自动标记</Bullet>
          <Bullet>桌面小组件快速查看取件码</Bullet>
        </Section>

        <Section title="三、用户义务" styles={styles}>
          <Text style={styles.body}>使用本应用时，您同意：</Text>
          <Bullet>不利用本应用从事任何违法活动</Bullet>
          <Bullet>不反向工程、修改或尝试提取本应用的源代码</Bullet>
          <Bullet>不通过自动化手段滥用本应用的功能</Bullet>
        </Section>

        <Section title="四、免责声明" styles={styles}>
          <Text style={styles.body}>
            <Text style={styles.bold}>信息准确性：</Text>本应用通过短信和通知自动解析快递信息，解析结果受信息格式影响可能存在误差。
            用户应以快递公司官方渠道的信息为准。因解析错误导致的取件延误、包裹丢失等损失，本应用不承担责任。
          </Text>
          <Text style={styles.body}>
            <Text style={styles.bold}>服务中断：</Text>本应用依赖设备系统权限和系统稳定性运行。因用户关闭权限、系统更新、设备故障等原因导致的功能异常，本应用不承担责任。
          </Text>
          <Text style={styles.body}>
            <Text style={styles.bold}>第三方服务：</Text>本应用中的"一键导航"功能调用系统地图应用，拨号功能调用系统电话应用。
            这些第三方服务的可用性和准确性由其提供方负责。
          </Text>
        </Section>

        <Section title="五、知识产权" styles={styles}>
          <Text style={styles.body}>
            本应用及其相关的代码、设计、文案等知识产权归开发者所有。本应用中出现的快递公司名称、App名称和商标均为各自所有者的知识产权。
          </Text>
        </Section>

        <Section title="六、协议变更" styles={styles}>
          <Text style={styles.body}>
            我们保留随时修改本协议的权利。修改后的协议将在本页面公布，继续使用本应用即视为接受修改后的协议。
          </Text>
        </Section>

        <Section title="七、争议解决" styles={styles}>
          <Text style={styles.body}>
            本协议适用中华人民共和国法律。因本协议产生的争议，双方应友好协商解决；协商不成的，提交开发者所在地有管辖权的人民法院裁决。
          </Text>
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
