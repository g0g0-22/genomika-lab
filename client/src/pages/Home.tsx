import { Link } from 'react-router-dom';
import { useLang } from '../i18n';
import { useFetch } from '../lib/useFetch';
import { Label, ArrowLink, Stat, accentVar } from '../components/ui';
import { Helix } from '../components/Helix';

type Group = {
  id: number; slug: string; accent: string; founded: number;
  name_mk: string; name_en: string; tagline_mk: string; tagline_en: string;
  member_count: number; publication_count: number;
};
type NewsItem = { id: number; slug: string; date: string; tag: string; title_mk: string; title_en: string; excerpt_mk: string; excerpt_en: string };
type EventItem = { id: number; starts_at: string; location: string; kind: string; title_mk: string; title_en: string; speaker: string };
type Metrics = { totals: Record<string, number> };

const TOOLS = [
  { to: '/tools/toolkit', key: 'tool.toolkit.name', desc: 'tool.toolkit.desc' },
  { to: '/tools/gel', key: 'tool.gel.name', desc: 'tool.gel.desc' }
] as const;

/** Section opener: index numeral in the margin, title beside it. */
function Opener({ index, title, sub, right }: { index: string; title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="pt-8 border-t border-line mb-14">
      <div className="grid gap-y-6 md:grid-cols-12 md:gap-x-10 items-start">
        <span className="folio text-muted md:col-span-1">{index}</span>
        <h2 className="md:col-span-6 text-[clamp(1.6rem,3vw,2.5rem)]">{title}</h2>
        <div className="md:col-span-4 md:col-start-9 flex flex-col gap-4">
          {sub && <p className="text-[13.5px] leading-relaxed text-ink2">{sub}</p>}
          {right}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { t, f, s, formatDate, formatNumber } = useLang();
  const groups = useFetch<Group[]>('/groups');
  const news = useFetch<NewsItem[]>('/news?limit=3');
  const events = useFetch<EventItem[]>('/events?scope=upcoming');
  const metrics = useFetch<Metrics>('/metrics');
  const totals = metrics.data?.totals;

  return (
    <>
      {/* ------------------------------------------------------------ HERO */}
      <section className="relative">
        <div className="grid md:grid-cols-12 gap-x-10 items-start">
          <div className="md:col-span-8">
            <Label dot className="rise">{t('home.eyebrow')}</Label>
            <h1 className="mt-7 text-[clamp(2.6rem,7.6vw,6.2rem)] leading-[0.96] tracking-[-.035em]">
              <span className="block rise" style={{ animationDelay: '70ms' }}>{t('home.h1a')}{' '}</span>
              <span className="block rise text-muted" style={{ animationDelay: '150ms' }}>{t('home.h1b')}{' '}</span>
              <span className="block rise" style={{ animationDelay: '230ms' }}>{t('home.h1c')}</span>
            </h1>
          </div>

          <div className="hidden md:block md:col-span-4 -mt-10">
            <Helix className="w-full h-[520px] fade" height={520} />
          </div>
        </div>

        <div className="mt-14 grid md:grid-cols-12 gap-x-10 gap-y-8 items-end">
          <p className="md:col-span-5 text-[14.5px] leading-[1.7] text-ink2 rise" style={{ animationDelay: '310ms' }}>
            {t('home.lead')}
          </p>
          <div className="md:col-span-4 md:col-start-9 flex flex-wrap gap-3 rise" style={{ animationDelay: '380ms' }}>
            <Link to="/tools" className="btn btn-primary">{t('home.cta.tools')} <span aria-hidden="true">→</span></Link>
            <Link to="/research" className="btn">{t('home.cta.research')}</Link>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- 01 GROUPS */}
      <section className="mt-28 md:mt-36">
        <Opener
          index="01"
          title={t('home.groups')}
          sub={t('home.groups.sub')}
          right={<ArrowLink to="/research">{t('research.title')}</ArrowLink>}
        />
        <div className="grid md:grid-cols-3">
          {groups.data?.map((group, i) => (
            <Link
              key={group.id}
              to={`/research/${group.slug}`}
              className="group block border-t border-line md:border-t-0 md:border-l first:md:border-l-0 border-line py-9 md:py-0 md:px-8 first:md:pl-0 last:md:pr-0"
            >
              <span className="block h-[2px] w-9" style={{ background: accentVar(group.accent) }} />
              <span className="label block mt-6">{t('research.founded')} {group.founded}</span>
              <h3 className="mt-3 text-[1.35rem] leading-[1.15] group-hover:text-accent transition-colors">
                {f(group, 'name')}
              </h3>
              <p className="mt-4 text-[13.5px] leading-relaxed text-ink2">{f(group, 'tagline')}</p>
              <p className="mt-7 label">
                {group.member_count} · {group.publication_count} {t('pub.title').toLowerCase()}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------------- 02 TOOLS */}
      <section className="mt-28 md:mt-36">
        <Opener
          index="02"
          title={t('home.tools.title')}
          sub={t('home.tools.sub')}
          right={<ArrowLink to="/tools">{t('tools.title')}</ArrowLink>}
        />
        <ul>
          {TOOLS.map((tool, i) => (
            <li key={tool.to}>
              <Link to={tool.to} className="group grid md:grid-cols-12 gap-x-10 gap-y-2 items-baseline py-6 border-t border-line hover:bg-ground transition-colors md:px-3 md:-mx-3">
                <span className="num text-[12px] text-muted md:col-span-1">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="md:col-span-5 text-[1.15rem] font-display font-medium group-hover:text-accent transition-colors">
                  {t(tool.key)}
                </h3>
                <p className="md:col-span-5 text-[13px] leading-relaxed text-ink2">{t(tool.desc)}</p>
                <span aria-hidden="true" className="md:col-span-1 text-right text-ink2 transition-transform group-hover:translate-x-1 inline-block">→</span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="border-t border-line" />
      </section>

      {/* ------------------------------------------------------- 03 NUMBERS */}
      {totals && (
        <section className="mt-28 md:mt-36">
          <Opener index="03" title={t('home.stats.title')} right={<ArrowLink to="/metrics">{t('met.title')}</ArrowLink>} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-y-12 gap-x-8">
            {([
              ['met.stat.publications', totals.publications],
              ['met.stat.citations', totals.citations],
              ['met.stat.people', totals.people],
              ['met.stat.active_projects', totals.active_projects]
            ] as const).map(([key, value], i) => (
              <div key={key} className="rise" style={{ animationDelay: `${i * 70}ms` }}>
                <Stat value={formatNumber(value ?? 0)} label={t(key)} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------------------------ 04 NEWS & EVENTS */}
      <section className="mt-28 md:mt-36 grid md:grid-cols-12 gap-x-10 gap-y-16">
        <div className="md:col-span-6">
          <div className="pt-8 border-t border-line mb-10 flex items-baseline justify-between gap-5">
            <h2 className="text-[1.5rem]">{t('home.latest')}</h2>
            <ArrowLink to="/news">{t('news.title')}</ArrowLink>
          </div>
          <ul>
            {news.data?.map(item => (
              <li key={item.id} className="border-t border-line first:border-t-0">
                <Link to="/news" className="group block py-6">
                  <div className="flex items-baseline gap-4">
                    <span className="label shrink-0">{formatDate(item.date, { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    <span className="label">{t(`news.tag.${item.tag}` as any)}</span>
                  </div>
                  <h3 className="mt-3 text-[1.05rem] leading-snug group-hover:text-accent transition-colors">
                    {f(item, 'title')}
                  </h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted">{f(item, 'excerpt')}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="md:col-span-5 md:col-start-8">
          <div className="pt-8 border-t border-line mb-10 flex items-baseline justify-between gap-5">
            <h2 className="text-[1.5rem]">{t('home.upcoming')}</h2>
            <ArrowLink to="/events">{t('ev.title')}</ArrowLink>
          </div>
          <ul>
            {events.data?.slice(0, 4).map(item => (
              <li key={item.id} className="border-t border-line first:border-t-0">
                <Link to="/events" className="group flex gap-6 items-baseline py-5">
                  <span className="num text-[12px] text-muted shrink-0 w-16">
                    {formatDate(item.starts_at, { day: '2-digit', month: 'short' })}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[14.5px] leading-snug group-hover:text-accent transition-colors">
                      {f(item, 'title')}
                    </span>
                    <span className="block label mt-1.5 truncate">{item.speaker || s(item.location)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ----------------------------------------------------- DISCLAIMER */}
      <section className="mt-28 md:mt-36 pt-8 border-t border-line">
        <div className="grid md:grid-cols-12 gap-x-10 gap-y-4">
          <Label dot className="md:col-span-3">{t('home.disclaimer.t')}</Label>
          <p className="md:col-span-6 text-[13.5px] leading-relaxed text-ink2">{t('home.disclaimer.b')}</p>
        </div>
      </section>
    </>
  );
}
