import { useEffect, useState } from 'react'
import { getWorkOrders, type OmWorkOrder } from '../services/workOrderService'
import { signInToArcGIS } from '../services/arcgisAuth'

type WorkOrderListProps = {
  selectedWorkOrderObjectId: number | null
  onSelectedWorkOrderChange: (objectId: number | null) => void
}

function WorkOrderList({
  selectedWorkOrderObjectId,
  onSelectedWorkOrderChange,
}: WorkOrderListProps) {
  const [workOrders, setWorkOrders] = useState<OmWorkOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadWorkOrders() {
      try {
        await signInToArcGIS()

        const data = await getWorkOrders()
        setWorkOrders(data)
      } catch (err) {
        console.error(err)
        setError('Failed to load work orders from ArcGIS.')
      } finally {
        setLoading(false)
      }
    }

    loadWorkOrders()
  }, [])

  if (loading) {
    return (
      <section>
        <h2>Work Orders</h2>
        <p>Loading work orders...</p>
      </section>
    )
  }

  if (error) {
    return (
      <section>
        <h2>Work Orders</h2>
        <p style={{ color: 'red' }}>{error}</p>
      </section>
    )
  }

  return (
    <section style={{ marginTop: '32px' }}>
      <h2>Work Orders</h2>

      <p>
        Selected work order:{' '}
        <strong>
          {selectedWorkOrderObjectId === null
            ? 'None'
            : selectedWorkOrderObjectId}
        </strong>
      </p>

      {workOrders.length === 0 ? (
        <p>No work orders found.</p>
      ) : (
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginTop: '12px',
          }}
        >
          <thead>
            <tr>
              <th style={headerStyle}>Select</th>
              <th style={headerStyle}>Work Order ID</th>
              <th style={headerStyle}>District</th>
              <th style={headerStyle}>Priority</th>
              <th style={headerStyle}>Status</th>
              <th style={headerStyle}>Title</th>
            </tr>
          </thead>

          <tbody>
            {workOrders.map((workOrder) => (
              <tr key={workOrder.objectId}>
                <td style={cellStyle}>
                  <input
                    type="radio"
                    name="selectedWorkOrder"
                    checked={selectedWorkOrderObjectId === workOrder.objectId}
                    onClick={() => {
                      const nextSelectedId =
                        selectedWorkOrderObjectId === workOrder.objectId
                          ? null
                          : workOrder.objectId

                      onSelectedWorkOrderChange(nextSelectedId)
                    }}
                    onChange={() => {}}
                  />
                </td>
                <td style={cellStyle}>{workOrder.workOrderId ?? 'N/A'}</td>
                <td style={cellStyle}>{workOrder.district ?? 'N/A'}</td>
                <td style={cellStyle}>{workOrder.priority ?? 'N/A'}</td>
                <td style={cellStyle}>{workOrder.workOrderStatus ?? 'N/A'}</td>
                <td style={cellStyle}>{workOrder.workOrderTitle ?? 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
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

export default WorkOrderList