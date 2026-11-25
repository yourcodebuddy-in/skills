const toCoupon = (row) =>
  row && {
    code: row.code,
    percentOff: row.percent_off,
    amountOffCents: row.amount_off_cents,
    minSubtotalCents: row.min_subtotal_cents,
    maxRedemptions: row.max_redemptions,
    redemptions: row.redemptions,
    expiresOn: row.expires_on,
    createdAt: row.created_at,
  };

export const couponRepo = (db) => {
  const byCode = db.prepare("SELECT * FROM coupons WHERE code = ?");

  return {
    find: (code) => toCoupon(byCode.get(code)),

    list: () => db.prepare("SELECT * FROM coupons ORDER BY created_at DESC").all().map(toCoupon),

    create: (coupon, now) => {
      db.prepare(
        `INSERT INTO coupons (code, percent_off, amount_off_cents, min_subtotal_cents, max_redemptions, expires_on, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        coupon.code,
        coupon.percentOff,
        coupon.amountOffCents,
        coupon.minSubtotalCents,
        coupon.maxRedemptions,
        coupon.expiresOn,
        now,
      );
      return toCoupon(byCode.get(coupon.code));
    },

    // Counts a use only while uses are left, so the last use can't be taken twice.
    redeem: (code) =>
      db
        .prepare(
          `UPDATE coupons SET redemptions = redemptions + 1
           WHERE code = ? AND (max_redemptions IS NULL OR redemptions < max_redemptions)`,
        )
        .run(code).changes === 1,

    release: (code) => {
      db.prepare("UPDATE coupons SET redemptions = redemptions - 1 WHERE code = ? AND redemptions > 0").run(code);
    },
  };
};
