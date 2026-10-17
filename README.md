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
| 📅 | Систем за резервација на инструменти со детекција на преклопување | Instrument booking system with overlap detection |
| 🔐 | Автентикација со JWT и улоги (`admin`, `researcher`) | JWT authentication with roles |
| 🗂️ | Администрација со CRUD за публикации, вести и луѓе | Administration with CRUD for publications, news and people |
| 🔎 | Пребарлив каталог на публикации со извоз во BibTeX | Searchable publication catalogue with BibTeX export |
| 📊 | Репозиториум на податоци со преглед и преземање CSV | Dataset repository with preview and CSV download |
| 📈 | Контролна табла со метрики, Gantt и мрежа на соработка | Metrics dashboard with a Gantt chart and collaboration network |
| ✉️ | Пријави за настани (+ `.ics`), за позиции (+ прикачување CV) и контакт форма | Event RSVPs (+ `.ics`), job applications (+ CV upload) and a contact form |
| 🌍 | Целосна двојазичност МК/EN и светла/темна тема | Full MK/EN bilingualism and light/dark themes |

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

**83 теста** во две нивоа / **83 tests** at two levels:

* **32** (`client/tests/bio.test.ts`) ја покриваат алгоритамската библиотека и
  BibTeX извозот — FASTA, транслација, ORF, Tm, молекуларна маса, рестрикциска
  дигестија на линеарна и кружна ДНК — со очекувани вредности што доаѓаат од
  биологијата, не од кодот. / cover the algorithm library and the BibTeX export,
  with expected values taken from the biology rather than from the code.
* **51** (`server/tests/api.test.js`) го возат вистинскиот HTTP слој врз
  привремена база: автентикација и улоги, ограничување на обиди, преклопување и
  квоти на резервации, валидација на датуми и прикачени датотеки, приватност,
  пребарување и администрација. Ништо не е мокирано. / drive the real HTTP layer
  against a throwaway database. Nothing is mocked.

```bash
npm run test:client     # алгоритми / algorithms
npm run test:server     # API

# крај-до-крај, врз подигнат стек (nginx → api → волумен)
BASE_URL=http://localhost:8080 npm run smoke
```

`scripts/smoke.mjs` проверува над 120 работи врз вистинската распоредба — секоја
функционалност од овој документ барем еднаш, вклучително и заглавјата за
кеширање, компресија и безбедност што ги поставува nginx. Може да се изврши
повеќе пати врз ист стек, но пишува демо-записи, па никогаш врз стек со вистински
податоци. / Checks over 120 things against the real deployment — every feature
in this document at least once, including the caching, compression and security
headers nginx sets. It can be re-run against the same stack, but it writes demo
records, so never run it against one holding real data.

---

## Демо сметки / Demo accounts

| Улога / Role | Е-пошта / Email | Лозинка / Password |
|---|---|---|
| Администратор / Administrator | `admin@genomika.mk` | `genomika2026` |
| Истражувач / Researcher | `n.avramovski@genomika.mk` | `genomika2026` |

Seed-от создава четири сметки, од кои **две** се администратори
(`admin@genomika.mk` и `f.micevski@genomika.mk`). / The seed creates four
accounts, **two** of which are administrators.

Најавата е потребна за резервации; администрацијата бара улога `admin`.
Sign-in is required for bookings; administration requires the `admin` role.

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
│       ├── db.js            Шема — 18 табели и еден поглед — и миграции
│       ├── seed.js          Двојазични демо податоци
│       ├── lib/
│       │   ├── auth.js      JWT, bcrypt, улоги, ограничување на обиди за најава
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
    ├── tests/bio.test.ts    32 теста за алгоритмите и BibTeX
    └── src/
        ├── lib/bio/         ★ Алгоритамска библиотека — без надворешни зависности
        │   ├── sequence.ts    Секвенцни операции, кодонска табела, ORF, Tm, маса
        │   ├── enzymes.ts     Рестрикциски ензими, дигестија, миграција на гел
        │   └── samples.ts     Примероци за двете алатки
        ├── lib/bibtex.ts    BibTeX извоз
        ├── i18n/dict.ts     373 двојазични записи во една рамна табела
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
| `GET` | `/instruments` · `/instruments/:slug/availability?date=` | Инструменти и достапност по часови |
| `POST` | `/bookings` 🔒 | Резервација (преклопување, работно време, траење, хоризонт од 180 дена, квота) |
| `GET` | `/bookings/mine` 🔒 · `DELETE /bookings/:id` 🔒 | Мои резервации / откажување |
| `GET` | `/positions` | Позиции; отворена е додека не помине рокот |
| `POST` | `/positions/:slug/apply` | Пријава за позиција со CV |
| `POST` | `/messages` | Контакт форма |
| `GET` | `/metrics` · `/network` · `/partners` | Агрегати за контролната табла |
| `*` | `/admin/*` 🔒 | CRUD и сандаче, достапно само за `admin` |
| `GET` | `/admin/applications/:id/cv` 🔒 | Преземање на прикачена биографија |

---

## Безбедност / Security

* Лозинките се чуваат со bcrypt; токените се JWT потпишани со `JWT_SECRET`, без кој серверот одбива да стартува во продукција. Улогата секогаш се чита од базата, не од токенот.
* Неуспешните најави се ограничуваат по клиент (8 во минута); јавните форми — пријави, пораки, RSVP — по 10 на 10 минути.
* Прикачената биографија се проверува по содржина (magic bytes), не по наведениот тип, пред да се запише на диск, и се презема само со администраторски токен.
* Секое слободно текстуално поле има горна граница на должина; административните записи минуваат низ шема пред да се зачуваат.
* nginx праќа Content-Security-Policy без надворешни извори (фонтовите се самостојно хостирани), `X-Frame-Options: DENY`, `nosniff` и строга `Referrer-Policy`.

* Passwords are hashed with bcrypt; tokens are JWTs signed with `JWT_SECRET`, without which the server refuses to start in production. The role is always read from the database, never from the token.
* Failed sign-ins are throttled per client (8 a minute); public forms — applications, messages, RSVPs — to 10 per 10 minutes.
* An uploaded CV is checked by content (magic bytes), not by its declared type, before it is written, and can only be downloaded with an administrator token.
* Every free-text field is length-capped, and administrative records pass through a schema before they are stored.
* nginx sends a Content-Security-Policy with no third-party origins (fonts are self-hosted), `X-Frame-Options: DENY`, `nosniff` and a strict `Referrer-Policy`.

### Измислени идентификатори / Fictional identifiers

DOI-ата на публикациите и податочните множества користат префиксот `10.5555`, кој е резервиран за тестирање и не разрешува кон ништо — за да не покажуваат кон туѓи вистински трудови. ORCID и GitHub профили не се наведени од истата причина.

Publication and dataset DOIs use the `10.5555` prefix, which is reserved for testing and resolves nowhere, so none of them points at somebody else's real paper. ORCID and GitHub profiles are left out for the same reason.

---

## Пристапност / Accessibility

* Скок-врска кон главната содржина и семантички ориентири
* Контролите се достижни со тастатура, со видлив фокус прстен; вредностите во
  графиконите засега се читаат само со покажувач, но секој графикон носи и `aria-label`
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
                 │  volume: genomika-data       │
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
3. Притисни **Validate**, потоа **Deploy**. Првиот build трае неколку минути (се компајлира `better-sqlite3`); двата image-а се градат паралелно.

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
| `DB_PATH` | `/data/genomika.db` | SQLite датотека, на именуван волумен |
| `UPLOAD_DIR` | `/data/uploads` | Прикачени биографии, на истиот волумен |
| `PORT` | `4000` | Внатрешна порта на `api`; nginx ја проследува, `stack.yml` изложува само `web:80` |
| `TZ` | `Europe/Skopje` | Временска зона за „денес“ — резервации, рокови, статус на проекти |

Целата променлива состојба живее на именуваниот волумен `genomika-data`.
RepoRun никогаш не брише волумени, па резервациите, пријавите и пораките
испратени за време на прегледот преживуваат redeploy.

All mutable state lives on the named volume `genomika-data`. RepoRun never
removes volumes, so bookings, applications and messages submitted during review
survive a redeploy.

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

The compose file uses `expose` rather than `ports`, because RepoRun handles
ingress. For local access add `ports: ["8080:80"]` to the `web` service and
open `http://localhost:8080`.

---

## Лиценца / Licence

Студентски проект изработен за предметот **Деловна пракса**, ФИНКИ.
A student project produced for the **Deloven Praksa** course, FINKI.
