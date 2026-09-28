"use client";

import { useState } from "react";
import {
  Accordion, Breadcrumb, Button, Checkbox, ColorSwatch, FilterOption, IconButton, Chevron,
  Pagination, Price, ProductCard, QuantityInput, Radio, Rating, SelectField,
  SpecsTable, StockStatus, SummaryRow, TabNav, TextField, TextButton,
} from "@/components/common";
import styles from "./preview.module.css";

export function ComponentPreview() {
  const [page, setPage] = useState(1);
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");
  const [color, setColor] = useState("red");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);

  return (
    <div className={styles.preview}>
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Common components" }]} />
      <h1>Tech Store · Common components</h1>
      <p className={styles.intro}>Các thành phần dùng chung từ thiết kế Tech Store. Dữ liệu và thao tác trên trang này là ví dụ để kiểm tra giao diện.</p>

      <section id="buttons"><h2>Buttons & navigation</h2>
        <div className={styles.row}>
          <Button size="large" onClick={() => setMessage("Đã nhấn nút chính.")}>Add to Cart</Button>
          <Button variant="outlinePrimary" onClick={() => setMessage("Đã chọn Our Deals.")}>Our Deals</Button>
          <Button variant="outline" onClick={() => setMessage("Đã chọn Continue Shopping.")}>Continue Shopping</Button>
          <Button variant="dark" onClick={() => setMessage("Đã cập nhật giỏ hàng mẫu.")}>Update Shopping Cart</Button>
          <Button disabled>Disabled</Button>
          <TextButton onClick={() => setMessage("Đã nhấn liên kết dạng nút.")}>Learn more</TextButton>
          <IconButton label="Next example" onClick={() => setMessage("Đã nhấn nút icon.")}><Chevron /></IconButton>
        </div>
        <TabNav activeHref="#specs" items={[{ label: "About Product", href: "#products" }, { label: "Details", href: "#forms" }, { label: "Specs", href: "#specs" }]} />
        <Pagination currentPage={page} totalPages={12} onPageChange={setPage} />
        <p>Trang đang chọn: <output>{page}</output></p>
      </section>

      <section id="products"><h2>Product card, price, rating & stock</h2>
        <div className={styles.row}>
          <ProductCard name="PC PHUB Creator RTX — cấu hình đồ họa và gaming" href="#specs" imageSrc="/images/about/quality.webp" amount={24380000} originalAmount={25990000} currency="VND" locale="vi-VN" rating={4} reviewCount={4} />
          <ProductCard name="PC PHUB Starter — reusable card with actions" href="#specs" imageSrc="/images/about/quality.webp" amount={10490000} originalAmount={11990000} currency="VND" locale="vi-VN" rating={4.5} reviewCount={12} stock="in-stock" actions={<Button variant="outlinePrimary" onClick={() => setMessage(`Đã thêm ${quantity} sản phẩm vào giỏ hàng mẫu.`)}>Add to Cart</Button>} />
          <div className={styles.stack}>
            <StockStatus status="in-stock" /><StockStatus status="check-availability" />
            <Rating value={3.5} reviewCount={8} />
            <Price amount={12990000} originalAmount={14990000} currency="VND" locale="vi-VN" />
            <label htmlFor="demo-quantity">Quantity (1–5)</label>
            <QuantityInput id="demo-quantity" value={quantity} onValueChange={setQuantity} max={5} />
            <output>Số lượng: {quantity}</output>
          </div>
        </div>
      </section>

      <section id="forms"><h2>Form controls</h2>
        <form className={styles.form} onSubmit={event => { event.preventDefault(); setSubmitted(true); setMessage(email ? "Đã kiểm tra biểu mẫu mẫu, không gửi dữ liệu." : "Vui lòng nhập email."); }} noValidate>
          <TextField label="Email" name="email" type="email" placeholder="Your Email" required value={email} onChange={event => setEmail(event.target.value)} error={submitted && !email ? "Vui lòng nhập email." : undefined} />
          <TextField label="Password" type="password" name="password" placeholder="Your Password" autoComplete="new-password" hint="Ví dụ ô nhập mật khẩu." />
          <SelectField label="State/Province" name="region" required defaultValue="" options={[{ label: "Please, select a region, state or province", value: "", disabled: true }, { label: "Hồ Chí Minh", value: "hcm" }, { label: "Hà Nội", value: "hn" }]} />
          <TextField label="Disabled field" disabled value="Read-only example" />
          <fieldset className={styles.stack}><legend>Shipping method</legend>
            <Radio name="shipping" value="standard" defaultChecked label="Standard Rate — $21.00" />
            <Radio name="shipping" value="pickup" label="Pickup from store — $0.00" />
          </fieldset>
          <div className={styles.stack}><Checkbox label="Subscribe to newsletter" /><Checkbox label="Unavailable option" disabled /></div>
          <Button type="submit" size="large">Validate example</Button>
        </form>
      </section>

      <section id="filters"><h2>Filters & summary</h2>
        <div className={styles.columns}>
          <div className={styles.filterPanel}>
            <Accordion title="Category" open>{[{ label: "CUSTOM PCS", count: 15 }, { label: "MSI ALL-IN-ONE PCS", count: 45 }, { label: "HP/COMPAQ PCS", count: 1 }].map(item => <FilterOption key={item.label} {...item} selected={categories.includes(item.label)} onClick={() => setCategories(current => current.includes(item.label) ? current.filter(label => label !== item.label) : [...current, item.label])} />)}</Accordion>
            <Accordion title="Color" open><fieldset className={styles.row}><legend className={styles.visuallyHidden}>Product color</legend>
              <ColorSwatch name="color" label="Black" color="#000000" value="black" checked={color === "black"} onChange={() => setColor("black")} />
              <ColorSwatch name="color" label="Red" color="#db0000" value="red" checked={color === "red"} onChange={() => setColor("red")} />
            </fieldset></Accordion>
          </div>
          <div className={styles.summary}><h3>Summary</h3>
            <Accordion title="Apply Discount Code"><TextField label="Discount code" placeholder="Enter Discount code" /><Button variant="outlinePrimary" onClick={() => setMessage("Mã giảm giá chỉ là ví dụ giao diện.")}>Apply Discount</Button></Accordion>
            <dl><SummaryRow label="Subtotal" value={`$${(499 * quantity).toLocaleString("en-US")}.00`} /><SummaryRow label="Shipping" value="$21.00" description="Standard Rate — shipping estimate for this example." /><SummaryRow label="Order Total" value={`$${(499 * quantity + 21).toLocaleString("en-US")}.00`} total /></dl>
          </div>
        </div>
      </section>

      <section id="specs"><h2>Specifications</h2><div className={styles.specs}>
        <SpecsTable rows={[{ label: "CPU", value: "N/A" }, { label: "Featured", value: "N/A" }, { label: "I/O Ports", value: "N/A" }]} />
      </div></section>
      <p role="status" className={styles.status}>{message || "Thử các nút, bộ lọc và ô nhập liệu ở trên."}</p>
    </div>
  );
}
