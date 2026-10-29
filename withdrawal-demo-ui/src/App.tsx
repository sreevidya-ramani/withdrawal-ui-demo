import { useRef, useState, type FormEvent } from 'react'
import {
  submitWithdrawal,
  WithdrawalApiError,
  type WithdrawalResponse,
  type WithdrawalType,
} from './api/withdrawals'
import './App.css'

function App() {
  const [participantId, setParticipantId] = useState('')
  const [withdrawalType, setWithdrawalType] = useState<WithdrawalType | ''>('')
  const [amount, setAmount] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<WithdrawalResponse | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const submissionInProgress = useRef(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (submissionInProgress.current) return

    const trimmedParticipantId = participantId.trim()
    const numericAmount = Number(amount)

    if (!trimmedParticipantId) {
      setErrorMessage('Enter a participant ID.')
      setResult(null)
      return
    }

    if (withdrawalType !== 'PARTIAL' && withdrawalType !== 'FULL') {
      setErrorMessage('Select a supported withdrawal type.')
      setResult(null)
      return
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setErrorMessage('Enter an amount greater than zero.')
      setResult(null)
      return
    }

    submissionInProgress.current = true
    setIsSubmitting(true)
    setErrorMessage('')
    setResult(null)

    try {
      const response = await submitWithdrawal({
        participantId: trimmedParticipantId,
        withdrawalType,
        amount: numericAmount,
      })
      setResult(response)
      if (response.status.toLowerCase() !== 'success') {
        setErrorMessage('The withdrawal service did not indicate success.')
      }
    } catch (error) {
      if (error instanceof WithdrawalApiError) {
        setResult(error.response)
        setErrorMessage('The withdrawal service did not accept the request.')
      } else {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'A network error prevented the request from completing.',
        )
      }
    } finally {
      submissionInProgress.current = false
      setIsSubmitting(false)
    }
  }

  const responseIndicatesSuccess =
    !errorMessage && result?.status.toLowerCase() === 'success'

  return (
    <main className="portal-shell">
      <header className="portal-header">
        <div className="brand-mark" aria-hidden="true">W</div>
        <span className="brand-name">Participant services</span>
      </header>

      <section className="portal-content" aria-labelledby="page-title">
        <div className="page-intro">
          <p className="eyebrow">Account services</p>
          <h1 id="page-title">Withdrawal Portal</h1>
          <p className="intro-copy">Submit a request to withdraw funds from your account.</p>
        </div>

        <div className="request-layout">
          <form className="withdrawal-form" onSubmit={handleSubmit} noValidate>
            <div className="form-heading">
              <h2>Request details</h2>
              <p>Complete each field to submit your withdrawal.</p>
            </div>

            <div className="field-group">
              <label htmlFor="participant-id">Participant ID</label>
              <input
                id="participant-id"
                name="participantId"
                type="text"
                autoComplete="off"
                value={participantId}
                onChange={(event) => setParticipantId(event.target.value)}
                placeholder="Enter participant ID"
                required
                aria-invalid={Boolean(errorMessage && !participantId.trim())}
              />
            </div>

            <div className="field-group">
              <label htmlFor="withdrawal-type">Withdrawal Type</label>
              <select
                id="withdrawal-type"
                name="withdrawalType"
                value={withdrawalType}
                onChange={(event) => setWithdrawalType(event.target.value as WithdrawalType | '')}
                required
              >
                <option value="" disabled>Select a withdrawal type</option>
                <option value="PARTIAL">PARTIAL</option>
                <option value="FULL">FULL</option>
              </select>
            </div>

            <div className="field-group">
              <label htmlFor="amount">Amount</label>
              <div className="amount-input">
                <span aria-hidden="true">$</span>
                <input
                  id="amount"
                  name="amount"
                  type="number"
                  min="0.01"
                  step="any"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            {errorMessage && !result && (
              <p className="validation-error" role="alert">{errorMessage}</p>
            )}

            <button className="submit-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  Submitting...
                </>
              ) : 'Submit Withdrawal'}
            </button>
          </form>

          <section
            className={`result-panel${errorMessage ? ' has-error' : ''}${responseIndicatesSuccess ? ' is-success' : ''}`}
            aria-labelledby="result-heading"
            aria-live="polite"
          >
            <div className="result-heading-row">
              <h2 id="result-heading">Request result</h2>
              <span className="result-indicator" aria-hidden="true" />
            </div>
            {isSubmitting ? (
              <p className="result-placeholder">Sending your request to the withdrawal service...</p>
            ) : result ? (
              <dl className="response-details">
                <div>
                  <dt>Status</dt>
                  <dd>{result.status}</dd>
                </div>
                <div>
                  <dt>Message</dt>
                  <dd>{result.message}</dd>
                </div>
              </dl>
            ) : errorMessage ? (
              <p className="result-error">{errorMessage}</p>
            ) : (
              <p className="result-placeholder">The service response will appear here after submission.</p>
            )}
          </section>
        </div>
      </section>

      <footer className="portal-footer">Secure participant account services</footer>
    </main>
  )
}

export default App
