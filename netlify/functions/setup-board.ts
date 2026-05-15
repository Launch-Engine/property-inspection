import type { Context } from '@netlify/functions'

const MONDAY_API_URL = 'https://api.monday.com/v2'

interface MondayResponse<T> {
  data?: T
  errors?: Array<{ message: string }>
  error_message?: string
}

async function monday<T>(query: string, variables: Record<string, unknown>, token: string): Promise<T> {
  const response = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token,
      'API-Version': '2024-10',
    },
    body: JSON.stringify({ query, variables }),
  })
  const json = (await response.json()) as MondayResponse<T>
  if (!response.ok || json.errors || json.error_message) {
    const message = json.errors?.[0]?.message || json.error_message || `HTTP ${response.status}`
    throw new Error(message)
  }
  if (!json.data) throw new Error('Monday API returned no data.')
  return json.data
}

interface CreateColumnInput {
  key: string
  title: string
  description: string
  type: 'text' | 'date' | 'status' | 'file' | 'numbers'
}

const COLUMNS_TO_CREATE: CreateColumnInput[] = [
  { key: 'inspector', title: 'Inspector', description: 'Name of the person who completed the inspection', type: 'text' },
  { key: 'inspection_date', title: 'Inspection Date', description: 'Date the inspection was performed', type: 'date' },
  { key: 'status', title: 'Status', description: 'Review status of the inspection submission', type: 'status' },
  { key: 'pdf_report', title: 'PDF Report', description: 'Generated inspection report PDF', type: 'file' },
  { key: 'photo_count', title: 'Photo Count', description: 'Total number of photos in this inspection', type: 'numbers' },
  { key: 'submitted_at', title: 'Submitted At', description: 'When the inspection was synced from the PWA', type: 'date' },
  { key: 'inspection_id', title: 'Inspection ID', description: 'Client-generated UUID for de-duplication on retry', type: 'text' },
]

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

export default async (request: Request, _context: Context): Promise<Response> => {
  if (request.method !== 'POST') {
    return json(405, { error: 'POST only' })
  }

  const apiKey = request.headers.get('x-api-key')
  if (!process.env.INSPECTION_API_KEY || apiKey !== process.env.INSPECTION_API_KEY) {
    return json(401, { error: 'Invalid or missing API key' })
  }

  const token = process.env.MONDAY_API_TOKEN
  if (!token) {
    return json(500, { error: 'MONDAY_API_TOKEN is not set on this site.' })
  }

  let body: { workspace_name?: string; board_name?: string; dry_run?: boolean } = {}
  try {
    body = (await request.json()) as typeof body
  } catch {
    // Body is optional; defaults below.
  }

  const workspaceName = body.workspace_name?.trim() || 'Property Inspections'
  const boardName = body.board_name?.trim() || 'Property Inspections'

  try {
    // 1. Identify the account this token belongs to (sanity check + return label).
    const me = await monday<{ me: { id: string; name: string; email: string; account: { id: string; name: string; slug: string } } }>(
      `query { me { id name email account { id name slug } } }`,
      {},
      token,
    )

    // Dry run: just return the account we'd be writing into. Use this before
    // committing to creating workspaces/boards so we don't pollute the wrong
    // Monday account when the token is misconfigured.
    if (body.dry_run) {
      return json(200, {
        ok: true,
        dry_run: true,
        account: {
          id: me.me.account.id,
          name: me.me.account.name,
          slug: me.me.account.slug,
        },
        user: { id: me.me.id, name: me.me.name, email: me.me.email },
      })
    }

    // 2. Create the workspace.
    const ws = await monday<{ create_workspace: { id: string; name: string } }>(
      `mutation CreateWs($name: String!, $kind: WorkspaceKind!) {
        create_workspace(name: $name, kind: $kind) { id name }
      }`,
      { name: workspaceName, kind: 'open' },
      token,
    )
    const workspaceId = ws.create_workspace.id

    // 3. Create the board inside that workspace.
    const board = await monday<{ create_board: { id: string; name: string } }>(
      `mutation CreateBoard($name: String!, $kind: BoardKind!, $workspace_id: ID!) {
        create_board(board_name: $name, board_kind: $kind, workspace_id: $workspace_id) { id name }
      }`,
      { name: boardName, kind: 'public', workspace_id: workspaceId },
      token,
    )
    const boardId = board.create_board.id

    // 4. Create each column. Monday's API doesn't support batch creation; do
    //    them sequentially so the response order is stable.
    const columnIds: Record<string, string> = {}
    for (const col of COLUMNS_TO_CREATE) {
      const result = await monday<{ create_column: { id: string; title: string } }>(
        `mutation CreateCol($board_id: ID!, $title: String!, $type: ColumnType!, $description: String!) {
          create_column(board_id: $board_id, title: $title, column_type: $type, description: $description) {
            id title
          }
        }`,
        { board_id: boardId, title: col.title, type: col.type, description: col.description },
        token,
      )
      columnIds[col.key] = result.create_column.id
    }

    return json(200, {
      ok: true,
      account: {
        id: me.me.account.id,
        name: me.me.account.name,
        slug: me.me.account.slug,
      },
      workspace_id: workspaceId,
      workspace_name: workspaceName,
      board_id: boardId,
      board_name: boardName,
      column_ids: columnIds,
      netlify_env_vars: {
        MONDAY_BOARD_ID: boardId,
        MONDAY_COL_INSPECTOR: columnIds.inspector,
        MONDAY_COL_INSPECTION_DATE: columnIds.inspection_date,
        MONDAY_COL_STATUS: columnIds.status,
        MONDAY_COL_PDF_REPORT: columnIds.pdf_report,
        MONDAY_COL_PHOTO_COUNT: columnIds.photo_count,
        MONDAY_COL_SUBMITTED_AT: columnIds.submitted_at,
        MONDAY_COL_INSPECTION_ID: columnIds.inspection_id,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('setup-board failed:', message, err)
    return json(500, { error: message })
  }
}
