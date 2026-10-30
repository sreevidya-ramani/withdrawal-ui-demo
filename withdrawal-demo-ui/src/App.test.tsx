import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { WithdrawalApiError } from './api/withdrawals'

vi.mock('./api/withdrawals', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api/withdrawals')>()),
  submitWithdrawal: vi.fn(),
}))

import { submitWithdrawal } from './api/withdrawals'

const submitMock = vi.mocked(submitWithdrawal)

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  { id = 'P1001', type = 'PARTIAL', amount = '50' } = {},
) {
  if (id) await user.type(screen.getByLabelText('Participant ID'), id)
  if (type) await user.selectOptions(screen.getByLabelText('Withdrawal Type'), type)
  if (amount) await user.type(screen.getByLabelText('Amount'), amount)
}

const submitButton = () => screen.getByRole('button', { name: /submit withdrawal|submitting/i })

beforeEach(() => submitMock.mockReset())

describe('App', () => {
  it('renders the form and an initial placeholder', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Withdrawal Portal' })).toBeInTheDocument()
    expect(screen.getByText(/service response will appear here/i)).toBeInTheDocument()
  })

  it('submits trimmed, numeric values and shows a success response', async () => {
    submitMock.mockResolvedValue({ status: 'SUCCESS', message: 'Withdrawal submitted' })
    const user = userEvent.setup()
    render(<App />)

    await fillForm(user, { id: '  P1001  ', type: 'FULL', amount: '12.5' })
    await user.click(submitButton())

    expect(await screen.findByText('Withdrawal submitted')).toBeInTheDocument()
    expect(submitMock).toHaveBeenCalledWith({
      participantId: 'P1001',
      withdrawalType: 'FULL',
      amount: 12.5,
    })
    expect(screen.getByText('SUCCESS')).toBeInTheDocument()
    expect(document.querySelector('.result-panel')).toHaveClass('is-success')
  })

  it('shows the service message when the request is rejected', async () => {
    submitMock.mockRejectedValueOnce(
      new WithdrawalApiError({ status: 'REJECTED', message: 'Withdrawal not allowed' }),
    )
    const user = userEvent.setup()
    render(<App />)

    await fillForm(user, { id: 'P1006' })
    await user.click(submitButton())

    expect(await screen.findByText('Withdrawal not allowed')).toBeInTheDocument()
    expect(screen.getByText('REJECTED')).toBeInTheDocument()
    expect(document.querySelector('.result-panel')).not.toHaveClass('is-success')
    expect(document.querySelector('.result-panel')).toHaveClass('has-error')
  })

  it('treats a non-success status on a 2xx response as an error', async () => {
    submitMock.mockResolvedValue({ status: 'PENDING', message: 'Hold on' })
    const user = userEvent.setup()
    render(<App />)

    await fillForm(user)
    await user.click(submitButton())

    expect(await screen.findByText('Hold on')).toBeInTheDocument()
    expect(document.querySelector('.result-panel')).not.toHaveClass('is-success')
  })

  it('treats a lowercase "success" status as success', async () => {
    submitMock.mockResolvedValue({ status: 'success', message: 'Done' })
    const user = userEvent.setup()
    render(<App />)

    await fillForm(user)
    await user.click(submitButton())

    await waitFor(() =>
      expect(document.querySelector('.result-panel')).toHaveClass('is-success'),
    )
  })

  it('shows the error message on network/other failures', async () => {
    submitMock.mockRejectedValueOnce(new Error('Failed to fetch'))
    const user = userEvent.setup()
    render(<App />)

    await fillForm(user)
    await user.click(submitButton())

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to fetch')
  })

  it('uses a fallback message when a non-Error value is thrown', async () => {
    submitMock.mockRejectedValueOnce('boom')
    const user = userEvent.setup()
    render(<App />)

    await fillForm(user)
    await user.click(submitButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(/network error prevented/i)
  })

  describe('validation', () => {
    it('requires a participant ID', async () => {
      const user = userEvent.setup()
      render(<App />)

      await fillForm(user, { id: '' })
      await user.click(submitButton())

      expect(screen.getByRole('alert')).toHaveTextContent('Enter a participant ID.')
      expect(submitMock).not.toHaveBeenCalled()
    })

    it('rejects a whitespace-only participant ID', async () => {
      const user = userEvent.setup()
      render(<App />)

      await fillForm(user, { id: '   ' })
      await user.click(submitButton())

      expect(screen.getByRole('alert')).toHaveTextContent('Enter a participant ID.')
      expect(submitMock).not.toHaveBeenCalled()
    })

    it('requires a withdrawal type', async () => {
      const user = userEvent.setup()
      render(<App />)

      await fillForm(user, { type: '' })
      await user.click(submitButton())

      expect(screen.getByRole('alert')).toHaveTextContent('Select a supported withdrawal type.')
      expect(submitMock).not.toHaveBeenCalled()
    })

    it.each(['', '0', '-5'])('rejects invalid amount %j', async (amount) => {
      const user = userEvent.setup()
      render(<App />)

      await fillForm(user, { amount })
      await user.click(submitButton())

      expect(screen.getByRole('alert')).toHaveTextContent('Enter an amount greater than zero.')
      expect(submitMock).not.toHaveBeenCalled()
    })

    it('clears a previous result when validation fails', async () => {
      submitMock.mockResolvedValue({ status: 'SUCCESS', message: 'Withdrawal submitted' })
      const user = userEvent.setup()
      render(<App />)

      await fillForm(user)
      await user.click(submitButton())
      await screen.findByText('Withdrawal submitted')

      await user.clear(screen.getByLabelText('Amount'))
      await user.click(submitButton())

      expect(screen.queryByText('Withdrawal submitted')).not.toBeInTheDocument()
      expect(screen.getByRole('alert')).toHaveTextContent('Enter an amount greater than zero.')
    })
  })

  describe('submission state', () => {
    it('disables the button and ignores double submits while pending', async () => {
      let resolve!: (v: { status: string; message: string }) => void
      submitMock.mockReturnValue(new Promise((r) => (resolve = r)))
      const user = userEvent.setup()
      render(<App />)

      await fillForm(user)
      await user.click(submitButton())

      expect(submitButton()).toBeDisabled()
      expect(submitButton()).toHaveTextContent('Submitting...')
      await user.click(submitButton())
      expect(submitMock).toHaveBeenCalledTimes(1)

      resolve({ status: 'SUCCESS', message: 'Withdrawal submitted' })
      expect(await screen.findByText('Withdrawal submitted')).toBeInTheDocument()
      expect(submitButton()).toBeEnabled()
    })

    it('allows resubmitting after a failure', async () => {
      submitMock.mockRejectedValueOnce(new Error('Failed to fetch'))
      submitMock.mockResolvedValueOnce({ status: 'SUCCESS', message: 'Withdrawal submitted' })
      const user = userEvent.setup()
      render(<App />)

      await fillForm(user)
      await user.click(submitButton())
      await screen.findByRole('alert')

      await user.click(submitButton())
      expect(await screen.findByText('Withdrawal submitted')).toBeInTheDocument()
      expect(submitMock).toHaveBeenCalledTimes(2)
    })
  })
})
