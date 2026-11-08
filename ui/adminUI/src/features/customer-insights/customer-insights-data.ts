import { adminFetch } from "@internal/lib/admin-fetch";

export type CustomerInsightsSummary = {
  total_customers: number;
  active_buyers: number;
  total_orders: number;
  total_revenue: string;
  aov: string;
  arpu: string;
  status_scope?: string;
};

export type GenderItem = {
  label: string;
  value: number;
  percentage: number;
};

export type AgeGroupItem = {
  group: string;
  value: number;
  percentage: number;
};

export type InterestItem = {
  category: string;
  count: number;
  percentage: number;
};

export type TimelinePoint = {
  period: string;
  label: string;
  order_count: number;
  revenue: string;
  avg_spending: string;
};

export type CustomerSegment = {
  segment: string;
  count: number;
  percentage: number;
  revenue: string;
};

export type SpendingTrendsData = {
  period_type: "month" | "quarter" | "year";
  timeline: TimelinePoint[];
  customer_segments: CustomerSegment[];
};

export type TopCategoryItem = {
  category_id: string;
  category_name: string;
  quantity_sold: number;
  revenue: string;
  percentage: number;
};

export type TopProductItem = {
  sku: string;
  name: string;
  category_name: string;
  quantity_sold: number;
  revenue: string;
};

export type AgeGroupDetail = {
  group: string;
  customer_count: number;
  customer_percentage: number;
  active_buyers: number;
  total_orders: number;
  revenue: string;
  gender: GenderItem[];
  top_categories: TopCategoryItem[];
  top_products: TopProductItem[];
  by_gender?: GenderDetail[];
  gender_category_matrix?: GenderCategoryMatrixItem[];
};

export type GenderDetail = {
  label: string;
  key: string;
  customer_count: number;
  customer_percentage: number;
  active_buyers: number;
  total_orders: number;
  revenue: string;
  top_categories: TopCategoryItem[];
  top_products: TopProductItem[];
};

export type GenderCategoryMatrixItem = {
  category_id: string;
  category_name: string;
  total_quantity: number;
  total_revenue: string;
  nam_quantity: number;
  nam_revenue: string;
  nu_quantity: number;
  nu_revenue: string;
  khac_quantity: number;
  khac_revenue: string;
  chua_xac_dinh_quantity: number;
  chua_xac_dinh_revenue: string;
};

export type ProductInsightsData = {
  top_categories: TopCategoryItem[];
  top_products: TopProductItem[];
};

export type StrategicRecommendation = {
  type: string;
  title: string;
  content: string;
};

export type RatingBreakdownItem = {
  stars: number;
  count: number;
  percentage: number;
};

export type RecentFeedbackItem = {
  customer_name: string;
  overall_score: number;
  product_score: number;
  service_score: number;
  comment: string | null;
  created_at: string;
};

export type SurveyInsightsData = {
  total_surveys: number;
  total_responses: number;
  avg_overall_score: number;
  avg_product_score: number;
  avg_service_score: number;
  rating_breakdown: RatingBreakdownItem[];
  recent_feedbacks: RecentFeedbackItem[];
};

export type CityDistributionItem = {
  city: string;
  order_count: number;
  customer_count: number;
  revenue: string;
  percentage: number;
  order_percentage: number;
};

export type DemographicsData = {
  gender: GenderItem[];
  age_groups: AgeGroupItem[];
  interests: InterestItem[];
  by_age_group?: AgeGroupDetail[];
  by_gender?: GenderDetail[];
  gender_category_matrix?: GenderCategoryMatrixItem[];
};

export type CustomerInsightsReport = {
  summary: CustomerInsightsSummary;
  demographics: DemographicsData;
  spending_trends: SpendingTrendsData;
  product_insights: ProductInsightsData;
  survey_insights: SurveyInsightsData;
  strategic_recommendations: StrategicRecommendation[];
  city_distribution?: CityDistributionItem[];
};

export function formatVND(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0 đ";
  return num.toLocaleString("vi-VN") + " đ";
}

export function formatNumber(value: number): string {
  return value.toLocaleString("vi-VN");
}

export async function fetchCustomerInsights(
  period: "month" | "quarter" | "year",
  signal?: AbortSignal,
  start?: string,
  end?: string,
  statusScope: "ACTIVE" | "COMPLETED" = "ACTIVE"
): Promise<CustomerInsightsReport> {
  const params = new URLSearchParams({ period, status_scope: statusScope });
  if (start) params.set("start", start);
  if (end) params.set("end", end);

  const response = await adminFetch(
    `/api/backend/crm/analytics/customer-insights?${params.toString()}`,
    { signal, cache: "no-store" }
  );

  if (!response.ok) {
    const errorJson = await response.json().catch(() => null);
    const detail =
      errorJson?.detail || "Không thể tải báo cáo phân tích khách hàng.";
    throw new Error(detail);
  }

  return response.json();
}

export function exportInsightsCSV(report: CustomerInsightsReport): void {
  const lines: string[] = [];
  lines.push("BÁO CÁO PHÂN TÍCH TỆP KHÁCH HÀNG & THỊ HIẾU SẢN PHẨM");
  lines.push(`Thời gian xuất,${new Date().toLocaleString("vi-VN")}`);
  lines.push("");

  // 1. Tóm tắt
  lines.push("1. CHỈ SỐ TỔNG QUAN");
  lines.push("Chỉ số,Giá trị");
  lines.push(`Tổng số khách hàng,${report.summary.total_customers}`);
  lines.push(`Khách hàng phát sinh mua hàng,${report.summary.active_buyers}`);
  lines.push(`Tổng số đơn hàng hoàn thành,${report.summary.total_orders}`);
  lines.push(`Tổng doanh thu,${report.summary.total_revenue}`);
  lines.push(`Giá trị đơn trung bình (AOV),${report.summary.aov}`);
  lines.push(`Chi tiêu trung bình / khách hàng (ARPU),${report.summary.arpu}`);
  lines.push("");

  // 2. Giới tính
  lines.push("2. PHÂN BỐ GIỚI TÍNH");
  lines.push("Giới tính,Số lượng,Tỷ lệ (%)");
  for (const g of report.demographics.gender) {
    lines.push(`"${g.label}",${g.value},${g.percentage}%`);
  }
  lines.push("");

  // 3. Độ tuổi
  lines.push("3. PHÂN BỐ ĐỘ TUỔI");
  lines.push("Nhóm tuổi,Số lượng,Tỷ lệ (%)");
  for (const ag of report.demographics.age_groups) {
    lines.push(`"${ag.group}",${ag.value},${ag.percentage}%`);
  }
  lines.push("");

  // 4. Chi tiêu theo kỳ
  lines.push(`4. XU HƯỚNG CHI TIÊU (${report.spending_trends.period_type.toUpperCase()})`);
  lines.push("Kỳ,Số đơn hoàn thành,Tổng doanh thu,Chi tiêu trung bình/đơn");
  for (const p of report.spending_trends.timeline) {
    lines.push(`"${p.label}",${p.order_count},${p.revenue},${p.avg_spending}`);
  }
  lines.push("");

  // 5. Top sản phẩm
  lines.push("5. TOP SẢN PHẨM BÁN CHẠY");
  lines.push("SKU,Tên sản phẩm,Danh mục,Số lượng bán,Doanh thu");
  for (const p of report.product_insights.top_products) {
    lines.push(`"${p.sku}","${p.name.replace(/"/g, '""')}","${p.category_name}",${p.quantity_sold},${p.revenue}`);
  }
  lines.push("");

  // Ma trận Giới tính x Ngành hàng
  if (report.demographics.gender_category_matrix && report.demographics.gender_category_matrix.length > 0) {
    lines.push("MA TRẬN TƯƠNG QUAN: THỊ HIẾU NGÀNH HÀNG THEO GIỚI TÍNH");
    lines.push("Ngành hàng,Khách Nam (SL),Khách Nam (DT),Khách Nữ (SL),Khách Nữ (DT),Khác (SL),Khác (DT),Chưa xác định (SL),Chưa xác định (DT),Tổng SL,Tổng DT");
    for (const m of report.demographics.gender_category_matrix) {
      lines.push(`"${m.category_name}",${m.nam_quantity},${m.nam_revenue},${m.nu_quantity},${m.nu_revenue},${m.khac_quantity},${m.khac_revenue},${m.chua_xac_dinh_quantity},${m.chua_xac_dinh_revenue},${m.total_quantity},${m.total_revenue}`);
    }
    lines.push("");
  }

  // 6. Khảo sát & CSAT
  if (report.survey_insights) {
    lines.push("6. KẾT QUẢ KHẢO SÁT & ĐÁNH GIÁ (CSAT)");
    lines.push(`Tổng bài khảo sát,${report.survey_insights.total_surveys}`);
    lines.push(`Tổng lượt đánh giá,${report.survey_insights.total_responses}`);
    lines.push(`Điểm đánh giá chung TB (/5),${report.survey_insights.avg_overall_score}`);
    lines.push(`Điểm sản phẩm TB (/5),${report.survey_insights.avg_product_score}`);
    lines.push(`Điểm dịch vụ TB (/5),${report.survey_insights.avg_service_score}`);
    lines.push("");
    lines.push("Mức sao,Số lượng,Tỷ lệ (%)");
    for (const rb of report.survey_insights.rating_breakdown) {
      lines.push(`${rb.stars} sao,${rb.count},${rb.percentage}%`);
    }
  }

  // 7. Khu vực mua hàng
  if (report.city_distribution && report.city_distribution.length > 0) {
    lines.push("");
    lines.push("7. PHÂN BỐ KHU VỰC MUA HÀNG (ĐỊA CHỈ GIAO HÀNG)");
    lines.push("Khu vực (Thành phố/Tỉnh),Số đơn,Số khách,Doanh thu,Tỷ trọng DT (%)");
    for (const c of report.city_distribution) {
      lines.push(`"${c.city}",${c.order_count},${c.customer_count},${c.revenue},${c.percentage}%`);
    }
  }

  const csvContent = "\uFEFF" + lines.join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `customer-insights-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

