import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ChecklistData {
  folio: number;
  client: {
    business_name: string;
    address: string;
    contact_name: string;
  };
  elevator: {
    brand: string;
    model: string;
    serial_number: string;
    is_hydraulic: boolean;
  };
  checklist: {
    month: number;
    year: number;
    last_certification_date: string | null;
    next_certification_date: string | null;
    certification_not_legible: boolean;
    completion_date: string;
  };
  technician: {
    full_name: string;
    email: string;
  };
  questions: Array<{
    question_number: number;
    section: string;
    question_text: string;
    answer_status: 'approved' | 'rejected';
    observations?: string;
  }>;
  signature: {
    signer_name: string;
    signature_data: string;
    signed_at: string;
  };
}

export async function generateMaintenancePDF(data: ChecklistData): Promise<Blob> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPosition = 20;

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('MIREGA ASCENSORES', pageWidth / 2, yPosition, { align: 'center' });

  yPosition += 8;
  doc.setFontSize(16);
  doc.text('INFORME DE MANTENIMIENTO', pageWidth / 2, yPosition, { align: 'center' });

  yPosition += 6;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const frequency = getMaintenanceFrequency(data.checklist.month);
  doc.text(`INSPECCIÓN ${frequency.toUpperCase()}`, pageWidth / 2, yPosition, { align: 'center' });

  yPosition += 10;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`FOLIO N° ${String(data.folio).padStart(6, '0')}`, pageWidth - 15, yPosition, { align: 'right' });

  yPosition += 10;
  doc.setDrawColor(200, 200, 200);
  doc.line(15, yPosition, pageWidth - 15, yPosition);

  yPosition += 10;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('INFORMACIÓN GENERAL', 15, yPosition);

  yPosition += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  const infoData = [
    ['Cliente:', data.client.business_name],
    ['Dirección:', data.client.address],
    ['Contacto:', data.client.contact_name],
    ['Ascensor:', `${data.elevator.brand} ${data.elevator.model}`],
    ['Número de Serie:', data.elevator.serial_number],
    ['Tipo:', data.elevator.is_hydraulic ? 'Hidráulico' : 'Eléctrico'],
    ['Técnico:', data.technician.full_name],
    ['Periodo:', `${monthNames[data.checklist.month - 1]} ${data.checklist.year}`],
    ['Fecha de Inspección:', new Date(data.checklist.completion_date).toLocaleDateString('es-ES')],
  ];

  if (!data.checklist.certification_not_legible && data.checklist.last_certification_date) {
    infoData.push(
      ['Última Certificación:', new Date(data.checklist.last_certification_date).toLocaleDateString('es-ES')],
      ['Próxima Certificación:', data.checklist.next_certification_date ? new Date(data.checklist.next_certification_date).toLocaleDateString('es-ES') : 'N/A']
    );
  } else if (data.checklist.certification_not_legible) {
    infoData.push(['Certificación:', 'Información no legible']);
  }

  infoData.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, 15, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(value, 60, yPosition);
    yPosition += 6;
  });

  yPosition += 5;
  doc.line(15, yPosition, pageWidth - 15, yPosition);

  yPosition += 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('CHECKLIST DE MANTENIMIENTO', 15, yPosition);

  yPosition += 7;

  const tableData = data.questions.map((q) => [
    q.question_number.toString(),
    q.question_text,
    q.answer_status === 'approved' ? '✓' : '✗',
  ]);

  autoTable(doc, {
    startY: yPosition,
    head: [['N°', 'Pregunta', 'Estado']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontSize: 10,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 9,
    },
    columnStyles: {
      0: { cellWidth: 15, halign: 'center' },
      1: { cellWidth: 140 },
      2: { cellWidth: 20, halign: 'center', fontSize: 12 },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 2) {
        const status = data.cell.raw as string;
        if (status === '✗') {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = [22, 163, 74];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  yPosition = (doc as any).lastAutoTable.finalY + 10;

  const rejectedQuestions = data.questions.filter((q) => q.answer_status === 'rejected' && q.observations);

  if (rejectedQuestions.length > 0) {
    if (yPosition > pageHeight - 60) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('OBSERVACIONES Y HALLAZGOS', 15, yPosition);
    yPosition += 7;

    rejectedQuestions.forEach((q, index) => {
      if (yPosition > pageHeight - 40) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`${index + 1}. Pregunta N° ${q.question_number}:`, 15, yPosition);
      yPosition += 5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(q.question_text, pageWidth - 30);
      doc.text(lines, 15, yPosition);
      yPosition += lines.length * 4 + 3;

      doc.setFont('helvetica', 'italic');
      doc.text('Observación:', 15, yPosition);
      yPosition += 4;

      doc.setFont('helvetica', 'normal');
      const obsLines = doc.splitTextToSize(q.observations || '', pageWidth - 30);
      doc.text(obsLines, 15, yPosition);
      yPosition += obsLines.length * 4 + 8;
    });
  }

  if (yPosition > pageHeight - 70) {
    doc.addPage();
    yPosition = 20;
  }

  yPosition += 10;
  doc.line(15, yPosition, pageWidth - 15, yPosition);

  yPosition += 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('FIRMA Y RECEPCIÓN', 15, yPosition);

  yPosition += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('RECEPCIONADO POR:', 15, yPosition);

  yPosition += 5;
  doc.setFont('helvetica', 'bold');
  doc.text(data.signature.signer_name, 15, yPosition);

  yPosition += 10;

  if (data.signature.signature_data) {
    try {
      doc.addImage(data.signature.signature_data, 'PNG', 15, yPosition, 80, 30);
      yPosition += 35;
    } catch (error) {
      console.error('Error adding signature image:', error);
      yPosition += 5;
    }
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('_________________________', 15, yPosition);
  yPosition += 4;
  doc.text('Firma', 15, yPosition);

  yPosition += 10;
  doc.text(`Fecha: ${new Date(data.signature.signed_at).toLocaleDateString('es-ES')}`, 15, yPosition);
  yPosition += 4;
  doc.text(`Hora: ${new Date(data.signature.signed_at).toLocaleTimeString('es-ES')}`, 15, yPosition);

  yPosition = pageHeight - 20;
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text(
    'Este documento fue generado automáticamente por MIREGA Ascensores',
    pageWidth / 2,
    yPosition,
    { align: 'center' }
  );
  yPosition += 4;
  doc.text(
    `Generado el ${new Date().toLocaleString('es-ES')}`,
    pageWidth / 2,
    yPosition,
    { align: 'center' }
  );

  return doc.output('blob');
}

function getMaintenanceFrequency(month: number): string {
  const quarters = [3, 6, 9, 12];
  const semesters = [3, 9];

  if (semesters.includes(month)) {
    return 'Semestral';
  } else if (quarters.includes(month)) {
    return 'Trimestral';
  } else {
    return 'Mensual';
  }
}

export function generatePDFFilename(client: string, month: number, year: number, elevatorSerial: string): string {
  const monthNames = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];

  const cleanClient = client
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .toLowerCase();

  const cleanSerial = elevatorSerial.replace(/[^a-zA-Z0-9]/g, '');

  return `${cleanClient}_${cleanSerial}_${monthNames[month - 1]}_${year}.pdf`;
}
