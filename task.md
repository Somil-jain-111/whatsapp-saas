You are working on the existing **Fashion Fizz API**, a NestJS + TypeScript + TypeORM + MySQL multi-vendor ecommerce backend.

Read the complete:

`COMPLETE_PROJECT_GUIDE.md`

and inspect the actual repository before making any changes.

This task extends the customer-facing ecommerce experience and CMS.

The CMS must be a centralized **Super Admin controlled content-management module** that can manage:

* banners
* announcements
* promotional messages
* homepage sections
* category landing content
* product collections
* static CMS text/content

Do not rebuild functionality already available in the repository.

Reuse and modify existing:

* authentication
* categories
* shared marketplace products
* product variants
* seller listings
* product approval
* seller approval
* media APIs
* sponsored product logic
* notifications
* audit infrastructure
* response DTOs
* sanitization

Follow existing project conventions:

* GET for reads
* POST for create/update/status/delete actions
* explicit DTOs
* no `Promise<any>`
* migrations for DB changes
* TypeORM synchronize remains disabled

---

# 1. CMS OWNERSHIP

The CMS module is controlled primarily by:

`super_admin`

Super Admin should be able to manage all customer-facing CMS content.

Do not allow:

* sellers
* seller staff
* customers

to create/update/delete CMS content.

If existing project RBAC supports operational admins and there is a valid reason to allow read-only access for `admin`, preserve that possibility, but all CMS write operations should default to `super_admin`.

Conceptually:

SUPER ADMIN
↓
CMS MODULE
↓
Banners
Announcements
Homepage Sections
Promotional Content
Category Landing Content

---

# 2. CMS MODULE

Before creating anything, inspect repository for existing:

* cms
* banners
* homepage
* announcements
* promotional content
* system config
* notifications
* maintenance
* content management

If similar functionality already exists, extend/refactor it.

Otherwise create one centralized module such as:

src/modules/cms/

Possible internal organization:

cms/
controllers/
services/
repositories/
dto/
entities/
enums/
response-dto/

Follow the project's existing folder conventions rather than blindly creating this exact structure.

CMS should own customer-facing content configuration.

CMS must NOT own:

* authentication truth
* product inventory
* seller inventory
* price
* product approval
* seller approval
* checkout/order truth

---

# 3. SUPER ADMIN CMS DASHBOARD

Create backend APIs that allow a Super Admin dashboard to manage CMS content.

The Super Admin dashboard should support sections such as:

CMS
├── Banners
├── Announcements
├── Homepage Sections
├── Product Collections
├── Category Landing Content
└── Promotional Content

The APIs should support:

* list
* detail
* create
* update
* activate/deactivate
* schedule
* reorder
* logical delete
* preview where useful

---

# 4. BANNER MANAGEMENT

Super Admin should be able to upload/manage ecommerce banners.

Banner should conceptually support:

id
publicId

title
subtitle
description

desktopImageUrl
mobileImageUrl

buttonText

actionType
actionValue

placement

displayOrder

startAt
endAt

status

backgroundColor optional
textColor optional

metadata JSON optional

createdBy
updatedBy

createdAt
updatedAt
deletedAt

Use existing S3/media APIs.

Do NOT upload image binaries directly through ordinary banner APIs.

Flow:

1. Super Admin uploads media using existing media API.
2. Media API returns S3/CDN URL.
3. Super Admin sends returned URL in CMS banner create/update request.
4. CMS stores only the reference URL.

---

# 5. SUPER ADMIN BANNER APIs

Suggested API structure:

GET /super-admin/cms/banners

GET /super-admin/cms/banners/:id

POST /super-admin/cms/banners

POST /super-admin/cms/banners/:id

POST /super-admin/cms/banners/:id/status

POST /super-admin/cms/banners/:id/delete

POST /super-admin/cms/banners/reorder

Follow project conventions if routes already use another Super Admin CMS prefix.

Do not create duplicate `/admin` versions unless needed.

Example create banner:

{
"title": "Big Fashion Sale",
"subtitle": "Top Brands",
"description": "Up to 60% off on selected fashion",
"desktopImageUrl": "https://cdn.example.com/banner-desktop.jpg",
"mobileImageUrl": "https://cdn.example.com/banner-mobile.jpg",
"buttonText": "Shop Now",
"placement": "HOME_HERO",
"action": {
"type": "CATEGORY",
"categoryId": "12"
},
"displayOrder": 1,
"startAt": "2026-09-15T00:00:00Z",
"endAt": "2026-09-25T23:59:59Z",
"status": "ACTIVE"
}

---

# 6. ANNOUNCEMENT MODULE INSIDE CMS

Add a dedicated **Announcement** feature inside the CMS module.

Announcements are short customer-facing messages controlled by Super Admin.

Examples:

"Free delivery on orders above ₹999"

"Big Fashion Sale starts tonight"

"Orders may be delayed due to heavy rainfall"

"New users get ₹200 off"

"Platform maintenance scheduled on Sunday"

"Festive Sale is Live"

Announcements should be separate from banners.

Banner:
primarily visual promotional content.

Announcement:
short textual/system/promotion message.

---

# 7. ANNOUNCEMENT DATA MODEL

Create an entity/table conceptually like:

`cms_announcements`

Fields should include:

id
publicId

title

message

shortText optional

type

placement

priority

actionType optional
actionValue optional

iconUrl optional

backgroundColor optional
textColor optional

isDismissible

status

startAt
endAt

displayOrder

createdBy
updatedBy

createdAt
updatedAt
deletedAt

Do not blindly add fields if equivalent project fields already exist.

---

# 8. ANNOUNCEMENT TYPES

Create a controlled enum.

Possible types:

GENERAL

PROMOTION

INFORMATION

WARNING

MAINTENANCE

DELIVERY_UPDATE

NEW_FEATURE

SALE

Do not create too many types.

Keep types generic enough for future CMS usage.

Example:

{
"type": "PROMOTION",
"title": "Free Delivery",
"message": "Get free delivery on orders above ₹999."
}

---

# 9. ANNOUNCEMENT PLACEMENTS

Announcements should support where they appear.

Suggested placements:

GLOBAL

HOME_TOP

HOME

CATEGORY

PRODUCT_LISTING

PRODUCT_DETAIL

CHECKOUT

Do not implement placements frontend cannot currently use unless they are inexpensive and generic.

Main requirement:

`GLOBAL`

should allow frontend to display a global announcement bar.

Example:

---

## 🔥 Big Fashion Sale | Up to 60% off | Shop Now

---

# 10. ANNOUNCEMENT ACTIONS

Announcements may optionally be clickable.

Reuse the same CMS action architecture as banners.

Supported types may include:

NONE

CATEGORY

SUBCATEGORY

PRODUCT

PRODUCT_COLLECTION

SEARCH

EXTERNAL_URL

Example:

{
"action": {
"type": "CATEGORY",
"categoryId": "12"
}
}

Do not duplicate action handling separately for banner and announcement.

Create a reusable CMS action DTO/helper if appropriate.

---

# 11. SUPER ADMIN ANNOUNCEMENT APIs

Suggested APIs:

GET /super-admin/cms/announcements

GET /super-admin/cms/announcements/:id

POST /super-admin/cms/announcements

POST /super-admin/cms/announcements/:id

POST /super-admin/cms/announcements/:id/status

POST /super-admin/cms/announcements/:id/delete

POST /super-admin/cms/announcements/reorder

Support filters:

status
type
placement
startDate
endDate
search

Pagination should follow existing project standards.

---

# 12. CREATE ANNOUNCEMENT EXAMPLE

POST /super-admin/cms/announcements

{
"title": "Free Delivery",
"message": "Get free delivery on orders above ₹999.",
"type": "PROMOTION",
"placement": "GLOBAL",
"priority": "HIGH",
"isDismissible": true,
"action": {
"type": "CATEGORY",
"categoryId": "12"
},
"displayOrder": 1,
"startAt": "2026-09-15T00:00:00Z",
"endAt": "2026-09-30T23:59:59Z",
"status": "ACTIVE"
}

---

# 13. PUBLIC ANNOUNCEMENT API

Create public/customer-facing read API.

Preferred:

GET /cms/announcements

Query parameters:

placement
categoryId
productId
limit

Example:

GET /cms/announcements?placement=GLOBAL

Only return currently eligible announcements.

Conditions:

status = ACTIVE

AND

startAt <= NOW

AND

(
endAt IS NULL
OR endAt >= NOW
)

AND

deletedAt IS NULL

Sort by:

priority DESC

displayOrder ASC

createdAt DESC or another stable final order.

---

# 14. ANNOUNCEMENT PRIORITY

Support simple priorities:

LOW
NORMAL
HIGH
CRITICAL

Use priority only for presentation ordering.

Do NOT use it to bypass status/scheduling.

Example:

CRITICAL:
"Scheduled maintenance at 11 PM"

HIGH:
"Sale ending tonight"

NORMAL:
"Free delivery above ₹999"

---

# 15. DISMISSIBLE ANNOUNCEMENTS

Announcements should optionally support:

`isDismissible`

Example:

{
"isDismissible": true
}

Frontend may hide the announcement after user dismisses it.

For phase one:

Do NOT necessarily store dismissal state in DB.

Frontend/local storage may handle it.

If a user-specific persistent dismissal feature already exists or can cleanly reuse notifications/preferences, document it separately rather than overcomplicating CMS.

---

# 16. ANNOUNCEMENTS VS NOTIFICATIONS

The project already has a Notifications module.

DO NOT confuse:

CMS Announcement

with

User Notification.

They solve different problems.

CMS Announcement:

* visible to many/all customers
* CMS-managed
* often public
* not necessarily user-specific
* temporary/promotional/informational

Notification:

* belongs to a user
* may have read/unread state
* may be triggered by an event
* order/KYC/payment/etc related

Example:

CMS announcement:

"Sale starts tonight."

Notification:

"Your order #1234 has been shipped."

Keep these modules separate.

Do not create a notification row for every customer just to show a global announcement.

---

# 17. MAINTENANCE ANNOUNCEMENT

The project already has maintenance functionality.

Do not replace it.

But CMS announcement may DISPLAY information about planned maintenance.

Example:

{
"type": "MAINTENANCE",
"title": "Scheduled Maintenance",
"message": "The platform will be unavailable from 11 PM to 11:30 PM."
}

Actual maintenance enforcement must continue to use the existing Maintenance module.

CMS text must never become the security/enforcement source.

---

# 18. PROMOTIONAL TEXT

CMS should support text-only promotional content without requiring a banner image.

Examples:

"Extra ₹200 off for new users"

"Use code FASHION200"

"Free shipping above ₹999"

This may be represented through:

Announcement

or

STATIC_TEXT CMS section

Do not create another unnecessary table if announcements/sections already cover the use case.

---

# 19. HOMEPAGE RESPONSE WITH ANNOUNCEMENTS

Update:

GET /storefront/home

to optionally include active announcements.

Example:

{
"announcements": [
{
"id": "...",
"title": "Free Delivery",
"message": "Free delivery on orders above ₹999",
"type": "PROMOTION",
"placement": "GLOBAL",
"priority": "HIGH",
"isDismissible": "true",
"action": {
"type": "CATEGORY",
"categoryId": "12"
}
}
],

"banners": [...],

"categories": [...],

"sections": [...]
}

Do not require frontend to call a separate announcement API for initial homepage rendering unless cache/performance/design makes that preferable.

The standalone announcement API should still exist for refresh or placement-specific fetching.

---

# 20. HOMEPAGE CMS STRUCTURE

Final conceptual hierarchy:

CMS

├── Announcements
│
├── Banners
│   ├── Home Hero
│   ├── Home Middle
│   └── Category Banner
│
├── Homepage Sections
│   ├── Category Grid
│   ├── Product Collection
│   ├── Banner Carousel
│   ├── Promotional Banner
│   └── Static Text
│
├── Product Collections
│
└── Category Landing Content

Super Admin controls all of these.

---

# 21. SUPER ADMIN CMS OVERVIEW API

Consider creating a dashboard summary API:

GET /super-admin/cms/overview

Example:

{
"banners": {
"total": "20",
"active": "8",
"scheduled": "4",
"inactive": "8"
},

"announcements": {
"total": "12",
"active": "3",
"scheduled": "2"
},

"sections": {
"total": "15",
"active": "10"
}
}

Only add this if it is useful for the Super Admin dashboard.

Do not perform expensive count queries on every CMS page unnecessarily.

---

# 22. SUPER ADMIN CMS UPLOAD FLOW

The Super Admin UI should follow this:

Super Admin Login

↓

CMS Dashboard

↓

Choose:

Banner
Announcement
Homepage Section
Collection

For banner:

Upload desktop image
Upload mobile image

↓

Existing Media API

↓

Receive CDN/S3 URL

↓

POST /super-admin/cms/banners

For announcement:

Enter:

Title
Message
Type
Placement
Priority
CTA
Schedule

↓

POST /super-admin/cms/announcements

No media upload should be required for a normal announcement.

---

# 23. BANNER + ANNOUNCEMENT PREVIEW

Where practical, API response should contain enough information for Super Admin frontend preview.

For banners:

image
text
CTA
placement
schedule
status

For announcements:

title
message
style metadata
CTA
priority
schedule

Do not build server-side screenshot generation.

Frontend handles visual preview.

---

# 24. SCHEDULING

Both:

Banners

and

Announcements

must support scheduling.

Fields:

startAt
endAt

Examples:

Status ACTIVE but startAt in future:

Do not return publicly yet.

Status ACTIVE and date within window:

Return.

endAt passed:

Stop returning.

Do not require cron jobs simply to switch visibility.

Visibility should be query-condition driven.

Optional cleanup/archive workers may be added later.

---

# 25. STATUS

Use consistent CMS status across banner/announcement/section where possible.

Recommended:

DRAFT

ACTIVE

INACTIVE

Derive:

SCHEDULED

EXPIRED

from dates when possible.

Do not create overly complicated status enums.

---

# 26. COMMON CMS BASE PATTERN

Where it reduces duplication safely, share behavior for:

status

startAt

endAt

displayOrder

createdBy

updatedBy

logical deletion

But avoid complicated inheritance if existing project entity style does not use it.

Prioritize maintainability.

---

# 27. CMS ACTION VALIDATION

Centralize action validation.

Example:

CMS action:

{
"type": "PRODUCT",
"productId": 101
}

Validate:

product exists
product is valid reference

But note:

An admin may schedule a banner before the product becomes customer-visible.

At public rendering time, enforce actual customer eligibility.

Never show an invalid/unapproved product CTA publicly.

For CATEGORY:

category must exist and be active.

For EXTERNAL_URL:

validate safe HTTP/HTTPS URL.

Do not allow:

javascript:
data:
or unsafe URI schemes.

---

# 28. AUDIT LOGGING

CMS is controlled by Super Admin, so all writes should be auditable.

Audit actions:

CMS_BANNER_CREATED
CMS_BANNER_UPDATED
CMS_BANNER_STATUS_CHANGED
CMS_BANNER_DELETED
CMS_BANNER_REORDERED

CMS_ANNOUNCEMENT_CREATED
CMS_ANNOUNCEMENT_UPDATED
CMS_ANNOUNCEMENT_STATUS_CHANGED
CMS_ANNOUNCEMENT_DELETED
CMS_ANNOUNCEMENT_REORDERED

CMS_SECTION_CREATED
CMS_SECTION_UPDATED
CMS_SECTION_STATUS_CHANGED
CMS_SECTION_REORDERED

Use existing audit infrastructure instead of creating a second audit mechanism.

Record:

actor user ID
action
resource ID
before
after
journey/request ID
timestamp

Avoid sensitive authentication information.

---

# 29. PUBLIC API CACHE

CMS is read-heavy.

Potential cache keys:

cms:banners:HOME_HERO

cms:announcements:GLOBAL

cms:home

cms:category:{categoryId}

Use existing cache infrastructure if appropriate.

Invalidate relevant caches after:

create

update

status change

delete

reorder

Redis must not be required for correctness.

DB remains source of truth.

---

# 30. DATABASE TABLES

Inspect existing schema first.

Likely new tables:

cms_banners

cms_announcements

cms_sections

cms_section_items

Do not create all if existing tables cover the functionality.

Suggested `cms_announcements` indexes:

status
placement
type
start_at
end_at
display_order
deleted_at

Suggested `cms_banners` indexes:

status
placement
start_at
end_at
display_order
deleted_at

Create migrations.

Never enable synchronize.

---

# 31. SUPER ADMIN SECURITY

All Super Admin CMS write routes must use:

JWT authentication

AND

super_admin role authorization

Do not trust a request body such as:

{
"role": "super_admin"
}

Role comes from authenticated identity.

Do not accept:

createdBy

updatedBy

from frontend.

Set these from:

req.user.id

or project equivalent.

---

# 32. PUBLIC DATA SANITIZATION

Public banner/announcement APIs should return only display-safe information.

Do not return:

createdBy internal object
updatedBy
deletedAt
internal audit metadata
internal DB keys when unnecessary
raw configuration that contains admin-only fields

Use response DTOs.

---

# 33. ANNOUNCEMENT RESPONSE DTO

Example:

{
"id": "announcement-uuid",
"title": "Big Fashion Sale",
"message": "Up to 60% off on selected products.",
"type": "SALE",
"placement": "GLOBAL",
"priority": "HIGH",
"isDismissible": "true",

"style": {
"backgroundColor": "#000000",
"textColor": "#FFFFFF",
"iconUrl": null
},

"action": {
"type": "CATEGORY",
"categoryId": "12"
}
}

Follow the project's serialization conventions.

---

# 34. CMS API STRUCTURE

Preferred final API organization:

PUBLIC

GET /storefront/home

GET /cms/banners

GET /cms/announcements

GET /storefront/categories/:categoryId

SUPER ADMIN CMS

GET /super-admin/cms/overview

BANNERS

GET /super-admin/cms/banners

GET /super-admin/cms/banners/:id

POST /super-admin/cms/banners

POST /super-admin/cms/banners/:id

POST /super-admin/cms/banners/:id/status

POST /super-admin/cms/banners/:id/delete

POST /super-admin/cms/banners/reorder

ANNOUNCEMENTS

GET /super-admin/cms/announcements

GET /super-admin/cms/announcements/:id

POST /super-admin/cms/announcements

POST /super-admin/cms/announcements/:id

POST /super-admin/cms/announcements/:id/status

POST /super-admin/cms/announcements/:id/delete

POST /super-admin/cms/announcements/reorder

SECTIONS

GET /super-admin/cms/sections

GET /super-admin/cms/sections/:id

POST /super-admin/cms/sections

POST /super-admin/cms/sections/:id

POST /super-admin/cms/sections/:id/status

POST /super-admin/cms/sections/reorder

Use existing route styles where they differ.

Do not create duplicate APIs unnecessarily.

---

# 35. POSTMAN CMS FOLDER

Add a new Postman folder:

Super Admin CMS

Sequence:

01 - Super Admin Login

02 - Upload Banner Desktop Media

03 - Upload Banner Mobile Media

04 - Create Home Hero Banner

05 - Get All Banners

06 - Get Banner Detail

07 - Update Banner

08 - Change Banner Status

09 - Reorder Banners

10 - Create Global Announcement

11 - Create Promotional Announcement

12 - Get All Announcements

13 - Get Announcement Detail

14 - Update Announcement

15 - Change Announcement Status

16 - Reorder Announcements

17 - Create Homepage Section

18 - Get Homepage Sections

19 - Reorder Homepage Sections

20 - Public Get Banners

21 - Public Get Announcements

22 - Public Get Storefront Home

Automatically store:

bannerId

announcementId

sectionId

media URLs

access tokens

where practical.

---

# 36. TEST CASES — ANNOUNCEMENT

Add tests:

1. Super Admin creates announcement successfully.

2. Admin without required permission cannot create announcement.

3. Seller cannot create announcement.

4. Customer cannot create announcement.

5. Public can fetch active global announcement.

6. DRAFT announcement is hidden.

7. INACTIVE announcement is hidden.

8. Future announcement is hidden.

9. Expired announcement is hidden.

10. Active announcement in current schedule appears.

11. Higher priority announcement appears first.

12. displayOrder respected within priority.

13. Invalid startAt/endAt rejected.

14. Unsafe external URL rejected.

15. Invalid category action rejected.

16. Deleted announcement hidden.

17. Public response does not expose internal metadata.

18. CMS update creates audit entry.

19. CMS status change invalidates relevant cache.

20. Storefront home includes eligible announcements.

---

# 37. TEST CASES — BANNERS

Add tests:

1. Super Admin creates banner.

2. Desktop/mobile media URLs persisted correctly.

3. Active hero banner appears publicly.

4. Inactive banner does not appear.

5. Scheduled future banner does not appear.

6. Expired banner does not appear.

7. Display ordering works.

8. Product/category CTA validates.

9. Seller cannot manage banners.

10. Customer cannot manage banners.

11. Logical delete works.

12. Audit trail created.

---

# 38. FINAL SUPER ADMIN EXPERIENCE

Super Admin Dashboard:

CMS

↓

Banners

[ + Add Banner ]

Title
Subtitle
Desktop Image
Mobile Image
CTA Text
CTA Destination
Placement
Schedule
Status

↓

Announcements

[ + Add Announcement ]

Title
Message
Type
Priority
Placement
CTA
Dismissible
Schedule
Status

↓

Homepage Sections

[ + Add Section ]

Section Type
Title
Subtitle
Content Source
Display Order
Schedule
Status

↓

Preview

↓

Publish / Activate

---

# 39. FINAL CUSTOMER EXPERIENCE

HOME PAGE:

Announcement Bar

"🔥 Big Fashion Sale — Up to 60% Off — Shop Now"

↓

Hero Banner

"Festive Fashion Sale"
"Shop Now"

↓

Categories

Men
Women
Footwear
Jewellery
Electronics

↓

CMS Product Collection

"Featured Products"

↓

Promotional Banner

"Free Delivery Above ₹999"

↓

Another Product Collection

"New Arrivals"

All product sections still use the shared marketplace catalogue.

CMS must not duplicate product inventory.

---

# 40. CRITICAL DOMAIN SEPARATION

Keep these concepts independent:

AUTH
= customer identity/login

CMS
= presentation/content configuration

ANNOUNCEMENT
= temporary public textual communication

BANNER
= visual/promotional CMS asset

NOTIFICATION
= user-specific/event-driven communication

MAINTENANCE
= actual platform access enforcement

CATEGORY
= product classification

PRODUCT
= shared item identity

VARIANT
= exact variation

SELLER_PRODUCT
= seller's price/inventory

CATALOG
= eligible customer-visible products

Do not combine these responsibilities.

---

# 41. BEFORE IMPLEMENTATION

First inspect the repository and report:

## Existing CMS-like functionality

## Existing notification functionality

## Existing maintenance functionality

## Existing media upload functionality

## Existing category/catalog functionality

Then provide:

## APIs to reuse

## APIs to modify

## APIs to add

## Entities/migrations required

## RBAC design

## Cache strategy

## Compatibility risks

Then actually implement the functionality.

Do not stop after giving recommendations.

---

# 42. AFTER IMPLEMENTATION

Run:

npm run lint

npm test -- --runInBand

npm run build

git diff --check

Also:

* run migrations safely
* verify CMS RBAC
* test scheduled banners
* test scheduled announcements
* test public homepage response
* confirm no N+1 homepage query behavior
* regenerate Postman collection
* update COMPLETE_PROJECT_GUIDE.md

Final response must include:

1. files changed
2. entities added
3. migrations added
4. APIs added
5. APIs modified
6. APIs reused
7. banner examples
8. announcement examples
9. homepage response example
10. tests added
11. lint/test/build results
12. frontend integration instructions
13. remaining future scope
