# GLENPA REAL — Clinical Deployment Checklist (14 October 2026)

## Current status
The public GitHub Pages URL now loads the production-oriented Firebase client. The legacy fictional patient registry, browser-based admin password gate, hard-coded clinic passwords, public demo account file and staging page have been removed from the current HEAD.

**NOT YET CLEARED FOR REAL PATIENT DATA.** This repository commit does NOT deploy Firestore rules, provision clinical accounts, certify privacy compliance, or clinically validate data collection.

## Required before enrolling any study participant

1. **Validate rules:** Review [firestore.rules](./firestore.rules) with the medical, IT/security, privacy and clinical data management stakeholders. Test in the Firebase Emulator with:
   - no session: no clinic/patient/profile/settings reads; only single-handle login lookup permitted
   - active clinic01: read clinic01 only, deny clinic02, deny global patient/profile list
   - active clinic02: no clinic01 access, including patient visits by guessed ID
   - active MSL: read roster and coded records, manage non-secret profiles/settings, no editing clinical visits
   - disabled user: all clinical access denied
   - enrollment disabled: no new patient creation even via direct Firestore SDK/REST requests
   - visit data: enforce unique coded records, ordered baseline/month3/month6 and immutable visit documents
   - cross-clinic record create, arbitrary role edits, prohibited fields and update/delete attempts all denied
2. **Deploy rules:** In Firebase Console → Firestore Database → Rules, review and publish the contents of [firestore.rules](./firestore.rules), or from an authenticated administrative development environment run:
   \`firebase deploy --project glenpa-real --only firestore:rules\`
   **Note:** Saving a rules file on GitHub does not update live Firestore security.
3. **Authorized website:** Firebase Authentication → Settings → Authorized domains must permit \`medical-dad.github.io\`. Use a dedicated approved domain before regulated production operation if required by company policy.
4. **MSL identity:** Verify that the existing MSL Firebase Auth email is the account configured in \`portal.js\` as \`ADMIN_EMAIL\`. The Firestore document \`userProfiles/{uid}\` must have:
   \`{"username":"msl.admin","role":"study_oversight","active":true}\`.
   Open the hidden administrator dialog with **five logo taps**. Sign in with the **actual Firebase Auth password**. The old local client-side password is intentionally not a production credential. Do not place it or any password hash in a public HTML file.
5. **Roster:** Verify \`clinics/clinic01\` through \`clinics/clinic26\` contain authorized physician names/specialties/regions. Correct any erroneous labels before inviting staff.
6. **Clinics:** Admin → Users → Create clinic accounts with designated **real reachable email** and unique username (e.g. \`clinic01\`). Password length must be at least 14; provide credentials through an approved secure channel. This creates a Firebase Auth account plus its Firestore \`userProfiles/{uid}\` and \`loginHandles/{username}\`. The clinic user enters username and password, not email. No old test account works until explicitly provisioned.
7. **Site settings:** Admin → Settings → keep \`enrollmentEnabled=false\` until all access-control tests, protocol approvals and data protection checks pass. It is fail-closed by default.
8. **Clinical governance:** Before live use approve protocol-compatible data dictionary, consent/ethics approvals, pseudonymisation design, sponsor data processing agreements, regional data residency, record correction/change history, audit trail, retention, backup/recovery, adverse-event reporting pathways, validation/UAT, and an incident-response procedure. These items are **not** supplied by a GitHub commit.
9. **Regulated hosting/security:** Evaluate whether static GitHub Pages hosting and Google Firebase in the selected region meet institutional policies. No direct patient identifiers should ever be entered. Do not share clinical access credentials in this repository, GitHub issues, chat or email without approved encryption.

## Data model

- \`userProfiles/{firebaseAuthUid}\`: non-secret user role, username, clinic assignment and account status
- \`loginHandles/{username}\`: username → Firebase Auth email directory, single-document public get only, no listing. This makes email addresses retrievable by username; privacy/security approval is required.
- \`clinics/{clinicCode}\`: authorized roster for 26 clinics
- \`siteSettings/main\`: study title and enrollment switch
- \`patients/{clinicCode}_{codedPatientId}\`: age, sex, diabetes years and a study patient code; no patient names
- \`patients/{patientId}/visits/baseline|month3|month6\`: visit values, safety text and medication changes

No clinical records are stored in localStorage. localStorage is used only for a cosmetic theme preference. Firebase Auth is configured with session persistence.

## Operational limitations requiring resolution

- The published front end is a functional Firebase client, **not proof of secure production release**.
- Current Firestore rules in the console were previously restrictive; the new \`firestore.rules\` must be deployed and tested.
- The simple site does not have validated change-control, immutable server-side audit logging, role-based password resets, automatic alerting, backed-up disaster recovery or full protocol-verified eCRFs.
- Cloud Auth account creation from the administrator's browser requires controlled onboarding; new email/password sign-ups can generate unassigned Auth accounts if used outside the admin portal. Unassigned accounts cannot access protected Firestore records under the proposed rules, but a server-admin provisioning flow is preferred for production.
- The admin's older client-side demo password must **not** be reused for live medical records.
- The QR is a public site link only. It never grants record access.
- GitHub history may still contain prior demonstration credentials after file deletion; **never reuse previous demonstration passwords**.

## Publication URL
https://medical-dad.github.io/REAL-GLENPA/
