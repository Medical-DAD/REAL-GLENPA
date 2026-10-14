# GLENPA REAL — إدارة حسابات العيادات

**المشروع يعمل على GitHub Pages وFirebase Spark فقط. لا يحتاج Render ولا Cloud Functions ولا خطة Blaze.**

## إضافة مستخدم من الموقع

1. افتح https://medical-dad.github.io/REAL-GLENPA/ وسجّل دخول الأدمن بالضغط 5 مرات على الشعار.
2. افتح Users. ستظهر حسابات Firestore الموجودة حاليًا.
3. أدخل Username مثل clinic01، واختر العيادة، وأدخل PIN رقميًا من 6 إلى 32 رقمًا.
4. اضغط Create clinic account. المستخدم يدخل بالموقع باسم المستخدم والرقم السري فقط، وليس البريد.
5. يمكن للأدمن تعطيل أو إعادة تفعيل أي حساب عيادة من نفس الجدول.

تقنيًا يحتاج Firebase Authentication بريدًا داخليًا للتمييز بين الحسابات. ينشئ الكود بريدًا داخليًا آليًا وفق الصيغة username@glenpa-real.firebaseapp.com، ويحتفظ بمطابقته ضمن loginHandles. لا يُطلب بريد من الطبيب ولا يظهر في واجهة تسجيل الدخول أو Users.

## تغيير كلمة المرور أو حذف حساب نهائيًا — محليًا على جهازك فقط

لأسباب أمنية، Firebase Authentication لا يسمح لجلسة أدمن في المتصفح بتغيير كلمة مرور حساب شخص آخر أو حذفه. توجد أداة محلية منفصلة تعتمد Firebase Admin SDK ومفتاحك الخاص دون أي استضافة إضافية.

1. Firebase Console → Project Settings → Service accounts → Generate new private key.
2. **لا ترسل ملف JSON لأحد ولا ترفعه على GitHub أبدًا.** خزّنه في مجلد خاص على جهازك.
3. حمّل المستودع على جهازك وافتح Terminal أو PowerShell في مجلد admin-tools.
4. نفّذ npm install مرة واحدة على جهازك.
5. عرّف متغير البيئة GOOGLE_APPLICATION_CREDENTIALS بمسار الملف الذي نزلته (على Windows PowerShell):

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = (Resolve-Path 'C:\path\to\your\private-key.json').Path
```

غيّر مسار الملف أعلاه إلى المسار الصحيح على جهازك. هذه الخطوة لا ترفع المفتاح للإنترنت.

6. عرض الحسابات:

```bash
node manage.cjs list
```

7. تغيير كلمة مرور clinic01 دون كتابتها في الأوامر أو سجلّ Shell:

```bash
node manage.cjs reset clinic01
```

ستطلب الأداة PIN جديدًا من 6 إلى 32 رقمًا مرتين، وتخفي الأرقام أثناء الكتابة.

8. حذف حساب clinic01 نهائيًا، مع تأكيد إضافي:

```bash
node manage.cjs delete clinic01
```

هذا يحذف مستخدم Firebase Authentication وuserProfiles وloginHandles، ولكنه **لا يحذف سجلات المرضى أو الزيارات** حفاظًا على الأثر السريري. الأداة تمنع حذف حساب الدراسة الإداري.

## ملاحظات تشغيل مهمة

- ستة أرقام هي الحد الأدنى الذي طلبته، لكنها ضعيفة لحماية بيانات طبية. استعمل رموزًا أطول ومختلفة للعيادات قدر الإمكان، والتزم بالموافقات على خصوصية البيانات قبل إدخال معلومات مرضى.
- إذا حذفت حسابًا عن طريق أداة الإدارة المحلية يمكنك إعادة إنشائه من لوحة Users.
- تغيير كلمة المرور يبطل Refresh Tokens القديمة، لكن Firebase ID Tokens السابقة قد تبقى سارية لفترة قصيرة. تعطيل الحساب من لوحة Users يمنع الوصول إلى بيانات الدراسة مباشرةً بفضل قواعد Firestore التي تتحقق من active.
- تأكد أن مشروع Firebase فيه Email/Password مفعّل في Authentication → Sign-in method، وأن قواعد firestore.rules المنشورة ما زالت تتطلب صلاحية الدراسة لكل عملية.
- لا تستخدم ملف أو تعليمات MIGRATION_SECURE_AUTH.md الموجودين في الفرع المنفصل feature/secure-username-auth؛ لم يتم دمجهما في الموقع الرئيسي لأنهما يتطلبان Cloud Functions المدفوعة.
- إذا كانت مؤسستك تمنع إنشاء مفاتيح Service Accounts، لا يمكن تغيير كلمات مرور الآخرين أو حذف Auth users من صفحة GitHub وحدها على Spark؛ يمكن إدارة الحسابات يدويًا من Firebase Console حيث تتاح الخيارات.

## ملفات التنفيذ

- portal.js: شاشة Users، إنشاء حسابات العيادات بأرقام PIN، وتفعيل أو تعطيل.
- admin-tools/manage.cjs: عرض الحسابات وتغيير PIN والحذف النهائي من جهاز الأدمن.
- firestore.rules: قواعد Firestore تحصر بيانات الدراسة بكل عيادة، وتحمي سجلات المرضى.
