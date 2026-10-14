# GLENPA REAL — Secure username-only migration

## What changed
- Login uses only username and password. No email address or Firebase Authentication.
- PBKDF2-SHA256, 150000 iterations, 16-byte random salt per user. Passwords are not saved in plaintext.
- Existing Firestore collections reused: userProfiles, loginHandles, clinics, patients and siteSettings.
- Account management remains in the Users tab: create, disable/enable, change password.
- Server-side roles restrict each clinic to its own patients and visits. Firestore rules deny all direct browser access.
- Remember Me keeps an opaque session token in localStorage for up to 30 days; otherwise sessionStorage for up to 12 hours.
- Logout revokes the server token. Account deactivation and password changes are enforced by the server.

## The production website has NOT been switched over yet
This implementation is in feature/secure-username-auth. Main remains operational while backend deployment is pending.
Firebase Cloud Functions needs the Blaze plan and deploy permissions. Never merge this branch or publish the new deny-all Firestore rules before deploying the backend.

## Deployment steps
1. Upgrade Firebase project glenpa-real to Blaze if needed, and confirm organization/security approval.
2. Checkout branch feature/secure-username-auth on a trusted machine. Install Node 22 and Firebase CLI.
3. Run: npm install --prefix functions
4. Run: node --test functions/test/*.test.js tests/*.test.mjs
5. Run: firebase login
6. Run: firebase functions:secrets:set GLENPA_BOOTSTRAP_KEY --project glenpa-real
   Enter a fresh randomly-generated long bootstrap key when prompted. Never commit or share this value.
7. Run: firebase deploy --project glenpa-real --only functions:studyApi
8. Verify backend health: https://us-central1-glenpa-real.cloudfunctions.net/studyApi/health

## First administrator password (one-time)
The existing userProfiles document with username msl.admin, role study_oversight must remain present and unique.
Use a trusted Bash terminal. The bootstrap key and the new 14+ character admin password must be entered privately.
Do not reuse the public legacy demo password.

    read -rsp 'Bootstrap key: ' SETUP_KEY; echo
    read -rsp 'New MSL password (14+ chars): ' ADMIN_PASSWORD; echo
    export SETUP_KEY ADMIN_PASSWORD
    node -e 'fetch("https://us-central1-glenpa-real.cloudfunctions.net/studyApi/bootstrap",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({setupKey:process.env.SETUP_KEY,password:process.env.ADMIN_PASSWORD})}).then(async r=>{const x=await r.json();console.log(r.status,x.ok?"Configured":x.error);if(!r.ok)process.exitCode=1}).catch(e=>{console.error(e.message);process.exitCode=1})'
    unset SETUP_KEY ADMIN_PASSWORD

## Release order — important
9. Verify POST /session with msl.admin and the new password, GET /session with its bearer token, and unauthorized GET /data/patients returns HTTP 401.
10. Create a test clinic account only using the new server and verify cross-clinic access attempts return HTTP 403.
11. Deploy the deny-all rules: firebase deploy --project glenpa-real --only firestore:rules
12. Merge the feature branch into main. Check the GitHub Pages site and sign in again with username/password only.
13. Create real clinic accounts in Users. Keep patient enrollment disabled until the protocol, clinical validation, privacy and institutional approvals are satisfied.

## Notes
- Direct Firestore access from web browsers is always denied after step 11. Cloud Functions uses Admin SDK.
- Additional server-only Firestore collections: _studySessions, _studyAudit, _studyLoginAttempts.
- The bootstrap key is a Cloud Secret Manager secret and is never hardcoded in JavaScript.
- No real patient data should be entered before deployment, integration testing, role-isolation testing, backup/retention and clinical approval.
- GitHub Actions validates PBKDF2 and session storage but cannot prove that the deployed backend works without a deployment.
- Previous Firebase Auth passwords are not used or migrated to the new backend.

Official Firebase docs: https://firebase.google.com/docs/functions/config-env
Firebase Functions billing: https://firebase.google.com/docs/functions/quotas
