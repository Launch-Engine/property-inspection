const MONDAY_API_URL = 'https://api.monday.com/v2'
const MONDAY_FILE_API_URL = 'https://api.monday.com/v2/file'

interface CreateItemColumns {
  inspector?: string
  inspection_date?: string
  status_label?: string
  photo_count?: number
  submitted_at_iso?: string
  inspection_id?: string
}

interface CreateItemOptions {
  token: string
  board_id: string
  group_id?: string
  item_name: string
  column_ids: {
    inspector: string
    inspection_date: string
    status: string
    photo_count: string
    submitted_at: string
    inspection_id: string
  }
  columns: CreateItemColumns
}

interface UploadFileOptions {
  token: string
  item_id: string
  column_id: string
  file: Uint8Array
  file_name: string
  mime_type: string
}

interface MondayGraphQLResponse<T> {
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

  const json = (await response.json()) as MondayGraphQLResponse<T>
  if (!response.ok || json.errors || json.error_message) {
    const error = json.errors?.[0]?.message || json.error_message || `HTTP ${response.status}`
    throw new Error(`Monday API error: ${error}`)
  }
  if (!json.data) {
    throw new Error('Monday API returned no data.')
  }
  return json.data
}

function isoToMondayDate(iso: string): string {
  // Monday's date column expects YYYY-MM-DD.
  return iso.slice(0, 10)
}

export async function createInspectionItem(options: CreateItemOptions): Promise<{ item_id: string }> {
  const column_values: Record<string, unknown> = {}
  const c = options.column_ids
  const values = options.columns

  if (values.inspector) column_values[c.inspector] = values.inspector
  if (values.inspection_date) {
    column_values[c.inspection_date] = { date: isoToMondayDate(values.inspection_date) }
  }
  if (values.status_label) column_values[c.status] = { label: values.status_label }
  if (typeof values.photo_count === 'number') column_values[c.photo_count] = values.photo_count
  if (values.submitted_at_iso) {
    column_values[c.submitted_at] = { date: isoToMondayDate(values.submitted_at_iso) }
  }
  if (values.inspection_id) column_values[c.inspection_id] = values.inspection_id

  const query = `
    mutation CreateInspectionItem(
      $board_id: ID!
      $item_name: String!
      $column_values: JSON
      $group_id: String
      $create_labels_if_missing: Boolean
    ) {
      create_item(
        board_id: $board_id
        item_name: $item_name
        column_values: $column_values
        group_id: $group_id
        create_labels_if_missing: $create_labels_if_missing
      ) {
        id
      }
    }
  `

  const data = await monday<{ create_item: { id: string } }>(
    query,
    {
      board_id: options.board_id,
      item_name: options.item_name,
      column_values: JSON.stringify(column_values),
      group_id: options.group_id,
      create_labels_if_missing: true,
    },
    options.token,
  )

  return { item_id: data.create_item.id }
}

export async function attachFileToItem(options: UploadFileOptions): Promise<void> {
  const query = `mutation ($file: File!) {
    add_file_to_column(item_id: ${options.item_id}, column_id: "${options.column_id}", file: $file) {
      id
    }
  }`

  // Monday's file upload endpoint expects a multipart form with the GraphQL
  // operation in 'query' and the file under 'variables[file]'.
  const form = new FormData()
  form.append('query', query)
  // Copy bytes into a fresh ArrayBuffer so Blob accepts them under strict TS
  // lib types. Uint8Array.buffer is typed as ArrayBufferLike (possibly
  // SharedArrayBuffer), which BlobPart doesn't allow.
  const buffer = new ArrayBuffer(options.file.byteLength)
  new Uint8Array(buffer).set(options.file)
  const blob = new Blob([buffer], { type: options.mime_type })
  form.append('variables[file]', blob, options.file_name)

  const response = await fetch(MONDAY_FILE_API_URL, {
    method: 'POST',
    headers: {
      Authorization: options.token,
      'API-Version': '2024-10',
    },
    body: form,
  })

  const json = (await response.json()) as MondayGraphQLResponse<{ add_file_to_column: { id: string } }>
  if (!response.ok || json.errors || json.error_message) {
    const error = json.errors?.[0]?.message || json.error_message || `HTTP ${response.status}`
    throw new Error(`Monday file upload error: ${error}`)
  }
}
