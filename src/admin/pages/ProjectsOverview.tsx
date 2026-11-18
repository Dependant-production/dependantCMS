import { useEffect, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Layouts,
  Page,
  useFetchClient,
  useNotification,
} from '@strapi/strapi/admin';
import {
  Box,
  Field,
  Flex,
  Link,
  NumberInput,
  SingleSelect,
  SingleSelectOption,
  Status,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Typography,
} from '@strapi/design-system';

// Response of GET /dependant/projects-overview (src/utils/projects-overview.ts).
type OverviewState =
  | 'published'
  | 'modified'
  | 'draft'
  | 'no-video'
  | 'to-classify'
  | 'hidden';

type ProjectSection =
  | 'commercials'
  | 'music-videos'
  | 'photography'
  | 'unscripted';

type OverviewRow = {
  documentId: string;
  category: 'photos' | 'videos' | 'homepage';
  title: string;
  creatorName: string;
  projectsSection: ProjectSection | null;
  projectsOrder: number | null;
  state: OverviewState;
};

type Overview = {
  rows: OverviewRow[];
  // Projects each section shows before its "more" button; null: all of them.
  beforeMore: Record<ProjectSection, number | null>;
};

type Placement = Pick<OverviewRow, 'projectsSection' | 'projectsOrder'>;

const STATES: Record<
  OverviewState,
  {
    label: string;
    variant: 'success' | 'warning' | 'secondary' | 'danger' | 'neutral';
  }
> = {
  published: { label: 'Sur le site', variant: 'success' },
  modified: { label: 'Modifications non publiées', variant: 'warning' },
  draft: { label: 'À publier', variant: 'secondary' },
  'no-video': { label: 'Vidéo Mux manquante', variant: 'danger' },
  'to-classify': { label: 'À classer', variant: 'warning' },
  hidden: { label: 'Non affiché', variant: 'neutral' },
};

const CONTENT_TYPES = {
  photos: { uid: 'api::project.project', label: 'Photo' },
  videos: { uid: 'api::project-video.project-video', label: 'Vidéo' },
  homepage: { uid: 'api::homepage-video.homepage-video', label: 'Homepage' },
};

const HEADERS = ['Titre', 'Type', 'Artiste', 'Section', 'Ordre', 'État', ''];

// The select needs a value for "no section"; the API uses null.
const NO_SECTION = 'none';

const SITE_ORDER =
  'Dans l’ordre du site : d’abord les projets qui ont un ordre, puis les autres par ordre alphabétique.';

const SECTIONS: {
  section: ProjectSection | null;
  title: string;
  description: string;
}[] = [
  {
    section: 'commercials',
    title: 'Commercials',
    description: SITE_ORDER,
  },
  {
    section: 'music-videos',
    title: 'Music videos',
    description: SITE_ORDER,
  },
  {
    section: 'photography',
    title: 'Photography',
    description: SITE_ORDER,
  },
  {
    section: 'unscripted',
    title: 'Unscripted',
    description: SITE_ORDER,
  },
  {
    section: null,
    title: 'Hors de l’onglet',
    description:
      'Tous les autres projets. « À classer » : projet sélectionné avant la création des sections, à ranger dans l’une d’elles.',
  },
];

function BeforeMoreInput({
  title,
  count,
  onSave,
}: {
  title: string;
  count: number | null;
  onSave: (count: number | null) => void;
}) {
  const [value, setValue] = useState(count ?? undefined);

  useEffect(() => setValue(count ?? undefined), [count]);

  return (
    <Field.Root
      name={`before-more-${title}`}
      hint="Les suivants s’affichent au clic sur « more ». Vide : tous."
    >
      <Field.Label>Projets affichés sur le site</Field.Label>
      <NumberInput
        aria-label={`Projets affichés dans ${title} avant « more »`}
        value={value}
        onValueChange={setValue}
        onBlur={() => {
          // 0 shows every project, like an empty field.
          const next = value ? value : null;
          if (next !== count) onSave(next);
          else setValue(count ?? undefined);
        }}
      />
      <Field.Hint />
    </Field.Root>
  );
}

function OrderInput({
  row,
  onSave,
}: {
  row: OverviewRow;
  onSave: (order: number | null) => void;
}) {
  const [order, setOrder] = useState(row.projectsOrder ?? undefined);

  useEffect(() => setOrder(row.projectsOrder ?? undefined), [row.projectsOrder]);

  return (
    <NumberInput
      aria-label={`Ordre de ${row.title}`}
      disabled={!row.projectsSection}
      value={order}
      onValueChange={setOrder}
      onBlur={() => {
        if ((order ?? null) !== row.projectsOrder) onSave(order ?? null);
      }}
    />
  );
}

function ProjectsTable({
  rows,
  onSave,
}: {
  rows: OverviewRow[];
  onSave: (row: OverviewRow, placement: Placement) => void;
}) {
  return (
    <Table colCount={HEADERS.length} rowCount={rows.length + 1}>
      <Thead>
        <Tr>
          {HEADERS.map((header) => (
            <Th key={header}>
              <Typography variant="sigma">{header}</Typography>
            </Th>
          ))}
        </Tr>
      </Thead>
      <Tbody>
        {rows.map((row) => {
          const { uid, label } = CONTENT_TYPES[row.category];
          const state = STATES[row.state];

          return (
            <Tr key={`${row.category}-${row.documentId}`}>
              <Td>
                <Typography textColor="neutral800" fontWeight="bold">
                  {row.title}
                </Typography>
              </Td>
              <Td>
                <Typography textColor="neutral800">{label}</Typography>
              </Td>
              <Td>
                <Typography textColor="neutral800">
                  {row.creatorName || '—'}
                </Typography>
              </Td>
              <Td>
                <SingleSelect
                  aria-label={`Section de ${row.title}`}
                  size="S"
                  value={row.projectsSection ?? NO_SECTION}
                  onChange={(value) =>
                    onSave(row, {
                      projectsSection:
                        value === NO_SECTION
                          ? null
                          : (value as ProjectSection),
                      projectsOrder: row.projectsOrder,
                    })
                  }
                >
                  <SingleSelectOption value={NO_SECTION}>
                    Hors de l’onglet
                  </SingleSelectOption>
                  <SingleSelectOption value="commercials">
                    Commercials
                  </SingleSelectOption>
                  <SingleSelectOption value="music-videos">
                    Music videos
                  </SingleSelectOption>
                  <SingleSelectOption value="photography">
                    Photography
                  </SingleSelectOption>
                  <SingleSelectOption value="unscripted">
                    Unscripted
                  </SingleSelectOption>
                </SingleSelect>
              </Td>
              <Td>
                <OrderInput
                  row={row}
                  onSave={(projectsOrder) =>
                    onSave(row, {
                      projectsSection: row.projectsSection,
                      projectsOrder,
                    })
                  }
                />
              </Td>
              <Td>
                <Status variant={state.variant} size="S" width="fit-content">
                  <Typography tag="span" variant="omega" fontWeight="bold">
                    {state.label}
                  </Typography>
                </Status>
              </Td>
              <Td>
                <Link
                  tag={RouterLink}
                  to={`/content-manager/collection-types/${uid}/${row.documentId}`}
                >
                  Ouvrir la fiche
                </Link>
              </Td>
            </Tr>
          );
        })}
      </Tbody>
    </Table>
  );
}

function Section({
  title,
  description,
  setting,
  children,
}: {
  title: string;
  description: string;
  setting?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Flex direction="column" alignItems="stretch" gap={3}>
      <Flex justifyContent="space-between" alignItems="flex-end" gap={6}>
        <Box>
          <Typography variant="delta" tag="h2">
            {title}
          </Typography>
          <Box paddingTop={1}>
            <Typography variant="omega" textColor="neutral600">
              {description}
            </Typography>
          </Box>
        </Box>
        {setting && <Box shrink={0}>{setting}</Box>}
      </Flex>
      {children}
    </Flex>
  );
}

export default function ProjectsOverview() {
  const { get, put } = useFetchClient();
  const { toggleNotification } = useNotification();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [failed, setFailed] = useState(false);
  // Saves run one after the other, so an older response never replaces a
  // newer list.
  const saves = useRef(Promise.resolve());

  useEffect(() => {
    get<Overview>('/dependant/projects-overview')
      .then(({ data }) => setOverview(data))
      .catch(() => setFailed(true));
  }, [get]);

  if (failed) return <Page.Error />;
  if (!overview) return <Page.Loading />;

  const send = (path: string, body: object, failure: string) => {
    saves.current = saves.current
      .then(() => put<Overview>(`/dependant/projects-overview/${path}`, body))
      .then(({ data }) => setOverview(data))
      .catch(() => toggleNotification({ type: 'danger', message: failure }));
  };

  const save = (row: OverviewRow, placement: Placement) =>
    send(
      `${row.category}/${row.documentId}`,
      placement,
      `« ${row.title} » n’a pas pu être enregistré.`,
    );

  const saveBeforeMore = (
    section: ProjectSection,
    title: string,
    count: number | null,
  ) =>
    send(
      'before-more',
      { section, count },
      `Le nombre de projets de ${title} n’a pas pu être enregistré.`,
    );

  return (
    <Page.Main>
      <Page.Title>Onglet Projets</Page.Title>
      <Layouts.Header
        title="Onglet Projets"
        subtitle="Tous les projets : photos, vidéos et vidéos de la homepage. La section, l’ordre et le nombre de projets affichés choisis ici s’enregistrent tout seuls, et le site suit en une minute environ."
      />
      <Layouts.Content>
        <Flex direction="column" alignItems="stretch" gap={8}>
          {SECTIONS.map(({ section, title, description }) => {
            const rows = overview.rows.filter(
              ({ projectsSection }) => projectsSection === section,
            );

            return (
              <Section
                key={title}
                title={`${title} (${rows.length})`}
                description={description}
                setting={
                  section && (
                    <BeforeMoreInput
                      title={title}
                      count={overview.beforeMore[section]}
                      onSave={(count) => saveBeforeMore(section, title, count)}
                    />
                  )
                }
              >
                {rows.length ? (
                  <ProjectsTable rows={rows} onSave={save} />
                ) : (
                  <Typography textColor="neutral600">Aucun projet.</Typography>
                )}
              </Section>
            );
          })}
        </Flex>
      </Layouts.Content>
    </Page.Main>
  );
}
