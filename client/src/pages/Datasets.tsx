import { useState } from 'react';
import { useLang } from '../i18n';
import { useFetch } from '../lib/useFetch';
import { PageHeader, Card, Label, Loading, ErrorBox, Empty, CopyButton } from '../components/ui';

type Dataset = {
  id: number; slug: string; format: string; size_mb: number; license: string;
  year: number; downloads: number; doi: string; organism: string; rows_count: number;
  preview_csv: string;
  title_mk: string; title_en: string; description_mk: string; description_en: string;
};

function CsvTable({ csv }: { csv: string }) {
  const rows = csv.trim().split('\n').filter(line => !line.startsWith('#')).map(line => line.split(','));
  if (rows.length === 0) return null;
  const [header, ...body] = rows;
  return (
    <div className="scroll-thin overflow-auto card">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-line bg-bg3">
            {header.map((cell, i) => (
              <th key={i} className="label text-left px-3 py-2 font-normal whitespace-nowrap">{cell}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, i) => (
            <tr key={i} className="border-b border-linesoft last:border-0">
              {row.map((cell, j) => (
                <td key={j} className={`px-3 py-1.5 whitespace-nowrap ${/^-?[\d.]+$/.test(cell) ? 'num text-ink2' : 'text-ink2'}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const formatSize = (mb: number) => (mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`);

export default function Datasets() {
  const { t, f, formatNumber } = useLang();
  const [query, setQuery] = useState('');
  const [license, setLicense] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const datasets = useFetch<Dataset[]>(
    `/datasets?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(license ? { license } : {}) })}`,
    [query, license]
  );

  const licenses = [...new Set(datasets.data?.map(d => d.license) ?? [])];

  return (
    <>
      <PageHeader index="04 / DATA" title={t('data.title')} lead={t('data.lead')}>
        <div className="flex flex-wrap items-center gap-3">
          <input
            className="input max-w-xs"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('data.searchph')}
            aria-label={t('common.search')}
          />
          <div className="flex flex-wrap gap-1.5">
            <button className={`chip ${!license ? 'chip-on' : ''}`} onClick={() => setLicense('')}>{t('common.all')}</button>
            {licenses.map(l => (
              <button key={l} className={`chip ${license === l ? 'chip-on' : ''}`} onClick={() => setLicense(l)}>{l}</button>
            ))}
          </div>
        </div>
      </PageHeader>

      {datasets.loading && <Loading />}
      {datasets.error && <ErrorBox onRetry={datasets.reload} />}
      {datasets.data?.length === 0 && <Empty />}

      <div className="space-y-5">
        {datasets.data?.map((dataset, i) => (
          <Card key={dataset.id} className="p-6 rise" style={{ animationDelay: `${i * 55}ms` }}>
            <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_220px]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="num text-accent text-sm">{dataset.year}</span>
                  <span className="chip">{dataset.format}</span>
                  <span className="chip chip-on">{dataset.license}</span>
                </div>
                <h2 className="mt-3 text-xl leading-snug">{f(dataset, 'title')}</h2>
                <p className="mt-3 text-[13.5px] leading-relaxed text-ink2">{f(dataset, 'description')}</p>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <a className="btn btn-sm btn-primary" href={`/api/datasets/${dataset.slug}/download`}>
                    ↓ {t('data.downloadcsv')}
                  </a>
                  <button className="btn btn-sm" onClick={() => setOpen(open === dataset.slug ? null : dataset.slug)}>
                    {open === dataset.slug ? t('common.close') : t('data.preview')}
                  </button>
                  {dataset.doi && (
                    <a className="btn btn-sm" href={`https://doi.org/${dataset.doi}`} target="_blank" rel="noopener noreferrer">
                      DOI ↗
                    </a>
                  )}
                  <CopyButton text={dataset.doi} label="DOI" />
                </div>
              </div>

              <dl className="grid grid-cols-2 md:grid-cols-1 gap-3.5 md:border-l md:border-line md:pl-6">
                {[
                  [t('data.size'), formatSize(dataset.size_mb)],
                  [t('data.rows'), formatNumber(dataset.rows_count ?? 0)],
                  [t('data.organism'), dataset.organism],
                  [t('data.downloads'), formatNumber(dataset.downloads)]
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <dt className="label">{label}</dt>
                    <dd className="num text-[13px] mt-1 text-ink2">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {open === dataset.slug && (
              <div className="mt-6 rise">
                <p className="label mb-3">{t('data.previewnote')}</p>
                <CsvTable csv={dataset.preview_csv} />
              </div>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}
