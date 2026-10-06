import { useLang } from '../i18n';
import { useFetch } from '../lib/useFetch';
import { PageHeader, Card, Label, Loading, ErrorBox, Stat, SectionHeading, accentVar } from '../components/ui';
import { BarChart, LineChart, HBarChart, Donut, Gantt } from '../components/charts';
import { NetworkGraph, PartnerMap, type GraphNode, type GraphLink, type Partner } from '../components/NetworkGraph';

type Metrics = {
  totals: Record<string, number>;
  publicationsPerYear: { year: number; n: number; citations: number }[];
  byGroup: { slug: string; name_mk: string; name_en: string; accent: string; n: number; citations: number }[];
  openAccessShare: { open_access: number; n: number }[];
  partners: Partner[];
  funding: { slug: string; title_mk: string; title_en: string; funder: string; budget_eur: number; start_date: string; end_date: string; status: string }[];
  topCited: { title: string; year: number; venue: string; citations: number; doi: string }[];
};

const STAT_KEYS = [
  'publications', 'citations', 'people', 'active_projects',
  'datasets', 'dataset_downloads', 'partners', 'active_funding'
] as const;

export default function Metrics() {
  const { t, f, s, formatNumber, formatDate } = useLang();
  const metrics = useFetch<Metrics>('/metrics');
  const network = useFetch<{ nodes: GraphNode[]; links: GraphLink[] }>('/network');

  if (metrics.loading) return <Loading />;
  if (metrics.error || !metrics.data) return <ErrorBox onRetry={metrics.reload} />;

  const data = metrics.data;
  const openAccess = data.openAccessShare.find(x => x.open_access === 1)?.n ?? 0;
  const closed = data.openAccessShare.find(x => x.open_access === 0)?.n ?? 0;

  return (
    <>
      <PageHeader index="12 / METRICS" title={t('met.title')} lead={t('met.lead')} />

      {/* ------------------------------------------------------------ stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-8 pb-12 border-b border-line">
        {STAT_KEYS.map((key, i) => (
          <div key={key} className="rise" style={{ animationDelay: `${i * 55}ms` }}>
            <Stat
              value={key === 'active_funding'
                ? `€${formatNumber(Math.round((data.totals[key] ?? 0) / 1000))}k`
                : formatNumber(data.totals[key] ?? 0)}
              label={t(`met.stat.${key}` as any)}
            />
          </div>
        ))}
      </section>

      {/* ----------------------------------------------------------- charts */}
      <section className="py-14 grid gap-8 lg:grid-cols-2 border-b border-line">
        <Card className="p-6">
          <SectionHeading index="01" title={t('met.perYear')} />
          <BarChart
            data={data.publicationsPerYear.map(y => ({ label: String(y.year), value: y.n }))}
            height={210}
          />
        </Card>

        <Card className="p-6">
          <SectionHeading index="02" title={t('met.stat.citations')} />
          <LineChart
            data={data.publicationsPerYear.map(y => ({ label: String(y.year), value: y.citations }))}
            height={210}
            color="var(--s-blue)"
          />
        </Card>

        <Card className="p-6">
          <SectionHeading index="03" title={t('met.byGroup')} />
          <div className="mt-2">
            <HBarChart
              data={data.byGroup.map(g => ({
                label: f(g, 'name'),
                value: g.n,
                color: accentVar(g.accent),
                meta: `${g.citations} ${t('pub.citations')}`
              }))}
            />
          </div>
        </Card>

        <Card className="p-6">
          <SectionHeading index="04" title={t('met.oa')} />
          <Donut
            caption={t('met.oa')}
            segments={[
              { label: t('met.oa'), value: openAccess, color: 'var(--s-green)' },
              { label: t('met.closed'), value: closed, color: 'var(--s-blue)' }
            ]}
          />
        </Card>
      </section>

      {/* --------------------------------------------------------- timeline */}
      <section className="py-14 border-b border-line">
        <SectionHeading index="05" title={t('met.funding')} />
        <Card className="p-6">
          <Gantt
            formatDate={iso => formatDate(iso, { month: 'short', year: 'numeric' })}
            rows={data.funding.map(project => ({
              label: f(project, 'title'),
              start: project.start_date,
              end: project.end_date,
              meta: `${s(project.funder)} · €${formatNumber(project.budget_eur)}`,
              color: project.status === 'completed'
                ? 'var(--muted)'
                : project.status === 'planned'
                  ? 'var(--s-amber)'
                  : 'var(--s-green)'
            }))}
          />
        </Card>
      </section>

      {/* ---------------------------------------------------------- network */}
      <section className="py-14 border-b border-line">
        <SectionHeading index="06" title={t('met.network')} sub={t('met.networksub')} />
        <Card className="p-4 md:p-6 overflow-hidden">
          {network.loading && <Loading />}
          {network.data && <NetworkGraph nodes={network.data.nodes} links={network.data.links} />}
        </Card>
      </section>

      {/* -------------------------------------------------------- partners */}
      <section className="py-14 border-b border-line">
        <SectionHeading index="07" title={t('met.map')} />
        <Card className="p-4 md:p-6">
          <PartnerMap partners={data.partners} />
        </Card>
      </section>

      {/* ------------------------------------------------------- top cited */}
      <section className="py-14">
        <SectionHeading index="08" title={t('met.topcited')} />
        <ol className="space-y-3">
          {data.topCited.map((pub, i) => (
            <li key={pub.doi ?? i}>
              <Card className="p-5 flex flex-wrap items-baseline gap-5">
                <span className="num text-2xl text-accent w-10 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px] leading-snug">{pub.title}</h3>
                  <p className="label mt-1.5">{pub.venue} · {pub.year}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="num text-xl">{pub.citations}</div>
                  <Label>{t('pub.citations')}</Label>
                </div>
              </Card>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
