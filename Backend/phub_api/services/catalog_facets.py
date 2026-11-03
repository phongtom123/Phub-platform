"""Facets derived only from explicit public product specifications in the selected type."""
from collections import Counter
import json
import re
import unicodedata

from phub_api.schemas.catalog import CatalogFacet, CatalogFacets, FacetOption


def folded(value):
    return "".join(char for char in unicodedata.normalize("NFD", value.casefold().replace("đ", "d")) if not unicodedata.combining(char)).strip()


ALIASES = {
    "gpu": ("gpu", "GPU"), "vga": ("gpu", "GPU"),
    "bo nho dem cache": ("bo-nho-dem", "Bộ nhớ đệm"), "bo nho dem": ("bo-nho-dem", "Bộ nhớ đệm"),
    "tdp tieu thu": ("tdp", "TDP"), "tdp": ("tdp", "TDP"),
}
DISPLAY_ORDER = {key: index for index, key in enumerate(["cpu", "gpu", "ram", "o-cung", "socket", "dung-luong", "chuan-ram", "bo-mach-chu", "nguon", "tan-nhiet", "vo-may-case", "mau-sac"])}


def product_attributes(product):
    attributes, labels = {}, {}
    for spec in product.specifications:
        label, value = spec.label.strip(), spec.value.strip()
        if not label or not value or len(label) > 100 or len(value) > 512 or folded(label) in {"thong so", "thong so ky thuat"}:
            continue
        canonical = ALIASES.get(folded(label))
        key = canonical[0] if canonical else re.sub(r"[^a-z0-9]+", "-", folded(label)).strip("-")
        if not key:
            continue
        attributes.setdefault(key, set()).add(value.casefold())
        labels.setdefault(key, (canonical[1] if canonical else label, {}))[1].setdefault(value.casefold(), value)
    return attributes, labels


def selections(values):
    selected = {}
    for encoded in values:
        key, value = json.loads(encoded)
        selected.setdefault(key, set()).add(value.casefold())
    return selected


def matches(attributes, selected, excluding=None):
    return all(key == excluding or bool(attributes.get(key, set()) & values) for key, values in selected.items())


def filter_products(products, values):
    selected = selections(values)
    return [product for product in products if matches(product_attributes(product)[0], selected)]


def build_facets(products, filters, available=None):
    selected = selections(filters.spec)
    indexed = [(product, *product_attributes(product)) for product in products]
    groups, brand_names = {}, {}
    types = {product.subcategory.id for product in products}
    for product, _, labels in indexed:
        for key, (label, choices) in labels.items():
            group = groups.setdefault(key, {"label": label, "choices": {}, "types": set()})
            group["choices"].update(choices)
            group["types"].add(product.subcategory.id)
        if product.brand:
            brand_names.setdefault(product.brand, product.brand)

    def base_match(product, *, brand=True):
        return ((not brand or not filters.brand or product.brand == filters.brand)
                and (filters.min_price is None or product.price >= filters.min_price)
                and (filters.max_price is None or product.price <= filters.max_price)
                and (not filters.color or (product.color is None if filters.color == "__unspecified__" else product.color and product.color.casefold() == filters.color.casefold()))
                and (not filters.stock_status or ((product.sku in available) == (filters.stock_status.value == "in-stock"))))

    counters = {key: Counter() for key in groups}
    brands = Counter()
    total = 0
    for product, attributes, _ in indexed:
        selected_match = matches(attributes, selected)
        if base_match(product, brand=False) and selected_match and product.brand:
            brands[product.brand] += 1
        if not base_match(product):
            continue
        total += int(selected_match)
        for key in groups:
            if matches(attributes, selected, excluding=key):
                counters[key].update(attributes.get(key, set()))
    specs = []
    for key, group in sorted(groups.items(), key=lambda item: (DISPLAY_ORDER.get(item[0], 100), folded(item[1]["label"]), item[0])):
        if group["types"] != types:
            continue
        specs.append(CatalogFacet(key=key, label=group["label"], options=[FacetOption(value=value, label=value, count=counters[key][normalized])
            for normalized, value in sorted(group["choices"].items())]))
    return CatalogFacets(specs=specs, brands=[FacetOption(value=name, label=name, count=brands[name]) for name in sorted(brand_names, key=folded)], total=total)
