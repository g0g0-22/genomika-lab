import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../i18n';
import { useFetch } from '../lib/useFetch';
import { PageHeader, Card, Label, Loading, ErrorBox, Empty, accentVar } from '../components/ui';

type Person = {
  id: number; slug: string; hue: number; seniority: string; joined_year: number;
  name_mk: string; name_en: string; role_mk: string; role_en: string;
  interests: string; email: string; accent: string;
  group_slug: string; group_name_mk: string; group_name_en: string;
};

const ORDER = ['faculty', 'postdoc', 'staff', 'phd', 'msc'] as const;

export function Avatar({ person, size = 46 }: { person: Person; size?: number }) {
  const { f } = useLang();
  const initials = f(person, 'name')
    .replace(/^(проф\.|д-р|Prof\.|Dr\.)\s*/i, '')
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('');
  return (
    <span
      className="rounded-full shrink-0 grid place-items-center num font-semibold"
      style={{
        width: size, height: size,
        background: `oklch(0.88 0.045 ${person.hue})`,
        color: 'var(--ink)',
        fontSize: size * 0.32
      }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

export default function Team() {
  const { t, f } = useLang();
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('');
  const people = useFetch<Person[]>(
    `/people?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(group ? { group } : {}) })}`,
    [query, group]
  );
  const groups = useFetch<{ slug: string; name_mk: string; name_en: string; accent: string }[]>('/groups');

  const grouped = ORDER.map(level => ({
    level,
    members: people.data?.filter(p => p.seniority === level) ?? []
  })).filter(section => section.members.length > 0);

  return (
    <>
      <PageHeader index="02 / TEAM" title={t('team.title')} lead={t('team.lead')}>
        <div className="flex flex-wrap gap-3 items-center">
          <input
            className="input max-w-xs"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('team.searchph')}
            aria-label={t('common.search')}
          />
          <div className="flex flex-wrap gap-1.5">
            <button type="button" aria-pressed={!group} className={`chip ${!group ? 'chip-on' : ''}`} onClick={() => setGroup('')}>{t('common.all')}</button>
            {groups.data?.map(g => (
              <button
                key={g.slug}
                type="button" aria-pressed={group === g.slug}
                className={`chip ${group === g.slug ? 'chip-on' : ''}`}
                onClick={() => setGroup(g.slug)}
                style={group === g.slug ? { borderColor: accentVar(g.accent), color: accentVar(g.accent) } : undefined}
              >
                {f(g, 'name')}
              </button>
            ))}
          </div>
        </div>
      </PageHeader>

      {people.loading && <Loading />}
      {people.error && <ErrorBox onRetry={people.reload} />}
      {people.data?.length === 0 && <Empty />}

      <div className="space-y-14">
        {grouped.map(section => (
          <section key={section.level}>
            <h2 className="label mb-6 pb-2 border-b border-line">
              {t(`team.seniority.${section.level}` as any)} · {section.members.length}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {section.members.map((person, i) => (
                <Link key={person.id} to={`/team/${person.slug}`} className="rise block" style={{ animationDelay: `${i * 55}ms` }}>
                  <Card hover className="p-5 h-full">
                    <div className="flex items-start gap-4">
                      <Avatar person={person} />
                      <div className="min-w-0">
                        <h3 className="text-[15px] leading-snug">{f(person, 'name')}</h3>
                        <p className="label mt-1.5">{f(person, 'role')}</p>
                      </div>
                    </div>
                    {person.group_slug && (
                      <span
                        className="chip mt-4"
                        style={{ borderColor: accentVar(person.accent), color: accentVar(person.accent) }}
                      >
                        {f(person, 'group_name')}
                      </span>
                    )}
                    <p className="mt-3 text-[12px] leading-relaxed text-muted line-clamp-2">
                      {person.interests?.split(';').join(' · ')}
                    </p>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
