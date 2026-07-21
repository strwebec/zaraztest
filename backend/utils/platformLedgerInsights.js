// Same rule-based, explainable approach as utils/ledgerInsights.js, but the platform
// ledger tracks different auto figures (collected commission/TOP revenue vs a
// business's booking revenue/cancellation rate), so the rules are platform-specific
// rather than reused as-is.

function buildInsights(current, previous) {
  const insights = [];

  if (previous) {
    const marginDelta = current.totals.marginPercent - previous.totals.marginPercent;
    if (marginDelta <= -5) {
      insights.push({
        severity: 'warning',
        text: `Маржа виплати впала з ${previous.totals.marginPercent}% до ${current.totals.marginPercent}% — витрати зростають швидше за дохід платформи, перевірте статті витрат нижче.`,
      });
    } else if (marginDelta >= 5) {
      insights.push({
        severity: 'positive',
        text: `Маржа виплати зросла з ${previous.totals.marginPercent}% до ${current.totals.marginPercent}% — гарна динаміка.`,
      });
    }

    if (previous.auto.revenue > 0) {
      const revenueDeltaPercent = Math.round(((current.auto.revenue - previous.auto.revenue) / previous.auto.revenue) * 100);
      if (revenueDeltaPercent <= -15) {
        insights.push({
          severity: 'warning',
          text: `Зібраний дохід платформи впав на ${Math.abs(revenueDeltaPercent)}% порівняно з минулим місяцем — перевірте, чи не зросла кількість прострочених рахунків.`,
        });
      } else if (revenueDeltaPercent >= 15) {
        insights.push({
          severity: 'positive',
          text: `Зібраний дохід платформи зріс на ${revenueDeltaPercent}% порівняно з минулим місяцем.`,
        });
      }
    }
  }

  // Money earned (accrued commission) but not yet collected is a receivables gap,
  // not a loss — flagged separately from netPayout so it doesn't look like the
  // platform lost revenue when it's really just sitting in unpaid invoices.
  const collectionGap = current.auto.accruedCommission - current.auto.collectedCommission;
  if (current.auto.accruedCommission > 0 && collectionGap > 0) {
    const gapPercent = Math.round((collectionGap / current.auto.accruedCommission) * 100);
    if (gapPercent >= 30) {
      insights.push({
        severity: 'warning',
        text: `Нараховано комісії на ${current.auto.accruedCommission}₴, але зібрано лише ${current.auto.collectedCommission}₴ (розрив ${gapPercent}%) — частина рахунків цього місяця ще не оплачена.`,
      });
    }
  }

  if (current.auto.revenue > 0 && current.auto.collectedTopPlacements > 0) {
    const topShare = Math.round((current.auto.collectedTopPlacements / current.auto.revenue) * 100);
    if (topShare >= 40) {
      insights.push({
        severity: 'info',
        text: `TOP-розміщення дають ${topShare}% зібраного доходу цього місяця — вагома, але менш стабільна стаття порівняно з комісією за записи.`,
      });
    }
  }

  if (current.totals.totalExpenses > 0 && current.totals.grossRevenue > 0) {
    const expenseShare = Math.round((current.totals.totalExpenses / current.totals.grossRevenue) * 100);
    if (expenseShare >= 70) {
      insights.push({
        severity: 'warning',
        text: `Витрати (зарплати, податки, інше) з'їдають ${expenseShare}% доходу платформи цього місяця — маржа виплати невисока.`,
      });
    }
  }

  if (current.totals.netPayout < 0) {
    insights.push({
      severity: 'warning',
      text: `Місяць закрився з від'ємною виплатою ${Math.abs(current.totals.netPayout)}₴ — витрати перевищують зібраний дохід платформи.`,
    });
  } else if (insights.length === 0) {
    insights.push({
      severity: 'positive',
      text: `Стабільний місяць: до виплати ${current.totals.netPayout}₴ при маржі ${current.totals.marginPercent}%.`,
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
      text: `За період маржа виплати зросла з ${first.totals.marginPercent}% (${first.month}) до ${last.totals.marginPercent}% (${last.month}).`,
    });
  } else if (marginTrend <= -5) {
    insights.push({
      severity: 'warning',
      text: `За період маржа виплати знизилась з ${first.totals.marginPercent}% (${first.month}) до ${last.totals.marginPercent}% (${last.month}) — варто переглянути витрати.`,
    });
  }

  const best = [...monthsMetrics].sort((a, b) => b.totals.netPayout - a.totals.netPayout)[0];
  const worst = [...monthsMetrics].sort((a, b) => a.totals.netPayout - b.totals.netPayout)[0];
  if (best.month !== worst.month) {
    insights.push({
      severity: 'info',
      text: `Найкращий місяць періоду — ${best.month} (${best.totals.netPayout}₴ до виплати), найслабший — ${worst.month} (${worst.totals.netPayout}₴).`,
    });
  }

  const totalCollected = monthsMetrics.reduce((s, m) => s + m.auto.collectedCommission, 0);
  const totalAccrued = monthsMetrics.reduce((s, m) => s + m.auto.accruedCommission, 0);
  if (totalAccrued > 0) {
    const gapPercent = Math.round(((totalAccrued - totalCollected) / totalAccrued) * 100);
    if (gapPercent >= 20) {
      insights.push({
        severity: 'warning',
        text: `За період нараховано комісії на ${totalAccrued}₴, зібрано ${totalCollected}₴ (розрив ${gapPercent}%) — варто посилити нагадування про прострочені рахунки.`,
      });
    }
  }

  return insights;
}

module.exports = { buildInsights, buildPeriodInsights };
