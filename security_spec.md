# FoodSnap Firestore Security Specification

## 1. Data Invariants
1. Every `/users/{userId}` document may only be read, created, or updated by the verified authenticated user whose `request.auth.uid == userId`.
2. Every `/foodScans/{scanId}` document must belong to an authenticated, email-verified user (`userId == request.auth.uid`) and match its document path `id == scanId`.
3. `createdAt` must strictly equal `request.time` on document creation and cannot be forged or mutated.
4. All strings, arrays, and document IDs are strictly bounded in size and pattern to prevent storage abuse or injection.
5. No shadow/unlisted fields are permitted on any write (`keys().hasAll(...)` + `keys().hasOnly(...)`).
6. No blanket reads or client-delegated `list` queries: `allow list` explicitly evaluates `resource.data.userId == request.auth.uid`.

## 2. Adversarial Payloads ("Dirty Dozen")
1. Unauthenticated read/write to `/foodScans/scan_1` -> `PERMISSION_DENIED`.
2. Unverified email user creating a scan -> `PERMISSION_DENIED`.
3. Spoofed `userId` (`userId != request.auth.uid`) on `foodScans` create -> `PERMISSION_DENIED`.
4. Path ID mismatch (`data.id != scanId`) -> `PERMISSION_DENIED`.
5. Oversized `scanId` (> 128 chars) or invalid characters (`../bad`) -> `PERMISSION_DENIED`.
6. Ghost shadow field (`isAdmin: true` or `extra: 1`) on `foodScans` or `users` create -> `PERMISSION_DENIED`.
7. Client-forged `createdAt` timestamp (`!= request.time`) -> `PERMISSION_DENIED`.
8. Negative or absurd calorie value (`calories: -50` or `calories: 99999`) -> `PERMISSION_DENIED`.
9. Empty `ingredients` array or non-string first element -> `PERMISSION_DENIED`.
10. Oversized `thumbnailDataUrl` (> 180,000 chars) -> `PERMISSION_DENIED`.
11. Reading or deleting another user's `/foodScans/{scanId}` -> `PERMISSION_DENIED`.
12. Unfiltered `list` query on `/foodScans` without `where('userId', '==', uid)` -> `PERMISSION_DENIED`.
