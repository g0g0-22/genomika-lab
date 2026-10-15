import { Link, useParams } from 'react-router-dom';
import { useLang } from '../i18n';
import { useFetch } from '../lib/useFetch';
import { Card, Label, Loading, ErrorBox, Crumb, DnaStrip, accentVar } from '../components/ui';

type Detail = {
  id: number; slug: string; accent: string; founded: number;
  name_mk: string; name_en: string; tagline_mk: string; tagline_en: string;
  description_mk: string; description_en: string;
  people: { id: number; slug: string; hue: number; name_mk: string; name_en: string; role_mk: string; role_en: string; seniority: string }[];
  projects: { id: number; slug: string; status: string; title_mk: string; title_en: string; funder: string; start_date: string; end_date: string }[];
  publications: { id: number; title: string; authors: string; venue: string; year: number; doi: string; citations: number }[];
};

export default function GroupDetail() {
  const { slug } = useParams();
  const { t, f, s, formatDate } = useLang();
  const { data, loading, error, reload } = useFetch<Detail>(`/groups/${slug}`, [slug]);

  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox onRetry={reload} />;

  const accent = accentVar(data.accent);

  return (
    <>
      <div className="mb-8"><Crumb to="/research" label={t('research.title')} /></div>

      <header className="border-b border-line pb-10 mb-12">
        <span className="block h-[3px] w-20 rounded-full" style={{ background: accent }} />
        <Label className="block mt-5">{t('research.founded')} {data.founded}</Label>
        <h1 className="mt-3 text-4xl md:text-6xl rise">{f(data, 'name')}</h1>
        <p className="mt-4 text-lg italic text-muted rise" style={{ animationDelay: '80ms' }}>{f(data, 'tagline')}</p>
        <p className="mt-6 max-w-3xl text-[15px] leading-relaxed text-ink2 rise" style={{ animationDelay: '140ms' }}>
          {f(data, 'description')}
        </p>
        <DnaStrip seed={data.slug} count={70} className="mt-8 max-w-lg drawline" />
      </header>

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
        <div className="space-y-12 min-w-0">
          <section>
            <h2 className="text-2xl mb-6">{t('research.projects')}</h2>
            <div className="space-y-3">
              {data.projects.map(project => (
                <Card key={project.id} className="p-5">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="chip" style={{ borderColor: accent, color: accent }}>
                      {t(`research.status.${project.status}` as any)}
                    </span>
                    <span className="chip">{s(project.funder)}</span>
                  </div>
                  <h3 className="text-[17px] leading-snug">{f(project, 'title')}</h3>
                  <p className="num text-[11px] text-muted mt-2">
                    {formatDate(project.start_date, { month: 'short', year: 'numeric' })} →{' '}
                    {formatDate(project.end_date, { month: 'short', year: 'numeric' })}
                  </p>
                </Card>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-2xl mb-6">{t('pub.title')}</h2>
            <ul className="space-y-4">
              {data.publications.map(pub => (
                <li key={pub.id} className="border-b border-linesoft pb-4">
                  <div className="flex items-baseline gap-3">
                    <span className="num text-accent text-sm shrink-0">{pub.year}</span>
                    <div className="min-w-0">
                      <h3 className="text-[15px] leading-snug">{pub.title}</h3>
                      <p className="text-[12px] text-muted mt-1">{pub.authors} · <i>{pub.venue}</i></p>
                      <div className="mt-2 flex items-center gap-3">
                        <span className="label">{pub.citations} {t('pub.citations')}</span>
                        {pub.doi && (
                          <a href={`https://doi.org/${pub.doi}`} target="_blank" rel="noopener noreferrer"
                             className="label text-accent link-underline">DOI</a>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="lg:sticky lg:top-28">
          <h2 className="label mb-4">{t('research.members')}</h2>
          <ul className="space-y-2">
            {data.people.map(person => (
              <li key={person.id}>
                <Link to={`/team/${person.slug}`}>
                  <Card hover className="p-3.5 flex items-center gap-3.5">
                    <span
                      className="w-9 h-9 rounded-full shrink-0 grid place-items-center num text-[11px]"
                      style={{ background: `oklch(0.88 0.045 ${person.hue})`, color: 'var(--ink)' }}
                      aria-hidden="true"
                    >
                      {f(person, 'name').replace(/^(проф\.|д-р|Prof\.|Dr\.)\s*/i, '').split(' ').map(w => w[0]).slice(0, 2).join('')}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] leading-snug truncate">{f(person, 'name')}</span>
                      <span className="block label truncate">{f(person, 'role')}</span>
                    </span>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </>
  );
}
