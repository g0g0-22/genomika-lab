import { Link, useParams } from 'react-router-dom';
import { useLang } from '../i18n';
import { useFetch } from '../lib/useFetch';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import { Card, Label, Loading, ErrorBox, NotFound, Crumb, DnaStrip, accentVar } from '../components/ui';
import { Avatar } from './Team';

type Person = {
  id: number; slug: string; hue: number; seniority: string; joined_year: number;
  name_mk: string; name_en: string; role_mk: string; role_en: string;
  bio_mk: string; bio_en: string; interests_mk: string; interests_en: string;
  email: string; orcid: string; github: string; accent: string;
  group_slug: string; group_name_mk: string; group_name_en: string;
  publications: { id: number; title: string; authors: string; venue: string; year: number; doi: string; citations: number }[];
  projects: { id: number; slug: string; status: string; title_mk: string; title_en: string; member_role: string }[];
};

export default function PersonDetail() {
  const { slug } = useParams();
  const { t, f, tv } = useLang();
  const { data, loading, error, reload } = useFetch<Person>(`/people/${slug}`, [slug]);
  useDocumentTitle(data ? f(data, 'name') : null);

  if (loading) return <Loading />;
  if (error === 'not_found') return <NotFound />;
  if (error || !data) return <ErrorBox onRetry={reload} />;

  const citations = data.publications.reduce((sum, p) => sum + p.citations, 0);

  return (
    <>
      <div className="mb-8"><Crumb to="/team" label={t('team.title')} /></div>

      <header className="border-b border-line pb-10 mb-12 flex flex-wrap items-start gap-8">
        <Avatar person={data} size={96} />
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl md:text-5xl rise">{f(data, 'name')}</h1>
          <p className="mt-3 text-lg text-muted rise" style={{ animationDelay: '70ms' }}>{f(data, 'role')}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {data.group_slug && (
              <Link to={`/research/${data.group_slug}`} className="chip"
                    style={{ borderColor: accentVar(data.accent), color: accentVar(data.accent) }}>
                {f(data, 'group_name')}
              </Link>
            )}
            <span className="chip">{t('team.since')} {data.joined_year}</span>
          </div>
          <DnaStrip seed={data.slug} count={54} className="mt-7 max-w-sm drawline" />
        </div>
      </header>

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_300px] items-start">
        <div className="space-y-12 min-w-0">
          <section className="prose-lab">
            <p className="text-[15px]">{f(data, 'bio')}</p>
          </section>

          {data.projects.length > 0 && (
            <section>
              <h2 className="text-2xl mb-5">{t('team.projects')}</h2>
              <ul className="space-y-3">
                {data.projects.map(project => (
                  <li key={project.id}>
                    <Card className="p-4 flex items-baseline gap-4">
                      <span className="chip shrink-0">{tv('research.status', project.status)}</span>
                      <span className="text-[15px] leading-snug">{f(project, 'title')}</span>
                      {project.member_role === 'PI' && <span className="chip chip-on ml-auto shrink-0">PI</span>}
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="text-2xl mb-5">{t('team.publications')} · {data.publications.length}</h2>
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
                          <span className="num text-[11px] text-muted" title={t('common.fictionalid')}>doi:{pub.doi}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-28">
          <Card className="p-5">
            <h2 className="label mb-4">{t('team.interests')}</h2>
            <ul className="flex flex-wrap gap-1.5">
              {f(data, 'interests').split(';').filter(Boolean).map(item => (
                <li key={item}><span className="chip">{item.trim()}</span></li>
              ))}
            </ul>
          </Card>

          <Card className="p-5 space-y-3.5">
            <div>
              <Label>{t('team.publications')}</Label>
              <div className="num text-2xl mt-1">{data.publications.length}</div>
            </div>
            <div>
              <Label>{t('met.stat.citations')}</Label>
              <div className="num text-2xl mt-1 text-accent">{citations}</div>
            </div>
          </Card>

          <Card className="p-5 space-y-2.5">
            {data.email && (
              <a href={`mailto:${data.email}`} className="block text-[12.5px] text-ink2 hover:text-accent link-underline break-all">
                {data.email}
              </a>
            )}
            </Card>
        </aside>
      </div>
    </>
  );
}
