import { useMemo, useState } from 'react';
import { useLang } from '../i18n';
import { useFetch } from '../lib/useFetch';
import { PageHeader, Card, Label, Loading, ErrorBox, Empty, Toggle, download, CopyButton, accentVar } from '../components/ui';
import { BarChart } from '../components/charts';
import { toBibtex } from '../lib/bibtex';

type Pub = {
  id: number; title: string; authors: string; venue: string; year: number;
  type: string; doi: string; citations: number; open_access: number;
  keywords: string; abstract: string; accent: string;
  group_slug: string; group_name_mk: string; group_name_en: string;
};
type Page = { items: Pub[]; total: number; page: number; pages: number; limit: number };
type Facets = { years: { year: number; n: number }[]; types: { type: string; n: number }[] };

export default function Publications() {
  const { t, f, formatNumber } = useLang();
  const [query, setQuery] = useState('');
  const [year, setYear] = useState('');
  const [group, setGroup] = useState('');
  const [type, setType] = useState('');
  const [openAccess, setOpenAccess] = useState(false);
  const [sort, setSort] = useState('year');
  const [order, setOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<number | null>(null);

  const params = new URLSearchParams({
    ...(query ? { q: query } : {}),
    ...(year ? { year } : {}),
    ...(group ? { group } : {}),
    ...(type ? { type } : {}),
    ...(openAccess ? { openAccess: 'true' } : {}),
    sort, order, page: String(page), limit: '8'
  });

  const result = useFetch<Page>(`/publications?${params}`, [query, year, group, type, openAccess, sort, order, page]);
  const facets = useFetch<Facets>('/publications/facets');
  const groups = useFetch<{ slug: string; name_mk: string; name_en: string; accent: string }[]>('/groups');

  const reset = (fn: () => void) => { fn(); setPage(1); };

  const perYear = useMemo(
    () => (facets.data?.years ?? []).slice().sort((a, b) => a.year - b.year).map(y => ({ label: String(y.year), value: y.n })),
    [facets.data]
  );

  const exportAll = async () => {
    const all = await fetch(`/api/publications?${new URLSearchParams({ ...Object.fromEntries(params), limit: '50', page: '1' })}`).then(r => r.json());
    download('genomika-lab.bib', all.items.map(toBibtex).join('\n\n'), 'application/x-bibtex');
  };

  return (
    <>
      <PageHeader index="03 / PUBS" title={t('pub.title')} lead={t('pub.lead')} />

      <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)] items-start">
        {/* -------------------------------------------------------- filters */}
        <aside className="space-y-6 lg:sticky lg:top-28">
          <div>
            <Label>{t('common.search')}</Label>
            <input
              className="input mt-2"
              value={query}
              onChange={e => reset(() => setQuery(e.target.value))}
              placeholder={t('pub.searchph')}
              aria-label={t('common.search')}
            />
          </div>

          <div>
            <Label>{t('common.year')}</Label>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <button className={`chip ${!year ? 'chip-on' : ''}`} onClick={() => reset(() => setYear(''))}>{t('common.all')}</button>
              {facets.data?.years.map(y => (
                <button key={y.year} className={`chip ${year === String(y.year) ? 'chip-on' : ''}`}
                        onClick={() => reset(() => setYear(String(y.year)))}>
                  {y.year} <span className="opacity-60">{y.n}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>{t('common.group')}</Label>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <button className={`chip ${!group ? 'chip-on' : ''}`} onClick={() => reset(() => setGroup(''))}>{t('common.all')}</button>
              {groups.data?.map(g => (
                <button key={g.slug} className={`chip ${group === g.slug ? 'chip-on' : ''}`}
                        style={group === g.slug ? { borderColor: accentVar(g.accent), color: accentVar(g.accent) } : undefined}
                        onClick={() => reset(() => setGroup(g.slug))}>
                  {f(g, 'name')}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>{t('common.type')}</Label>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <button className={`chip ${!type ? 'chip-on' : ''}`} onClick={() => reset(() => setType(''))}>{t('common.all')}</button>
              {facets.data?.types.map(x => (
                <button key={x.type} className={`chip ${type === x.type ? 'chip-on' : ''}`}
                        onClick={() => reset(() => setType(x.type))}>
                  {t(`pub.type.${x.type}` as any)}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={openAccess} className="accent-[var(--accent)]"
                   onChange={e => reset(() => setOpenAccess(e.target.checked))} />
            <span className="text-[12.5px] text-ink2">{t('pub.openaccess')}</span>
          </label>

          <button className="btn btn-sm w-full justify-center" onClick={exportAll}>{t('pub.exportall')}</button>

          {perYear.length > 0 && (
            <Card className="p-4">
              <Label>{t('met.perYear')}</Label>
              <div className="mt-4"><BarChart data={perYear} height={110} /></div>
            </Card>
          )}
        </aside>

        {/* --------------------------------------------------------- result */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-line">
            <span className="label">
              {formatNumber(result.data?.total ?? 0)} {t('pub.found')}
            </span>
            <div className="flex items-center gap-2">
              <Toggle
                ariaLabel={t('common.sort')}
                value={sort}
                onChange={v => reset(() => setSort(v))}
                options={[
                  { value: 'year', label: t('pub.sort.year') },
                  { value: 'citations', label: t('pub.sort.citations') },
                  { value: 'title', label: t('pub.sort.title') }
                ]}
              />
              <button className="btn btn-sm" onClick={() => setOrder(o => (o === 'desc' ? 'asc' : 'desc'))}
                      aria-label={t('common.sort')}>
                {order === 'desc' ? '↓' : '↑'}
              </button>
            </div>
          </div>

          {result.loading && <Loading />}
          {result.error && <ErrorBox onRetry={result.reload} />}
          {result.data?.items.length === 0 && <Empty />}

          <ul className="space-y-4">
            {result.data?.items.map((pub, i) => (
              <li key={pub.id} className="rise" style={{ animationDelay: `${i * 45}ms` }}>
                <Card hover className="p-5">
                  <div className="flex flex-wrap items-center gap-2 mb-2.5">
                    <span className="num text-accent text-sm">{pub.year}</span>
                    <span className="chip">{t(`pub.type.${pub.type}` as any)}</span>
                    {pub.group_slug && (
                      <span className="chip" style={{ borderColor: accentVar(pub.accent), color: accentVar(pub.accent) }}>
                        {f(pub, 'group_name')}
                      </span>
                    )}
                    {pub.open_access === 1 && <span className="chip chip-on">OA</span>}
                    <span className="label ml-auto">{pub.citations} {t('pub.citations')}</span>
                  </div>

                  <h2 className="text-[17px] leading-snug">{pub.title}</h2>
                  <p className="mt-2 text-[13px] text-muted">{pub.authors}</p>
                  <p className="mt-0.5 text-[13px] text-ink2 italic">{pub.venue}</p>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {pub.doi && (
                      <a href={`https://doi.org/${pub.doi}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm">
                        DOI ↗
                      </a>
                    )}
                    <button className="btn btn-sm" onClick={() => setExpanded(expanded === pub.id ? null : pub.id)}>
                      {t('pub.bibtex')}
                    </button>
                    {pub.keywords?.split(';').filter(Boolean).slice(0, 3).map(kw => (
                      <span key={kw} className="chip">{kw}</span>
                    ))}
                  </div>

                  {expanded === pub.id && (
                    <div className="mt-4 rise">
                      <pre className="seq card p-3.5 scroll-thin overflow-auto text-[11.5px] whitespace-pre">{toBibtex(pub)}</pre>
                      <div className="flex gap-2 mt-2">
                        <CopyButton text={toBibtex(pub)} />
                        <button className="btn btn-sm" onClick={() => download(`${pub.id}.bib`, toBibtex(pub), 'application/x-bibtex')}>
                          .bib
                        </button>
                      </div>
                    </div>
                  )}
                </Card>
              </li>
            ))}
          </ul>

          {(result.data?.pages ?? 1) > 1 && (
            <nav className="mt-10 flex items-center justify-center gap-3" aria-label="pagination">
              <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                ← {t('common.prev')}
              </button>
              <span className="num text-[12px] text-muted">
                {t('common.page')} {result.data?.page} {t('common.of')} {result.data?.pages}
              </span>
              <button className="btn btn-sm" disabled={page >= (result.data?.pages ?? 1)} onClick={() => setPage(p => p + 1)}>
                {t('common.next')} →
              </button>
            </nav>
          )}
        </div>
      </div>
    </>
  );
}
