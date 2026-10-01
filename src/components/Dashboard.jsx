import React from 'react'

function StatCard({ title, value }) {
  return (
    <div className="stat-card panel shadow p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-muted">{title}</div>
          <div className="text-2xl font-bold mt-2">{value}</div>
        </div>
        <div className="text-sm text-muted">+8%</div>
      </div>
      <div className="mt-3 h-10 bg-gradient-to-r from-gray-100 to-gray-50 rounded-md dark:from-gray-800 dark:to-gray-900" />
    </div>
  )
}

export default function Dashboard() {
  return (
    <main className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard title="Total revenue" value="$2.6M" />
        <StatCard title="Average order value" value="$455" />
        <StatCard title="Tickets sold" value="5,888" />
      </div>

      <section className="panel rounded-md p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Sales Tables</h2>
          <div className="text-sm text-muted">Filters · Search</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="p-3">Name</th>
                <th className="p-3">Company</th>
                <th className="p-3">Phone</th>
                <th className="p-3">Joining Date</th>
              </tr>
            </thead>
            <tbody>
              {new Array(8).fill(0).map((_, i) => (
                <tr key={i} className={`border-t ${i % 2 === 0 ? 'bg-transparent' : ''}`}>
                  <td className="p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700" />
                    <div>User {i + 1}</div>
                  </td>
                  <td className="p-3">Company {i + 1}</td>
                  <td className="p-3">+1 555 01{i}</td>
                  <td className="p-3">8 March 2019</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
