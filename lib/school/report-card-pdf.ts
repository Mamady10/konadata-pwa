import { jsPDF } from 'jspdf';
import type { SchoolSemester } from '@/lib/school/school-org-settings';
import {
  DEFAULT_BULLETIN_TEMPLATE,
  type SchoolBulletinTemplate,
} from '@/lib/school/bulletin-template';
import {
  drawLayoutSectionTitle,
  drawReportCardHeader,
} from '@/lib/school/report-card-layouts';
import type { OrgLogoImage } from '@/lib/school/fetch-org-logo';
import type { OrgStampImage } from '@/lib/school/fetch-org-branding';
import { suggestCouncilAppreciation } from '@/lib/school/council-appreciation';
import { scoreMention } from '@/lib/school/score-mention';

export interface ReportCardGradeLine {
  subjectName: string;
  score: number | null;
  maxScore: number;
  coefficient: number;
  examType?: string | null;
  evaluationCount?: number;
  missing?: boolean;
}

export interface ReportCardPdfInput {
  organizationName: string;
  organizationLogoUrl?: string | null;
  organizationLogo?: OrgLogoImage | null;
  organizationStamp?: OrgStampImage | null;
  orgAddress?: string | null;
  establishmentMeta?: string | null;
  studentName: string;
  matricule: string | null;
  className: string;
  semester: SchoolSemester | string;
  /** Libellé affiché (semestre ou trimestre selon réglage établissement). */
  periodLabel?: string | null;
  academicYear: string;
  averageScore: number | null;
  rank: number | null;
  classSize: number;
  appreciation: string | null;
  grades: ReportCardGradeLine[];
  publicationStatus: 'draft' | 'final';
  /** Libellé des types d'évaluation retenus pour la moyenne. */
  includedExamTypesLabel?: string | null;
  template?: SchoolBulletinTemplate;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace(/^#/, '');
  if (h.length !== 6) return [37, 99, 235];
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function displayPeriodLabel(semester: string, periodLabel?: string | null): string {
  if (periodLabel?.trim()) return periodLabel.trim();
  if (semester === 'S1') return '1er semestre';
  if (semester === 'S2') return '2e semestre';
  if (semester === 'S3') return '3e semestre';
  if (semester === 'T1') return '1er trimestre';
  if (semester === 'T2') return '2e trimestre';
  if (semester === 'T3') return '3e trimestre';
  return semester;
}

export { scoreMention } from '@/lib/school/score-mention';

function drawBox(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.rect(x, y, w, h);
}

export function generateReportCardPdfBuffer(input: ReportCardPdfInput): Uint8Array {
  const tpl = input.template ?? DEFAULT_BULLETIN_TEMPLATE;
  const [r, g, b] = hexToRgb(tpl.primary_color);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 14;
  const pageW = 210;
  let y = 10;

  if (input.publicationStatus === 'draft') {
    doc.setTextColor(220, 220, 220);
    doc.setFontSize(42);
    doc.text('PROVISOIRE', 105, 150, { align: 'center', angle: 35 });
    doc.setTextColor(30, 41, 59);
  }

  const header = drawReportCardHeader(
    doc,
    {
      organizationName: input.organizationName,
      organizationLogo: input.organizationLogo,
      orgAddress: input.orgAddress,
      establishmentMeta: input.establishmentMeta,
      semester: String(input.semester),
      academicYear: input.academicYear,
    },
    tpl,
    [r, g, b],
    margin,
    pageW,
    y
  );
  y = header.y;
  const sectionStyle = header.sectionStyle;

  const sectionTitle = (title: string, posY: number) =>
    drawLayoutSectionTitle(doc, posY, title, [r, g, b], margin, pageW, sectionStyle);

  const statusLabel =
    input.publicationStatus === 'draft' ? 'BULLETIN PROVISOIRE' : 'BULLETIN DÉFINITIF';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  if (input.publicationStatus === 'draft') doc.setTextColor(180, 83, 9);
  doc.text(statusLabel, pageW / 2, y, { align: 'center' });
  doc.setTextColor(30, 41, 59);
  y += 9;

  y = sectionTitle('IDENTITÉ DE L\'ÉLÈVE', y);
  const identityH = input.includedExamTypesLabel ? 28 : 22;
  drawBox(doc, margin, y, 182, identityH);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nom et prénom(s) :`, margin + 3, y + 6);
  doc.setFont('helvetica', 'bold');
  doc.text(input.studentName, margin + 38, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(`Matricule :`, margin + 3, y + 12);
  doc.setFont('helvetica', 'bold');
  doc.text(input.matricule ?? '—', margin + 38, y + 12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Classe :`, margin + 3, y + 18);
  doc.setFont('helvetica', 'bold');
  doc.text(input.className, margin + 38, y + 18);

  doc.setFont('helvetica', 'normal');
  doc.text(`Période :`, margin + 100, y + 6);
  doc.setFont('helvetica', 'bold');
  doc.text(displayPeriodLabel(String(input.semester), input.periodLabel), margin + 118, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(`Année :`, margin + 100, y + 12);
  doc.setFont('helvetica', 'bold');
  doc.text(input.academicYear, margin + 118, y + 12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date d'édition :`, margin + 100, y + 18);
  doc.setFont('helvetica', 'bold');
  doc.text(new Date().toLocaleDateString('fr-FR'), margin + 128, y + 18);
  if (input.includedExamTypesLabel) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`Notes retenues : ${input.includedExamTypesLabel}`, margin + 3, y + 24);
  }
  y += identityH + 6;

  y = sectionTitle('RÉSULTATS PAR MATIÈRE', y);

  const colMatiere = margin + 2;
  const colNote = 78;
  const colCoef = tpl.show_coefficients ? 98 : 0;
  const colPts = tpl.show_coefficients ? 112 : 98;
  const colMention = tpl.show_coefficients ? 132 : 118;
  const colAppr = tpl.show_appreciation ? 158 : 0;
  const tableRight = margin + 182;

  const headerY = y;
  drawBox(doc, margin, headerY, 182, 7);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Matière', colMatiere, headerY + 5);
  doc.text('Note /20', colNote, headerY + 5);
  if (tpl.show_coefficients) doc.text('Coef.', colCoef, headerY + 5);
  doc.text('Points', colPts, headerY + 5);
  doc.text('Mention', colMention, headerY + 5);
  if (tpl.show_appreciation) doc.text('Appréciation', colAppr, headerY + 5);
  y = headerY + 7;

  let totalCoef = 0;
  let totalPts = 0;

  if (input.grades.length === 0) {
    drawBox(doc, margin, y, 182, 8);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.text('Aucune note enregistrée pour cette période.', margin + 3, y + 5);
    y += 10;
  } else {
    for (let i = 0; i < input.grades.length; i++) {
      const g = input.grades[i];
      if (y > 230) {
        doc.addPage();
        y = 20;
      }
      const rowH = tpl.show_appreciation ? 9 : 7;
      if (i % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, 182, rowH, 'F');
      }
      drawBox(doc, margin, y, 182, rowH);

      const hasScore =
        !g.missing &&
        g.score != null &&
        (g.score === 0 || Number.isFinite(Number(g.score)));
      const on20 = hasScore ? (Number(g.score) / (g.maxScore || 20)) * 20 : null;
      const pts = on20 != null ? on20 * g.coefficient : 0;
      if (hasScore) {
        totalCoef += g.coefficient;
        totalPts += pts;
      }
      const mention = on20 != null ? scoreMention(on20) : '—';
      const lineAppr =
        on20 == null
          ? 'Non noté'
          : on20 >= 14
            ? 'Excellent'
            : on20 >= 10
              ? 'Satisfaisant'
              : 'À améliorer';

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(g.subjectName, colMatiere, y + 5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(hasScore ? 30 : 148, hasScore ? 41 : 163, hasScore ? 59 : 184);
      doc.text(hasScore ? on20!.toFixed(2).replace('.', ',') : '—', colNote, y + 5);
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'normal');
      if (tpl.show_coefficients) doc.text(String(g.coefficient), colCoef, y + 5);
      doc.text(hasScore ? pts.toFixed(2).replace('.', ',') : '—', colPts, y + 5);
      doc.text(mention, colMention, y + 5);
      if (tpl.show_appreciation) {
        doc.setFontSize(7);
        doc.text(lineAppr, colAppr, y + 5);
      }
      y += rowH;
    }

    if (totalCoef > 0) {
      drawBox(doc, margin, y, 182, 7);
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, 182, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('TOTAUX (matières notées)', colMatiere, y + 5);
      if (tpl.show_coefficients) doc.text(String(totalCoef), colCoef, y + 5);
      doc.text(totalPts.toFixed(2).replace('.', ','), colPts, y + 5);
      y += 9;
    }
  }

  y = sectionTitle('SYNTHÈSE & DÉCISION', y + 2);
  const synthH = 28;
  drawBox(doc, margin, y, 182, synthH);

  const avg = input.averageScore;
  const globalMention = avg != null ? scoreMention(avg) : '—';

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Moyenne générale :', margin + 4, y + 7);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(r, g, b);
  doc.text(avg != null ? `${avg.toFixed(2).replace('.', ',')} / 20` : '—', margin + 42, y + 7);
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9);

  doc.setFont('helvetica', 'normal');
  doc.text('Mention :', margin + 4, y + 14);
  doc.setFont('helvetica', 'bold');
  doc.text(globalMention, margin + 42, y + 14);

  if (tpl.show_rank && input.rank != null && input.classSize > 0) {
    doc.setFont('helvetica', 'normal');
    doc.text('Rang dans la classe :', margin + 4, y + 21);
    doc.setFont('helvetica', 'bold');
    doc.text(`${input.rank}${input.rank === 1 ? 'er' : 'e'} sur ${input.classSize}`, margin + 42, y + 21);
  }

  doc.setFont('helvetica', 'normal');
  doc.text('Décision :', margin + 100, y + 7);
  doc.setFont('helvetica', 'bold');
  const decision = avg != null && avg >= 10 ? 'Admis(e) — passage autorisé' : 'Redoublement / rattrapage';
  doc.setFontSize(8);
  doc.text(decision, margin + 100, y + 13, { maxWidth: 88 });

  y += synthH + 5;

  const councilText =
    (tpl.show_appreciation && input.appreciation?.trim()) ||
    (tpl.show_appreciation && avg != null ? suggestCouncilAppreciation(avg) : '');

  if (councilText) {
    y = sectionTitle('APPRÉCIATION DU CONSEIL DE CLASSE', y);
    const lines = doc.splitTextToSize(councilText, 176);
    const apprH = Math.max(16, lines.length * 4.5 + 6);
    drawBox(doc, margin, y, 182, apprH);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(lines, margin + 3, y + 6);
    y += apprH + 6;
  }

  y = Math.max(y + 4, 248);
  const sigY = y;
  drawBox(doc, margin, sigY, 88, 26);
  drawBox(doc, margin + 94, sigY, 88, 26);

  const stamp = input.organizationStamp;
  if (stamp?.base64) {
    try {
      doc.addImage(
        `data:image/${stamp.format === 'JPEG' ? 'jpeg' : 'png'};base64,${stamp.base64}`,
        stamp.format,
        margin + 18,
        sigY + 2,
        38,
        38,
        undefined,
        'FAST'
      );
    } catch {
      /* ignore */
    }
  } else if (tpl.require_stamp) {
    doc.setTextColor(185, 28, 28);
    doc.setFontSize(7);
    doc.text('Cachet requis', margin + 44, sigY + 16, { align: 'center' });
    doc.setTextColor(30, 41, 59);
  }

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(tpl.director_signature_label, margin + 44, sigY + 6, { align: 'center' });
  doc.text('Le parent / tuteur', margin + 138, sigY + 6, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('Signature et cachet', margin + 44, sigY + 22, { align: 'center' });
  doc.text('Signature', margin + 138, sigY + 22, { align: 'center' });
  doc.setDrawColor(148, 163, 184);
  doc.line(margin + 10, sigY + 20, margin + 78, sigY + 20);
  doc.line(margin + 104, sigY + 20, margin + 172, sigY + 20);
  y = sigY + 30;

  y += 28;
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `${tpl.footer_text} — édité le ${new Date().toLocaleDateString('fr-FR')}`,
    pageW / 2,
    y,
    { align: 'center' }
  );
  if (input.publicationStatus === 'draft') {
    doc.setTextColor(180, 83, 9);
    doc.setFontSize(8);
    doc.text('Document provisoire — non officiel — sujet à modification', pageW / 2, y + 4, {
      align: 'center',
    });
  }

  return new Uint8Array(doc.output('arraybuffer'));
}

export function reportCardPdfFileName(
  studentName: string,
  semester: string,
  status: 'draft' | 'final'
): string {
  const safe = studentName
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .slice(0, 40);
  const tag = status === 'final' ? 'definitif' : 'provisoire';
  return `bulletin_${safe}_${semester}_${tag}.pdf`;
}
