import { all } from "@/lib/db";

export default function DebugSchemaPage() {
  const tables = all(
    `SELECT name
     FROM sqlite_master
     WHERE type = 'table'
       AND name NOT LIKE 'sqlite_%'
     ORDER BY name`,
  );

  return (
    <main className="card">
      <h2>Debug Schema</h2>
      <p className="muted-text">Developer-only view of table/column metadata in shop.db.</p>
      {tables.map((table) => {
        const columns = all(`PRAGMA table_info(${table.name})`);
        return (
          <section key={table.name} className="card">
            <h3>{table.name}</h3>
            <table>
              <thead>
                <tr>
                  <th>Column</th>
                  <th>Type</th>
                  <th>Not Null</th>
                  <th>Primary Key</th>
                </tr>
              </thead>
              <tbody>
                {columns.map((col) => (
                  <tr key={col.name}>
                    <td>{col.name}</td>
                    <td>{col.type}</td>
                    <td>{col.notnull ? "YES" : "NO"}</td>
                    <td>{col.pk ? "YES" : "NO"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
    </main>
  );
}
