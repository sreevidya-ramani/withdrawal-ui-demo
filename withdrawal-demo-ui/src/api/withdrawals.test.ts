import { afterEach, describe, expect, it, vi } from 'vitest'
import { submitWithdrawal, WithdrawalApiError } from './withdrawals'

const request = { participantId: 'P1001', withdrawalType: 'PARTIAL', amount: 50 } as const

function mockFetch(body: unknown, ok = true, jsonFails = false) {
  const fn = vi.fn().mockResolvedValue({
    ok,
    json: jsonFails ? () => Promise.reject(new SyntaxError('bad')) : () => Promise.resolve(body),
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('submitWithdrawal', () => {
  it('POSTs JSON to the configured endpoint and returns the response', async () => {
    const fetchMock = mockFetch({ status: 'SUCCESS', message: 'Withdrawal submitted' })

    await expect(submitWithdrawal(request)).resolves.toEqual({
      status: 'SUCCESS',
      message: 'Withdrawal submitted',
    })
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8082/api/v1/withdrawals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
  })

  it('strips trailing slashes from the base URL', async () => {
    vi.stubEnv('VITE_WITHDRAWAL_API_BASE_URL', 'http://host:1///')
    const fetchMock = mockFetch({ status: 'SUCCESS', message: 'ok' })

    await submitWithdrawal(request)
    expect(fetchMock.mock.calls[0][0]).toBe('http://host:1/api/v1/withdrawals')
  })

  it('throws when the base URL is not configured', async () => {
    vi.stubEnv('VITE_WITHDRAWAL_API_BASE_URL', '   ')
    const fetchMock = mockFetch({})

    await expect(submitWithdrawal(request)).rejects.toThrow(/not configured/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('throws WithdrawalApiError carrying the payload on non-2xx', async () => {
    mockFetch({ status: 'REJECTED', message: 'Withdrawal not allowed' }, false)

    const error = await submitWithdrawal(request).catch((e) => e)
    expect(error).toBeInstanceOf(WithdrawalApiError)
    expect(error.response).toEqual({ status: 'REJECTED', message: 'Withdrawal not allowed' })
    expect(error.message).toBe('Withdrawal not allowed')
  })

  it('throws on unreadable (non-JSON) responses', async () => {
    mockFetch(null, true, true)
    await expect(submitWithdrawal(request)).rejects.toThrow(/unreadable/)
  })

  it.each([
    ['null', null],
    ['missing message', { status: 'SUCCESS' }],
    ['non-string status', { status: 1, message: 'x' }],
    ['array', []],
  ])('throws on invalid payload: %s', async (_name, payload) => {
    mockFetch(payload)
    await expect(submitWithdrawal(request)).rejects.toThrow(/invalid response/)
  })

  it('propagates network failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(submitWithdrawal(request)).rejects.toThrow('Failed to fetch')
  })
})
