// Génère un classeur Excel interactif : marge mensuelle KonaData pour une école.
// Les cellules bleues sont des hypothèses modifiables ; tout le reste est calculé
// par formules et se recalcule automatiquement dans Excel / LibreOffice / Google Sheets.
//
// Usage : node scripts/generate-konadata-margin-xlsx.mjs

import ExcelJS from 'exceljs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const GNF = '#,##0" GNF"';
const PCT = '0.0%';

const wb = new ExcelJS.Workbook();
wb.creator = 'KonaData';
wb.created = new Date();

const ws = wb.addWorksheet('Modèle', {
  views: [{ showGridLines: false }],
});

ws.columns = [
  { width: 3 },
  { width: 34 },
  { width: 20 },
  { width: 14 },
  { width: 40 },
];

// ── Styles ────────────────────────────────────────────────
const NAVY = 'FF0A192F';
const BLUE = 'FF2563EB';
const INPUT_FILL = 'FFEAF1FF';
const HEAD_FILL = 'FFF1F5F9';
const GREEN = 'FF059669';

const title = (cell, text) => {
  cell.value = text;
  cell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
};
const label = (row, text) => {
  const c = ws.getCell(`B${row}`);
  c.value = text;
  c.font = { size: 11 };
  c.alignment = { vertical: 'middle' };
};
const inputCell = (row, value, fmt) => {
  const c = ws.getCell(`C${row}`);
  c.value = value;
  if (fmt) c.numFmt = fmt;
  c.font = { bold: true };
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INPUT_FILL } };
  c.border = {
    top: { style: 'thin', color: { argb: 'FFBFDBFE' } },
    left: { style: 'thin', color: { argb: 'FFBFDBFE' } },
    bottom: { style: 'thin', color: { argb: 'FFBFDBFE' } },
    right: { style: 'thin', color: { argb: 'FFBFDBFE' } },
  };
  c.alignment = { horizontal: 'right' };
  return c;
};
const formula = (addr, f, fmt, opts = {}) => {
  const c = ws.getCell(addr);
  c.value = { formula: f };
  if (fmt) c.numFmt = fmt;
  if (opts.bold) c.font = { bold: true };
  if (opts.color) c.font = { ...(c.font || {}), color: { argb: opts.color } };
  c.alignment = { horizontal: 'right' };
  return c;
};

// ── Titre ─────────────────────────────────────────────────
ws.mergeCells('B1:E1');
ws.getRow(1).height = 26;
const t = ws.getCell('B1');
title(t, 'KonaData — Marge mensuelle : école de 1 000 élèves');
for (const col of ['B', 'C', 'D', 'E']) {
  ws.getCell(`${col}1`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
}
ws.mergeCells('B2:E2');
ws.getCell('B2').value =
  "Modifiez les cellules bleues (hypothèses). Les montants et la marge se recalculent automatiquement.";
ws.getCell('B2').font = { italic: true, size: 10, color: { argb: 'FF64748B' } };

// ── Paramètres ────────────────────────────────────────────
ws.getCell('B4').value = 'PARAMÈTRES';
ws.getCell('B4').font = { bold: true, size: 11, color: { argb: BLUE } };

label(5, 'Revenu abonnement (GNF/mois)');
inputCell(5, 1500000, GNF); // C5
label(6, "Nombre d'élèves");
inputCell(6, 1000, '#,##0'); // C6
label(7, 'Messages / élève / mois');
inputCell(7, 5, '#,##0'); // C7
label(8, 'Part WhatsApp (%)');
inputCell(8, 1, PCT); // C8 (fraction) — politique 100 % WhatsApp
label(9, 'Coût WhatsApp (GNF/msg)');
inputCell(9, 50, GNF); // C9
label(10, 'Coût SMS (GNF/msg)');
inputCell(10, 150, GNF); // C10
label(11, 'Infrastructure (GNF/mois)');
inputCell(11, 150000, GNF); // C11
label(12, 'IA / rapports (GNF/mois)');
inputCell(12, 100000, GNF); // C12
label(13, 'Assistance (GNF/mois)');
inputCell(13, 200000, GNF); // C13
label(14, 'Frais de paiement (%)');
inputCell(14, 0.015, PCT); // C14 (fraction)

// ── Détail des charges ────────────────────────────────────
ws.getCell('B16').value = 'DÉTAIL DES CHARGES';
ws.getCell('B16').font = { bold: true, size: 11, color: { argb: BLUE } };

const headRow = 17;
['B', 'C', 'D', 'E'].forEach((col) => {
  const c = ws.getCell(`${col}${headRow}`);
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEAD_FILL } };
  c.font = { bold: true, size: 10 };
  c.border = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
});
ws.getCell(`B${headRow}`).value = 'Poste';
ws.getCell(`C${headRow}`).value = 'Montant / mois';
ws.getCell(`D${headRow}`).value = '% du revenu';
ws.getCell(`E${headRow}`).value = 'Détail';
ws.getCell(`C${headRow}`).alignment = { horizontal: 'right' };
ws.getCell(`D${headRow}`).alignment = { horizontal: 'right' };

// Ligne 18 : WhatsApp
label(18, 'Messagerie WhatsApp');
formula('C18', 'C6*C7*C8*C9', GNF);
formula('D18', 'C18/C$5', PCT);
ws.getCell('E18').value = { formula: 'ROUND(C6*C7*C8,0)&" msg × "&TEXT(C9,"#,##0")&" GNF"' };
ws.getCell('E18').font = { size: 9, color: { argb: 'FF64748B' } };

// Ligne 19 : SMS
label(19, 'Messagerie SMS');
formula('C19', 'C6*C7*(1-C8)*C10', GNF);
formula('D19', 'C19/C$5', PCT);
ws.getCell('E19').value = { formula: 'ROUND(C6*C7*(1-C8),0)&" SMS × "&TEXT(C10,"#,##0")&" GNF"' };
ws.getCell('E19').font = { size: 9, color: { argb: 'FF64748B' } };

// Ligne 20-23 : autres
label(20, 'Infrastructure');
formula('C20', 'C11', GNF);
formula('D20', 'C20/C$5', PCT);
ws.getCell('E20').value = 'Supabase, hébergement, stockage (quote-part)';
ws.getCell('E20').font = { size: 9, color: { argb: 'FF64748B' } };

label(21, 'IA (rapports)');
formula('C21', 'C12', GNF);
formula('D21', 'C21/C$5', PCT);
ws.getCell('E21').value = 'Génération de rapports / assistant (quote-part)';
ws.getCell('E21').font = { size: 9, color: { argb: 'FF64748B' } };

label(22, 'Assistance');
formula('C22', 'C13', GNF);
formula('D22', 'C22/C$5', PCT);
ws.getCell('E22').value = 'Support & accompagnement (quote-part)';
ws.getCell('E22').font = { size: 9, color: { argb: 'FF64748B' } };

label(23, 'Frais de paiement');
formula('C23', 'C5*C14', GNF);
formula('D23', 'C23/C$5', PCT);
ws.getCell('E23').value = { formula: `"Orange Money "&TEXT(C14,"0.0%")&" sur l'encaissement"` };
ws.getCell('E23').font = { size: 9, color: { argb: 'FF64748B' } };

// Charges totales
label(24, 'Charges totales');
ws.getCell('B24').font = { bold: true, size: 11 };
formula('C24', 'SUM(C18:C23)', GNF, { bold: true });
formula('D24', 'C24/C$5', PCT, { bold: true });
['B', 'C', 'D', 'E'].forEach((col) => {
  ws.getCell(`${col}24`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEAD_FILL } };
  ws.getCell(`${col}24`).border = { top: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
});

// ── Résultat ──────────────────────────────────────────────
label(26, 'Revenu abonnement');
formula('C26', 'C5', GNF);
formula('D26', '1', PCT);

label(27, 'RÉSULTAT NET KONADATA');
ws.getCell('B27').font = { bold: true, size: 12 };
formula('C27', 'C5-C24', GNF, { bold: true, color: GREEN });
ws.getCell('C27').font = { bold: true, size: 12, color: { argb: GREEN } };
formula('D27', 'C27/C$5', PCT, { bold: true, color: GREEN });
ws.getCell('D27').font = { bold: true, size: 12, color: { argb: GREEN } };

label(28, 'Marge nette');
formula('C28', 'C27/C5', PCT, { bold: true });

// ── Volume ────────────────────────────────────────────────
ws.getCell('B30').value = 'VOLUME DE MESSAGES';
ws.getCell('B30').font = { bold: true, size: 11, color: { argb: BLUE } };
label(31, 'Total messages / mois');
formula('C31', 'C6*C7', '#,##0');
label(32, 'dont WhatsApp');
formula('C32', 'ROUND(C6*C7*C8,0)', '#,##0');
label(33, 'dont SMS');
formula('C33', 'ROUND(C6*C7*(1-C8),0)', '#,##0');

// ── Scénarios ─────────────────────────────────────────────
ws.getCell('B35').value = 'SCÉNARIOS (mix de canaux)';
ws.getCell('B35').font = { bold: true, size: 11, color: { argb: BLUE } };

const sRow = 36;
['B', 'C', 'D', 'E'].forEach((col) => {
  const c = ws.getCell(`${col}${sRow}`);
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEAD_FILL } };
  c.font = { bold: true, size: 10 };
});
ws.getCell(`B${sRow}`).value = 'Scénario';
ws.getCell(`C${sRow}`).value = 'Messagerie';
ws.getCell(`D${sRow}`).value = 'Résultat net';
ws.getCell(`E${sRow}`).value = 'Marge';
ws.getCell(`C${sRow}`).alignment = { horizontal: 'right' };
ws.getCell(`D${sRow}`).alignment = { horizontal: 'right' };
ws.getCell(`E${sRow}`).alignment = { horizontal: 'right' };

// 100% WhatsApp
ws.getCell('B37').value = '100 % WhatsApp';
formula('C37', 'C6*C7*C9', GNF);
formula('D37', 'C5-(C37+C11+C12+C13+C5*C14)', GNF);
formula('E37', '(C5-(C37+C11+C12+C13+C5*C14))/C5', PCT);

// Mix actuel
ws.getCell('B38').value = 'Mix actuel (paramètres ci-dessus)';
formula('C38', 'C18+C19', GNF);
formula('D38', 'C27', GNF, { bold: true });
formula('E38', 'C28', PCT, { bold: true });

// 100% SMS
ws.getCell('B39').value = '100 % SMS';
formula('C39', 'C6*C7*C10', GNF);
formula('D39', 'C5-(C39+C11+C12+C13+C5*C14)', GNF);
formula('E39', '(C5-(C39+C11+C12+C13+C5*C14))/C5', PCT);

// ── Notes / sources ───────────────────────────────────────
ws.mergeCells('B41:E41');
ws.getCell('B41').value =
  "Sources : SMS API Orange Guinée ≈ 150 GNF/SMS ; WhatsApp Business (Meta) facturé au message modèle, messages de service et modèles utilitaires gratuits dans la fenêtre de conversation.";
ws.getCell('B41').font = { size: 9, italic: true, color: { argb: 'FF64748B' } };
ws.getCell('B41').alignment = { wrapText: true };
ws.getRow(41).height = 28;

ws.mergeCells('B42:E42');
ws.getCell('B42').value =
  "Note : 1 500 000 GNF = tarif d'entrée de gamme. Une école de 1 000 élèves peut justifier un palier supérieur (composante par élève), augmentant la marge. Infra/IA/assistance sont des quote-parts mutualisées.";
ws.getCell('B42').font = { size: 9, italic: true, color: { argb: 'FF64748B' } };
ws.getCell('B42').alignment = { wrapText: true };
ws.getRow(42).height = 28;

// ── Écriture ──────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fileName = process.argv[2]?.trim() || 'KonaData-marge-ecole-1000.xlsx';
const out = path.join(__dirname, '..', 'exports', fileName);
await wb.xlsx.writeFile(out);
console.log('Fichier généré :', out);
