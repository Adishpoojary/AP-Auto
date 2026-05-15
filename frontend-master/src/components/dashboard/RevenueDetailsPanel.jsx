import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import config from '../../config';
import styles from './RevenueDetailsPanel.module.css';
import PanelPagination from './PanelPagination';
import { getDriverDisplay } from '../../utils/driverUtils';
import { getCustomerDisplay } from '../../utils/customerUtils';

const COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#0ea5e9', '#64748b'];

const formatCurrency = (val) => `₹${(Number(val) || 0).toLocaleString('en-IN')}`;

const chartMargin = { top: 12, right: 18, left: 4, bottom: 8 };

const tooltipStyle = {
  borderRadius: 8,
  border: '1px solid #e2e8f0',
  boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
  fontSize: '0.8125rem',
};

function yAxisTickCompact(v) {
  const n = Number(v);
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}k`;
  return `₹${n}`;
}

function buildKpiItems(metric, payload) {
  const s = payload?.summary || {};
  const num = (x) => (x != null ? Number(x) : 0);

  switch (metric) {
    case 'total': {
      const trend = payload?.series?.daily_trend || [];
      const sum = trend.reduce((a, x) => a + num(x.value), 0);
      const avgDay = trend.length ? Math.round(sum / trend.length) : 0;
      let growthLabel = '—';
      if (trend.length >= 2) {
        const first = num(trend[0].value);
        const last = num(trend[trend.length - 1].value);
        if (first > 0) {
          const pct = ((last - first) / first) * 100;
          growthLabel = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
        }
      }
      const types = (payload?.series?.payment_type_breakdown || []).length;
      return [
        { label: 'Total revenue', value: formatCurrency(s.total_revenue), primary: true },
        { label: 'Avg / day', value: formatCurrency(avgDay), sub: `${trend.length} day(s) in trend` },
        { label: 'Trend (first→last)', value: growthLabel, sub: 'Daily series endpoints' },
        { label: 'Categories', value: String(types), sub: 'Payment type split' },
      ];
    }
    case 'weekly': {
      const days = payload?.series?.day_wise || [];
      const sum = days.reduce((a, x) => a + num(x.value), 0);
      const avg = Math.round(num(s.weekly_revenue) / 7);
      const peak = days.reduce((m, x) => Math.max(m, num(x.value)), 0);
      return [
        { label: 'Weekly total', value: formatCurrency(s.weekly_revenue), primary: true },
        { label: 'Avg / day', value: formatCurrency(avg), sub: 'Spread over 7 days' },
        { label: 'Peak day', value: formatCurrency(peak), sub: 'Highest single day' },
        { label: 'Days w/ data', value: String(days.length), sub: 'Bars in chart' },
      ];
    }
    case 'monthly': {
      const months = payload?.series?.monthly_trend || [];
      const sumM = months.reduce((a, x) => a + num(x.value), 0);
      const avgM = months.length ? Math.round(sumM / months.length) : 0;
      let mom = '—';
      if (months.length >= 2) {
        const a = num(months[months.length - 2].value);
        const b = num(months[months.length - 1].value);
        if (a > 0) mom = `${(((b - a) / a) * 100).toFixed(1)}%`;
      }
      return [
        { label: 'Rolling 30d', value: formatCurrency(s.monthly_revenue), primary: true },
        { label: 'Avg / month', value: formatCurrency(avgM), sub: `${months.length} month(s) shown` },
        { label: 'MoM (last)', value: mom, sub: 'Prior vs latest month' },
        { label: 'Months', value: String(months.length), sub: 'In chart' },
      ];
    }
    case 'driver': {
      const rows = payload?.rows || [];
      const total = num(s.driver_earnings);
      const top = rows[0];
      const topAmt = top ? num(top.earnings) : 0;
      const share = total > 0 && top ? Math.round((topAmt / total) * 1000) / 10 : 0;
      return [
        { label: 'Total earnings', value: formatCurrency(s.driver_earnings), primary: true },
        { label: 'Drivers listed', value: String(rows.length), sub: 'In breakdown' },
        { label: 'Top earner', value: top ? formatCurrency(topAmt) : '—', sub: top?.driver_name?.slice(0, 28) || '' },
        { label: 'Top share', value: total > 0 ? `${share}%` : '—', sub: 'Of total pool' },
      ];
    }
    case 'pending': {
      const rows = payload?.rows || [];
      const total = num(s.pending_payments);
      const cnt = rows.length;
      const avg = cnt ? Math.round(total / cnt) : 0;
      return [
        { label: 'Pending total', value: formatCurrency(s.pending_payments), primary: true },
        { label: 'Line items', value: String(cnt), sub: 'In table below' },
        { label: 'Avg / item', value: cnt ? formatCurrency(avg) : '—', sub: 'Mean amount' },
        { label: 'Status', value: 'Open', sub: 'Awaiting payment' },
      ];
    }
    default:
      return [];
  }
}

function downloadCsv(filename, headerRow, lines) {
  const esc = (cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`;
  const body = [headerRow.join(','), ...lines.map((cols) => cols.map(esc).join(','))].join('\n');
  const blob = new Blob([body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const RevenueSkeleton = () => (
  <div className={`${styles.root} ${styles.skeletonRoot} revenue-details-panel`}>
    <div className={styles.skeletonKpi}>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className={styles.skeletonBlock} />
      ))}
    </div>
    <div className={styles.skeletonChart} />
    <div className={styles.skeletonRows}>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className={styles.skeletonRow} />
      ))}
    </div>
  </div>
);

const RevenueDetailsPanel = ({ metric, dateRange, refreshTrigger }) => {
  const PAGE_LIMIT = 10;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [payload, setPayload] = useState(null);
  const [page, setPage] = useState(1);
  const [localTick, setLocalTick] = useState(0);
  const [pendingSort, setPendingSort] = useState({ key: 'amount', dir: 'desc' });

  const fetchDetails = useCallback(async (signal) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ metric: metric || 'total' });
      if ((metric || 'total') === 'driver' || (metric || 'total') === 'pending') {
        params.append('page', String(page));
        params.append('limit', String(PAGE_LIMIT));
      }
      if (dateRange?.startDate) params.append('start_date', dateRange.startDate);
      if (dateRange?.endDate) params.append('end_date', dateRange.endDate);
      const res = await axios.get(`${config.dispatchApiUrl}/dashboard/revenue/details?${params.toString()}`, {
        signal,
      });
      setPayload(res.data || {});
    } catch (err) {
      if (!axios.isCancel(err)) setError('Failed to load revenue details.');
    } finally {
      setLoading(false);
    }
  }, [metric, dateRange?.startDate, dateRange?.endDate, page]);

  useEffect(() => {
    setPage(1);
  }, [metric, dateRange?.startDate, dateRange?.endDate]);

  useEffect(() => {
    const controller = new AbortController();
    fetchDetails(controller.signal);
    return () => controller.abort();
  }, [fetchDetails, refreshTrigger, localTick]);

  const summaryAmount = useMemo(() => {
    const s = payload?.summary || {};
    const pick = (key) => (s[key] != null ? Number(s[key]) : null);
    switch (metric) {
      case 'total':
        return pick('total_revenue') ?? 0;
      case 'weekly':
        return pick('weekly_revenue') ?? 0;
      case 'monthly':
        return pick('monthly_revenue') ?? 0;
      case 'driver':
        return pick('driver_earnings') ?? 0;
      case 'pending':
        return pick('pending_payments') ?? 0;
      default:
        return 0;
    }
  }, [payload, metric]);

  const kpiItems = useMemo(() => buildKpiItems(metric, payload), [metric, payload]);

  const dailyTrend = payload?.series?.daily_trend || [];
  const paymentType = payload?.series?.payment_type_breakdown || [];
  const weeklyData = payload?.series?.day_wise || [];
  const monthlyData = payload?.series?.monthly_trend || [];
  const topDrivers = payload?.series?.top_drivers || [];
  const driverRows = payload?.rows || [];
  const pendingRowsRaw = payload?.rows || [];

  const sortedPending = useMemo(() => {
    const rows = [...pendingRowsRaw];
    const { key, dir } = pendingSort;
    const mult = dir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      if (key === 'amount') return (Number(a.amount) - Number(b.amount)) * mult;
      if (key === 'booking_id') return (Number(a.booking_id) - Number(b.booking_id)) * mult;
      return String(a[key] || '').localeCompare(String(b[key] || '')) * mult;
    });
    return rows;
  }, [pendingRowsRaw, pendingSort]);

  const togglePendingSort = (key) => {
    setPendingSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'amount' ? 'desc' : 'asc' }
    );
  };

  const maxDriverEarnings = useMemo(
    () => driverRows.reduce((m, r) => Math.max(m, Number(r.earnings) || 0), 0),
    [driverRows]
  );

  const handleExport = () => {
    if (!payload) return;
    const m = metric || 'total';
    if (m === 'total') {
      downloadCsv(
        'revenue-daily-trend.csv',
        ['date', 'revenue'],
        dailyTrend.map((r) => [r.label, r.value])
      );
      return;
    }
    if (m === 'weekly') {
      downloadCsv(
        'revenue-weekly-days.csv',
        ['date', 'revenue'],
        weeklyData.map((r) => [r.label, r.value])
      );
      return;
    }
    if (m === 'monthly') {
      downloadCsv(
        'revenue-monthly-trend.csv',
        ['month', 'revenue'],
        monthlyData.map((r) => [r.label, r.value])
      );
      return;
    }
    if (m === 'driver') {
      downloadCsv(
        'driver-earnings.csv',
        ['driver_id', 'driver_name', 'earnings'],
        driverRows.map((r) => [r.driver_id, r.driver_name, r.earnings])
      );
      return;
    }
    downloadCsv(
      'pending-payments.csv',
      ['booking_id', 'customer', 'amount', 'status'],
      pendingRowsRaw.map((r) => [r.booking_id, r.customer, r.amount, r.status])
    );
  };

  if (loading && !payload) return <RevenueSkeleton />;

  if (error && !payload) {
    return (
      <div className={`${styles.root} revenue-details-panel`}>
        <div className={styles.errorBox}>
          {error}
          <div>
            <button type="button" className={styles.btnPrimary} onClick={() => setLocalTick((t) => t + 1)}>
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.root} revenue-details-panel`}>
      <div className={styles.toolbar}>
        <span className={styles.toolbarHint}>Figures reflect the same date range as the operations dashboard.</span>
        <div className={styles.toolbarActions}>
          <button type="button" className={styles.btnGhost} onClick={() => setLocalTick((t) => t + 1)} disabled={loading}>
            Refresh
          </button>
          <button type="button" className={styles.btnPrimary} onClick={handleExport} disabled={!payload}>
            Export CSV
          </button>
        </div>
      </div>

      {loading && payload && (
        <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 8 }}>Updating…</div>
      )}

      <section className={styles.section}>
        <p className={styles.sectionLabel}>Key metrics</p>
        <div className={styles.kpiGrid}>
          {kpiItems.map((k) => (
            <div key={k.label} className={`${styles.kpiCard} ${k.primary ? styles.kpiPrimary : ''}`}>
              <div className={styles.kpiLabel}>{k.label}</div>
              <div className={styles.kpiValue}>{k.value}</div>
              {k.sub && <div className={styles.kpiSub}>{k.sub}</div>}
            </div>
          ))}
        </div>
      </section>

      <div className={styles.divider} />

      {metric === 'total' && (
        <>
          <section className={styles.section}>
            <p className={styles.sectionLabel}>Trends</p>
            <div className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <h3 className={styles.chartTitle}>Revenue trend (last 30 days)</h3>
                <p className={styles.chartSubtitle}>Completed trips — daily totals for quick pacing checks.</p>
              </div>
              {dailyTrend.length === 0 ? (
                <div className={styles.emptyState}>No daily revenue in this window.</div>
              ) : (
                <div className={styles.chartBody}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyTrend} margin={chartMargin}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                      <YAxis tickFormatter={yAxisTickCompact} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} width={56} />
                      <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={tooltipStyle} />
                      <Line type="monotone" dataKey="value" name="Revenue" stroke="#2563eb" strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
            <div className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <h3 className={styles.chartTitle}>Revenue by payment type</h3>
                <p className={styles.chartSubtitle}>Share of recorded completed revenue by settlement state.</p>
              </div>
              {paymentType.length === 0 ? (
                <div className={styles.emptyState}>No payment-type breakdown.</div>
              ) : (
                <div className={styles.chartBody}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={paymentType} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={52} outerRadius={100} paddingAngle={2}>
                        {paymentType.map((entry, index) => (
                          <Cell key={entry.label} fill={COLORS[index % COLORS.length]} stroke="transparent" />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: '0.8125rem' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {metric === 'weekly' && (
        <section className={styles.section}>
          <p className={styles.sectionLabel}>Visualization</p>
          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <h3 className={styles.chartTitle}>Daily breakdown (rolling week)</h3>
              <p className={styles.chartSubtitle}>Aligned with the weekly revenue card on the dashboard.</p>
            </div>
            {weeklyData.length === 0 ? (
              <div className={styles.emptyState}>No completed revenue in this week window.</div>
            ) : (
              <div className={styles.chartBody}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyData} margin={chartMargin}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                    <YAxis tickFormatter={yAxisTickCompact} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} width={56} />
                    <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={tooltipStyle} />
                    <Bar dataKey="value" name="Revenue" fill="#0ea5e9" radius={[6, 6, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </section>
      )}

      {metric === 'monthly' && (
        <section className={styles.section}>
          <p className={styles.sectionLabel}>Visualization</p>
          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <h3 className={styles.chartTitle}>Monthly revenue trend</h3>
              <p className={styles.chartSubtitle}>Last six month buckets for completed trips.</p>
            </div>
            {monthlyData.length === 0 ? (
              <div className={styles.emptyState}>No monthly aggregates available.</div>
            ) : (
              <div className={styles.chartBody}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyData} margin={chartMargin}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                    <YAxis tickFormatter={yAxisTickCompact} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} width={56} />
                    <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="value" name="Revenue" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 3, fill: '#7c3aed' }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </section>
      )}

      {metric === 'driver' && (
        <>
          <section className={styles.section}>
            <p className={styles.sectionLabel}>Visualization</p>
            <div className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <h3 className={styles.chartTitle}>Top drivers by earnings</h3>
                <p className={styles.chartSubtitle}>Ranking for the selected dashboard period.</p>
              </div>
              {topDrivers.length === 0 ? (
                <div className={styles.emptyState}>No driver earnings in this range.</div>
              ) : (
                <div className={styles.chartBody}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topDrivers} layout="vertical" margin={{ ...chartMargin, left: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                      <XAxis type="number" tickFormatter={yAxisTickCompact} tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis dataKey="label" type="category" width={130} tick={{ fontSize: 11, fill: '#475569' }} />
                      <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={tooltipStyle} />
                      <Bar dataKey="value" name="Earnings" fill="#059669" radius={[0, 6, 6, 0]} barSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </section>

          <div className={styles.divider} />

          <section className={styles.section}>
            <p className={styles.sectionLabel}>Breakdown</p>
            <h4 className={styles.tableSectionTitle}>Driver leaderboard</h4>
            {driverRows.length === 0 ? (
              <div className={styles.emptyState}>No rows to display.</div>
            ) : (
              <>
                <div className={styles.tableWrap}>
                  <table className={styles.dataTable}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Driver</th>
                      <th className={styles.textRight}>Earnings</th>
                      <th className={styles.textRight}>Share</th>
                      <th>Performance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {driverRows.map((row, idx) => {
                      const e = Number(row.earnings) || 0;
                      const pct = maxDriverEarnings > 0 ? Math.round((e / maxDriverEarnings) * 1000) / 10 : 0;
                      const shareTotal = summaryAmount > 0 ? Math.round((e / summaryAmount) * 1000) / 10 : 0;
                      return (
                        <tr key={row.driver_id || row.driver_name} className={idx === 0 ? styles.topRank : ''}>
                          <td className={styles.rankCell}>{idx + 1}</td>
                          <td>{getDriverDisplay(row)}</td>
                          <td className={`${styles.textRight} ${styles.amountMono}`}>{formatCurrency(row.earnings)}</td>
                          <td className={`${styles.textRight} ${styles.amountMono}`}>{shareTotal}%</td>
                          <td>
                            <div className={styles.progressTrack}>
                              <div className={styles.progressFill} style={{ width: `${pct}%` }} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  </table>
                </div>
                <PanelPagination
                  page={Number(payload?.page || 1)}
                  totalPages={Number(payload?.total_pages || 1)}
                  limit={Number(payload?.limit || PAGE_LIMIT)}
                  totalCount={Number(payload?.total_count || 0)}
                  onPageChange={setPage}
                />
              </>
            )}
          </section>
        </>
      )}

      {metric === 'pending' && (
        <section className={styles.section}>
          <p className={styles.sectionLabel}>Outstanding</p>
          <h4 className={styles.tableSectionTitle}>Pending payments</h4>
          {sortedPending.length === 0 ? (
            <div className={styles.emptyState}>No pending payments in the selected range.</div>
          ) : (
            <>
              <div className={styles.tableWrap}>
                <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th
                      className={styles.sortTh}
                      onClick={() => togglePendingSort('booking_id')}
                      title="Sort"
                    >
                      Booking ID {pendingSort.key === 'booking_id' ? (pendingSort.dir === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th
                      className={styles.sortTh}
                      onClick={() => togglePendingSort('customer')}
                      title="Sort"
                    >
                      Customer {pendingSort.key === 'customer' ? (pendingSort.dir === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th
                      className={`${styles.textRight} ${styles.sortTh}`}
                      onClick={() => togglePendingSort('amount')}
                      title="Sort"
                    >
                      Amount {pendingSort.key === 'amount' ? (pendingSort.dir === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th className={styles.textRight}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPending.map((row) => {
                    const st = String(row.status || '').toLowerCase();
                    const paid = st === 'paid' || st === 'completed';
                    return (
                      <tr key={row.booking_id}>
                        <td className={styles.amountMono}>#{row.booking_id}</td>
                        <td>{getCustomerDisplay(row)}</td>
                        <td className={`${styles.textRight} ${styles.amountMono}`}>{formatCurrency(row.amount)}</td>
                        <td className={styles.textRight}>
                          <span className={`${styles.statusBadge} ${paid ? styles.statusPaid : styles.statusPending}`}>
                            {row.status || 'pending'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                </table>
              </div>
              <PanelPagination
                page={Number(payload?.page || 1)}
                totalPages={Number(payload?.total_pages || 1)}
                limit={Number(payload?.limit || PAGE_LIMIT)}
                totalCount={Number(payload?.total_count || 0)}
                onPageChange={setPage}
              />
            </>
          )}
        </section>
      )}
    </div>
  );
};

export default RevenueDetailsPanel;
