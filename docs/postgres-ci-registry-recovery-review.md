# PostgreSQL 18.4 CI registry recovery

Scope: CI container acquisition only; no game runtime, schema, financial activation or release waiver.
Source before repair: 567a9295fde581d2af35febc0b5cb684ce6d0fb3. Image wiring: fa233640d6909d797b95c734665f64bc822b0ae7.

PR254 job114977897006 failed while pulling the public ECR image with toomanyrequests / Data limit exceeded, before checkout. Subsequent missing package errors are consequences of that acquisition failure. Preserve the failed job log; no native gameplay failure is inferred.

Verified directly against Docker Official Image public registry on2026-10-12: index sha256:a02db8cac496f15b094798a38254f14d6e00741f709360e5e00bb6668ea31636; linux/amd64 manifest sha256:4cc13dede823cab4e05290c7fb3350fb4e599ecabd9b07e6706b5d5e8f5bc929; config sha256:4b87d5343a0e499eea33b6c19ec152a3ed4a0d1a453eadd26ff415a406821a6e. All three downloaded byte hashes matched, and config PG_VERSION was18.4-1.pgdg13+1. No registry credential was persisted.

Both required PostgreSQL16/18.4 lanes, native version verification, all existing commands and timeouts remain. test/gates.js passes and rejects image drift. Hosted exact-revision CI must still pass; local static verification does not establish hosted execution or deployment.
