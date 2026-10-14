# GLENPA REAL deployment status

The secure username/password migration is staged in branch feature/secure-username-auth, not yet deployed.

**DO NOT merge until Cloud Functions is deployed, the administrator is bootstrapped and Firestore direct access has been locked down.**

For complete and current instructions, read [MIGRATION_SECURE_AUTH.md](./MIGRATION_SECURE_AUTH.md).

The current live main branch uses Firebase Authentication. The replacement branch uses a secure Cloud Functions backend, PBKDF2-SHA256 with 150,000 iterations and no emails.

Cloud Functions requires a Firebase Blaze plan. Neither committing to GitHub nor editing Firestore rules alone deploys the Cloud Function.
