// Runs as the container healthcheck. Initiates replica set "rs0" on first run, then reports
// healthy only once this node is the writable primary. Safe to run any number of times.
// The member host is localhost:27017 because the API and tests run on the host machine.
try {
  const status = rs.status();
  if (!status.members.some((m) => m.stateStr === 'PRIMARY')) quit(1);
} catch (e) {
  if (e.codeName === 'NotYetInitialized') {
    rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: 'localhost:27017' }] });
  }
  quit(1);
}
