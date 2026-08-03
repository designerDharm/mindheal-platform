import PDFDocument from "pdfkit";

export const PdfService = {
  /**
   * Generates a PDF from a report text and returns a buffer
   */
  async generateReportPdf(reportId, reportType, aiContent) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfData = Buffer.concat(buffers);
          resolve(pdfData);
        });

        // Simple styling for the report
        doc.fontSize(24).text(`MindHeal Analysis Report`, { align: 'center' });
        doc.moveDown();
        
        doc.fontSize(14).text(`Report ID: ${reportId}`);
        doc.text(`Type: ${reportType.toUpperCase()}`);
        doc.text(`Date: ${new Date().toLocaleDateString()}`);
        doc.moveDown(2);

        doc.fontSize(12).text(aiContent, {
          align: 'left',
          lineGap: 4
        });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
};
