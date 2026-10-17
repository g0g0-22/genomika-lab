import { useState } from 'react';
import { useLang } from '../i18n';
import { useFetch } from '../lib/useFetch';
import { PageHeader, Card, Loading, ErrorBox, Empty, DnaStrip } from '../components/ui';

type Item = {
  id: number; slug: string; date: string; tag: string;
  title_mk: string; title_en: string; excerpt_mk: string; excerpt_en: string;
  body_mk: string; body_en: string;
};

export default function News() {
  const { t, f, formatDate, tv } = useLang();
  const [tag, setTag] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const news = useFetch<Item[]>('/news');

  const tags = [...new Set(news.data?.map(n => n.tag) ?? [])];
  const visible = news.data?.filter(n => !tag || n.tag === tag) ?? [];

  return (
    <>
      <PageHeader index="07 / NEWS" title={t('news.title')} lead={t('news.lead')}>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" aria-pressed={!tag} className={`chip ${!tag ? 'chip-on' : ''}`} onClick={() => setTag('')}>{t('common.all')}</button>
          {tags.map(x => (
            <button key={x} type="button" aria-pressed={tag === x} className={`chip ${tag === x ? 'chip-on' : ''}`} onClick={() => setTag(x)}>
              {tv('news.tag', x)}
            </button>
          ))}
        </div>
      </PageHeader>

      {news.loading && <Loading />}
      {news.error && <ErrorBox onRetry={news.reload} />}
      {visible.length === 0 && !news.loading && <Empty />}

      <div className="space-y-5">
        {visible.map((item, i) => (
          <Card key={item.id} hover className="p-6 rise" style={{ animationDelay: `${i * 55}ms` }}>
            <div className="flex flex-wrap items-center gap-3">
              <span className="label">{formatDate(item.date)}</span>
              <span className="chip">{tv('news.tag', item.tag)}</span>
            </div>
            <h2 className="mt-3 text-2xl leading-snug">{f(item, 'title')}</h2>
            <p className="mt-3 text-[14px] leading-relaxed text-ink2">{f(item, 'excerpt')}</p>

            {open === item.id && (
              <p className="mt-4 text-[14px] leading-relaxed text-ink2 rise border-l-2 border-accent pl-5">
                {f(item, 'body')}
              </p>
            )}

            <div className="mt-5 flex items-center gap-4">
              <button className="btn btn-sm" onClick={() => setOpen(open === item.id ? null : item.id)}>
                {open === item.id ? t('common.close') : t('common.more')}
              </button>
              <DnaStrip seed={item.slug} count={30} className="flex-1 max-w-[180px] opacity-40" />
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
