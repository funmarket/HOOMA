# HOOMA API

All first-party authenticated endpoints are under `/api/v1`. Provider callbacks are outside that namespace.

Authentication header:

```text
Authorization: tma <Telegram initData>
```

Error envelope:

```json
{
  "error": {
    "code": "EVENT_FULL",
    "message": "This match is currently full.",
    "requestId": "..."
  }
}
```

## Identity

- `GET /api/v1/me`
- `PATCH /api/v1/me/profile`

## Communities

- `GET /api/v1/communities`
- `POST /api/v1/communities`
- `POST /api/v1/communities/join`
- `POST /api/v1/communities/join/invite`
- `POST /api/v1/communities/:communityId/switch`
- `GET /api/v1/communities/:communityId`
- `GET/PATCH /api/v1/communities/:communityId/payment-defaults`
- `GET /api/v1/communities/:communityId/members`
- `PATCH /api/v1/communities/:communityId/members/:membershipId`
- `POST /api/v1/communities/:communityId/ownership/transfer`
- `GET/POST /api/v1/communities/:communityId/invites`
- `DELETE /api/v1/communities/:communityId/invites/:inviteId`

## Events / RSVP

- `GET /api/v1/events`
- `POST /api/v1/events`
- `GET /api/v1/events/:eventId`
- `PATCH /api/v1/events/:eventId`
- `POST /api/v1/events/:eventId/cancel`
- `POST /api/v1/events/:eventId/rsvp`
- `DELETE /api/v1/events/:eventId/rsvp`

Internal admin-route Event cancellation is exposed through `/api/v1/admin/events/:eventId`; user-facing management terminology is Coach / Coach Control Room.

## Requests

- `GET /api/v1/requests`
- `POST /api/v1/requests`
- `POST /api/v1/requests/:requestId/claims`
- `DELETE /api/v1/requests/:requestId/claims/me`

## Rides

- `GET /api/v1/rides`
- `POST /api/v1/rides/offers`
- `POST /api/v1/rides/requests`
- `POST /api/v1/rides/offers/:offerId/matches`
- `PATCH /api/v1/rides/offers/:offerId/status`
- `PATCH /api/v1/rides/offers/:offerId/matches/:matchId`
- `POST /api/v1/rides/offers/:offerId/location`
- `POST /api/v1/rides/offers/:offerId/ratings`

## FundMe

- `GET /api/v1/fundraisers`
- `POST /api/v1/fundraisers`
- `POST /api/v1/fundraisers/:fundraiserId/contributions` (`Idempotency-Key` required)

## Play

- `GET /api/v1/play/events/:eventId/teams/randomize`
- `GET /api/v1/play/events/:eventId/formations`
- `POST /api/v1/play/events/:eventId/formations`
- `PUT /api/v1/play/events/:eventId/formations/:formationId`
- `POST /api/v1/play/events/:eventId/formations/:formationId/publish`

## Whistle

- `GET /api/v1/whistles/communities/:communityId`
- `POST /api/v1/whistles/communities/:communityId`

Both routes require an authenticated **active member** of the target community. A Whistle body is trimmed and limited to **33 Unicode graphemes**. The POST body is:

```json
{ "body": "North stand now" }
```

Whistle is a transient Redis-backed signal system, not permanent Chat. Every canonical user receives **11 total Whistles per UTC calendar day across every Whistle context combined**. Unused Whistles do not roll over. The quota and all current-day Whistle messages reset/disappear at the next **00:00 UTC**.

Successful feed responses include `day`, `dailyLimit`, `remaining`, `resetAt`, and `items`. Successful sends return the same daily metadata plus the new `item`. `resetAt` is an ISO timestamp for the next UTC midnight.

When the daily quota is exhausted, POST returns HTTP `429` with error code `WHISTLE_DAILY_LIMIT_REACHED` and details containing `dailyLimit`, `remaining`, and `resetAt`. If Redis cannot safely enforce/read Whistle state, the route fails closed with HTTP `503` and code `WHISTLE_UNAVAILABLE`; the API never falls back to an in-memory Whistle quota.

There is intentionally no Whistle history, archive, delete, per-viewer reveal, or permanent message endpoint. PostgreSQL does not persist Whistle bodies.

## Watch

- `GET /api/v1/watch/clubs`
- `GET/POST /api/v1/watch/hubs`
- `POST /api/v1/watch/events/:eventId/check-in`
- `GET /api/v1/watch/events/:eventId/deals`
- `POST /api/v1/watch/deals`

## Chat

- `GET /api/v1/chat/events/:eventId`
- `POST /api/v1/chat/events/:eventId`
- `DELETE /api/v1/chat/events/:eventId/messages/:messageId`

Messages are currently delivered via polling; collection paging uses an opaque cursor.

## Payments

- `GET /api/v1/payments/digital/products?communityId=...`
- `PUT /api/v1/payments/digital/products/supporter-badge`
- `POST /api/v1/payments/digital/stars` (`Idempotency-Key` required)
- `GET /api/v1/payments/:paymentIntentId`
- `POST /api/v1/payments/:paymentIntentId/cancel`
- `POST /api/v1/payments/:paymentIntentId/cash/confirm`
- `POST /api/v1/payments/:paymentIntentId/cash/void`
- `POST /api/v1/payments/:paymentIntentId/stars/refund`

## Admin (internal route namespace)

- `GET /api/v1/admin/communities`
- `GET /api/v1/admin/communities/:communityId/dashboard`
- `GET /api/v1/admin/communities/:communityId/payments`
- `GET /api/v1/admin/communities/:communityId/audit`
- `PATCH /api/v1/admin/communities/:communityId/members/:membershipId/ban`
- `DELETE /api/v1/admin/events/:eventId` (cancel, not physical delete)

The `/admin` route namespace and `ADMIN` permission values are technical interfaces and may remain even though the product presents authorized management as Coach / Coach Control Room.

## Webhooks

- `POST /webhooks/telegram`

The Telegram webhook is authenticated with `X-Telegram-Bot-Api-Secret-Token`.
