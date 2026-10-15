import { buildApp } from "./app.js";

const port = Number(process.env.PORT ?? 8787);
const app = buildApp();
app.listen({ port, host: "0.0.0.0" }).then(() => console.log(`Serveur Projet Phare sur http://localhost:${port}`));
