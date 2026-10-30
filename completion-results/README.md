# Ember & Table completion evidence

[Implementation, setup and limitations](../docs/RESTAURANT-COMPLETION.md) · [Verified checks](checks.json) · [Preservation hashes](preservation.json)

The branch implements real reservation persistence and availability, authenticated staff management/linked POS checks, configured delivery rules, Visit/contact/legal pages, and public-navigation cleanup. Main was not merged and the application was not deployed.

**All configured schedules, addresses, phone numbers, delivery areas and guests in these screenshots are explicit automated QA fixtures in an isolated test database. They are not real business information. The source seed leaves reservations closed until actual operating information and floor capacity are configured.** Tests restore unconfigured settings and remove their bookings/orders/accounts.

| Customer view                                         | Desktop 1440px                                   | Mobile 390px                                    |
| ----------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------- |
| Bookings closed before configuration                  | [Screenshot](reservations-unconfigured-1440.png) | [Screenshot](reservations-unconfigured-390.png) |
| Reservation form with real test-database availability | [Screenshot](reservation-form-1440.png)          | [Screenshot](reservation-form-390.png)          |
| Persisted private confirmation                        | [Screenshot](reservation-confirmation-1440.png)  | [Screenshot](reservation-confirmation-390.png)  |
| Contact page with missing facts marked                | [Screenshot](contact-unconfigured-1440.png)      | [Screenshot](contact-unconfigured-390.png)      |

Staff: [business settings](staff-business-1280.png) · [reservation management](staff-reservations-1280.png) · [linked seated POS order](staff-seated-order-1280.png).

Existing design/function regressions: [cooking video desktop](video/playing-1440.png) · [cooking video mobile](video/playing-390.png) · [decoded video frames](video/playback-390.json) · [homepage desktop](motion/homepage-1440.png) · [homepage mobile](motion/homepage-390.png) · [POS kitchen](pos/pos-kitchen-1280x800.png).

Build, lint, typecheck, **42 unit**, **29 PostgreSQL integration**, and **33 production Chromium browser tests** pass. Checks cover simultaneous bookings and retries, direct-SQL overlap/physical-seat enforcement, overdue seating, capacity, permissions, private tokens, delivery fees/minimums, actual order/payment persistence, lost-response recovery, slow-network loading/errors, navigation, noindex, cooking-video playback and reduced motion. Physical-device/remote-deployment performance is unverified.
