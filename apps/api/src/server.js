/**
 * Einstiegspunkt für den HTTP-Server.
 *
 * Verantwortung:
 * - Lädt Runtime-Konfiguration (Port)
 * - Startet die Express-App durch Binden an einen TCP-Port
 *
 * Nicht-Verantwortung:
 * - Keine Routen/Middleware definieren (siehe app.js)
 */
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 4000);
const app = createApp();

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
