import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../i18n';
import { useFetch } from '../lib/useFetch';
import { PageHeader, Card, Label, Loading, ErrorBox, Empty, Toggle, accentVar, DnaStrip } from '../components/ui';

type Group = {
  id: number; slug: string; accent: string; founded: number;
  name_mk: string; name_en: string; tagline_mk: string; tagline_en: string;
  description_mk: string; description_en: string;
  member_count: number; publication_count: number;
};

type Project = {
  id: number; slug: string; status: string; funder: string; grant_code: string;
  budget_eur: number; start_date: string; end_date: string; accent: string;
  title_mk: string; title_en: string; abstract_mk: string; abstract_en: string;
  group_name_mk: string; group_name_en: string; group_slug: string;
  members: { id: number; slug: string; name_mk: string; name_en: string; role: string }[];
};

export default function Research() {
  const { t, f, s, formatDate, formatNumber } = useLang();
  const [status, setStatus] = useState('');
  const groups = useFetch<Group[]>('/groups');
  const projects = useFetch<Project[]>(`/projects${status ? `?status=${status}` : ''}`, [status]);

  return (
    <>
      <PageHeader index="01 / RESEARCH" title={t('research.title')} lead={t('research.lead')} />

      <section className="mb-24">
        <div className="grid md:grid-cols-3">
          {groups.data?.map((group, i) => (
            <Link
              key={group.id}
              to={`/research/${group.slug}`}
              className="group block border-t border-line md:border-t-0 md:border-l first:md:border-l-0 py-9 md:py-0 md:px-8 first:md:pl-0 last:md:pr-0 rise"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <span className="block h-[2px] w-9" style={{ background: accentVar(group.accent) }} />
              <span className="label block mt-6">{t('research.founded')} {group.founded}</span>
              <h2 className="mt-3 text-[1.45rem] leading-[1.15] group-hover:text-accent transition-colors">
                {f(group, 'name')}
              </h2>
              <p className="mt-3 text-[13.5px] italic text-muted">{f(group, 'tagline')}</p>
              <p className="mt-5 text-[13.5px] leading-relaxed text-ink2">{f(group, 'description')}</p>
              <p className="mt-7 label">
                {group.member_count} {t('research.members').toLowerCase()} · {group.publication_count} {t('pub.title').toLowerCase()}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="pt-8 border-t border-line mb-10 flex flex-wrap items-baseline justify-between gap-5">
          <h2 className="text-[clamp(1.5rem,2.6vw,2.1rem)]">{t('research.projects')}</h2>
          <Toggle
            ariaLabel={t('common.status')}
            value={status}
            onChange={setStatus}
            options={[
              { value: '', label: t('common.all') },
              { value: 'active', label: t('research.status.active') },
              { value: 'completed', label: t('research.status.completed') },
              { value: 'planned', label: t('research.status.planned') }
            ]}
          />
        </div>

        {projects.loading && <Loading />}
        {projects.error && <ErrorBox onRetry={projects.reload} />}
        {projects.data?.length === 0 && <Empty />}

        <div>
          {projects.data?.map((project, i) => (
            <div key={project.id} className="border-t border-line py-9 rise" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_260px]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="chip" style={{ borderColor: accentVar(project.accent), color: accentVar(project.accent) }}>
                      {t(`research.status.${project.status}` as any)}
                    </span>
                    <Link to={`/research/${project.group_slug}`} className="chip hover:text-accent">
                      {f(project, 'group_name')}
                    </Link>
                    <span className="chip">{project.grant_code}</span>
                  </div>
                  <h3 className="mt-3 text-xl leading-snug">{f(project, 'title')}</h3>
                  <p className="mt-3 text-[13.5px] leading-relaxed text-ink2">{f(project, 'abstract')}</p>
                  <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5">
                    {project.members.map(member => (
                      <Link key={member.id} to={`/team/${member.slug}`}
                            className="text-[12px] text-muted hover:text-accent link-underline">
                        {f(member, 'name')}{member.role === 'PI' ? ' ·PI' : ''}
                      </Link>
                    ))}
                  </div>
                </div>

                <dl className="space-y-3.5 md:border-l md:border-line md:pl-6">
                  <div>
                    <dt className="label">{t('research.funder')}</dt>
                    <dd className="text-[13px] mt-1">{s(project.funder)}</dd>
                  </div>
                  <div>
                    <dt className="label">{t('research.budget')}</dt>
                    <dd className="num text-[15px] mt-1 text-accent">€ {formatNumber(project.budget_eur)}</dd>
                  </div>
                  <div>
                    <dt className="label">{t('research.period')}</dt>
                    <dd className="num text-[12px] mt-1 text-ink2">
                      {formatDate(project.start_date, { month: 'short', year: 'numeric' })} →{' '}
                      {formatDate(project.end_date, { month: 'short', year: 'numeric' })}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
