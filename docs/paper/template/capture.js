// Runs the paper builder against a stand-in for the docx library and dumps the content as JSON.
const Module = require('module');
const fs = require('fs');
const rec = (type) => class { constructor(o) { this.type = type; this.o = o; } };
const fake = {
  Document: rec('Document'), Paragraph: rec('Paragraph'), TextRun: rec('TextRun'), ImageRun: rec('ImageRun'),
  Table: rec('Table'), TableRow: rec('TableRow'), TableCell: rec('TableCell'),
  AlignmentType: { CENTER: 'center', BOTH: 'both', LEFT: 'left' }, SectionType: { CONTINUOUS: 'c' },
  WidthType: { DXA: 'dxa' }, BorderStyle: { SINGLE: 's', NONE: 'n' }, ShadingType: {}, VerticalAlign: { CENTER: 'c' },
  LevelFormat: { BULLET: 'b', DECIMAL: 'd' }, HighlightColor: { YELLOW: 'y' }, TabStopType: { CENTER: 'c', RIGHT: 'r', LEFT: 'l' },
  Packer: { toBuffer: (doc) => Promise.resolve(Buffer.from(JSON.stringify(doc, (k, v) => (k === 'data' ? undefined : v)))) },
};
const load = Module._load;
Module._load = function (req, ...a) { return req === 'docx' ? fake : load.call(this, req, ...a); };
process.argv = [process.argv[0], process.argv[2], process.argv[3], process.argv[4]];
require(process.argv[1]);
