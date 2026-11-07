# Billing rules

Amounts are always integer cents. Percentage reductions go through `percentOff` in `money.ts`, which rounds half up. Don't multiply amounts by fractions anywhere else.
