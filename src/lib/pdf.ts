import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Company, Customer, Quote } from './types';
import { formatDateFull, formatCurrency } from './utils';

const MARGIN = 14;

function fmt(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

/** Gera o PDF do orçamento (profissional, com marca da empresa). */
export function downloadQuotePdf(company: Company, quote: Quote, customer?: Customer | null): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const accent = /^#[0-9a-fA-F]{6}$/.test(company.settings.accentColor) ? company.settings.accentColor : '#4f46e5';

  let y = MARGIN;

  // ---------------------------------------------------------- Cabeçalho
  doc.setFillColor(accent);
  doc.rect(0, 0, pageWidth, 4, 'F');

  const logo = company.logoUrl && company.settings.showLogo ? company.logoUrl : null;
  let nameX = MARGIN;
  if (logo) {
    try {
      const mime = logo.match(/^data:([a-zA-Z0-9/]+);/)?.[1] ?? '';
      const fmt = mime.includes('png') || !mime ? 'PNG' : 'JPEG';
      doc.addImage(logo, fmt, MARGIN, y + 4, 42, 14, undefined, 'FAST');
      nameX = MARGIN + 46;
    } catch {
      doc.setFontSize(13);
      doc.setTextColor(120);
      doc.text('Logo', MARGIN, y + 12);
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(20, 20, 20);
  doc.text(company.name, nameX, y + 10);
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.setFont('helvetica', 'normal');
  const contactLines: string[] = [];
  if (company.settings.showPhone && company.phone) contactLines.push(`Tel: ${company.phone}`);
  if (company.settings.showEmail && company.email) contactLines.push(company.email);
  if (company.settings.showAddress && company.address) contactLines.push(company.address);
  if (company.settings.showCnpj && company.cnpj) contactLines.push(`CNPJ: ${company.cnpj}`);
  doc.text(contactLines.join('  ·  '), nameX, y + 16);

  // Box de metadados (número / datas)
  const metaRight = pageWidth - MARGIN;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(accent);
  doc.text('ORÇAMENTO', metaRight, y + 8, { align: 'right' });
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60);
  const label = `#${String(quote.number).padStart(4, '0')}`;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20);
  doc.text(label, metaRight, y + 13, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(110);
  doc.text(`Emissão: ${formatDateFull(quote.createdAt)}`, metaRight, y + 18, { align: 'right' });
  doc.text(`Validade: ${formatDateFull(quote.validUntil)} (${quote.validityDays} dias)`, metaRight, y + 22.5, { align: 'right' });

  y += 30;

  // ---------------------------------------------------------- Cliente
  doc.setDrawColor(230);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(MARGIN, y, pageWidth - MARGIN * 2, 24, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(accent);
  doc.text('DADOS DO CLIENTE', MARGIN + 5, y + 7);
  doc.setFontSize(10.5);
  doc.setTextColor(30);
  doc.text(quote.customerName || (customer?.name ?? '—'), MARGIN + 5, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110);
  const custDetails = [quote.customerPhone || customer?.phone, quote.customerEmail || customer?.email].filter(Boolean).join(' · ');
  doc.text(custDetails || ' ', MARGIN + 5, y + 20);

  y += 32;

  // ---------------------------------------------------------- Itens
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['#', 'Serviço', 'Qtd', 'Unidade', 'Preço unit.', 'Total']],
    body: quote.items.map((it, i) => [
      String(i + 1),
      it.name + (it.description ? `\n${it.description}` : ''),
      String(it.quantity).replace('.', ','),
      it.unit,
      fmt(it.price),
      fmt(it.quantity * it.price),
    ]),
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 3,
      textColor: [40, 40, 40],
      lineColor: [230, 230, 230],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: accent,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      2: { cellWidth: 14, halign: 'center' },
      3: { cellWidth: 24 },
      4: { cellWidth: 26, halign: 'right' },
      5: { cellWidth: 26, halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 1) {
        data.cell.styles.cellWidth = pageWidth - MARGIN * 2 - 8 - 14 - 24 - 26 - 26;
      }
    },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // ---------------------------------------------------------- Totais
  const totalX = pageWidth - MARGIN;
  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal', totalX - 60, y);
  doc.text(fmt(quote.subtotal), totalX, y, { align: 'right' });
  y += 6;
  if (quote.discount > 0) {
    doc.text('Desconto', totalX - 60, y);
    doc.text(`- ${fmt(quote.discount)}`, totalX, y, { align: 'right' });
    y += 6;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(accent);
  doc.text('TOTAL', totalX - 60, y);
  doc.text(fmt(quote.total), totalX, y, { align: 'right' });
  doc.setDrawColor(accent);
  doc.setLineWidth(0.4);
  doc.line(totalX - 62, y + 2.5, totalX, y + 2.5);
  y += 12;

  // ---------------------------------------------------------- Observações
  if (quote.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30);
    doc.text('Observações', MARGIN, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(90);
    const lines = doc.splitTextToSize(quote.notes, pageWidth - MARGIN * 2);
    doc.text(lines, MARGIN, y + 5);
    y += 5 + lines.length * 4.5 + 4;
  }

  // ---------------------------------------------------------- Termos
  if (quote.terms) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30);
    doc.text('Termos e condições', MARGIN, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(110);
    const lines = doc.splitTextToSize(quote.terms, pageWidth - MARGIN * 2);
    doc.text(lines, MARGIN, y + 5);
    y += 5 + lines.length * 4 + 8;
  }

  // ---------------------------------------------------------- Assinatura
  if (company.settings.showSignature) {
    const remaining = pageHeight - y;
    if (remaining > 45) {
      const sigName = company.settings.signatureName || company.name;
      const sigY = pageHeight - MARGIN - 24;
      doc.setDrawColor(160);
      doc.setLineWidth(0.3);
      doc.line(MARGIN, sigY, MARGIN + 70, sigY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(80);
      doc.text(sigName, MARGIN, sigY + 6);
      doc.setFontSize(8);
      doc.setTextColor(130);
      doc.text('Assinatura', MARGIN + 70, sigY - 2);
      doc.setFont('helvetica', 'italic');
      doc.text('Local e data: ____________', pageWidth - MARGIN - 60, sigY);
    }
  }

  // ---------------------------------------------------------- Rodapé
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(150);
    doc.text(
      `Página ${i} de ${pageCount}  ·  Gerado com OrçaAI`,
      pageWidth / 2,
      pageHeight - 6,
      { align: 'center' },
    );
  }

  const safeName = (company.name || 'orcamento').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  doc.save(`orcamento-${String(quote.number).padStart(4, '0')}-${safeName}.pdf`);
}

export { formatCurrency };
