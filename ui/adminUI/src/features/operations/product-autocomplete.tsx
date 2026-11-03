"use client";
import { ReferenceAutocomplete, type AutocompleteProps } from "./reference-autocomplete";

export function ProductAutocomplete(props: AutocompleteProps) {
  return <ReferenceAutocomplete {...props} kind="product" />;
}

export function SupplierAutocomplete(props: AutocompleteProps) {
  return <ReferenceAutocomplete {...props} kind="supplier" />;
}
