# Dependency security status

Compatible security updates were applied for Axios, Joi, MySQL2, Firebase Admin and Proxy-Addr. Patched same-major overrides are used for Multer, Lodash, qs and body-parser. Unused bcrypt/native prebuild dependencies were removed; all active password hashing now uses Argon2id. The dependency tree is valid and the production audit has no critical advisories.

The remaining production audit result is 13 advisories (11 moderate, 2 high), inherited primarily from NestJS 10, Swagger and utility dependency chains. The vulnerable Multer version pinned by NestJS is overridden with the compatible patched 2.4 release because contact imports require multipart uploads. npm only offers breaking major upgrades for the remaining framework findings. They were not force-installed because a coordinated Nest 10 to 12 migration requires framework, adapter, Swagger, scheduling, TypeORM integration and runtime regression testing rather than an unsafe lockfile-only change.

Required follow-up before internet-facing production:

1. Schedule the NestJS 12 migration as a separate reviewed change.
2. Keep the Multer override and request/multipart size limits at both the reverse proxy and application boundary.
3. Run `npm audit --omit=dev` in CI and fail on new critical advisories.
4. Reassess high advisories against enabled code paths and record temporary risk acceptance.
