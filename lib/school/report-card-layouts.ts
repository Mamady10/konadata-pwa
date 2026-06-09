import type { jsPDF } from 'jspdf';
import type { BulletinLayoutPresetId } from '@/lib/school/bulletin-presets';
import type { SchoolBulletinTemplate } from '@/lib/school/bulletin-template';
import type { OrgLogoImage } from '@/lib/school/fetch-org-logo';

export interface ReportCardHeaderInput {
  organizationName: string;
  organizationLogo?: OrgLogoImage | null;
  orgAddress?: string | null;
  establishmentMeta?: string | null;
  semester: string;
  academicYear: string;
}

export interface HeaderLayoutResult {
  y: number;
  rgb: [number, number, number];
  sectionStyle: 'bar' | 'underline' | 'frame';
}

function semesterLabel(semester: string): string {
  if (semester === 'S1') return '1er semestre';
  if (semester === 'S2') return '2e semestre';
  if (semester === 'S3') return '3e semestre';
  return semester;
}

function drawLogoPlain(
  doc: jsPDF,
  logo: OrgLogoImage | null | undefined,
  x: number,
  y: number,
  size: number,
  requireLogo: boolean
) {
  if (logo?.base64) {
    try {
      doc.addImage(
        `data:image/${logo.format === 'JPEG' ? 'jpeg' : 'png'};base64,${logo.base64}`,
        logo.format,
        x,
        y,
        size,
        size,
        undefined,
        'FAST'
      );
    } catch {
      /* ignore */
    }
    return;
  }
  if (!requireLogo) return;
  doc.setTextColor(254, 226, 226);
  doc.setFontSize(6);
  doc.text('LOGO', x + size / 2, y + size / 2 - 1, { align: 'center' });
  doc.text('REQUIS', x + size / 2, y + size / 2 + 3, { align: 'center' });
}

function drawRepublicHeader(doc: jsPDF, pageW: number, y: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  doc.text('RÉPUBLIQUE DE GUINEE', pageW / 2, y, { align: 'center' });
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text(
    "MINISTÈRE DE L'ENSEIGNEMENT PRESCOLAIRE, PRIMAIRE, SECONDAIRE ET DE L'ALPHABÉTISATION",
    pageW / 2,
    y,
    { align: 'center' }
  );
  return y + 6;
}

function drawMepsBandHeader(
  doc: jsPDF,
  input: ReportCardHeaderInput,
  tpl: SchoolBulletinTemplate,
  rgb: [number, number, number],
  margin: number,
  pageW: number,
  y: number
): number {
  const bannerTop = y;
  const bannerHeight = 28;
  const logoBox = 22;
  const logoLeft = margin;
  const logoTop = bannerTop + (bannerHeight - logoBox) / 2;

  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  doc.rect(0, bannerTop, pageW, bannerHeight, 'F');

  drawLogoPlain(doc, input.organizationLogo, logoLeft, logoTop, logoBox, tpl.require_logo);

  const textCenterX = margin + logoBox + (pageW - margin * 2 - logoBox) / 2;
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(tpl.header_title, textCenterX, bannerTop + 9, { align: 'center' });
  doc.setFontSize(9);
  const subtitle = tpl.header_subtitle?.trim() || input.organizationName;
  doc.text(subtitle, textCenterX, bannerTop + 15, { align: 'center' });
  if (input.establishmentMeta?.trim()) {
    doc.setFontSize(7);
    doc.text(input.establishmentMeta.trim(), textCenterX, bannerTop + 20, { align: 'center' });
  } else if (input.orgAddress?.trim()) {
    doc.setFontSize(7);
    doc.text(input.orgAddress.trim(), textCenterX, bannerTop + 20, { align: 'center' });
  }
  doc.setFontSize(8);
  doc.text(
    `${semesterLabel(String(input.semester))} · Année scolaire ${input.academicYear}`,
    textCenterX,
    bannerTop + 25,
    { align: 'center' }
  );

  return bannerTop + bannerHeight + 8;
}

function drawCenteredLogoHeader(
  doc: jsPDF,
  input: ReportCardHeaderInput,
  tpl: SchoolBulletinTemplate,
  rgb: [number, number, number],
  margin: number,
  pageW: number,
  y: number
): number {
  const logoSize = 24;
  const logoX = pageW / 2 - logoSize / 2;
  drawLogoPlain(doc, input.organizationLogo, logoX, y, logoSize, tpl.require_logo);
  y += logoSize + 4;

  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(tpl.header_title, pageW / 2, y, { align: 'center' });
  y += 6;
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  const subtitle = tpl.header_subtitle?.trim() || input.organizationName;
  doc.text(subtitle, pageW / 2, y, { align: 'center' });
  y += 5;
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `${semesterLabel(String(input.semester))} · ${input.academicYear}`,
    pageW / 2,
    y,
    { align: 'center' }
  );
  y += 4;
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
  doc.setLineWidth(0.6);
  doc.line(margin + 20, y, pageW - margin - 20, y);
  return y + 8;
}

function drawMinimalHeader(
  doc: jsPDF,
  input: ReportCardHeaderInput,
  tpl: SchoolBulletinTemplate,
  rgb: [number, number, number],
  margin: number,
  pageW: number,
  y: number
): number {
  const logoSize = 18;
  drawLogoPlain(doc, input.organizationLogo, margin, y, logoSize, tpl.require_logo);

  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(tpl.header_title, pageW - margin, y + 5, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const subtitle = tpl.header_subtitle?.trim() || input.organizationName;
  doc.text(subtitle, pageW - margin, y + 11, { align: 'right' });
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `${semesterLabel(String(input.semester))} · ${input.academicYear}`,
    pageW - margin,
    y + 16,
    { align: 'right' }
  );

  y += 22;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageW - margin, y);
  return y + 6;
}

function drawElegantFrameHeader(
  doc: jsPDF,
  input: ReportCardHeaderInput,
  tpl: SchoolBulletinTemplate,
  rgb: [number, number, number],
  margin: number,
  pageW: number,
  y: number
): number {
  const frameH = 32;
  const logoSize = 22;
  const logoTop = y + (frameH - logoSize) / 2;

  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
  doc.setLineWidth(0.5);
  doc.rect(margin, y, pageW - margin * 2, frameH);
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  doc.rect(margin, y, 3, frameH, 'F');

  drawLogoPlain(doc, input.organizationLogo, margin + 6, logoTop, logoSize, tpl.require_logo);

  const textX = margin + logoSize + 14;
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(tpl.header_title, textX, y + 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(tpl.header_subtitle?.trim() || input.organizationName, textX, y + 19);
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `${semesterLabel(String(input.semester))} · ${input.academicYear}`,
    textX,
    y + 26
  );

  return y + frameH + 8;
}

export function drawReportCardHeader(
  doc: jsPDF,
  input: ReportCardHeaderInput,
  tpl: SchoolBulletinTemplate,
  rgb: [number, number, number],
  margin: number,
  pageW: number,
  startY: number
): HeaderLayoutResult {
  const preset = tpl.layout_preset ?? 'meps_band';
  let y = startY;
  let sectionStyle: HeaderLayoutResult['sectionStyle'] = 'bar';

  const showRepublic =
    preset === 'meps_band' ||
    preset === 'institutional_green' ||
    preset === 'centered_logo' ||
    preset === 'bordeaux_formal' ||
    preset === 'navy_academic' ||
    preset === 'guinee_officiel' ||
    preset === 'indigo_stripe' ||
    preset === 'coral_sunset' ||
    preset === 'rose_academy';
  if (showRepublic) {
    y = drawRepublicHeader(doc, pageW, y);
  }

  switch (preset) {
    case 'centered_logo':
    case 'navy_academic':
    case 'slate_pro':
    case 'rose_academy':
      y = drawCenteredLogoHeader(doc, input, tpl, rgb, margin, pageW, y);
      sectionStyle = 'underline';
      break;
    case 'minimal':
    case 'forest_releve':
    case 'college_moderne':
    case 'teal_coast':
    case 'charcoal_minimal':
      y = drawMinimalHeader(doc, input, tpl, rgb, margin, pageW, y);
      sectionStyle = 'underline';
      break;
    case 'elegant_frame':
    case 'premium_gold':
    case 'amber_heritage':
      y = drawElegantFrameHeader(doc, input, tpl, rgb, margin, pageW, y);
      sectionStyle = 'frame';
      break;
    case 'institutional_green':
    case 'guinee_officiel':
      y = drawMepsBandHeader(doc, input, tpl, rgb, margin, pageW, y);
      sectionStyle = 'bar';
      break;
    case 'bordeaux_formal':
    case 'coral_sunset':
    case 'indigo_stripe':
    case 'meps_band':
    default:
      y = drawMepsBandHeader(doc, input, tpl, rgb, margin, pageW, y);
      sectionStyle = 'bar';
      break;
  }

  doc.setTextColor(30, 41, 59);
  return { y, rgb, sectionStyle };
}

export function drawLayoutSectionTitle(
  doc: jsPDF,
  y: number,
  title: string,
  rgb: [number, number, number],
  margin: number,
  pageW: number,
  style: HeaderLayoutResult['sectionStyle']
): number {
  if (style === 'underline') {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    doc.text(title, margin, y);
    doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
    doc.setLineWidth(0.35);
    doc.line(margin, y + 1.5, pageW - margin, y + 1.5);
    doc.setTextColor(30, 41, 59);
    return y + 8;
  }

  if (style === 'frame') {
    doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
    doc.setLineWidth(0.4);
    doc.line(margin, y - 2, margin + 50, y - 2);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    doc.text(title, margin, y + 2);
    doc.setTextColor(30, 41, 59);
    return y + 8;
  }

  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  doc.rect(14, y - 4, 182, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(title, 16, y);
  doc.setTextColor(30, 41, 59);
  return y + 8;
}

export function resolveLayoutPreset(tpl: SchoolBulletinTemplate): BulletinLayoutPresetId {
  return tpl.layout_preset ?? 'meps_band';
}
