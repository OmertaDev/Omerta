// Deliberately no game imports or database connection. Used only for the staged
// casino-accounting cutover so the old writer can retire before new writers start.
console.log('OMERTA maintenance worker: idle; no database writers started.');
const idle = setInterval(() => {}, 60_000);
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => clearInterval(idle));
