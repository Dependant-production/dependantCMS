import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Layouts, Page, useFetchClient } from '@strapi/strapi/admin';
import {
  Box,
  Flex,
  Link,
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
type OverviewState = 'published' | 'modified' | 'draft' | 'no-video';

type OverviewRow = {
  documentId: string;
  category: 'photos' | 'videos';
  title: string;
  creatorName: string;
  projectsOrder: number | null;
  state: OverviewState;
};

type Overview = { onSite: OverviewRow[]; pending: OverviewRow[] };

const STATES: Record<
  OverviewState,
  { label: string; variant: 'success' | 'warning' | 'secondary' | 'danger' }
> = {
  published: { label: 'Publié', variant: 'success' },
  modified: { label: 'Modifications non publiées', variant: 'warning' },
  draft: { label: 'À publier', variant: 'secondary' },
  'no-video': { label: 'Vidéo Mux manquante', variant: 'danger' },
};

const CONTENT_TYPES = {
  photos: { uid: 'api::project.project', label: 'Photo' },
  videos: { uid: 'api::project-video.project-video', label: 'Vidéo' },
};

function ProjectsTable({
  rows,
  numbered = false,
}: {
  rows: OverviewRow[];
  numbered?: boolean;
}) {
  const headers = [
    ...(numbered ? ['#'] : []),
    'Titre',
    'Type',
    'Artiste',
    'Ordre',
    'État',
    '',
  ];

  return (
    <Table colCount={headers.length} rowCount={rows.length + 1}>
      <Thead>
        <Tr>
          {headers.map((header) => (
            <Th key={header}>
              <Typography variant="sigma">{header}</Typography>
            </Th>
          ))}
        </Tr>
      </Thead>
      <Tbody>
        {rows.map((row, index) => {
          const { uid, label } = CONTENT_TYPES[row.category];
          const state = STATES[row.state];

          return (
            <Tr key={`${row.category}-${row.documentId}`}>
              {numbered && (
                <Td>
                  <Typography textColor="neutral800">{index + 1}</Typography>
                </Td>
              )}
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
                <Typography textColor="neutral800">
                  {row.projectsOrder ?? '—'}
                </Typography>
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
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Flex direction="column" alignItems="stretch" gap={3}>
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
      {children}
    </Flex>
  );
}

export default function ProjectsOverview() {
  const { get } = useFetchClient();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    get<Overview>('/dependant/projects-overview')
      .then(({ data }) => setOverview(data))
      .catch(() => setFailed(true));
  }, [get]);

  if (failed) return <Page.Error />;
  if (!overview) return <Page.Loading />;

  const { onSite, pending } = overview;

  return (
    <Page.Main>
      <Page.Title>Onglet Projets</Page.Title>
      <Layouts.Header
        title="Onglet Projets"
        subtitle="Les projets photo et vidéo cochés « showInProjects », dans l’ordre du site."
      />
      <Layouts.Content>
        <Flex direction="column" alignItems="stretch" gap={8}>
          <Section
            title={`Visibles sur le site (${onSite.length})`}
            description="D’abord les projets qui ont un ordre (projectsOrder), puis les autres par ordre alphabétique."
          >
            {onSite.length ? (
              <ProjectsTable rows={onSite} numbered />
            ) : (
              <Typography textColor="neutral600">
                Aucun projet n’est visible. Cochez showInProjects sur un projet,
                puis publiez-le.
              </Typography>
            )}
          </Section>
          {pending.length > 0 && (
            <Section
              title={`Cochés mais pas encore visibles (${pending.length})`}
              description="Publiez la fiche pour afficher le projet. Une vidéo doit aussi avoir un média Mux prêt."
            >
              <ProjectsTable rows={pending} />
            </Section>
          )}
        </Flex>
      </Layouts.Content>
    </Page.Main>
  );
}
