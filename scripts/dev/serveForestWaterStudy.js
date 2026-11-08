// Local-only, database-free review surface. No production route is installed.
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const app = express();
app.get('/', (req, res) => res.sendFile(path.join(root, 'scripts/dev/forestWaterStudy.html')));
app.use('/study', express.static(path.join(root, 'scripts/dev')));
app.use('/js', express.static(path.join(root, 'public/js')));
// Geometry's repository-relative import resolves here in the standalone browser surface.
app.use('/public/js', express.static(path.join(root, 'public/js')));
const port = Number(process.env.FOREST_WATER_STUDY_PORT || 4178);
if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid study port.');
app.listen(port, '127.0.0.1', error => {
  if (error) throw error;
  console.log(`Water study: http://127.0.0.1:${port} (preview only)`);
});
