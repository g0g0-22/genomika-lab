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
| 🧬 | Пет алатки за анализа на секвенци што работат локално во прелистувач | Five sequence-analysis tools running locally in the browser |
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
npm test
```

24 теста ја покриваат целата алгоритамска библиотека — порамнување, транслација, рестрикциска дигестија и филогенетика — со очекувани вредности земени од учебничките примери.

24 tests cover the whole algorithm library — alignment, translation, restriction digest and phylogenetics — with expected values taken from the standard textbook examples.

---

## Демо сметки / Demo accounts

| Улога / Role | Е-пошта / Email | Лозинка / Password |
|---|---|---|
| Администратор / Administrator | `admin@genomika.mk` | `genomika2026` |
| Истражувач / Researcher | `n.avramovski@genomika.mk` | `genomika2026` |

Најавата е потребна за резервации; администрацијата бара улога `admin`.
Sign-in is required for bookings; administration requires the `admin` role.

---

## Алатките / The tools

Сите пресметки се одвиваат во прелистувачот — ниту еден бајт од внесената секвенца не се испраќа до серверот. Секоја алатка има копче **„Вчитај пример"**.

All computation happens in the browser — not one byte of an entered sequence is sent to the server. Every tool has a **“Load example”** button.

| Алатка / Tool | Алгоритми / Algorithms |
|---|---|
| **Секвенцна работилница** / Sequence Toolkit | Комплемент, транскрипција, транслација во 6 рамки, наоѓање ORF, GC содржина, Tm (Wallace / GC-формула), молекуларна маса |
| **Визуелизатор на порамнување** / Alignment Visualiser | Needleman–Wunsch (глобално), Smith–Waterman (локално), BLOSUM62; целосна матрица на динамичко програмирање со анимирано пополнување по антидијагонали и осветлено враќање наназад |
| **Виртуелна електрофореза** / Virtual Electrophoresis | 20 рестрикциски ензими со IUPAC препознавање, дигестија на линеарна и кружна ДНК, симулиран агарозен гел (0.7–2.0 %) со логаритамска миграција |
| **Филогенетско дрво** / Phylogenetic Tree | p-растојание и Jukes–Cantor корекција, UPGMA, Neighbour-Joining, извоз во Newick |
| **Композициска анализа** / Composition Analysis | k-мер спектар (k = 1…6), кодонска употреба по аминокиселина, GC асиметрија, Kyte–Doolittle профил на хидрофобност |

### Проверливост / Verifiability

Резултатите се споредливи со референтни имплементации:

* `GCATGCG` / `GATTACA`, match +1, mismatch −1, gap −1 → **NW резултат 0**
* `GGTTGACTA` / `TGTTACGG`, match +3, mismatch −3, gap −2 → **SW резултат 13**, порамнување `GTTGAC` / `GTT-AC`
* `HEAGAWGHEE` / `PAWHEAE`, BLOSUM62, gap −8 → **SW резултат 20**, порамнување `AWGHE` / `AW-HE`
* Кодирачкиот регион на човечкиот β-глобин → протеин што почнува со `MVHLTPEEK`, 147 аминокиселини

---

## Архитектура / Architecture

```
genomika-lab/
├── server/                  Express + SQLite (better-sqlite3), ESM
│   └── src/
│       ├── db.js            Шема на базата — 18 табели
│       ├── seed.js          Двојазични демо податоци
│       ├── index.js         Влезна точка; служи и client/dist
│       ├── lib/auth.js      JWT, bcrypt, middleware за улоги
│       └── routes/
│           ├── content.js   Групи, луѓе, проекти, публикации, податоци, вести, метрики, мрежа
│           ├── events.js    Настани, пријави, .ics извоз
│           ├── booking.js   Инструменти, достапност, резервации
│           ├── careers.js   Позиции, пријави со CV, контакт пораки
│           └── admin.js     CRUD зад улога `admin`
│
└── client/                  React 18 + TypeScript + Vite + Tailwind v4
    ├── tests/bio.test.ts    24 теста за алгоритамската библиотека
    └── src/
        ├── lib/bio/         ★ Алгоритамска библиотека — без надворешни зависности
        │   ├── sequence.ts    Секвенцни операции, кодонска табела, ORF, k-мери
        │   ├── align.ts       Динамичко програмирање + BLOSUM62
        │   ├── enzymes.ts     Рестрикциски ензими, дигестија, миграција на гел
        │   ├── phylo.ts       Растојанија, UPGMA, Neighbour-Joining, Newick
        │   └── samples.ts     Примероци за секоја алатка
        ├── i18n/dict.ts     385 двојазични записи во една рамна табела
        ├── components/      Дизајн систем, графикони, мрежен граф, приказ на секвенци
        └── pages/           17 страници
```

### Технички одлуки / Technical decisions

**Зошто SQLite?** Базата е една датотека — проектот се клонира и работи без ниту еден чекор за конфигурација на сервер за бази.

**Зошто нема библиотека за графикони?** Сите визуелизации се inline SVG. Палетата за категорични серии е валидирана за контраст и за далтонизам (проверени се разделбата при deuteranopia/protanopia/tritanopia и контрастот наспроти подлогата во двете теми).

**Зошто рамна табела за преводите?** `dict.ts` ги држи двата јазика еден до друг во истиот ред (`['Публикации', 'Publications']`), што прави пропуштен превод веднаш видлив. Полињата во базата се дуплирани како `*_mk` / `*_en`, а `f(row, 'title')` го избира вистинскиот.

**Why SQLite?** The database is a single file — the project clones and runs with no database-server configuration at all.

**Why no charting library?** Every visualisation is inline SVG. The categorical palette is validated for contrast and colour-vision deficiency (deuteranopia / protanopia / tritanopia separation and contrast against the surface, in both themes).

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
| `GET` | `/datasets` · `/datasets/:slug/download` | Податочни множества и CSV извадок |
| `GET` | `/news` · `/events` | Вести и настани |
| `POST` | `/events/:id/rsvp` | Пријава за настан (проверка на капацитет и дупликат) |
| `GET` | `/events/:id/ics` | Извоз во календар |
| `GET` | `/instruments/:slug/availability?date=` | Достапност по часови |
| `POST` | `/bookings` 🔒 | Резервација (проверки за преклопување, работно време, траење) |
| `GET` | `/bookings/mine` 🔒 · `DELETE /bookings/:id` 🔒 | Мои резервации / откажување |
| `POST` | `/positions/:slug/apply` | Пријава за позиција со CV |
| `POST` | `/messages` | Контакт форма |
| `GET` | `/metrics` · `/network` · `/partners` | Агрегати за контролната табла |
| `*` | `/admin/*` 🔒 | CRUD, достапно само за `admin` |

---

## Пристапност / Accessibility

* Скок-врска кон главната содржина и семантички ориентири
* Секој интерактивен елемент е достижен со тастатура, со видлив фокус прстен
* `aria-pressed`, `aria-expanded`, `aria-label` и `role="status"` / `role="alert"` каде што има состојба
* Графиконите носат текстуален `aria-label`; идентитетот на серијата никогаш не зависи само од боја
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
2. Додај ја променливата `JWT_SECRET` како environment value на стекот — произволна долга низа.
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
| `JWT_SECRET` | dev fallback | Потпишување на токени — **постави ја на RepoRun** |
| `AUTO_SEED` | `true` | Полнење на празна база при прво подигање |
| `DB_PATH` | `/data/genomika.db` | SQLite датотека, на именуван волумен |
| `UPLOAD_DIR` | `/data/uploads` | Прикачени биографии, на истиот волумен |
| `PORT` | `4000` | Портата што `stack.yml` ја изложува |

Целата променлива состојба живее на именуваниот волумен `genomika-data`.
RepoRun никогаш не брише волумени, па резервациите, пријавите и пораките
испратени за време на прегледот преживуваат redeploy.

All mutable state lives on the named volume `genomika-data`. RepoRun never
removes volumes, so bookings, applications and messages submitted during review
survive a redeploy.

### Локално, со Docker / Locally, with Docker

```bash
docker compose up -d --build
```

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
