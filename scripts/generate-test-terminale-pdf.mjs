/**
 * Génère liste-eleves-terminale.pdf pour test import KonaData (couche texte).
 * Usage: node scripts/generate-test-terminale-pdf.mjs
 */
import { jsPDF } from 'jspdf';
import { writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'docs', 'exemples-test', 'liste-eleves-terminale-v2.pdf');

const ROWS = [
  ['Diallo Aminata', 'TER-26-001', '622100101', 'Mamadou Diallo', '622200101', 'oui'],
  ['Camara Ibrahim', 'TER-26-002', '622100102', 'Fatou Camara', '622200102', 'oui'],
  ['Bah Fatoumata', 'TER-26-003', '622100103', 'Ibrahima Bah', '622200103', 'oui'],
  ['Soumah Mohamed', 'TER-26-004', '622100104', 'Aissatou Soumah', '622200104', 'oui'],
  ['Kourouma Mariama', 'TER-26-005', '622100105', 'Alpha Kourouma', '622200105', 'oui'],
  ['Condé Oumar', 'TER-26-006', '622100106', 'Mariam Condé', '622200106', 'non'],
  ['Sylla Aissatou', 'TER-26-007', '622100107', 'Thierno Sylla', '622200107', 'oui'],
  ['Touré Mamadou', 'TER-26-008', '622100108', 'Hawa Touré', '622200108', 'oui'],
  ['Keita Ousmane', 'TER-26-009', '622100109', 'Dr. Alpha Keita', '622200109', 'oui'],
  ['Bangoura Kadiatou', 'TER-26-010', '622100110', 'Sekou Bangoura', '622200110', 'oui'],
];

const HEADERS = ['nom', 'matricule', 'telephone', 'tuteur', 'telephone_tuteur', 'consentement_sms'];

const doc = new jsPDF({ unit: 'mm', format: 'a4' });

doc.setFillColor(37, 99, 235);
doc.rect(0, 0, 210, 28, 'F');
doc.setTextColor(255, 255, 255);
doc.setFont('helvetica', 'bold');
doc.setFontSize(14);
doc.text('LISTE DES ÉLÈVES — CLASSE TERMINALE A', 105, 12, { align: 'center' });
doc.setFontSize(9);
doc.text('Année scolaire 2025-2026 · Établissement pilote KonaData', 105, 20, { align: 'center' });
doc.text('Effectif : 10 élèves inscrits', 105, 26, { align: 'center' });

doc.setTextColor(30, 41, 59);
let y = 38;
doc.setFontSize(8);
doc.setFont('helvetica', 'bold');

const colX = [14, 52, 78, 98, 138, 172];
const colW = [36, 24, 18, 38, 32, 22];

HEADERS.forEach((h, i) => {
  doc.text(h, colX[i], y);
});
y += 3;
doc.setDrawColor(200, 200, 200);
doc.line(14, y, 196, y);
y += 5;

doc.setFont('helvetica', 'normal');
doc.setFontSize(7.5);

for (const row of ROWS) {
  if (y > 275) {
    doc.addPage();
    y = 20;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    HEADERS.forEach((h, i) => doc.text(h, colX[i], y));
    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
  }
  row.forEach((cell, i) => {
    const text = doc.splitTextToSize(cell, colW[i]);
    doc.text(text, colX[i], y);
  });
  y += 6;
}

const buf = Buffer.from(doc.output('arraybuffer'));
writeFileSync(OUT, buf);
console.log('OK →', OUT);
