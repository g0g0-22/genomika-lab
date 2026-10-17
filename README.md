# ГеномикаЛаб · GenomikaLab

**Веб-платформа за фиктивна истражувачка лабораторија по биоинформатика.**
A web platform for a fictional bioinformatics research laboratory.

> ГеномикаЛаб не постои. Луѓето, проектите, публикациите и податочните множества се измислени за потребите на овој проект. **Алгоритмите во делот „Алатки“, сепак, се вистински имплементации** напишани од нула и покриени со тестови.
>
> GenomikaLab does not exist. The people, projects, publications and datasets are invented for this project. **The algorithms under “Tools”, however, are genuine implementations** written from scratch and covered by tests.

---

## Што е ова / What this is

Проектот намерно не е обична „landing page“. Изграден е како она што вистинските биоинформатички институти всушност се: **институционален сајт + платформа со алатки, податоци и внатрешни системи.**

The project is deliberately not a plain landing page. It is built as what real bioinformatics institutes actually are: **an institutional site plus a platform of tools, data and internal systems.**

### Функционалности / Features

| | Функционалност | Feature |
|---|---|---|
| 🧬 | Две алатки за анализа на секвенци што работат локално во прелистувач | Two sequence-analysis tools running locally in the browser |
| 📅 | Резервација на инструменти: преклопувања, работно време, квоти и задолжителна обука | Instrument booking: overlaps, opening hours, quotas and required training |
| 🔐 | Автентикација со JWT и улоги (`admin`, `researcher`) | JWT authentication with roles |
| 🗂️ | Администрација со CRUD за публикации, вести и луѓе | Administration with CRUD for publications, news and people |
| 🔎 | Пребарлив каталог на публикации со извоз во BibTeX | Searchable publication catalogue with BibTeX export |
| 📊 | Репозиториум на податоци со преглед и преземање CSV | Dataset repository with preview and CSV download |
| 📈 | Контролна табла со метрики, Gantt и мрежа на соработка | Metrics dashboard with a Gantt chart and collaboration network |
| ✉️ | Пријави за настани (+ `.ics`), за позиции (+ прикачување CV) и контакт форма | Event RSVPs (+ `.ics`), job applications (+ CV upload) and a contact form |
| 🌍 | Двојазичен интерфејс и содржина МК/EN (публикациите се на јазикот на кој се објавени) и светла/темна тема | Bilingual MK/EN interface and content (publications in the language they were published in) and light/dark themes |

---

## Брз почеток / Quick start

Потребен е **Node.js 20+** (развиено на 22.14).

```bash
npm run setup     # инсталира зависности, полни база, гради клиент
npm start         # http://localhost:4000
```

`npm run setup` е скратено за:

```bash
npm run install:all   # npm install во server/ и client/
npm run seed          # креира и полни genomika.db
npm run build         # гради client/dist
```

### Развојни сервери / Development servers

Во два терминали / In two terminals:

```bash
npm run dev:server    # API на :4000, се рестартира при промена
```

```bash
npm run dev:client    # Vite на :5173, со proxy кон :4000
```

### Тестови / Tests

```bash
npm test                  # двете нивоа / both levels
npm run lint              # ESLint, вклучително правилата за React hooks
npm run check:contrast    # контраст и далтонизам за секоја боја во двете теми
```

**93 теста** во две нивоа / **93 tests** at two levels:

* **35** (`client/tests/bio.test.ts`) ја покриваат алгоритамската библиотека и
  BibTeX извозот — FASTA, двосмислени бази, транслација, ORF, Tm, молекуларна
  маса, рестрикциска дигестија на линеарна и кружна ДНК, краеви на сечење.
  Очекуваните вредности не се преземени од излезот на кодот: тоа се објавени
  факти (β-глобин, OligoCalc) или се изведени со друг, намерно наивен метод
  (пребарување на низа плус поместување на сечењето). / cover the algorithm
  library and the BibTeX export. Expected values are published facts or are
  derived by a separate, deliberately naive method — never read off the code.
* **58** (`server/tests/api.test.js`) го возат вистинскиот HTTP слој врз
  привремена база: автентикација и улоги, ограничување на обиди (и дека
  фалсификуван `X-Forwarded-For` не помага), резервации, обука, квоти,
  валидација на датуми и прикачени датотеки, поврзување автори, приватност,
  пребарување и администрација. Ништо не е мокирано. / drive the real HTTP
  layer against a throwaway database. Nothing is mocked.

```bash
npm run test:client     # алгоритми / algorithms
npm run test:server     # API

# крај-до-крај, врз подигнат стек (nginx → api → ./data)
BASE_URL=http://localhost:8080 npm run smoke
```

`scripts/smoke.mjs` проверува над 120 работи врз вистинската распоредба — секоја
функционалност од овој документ барем еднаш, вклучително и заглавјата што ги
поставува nginx. Последниот дел намерно ги троши ограничувањата за најава и форми
на клиентот што го извршува, за да докаже дека постојат; повторно извршување
пред да истечат (една, односно десет минути) запира со јасна порака. Пишува
демо-записи, па никогаш врз стек со вистински податоци. / Checks over 120 things
against the real deployment. Its last section deliberately uses up the running
client's sign-in and form allowances to prove the limits exist, so a re-run
within ten minutes stops with a clear message. It writes demo records, so never
run it against a stack holding real data.

---

## Демо сметки / Demo accounts

Seed-от создава четири сметки: две администраторски (`admin@genomika.mk`,
`f.micevski@genomika.mk`) и две истражувачки (`n.avramovski@genomika.mk`,
`s.jovanoska@genomika.mk`). Лозинките ги избира деплојментот, одделно за двете
улоги, а одделно и што нуди страницата за најава:

| Променлива / Variable | Значење / Meaning |
|---|---|
| `ADMIN_PASSWORD` | Лозинка на администраторите. Ако не е поставена, при првото полнење се генерира и се печати еднаш во логот на `api`. / Administrators' password; generated and logged once if unset. |
| `DEMO_PASSWORD` | Лозинка на истражувачите, на ист начин. / Researchers' password, likewise. |
| `DEMO_LOGINS` | `none` (стандардно), `researcher` или `all`: кои сметки страницата за најава ги нуди со лозинка. / Which accounts the login page lists, with their password. |

Причината: администраторот ги гледа биографиите и пораките на кандидатите, па
јавно објавена администраторска лозинка би му ги дала на секој посетител. За
преглед на проектот препорачано е `DEMO_LOGINS=researcher`, а администраторската
лозинка да им се даде на оценувачите посебно. / An administrator can read
applicants' CVs and messages, so a published admin password would hand them to
every visitor. For a review, `DEMO_LOGINS=researcher` is recommended, with the
admin password given to the examiners separately.

Без Docker (`npm start`, `npm run dev:server`) двете лозинки се `genomika2026`
и страницата ги нуди двете сметки — за локална работа. / Run without Docker,
both passwords are `genomika2026` and the login page lists both, for local work.

---

## Алатките / The tools

Сите пресметки се одвиваат во прелистувачот — ниту еден бајт од внесената секвенца не се испраќа до серверот. Секоја алатка има копче **„Вчитај пример"**.

All computation happens in the browser — not one byte of an entered sequence is sent to the server. Every tool has a **“Load example”** button.

| Алатка / Tool | Алгоритми / Algorithms |
|---|---|
| **Секвенцна работилница** / Sequence Toolkit | Комплемент, транскрипција, транслација во 6 рамки, наоѓање ORF, GC содржина, Tm (Wallace / GC-формула), молекуларна маса |
| **Виртуелна електрофореза** / Virtual Electrophoresis | 25 рестрикциски ензими, од кои пет со дегенерирани IUPAC места, дигестија на линеарна и кружна ДНК, симулиран агарозен гел (0.7–2.0 %) со логаритамска миграција и експлицитно означување на фрагментите што излегуваат од опсегот на гелот |

### Проверливост / Verifiability

Резултатите се споредливи со референтни имплементации:

Results are checkable against reference implementations:

* Кодирачкиот регион на човечкиот β-глобин → протеин што почнува со `MVHLTPEEK`, 147 аминокиселини плус стоп кодон
* `EcoRI` (`G^AATTC`) во демо-конструктот → точно две места на сечење, на позиции 1 и 46
* Дигестија со повеќе ензими → збирот на должините на фрагментите е секогаш еднаков на должината на влезната секвенца
* `meltingTemp('GCGCGCGCGCGCGCGCGCGC')` → 72.28 °C по GC-формулата
* `molecularWeight('ATGC')` → 1173.84 Da, идентично со OligoCalc (резидуални маси, не маси на слободни нуклеотиди)

---

## Архитектура / Architecture

```
genomika-lab/
├── docker-compose.yml       Два сервиса: web (nginx) и api (node)
├── stack.yml                Што изложува RepoRun: web:80, зад CAS
├── scripts/
│   ├── smoke.mjs            Крај-до-крај проверка на подигнат стек
│   └── check-contrast.mjs   Контраст и далтонизам, од токените во app.css
│
├── server/                  Express + SQLite (better-sqlite3), ESM
│   ├── tests/api.test.js    51 интеграциски тест врз вистинскиот HTTP слој
│   └── src/
│       ├── app.js           Склопување на апликацијата (без слушање порта)
│       ├── index.js         Влезна точка: миграции, прво полнење, слушање
│       ├── db.js            Шема — 18 табели и еден поглед — и миграции (user_version)
│       ├── seed.js          Двојазични демо податоци
│       ├── lib/
│       │   ├── auth.js      JWT, bcrypt, улоги, ограничување на обиди за најава
│       │   ├── authors.js   Поврзување на авторите на трудовите со профилите
│       │   ├── validate.js  Шеми за валидација на административните записи
│       │   ├── limits.js    Ограничување на барања и должина на полиња
│       │   └── dates.js     Календарски датуми во локалната временска зона
│       └── routes/
│           ├── content.js   Групи, луѓе, проекти, публикации, податоци, вести, метрики, мрежа
│           ├── events.js    Настани, пријави, .ics извоз
│           ├── booking.js   Инструменти, достапност, резервации
│           ├── careers.js   Позиции, пријави со CV, контакт пораки
│           └── admin.js     CRUD и сандаче зад улога `admin`
│
└── client/                  React 18 + TypeScript + Vite + Tailwind v4
    ├── nginx.conf           Веб-слојот: статика, gzip, кеш, proxy кон api
    ├── security-headers.conf  CSP и останатите безбедносни заглавја
    ├── trusted-proxies.sh  На стартување: од кого nginx верува на X-Forwarded-For
    ├── tests/bio.test.ts    32 теста за алгоритмите и BibTeX
    └── src/
        ├── lib/bio/         ★ Алгоритамска библиотека — без надворешни зависности
        │   ├── sequence.ts    Секвенцни операции, кодонска табела, ORF, Tm, маса
        │   ├── enzymes.ts     Рестрикциски ензими, дигестија, миграција на гел
        │   └── samples.ts     Примероци за двете алатки
        ├── lib/bibtex.ts    BibTeX извоз
        ├── i18n/dict.ts     386 двојазични записи во една рамна табела
        ├── components/      Дизајн систем, графикони, мрежен граф, приказ на секвенци
        └── pages/           18 страници
```

### Технички одлуки / Technical decisions

**Зошто SQLite?** Базата е една датотека — проектот се клонира и работи без ниту еден чекор за конфигурација на сервер за бази.

**Зошто нема библиотека за графикони?** Сите визуелизации се inline SVG. Палетата за категорични серии е проверена за контраст и за далтонизам — за **секој пар** бои, не само за соседните, при deuteranopia, protanopia и tritanopia. Првичната зелена/портокалова комбинација паѓаше на ΔE 9.3 при protanopia и затоа е заменета со зелена/сина/розова, која и во најлошиот случај се разделува на ΔE 30.6. Проверката е скрипта (`npm run check:contrast`), не тврдење.

**Зошто рамна табела за преводите?** `dict.ts` ги држи двата јазика еден до друг во истиот ред (`['Публикации', 'Publications']`), што прави пропуштен превод веднаш видлив. Полињата во базата се дуплирани како `*_mk` / `*_en`, а `f(row, 'title')` го избира вистинскиот.

**Why SQLite?** The database is a single file — the project clones and runs with no database-server configuration at all.

**Why no charting library?** Every visualisation is inline SVG. The categorical palette is checked for contrast and colour-vision deficiency across **every pair** of colours rather than adjacent ones, under deuteranopia, protanopia and tritanopia. The original green/amber pair collapsed to ΔE 9.3 under protanopia and was replaced by green/blue/rose, whose worst pair still separates at ΔE 30.6. The check is a script (`npm run check:contrast`), not a claim.

**Why a flat translation table?** `dict.ts` keeps both languages side by side on one line, which makes a missing translation immediately visible. Database fields are duplicated as `*_mk` / `*_en`, and `f(row, 'title')` picks the right one.

---

## API

Сите патеки се под `/api`. Оние означени со 🔒 бараат `Authorization: Bearer <token>`.

| Метод | Патека | Опис |
|---|---|---|
| `POST` | `/auth/login` | Најава, враќа JWT |
| `GET` | `/auth/me` 🔒 | Тековен корисник |
| `GET` | `/groups` · `/groups/:slug` | Истражувачки групи |
| `GET` | `/people` · `/people/:slug` | Луѓе; филтри `group`, `seniority`, `q` |
| `GET` | `/projects` | Проекти; филтри `group`, `status` |
| `GET` | `/publications` | Пребарување, филтри, подредување, страничење |
| `GET` | `/publications/facets` | Броеви по година, тип и списание |
| `GET` | `/datasets` · `/datasets/:slug` · `/datasets/:slug/download` | Податочни множества и CSV извадок |
| `GET` | `/news` · `/events` | Вести и настани |
| `POST` | `/events/:id/rsvp` | Пријава за настан (проверка на капацитет и дупликат) |
| `GET` | `/events/:id/ics?lang=mk\|en` | Извоз во календар (RFC 5545) |
| `GET` | `/instruments` · `/instruments/:slug/availability?date=` | Инструменти и достапност по часови; за најавен корисник и дали има обука |
| `POST` | `/bookings` 🔒 | Резервација (преклопување, работно време, траење, хоризонт од 180 дена, квота, обука) |
| `GET` | `/bookings/mine` 🔒 · `DELETE /bookings/:id` 🔒 | Мои резервации / откажување |
| `GET` | `/positions` | Позиции; отворена е додека не помине рокот |
| `POST` | `/positions/:slug/apply` | Пријава за позиција со CV |
| `POST` | `/messages` | Контакт форма |
| `GET` | `/metrics` · `/network` | Агрегати, партнери и мрежа за контролната табла |
| `*` | `/admin/*` 🔒 | CRUD и сандаче, достапно само за `admin` |
| `GET` | `/admin/applications/:id/cv` 🔒 | Преземање на прикачена биографија |

---

## Безбедност / Security

* **Лозинки и токени.** bcrypt; JWT потпишан со `JWT_SECRET`, без кој серверот одбива да стартува во продукција (во развој се користи случајна тајна за секој процес). Улогата секогаш се чита од базата, не од токенот. Непостоечка е-пошта чини исто колку и погрешна лозинка, па одговорот не открива кои сметки постојат.
* **Кој е клиентот.** nginx верува на `X-Forwarded-For` само од проксија на сопствената Docker мрежа (таму стои ingress-от на платформата) и од нив го зема само последниот запис; на `api` му праќа една адреса, а `api` верува точно на тој еден скок. Записите што ги додал самиот клиент никогаш не се читаат — тест и smoke проверка го докажуваат тоа.
* **Ограничувања.** Неуспешни најави: 8 во минута по клиент. Јавни форми (пријави, пораки, RSVP): 10 на 10 минути. Тело на барање: 100 KB, освен за пријава со CV.
* **Прикачени CV.** Наставката одредува формат (PDF, DOC, DOCX); декларираниот тип мора да одговара на неа, а содржината на форматот (DOCX мора да содржи `word/document.xml`). Се чува под случајно име со проверената наставка и се враќа само како прилог, само со администраторски токен.
* **Податоци.** Секое слободно поле има горна граница; административните записи минуваат низ шема; `%` и `_` во пребарување се бараат буквално.
* **nginx.** Content-Security-Policy без надворешни извори (фонтовите се самостојно хостирани), `X-Frame-Options: DENY`, `nosniff`, строга `Referrer-Policy`; без `X-Powered-By` и без CORS.

* **Passwords and tokens.** bcrypt; JWTs signed with `JWT_SECRET`, without which the server refuses to start in production (development uses a random per-process secret). The role is always read from the database. An unknown address costs the same bcrypt comparison as a wrong password, so timing does not reveal which accounts exist.
* **Who the client is.** nginx believes `X-Forwarded-For` only from proxies on its own Docker network — where the platform's ingress sits — and reads only the last entry; it hands the api a single address, and the api trusts exactly that one hop. Entries a client writes itself are never read; a test and a smoke check prove it.
* **Limits.** Failed sign-ins: 8 a minute per client. Public forms: 10 per 10 minutes. Request bodies: 100 KB, except an application carrying a CV.
* **Uploaded CVs.** The extension picks the format (PDF, DOC, DOCX); the declared type must match it, and so must the content (a DOCX must contain `word/document.xml`). Stored under a random name with the vetted extension and returned only as an attachment, only to an administrator.
* **Data.** Every free-text field is capped; administrative records pass through a schema; `%` and `_` in a search match themselves.
* **nginx.** A Content-Security-Policy with no third-party origins, `X-Frame-Options: DENY`, `nosniff`, a strict `Referrer-Policy`; no `X-Powered-By`, no CORS.

### Измислени идентификатори / Fictional identifiers

DOI-ата на публикациите и податочните множества користат префиксот `10.5555`, кој е резервиран за тестирање и не разрешува кон ништо — за да не покажуваат кон туѓи вистински трудови. ORCID и GitHub профили не се наведени од истата причина.

Publication and dataset DOIs use the `10.5555` prefix, which is reserved for testing and resolves nowhere, so none of them points at somebody else's real paper. ORCID and GitHub profiles are left out for the same reason.

---

## Пристапност / Accessibility

* Скок-врска кон главната содржина и семантички ориентири
* Контролите се достижни со тастатура, со видлив фокус прстен
* Мрежата на соработка има и текстуален приказ („Мрежата како список“): група, проекти и коавтори за секоја личност
* Истечена сесија се објавува со порака наместо тивко да не успеваат дејствата
* `aria-pressed`, `aria-expanded`, `aria-label` и `role="status"` / `role="alert"` каде што има состојба
* Графиконите носат текстуален `aria-label`; идентитетот на серијата никогаш не зависи само од боја
* Контрастот се мери со `npm run check:contrast` врз секоја површина, во двете теми: текст ≥ 4.5:1, граници на контроли ≥ 3.0:1, серии во графиконите ≥ 3.0:1
* Мобилното мени е модален дијалог: фокусот влегува во него, останува во него и се враќа на копчето по Escape
* `prefers-reduced-motion` ги гаси сите анимации
* `lang` атрибутот на документот се менува со јазикот

---

## Деплојмент на RepoRun / Deploying on RepoRun

Репозиториумот ги содржи двете датотеки што RepoRun ги бара, во коренот:
`docker-compose.yml` (што се извршува) и `stack.yml` (што се изложува).

The repository contains the two files RepoRun requires, at the root:
`docker-compose.yml` (what runs) and `stack.yml` (what is exposed).

```yaml
# stack.yml
version: 1
ingress:
  - name: app
    service: web      # the nginx web tier; the api service stays internal
    port: 80
    primary: true
    access:
      type: cas
```

Два слоја / Two tiers:

```
                 ┌──────────────────────────────┐
  RepoRun  ─────▶│  web   nginx:80              │
  ingress        │  статички фајлови, gzip,     │
                 │  кеширање, SPA fallback      │
                 └───────────────┬──────────────┘
                                 │  /api  (внатрешна мрежа)
                 ┌───────────────▼──────────────┐
                 │  api   node:4000             │
                 │  Express + SQLite            │
                 │  bind mount: ./data → /data  │
                 └──────────────────────────────┘
```

`web` го служи изградениот клиент и го проследува `/api` до `api`. Сервисот
`api` нема сопствен ingress — достапен е само преку внатрешната мрежа, што
значи дека базата и прикачените датотеки никогаш не се изложени директно.

`web` serves the built client and forwards `/api` to `api`. The `api` service
has no ingress of its own — it is reachable only over the internal network, so
the database and uploaded files are never exposed directly.

Поделбата не е козметичка. nginx ги компресира статичките фајлови и им дава
траен кеш, што Express не го правеше:

The split is not cosmetic. nginx compresses static assets and gives them a
durable cache, which Express was not doing:

| | Express (едно ниво) | nginx (два слоја) |
|---|---|---|
| Пренесени бајти / Bytes on the wire | 356 680 | **108 077** (gzip, 3,3× помалку) |
| `/assets/*` кеш / cache | `max-age=0` | `max-age=31536000, immutable` |
| `index.html` | `max-age=0` | `no-cache, must-revalidate` |

Серверот сè уште може да го служи целиот сајт сам кога се вклучува без
контејнери (`npm start`) — тој код останува за локална работа.

The server can still serve the whole site by itself when run without
containers (`npm start`) — that code remains, for local work.

### Чекори / Steps

1. Push-ни го репозиторумот и внеси ја URL-адресата и гранката на страницата на стекот.
2. Додај ја променливата `JWT_SECRET` како environment value на стекот. **Задолжителна е** — серверот одбива да стартува во продукција без неа, а Compose нема да го подигне стекот. Генерирај ја со `openssl rand -base64 48`.
3. Додај `ADMIN_PASSWORD` и `DEMO_PASSWORD` (и, по избор, `DEMO_LOGINS=researcher`) — види [Демо сметки](#демо-сметки--demo-accounts).
4. Притисни **Validate**, потоа **Deploy**. Првиот build трае неколку минути (се компајлира `better-sqlite3`); двата image-а се градат паралелно.

### Што се случува при првиот деплој / What the first deploy does

Базата не е во репозиториумот. При првото подигање серверот забележува празна
база и автоматски ја полни со демонстрациската содржина, со датуми релативни на
моментот на деплојмент — настаните и резервациите секогаш изгледаат актуелни.
Постави `AUTO_SEED=false` ако сакаш да стартува празна.

The database is not in the repository. On first boot the server notices an empty
database and seeds it with the demonstration content, dated relative to the
moment of deployment — events and bookings always look current. Set
`AUTO_SEED=false` to start empty instead.

### Постојаност / Persistence

| Променлива / Variable | Default | Што прави / What it does |
|---|---|---|
| `JWT_SECRET` | **нема** / none | Потпишување на токени. Серверот одбива да стартува во продукција без неа |
| `AUTO_SEED` | `true` | Полнење на празна база при прво подигање |
| `ADMIN_PASSWORD` · `DEMO_PASSWORD` · `DEMO_LOGINS` | — · — · `none` | Демо сметки — види погоре / Demo accounts — see above |
| `DB_PATH` | `/data/genomika.db` | SQLite датотека, во `./data` на деплојментот |
| `UPLOAD_DIR` | `/data/uploads` | Прикачени биографии, во истата папка |
| `PORT` | `4000` | Внатрешна порта на `api`; nginx ја проследува, `stack.yml` изложува само `web:80` |
| `TZ` | `Europe/Skopje` | Временска зона за „денес“ — резервации, рокови, статус на проекти |
| `TRUSTED_PROXIES` | — | (web) Дополнителни опсези на проксија чиј `X-Forwarded-For` nginx го прифаќа; проксијата на сопствената мрежа се прифаќаат автоматски |

Целата променлива состојба живее во папката `./data` покрај кодот, монтирана во
`api` како `/data`. RepoRun не дозволува именувани волумени, туку само папки
релативни на репозиториумот; `./data` е во `.gitignore`. Податоците преживуваат
redeploy и рестарт — проверено со `docker compose down` и повторно `up`. Копчето
**Delete runtime data** на RepoRun ги брише.

All mutable state lives in `./data` beside the code, mounted into `api` as
`/data`. RepoRun allows no named volumes, only repo-relative folders; `./data`
is gitignored. The data survives a redeploy or restart — checked with
`docker compose down` and `up` again. RepoRun's **Delete runtime data** removes it.

RepoRun ги бара и следниве правила, кои `docker-compose.yml` ги следи: секој
сервис има `cpus` и `mem_limit` (web 0.1 / 64 MB, api 0.4 / 256 MB — вкупно во рамките на квотата од 0.5 CPU) и нема
`restart`. Бидејќи Docker ја создава `./data` како root, `api` стартува како root
само колку да ѝ ја предаде на корисникот `node`, па продолжува како тој
(`server/docker-entrypoint.sh`). / RepoRun also requires, and the compose file
follows: `cpus` and `mem_limit` on every service, and no `restart`. Because
Docker creates `./data` as root, the api starts as root only long enough to
hand it to the `node` user, then runs as that user.

### Локално, со Docker / Locally, with Docker

```bash
echo "JWT_SECRET=$(openssl rand -base64 48)" > .env
docker compose up -d --build
```

`.env` е задолжителна: нема вградена вредност за `JWT_SECRET`, бидејќи тајна
што се наоѓа во репозиториумот не е тајна. / The `.env` file is required: there
is no built-in value for `JWT_SECRET`, because a secret committed to the
repository is not a secret.

Compose-датотеката користи `expose` наместо `ports`, бидејќи RepoRun се грижи
за ingress. За локален пристап додај `ports: ["8080:80"]` на сервисот `web`,
па отвори `http://localhost:8080`.

На Linux објавената порта стигнува до nginx од gateway-от на самата Docker
мрежа, кој nginx тогаш го смета за прокси — безопасно на развојна машина, но
објавена порта не треба да биде изложена на интернет без прокси пред неа.
(Docker Desktop на macOS и Windows се поврзува од надвор од мрежата.)

The compose file uses `expose` rather than `ports`, because RepoRun handles
ingress. For local access add `ports: ["8080:80"]` to the `web` service and
open `http://localhost:8080`.

On a Linux host a published port reaches nginx from the Docker network's own
gateway, which nginx then treats as a proxy; that is harmless on a development
machine but means a published port should not face the internet without a
proxy in front of it. (Docker Desktop on macOS and Windows connects from
outside the network, so it is not affected.)

---

## Лиценца / Licence

Студентски проект изработен за предметот **Деловна пракса**, ФИНКИ.
A student project produced for the **Deloven Praksa** course, FINKI.
