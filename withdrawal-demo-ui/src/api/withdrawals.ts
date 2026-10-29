export type WithdrawalType = 'PARTIAL' | 'FULL'

export interface WithdrawalRequest {
  participantId: string
  withdrawalType: WithdrawalType
  amount: number
}

export interface WithdrawalResponse {
  status: string
  message: string
}

export class WithdrawalApiError extends Error {
  readonly response: WithdrawalResponse

  constructor(response: WithdrawalResponse) {
    super(response.message)
    this.response = response
    this.name = 'WithdrawalApiError'
  }
}

function isWithdrawalResponse(value: unknown): value is WithdrawalResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    typeof value.status === 'string' &&
    'message' in value &&
    typeof value.message === 'string'
  )
}

export async function submitWithdrawal(
  request: WithdrawalRequest,
): Promise<WithdrawalResponse> {
  const configuredBaseUrl = import.meta.env.VITE_WITHDRAWAL_API_BASE_URL?.trim()

  if (!configuredBaseUrl) {
    throw new Error('Withdrawal API is not configured. Set VITE_WITHDRAWAL_API_BASE_URL.')
  }

  const baseUrl = configuredBaseUrl.replace(/\/+$/, '')
  const response = await fetch(`${baseUrl}/api/v1/withdrawals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new Error('Withdrawal service returned an unreadable response.')
  }

  if (!isWithdrawalResponse(payload)) {
    throw new Error('Withdrawal service returned an invalid response.')
  }

  if (!response.ok) {
    throw new WithdrawalApiError(payload)
  }

  return payload
}