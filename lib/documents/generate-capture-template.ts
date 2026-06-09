import { jsPDF } from 'jspdf';
import type { CaptureStandardTemplate, CaptureTemplateFormat } from '@/lib/documents/capture-standard-templates';

export interface CaptureTemplateGenerateOptions {
  orgName?: string;
  format: CaptureTemplateFormat;
}

function csvEscape(v: string): string {
  return `"${v.replace(/"/g, '""')}"`;
}

function buildCsv(header: string[], rows: string[][]): string {
  const lines = [header.map(csvEscape).join(';'), ...rows.map((r) => r.map(csvEscape).join(';'))];
  return lines.join('\n');
}

function pdfHeader(doc: jsPDF, title: string, subtitle: string, orgName?: string) {
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('KonaData — Modèle de collecte', 14, 10);
  doc.setFontSize(9);
  doc.text(title, 14, 16);
  doc.setTextColor(40, 40, 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  let y = 30;
  if (orgName) {
    doc.text(`Organisation : ${orgName}`, 14, y);
    y += 6;
  }
  doc.text(subtitle, 14, y);
  y += 8;
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(
    'Optimisé manuscrit — remplir à la main, puis photographier ou scanner pour KonaAI Vision.',
    14,
    y
  );
  return y + 10;
}

function drawTable(
  doc: jsPDF,
  startY: number,
  columns: { label: string; width: number }[],
  rowCount: number,
  rowHeight = 8
): number {
  const margin = 14;
  const tableWidth = columns.reduce((s, c) => s + c.width, 0);
  let y = startY;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 30, 30);
  let x = margin;
  for (const col of columns) {
    doc.rect(x, y, col.width, rowHeight);
    doc.text(col.label, x + 2, y + 5.5, { maxWidth: col.width - 4 });
    x += col.width;
  }
  y += rowHeight;

  doc.setFont('helvetica', 'normal');
  for (let r = 0; r < rowCount; r++) {
    x = margin;
    for (const col of columns) {
      doc.rect(x, y, col.width, rowHeight);
      x += col.width;
    }
    y += rowHeight;
    if (y > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = 20;
    }
  }
  return y;
}

function fieldBlock(doc: jsPDF, y: number, label: string, lines = 2): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(label, 14, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  for (let i = 0; i < lines; i++) {
    doc.line(14, y, 196, y);
    y += 8;
  }
  return y + 4;
}

function generateGradeSheetPdf(orgName?: string): Uint8Array {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  let y = pdfHeader(
    doc,
    'Relevé de notes',
    'Classe : _______________   Trimestre : _______________   Année : _______________',
    orgName
  );
  drawTable(
    doc,
    y,
    [
      { label: 'N°', width: 12 },
      { label: 'Nom complet', width: 52 },
      { label: 'Code élève', width: 28 },
      { label: 'Maths', width: 22 },
      { label: 'Français', width: 22 },
      { label: 'Anglais', width: 22 },
      { label: 'SVT', width: 20 },
      { label: 'Hist-Géo', width: 22 },
      { label: 'Moy.', width: 20 },
    ],
    28
  );
  return new Uint8Array(doc.output('arraybuffer'));
}

function generateAttendancePdf(orgName?: string, title = 'Registre de présence'): Uint8Array {
  const doc = new jsPDF();
  let y = pdfHeader(
    doc,
    title,
    'Date : _______________   Classe / groupe : _______________',
    orgName
  );
  drawTable(
    doc,
    y,
    [
      { label: 'N°', width: 12 },
      { label: 'Nom complet', width: 70 },
      { label: 'Code / ID', width: 30 },
      { label: 'Présent', width: 22 },
      { label: 'Absent', width: 22 },
      { label: 'Remarque', width: 34 },
    ],
    30
  );
  return new Uint8Array(doc.output('arraybuffer'));
}

function generateClassListPdf(orgName?: string): Uint8Array {
  const doc = new jsPDF();
  let y = pdfHeader(
    doc,
    'Liste de classe',
    'Classe : _______________   Effectif : _______________',
    orgName
  );
  drawTable(
    doc,
    y,
    [
      { label: 'N°', width: 12 },
      { label: 'Nom complet', width: 75 },
      { label: 'Code élève', width: 35 },
      { label: 'Téléphone', width: 35 },
      { label: 'Email', width: 33 },
    ],
    35
  );
  return new Uint8Array(doc.output('arraybuffer'));
}

function generateFieldReportPdf(orgName?: string): Uint8Array {
  const doc = new jsPDF();
  let y = pdfHeader(doc, 'Rapport d’activité terrain', 'Projet : _______________', orgName);
  y = fieldBlock(doc, y, 'Date / Période', 1);
  y = fieldBlock(doc, y, 'Lieu / Zone d’intervention', 1);
  y = fieldBlock(doc, y, 'Nombre de participants', 1);
  y = fieldBlock(doc, y, 'Activités réalisées', 4);
  y = fieldBlock(doc, y, 'Résultats / Observations', 4);
  y = fieldBlock(doc, y, 'Difficultés rencontrées', 2);
  y = fieldBlock(doc, y, 'Recommandations', 2);
  return new Uint8Array(doc.output('arraybuffer'));
}

function generateBeneficiaryPdf(orgName?: string): Uint8Array {
  const doc = new jsPDF();
  let y = pdfHeader(doc, 'Fiche bénéficiaire', 'Projet : _______________', orgName);
  y = fieldBlock(doc, y, 'Nom complet', 1);
  y = fieldBlock(doc, y, 'Sexe / Âge', 1);
  y = fieldBlock(doc, y, 'Téléphone / Contact', 1);
  y = fieldBlock(doc, y, 'Localité', 1);
  y = fieldBlock(doc, y, 'Remarques', 3);
  return new Uint8Array(doc.output('arraybuffer'));
}

function generateDailySitePdf(orgName?: string): Uint8Array {
  const doc = new jsPDF();
  let y = pdfHeader(doc, 'Rapport journalier chantier', 'Chantier : _______________', orgName);
  y = fieldBlock(doc, y, 'Date', 1);
  y = fieldBlock(doc, y, 'Effectif présent', 1);
  y = fieldBlock(doc, y, 'Travaux réalisés', 4);
  y = fieldBlock(doc, y, 'Matériels / équipements', 2);
  y = fieldBlock(doc, y, 'Incidents / sécurité', 2);
  y = fieldBlock(doc, y, 'Observations chef de chantier', 3);
  return new Uint8Array(doc.output('arraybuffer'));
}

function generateFuelSheetPdf(orgName?: string): Uint8Array {
  const doc = new jsPDF();
  let y = pdfHeader(doc, 'Fiche carburant', 'Chantier : _______________', orgName);
  drawTable(
    doc,
    y,
    [
      { label: 'Date', width: 28 },
      { label: 'Engin / véhicule', width: 45 },
      { label: 'Litres', width: 25 },
      { label: 'Index', width: 28 },
      { label: 'Chauffeur', width: 40 },
      { label: 'Obs.', width: 24 },
    ],
    20
  );
  return new Uint8Array(doc.output('arraybuffer'));
}

function generateDeliveryNotePdf(orgName?: string): Uint8Array {
  const doc = new jsPDF();
  let y = pdfHeader(doc, 'Bon de livraison simplifié', 'Chantier : _______________', orgName);
  drawTable(
    doc,
    y,
    [
      { label: 'Date', width: 25 },
      { label: 'Fournisseur', width: 45 },
      { label: 'Matériau', width: 45 },
      { label: 'Qté', width: 22 },
      { label: 'Unité', width: 20 },
      { label: 'Reçu par', width: 33 },
    ],
    15
  );
  return new Uint8Array(doc.output('arraybuffer'));
}

function generateExpensePdf(orgName?: string): Uint8Array {
  const doc = new jsPDF();
  let y = pdfHeader(doc, 'Fiche dépense', 'Période : _______________', orgName);
  drawTable(
    doc,
    y,
    [
      { label: 'Date', width: 28 },
      { label: 'Libellé', width: 65 },
      { label: 'Montant GNF', width: 35 },
      { label: 'Mode paiement', width: 35 },
      { label: 'Justificatif', width: 27 },
    ],
    20
  );
  return new Uint8Array(doc.output('arraybuffer'));
}

function generatePurchaseOrderPdf(orgName?: string): Uint8Array {
  const doc = new jsPDF();
  let y = pdfHeader(doc, 'Bon de commande simplifié', 'Fournisseur : _______________', orgName);
  drawTable(
    doc,
    y,
    [
      { label: 'Réf.', width: 20 },
      { label: 'Désignation', width: 60 },
      { label: 'Qté', width: 22 },
      { label: 'P.U. GNF', width: 30 },
      { label: 'Total GNF', width: 30 },
      { label: 'Remarque', width: 28 },
    ],
    15
  );
  return new Uint8Array(doc.output('arraybuffer'));
}

function generateStockCountPdf(orgName?: string): Uint8Array {
  const doc = new jsPDF();
  let y = pdfHeader(doc, 'Inventaire stock', 'Dépôt / magasin : _______________', orgName);
  drawTable(
    doc,
    y,
    [
      { label: 'Réf.', width: 25 },
      { label: 'Désignation', width: 70 },
      { label: 'Qté comptée', width: 30 },
      { label: 'Unité', width: 25 },
      { label: 'Écart', width: 25 },
      { label: 'Obs.', width: 15 },
    ],
    25
  );
  return new Uint8Array(doc.output('arraybuffer'));
}

function emptyRows(cols: number, count: number): string[][] {
  return Array.from({ length: count }, () => Array(cols).fill(''));
}

function generateCsv(template: CaptureStandardTemplate): string {
  switch (template.kind) {
    case 'grade_sheet':
      return buildCsv(
        ['nom', 'code_eleve', 'maths', 'francais', 'anglais', 'svt', 'hist_geo', 'moyenne'],
        emptyRows(8, 30)
      );
    case 'attendance':
    case 'workshop_attendance':
      return buildCsv(
        ['nom', 'identifiant', 'present', 'absent', 'remarque'],
        emptyRows(5, 40)
      );
    case 'class_list':
      return buildCsv(['nom', 'code_eleve', 'telephone', 'email'], emptyRows(4, 40));
    case 'field_report':
      return buildCsv(
        ['date', 'lieu', 'participants', 'activites', 'resultats', 'difficultes', 'recommandations'],
        [['', '', '', '', '', '', '']]
      );
    case 'beneficiary_row':
      return buildCsv(['nom', 'sexe_age', 'telephone', 'localite', 'projet', 'remarques'], [['', '', '', '', '', '']]);
    case 'daily_site_report':
      return buildCsv(
        ['date', 'effectif', 'travaux', 'materiels', 'incidents', 'observations'],
        [['', '', '', '', '', '']]
      );
    case 'fuel_sheet':
      return buildCsv(['date', 'engin', 'litres', 'index', 'chauffeur', 'observation'], emptyRows(6, 25));
    case 'delivery_note':
      return buildCsv(['date', 'fournisseur', 'materiau', 'quantite', 'unite', 'recu_par'], emptyRows(6, 20));
    case 'expense_sheet':
      return buildCsv(['date', 'libelle', 'montant_gnf', 'mode_paiement', 'justificatif'], emptyRows(5, 25));
    case 'purchase_order':
      return buildCsv(['reference', 'designation', 'quantite', 'prix_unitaire_gnf', 'total_gnf', 'remarque'], emptyRows(6, 20));
    case 'stock_count':
      return buildCsv(['reference', 'designation', 'quantite_comptee', 'unite', 'ecart', 'observation'], emptyRows(6, 30));
    default:
      return buildCsv(['colonne_1', 'colonne_2', 'colonne_3'], emptyRows(3, 10));
  }
}

export function generateCaptureTemplateBytes(
  template: CaptureStandardTemplate,
  options: CaptureTemplateGenerateOptions
): { bytes: Uint8Array; mimeType: string; fileName: string } {
  const baseName = template.id.replace(/^konadata_/, 'konadata-');
  const orgSlug = options.orgName
    ? `-${options.orgName
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .slice(0, 24)
        .toLowerCase()}`
    : '';

  if (options.format === 'csv') {
    const csv = '\uFEFF' + generateCsv(template);
    const enc = new TextEncoder();
    return {
      bytes: enc.encode(csv),
      mimeType: 'text/csv;charset=utf-8',
      fileName: `${baseName}${orgSlug}.csv`,
    };
  }

  let pdf: Uint8Array;
  switch (template.kind) {
    case 'grade_sheet':
      pdf = generateGradeSheetPdf(options.orgName);
      break;
    case 'attendance':
      pdf = generateAttendancePdf(options.orgName);
      break;
    case 'class_list':
      pdf = generateClassListPdf(options.orgName);
      break;
    case 'field_report':
      pdf = generateFieldReportPdf(options.orgName);
      break;
    case 'workshop_attendance':
      pdf = generateAttendancePdf(options.orgName, 'Liste de présence atelier');
      break;
    case 'beneficiary_row':
      pdf = generateBeneficiaryPdf(options.orgName);
      break;
    case 'daily_site_report':
      pdf = generateDailySitePdf(options.orgName);
      break;
    case 'fuel_sheet':
      pdf = generateFuelSheetPdf(options.orgName);
      break;
    case 'delivery_note':
      pdf = generateDeliveryNotePdf(options.orgName);
      break;
    case 'expense_sheet':
      pdf = generateExpensePdf(options.orgName);
      break;
    case 'purchase_order':
      pdf = generatePurchaseOrderPdf(options.orgName);
      break;
    case 'stock_count':
      pdf = generateStockCountPdf(options.orgName);
      break;
    default:
      pdf = generateClassListPdf(options.orgName);
  }

  return {
    bytes: pdf,
    mimeType: 'application/pdf',
    fileName: `${baseName}${orgSlug}.pdf`,
  };
}
