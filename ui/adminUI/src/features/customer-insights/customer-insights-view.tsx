"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Users,
  Download,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  DollarSign,
  PieChart,
  Sparkles,
  Award,
  Layers,
  CheckCircle,
  Table as TableIcon,
  MapPin,
  Info,
} from "lucide-react";
import {
  fetchCustomerInsights,
  exportInsightsCSV,
  formatVND,
  formatNumber,
  type CustomerInsightsReport,
} from "./customer-insights-data";
import { PieChartSVG } from "./pie-chart-svg";
import styles from "./customer-insights.module.css";

const GENDER_COLORS: Record<string, string> = {
  Nam: "#14a800",
  Nữ: "#e84393",
  Khác: "#9b59b6",
  "Chưa xác định": "#95a5a6",
};

const AGE_COLORS: Record<string, string> = {
  "Dưới 18": "#06b6d4",
  "18 - 24": "#14a800",
  "25 - 34": "#3b82f6",
  "35 - 44": "#f59e0b",
  "Từ 45 trở lên": "#8b5cf6",
  "Chưa có ngày sinh": "#94a3b8",
};

const CATEGORY_COLORS = [
  "#10b981",
  "#3b82f6",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f97316",
  "#64748b",
];

const AGE_TAB_OPTIONS = [
  "Tất cả",
  "Dưới 18",
  "18 - 24",
  "25 - 34",
  "35 - 44",
  "Từ 45 trở lên",
  "Chưa có ngày sinh",
];

const GENDER_TAB_OPTIONS = [
  "Tất cả",
  "Nam",
  "Nữ",
  "Khác",
  "Chưa xác định",
];

export function CustomerInsightsView() {
  const [period, setPeriod] = useState<"month" | "quarter" | "year">("month");
  const [statusScope, setStatusScope] = useState<"ACTIVE" | "COMPLETED">("ACTIVE");
  const [viewMode, setViewMode] = useState<"chart" | "table">("chart");
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<string>("Tất cả");
  const [selectedGender, setSelectedGender] = useState<string>("Tất cả");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cityMetric, setCityMetric] = useState<"revenue" | "orders">("revenue");
  const [report, setReport] = useState<CustomerInsightsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadData = () => {
    setLoading(true);
    setError(null);
    const controller = new AbortController();

    fetchCustomerInsights(period, controller.signal, undefined, undefined, statusScope)
      .then((data) => {
        setReport(data);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(err.message || "Lỗi khi tải dữ liệu phân tích.");
          setLoading(false);
        }
      });

    return () => controller.abort();
  };

  useEffect(() => {
    return loadData();
  }, [period, statusScope]);

  const handlePeriodChange = (newPeriod: "month" | "quarter" | "year") => {
    startTransition(() => {
      setPeriod(newPeriod);
    });
  };

  const handleScopeChange = (newScope: "ACTIVE" | "COMPLETED") => {
    startTransition(() => {
      setStatusScope(newScope);
    });
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.heading}>
        <div className={styles.headingTitle}>
          <h1>
            <Users size={26} color="#14a800" /> Phân tích khách hàng & Thị hiếu sản phẩm
          </h1>
          <p>
            Thống kê nhân khẩu học, mức độ chi tiêu trung bình và thị hiếu tiêu dùng nhằm định hướng phát triển hệ thống
          </p>
        </div>
        <div className={styles.headingActions}>
          <button
            type="button"
            className={styles.btn}
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCw size={16} /> Làm mới
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => report && exportInsightsCSV(report)}
            disabled={!report || loading}
          >
            <Download size={16} /> Xuất CSV
          </button>
        </div>
      </div>

      {/* Period & Scope Filter Card */}
      <div className={styles.periodCard}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div className={styles.periodTabs}>
            <button
              type="button"
              className={`${styles.periodTab} ${statusScope === "ACTIVE" ? styles.periodTabActive : ""}`}
              onClick={() => handleScopeChange("ACTIVE")}
              title="Tính mọi đơn chưa hủy (Mới, Xác nhận, Đang chuẩn bị, Đang giao, Hoàn thành) để đo lường toàn bộ nhu cầu thị trường"
            >
              Đơn có hiệu lực (Tổng cầu)
            </button>
            <button
              type="button"
              className={`${styles.periodTab} ${statusScope === "COMPLETED" ? styles.periodTabActive : ""}`}
              onClick={() => handleScopeChange("COMPLETED")}
              title="Chỉ tính các đơn đã hoàn tất"
            >
              Chỉ đơn hoàn thành
            </button>
          </div>

          <div className={styles.periodTabs}>
            <button
              type="button"
              className={`${styles.periodTab} ${period === "month" ? styles.periodTabActive : ""}`}
              onClick={() => handlePeriodChange("month")}
            >
              Theo Tháng
            </button>
            <button
              type="button"
              className={`${styles.periodTab} ${period === "quarter" ? styles.periodTabActive : ""}`}
              onClick={() => handlePeriodChange("quarter")}
            >
              Theo Quý
            </button>
            <button
              type="button"
              className={`${styles.periodTab} ${period === "year" ? styles.periodTabActive : ""}`}
              onClick={() => handlePeriodChange("year")}
            >
              Theo Năm
            </button>
          </div>
        </div>

        <span className={styles.periodNote}>
          {statusScope === "ACTIVE"
            ? "Đang phân tích tổng cầu từ mọi đơn chưa hủy để tìm hướng đầu tư phát triển"
            : "Đang phân tích doanh số từ các đơn đã giao thành công"}
        </span>
      </div>

      {/* Content States */}
      {loading ? (
        <div className={styles.stateBox}>
          <span>Đang tổng hợp dữ liệu thống kê CRM…</span>
        </div>
      ) : error ? (
        <div className={`${styles.stateBox} ${styles.errorBox}`}>
          <span>{error}</span>
        </div>
      ) : report ? (
        <>
          {/* KPI Summary Cards */}
          <div className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <div className={styles.metricHeader}>
                <span>Tổng khách hàng</span>
                <span className={styles.metricIcon}>
                  <Users size={18} />
                </span>
              </div>
              <div className={styles.metricValue}>
                {formatNumber(report.summary.total_customers)}
              </div>
              <div className={styles.metricSub}>
                {formatNumber(report.summary.active_buyers)} khách đã phát sinh đơn đặt
              </div>
            </div>

            <div className={styles.metricCard}>
              <div className={styles.metricHeader}>
                <span>
                  {statusScope === "ACTIVE" ? "Tổng nhu cầu đơn đặt" : "Doanh thu (Đơn hoàn thành)"}
                </span>
                <span className={styles.metricIcon}>
                  <DollarSign size={18} />
                </span>
              </div>
              <div className={styles.metricValue}>
                {formatVND(report.summary.total_revenue)}
              </div>
              <div className={styles.metricSub}>
                Từ {formatNumber(report.summary.total_orders)} {statusScope === "ACTIVE" ? "đơn đặt có hiệu lực" : "đơn hoàn thành"}
              </div>
            </div>

            <div className={styles.metricCard}>
              <div className={styles.metricHeader}>
                <span>Giá trị đơn TB (AOV)</span>
                <span className={styles.metricIcon}>
                  <ShoppingBag size={18} />
                </span>
              </div>
              <div className={styles.metricValue}>
                {formatVND(report.summary.aov)}
              </div>
              <div className={styles.metricSub}>
                {statusScope === "ACTIVE" ? "Quy mô trung bình mỗi đơn đặt" : "Doanh thu TB / Đơn hoàn tất"}
              </div>
            </div>

            <div className={styles.metricCard}>
              <div className={styles.metricHeader}>
                <span>Chi tiêu TB/Khách (ARPU)</span>
                <span className={styles.metricIcon}>
                  <TrendingUp size={18} />
                </span>
              </div>
              <div className={styles.metricValue}>
                {formatVND(report.summary.arpu)}
              </div>
              <div className={styles.metricSub}>
                {statusScope === "ACTIVE" ? "Nhu cầu TB / Khách hàng đặt" : "Doanh thu TB / Khách đã mua"}
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* KHUNG TỔNG HỢP: ĐỘ TUỔI, GIỚI TÍNH & SẢN PHẨM TRÊN 1 KHUNG    */}
          {/* ============================================================ */}
          {(() => {
            const isAllAges = selectedAgeGroup === "Tất cả";
            const ageDetails = report.demographics.by_age_group || [];
            const currentDetail =
              ageDetails.find((d) => d.group === selectedAgeGroup) ||
              (isAllAges
                ? ageDetails.find((d) => d.group === "Tất cả") || {
                    group: "Tất cả",
                    customer_count: report.summary.total_customers,
                    customer_percentage: 100,
                    active_buyers: report.summary.active_buyers,
                    total_orders: report.summary.total_orders,
                    revenue: report.summary.total_revenue,
                    gender: report.demographics.gender,
                    top_categories: report.product_insights.top_categories,
                    top_products: report.product_insights.top_products,
                    by_gender: report.demographics.by_gender || [],
                    gender_category_matrix: report.demographics.gender_category_matrix || [],
                  }
                : {
                    group: selectedAgeGroup,
                    customer_count: 0,
                    customer_percentage: 0,
                    active_buyers: 0,
                    total_orders: 0,
                    revenue: "0",
                    gender: [],
                    top_categories: [],
                    top_products: [],
                    by_gender: [],
                    gender_category_matrix: [],
                  });

            const genderDetails =
              currentDetail.by_gender && currentDetail.by_gender.length > 0
                ? currentDetail.by_gender
                : isAllAges
                ? report.demographics.by_gender || []
                : [];
            const currentGenderDetail =
              genderDetails.find((g) => g.label === selectedGender) ||
              genderDetails.find((g) => g.label === "Tất cả");

            const matrix =
              currentDetail.gender_category_matrix && currentDetail.gender_category_matrix.length > 0
                ? currentDetail.gender_category_matrix
                : isAllAges
                ? report.demographics.gender_category_matrix || []
                : [];

            // 1. Slices for Age Groups
            const ageSlices = report.demographics.age_groups.map((ag) => ({
              label: ag.group,
              value: ag.value,
              percentage: ag.percentage,
              color: AGE_COLORS[ag.group] || "#64748b",
            }));

            // 2. Slices for Gender (interactive with Category if selected)
            const catRow = selectedCategory
              ? matrix.find((m) => m.category_name === selectedCategory)
              : null;
            const catTotal = catRow ? catRow.total_quantity : 0;

            const genderSlices = catRow
              ? [
                  {
                    label: "Nam",
                    value: catRow.nam_quantity,
                    percentage:
                      catTotal > 0
                        ? Number(((catRow.nam_quantity / catTotal) * 100).toFixed(1))
                        : 0,
                    color: GENDER_COLORS["Nam"],
                    subtext: formatVND(catRow.nam_revenue),
                  },
                  {
                    label: "Nữ",
                    value: catRow.nu_quantity,
                    percentage:
                      catTotal > 0
                        ? Number(((catRow.nu_quantity / catTotal) * 100).toFixed(1))
                        : 0,
                    color: GENDER_COLORS["Nữ"],
                    subtext: formatVND(catRow.nu_revenue),
                  },
                  {
                    label: "Khác",
                    value: catRow.khac_quantity,
                    percentage:
                      catTotal > 0
                        ? Number(((catRow.khac_quantity / catTotal) * 100).toFixed(1))
                        : 0,
                    color: GENDER_COLORS["Khác"],
                    subtext: formatVND(catRow.khac_revenue),
                  },
                  {
                    label: "Chưa xác định",
                    value: catRow.chua_xac_dinh_quantity,
                    percentage:
                      catTotal > 0
                        ? Number(
                            ((catRow.chua_xac_dinh_quantity / catTotal) * 100).toFixed(1)
                          )
                        : 0,
                    color: GENDER_COLORS["Chưa xác định"],
                    subtext: formatVND(catRow.chua_xac_dinh_revenue),
                  },
                ]
              : currentDetail.gender.map((g) => ({
                  label: g.label,
                  value: g.value,
                  percentage: g.percentage,
                  color: GENDER_COLORS[g.label] || "#95a5a6",
                }));

            const genderTitle = catRow
              ? `2. Cơ cấu Giới tính mua "${selectedCategory}"${selectedAgeGroup !== "Tất cả" ? ` (${selectedAgeGroup})` : ""}`
              : `2. Cơ cấu Giới tính (${selectedAgeGroup})`;
            const genderCenterLabel = catRow
              ? formatNumber(catTotal)
              : formatNumber(currentDetail.customer_count);
            const genderCenterSub = catRow ? "sản phẩm bán" : "khách";

            // 3. Slices for Categories (interactive with Gender if selected)
            const activeCategories =
              selectedGender !== "Tất cả" && currentGenderDetail
                ? currentGenderDetail.top_categories || []
                : currentDetail.top_categories || [];

            const categorySlices = activeCategories.map((cat, idx) => ({
              label: cat.category_name,
              value: cat.quantity_sold,
              percentage: cat.percentage,
              color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
              subtext: formatVND(cat.revenue),
            }));

            const categoryTotalSold = activeCategories.reduce(
              (acc, c) => acc + c.quantity_sold,
              0
            );
            const categoryTitle =
              selectedAgeGroup !== "Tất cả" && selectedGender !== "Tất cả"
                ? `3. Thị hiếu Ngành hàng (${selectedAgeGroup} • Khách ${selectedGender})`
                : selectedGender !== "Tất cả"
                ? `3. Thị hiếu Ngành hàng (Khách ${selectedGender})`
                : `3. Thị hiếu Ngành hàng (${selectedAgeGroup})`;

            const avgSpendingPerOrder =
              currentDetail.total_orders > 0
                ? formatVND(Number(currentDetail.revenue) / currentDetail.total_orders)
                : "0 đ";

            const handleGenderClick = (label: string) => {
              if (selectedGender === label) {
                setSelectedGender("Tất cả");
              } else {
                setSelectedGender(label);
                setSelectedCategory(null);
              }
            };

            const handleCategoryClick = (catName: string) => {
              if (selectedCategory === catName) {
                setSelectedCategory(null);
              } else {
                setSelectedCategory(catName);
                setSelectedGender("Tất cả");
              }
            };

            const handleResetCrossFilter = () => {
              setSelectedAgeGroup("Tất cả");
              setSelectedGender("Tất cả");
              setSelectedCategory(null);
            };

            return (
              <div className={styles.unifiedCard}>
                {/* Header & Control Tabs */}
                <div className={styles.unifiedHeader}>
                  <div className={styles.unifiedTitle}>
                    <h3>
                      <PieChart size={20} color="#14a800" /> Phân tích tương tác: Độ tuổi, Giới tính & Thị hiếu sản phẩm
                    </h3>
                    <p>
                      Khảo sát hành vi tiêu dùng chéo giữa các giới tính và ngành hàng để xác định chính xác đối tượng mua sắm
                    </p>
                  </div>

                  <div className={styles.unifiedToolbar}>
                    {/* View mode toggle (Pie Chart / Table) */}
                    <div className={styles.filterTabs}>
                      <button
                        type="button"
                        className={`${styles.filterTab} ${viewMode === "chart" ? styles.filterTabActive : ""}`}
                        onClick={() => setViewMode("chart")}
                        title="Xem dạng biểu đồ tròn trực quan"
                      >
                        <PieChart size={14} /> Biểu đồ tròn
                      </button>
                      <button
                        type="button"
                        className={`${styles.filterTab} ${viewMode === "table" ? styles.filterTabActive : ""}`}
                        onClick={() => setViewMode("table")}
                        title="Xem dạng bảng dữ liệu chi tiết"
                      >
                        <TableIcon size={14} /> Dạng bảng
                      </button>
                    </div>

                    {/* Age group filter tabs */}
                    <div className={styles.filterTabs}>
                      {AGE_TAB_OPTIONS.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          className={`${styles.filterTab} ${selectedAgeGroup === opt ? styles.filterTabActive : ""}`}
                          onClick={() => setSelectedAgeGroup(opt)}
                          title={`Xem nhóm tuổi: ${opt}`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>

                    {/* Gender filter tabs */}
                    <div className={styles.filterTabs}>
                      {GENDER_TAB_OPTIONS.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          className={`${styles.filterTab} ${selectedGender === opt && !selectedCategory ? styles.filterTabActive : ""}`}
                          onClick={() => handleGenderClick(opt)}
                          title={`Lọc thị hiếu theo giới tính: ${opt}`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Quick Summary Strip */}
                <div className={styles.quickStatsGrid}>
                  <div className={styles.quickStatBox}>
                    <span className={styles.quickStatLabel}>Khách hàng ({selectedAgeGroup})</span>
                    <span className={styles.quickStatVal}>
                      {formatNumber(currentDetail.customer_count)} khách
                    </span>
                    <span className={styles.quickStatSub}>
                      Chiếm {currentDetail.customer_percentage}% tổng tệp khách
                    </span>
                  </div>

                  <div className={styles.quickStatBox}>
                    <span className={styles.quickStatLabel}>Khách đã phát sinh mua</span>
                    <span className={styles.quickStatVal}>
                      {formatNumber(currentDetail.active_buyers)} khách
                    </span>
                    <span className={styles.quickStatSub}>
                      Từ {formatNumber(currentDetail.total_orders)} đơn đặt hàng
                    </span>
                  </div>

                  <div className={styles.quickStatBox}>
                    <span className={styles.quickStatLabel}>Tổng doanh thu ({selectedAgeGroup})</span>
                    <span className={styles.quickStatVal} style={{ color: "#14a800" }}>
                      {formatVND(currentDetail.revenue)}
                    </span>
                    <span className={styles.quickStatSub}>
                      Đóng góp vào doanh số hệ thống
                    </span>
                  </div>

                  <div className={styles.quickStatBox}>
                    <span className={styles.quickStatLabel}>Chi tiêu TB / Đơn</span>
                    <span className={styles.quickStatVal}>
                      {avgSpendingPerOrder}
                    </span>
                    <span className={styles.quickStatSub}>
                      Quy mô đơn bình quân của nhóm
                    </span>
                  </div>
                </div>

                {/* Interactive Cross-Filter Notice */}
                {(selectedGender !== "Tất cả" || selectedCategory !== null || selectedAgeGroup !== "Tất cả") && (
                  <div className={styles.interactionNotice}>
                    <div className={styles.interactionNoticeLeft}>
                      <Info size={16} />
                      <span>
                        {selectedCategory
                          ? `Đang tương tác chéo: Xem cơ cấu giới tính khách hàng đã mua ngành hàng "${selectedCategory}"${selectedAgeGroup !== "Tất cả" ? ` (Nhóm tuổi ${selectedAgeGroup})` : ""}`
                          : selectedGender !== "Tất cả"
                          ? `Đang tương tác chéo: Xem thị hiếu ngành hàng của khách hàng "${selectedGender}"${selectedAgeGroup !== "Tất cả" ? ` trong nhóm tuổi ${selectedAgeGroup}` : ""}`
                          : `Đang lọc theo nhóm tuổi: ${selectedAgeGroup}`}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={styles.interactionNoticeBtn}
                      onClick={handleResetCrossFilter}
                    >
                      ✕ Xem tất cả dữ liệu
                    </button>
                  </div>
                )}

                {/* Content: Chart or Table */}
                {viewMode === "chart" ? (
                  <div className={styles.pieGrid}>
                    {/* 1. Age Group Donut */}
                    <PieChartSVG
                      title="1. Phân bổ Khoảng độ tuổi"
                      slices={ageSlices}
                      centerLabel={formatNumber(report.summary.total_customers)}
                      centerSub="khách hàng"
                      emptyText="Chưa có khách hàng"
                      valueUnit="khách"
                      selectedLabel={selectedAgeGroup}
                      onSliceClick={(label) => setSelectedAgeGroup(label)}
                      interactiveHint="Nhấp để đổi độ tuổi"
                    />

                    {/* 2. Gender Donut (Interactive) */}
                    <PieChartSVG
                      title={genderTitle}
                      slices={genderSlices}
                      centerLabel={genderCenterLabel}
                      centerSub={genderCenterSub}
                      emptyText="Chưa có thông tin"
                      valueUnit="khách"
                      selectedLabel={selectedGender !== "Tất cả" ? selectedGender : null}
                      onSliceClick={handleGenderClick}
                      interactiveHint={catRow ? "Lọc theo ngành hàng" : "Nhấp để lọc ngành hàng"}
                    />

                    {/* 3. Products/Categories (Interactive) */}
                    <PieChartSVG
                      title={categoryTitle}
                      slices={categorySlices}
                      centerLabel={formatNumber(categoryTotalSold)}
                      centerSub="sản phẩm bán"
                      emptyText="Chưa có đơn hàng"
                      valueUnit="sản phẩm"
                      selectedLabel={selectedCategory}
                      onSliceClick={handleCategoryClick}
                      interactiveHint="Nhấp để lọc giới tính"
                    />
                  </div>
                ) : (
                  <div>
                    <div className={styles.tableViewGrid}>
                      {/* Table 1: Age Groups */}
                      <div className={styles.tableCardBlock}>
                        <h4 className={styles.pieBlockTitle}>Bảng 1: Phân bổ các nhóm tuổi</h4>
                        <table className={styles.miniTable}>
                          <thead>
                            <tr>
                              <th>Khoảng độ tuổi</th>
                              <th>Số khách</th>
                              <th>Tỷ lệ</th>
                              <th>Đã mua</th>
                            </tr>
                          </thead>
                          <tbody>
                            {report.demographics.age_groups.map((ag) => {
                              const isSelected = selectedAgeGroup === ag.group;
                              const detail = ageDetails.find((d) => d.group === ag.group);
                              return (
                                <tr
                                  key={ag.group}
                                  className={isSelected ? styles.miniTableRowActive : ""}
                                  style={{ cursor: "pointer" }}
                                  onClick={() => setSelectedAgeGroup(ag.group)}
                                  title="Bấm để lọc theo nhóm tuổi này"
                                >
                                  <td>
                                    <span
                                      style={{
                                        display: "inline-block",
                                        width: 8,
                                        height: 8,
                                        borderRadius: "50%",
                                        backgroundColor: AGE_COLORS[ag.group] || "#64748b",
                                        marginRight: 6,
                                      }}
                                    />
                                    {ag.group}
                                  </td>
                                  <td>
                                    <strong>{formatNumber(ag.value)}</strong>
                                  </td>
                                  <td>{ag.percentage}%</td>
                                  <td>{detail ? formatNumber(detail.active_buyers) : "—"}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Table 2: Gender */}
                      <div className={styles.tableCardBlock}>
                        <h4 className={styles.pieBlockTitle}>
                          {genderTitle}
                        </h4>
                        <table className={styles.miniTable}>
                          <thead>
                            <tr>
                              <th>Giới tính</th>
                              <th>Số lượng</th>
                              <th>Tỷ lệ (%)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {genderSlices.map((g) => {
                              const isSelected = selectedGender === g.label;
                              return (
                                <tr
                                  key={g.label}
                                  className={isSelected ? styles.miniTableRowActive : ""}
                                  style={{ cursor: "pointer" }}
                                  onClick={() => handleGenderClick(g.label)}
                                  title={`Nhấp để xem thị hiếu của khách hàng ${g.label}`}
                                >
                                  <td>
                                    <span
                                      style={{
                                        display: "inline-block",
                                        width: 8,
                                        height: 8,
                                        borderRadius: "50%",
                                        backgroundColor: g.color || "#95a5a6",
                                        marginRight: 6,
                                      }}
                                    />
                                    {g.label}
                                  </td>
                                  <td>
                                    <strong>{formatNumber(g.value)}</strong> {catRow ? "sp" : "khách"}
                                  </td>
                                  <td>{g.percentage}%</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Table 3: Products / Categories */}
                      <div className={styles.tableCardBlock}>
                        <h4 className={styles.pieBlockTitle}>
                          {categoryTitle}
                        </h4>
                        {activeCategories.length === 0 ? (
                          <div className={styles.pieEmptyHint}>
                            Chưa có đơn hàng cho phân loại này.
                          </div>
                        ) : (
                          <table className={styles.miniTable}>
                            <thead>
                              <tr>
                                <th>Ngành hàng</th>
                                <th>Số lượng</th>
                                <th>Doanh thu</th>
                                <th>Tỷ trọng</th>
                              </tr>
                            </thead>
                            <tbody>
                              {activeCategories.map((c, idx) => {
                                const isSelected = selectedCategory === c.category_name;
                                return (
                                  <tr
                                    key={c.category_id || idx}
                                    className={isSelected ? styles.miniTableRowActive : ""}
                                    style={{ cursor: "pointer" }}
                                    onClick={() => handleCategoryClick(c.category_name)}
                                    title={`Nhấp để xem cơ cấu giới tính mua ${c.category_name}`}
                                  >
                                    <td>
                                      <span
                                        style={{
                                          display: "inline-block",
                                          width: 8,
                                          height: 8,
                                          borderRadius: "50%",
                                          backgroundColor:
                                            CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
                                          marginRight: 6,
                                        }}
                                      />
                                      {c.category_name}
                                    </td>
                                    <td>
                                      <strong>{formatNumber(c.quantity_sold)}</strong>
                                    </td>
                                    <td style={{ color: "#14a800" }}>{formatVND(c.revenue)}</td>
                                    <td>{c.percentage}%</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>

                    {/* BẢNG MA TRẬN TƯƠNG QUAN CHÉO: GIỚI TÍNH x NGÀNH HÀNG */}
                    {matrix.length > 0 && (
                      <div className={styles.matrixSection}>
                        <div className={styles.matrixHeader}>
                          <div>
                            <h4 className={styles.matrixTitle}>
                              <TableIcon size={16} color="#14a800" /> Bảng ma trận tương quan: Thị hiếu Ngành hàng theo Giới tính {selectedAgeGroup !== "Tất cả" ? `(${selectedAgeGroup})` : ""}
                            </h4>
                            <p className={styles.matrixSubtitle}>
                              Đối chiếu trực tiếp số lượng và doanh thu từng loại sản phẩm được mua bởi các nhóm giới tính {selectedAgeGroup !== "Tất cả" ? `trong nhóm tuổi ${selectedAgeGroup}` : ""} (Nhấp vào một ngành hàng để xem chi tiết trên biểu đồ)
                            </p>
                          </div>
                        </div>
                        <div className={styles.matrixTableWrapper}>
                          <table className={styles.matrixTable}>
                            <thead>
                              <tr>
                                <th>Ngành hàng / Sản phẩm</th>
                                <th>Khách Nam (SL / DT)</th>
                                <th>Khách Nữ (SL / DT)</th>
                                <th>Giới tính Khác</th>
                                <th>Chưa xác định</th>
                                <th>Tổng cộng</th>
                              </tr>
                            </thead>
                            <tbody>
                              {matrix.length === 0 ? (
                                <tr>
                                  <td colSpan={6} style={{ textAlign: "center", padding: "2.5rem 1rem", color: "#64748b" }}>
                                    Không có dữ liệu đơn hàng nào cho nhóm {selectedAgeGroup !== "Tất cả" ? `tuổi "${selectedAgeGroup}"` : "khách hàng này"} trong kỳ đã chọn.
                                  </td>
                                </tr>
                              ) : (
                                matrix.map((row) => {
                                  const isRowSelected = selectedCategory === row.category_name;
                                  return (
                                    <tr
                                      key={row.category_id}
                                      style={{
                                        cursor: "pointer",
                                        background: isRowSelected ? "#e8f5e9" : undefined,
                                      }}
                                      onClick={() => handleCategoryClick(row.category_name)}
                                      title="Nhấp để lọc biểu đồ giới tính theo ngành hàng này"
                                    >
                                      <td>
                                        <strong>{row.category_name}</strong>
                                      </td>
                                      <td>
                                        <span>{formatNumber(row.nam_quantity)} sp</span>
                                        <span className={styles.matrixSub}>{formatVND(row.nam_revenue)}</span>
                                      </td>
                                      <td>
                                        <span>{formatNumber(row.nu_quantity)} sp</span>
                                        <span className={styles.matrixSub}>{formatVND(row.nu_revenue)}</span>
                                      </td>
                                      <td>
                                        <span>{formatNumber(row.khac_quantity)} sp</span>
                                        <span className={styles.matrixSub}>{formatVND(row.khac_revenue)}</span>
                                      </td>
                                      <td>
                                        <span>{formatNumber(row.chua_xac_dinh_quantity)} sp</span>
                                        <span className={styles.matrixSub}>{formatVND(row.chua_xac_dinh_revenue)}</span>
                                      </td>
                                      <td>
                                        <strong style={{ color: "#14a800" }}>{formatNumber(row.total_quantity)} sp</strong>
                                        <span className={styles.matrixSub} style={{ fontWeight: 600, color: "#14a800" }}>
                                          {formatVND(row.total_revenue)}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                            <tfoot>
                              <tr className={styles.matrixTableTotalRow}>
                                <td>Tổng toàn bộ</td>
                                <td>
                                  {formatNumber(matrix.reduce((acc, r) => acc + r.nam_quantity, 0))} sp
                                  <span className={styles.matrixSub}>
                                    {formatVND(matrix.reduce((acc, r) => acc + Number(r.nam_revenue), 0))}
                                  </span>
                                </td>
                                <td>
                                  {formatNumber(matrix.reduce((acc, r) => acc + r.nu_quantity, 0))} sp
                                  <span className={styles.matrixSub}>
                                    {formatVND(matrix.reduce((acc, r) => acc + Number(r.nu_revenue), 0))}
                                  </span>
                                </td>
                                <td>
                                  {formatNumber(matrix.reduce((acc, r) => acc + r.khac_quantity, 0))} sp
                                  <span className={styles.matrixSub}>
                                    {formatVND(matrix.reduce((acc, r) => acc + Number(r.khac_revenue), 0))}
                                  </span>
                                </td>
                                <td>
                                  {formatNumber(matrix.reduce((acc, r) => acc + r.chua_xac_dinh_quantity, 0))} sp
                                  <span className={styles.matrixSub}>
                                    {formatVND(matrix.reduce((acc, r) => acc + Number(r.chua_xac_dinh_revenue), 0))}
                                  </span>
                                </td>
                                <td>
                                  <span style={{ color: "#14a800", fontWeight: 700 }}>
                                    {formatNumber(matrix.reduce((acc, r) => acc + r.total_quantity, 0))} sp
                                  </span>
                                  <span className={styles.matrixSub} style={{ color: "#14a800", fontWeight: 700 }}>
                                    {formatVND(matrix.reduce((acc, r) => acc + Number(r.total_revenue), 0))}
                                  </span>
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Section 1: Demographics & Interests */}
          <div className={styles.twoColGrid}>
            {/* Phân bố khu vực mua hàng (Theo thành phố giao hàng) */}
            <div className={styles.card}>
              <div className={styles.cardHeader} style={{ alignItems: "flex-start", gap: 12 }}>
                <div>
                  <h3>
                    <MapPin size={18} color="#14a800" /> Phân bố khu vực mua hàng (Theo thành phố)
                  </h3>
                  <p>
                    Thống kê theo địa chỉ giao hàng được chọn của đơn hàng / hóa đơn
                  </p>
                </div>

                {/* Small toggle button group matching image */}
                <div className={styles.periodTabs} style={{ alignSelf: "flex-start" }}>
                  <button
                    type="button"
                    className={`${styles.periodTab} ${cityMetric === "revenue" ? styles.periodTabActive : ""}`}
                    onClick={() => setCityMetric("revenue")}
                  >
                    Theo Doanh thu
                  </button>
                  <button
                    type="button"
                    className={`${styles.periodTab} ${cityMetric === "orders" ? styles.periodTabActive : ""}`}
                    onClick={() => setCityMetric("orders")}
                  >
                    Theo Số đơn hàng
                  </button>
                </div>
              </div>

              {/* City Horizontal Bar Chart */}
              {(() => {
                const cities = report.city_distribution || [];
                if (cities.length === 0) {
                  return (
                    <p style={{ margin: "16px 0", color: "#667085", fontSize: 13, fontStyle: "italic" }}>
                      Chưa có đơn hàng để tổng hợp phân bố khu vực.
                    </p>
                  );
                }

                const sortedCities = [...cities].sort((a, b) =>
                  cityMetric === "revenue"
                    ? parseFloat(b.revenue) - parseFloat(a.revenue)
                    : b.order_count - a.order_count
                );

                const maxVal =
                  cityMetric === "revenue"
                    ? Math.max(1, ...sortedCities.map((c) => parseFloat(c.revenue)))
                    : Math.max(1, ...sortedCities.map((c) => c.order_count));

                return (
                  <div className={styles.cityList}>
                    {sortedCities.map((c, idx) => {
                      const valNum = cityMetric === "revenue" ? parseFloat(c.revenue) : c.order_count;
                      const fillPct = Math.min(100, Math.max(3, (valNum / maxVal) * 100));
                      const rankClass =
                        idx === 0
                          ? styles.rankGold
                          : idx === 1
                          ? styles.rankSilver
                          : idx === 2
                          ? styles.rankBronze
                          : styles.rankDefault;

                      return (
                        <div key={c.city} className={styles.cityBarRow}>
                          <div className={styles.cityBarHeader}>
                            <div className={styles.cityBarLeft}>
                              <span className={`${styles.cityRankBadge} ${rankClass}`}>
                                #{idx + 1}
                              </span>
                              <div>
                                <div className={styles.cityName}>{c.city}</div>
                                <span className={styles.cityMeta}>
                                  {formatNumber(c.customer_count)} khách mua · {formatNumber(c.order_count)} đơn
                                </span>
                              </div>
                            </div>
                            <div className={styles.cityBarRight}>
                              <span className={styles.cityBarVal}>
                                {cityMetric === "revenue" ? formatVND(c.revenue) : `${formatNumber(c.order_count)} đơn`}
                              </span>
                              <span className={styles.cityBarPct}>
                                ({cityMetric === "revenue" ? `${c.percentage}%` : `${c.order_percentage}%`})
                              </span>
                            </div>
                          </div>
                          <div className={styles.cityBarTrack}>
                            <div
                              className={styles.cityBarFill}
                              style={{ width: `${fillPct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Interests & Needs */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h3>
                    <Sparkles size={18} color="#14a800" /> Thị hiếu & Nhu cầu khách hàng
                  </h3>
                  <p>Phân tích thị hiếu tiêu dùng dựa trên danh mục ngành hàng và đơn hàng thực tế</p>
                </div>
              </div>

              <div className={styles.progressList}>
                {report.demographics.interests.length > 0 ? (
                  report.demographics.interests.map((item) => (
                    <div className={styles.progressItem} key={item.category}>
                      <div className={styles.progressInfo}>
                        <span>{item.category}</span>
                        <strong>
                          {formatNumber(item.count)} sản phẩm đã mua ({item.percentage}%)
                        </strong>
                      </div>
                      <div className={styles.progressBarTrack}>
                        <div
                          className={styles.progressBarFill}
                          style={{
                            width: `${Math.min(100, Math.max(4, item.percentage))}%`,
                            backgroundColor: "#16a085",
                          }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p style={{ margin: "16px 0", color: "#667085", fontSize: 13, fontStyle: "italic" }}>
                    Chưa có đơn hàng hoàn thành để tổng hợp thị hiếu ngành hàng.
                  </p>
                )}
              </div>

              {/* Customer Segments */}
              <div style={{ marginTop: 24 }}>
                <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "#253320" }}>
                  Phân tầng giá trị khách hàng (Customer Segments)
                </h4>
                <div className={styles.segmentList}>
                  {report.spending_trends.customer_segments.map((seg) => (
                    <div className={styles.segmentItem} key={seg.segment}>
                      <div>
                        <div className={styles.segmentTitle}>{seg.segment}</div>
                        <div className={styles.segmentCount}>
                          {formatNumber(seg.count)} khách ({seg.percentage}%)
                        </div>
                      </div>
                      <div className={styles.segmentRevenue}>
                        <strong>{formatVND(seg.revenue)}</strong>
                        <small>tổng chi tiêu</small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Spending Trends Timeline */}
          <div className={styles.card} style={{ marginBottom: 24 }}>
            <div className={styles.cardHeader}>
              <div>
                <h3>
                  <TrendingUp size={18} color="#14a800" /> Mức độ chi tiêu trung bình theo {period === "month" ? "Tháng" : period === "quarter" ? "Quý" : "Năm"}
                </h3>
                <p>Theo dõi biến động số lượng đơn, tổng doanh thu và giá trị chi tiêu bình quân</p>
              </div>
            </div>

            {report.spending_trends.timeline.length === 0 ? (
              <p style={{ textAlign: "center", color: "#8c9784", padding: "20px 0" }}>
                Chưa có dữ liệu giao dịch trong kỳ đã chọn.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className={styles.timelineTable}>
                  <thead>
                    <tr>
                      <th>Kỳ thống kê</th>
                      <th>Số đơn hoàn thành</th>
                      <th>Tổng doanh thu</th>
                      <th>Chi tiêu trung bình / Đơn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.spending_trends.timeline.map((row) => (
                      <tr key={row.period}>
                        <td>
                          <strong>{row.label}</strong>
                        </td>
                        <td>{formatNumber(row.order_count)} đơn</td>
                        <td>{formatVND(row.revenue)}</td>
                        <td>
                          <span style={{ color: "#14a800", fontWeight: 700 }}>
                            {formatVND(row.avg_spending)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 3: Categories & Top Selling Products */}
          <div className={styles.productInsightsGrid}>
            {/* Top Categories */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h3>
                    <Layers size={18} color="#14a800" /> Loại sản phẩm được mua nhiều nhất
                  </h3>
                  <p>Doanh thu và tỷ trọng đóng góp của từng nhóm ngành hàng</p>
                </div>
              </div>

              <div className={styles.progressList}>
                {report.product_insights.top_categories.map((cat) => (
                  <div className={styles.progressItem} key={cat.category_id}>
                    <div className={styles.progressInfo}>
                      <span>{cat.category_name}</span>
                      <strong>
                        {formatVND(cat.revenue)} ({cat.percentage}%)
                      </strong>
                    </div>
                    <div className={styles.progressBarTrack}>
                      <div
                        className={styles.progressBarFill}
                        style={{
                          width: `${Math.min(100, Math.max(3, cat.percentage))}%`,
                          backgroundColor: "#2980b9",
                        }}
                      />
                    </div>
                    <small style={{ color: "#8c9784", fontSize: 11 }}>
                      Đã bán: {formatNumber(cat.quantity_sold)} sản phẩm
                    </small>
                  </div>
                ))}
              </div>
            </div>

            {/* Top 10 Products */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h3>
                    <Award size={18} color="#14a800" /> Top sản phẩm bán chạy nhất
                  </h3>
                  <p>Xếp hạng các sản phẩm có sản lượng bán ra cao nhất</p>
                </div>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table className={styles.timelineTable}>
                  <thead>
                    <tr>
                      <th>Sản phẩm</th>
                      <th style={{ width: 100, textAlign: "right", whiteSpace: "nowrap" }}>Số lượng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.product_insights.top_products.slice(0, 8).map((prod, idx) => (
                      <tr key={prod.sku}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{prod.name}</div>
                          <small style={{ color: "#788771", fontSize: 11 }}>
                            #{idx + 1} · {prod.category_name}
                          </small>
                        </td>
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          <strong>{formatNumber(prod.quantity_sold)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

