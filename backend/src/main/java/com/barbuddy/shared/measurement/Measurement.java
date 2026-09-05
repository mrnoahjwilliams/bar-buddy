package com.barbuddy.shared.measurement;

import jakarta.persistence.Embeddable;
import java.math.BigDecimal;

/** A reviewed display measurement; US and metric values are stored independently. */
@Embeddable
public class Measurement {
  private BigDecimal quantity;
  private BigDecimal maximumQuantity;
  private String unit;
  private String modifier;

  protected Measurement() {}

  public BigDecimal getQuantity() {
    return quantity;
  }

  public BigDecimal getMaximumQuantity() {
    return maximumQuantity;
  }

  public String getUnit() {
    return unit;
  }

  public String getModifier() {
    return modifier;
  }
}
