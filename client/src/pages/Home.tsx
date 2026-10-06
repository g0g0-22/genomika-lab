import { Link } from 'react-router-dom';
import { useLang } from '../i18n';
import { useFetch } from '../lib/useFetch';
import { Card, Label, DnaStrip, ArrowLink, Stat, SectionHeading, accentVar } from '../components/ui';
import { Helix } from '../components/Helix';

type Group = {
  id: number; slug: string; accent: string; founded: number;
  name_mk: string; name_en: string; tagline_mk: string; tagline_en: string;
  member_count: number; publication_count: number;
};
type NewsItem = { id: number; slug: string; date: string; tag: string; title_mk: string; title_en: string; excerpt_mk: string; excerpt_en: string };
type EventItem = { id: number; starts_at: string; location: string; kind: string; title_mk: string; title_en: string; speaker: string };
type Metrics = { totals: Record<string, number> };

const TOOL_LINKS = [
  { to: '/tools/toolkit', key: 'tool.toolkit.name', glyph: 'ATG' },
  { to: '/tools/alignment', key: 'tool.align.name', glyph: '⇄' },
  { to: '/tools/gel', key: 'tool.gel.name', glyph: '≡' },
  { to: '/tools/phylogeny', key: 'tool.phylo.name', glyph: '⋔' },
  { to: '/tools/composition', key: 'tool.comp.name', glyph: '∑' }
] as const;

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
      <section className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_200px] items-center pb-16 border-b border-line">
        <div>
          <div className="flex items-center gap-4 rise">
            <span className="live-dot w-1.5 h-1.5 rounded-full bg-accent inline-block" />
            <Label>{t('home.eyebrow')}</Label>
          </div>

          <h1 className="mt-6 font-display font-semibold leading-[0.95] tracking-tight text-[clamp(2.5rem,7vw,5.2rem)]">
            {/* The trailing spaces keep the accessible name readable — the three
                lines are separate elements only so they can animate in sequence. */}
            <span className="block rise" style={{ animationDelay: '80ms' }}>{t('home.h1a')}{' '}</span>
            <span className="block rise text-accent italic" style={{ animationDelay: '160ms' }}>{t('home.h1b')}{' '}</span>
            <span className="block rise" style={{ animationDelay: '240ms' }}>{t('home.h1c')}</span>
          </h1>

          <DnaStrip seed="hero" count={90} className="mt-8 max-w-lg drawline" />

          <p className="mt-8 max-w-xl text-[15px] leading-relaxed text-ink2 rise" style={{ animationDelay: '320ms' }}>
            {t('home.lead')}
          </p>

          <div className="mt-9 flex flex-wrap gap-3 rise" style={{ animationDelay: '400ms' }}>
            <Link to="/tools" className="btn btn-primary">{t('home.cta.tools')} →</Link>
            <Link to="/research" className="btn">{t('home.cta.research')}</Link>
          </div>
        </div>

        <Helix className="hidden lg:block w-full h-[440px] fade" height={440} />
      </section>

      {/* ----------------------------------------------------------- STATS */}
      {totals && (
        <section className="py-12 border-b border-line">
          <h2 className="label mb-8">{t('home.stats.title')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {([
              ['met.stat.publications', totals.publications],
              ['met.stat.citations', totals.citations],
              ['met.stat.people', totals.people],
              ['met.stat.active_projects', totals.active_projects]
            ] as const).map(([key, value], i) => (
              <div key={key} className="rise" style={{ animationDelay: `${i * 80}ms` }}>
                <Stat value={formatNumber(value ?? 0)} label={t(key)} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------- GROUPS */}
      <section className="py-16 border-b border-line">
        <SectionHeading
          index="01"
          title={t('home.groups')}
          sub={t('home.groups.sub')}
          right={<ArrowLink to="/research">{t('research.title')}</ArrowLink>}
        />
        <div className="grid gap-5 md:grid-cols-3">
          {groups.data?.map((group, i) => (
            <Link key={group.id} to={`/research/${group.slug}`} className="rise block" style={{ animationDelay: `${i * 90}ms` }}>
              <Card hover className="p-6 h-full flex flex-col">
                <span
                  className="block h-[3px] w-12 rounded-full mb-5"
                  style={{ background: accentVar(group.accent) }}
                />
                <Label>{group.founded}</Label>
                <h3 className="mt-2 text-xl leading-snug">{f(group, 'name')}</h3>
                <p className="mt-3 text-[13px] leading-relaxed text-ink2 flex-1">{f(group, 'tagline')}</p>
                <div className="mt-6 flex gap-2">
                  <span className="chip">{group.member_count} {t('research.members').toLowerCase()}</span>
                  <span className="chip">{group.publication_count} {t('pub.title').toLowerCase()}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* ----------------------------------------------------------- TOOLS */}
      <section className="py-16 border-b border-line">
        <SectionHeading
          index="02"
          title={t('home.tools.title')}
          sub={t('home.tools.sub')}
          right={<ArrowLink to="/tools">{t('tools.title')}</ArrowLink>}
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {TOOL_LINKS.map((tool, i) => (
            <Link key={tool.to} to={tool.to} className="rise" style={{ animationDelay: `${i * 70}ms` }}>
              <Card hover className="p-5 h-full">
                <span className="num text-2xl text-accent">{tool.glyph}</span>
                <h3 className="mt-4 text-[15px] leading-snug font-display font-semibold">{t(tool.key)}</h3>
                <DnaStrip seed={tool.to} count={20} className="mt-4 opacity-40" />
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------- NEWS & EVENTS */}
      <section className="py-16 grid gap-12 lg:grid-cols-2 border-b border-line">
        <div>
          <SectionHeading index="03" title={t('home.latest')} right={<ArrowLink to="/news">{t('news.title')}</ArrowLink>} />
          <ul className="space-y-5">
            {news.data?.map(item => (
              <li key={item.id}>
                <Link to="/news" className="group block">
                  <div className="flex items-baseline gap-3">
                    <span className="label shrink-0">{formatDate(item.date, { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    <span className="chip">{t(`news.tag.${item.tag}` as any)}</span>
                  </div>
                  <h3 className="mt-2 text-[17px] leading-snug group-hover:text-accent transition-colors">
                    {f(item, 'title')}
                  </h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{f(item, 'excerpt')}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <SectionHeading index="04" title={t('home.upcoming')} right={<ArrowLink to="/events">{t('ev.title')}</ArrowLink>} />
          <ul className="space-y-3">
            {events.data?.slice(0, 4).map(item => (
              <li key={item.id}>
                <Card hover className="p-4 flex gap-5 items-baseline">
                  <div className="shrink-0 text-center w-12">
                    <div className="num text-xl leading-none">{new Date(item.starts_at).getDate()}</div>
                    <div className="label mt-1">{formatDate(item.starts_at, { month: 'short' })}</div>
                  </div>
                  <div className="min-w-0">
                    <span className="chip">{t(`ev.kind.${item.kind}` as any)}</span>
                    <h3 className="mt-2 text-[15px] leading-snug">{f(item, 'title')}</h3>
                    <p className="mt-1 label truncate">{item.speaker || s(item.location)}</p>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------------ DISCLAIMER */}
      <section className="py-14">
        <Card className="p-7 border-dashed">
          <Label>{t('common.demo')}</Label>
          <h2 className="mt-2 text-xl">{t('home.disclaimer.t')}</h2>
          <p className="mt-3 max-w-3xl text-[13.5px] leading-relaxed text-ink2">{t('home.disclaimer.b')}</p>
        </Card>
      </section>
    </>
  );
}
