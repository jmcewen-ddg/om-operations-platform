import { useState } from 'react'
import { type OmRequest } from '../services/requestService'

type RequestListProps = {
  selectedRequestObjectId: number | null
  onSelectedRequestChange: (objectId: number | null) => void
}

function RequestList({
  selectedRequestObjectId,
  onSelectedRequestChange,
}: RequestListProps) {
  const [requests] = useState<OmRequest[]>([])
  const [loading] = useState(false)
  const [errorMessage] = useState<string | null>(null)

  const handleRequestClick = (objectId: number) => {
    if (selectedRequestObjectId === objectId) {
      onSelectedRequestChange(null)
    } else {
      onSelectedRequestChange(objectId)
    }
  }

  return (
      <div>
      <div style={{ background: 'yellow', padding: 4 }}>RequestList is mounted ✅</div>

      {loading && <p>Loading requests...</p>}

      {errorMessage && (
        <p style={{ color: 'red' }}>{errorMessage}</p>
      )}

      {!loading && requests.length === 0 && (
        <p>No unassigned requests found.</p>
      )}

      {!loading && !errorMessage && requests.length > 0 && (
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={headerStyle}>Select</th>
              <th style={headerStyle}>Request ID</th>
              <th style={headerStyle}>District</th>
              <th style={headerStyle}>Urgency</th>
              <th style={headerStyle}>Status</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr
                key={request.objectId}
                style={{
                  backgroundColor:
                    selectedRequestObjectId === request.objectId
                      ? '#e6f2ff'
                      : 'transparent',
                }}
              >
                <td style={cellStyle}>
                  <input
                    type="checkbox"
                    checked={selectedRequestObjectId === request.objectId}
                    onChange={() => handleRequestClick(request.objectId)}
                  />
                </td>
                <td style={cellStyle}>{request.requestId ?? 'N/A'}</td>
                <td style={cellStyle}>{request.district ?? 'N/A'}</td>
                <td style={cellStyle}>{request.urgency ?? 'N/A'}</td>
                <td style={cellStyle}>{request.status ?? 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

const headerStyle = {
  borderBottom: '2px solid #333',
  textAlign: 'left' as const,
  padding: '8px',
}

const cellStyle = {
  borderBottom: '1px solid #ddd',
  padding: '8px',
}

export default RequestList