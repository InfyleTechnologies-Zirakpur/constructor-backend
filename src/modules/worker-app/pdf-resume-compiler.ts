import * as fs from 'fs';
import * as path from 'path';

interface TextToken {
  text: string;
  isBold: boolean;
}

interface TextSegment {
  text: string;
  isBold: boolean;
}

export class PdfResumeCompiler {
  private static parseMarkdown(input: string): TextSegment[] {
    const segments: TextSegment[] = [];
    const regex = /\*\*(.*?)\*\*/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(input)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ text: input.substring(lastIndex, match.index), isBold: false });
      }
      segments.push({ text: match[1] || '', isBold: true });
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < input.length) {
      segments.push({ text: input.substring(lastIndex), isBold: false });
    }

    if (segments.length === 0) {
      segments.push({ text: input, isBold: false });
    }

    return segments;
  }

  private static escapePdf(text: string): string {
    return (text || '')
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/[^\x20-\x7E\r\n\t]/g, ' ');
  }

  private static wrapText(text: string, maxChars: number): string[] {
    if ((text || '').length <= maxChars) return [text || ''];
    const words = text.split(' ');
    const lines: string[] = [];
    let current = '';

    for (const w of words) {
      if (!current) {
        current = w;
      } else if (current.length + 1 + w.length <= maxChars) {
        current += ` ${w}`;
      } else {
        lines.push(current);
        current = w;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  private static wrapMarkdownText(input: string, maxCharsPerLine: number): TextToken[][] {
    const segments = this.parseMarkdown(input);
    const allTokens: TextToken[] = [];

    for (const seg of segments) {
      const words = seg.text.split(/\s+/);
      for (const w of words) {
        if (w) {
          allTokens.push({ text: w, isBold: seg.isBold });
        }
      }
    }

    if (allTokens.length === 0) return [];

    const lines: TextToken[][] = [];
    let currentLine: TextToken[] = [];
    let currentLineLength = 0;

    for (const token of allTokens) {
      const tokenLen = token.text.length + 1;
      if (currentLine.length === 0) {
        currentLine.push(token);
        currentLineLength = token.text.length;
      } else if (currentLineLength + tokenLen <= maxCharsPerLine) {
        currentLine.push(token);
        currentLineLength += tokenLen;
      } else {
        lines.push([...currentLine]);
        currentLine = [token];
        currentLineLength = token.text.length;
      }
    }

    if (currentLine.length > 0) {
      lines.push(currentLine);
    }

    return lines;
  }

  /**
   * Compiles complete candidate resume data into an authentic multi-page ISO PDF 1.4 buffer.
   */
  public static compile(resume: Record<string, any>): Buffer {
    const pageStreams: string[][] = [[]];
    let currentPage = 0;
    let y = 800;

    const cur = () => pageStreams[currentPage];
    const writeLine = (line: string) => cur().push(line);

    const initPage1Header = () => {
      // FlowHire Blue Banner (y: 705 to 842)
      writeLine('0.117 0.458 0.910 rg');
      writeLine('0 705 595 137 re');
      writeLine('f');

      // Full Name (White, Bold, 20pt)
      const fullName = (resume.fullName || 'CANDIDATE RESUME').toUpperCase();
      writeLine('1.0 1.0 1.0 rg');
      writeLine('BT');
      writeLine('/F2 20 Tf');
      writeLine('40 798 Td');
      writeLine(`(${this.escapePdf(fullName)}) Tj`);
      writeLine('ET');

      // Role (White, Bold, 11pt)
      const role = (resume.currentRole || 'CONSTRUCTION PROFESSIONAL').toUpperCase();
      writeLine('BT');
      writeLine('/F2 11 Tf');
      writeLine('40 778 Td');
      writeLine(`(${this.escapePdf(role)}) Tj`);
      writeLine('ET');

      // Contact Line 1: Phone | Email | Address
      const contact1: string[] = [];
      if (resume.phone) contact1.push(`Phone: ${resume.phone}`);
      if (resume.email) contact1.push(`Email: ${resume.email}`);
      if (resume.currentAddress) contact1.push(`Location: ${resume.currentAddress}`);
      const line1 = contact1.length > 0 ? contact1.join('   |   ') : 'FlowHire Verified Professional';

      writeLine('BT');
      writeLine('/F1 9 Tf');
      writeLine('40 756 Td');
      writeLine(`(${this.escapePdf(line1)}) Tj`);
      writeLine('ET');

      // Contact Line 2: Date of Birth | Gender | Total Experience
      const contact2: string[] = [];
      if (resume.dob) contact2.push(`DOB: ${resume.dob}`);
      if (resume.gender) contact2.push(`Gender: ${resume.gender}`);
      if (resume.totalExperience) contact2.push(`Experience: ${resume.totalExperience}`);
      const line2 = contact2.join('   |   ');

      if (line2) {
        writeLine('BT');
        writeLine('/F1 9 Tf');
        writeLine('40 738 Td');
        writeLine(`(${this.escapePdf(line2)}) Tj`);
        writeLine('ET');
      }

      writeLine('0.06 0.09 0.16 rg');
      y = 680;
    };

    const initSubsequentPageHeader = (subtitle?: string) => {
      // FlowHire Blue top banner (y: 818 to 842)
      writeLine('0.117 0.458 0.910 rg');
      writeLine('0 818 595 24 re');
      writeLine('f');

      writeLine('1.0 1.0 1.0 rg');
      writeLine('BT');
      writeLine('/F2 9.5 Tf');
      writeLine('40 825 Td');
      const name = (resume.fullName || 'Candidate Resume').toUpperCase();
      const pageSub = subtitle || 'Professional Dossier';
      writeLine(`(${this.escapePdf(`${name}   —   ${pageSub}`)}) Tj`);
      writeLine('ET');

      writeLine('0.06 0.09 0.16 rg');
      y = 785;
    };

    initPage1Header();

    const forceNewPage = (subtitle?: string) => {
      currentPage++;
      pageStreams.push([]);
      initSubsequentPageHeader(subtitle);
    };

    const checkPageOverflow = (neededHeight: number, nextSubtitle?: string) => {
      if (y - neededHeight < 55) {
        forceNewPage(nextSubtitle);
      }
    };

    const drawSectionHeader = (title: string, nextSubtitle?: string) => {
      // Ensure at least 80pt so header + first item are never split
      checkPageOverflow(80, nextSubtitle);
      writeLine('0.117 0.458 0.910 rg');
      writeLine('BT');
      writeLine('/F2 12 Tf');
      writeLine(`40 ${y} Td`);
      writeLine(`(${this.escapePdf(title.toUpperCase())}) Tj`);
      writeLine('ET');

      writeLine(`40 ${y - 4} 515 1.5 re`);
      writeLine('f');

      writeLine('0.06 0.09 0.16 rg');
      y -= 22;
    };

    const drawPlainText = (text: string, isBold = false, fontSize = 10, indent = 40) => {
      const lines = this.wrapText(text, isBold ? 72 : 86);
      const font = isBold ? '/F2' : '/F1';
      for (const l of lines) {
        checkPageOverflow(fontSize + 4);
        writeLine('BT');
        writeLine(`${font} ${fontSize} Tf`);
        writeLine(`${indent} ${y} Td`);
        writeLine(`(${this.escapePdf(l)}) Tj`);
        writeLine('ET');
        y -= fontSize + 4;
      }
    };

    const drawMarkdownBlock = (text: string, fontSize = 9.5, indent = 40) => {
      const lines = this.wrapMarkdownText(text, 84);
      for (const line of lines) {
        checkPageOverflow(fontSize + 4);
        writeLine('BT');
        writeLine(`${indent} ${y} Td`);
        for (let i = 0; i < line.length; i++) {
          const token = line[i];
          const font = token.isBold ? '/F2' : '/F1';
          const spacing = i < line.length - 1 ? ' ' : '';
          writeLine(`${font} ${fontSize} Tf`);
          writeLine(`(${this.escapePdf(token.text + spacing)}) Tj`);
        }
        writeLine('ET');
        y -= fontSize + 4;
      }
    };

    // 1. PROFESSIONAL SUMMARY
    if (resume.aboutYou || resume.totalExperience) {
      drawSectionHeader('Professional Summary');
      if (resume.totalExperience) {
        drawPlainText(`Total Experience: ${resume.totalExperience}`, true, 10);
        y -= 2;
      }
      if (resume.aboutYou) {
        drawMarkdownBlock(resume.aboutYou, 9.5);
      }
      y -= 10;
    }

    // 2. WORK EXPERIENCE (Dedicated page flow for real candidate jobs)
    const workExperiences = Array.isArray(resume.workExperiences)
      ? resume.workExperiences
      : Array.isArray(resume.experience)
        ? resume.experience
        : [];

    if (workExperiences.length > 0) {
      // If Page 1 already has limited remaining vertical space, start Work Experience cleanly on an additional page
      if (y < 380) {
        forceNewPage('Work Experience');
      }
      drawSectionHeader('Work Experience', 'Work Experience (Continued)');
      for (const exp of workExperiences) {
        const title = exp.jobTitle || exp.role || 'Role';
        const company = exp.companyName || exp.company || '';
        const start = exp.startDate || '';
        const end = exp.isCurrentlyWorking ? 'Present' : (exp.endDate || '');
        const dateSpan = start ? (end ? `(${start} - ${end})` : `(${start})`) : (end ? `(${end})` : '');
        const header = company ? `${title}  at  ${company} ${dateSpan}`.trim() : `${title} ${dateSpan}`.trim();

        // Check overflow for the job title card
        checkPageOverflow(32, 'Work Experience (Continued)');
        drawPlainText(header, true, 10.5);

        if (exp.responsibility) {
          const respLines = String(exp.responsibility).split(/\n+/);
          for (const rl of respLines) {
            const clean = rl.replace(/^[-*•]\s*/, '').trim();
            if (clean) {
              drawPlainText(`• ${clean}`, false, 9.5, 52);
            }
          }
        }
        y -= 8;
      }
      y -= 8;
    }

    // 3. EDUCATION & TECHNICAL SKILLS (Dedicated additional page if space is low)
    const educations = Array.isArray(resume.educations)
      ? resume.educations
      : Array.isArray(resume.education)
        ? resume.education
        : [];

    const technicalSkills = Array.isArray(resume.technicalSkills)
      ? resume.technicalSkills
      : Array.isArray(resume.skills)
        ? resume.skills
        : [];
    const equipmentOperated = Array.isArray(resume.equipmentOperated) ? resume.equipmentOperated : [];
    const certifications = Array.isArray(resume.certifications) ? resume.certifications : [];

    // If remaining space on the work experience page is less than 320pt, start Education & Skills on an additional page
    if ((educations.length > 0 || technicalSkills.length > 0) && y < 320) {
      forceNewPage('Education & Technical Skills');
    }

    // 3. EDUCATION
    if (educations.length > 0) {
      drawSectionHeader('Education & Qualifications', 'Education & Qualifications');
      for (const edu of educations) {
        const qual = edu.qualification || edu.degree || 'Degree / Diploma';
        const inst = edu.instituteName || edu.institution ? `  —  ${edu.instituteName || edu.institution}` : '';
        checkPageOverflow(28, 'Education & Qualifications');
        drawPlainText(`• ${qual}${inst}`, true, 10);

        const details: string[] = [];
        if (edu.yearOfPassing || edu.year) details.push(`Year: ${edu.yearOfPassing || edu.year}`);
        if (edu.percentageOrCgpa || edu.score) details.push(`Score / CGPA: ${edu.percentageOrCgpa || edu.score}`);
        if (details.length > 0) {
          drawPlainText(details.join('   |   '), false, 9.5, 52);
        }
        y -= 4;
      }
      y -= 8;
    }

    // 4. SKILLS & MACHINERY
    if (technicalSkills.length > 0 || equipmentOperated.length > 0) {
      drawSectionHeader('Technical Skills & Machinery', 'Skills & Machinery');
      if (technicalSkills.length > 0) {
        drawPlainText('Trade Skills & Competencies:', true, 10);
        drawPlainText(technicalSkills.join('   •   '), false, 9.5, 52);
        y -= 6;
      }
      if (equipmentOperated.length > 0) {
        drawPlainText('Equipment & Machinery Operated:', true, 10);
        drawPlainText(equipmentOperated.join('   •   '), false, 9.5, 52);
        y -= 6;
      }
      y -= 8;
    }

    // 5. CERTIFICATIONS & LICENSES
    if (certifications.length > 0) {
      drawSectionHeader('Certifications & Professional Licenses', 'Certifications & Licenses');
      for (const cert of certifications) {
        const name = cert.name || 'Certification';
        const issued = cert.issuedBy ? `  —  Issued by: ${cert.issuedBy}` : '';
        const date = cert.issueDate ? ` (${cert.issueDate})` : '';
        checkPageOverflow(20, 'Certifications & Licenses');
        drawPlainText(`• ${name}${issued}${date}`, true, 9.5);
        y -= 3;
      }
      y -= 8;
    }

    // Footers on All Pages
    const totalPages = pageStreams.length;
    for (let p = 0; p < totalPages; p++) {
      const s = pageStreams[p];
      s.push('0.45 0.5 0.6 rg');
      s.push('BT');
      s.push('/F1 8 Tf');
      s.push('40 22 Td');
      s.push(`(Generated via FlowHire Platform   •   Verified Candidate Profile   •   Page ${p + 1} of ${totalPages}) Tj`);
      s.push('ET');
    }

    // ─── Assemble ISO PDF 1.4 Binary ───────────────────
    const parts: Buffer[] = [];
    const offsets: number[] = [];

    let currentOffset = 0;
    const writeString = (str: string) => {
      const b = Buffer.from(str, 'utf-8');
      parts.push(b);
      currentOffset += b.length;
    };

    writeString('%PDF-1.4\n');
    writeString('%\xE2\xE3\xCF\xD3\n');

    // Object 1: Catalog
    offsets.push(currentOffset);
    writeString('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

    // Object 2: Pages
    const kids = Array.from({ length: totalPages }, (_, i) => `${5 + 2 * i} 0 R`).join(' ');
    offsets.push(currentOffset);
    writeString(`2 0 obj\n<< /Type /Pages /Kids [ ${kids} ] /Count ${totalPages} >>\nendobj\n`);

    // Object 3: Font F1 (Helvetica)
    offsets.push(currentOffset);
    writeString('3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n');

    // Object 4: Font F2 (Helvetica-Bold)
    offsets.push(currentOffset);
    writeString('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n');

    // Page Objects and Content Stream Objects
    for (let i = 0; i < totalPages; i++) {
      const pageObjId = 5 + 2 * i;
      const contentObjId = pageObjId + 1;
      const streamText = pageStreams[i].join('\n') + '\n';
      const streamBytes = Buffer.from(streamText, 'utf-8');

      // Page Object
      offsets.push(currentOffset);
      writeString(
        `${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjId} 0 R >>\nendobj\n`,
      );

      // Content Stream Object
      offsets.push(currentOffset);
      writeString(`${contentObjId} 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n`);
      parts.push(streamBytes);
      currentOffset += streamBytes.length;
      writeString('\nendstream\nendobj\n');
    }

    // XREF Table
    const totalObjects = 4 + 2 * totalPages;
    const xrefOffset = currentOffset;
    writeString(`xref\n0 ${totalObjects + 1}\n`);
    writeString('0000000000 65535 f \n');
    for (const off of offsets) {
      writeString(`${off.toString().padStart(10, '0')} 00000 n \n`);
    }

    // Trailer
    writeString(`trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\n`);
    writeString(`startxref\n${xrefOffset}\n%%EOF\n`);

    return Buffer.concat(parts);
  }
}

