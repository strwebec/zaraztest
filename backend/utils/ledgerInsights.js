// Rule-based, not ML — every insight ties back to a specific number in `metrics`
// so it stays honest and explainable, unlike a black-box model that might invent
// a pattern from three data points. Order matters: warnings first (what needs
// attention now), then info, then a positive fallback so a good month doesn't
// read as an empty, unhelpful report.

function buildInsights(current, previous) {
  const insights = [];

  if (previous) {
    const marginDelta = current.totals.marginPercent - previous.totals.marginPercent;
    if (marginDelta <= -5) {
      insights.push({
        severity: 'warning',
        text: `Маржа впала з ${previous.totals.marginPercent}% до ${current.totals.marginPercent}% — витрати цього місяця зростають швидше за дохід, перевірте статті витрат нижче.`,
      });
    } else if (marginDelta >= 5) {
      insights.push({
        severity: 'positive',
        text: `Маржа зросла з ${previous.totals.marginPercent}% до ${current.totals.marginPercent}% — дохід росте швидше за витрати, гарна динаміка.`,
      });
    }

    if (previous.auto.revenue > 0) {
      const revenueDeltaPercent = Math.round(((current.auto.revenue - previous.auto.revenue) / previous.auto.revenue) * 100);
      if (revenueDeltaPercent <= -15) {
        insights.push({
          severity: 'warning',
          text: `Дохід від записів впав на ${Math.abs(revenueDeltaPercent)}% порівняно з минулим місяцем — розгляньте TOP-розміщення в каталозі, щоб підняти потік нових клієнтів.`,
        });
      }
    }

    if (previous.auto.averageCheck > 0 && current.auto.averageCheck < previous.auto.averageCheck) {
      const drop = previous.auto.averageCheck - current.auto.averageCheck;
      insights.push({
        severity: 'info',
        text: `Середній чек знизився на ${drop}₴ (з ${previous.auto.averageCheck}₴ до ${current.auto.averageCheck}₴) — спробуйте пропонувати додаткові послуги під час запису.`,
      });
    }
  }

  if (current.auto.cancellationRatePercent >= 15) {
    insights.push({
      severity: 'warning',
      text: `${current.auto.cancellationRatePercent}% записів скасовано або не відбулись — розгляньте передоплату чи суворішу політику скасування для проблемних клієнтів.`,
    });
  }

  if (current.auto.topExpenseCategory && current.totals.totalExpenses > 0) {
    const share = Math.round((current.auto.topExpenseCategory.amount / current.totals.totalExpenses) * 100);
    if (share >= 40) {
      const savingsIfCut10 = Math.round(current.auto.topExpenseCategory.amount * 0.1);
      insights.push({
        severity: 'info',
        text: `Найбільша стаття витрат — «${current.auto.topExpenseCategory.category}» (${share}% усіх витрат, ${current.auto.topExpenseCategory.amount}₴). Скоротивши її на 10%, ви додасте близько ${savingsIfCut10}₴ чистого прибутку.`,
      });
    }
  }

  if (current.totals.netProfit < 0) {
    insights.push({
      severity: 'warning',
      text: `Місяць закрився зі збитком ${Math.abs(current.totals.netProfit)}₴ — витрати перевищують дохід. Перегляньте постійні витрати або підніміть ціни на найпопулярніші послуги.`,
    });
  } else if (insights.length === 0) {
    insights.push({
      severity: 'positive',
      text: `Стабільний місяць: чистий прибуток ${current.totals.netProfit}₴ при маржі ${current.totals.marginPercent}%.`,
    });
  }

  return insights;
}

function buildPeriodInsights(monthsMetrics) {
  const insights = [];
  if (monthsMetrics.length < 2) return insights;

  const first = monthsMetrics[0];
  const last = monthsMetrics[monthsMetrics.length - 1];
  const marginTrend = last.totals.marginPercent - first.totals.marginPercent;
  if (marginTrend >= 5) {
    insights.push({
      severity: 'positive',
      text: `За період маржа зросла з ${first.totals.marginPercent}% (${first.month}) до ${last.totals.marginPercent}% (${last.month}).`,
    });
  } else if (marginTrend <= -5) {
    insights.push({
      severity: 'warning',
      text: `За період маржа знизилась з ${first.totals.marginPercent}% (${first.month}) до ${last.totals.marginPercent}% (${last.month}) — варто переглянути витрати або цінову політику.`,
    });
  }

  const best = [...monthsMetrics].sort((a, b) => b.totals.netProfit - a.totals.netProfit)[0];
  const worst = [...monthsMetrics].sort((a, b) => a.totals.netProfit - b.totals.netProfit)[0];
  if (best.month !== worst.month) {
    insights.push({
      severity: 'info',
      text: `Найкращий місяць періоду — ${best.month} (${best.totals.netProfit}₴ чистого прибутку), найслабший — ${worst.month} (${worst.totals.netProfit}₴).`,
    });
  }

  const avgCancellation = monthsMetrics.reduce((s, m) => s + m.auto.cancellationRatePercent, 0) / monthsMetrics.length;
  if (avgCancellation >= 12) {
    insights.push({
      severity: 'warning',
      text: `В середньому ${Math.round(avgCancellation)}% записів за період скасовані або не відбулись — це стабільна втрата доходу, а не разовий випадок.`,
    });
  }

  return insights;
}

module.exports = { buildInsights, buildPeriodInsights };
