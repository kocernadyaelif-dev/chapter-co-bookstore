# Development and reflection record

Implementation record from the assisted build, 8 October 2026. This does not claim
tutor approval, interviews or a student's personal learning. Add your genuine experience.

| Milestone | Decision/observation | Result and reflection point |
| --- | --- | --- |
| Concept | Fictional bookstore, guest checkout, Python/SQLite from the start | Bounded domain, concrete fields and complete journey |
| Cart | SQLite cart under an opaque cookie | State survives navigation/restart. Browser controls no prices |
| Checkout | One transaction for order, stock and cart clearing | Prevents partial orders and overselling |
| UI | Fetch JSON and DOM updates | AJAX demonstrated without a frontend framework |
| Duplicate actions | Unique checkout key and disabled button | Repeat requests return the same order |
| Invalid IDs | Review exposed oversized IDs as a possible SQLite binding overflow | Added explicit numeric bounds to return a client error |
| Verification | 24 integration tests, including competing stock requests | Checks state invariants and actual data changes |

Core scope remains intact. Search, filtering and sorting are small additions. Login,
admin and payments were excluded at conception, not dropped after a failed attempt.
No invented framework switch or tutor-directed change is recorded.

## Personal reflection to complete

- What did you implement/review/modify yourself? Name the file/function.
- Explain a click-to-database request in your own words.
- Which test changed your understanding of state or transactions?
- Which choice would you change, and what would you gain/lose?
- What genuine tutor feedback did you receive and how did you apply it?

| Phase | Submitted | Feedback | Action/revised version |
| --- | --- | --- | --- |
| 1 | Pending | Pending | Pending |
| 2 | Pending | Pending | Pending |

Do not replace these fields with fictional dates or feedback.
