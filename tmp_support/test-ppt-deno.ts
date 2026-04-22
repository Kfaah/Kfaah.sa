import PptxGenJS from 'npm:pptxgenjs@4.0.1';
const ppt = new PptxGenJS();
ppt.layout = 'LAYOUT_WIDE';
ppt.addSlide().addText('مرحبا', { x: 1, y: 1, w: 4, h: 1, rtlMode: true });
const out = await ppt.write({ outputType: 'uint8array' });
console.log(out instanceof Uint8Array, (out as Uint8Array).length);
