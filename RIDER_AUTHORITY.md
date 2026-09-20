# LocalEats Rider authority

## LR2-C status

**IMPLEMENTED LOCALLY / NOT DEPLOYED**

The Rider App access-authority path is:

`Firebase Auth -> Rider App -> LocalEats API -> Supabase server authority`

Firebase supplies the signed-in Rider identity and ID token. The browser sends that token to the LocalEats API as `Authorization: Bearer fb-<token>`. The API, not browser database access, owns Rider profile, availability, connection, pairing, and delivery authorization decisions.

## API-owned Rider access

- `GET /api/v1/rider/profile` loads the canonical Rider profile.
- `POST /api/v1/rider/profile` creates or updates only `full_name`, `phone`, and `vehicle_type`.
- `PATCH /api/v1/rider/availability` changes `is_online` and must confirm the requested value.
- `GET /api/v1/rider/connections` returns canonical merchant relationships.
- `POST /api/v1/rider/connections/request` sends a six-digit invitation code. Sending an invitation is not approval.
- Connection states are `pending`, `approved`, or `rejected`. A merchant must approve the Rider; the Rider cannot self-approve or self-disconnect during the pilot.
- Available missions, mission claims, pickup, delivery start, and delivery completion remain authoritative through `src/services/riderDeliveryBackend.ts` and the LocalEats API.

Fake/local Rider authentication, fake Rider profiles, instant verification, hardcoded Rider GPS fallbacks, and browser-owned pairing authority have been removed from the active production path. Direct browser access to `rider_profiles` is no longer used for profile reads/writes, verification, availability, or profile GPS. Direct browser access to `rider_connections` is no longer used for relationship reads, pairing, approval, status, disconnect, or capacity checks.

## Separate legacy browser database subsystems still present

These have not been migrated by LR2-C and must not be described as API-authoritative:

- `rider_locations` is still used for actual-device-GPS telemetry during an active delivery.
- Push-token persistence remains a separate browser integration.
- Chat, notifications, and some order-display realtime subscriptions remain separate legacy browser integrations.
- A dormant profile-photo storage helper still contains legacy `rider_profiles` synchronization, but LR2-C parks profile-photo persistence and the active Rider App does not call that path.

The legacy visual dispatch simulator is restricted to Vite development builds. It is not rendered or executed in production and does not call the Rider authority or delivery mutation APIs.
