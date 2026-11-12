/* global document */
import { paintStudyCart } from '/__study/paint.js';
import { studyCartDesign } from '/js/forest-construction-design.js';

// Pixel checks at the reported shallow upward headings, plus a sheet for reviewing
// natural occlusion by near rails and roofs around an entire rotation.
export function checkCartRendering() {
  const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 240;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  let checks = 0;
  for (const length of [36, 44, 52]) for (const width of [24, 30, 36]) {
    for (const degrees of [345, 350, 355]) {
      const heading = degrees * Math.PI / 180;
      const design = { ...studyCartDesign('compact'), length, width };
      ctx.clearRect(0, 0, 240, 240);
      paintStudyCart(ctx, { design, worldX: 120, worldY: 150, heading }, { x: 0, y: 0 }, true);
      const seatX = Math.round(120 + Math.cos(heading) * (length / 2 - 4));
      const seatY = Math.round(150 + Math.sin(heading) * (length / 2 - 4) - 27);
      const pixel = [...ctx.getImageData(seatX + 1, seatY - 5, 1, 1).data];
      if (pixel.join(',') !== '57,116,155,255') {
        throw new Error(`Rider shirt obscured at ${degrees} degrees, ${length}x${width}: ${pixel}`);
      }
      checks++;
    }
  }
  const angles = [0, 15, 45, 90, 135, 170, 180, 190, 225, 270, 315, 345];
  const designs = [studyCartDesign('compact'), { ...studyCartDesign('canopy'), canopy: 'none' },
    { ...studyCartDesign('canopy'), supports: 'posts', cloth: 'ochre' }, studyCartDesign('canopy')];
  const sheet = document.createElement('canvas'); sheet.width = 1200; sheet.height = 1280;
  const output = sheet.getContext('2d'); output.fillStyle = '#687453'; output.fillRect(0, 0, sheet.width, sheet.height);
  designs.forEach((design, row) => angles.forEach((degrees, i) => {
    const x = i % 6 * 200, y = (row * 2 + Math.floor(i / 6)) * 160;
    output.fillStyle = '#f4e5c5'; output.font = '12px sans-serif';
    output.fillText(`${row + 1}: ${degrees}°`, x + 8, y + 16);
    paintStudyCart(output, { design, worldX: x + 100, worldY: y + 110, heading: degrees * Math.PI / 180 },
      { x: 0, y: 0 }, true, 0, { wheel: .4, gait: 0 });
  }));
  return { checks, image: sheet.toDataURL('image/png').split(',')[1] };
}
