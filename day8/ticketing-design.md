# TicketHub — Ticketing System Design

## 1. Requirements

### Functional requirements

- Users can browse events and view event details.
- Users can view available seats for a concert or event.
- Users can temporarily hold available seats for five minutes.
- Users can pay for their reservations using a payment provider.
- Users can view and access their purchased tickets.
- The system releases expired holds so other users can purchase those seats.
- The system sends booking confirmations and ticket notifications.

### Non-functional requirements

- **Consistency:** A seat must never be sold to two different users.
- **Availability:** The website should remain accessible during popular ticket sales.
- **Scalability:** The system must support two million registered users and sudden traffic increases.
- **Performance:** Event browsing should respond quickly, and users should receive clear updates during a queue or purchase.
- **Security:** Protect personal information, authenticate users, validate requests, and use a secure payment provider.
- **Reliability:** Record successful payments and bookings accurately, and recover from failures without issuing duplicate tickets.

## 2. Traffic and capacity estimates

### Normal traffic

The system receives 50,000 visitors per day, with each visitor viewing ten pages.

- Daily page views = 50,000 × 10 = **500,000 page views**
- Average page views per second = 500,000 ÷ 86,400 = **approximately 5.8 page views per second**
- Daily ticket sales = **5,000 tickets**
- Average ticket sales per second = 5,000 ÷ 86,400 = **approximately 0.058 tickets per second**

The average page-view rate is relatively low. However, actual traffic will fluctuate throughout the day, and API requests may exceed page views because a page can make multiple requests.

For an initial estimate, the system could plan for a normal peak of five times the average page-view rate, or approximately 29 page views per second. This is a planning assumption and should be adjusted using actual monitoring data.

### Popular concert sale

A popular concert has 20,000 seats, while 200,000 people attempt to buy tickets during the first ten minutes.

- Average attempted buyers per second = 200,000 ÷ 600 = **approximately 333 buyers per second**
- Seats available per second if all seats sell evenly = 20,000 ÷ 600 = **approximately 33 seats per second**
- Demand-to-seat ratio = 200,000 ÷ 20,000 = **10 buyers per seat**
- At most 10% of these potential buyers can obtain a seat if every buyer wants one seat and all seats are sold.

If each buyer makes three to five API requests during the purchase journey, the average could be approximately 1,000–1,667 API requests per second. Short bursts may be higher, so the system should be tested under several thousand requests per second.

### Comparison and response

Normal traffic averages approximately 5.8 page views per second, while the popular sale could generate around 333 purchase attempts per second before accounting for additional API calls. The sudden increase makes the ticket sale the more demanding workload.

TicketHub should use a virtual waiting room, rate limiting, multiple stateless application servers, caching for event information, and a durable database. Load testing and monitoring should help determine the capacity required for real traffic.

## 3. API design

The API uses REST principles and JSON responses. All endpoints use HTTPS, and protected endpoints require authentication.

| Method and endpoint | Purpose | Expected response |
|---|---|---|
| `GET /api/events` | Browse and search events | `200 OK` with a list of events |
| `GET /api/events/{eventId}/seats` | View the seats for an event and their current status | `200 OK` with seat information |
| `POST /api/events/{eventId}/holds` | Temporarily hold one or more available seats | `201 Created` if the hold succeeds |
| `POST /api/orders/{orderId}/payments` | Start payment for an order | `200 OK` or `202 Accepted`, depending on payment processing |
| `GET /api/tickets` | Retrieve tickets belonging to the authenticated user | `200 OK` with the user's tickets |
| `GET /api/orders/{orderId}` | Check an order's status | `200 OK` with order details |

### Example: hold seats

A request to hold seats could contain:

```json
{
  "seatIds": [101, 102]
}
```

The server checks whether all requested seats are available and attempts to reserve them in a database transaction. A successful response contains the hold ID, the held seats, and the expiry time.

If another user has already held or purchased a requested seat, the API returns `409 Conflict`. The client should refresh the seat information and ask the user to choose again.

### Error handling

- `400 Bad Request` — invalid input.
- `401 Unauthorized` — authentication is missing or invalid.
- `403 Forbidden` — the user is not permitted to perform the action.
- `404 Not Found` — the event, seat, order, or ticket does not exist.
- `409 Conflict` — a seat is no longer available or a booking conflicts with existing state.
- `429 Too Many Requests` — the client has exceeded a rate limit.
- `500 Internal Server Error` — an unexpected server error occurred.

Payment requests should use idempotency keys so that retrying a request does not create duplicate charges or orders. The server must validate all input and must not trust seat availability reported by the browser.

## 4. Data model

TicketHub uses a relational database such as PostgreSQL because ticket purchases require strong consistency and reliable transactions.

### Tables

**Users**

- `id` — primary key
- `name`
- `email` — unique
- `password_hash`
- `created_at`

**Events**

- `id` — primary key
- `title`
- `venue`
- `event_date`
- `status`

**Seats**

- `id` — primary key
- `event_id` — foreign key referencing Events
- `seat_number`
- `price`
- `status` — AVAILABLE, HELD, or SOLD
- `held_by_user_id` — nullable foreign key referencing Users
- `hold_expires_at` — nullable timestamp

A unique constraint on `(event_id, seat_number)` ensures that a seat number is not duplicated for the same event.

**Orders**

- `id` — primary key
- `user_id` — foreign key referencing Users
- `status` — PENDING, PAID, FAILED, or EXPIRED
- `total_amount`
- `created_at`

**OrderItems**

- `id` — primary key
- `order_id` — foreign key referencing Orders
- `seat_id` — foreign key referencing Seats
- `price_at_purchase`

A suitable uniqueness rule must prevent the same seat from being included in multiple active or completed purchases. The database should enforce this using a reservation model or appropriate unique constraints, rather than relying only on application checks.

**Payments**

- `id` — primary key
- `order_id` — foreign key referencing Orders
- `provider_payment_id` — unique payment-provider reference
- `idempotency_key` — unique request key
- `status`
- `amount`
- `created_at`

**Tickets**

- `id` — primary key
- `order_item_id` — foreign key referencing OrderItems
- `ticket_code` — unique
- `issued_at`

### Relationships

- One user can create many orders.
- One event has many seats.
- One order contains one or more order items.
- Each order item refers to a seat.
- One order can have payment attempts, with payment-provider references tracked safely.
- A successfully paid order item can produce one ticket.

### Preventing double booking

The relational database is the authoritative source of seat availability. The system must never rely on a cached seat map alone to decide whether a purchase can succeed.

When a user requests a hold, the server starts a transaction and locks the relevant seat rows. It checks availability and changes the seats from AVAILABLE to HELD, recording the user and a five-minute expiry time. If the seats are no longer available, the transaction fails and the user receives `409 Conflict`.

Conceptually, the update must be conditional:

```sql
UPDATE Seats
SET status = 'HELD',
    held_by_user_id = :user_id,
    hold_expires_at = :expiry_time
WHERE id = :seat_id
  AND status = 'AVAILABLE';
```

The server checks the number of rows updated. If it is not exactly one for each requested seat, the operation must not be treated as a successful hold. Multiple seats should be handled atomically so that a partial reservation is not left behind.

When payment succeeds, the system verifies that the hold belongs to the user and has not expired, then marks the seats SOLD and creates the ticket records in a transaction. Unique constraints, payment idempotency, and safe processing of payment-provider callbacks protect against duplicate sales and duplicate ticket issuance.

Expired holds are released through a scheduled worker or a safe transactional process. Payment and expiry processing must be coordinated so that a seat is not released while a valid payment is being confirmed.

## 5. Architecture diagram and components

```text
                   Users / Browsers
                          |
                          v
                    DNS and CDN
                          |
                          v
                    WAF / Rate Limit
                          |
                          v
                 Virtual Waiting Room
                          |
                          v
                    Load Balancer
                          |
             +------------+------------+
             |            |            |
             v            v            v
          API Server   API Server   API Server
             |            |            |
             +------------+------------+
                          |
             +------------+------------+
             |            |            |
             v            v            v
        Redis Cache   Relational DB   Payment Provider
        Event Data    Primary DB          |
        / Seat View   + Read Replicas     v
             |            |          Payment Webhooks
             |            |
             |            v
             |       Durable Message Queue
             |            |
             |            v
             |      Background Workers
             |       /            \
             |      v              v
             |  Notifications   Hold Expiry
             |
             v
       Fast Event Browsing

       Monitoring and Logging across all components
```

### Component explanations

- **DNS and CDN:** Direct users to the service and cache suitable static assets close to users.
- **Web application firewall and rate limiting:** Filter malicious traffic and reduce abuse.
- **Virtual waiting room:** Controls how many users enter the purchase flow at once. Queue tokens help manage demand fairly and reduce the risk of application overload.
- **Load balancer:** Distributes incoming requests across multiple application servers.
- **Stateless API servers:** Handle event browsing, seat holds, orders, and ticket requests. Additional instances can be added during a sale.
- **Redis cache:** Speeds up event details and other frequently accessed data. Cached seat information is only a display aid; the database confirms every hold and purchase.
- **Relational database:** Stores authoritative seat status, holds, orders, payments, and tickets. Transactions and constraints protect booking integrity.
- **Payment provider:** Processes payments without storing raw card details in TicketHub. Signed webhooks and idempotent processing confirm payment outcomes safely.
- **Durable message queue and background workers:** Process notifications, hold expiry, and other non-immediate work without blocking the main purchase request.
- **Monitoring and logging:** Track request rates, queue length, errors, payment failures, database load, and booking conflicts.

### Handling the popular sale

The waiting room limits how quickly customers enter the purchase flow. Multiple API servers process admitted users, while caching handles repeated event-page reads. The database serializes conflicting seat updates through transactions and locks. Background work is queued so that notifications do not overload the purchase path.

The system should also have load tests, database connection limits, backups, alerts, and a recovery plan. Read replicas may help with event browsing, but seat holds and purchase decisions must use authoritative transactional state.

## 6. Trade-offs

### Trade-off 1: Strong consistency versus read performance

Using a relational database with transactions and row locks makes seat sales safer, but conflicting requests may need to wait, reducing throughput. Caching and read replicas improve browsing performance, but their data may be stale. TicketHub accepts this trade-off by using cached data for browsing and the primary database for final seat confirmation and purchase.

### Trade-off 2: Waiting room fairness versus speed

A virtual waiting room reduces overload and gives the service more control over a large sale. However, customers may wait longer and feel frustrated. TicketHub should show queue progress and clear status updates, apply rate limits, and avoid allowing repeated refreshes to give users an unfair advantage.

### Trade-off 3: Temporary holds versus seat availability

Five-minute holds give customers time to pay and reduce conflicts during checkout. However, abandoned holds temporarily block seats from other buyers. TicketHub uses short, clearly displayed expiry times and reliable expiry processing to release abandoned reservations.

## Conclusion

TicketHub combines horizontally scalable application servers, a controlled waiting room, caching for read-heavy traffic, and a transactional relational database. Its most important rule is that a seat is only confirmed as sold after the authoritative database verifies the reservation and the payment workflow succeeds. This design supports normal browsing and helps manage concert-sale spikes while preventing double booking.