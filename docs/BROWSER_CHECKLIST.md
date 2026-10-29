# Browser replay checklist

Use a seeded demo and fictional details. Targets: desktop 1280x900, mobile 390x844.

1. Open catalogue: twelve products, four genres. Search Mira: one product.
2. Filter Nature: three products. Verify low/high price sorting.
3. Open The Quiet Atlas and add twice: badge 2, one cart row, EUR 37.80.
4. Change quantity to 3: EUR 56.70. Reload: quantity remains 3.
5. Remove it: empty cart state. Visit checkout: empty-cart guidance.
6. Open Lines and Light: out-of-stock label and disabled add button.
7. Add The Quiet Atlas twice. Try empty checkout fields: required validation.
8. Enter fictional valid fields and acknowledge simulation. Place order.
9. Confirm CC-... ID, quantity 2, EUR 37.80 and cleared bag. Reload confirmation.
10. Private browser: separate empty bag and no access to another guest's order.
11. Inspect catalogue/detail/cart/checkout at mobile width. No horizontal overflow.
12. Use Tab: check focus, labels, skip link and toast feedback.
13. Restart server: check persistence. Run python tools/inspect_orders.py.
