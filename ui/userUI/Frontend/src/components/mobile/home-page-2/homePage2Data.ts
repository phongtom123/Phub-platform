import { catalogProducts } from "@/components/catalog/catalogData";

// The mobile artwork is exported from Figma's Home Page 2 product tiles.
const figmaPhotos = [
  "catalog-product-01.png", "catalog-product-06.png",
  "catalog-product-02.png", "catalog-product-07.png",
  "catalog-product-03.png", "catalog-product-08.png",
  "catalog-product-04.png", "catalog-product-09.png",
  "catalog-product-01.png", "catalog-product-10.png",
  "catalog-product-05.png", "catalog-product-06.png",
];

export const homePage2Products = catalogProducts.map((product, index) => ({
  ...product,
  name: index < 12 ? "HÀNG TRƯNG BÀY: MSI Pro 16 Flex-036AU 15,6 inch" : `HÀNG TRƯNG BÀY: MSI Pro 16 Flex-036AU - mẫu ${String(index + 1).padStart(2, "0")}`,
  mobileImageSrc: `/images/figma-mobile/${figmaPhotos[index % figmaPhotos.length]}`,
}));

export const homePage2SortOptions = [
  { value: "position", label: "Vị trí" },
  { value: "price-asc", label: "Giá: Thấp đến cao" },
  { value: "price-desc", label: "Giá: Cao đến thấp" },
  { value: "name", label: "Tên sản phẩm" },
];

export const homePage2Description = [
  "MSI đã giới thiệu dòng laptop Prestige dành cho công việc và giải trí. Dòng Prestige được tinh chỉnh để tái hiện màu sắc chính xác; công nghệ True Color cho phép bạn điều chỉnh cấu hình hiển thị phù hợp hơn với nhu cầu sử dụng máy tính.",
  "Có sáu cấu hình màn hình khác nhau, được tinh chỉnh cho chơi game, giảm mỏi mắt và nâng cao độ rõ nét của chữ và đường nét. Bộ lọc ánh sáng xanh giúp đôi mắt dễ chịu hơn, đồng thời tối ưu độ tương phản khi xem phim. Nhờ nhiều cấu hình hiển thị và khả năng xử lý đồ họa, laptop Prestige có thể phục vụ cả công việc văn phòng lẫn thiết kế. Bạn có thể điều chỉnh màn hình để tăng độ chính xác màu sắc hoặc giảm tình trạng mỏi mắt. Người dùng làm video hay dựng hình 3D cũng có thể chọn chế độ hiển thị phù hợp để quan sát chi tiết tốt hơn.",
  "Người dùng tại nhà hoặc học sinh, sinh viên có thể chọn chế độ giảm ánh sáng xanh và chế độ văn phòng để hạn chế mỏi mắt khi làm việc lâu. Điều này hữu ích khi bạn dùng máy tính liên tục để học tập hoặc hoàn thành công việc. Hãy khám phá các mẫu phía trên và chọn cấu hình phù hợp với mình.",
];
