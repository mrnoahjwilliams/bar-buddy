import type { DisplayMeasurement } from '@/api/generated/models';

export function measurement(value?: DisplayMeasurement) {
  if (!value) return '';
  const quantity =
    value.quantity == null
      ? ''
      : `${value.quantity}${value.maximumQuantity == null ? '' : `–${value.maximumQuantity}`}`;
  return [value.modifier, quantity, value.unit].filter(Boolean).join(' ');
}
