import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "@/config";
import { TopNav } from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    LayoutList, MoreVertical, FileText, Trash2, Eye, Calendar, Clock, Search, Edit, Download, Sheet, FileDown, MapPin
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { format } from "date-fns";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Document, Packer, Paragraph, TextRun, ImageRun, Table as DocxTable, TableRow as DocxTableRow, TableCell as DocxTableCell, WidthType, BorderStyle, AlignmentType, HeadingLevel } from "docx";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import { auditTemplates, ChecklistContent, ClauseChecklistContent, SectionContent } from "@/data/auditTemplates";
import { CLAUSE_MATRIX, ClauseMatrixRow } from "@/data/clauseMapping";
import ReusablePagination from "@/components/ReusablePagination";

const AuditList = () => {
    const [auditPlans, setAuditPlans] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [selectedSite, setSelectedSite] = useState("all");
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

    useEffect(() => {
        const fetchPlans = async () => {
            try {
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                const res = await fetch(`${API_BASE_URL}/api/audit-plans?userId=${user.id}`);
                const data = await res.json();
                setAuditPlans(Array.isArray(data) ? data : []);
            } catch (error) {
                console.error("Failed to fetch audit plans:", error);
                toast.error("Failed to load audit plans");
            } finally {
                setLoading(false);
            }
        };
        fetchPlans();
    }, []);

    const handleDeletePlan = async (planId: number) => {
        if (!confirm("Are you sure you want to delete this audit plan?")) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/audit-plans/${planId}`, {
                method: "DELETE"
            });
            if (res.ok) {
                setAuditPlans(prev => prev.filter(p => p.id !== planId));
                toast.success("Audit plan deleted successfully");
            } else {
                throw new Error("Failed to delete");
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to delete audit plan");
        }
    };

    const getAuditData = (plan: any) => {
        if (!plan.auditData) return {};
        return typeof plan.auditData === 'string' ? JSON.parse(plan.auditData) : plan.auditData;
    };

        const handleDownloadPDF = async (planStub: any) => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/audit-plans/${planStub.id}`);
            if (!res.ok) throw new Error("Failed to fetch full plan details");
            const plan = await res.json();
            const template = auditTemplates.find(t => t.id === plan.templateId);
            const auditData = getAuditData(plan);

            const previousFindings = auditData.previousFindings || '';
            const detailsOfChanges = auditData.detailsOfChanges || [];
            const participants = auditData.participants || [];
            const summaryCounts = auditData.summaryCounts || { compliant: '0', ofi: '0', minor: '0', major: '0', positive: '0' };
            const auditFindings = auditData.auditFindings || [];
            const opportunities = auditData.opportunities || [];
            const nonConformances = auditData.nonConformances || [];
            const editableChecklist = auditData.editableChecklist || template?.content || [];
            const checklistData = auditData.checklistData || {};
            const extraChecklistItems = auditData.extraChecklistItems || {};
            const clauseData = auditData.clauseData || {};
            const sectionData = auditData.sectionData || {};
            const processAudits = auditData.processAudits || [];
            const clauseFiles = auditData.clauseFiles || {};
            const genericFiles = auditData.genericFiles || {};
            const positiveAspects = auditData.positiveAspects || [];

            const showISO9001 = !!plan?.auditProgram?.isoStandard?.includes("9001");
            const showISO14001 = !!plan?.auditProgram?.isoStandard?.includes("14001");
            const showISO45001 = !!plan?.auditProgram?.isoStandard?.includes("45001");
            const activeCount = [showISO9001, showISO14001, showISO45001].filter(Boolean).length;
            const clauseSchedule = typeof plan?.clauseSchedule === 'string' ? JSON.parse(plan.clauseSchedule) : (plan?.clauseSchedule || {});

            const isClauseSelected = (clauseId: string) => {
              if (activeCount === 0) return true;
              if (showISO45001 && clauseSchedule['ISO45001']?.includes(clauseId)) return true;
              if (showISO14001 && clauseSchedule['ISO14001']?.includes(clauseId)) return true;
              if (showISO9001 && clauseSchedule['ISO9001']?.includes(clauseId)) return true;
              return false;
            };

            const clausesToRender = (typeof CLAUSE_MATRIX !== 'undefined' ? CLAUSE_MATRIX : []).filter(c => {
                if (activeCount === 0) return true;
                if (c.isHeading) return true;
                return isClauseSelected(c.id);
            });

    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 14;
    const darkColor: [number, number, number] = [33, 56, 71];
    const greenColor: [number, number, number] = [16, 185, 129];
    const amberColor: [number, number, number] = [245, 158, 11];
    const redColor: [number, number, number] = [239, 68, 68];

    // ---------- helpers ----------
    const section = (title: string, y: number): number => {
      if (y > pageH - 40) { doc.addPage(); y = margin; }
      doc.setFillColor(...darkColor);
      doc.rect(margin, y, pageW - margin * 2, 8, 'F');
      doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
      doc.text(title, margin + 3, y + 5.5);
      doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal');
      return y + 12;
    };

    const checkPage = (y: number, need = 20): number => {
      if (y + need > pageH - 25) { doc.addPage(); return margin; }
      return y;
    };

    // ---- Try to load logo - compressed via canvas to prevent huge file sizes ----
    let logoDataUrl: string | null = null;
    let logoRatio = 0.3;
    try {
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.src = '/iAudit Global-01.png';
        img.onload = () => {
          const MAX = 120;
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          if (width > MAX || height > MAX) {
            if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
            else { width = Math.round(width * MAX / height); height = MAX; }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d')!;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          logoDataUrl = canvas.toDataURL('image/jpeg', 0.6);
          logoRatio = height / width;
          resolve();
        };
        img.onerror = () => resolve();
      });
    } catch { }

    // ---- PAGE 1: COVER ----
    let y = margin;
    if (logoDataUrl) {
      const lw = 50; const lh = lw * logoRatio;
      doc.addImage(logoDataUrl, 'PNG', pageW / 2 - lw / 2, y, lw, lh);
      y += lh + 8;
    } else {
      y += 10;
    }
    doc.setFontSize(22); doc.setFont('helvetica', 'bold'); doc.setTextColor(...darkColor);
    doc.text('Audit Report', pageW / 2, y, { align: 'center' });
    y += 8;
    doc.setFontSize(13); doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 80);
    doc.text(plan.auditName || '', pageW / 2, y, { align: 'center' });
    y += 10;
    doc.setFontSize(9); doc.setTextColor(130, 130, 130);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageW / 2, y, { align: 'center' });
    y += 14;

    // ---- 1. Audit Information ----
    y = section('1. AUDIT INFORMATION', y);
    const leadName = plan.leadAuditor ? `${plan.leadAuditor.firstName} ${plan.leadAuditor.lastName}` : (plan.leadAuditorName || '—');
    const auditeeStr = Array.isArray(plan.auditees)
      ? plan.auditees.map((a: any) => typeof a === 'string' ? a : `${a.firstName || ''} ${a.lastName || ''}`.trim()).join(', ')
      : (plan.auditees || '—');
    autoTable(doc, {
      startY: y,
      body: [
        ['Audit Name', plan.auditName || '—'],
        ['Template', template.title || '—'],
        ['Site / Location', plan.site?.name || plan.location || '—'],
        ['Date', plan.date ? format(new Date(plan.date), 'PPP') : '—'],
        ['Lead Auditor', leadName],
        ['Auditees', auditeeStr],
        ['Standard / Criteria', plan.criteria || plan.standard || '—'],
        ['Objective', plan.objective || '—'],
        ['Scope', plan.scope || '—'],
      ],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 4 },
      columnStyles: { 0: { fontStyle: 'bold', fillColor: [240, 243, 246], cellWidth: 52 } }
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // ---- 2. Previous Findings ----
    y = section('2. PREVIOUS FINDINGS', y);
    if (previousFindings?.trim()) {
      doc.setFontSize(9); doc.setTextColor(40, 40, 40);
      const pfLines = doc.splitTextToSize(previousFindings, pageW - margin * 2);
      pfLines.forEach((line: string) => { y = checkPage(y, 6); doc.text(line, margin, y); y += 5; });
    } else {
      doc.setFontSize(9); doc.setTextColor(150, 150, 150);
      doc.text('No previous findings recorded.', margin, y); y += 6;
    }
    y += 6;

    // ---- 3. Details of Changes ----
    y = section('3. DETAILS OF CHANGES', y);
    autoTable(doc, {
      startY: y,
      head: [['Item', 'Action Required', 'Notes']],
      body: detailsOfChanges.map(d => [d.item, d.actionRequired ? 'Yes' : 'No', d.notes || '—']),
      theme: 'grid', styles: { fontSize: 9 }, headStyles: { fillColor: darkColor },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 1 && data.cell.raw === 'Yes')
          data.cell.styles.textColor = [239, 68, 68];
      }
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // ---- 4. Audit Participants ----
    y = section('4. AUDIT PARTICIPANTS', y);
    const filledParticipants = participants.filter(p => p.name?.trim());
    if (filledParticipants.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Name', 'Position', 'Opening', 'Closing', 'Interviewed']],
        body: filledParticipants.map(p => [p.name || '—', p.position || '—', p.opening ? '✓' : '', p.closing ? '✓' : '', p.interviewed || '—']),
        theme: 'grid', styles: { fontSize: 9 }, headStyles: { fillColor: darkColor }
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    } else {
      doc.setFontSize(9); doc.setTextColor(150, 150, 150);
      doc.text('No participants recorded.', margin, y); y += 12;
    }

    // ---- 5. Global Findings / Summary ----
    y = section('5. GLOBAL FINDINGS SUMMARY', y);
    autoTable(doc, {
      startY: y,
      head: [['Compliant', 'OFI', 'Minor NCR', 'Major NCR', 'Positive Aspects']],
      body: [[summaryCounts.compliant || '0', summaryCounts.ofi || '0', summaryCounts.minor || '0', summaryCounts.major || '0', summaryCounts.positive || '0']],
      theme: 'grid', styles: { fontSize: 10, halign: 'center' },
      headStyles: { fillColor: greenColor }
    });
    y = (doc as any).lastAutoTable.finalY + 8;
    // Findings log
    const filledAF = auditFindings.filter(f => f.details?.trim());
    if (filledAF.length > 0) {
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...darkColor);
      doc.text('Audit Findings Log', margin, y); y += 5; doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0);
      autoTable(doc, {
        startY: y,
        head: [['Ref No', 'Clause No', 'Category', 'Details']],
        body: filledAF.map(f => [f.refNo || '—', f.clauseNo || '—', f.category || '—', f.details || '—']),
        theme: 'grid', styles: { fontSize: 9 }, headStyles: { fillColor: darkColor }
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    } else { y += 6; }

    // ---- 6. Opportunities for Improvement (OFI) ----
    y = section('6. OPPORTUNITIES FOR IMPROVEMENT (OFI)', y);
    const ofiItems = opportunities.filter(o => o.opportunity?.trim());
    if (ofiItems.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Ref', 'Standard Clause', 'Area / Process', 'Opportunity']],
        body: ofiItems.map(o => [o.id, o.standardClause || '—', o.areaProcess || '—', o.opportunity || '—']),
        theme: 'grid', styles: { fontSize: 9 }, headStyles: { fillColor: amberColor }
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    } else {
      doc.setFontSize(9); doc.setTextColor(150, 150, 150);
      doc.text('No OFIs recorded.', margin, y); y += 12;
    }

    // ---- 7. Non-Conformances (NCR) ----
    y = section('7. NON-CONFORMANCES (NCR)', y);
    const ncrItems = nonConformances.filter(n => n.statement?.trim());
    if (ncrItems.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Ref', 'Standard Clause', 'Area / Process', 'NC Statement', 'Due Date', 'Action By']],
        body: ncrItems.map(n => [n.id, n.standardClause || '—', n.areaProcess || '—', n.statement || '—', n.dueDate || '—', n.actionBy || '—']),
        theme: 'grid', styles: { fontSize: 8, overflow: 'linebreak' }, headStyles: { fillColor: redColor }
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    } else {
      doc.setFontSize(9); doc.setTextColor(150, 150, 150);
      doc.text('No non-conformances recorded.', margin, y); y += 12;
    }

    // ---- 8. Template Fields (filled rows only, NC details inline) ----
    if (template.type === 'checklist') {
      y = section('8. AUDIT CHECKLIST FINDINGS', y);
      // lblStyle: blue label cell style
      const lblStyle = { fillColor: darkColor as [number, number, number], textColor: [255, 255, 255] as [number, number, number], fontStyle: 'bold' as const, fontSize: 8, cellPadding: 3 };
      const bodyRows: any[] = [];
      const imgRowMap = new Map<number, string>(); // rowIndex -> image data URL

      (editableChecklist as ChecklistContent[]).forEach((item, idx) => {
        const d = (checklistData[idx] || {}) as any;
        if (!d.findings) return; // skip unfilled
        // Main finding row
        bodyRows.push([item.clause, item.question, d.findings]);
        // Evidence sub-row
        if (d.evidence?.trim()) {
          bodyRows.push([{ content: 'Evidence', styles: lblStyle }, { content: d.evidence, colSpan: 2, styles: { fontSize: 8, cellPadding: 3 } }]);
        }
        // NC detail sub-rows (only when non-compliant)
        if (d.findings !== 'C') {
          if (d.description?.trim()) bodyRows.push([{ content: 'Details', styles: lblStyle }, { content: d.description, colSpan: 2, styles: { fontSize: 8, cellPadding: 3 } }]);
          if (d.correction?.trim()) bodyRows.push([{ content: 'Correction', styles: lblStyle }, { content: d.correction, colSpan: 2, styles: { fontSize: 8, cellPadding: 3 } }]);
          if (d.rootCause?.trim()) bodyRows.push([{ content: 'Root Cause', styles: lblStyle }, { content: d.rootCause, colSpan: 2, styles: { fontSize: 8, cellPadding: 3 } }]);
          if (d.correctiveAction?.trim()) bodyRows.push([{ content: 'Corrective Action', styles: lblStyle }, { content: d.correctiveAction, colSpan: 2, styles: { fontSize: 8, cellPadding: 3 } }]);
        }
        // Image sub-row
        const clauseImgs = (clauseFiles[item.clause] || []).filter((m) => m.type.startsWith('image/'));
        if (clauseImgs.length > 0) {
          imgRowMap.set(bodyRows.length, clauseImgs[0].data);
          bodyRows.push([{ content: '', colSpan: 3, styles: { minCellHeight: 55, cellPadding: 2 } }]);
        }
      });

      // Also append extra questions added during the audit
      Object.entries(extraChecklistItems).forEach(([clause, extras]: [string, any]) => {
        extras.forEach((eq: any) => {
          if (!eq.question?.trim() && !eq.findings) return;
          bodyRows.push([clause, eq.question || '(no question text)', eq.findings || '—']);
          if (eq.evidence?.trim()) bodyRows.push([{ content: 'Evidence', styles: lblStyle }, { content: eq.evidence, colSpan: 2, styles: { fontSize: 8, cellPadding: 3 } }]);
          if (eq.findings !== 'C') {
            if (eq.description?.trim()) bodyRows.push([{ content: 'Description of Finding', styles: lblStyle }, { content: eq.description, colSpan: 2, styles: { fontSize: 8, cellPadding: 3 } }]);
            if (eq.correction?.trim()) bodyRows.push([{ content: 'Correction Done', styles: lblStyle }, { content: eq.correction, colSpan: 2, styles: { fontSize: 8, cellPadding: 3 } }]);
            if (eq.rootCause?.trim()) bodyRows.push([{ content: 'Root Cause', styles: lblStyle }, { content: eq.rootCause, colSpan: 2, styles: { fontSize: 8, cellPadding: 3 } }]);
            if (eq.correctiveAction?.trim()) bodyRows.push([{ content: 'Corrective Action', styles: lblStyle }, { content: eq.correctiveAction, colSpan: 2, styles: { fontSize: 8, cellPadding: 3 } }]);
          }
        });
      });

      if (bodyRows.length === 0) {
        doc.setFontSize(9); doc.setTextColor(150, 150, 150);
        doc.text('No findings recorded yet.', margin, y); y += 12;
      } else {
        autoTable(doc, {
          startY: y,
          head: [['Clause', 'Question', 'Finding']],
          body: bodyRows, theme: 'grid',
          styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
          columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 22 } },
          headStyles: { fillColor: darkColor },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 2 && !imgRowMap.has(data.row.index)) {
              const f = String(data.cell.raw || '');
              if (f === 'C') data.cell.styles.textColor = [16, 185, 129];
              else if (f === 'OFI') data.cell.styles.textColor = [245, 158, 11];
              else if (f === 'Min' || f === 'Maj') data.cell.styles.textColor = [239, 68, 68];
            }
          },
          didDrawCell: (data) => {
            if (data.section === 'body' && data.column.index === 0 && imgRowMap.has(data.row.index)) {
              const imgData = imgRowMap.get(data.row.index)!;
              try {
                const fmt = imgData.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
                // full-width image across all 3 cols, positioned at the row's cell
                const tblW = pageW - margin * 2;
                doc.addImage(imgData, fmt, data.cell.x + 2, data.cell.y + 2, tblW - 4, 50);
              } catch (e) { console.error('clause img row failed', e); }
            }
          }
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      }
    } else if (template.type === 'clause-checklist') {
      y = section('8. CLAUSE CHECKLIST', y);
      const checklistToUse = (editableChecklist as ClauseChecklistContent[]).length > 0
        ? (editableChecklist as ClauseChecklistContent[])
        : (template.content as ClauseChecklistContent[]);

      const filledClauses = checklistToUse.filter(c => (clauseData[c.clauseId] || {} as any).findingType);
      if (filledClauses.length === 0) {
        doc.setFontSize(9); doc.setTextColor(150, 150, 150);
        doc.text('No findings recorded yet.', margin, y); y += 12;
      } else {
        const bodyRows: any[] = [];
        const lblStyle = { fillColor: darkColor as [number, number, number], textColor: [255, 255, 255] as [number, number, number], fontStyle: 'bold' as const, fontSize: 8, cellPadding: 3 };
        
        filledClauses.forEach(c => {
          const d = (clauseData[c.clauseId] || {}) as any;
          const requirement = [c.title, ...(c.subClauses || [])].filter(Boolean).join('\n');
          bodyRows.push([c.clauseId, requirement, d.findingType || '—', d.evidence || '—']);
          
          if (d.findingType && d.findingType !== 'C') {
            if (d.description?.trim()) bodyRows.push([{ content: 'Description of Finding', styles: lblStyle }, { content: d.description, colSpan: 3, styles: { fontSize: 8, cellPadding: 3 } }]);
            if (d.correction?.trim()) bodyRows.push([{ content: 'Correction Done', styles: lblStyle }, { content: d.correction, colSpan: 3, styles: { fontSize: 8, cellPadding: 3 } }]);
            if (d.rootCause?.trim()) bodyRows.push([{ content: 'Root Cause', styles: lblStyle }, { content: d.rootCause, colSpan: 3, styles: { fontSize: 8, cellPadding: 3 } }]);
            if (d.correctiveAction?.trim()) bodyRows.push([{ content: 'Corrective Action', styles: lblStyle }, { content: d.correctiveAction, colSpan: 3, styles: { fontSize: 8, cellPadding: 3 } }]);
          }
        });

        autoTable(doc, {
          startY: y, head: [['Clause', 'Requirement', 'Status', 'Evidence']],
          body: bodyRows,
          theme: 'grid', styles: { fontSize: 8, overflow: 'linebreak' },
          columnStyles: { 0: { cellWidth: 18 }, 2: { cellWidth: 18 } }, headStyles: { fillColor: darkColor },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 2) {
              const f = String(data.cell.raw || '');
              if (f === 'C') data.cell.styles.textColor = [16, 185, 129];
              else if (f === 'OFI') data.cell.styles.textColor = [245, 158, 11];
              else if (f !== '—' && f !== '') data.cell.styles.textColor = [239, 68, 68];
            }
          }
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      }
    } else if (template.type === 'section') {
      y = section('8. SECTION RESPONSES', y);
      const filledSections = (template.content as SectionContent[]).filter((_, idx) => sectionData[idx]?.trim());
      if (filledSections.length === 0) {
        doc.setFontSize(9); doc.setTextColor(150, 150, 150);
        doc.text('No responses recorded yet.', margin, y); y += 12;
      } else {
        const rows = (template.content as SectionContent[]).reduce<string[][]>((acc, sec, idx) => {
          if (sectionData[idx]?.trim()) acc.push([sec.title || `Section ${idx + 1}`, sectionData[idx]]);
          return acc;
        }, []);
        autoTable(doc, { startY: y, head: [['Section', 'Response']], body: rows, theme: 'grid', styles: { fontSize: 9 }, headStyles: { fillColor: darkColor } });
        y = (doc as any).lastAutoTable.finalY + 10;
      }
    } else if (template.type === 'process-audit') {
      y = section('8. PROCESS AUDIT', y);
      const filledPA = processAudits.filter(pa => pa.processArea?.trim() || pa.evidence?.trim());
      if (filledPA.length === 0) {
        doc.setFontSize(9); doc.setTextColor(150, 150, 150);
        doc.text('No process audits recorded yet.', margin, y); y += 12;
      } else {
        autoTable(doc, {
          startY: y, head: [['Process Area', 'Auditees', 'Evidence', 'Conclusion', 'Finding']],
          body: filledPA.map(pa => [pa.processArea || '—', pa.auditees || '—', pa.evidence || '—', pa.conclusion || '—', (pa as any).findingType || '—']),
          theme: 'grid', styles: { fontSize: 8, overflow: 'linebreak' }, headStyles: { fillColor: darkColor }
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      }
    } else if (template.isTripleMapping) {
      y = section(`8. INTEGRATED AUDIT MAPPING (${[showISO9001 && 'ISO 9001', showISO14001 && 'ISO 14001', showISO45001 && 'ISO 45001'].filter(Boolean).join(', ')})`, y);
      const rows: any[] = [];
      const lblStyle = { fillColor: darkColor as [number, number, number], textColor: [255, 255, 255] as [number, number, number], fontStyle: 'bold' as const, fontSize: 8, cellPadding: 3 };

      CLAUSE_MATRIX.forEach((row, idx) => {
        if (!isClauseSelected(row.id)) return;
        
        // Use editableChecklist if available to match UI
        const questions = (editableChecklist as ChecklistContent[]).filter(q => q.clause === row.id);
        
        if (row.isHeading) {
          const headingParts = [
            showISO45001 && row.iso45001, 
            showISO14001 && row.iso14001, 
            showISO9001 && row.iso9001
          ].filter(Boolean);
          rows.push([{ content: headingParts.join(' / '), colSpan: activeCount + 2, styles: { fillColor: [240, 240, 240], fontStyle: 'bold' } }]);
          return;
        }

        questions.forEach(q => {
          const dIdx = editableChecklist.indexOf(q);
          const d = (checklistData[dIdx] || {}) as any;
          if (!d.findings) return;

          const rowData = [
            showISO45001 && row.iso45001,
            showISO14001 && row.iso14001,
            showISO9001 && row.iso9001,
            d.findings,
            d.evidence || '—'
          ].filter(val => val !== false);

          rows.push(rowData);

          if (d.findings !== 'C') {
            if (d.description?.trim()) rows.push([{ content: 'Description of Finding', styles: lblStyle }, { content: d.description, colSpan: activeCount + 1, styles: { fontSize: 8, cellPadding: 3 } }]);
            if (d.correction?.trim()) rows.push([{ content: 'Correction Done', styles: lblStyle }, { content: d.correction, colSpan: activeCount + 1, styles: { fontSize: 8, cellPadding: 3 } }]);
            if (d.rootCause?.trim()) rows.push([{ content: 'Root Cause', styles: lblStyle }, { content: d.rootCause, colSpan: activeCount + 1, styles: { fontSize: 8, cellPadding: 3 } }]);
            if (d.correctiveAction?.trim()) rows.push([{ content: 'Corrective Action', styles: lblStyle }, { content: d.correctiveAction, colSpan: activeCount + 1, styles: { fontSize: 8, cellPadding: 3 } }]);
          }
        });
      });

      if (rows.length === 0) {
        doc.setFontSize(9); doc.setTextColor(150, 150, 150);
        doc.text('No findings recorded yet.', margin, y); y += 12;
      } else {
        const head = [
          showISO45001 && 'ISO 45001',
          showISO14001 && 'ISO 14001',
          showISO9001 && 'ISO 9001',
          'Finding',
          'Evidence'
        ].filter(Boolean) as string[];

        autoTable(doc, {
          startY: y,
          head: [head],
          body: rows,
          theme: 'grid',
          styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
          columnStyles: { 
            0: { cellWidth: activeCount === 1 ? 105 : activeCount === 2 ? 52 : 35 },
            1: { cellWidth: activeCount === 2 ? 52 : 35 },
            2: { cellWidth: 35 },
            [activeCount]: { cellWidth: 15 },
            [activeCount + 1]: { cellWidth: 'auto' } 
          },
          headStyles: { fillColor: darkColor },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === activeCount) {
              const f = String(data.cell.raw || '');
              if (f === 'C') data.cell.styles.textColor = [16, 185, 129];
              else if (f === 'OFI') data.cell.styles.textColor = [245, 158, 11];
              else if (f === 'Min' || f === 'Maj') data.cell.styles.textColor = [239, 68, 68];
            }
          }
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      }
    }

    // ---- 9. Evidence & Images ----
    const allMedia = [...Object.values(clauseFiles).flat(), ...Object.values(genericFiles).flat()];
    if (allMedia.length > 0) {
      y = section('9. EVIDENCE & IMAGES', y);
      for (const m of allMedia as any[]) {
        y = checkPage(y, 60);
        if (m.type.startsWith('image/')) {
          try {
            doc.addImage(m.data, m.type.split('/')[1].toUpperCase(), margin, y, 80, 60);
            doc.setFontSize(8); doc.setTextColor(100, 100, 100);
            doc.text(m.name, margin, y + 63);
            y += 70;
          } catch (e) { console.error('PDF image embed failed', e); }
        } else {
          doc.setFontSize(9); doc.setTextColor(60, 60, 60);
          doc.text(`• ${m.name} (${m.type})`, margin, y); y += 7;
        }
      }
    }

    // ---- Footer on every page ----
    const totalPages = (doc.internal as any).getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8); doc.setTextColor(150, 150, 150);
      doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
      doc.text(`${plan.auditName || 'Audit'} Report`, margin, pageH - 7);
      doc.text(`Page ${i} of ${totalPages}`, pageW - margin, pageH - 7, { align: 'right' });
    }

    doc.save(`${(plan.auditName || 'Audit').replace(/\s+/g, '_')}_Report.pdf`);
 
            toast.success('PDF Downloaded');
        } catch (error) {
            console.error(error);
            toast.error("Failed to generate PDF");
        } finally {
            setLoading(false);
        }
    };
const handleDownloadDocx = async (planStub: any) => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/audit-plans/${planStub.id}`);
            if (!res.ok) throw new Error("Failed to fetch full plan details");
            const plan = await res.json();

            const template = auditTemplates.find(t => t.id === plan.templateId);
            const auditData = getAuditData(plan);
            const fileName = `Audit_Plan_${plan.auditName?.replace(/[^a-z0-9]/gi, '_') || plan.id}`;

            // Fetch logo image for DOCX - improved transparency handling
            let logoBuffer: ArrayBuffer | null = null;
            try {
                const response = await fetch('/iAudit Global-01.png');
                const blob = await response.blob();
                logoBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => {
                        const MAX = 120;
                        const canvas = document.createElement("canvas");
                        let { width, height } = img;
                        if (width > MAX || height > MAX) {
                            if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
                            else { width = Math.round(width * MAX / height); height = MAX; }
                        }
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext("2d")!;
                        ctx.clearRect(0, 0, width, height); // Clear for transparency
                        ctx.drawImage(img, 0, 0, width, height);
                        canvas.toBlob((compressedBlob) => {
                            if (compressedBlob) compressedBlob.arrayBuffer().then(resolve).catch(reject);
                            else reject(new Error("Canvas toBlob returned null"));
                        }, "image/png"); // Use PNG for transparency
                    };
                    img.onerror = reject;
                    img.src = URL.createObjectURL(blob);
                });
            } catch (e) {
                console.warn("Logo could not be loaded for DOCX", e);
            }

            const primaryColor = '213847';
            const children: any[] = [];
            const MARGIN_TWIPS = 1440; // 1 inch = 1440 twips (~25.4mm), for 20mm use ~1134

            if (logoBuffer) {
                children.push(new Paragraph({
                    children: [new ImageRun({ data: logoBuffer, transformation: { width: 80, height: 60 } })],
                    spacing: { after: 200 }
                }));
            }

            const heading = (text: string, color = primaryColor) => new Paragraph({
                children: [new TextRun({ text, bold: true, size: 28, color })],
                spacing: { before: 400, after: 200 }
            });

            const kv = (label: string, value: string) => new Paragraph({
                children: [
                    new TextRun({ text: `${label}: `, bold: true }),
                    new TextRun(value || 'N/A')
                ],
                spacing: { after: 120 }
            });

            const kvTwoLine = (label: string, value: string) => [
                new Paragraph({
                    children: [new TextRun({ text: `${label}:`, bold: true })],
                    spacing: { before: 200 }
                }),
                new Paragraph({
                    children: [new TextRun(value || 'N/A')],
                    spacing: { after: 200 }
                })
            ];

            children.push(
                new Paragraph({
                    children: [new TextRun({ text: 'AUDIT PLAN REPORT', bold: true, size: 40, color: primaryColor })],
                    spacing: { after: 400 }
                }),
                kv('Audit Name', plan.auditName || plan.auditType),
                kv('Date', plan.date ? new Date(plan.date).toLocaleDateString() : 'TBD'),
                kv('Location', plan.location),
                kv('Lead Auditor', plan.leadAuditor ? `${plan.leadAuditor.firstName} ${plan.leadAuditor.lastName}` : '-'),
                kv('Execution ID', plan.executionId || 'Standalone'),
                kv('Criteria', plan.criteria),
                ...kvTwoLine('Scope', plan.scope),
                ...kvTwoLine('Objective', plan.objective),
            );

            // --- Audit Itinerary (New Table in Word) ---
            const itinerary = plan.itinerary ? (typeof plan.itinerary === 'string' ? JSON.parse(plan.itinerary) : plan.itinerary) : [];
            if (Array.isArray(itinerary) && itinerary.length > 0) {
                children.push(heading('Audit Itinerary'));
                const tableRows = [
                    new DocxTableRow({
                        children: [
                            new DocxTableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Time', bold: true, color: 'ffffff' })] })], shading: { fill: primaryColor } }),
                            new DocxTableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Activity', bold: true, color: 'ffffff' })] })], shading: { fill: primaryColor } }),
                            new DocxTableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Auditee / Dept', bold: true, color: 'ffffff' })] })], shading: { fill: primaryColor } }),
                        ]
                    }),
                    ...itinerary.map((item: any) => new DocxTableRow({
                        children: [
                            new DocxTableCell({ children: [new Paragraph(`${item.startTime || ''} - ${item.endTime || ''}`)] }),
                            new DocxTableCell({ children: [new Paragraph(item.activity || '')] }),
                            new DocxTableCell({ children: [new Paragraph(item.auditee || '')] }),
                        ]
                    }))
                ];
                children.push(new DocxTable({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: tableRows,
                    borders: {
                        top: { style: BorderStyle.SINGLE, size: 2 },
                        bottom: { style: BorderStyle.SINGLE, size: 2 },
                        left: { style: BorderStyle.SINGLE, size: 2 },
                        right: { style: BorderStyle.SINGLE, size: 2 },
                        insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
                        insideVertical: { style: BorderStyle.SINGLE, size: 1 },
                    }
                }));
            }

            if (auditData.executiveSummary) {
                children.push(heading('Executive Summary'));
                children.push(new Paragraph({ text: auditData.executiveSummary, spacing: { after: 200 } }));
            }

            if (auditData.nonConformances?.some((nc: any) => nc.statement)) {
                children.push(heading('Non-Conformances', 'DC2626'));
                auditData.nonConformances.forEach((nc: any) => {
                    if (!nc.statement) return;
                    children.push(new Paragraph({
                        children: [
                            new TextRun({ text: `${nc.id} (${nc.standardClause || ''}): `, bold: true }),
                            new TextRun(nc.statement)
                        ],
                        bullet: { level: 0 },
                        spacing: { after: 100 }
                    }));
                });
            }

            const doc = new Document({
                sections: [{
                    properties: {
                        page: {
                            margin: {
                                top: MARGIN_TWIPS,
                                right: MARGIN_TWIPS,
                                bottom: MARGIN_TWIPS,
                                left: MARGIN_TWIPS,
                            },
                        },
                    },
                    children
                }]
            });
            const blob = await Packer.toBlob(doc);
            saveAs(blob, `${fileName}.docx`);
            toast.success('Word Document Downloaded');
        } catch (error) {
            console.error(error);
            toast.error("Failed to generate Word document");
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadExcel = (plan: any) => {
        const template = auditTemplates.find(t => t.id === plan.templateId);
        const auditData = getAuditData(plan);
        const fileName = `Audit_Report_${plan.auditName?.replace(/[^a-z0-9]/gi, '_') || plan.id}`;
        const wb = XLSX.utils.book_new();

        // Sheet 1: Plan Summary
        const summaryData = [
            ['Field', 'Value'],
            ['Audit Name', plan.auditName || plan.auditType || 'N/A'],
            ['Template', template?.title || plan.templateId || 'N/A'],
            ['Date', plan.date ? new Date(plan.date).toLocaleDateString() : 'TBD'],
            ['Location', plan.location || 'N/A'],
            ['Lead Auditor', plan.leadAuditor ? `${plan.leadAuditor.firstName} ${plan.leadAuditor.lastName}` : '-'],
            ['Execution ID', plan.executionId || 'Standalone'],
            ['Scope', plan.scope || 'N/A'],
            ['Objective', plan.objective || 'N/A'],
            ['Saved Progress', `${auditData.progress ?? 0}%`],
            ['Last Saved', auditData.lastSaved ? new Date(auditData.lastSaved).toLocaleString() : 'Never'],
        ];
        if (auditData.executiveSummary) summaryData.push(['Executive Summary', auditData.executiveSummary]);
        if (auditData.summaryCounts) {
            summaryData.push(['Major NCs', auditData.summaryCounts.major || '0']);
            summaryData.push(['Minor NCs', auditData.summaryCounts.minor || '0']);
            summaryData.push(['OFIs', auditData.summaryCounts.ofi || '0']);
            summaryData.push(['Positive Aspects', auditData.summaryCounts.positive || '0']);
        }
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), 'Summary');

        // Sheet 2: Participants
        if (auditData.participants?.length) {
            const pData = [['Name', 'Position', 'Opening Meeting', 'Closing Meeting', 'Interviewed']];
            auditData.participants.forEach((p: any) => {
                const row: any[] = [p.name, p.position, p.opening ? 'Yes' : 'No', p.closing ? 'Yes' : 'No', p.interviewed || ''];
                pData.push(row);
            });
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pData), 'Participants');
        }

        // Sheet 3: Checklist Findings
        if (auditData.checklistData && Object.keys(auditData.checklistData).length > 0 && template?.content) {
            const cData = [['Clause', 'Question', 'Finding', 'Evidence', 'Description', 'Correction', 'Root Cause', 'Corrective Action']];
            Object.entries(auditData.checklistData).filter(([, v]: any) => v.findings).forEach(([idx, v]: any) => {
                const item = (template.content as ChecklistContent[])[Number(idx)];
                cData.push([item?.clause || idx, item?.question || '-', v.findings, v.evidence || '', v.description || '', v.correction || '', v.rootCause || '', v.correctiveAction || '']);
            });
            if (cData.length > 1) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cData), 'Checklist');
        }

        // Sheet 4: Non-Conformances
        if (auditData.nonConformances?.some((nc: any) => nc.statement)) {
            const ncData = [['ID', 'Standard Clause', 'Area/Process', 'Statement', 'Due Date']];
            auditData.nonConformances.forEach((nc: any) => ncData.push([nc.id, nc.standardClause, nc.areaProcess, nc.statement, nc.dueDate || '']));
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ncData), 'Non-Conformances');
        }

        // Sheet 5: OFIs
        if (auditData.opportunities?.some((o: any) => o.opportunity)) {
            const oData = [['ID', 'Standard Clause', 'Area/Process', 'Opportunity']];
            auditData.opportunities.forEach((o: any) => oData.push([o.id, o.standardClause, o.areaProcess, o.opportunity]));
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(oData), 'OFIs');
        }

        // Sheet 6: Positive Aspects
        if (auditData.positiveAspects?.some((pa: any) => pa.aspect)) {
            const paData = [['ID', 'Standard Clause', 'Area/Process', 'Aspect']];
            auditData.positiveAspects.forEach((pa: any) => paData.push([pa.id, pa.standardClause, pa.areaProcess, pa.aspect]));
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(paData), 'Positive Aspects');
        }

        // Sheet 7: Process Audits
        if (auditData.processAudits?.some((pa: any) => pa.processArea)) {
            const prData = [['Process Area', 'Auditees', 'Evidence', 'Conclusion']];
            auditData.processAudits.forEach((pa: any) => prData.push([pa.processArea, pa.auditees, pa.evidence, pa.conclusion]));
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(prData), 'Process Audits');
        }

        XLSX.writeFile(wb, `${fileName}.xlsx`);
        toast.success('Excel Downloaded');
    };

    const filteredPlansBySearch = auditPlans.filter(plan =>
        (plan.auditName && plan.auditName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (plan.executionId && plan.executionId.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (plan.location && plan.location.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const getStatus = (plan: any) => {
        // Dummy logic for status, assuming available. 
        // In real app it comes from backend plan.status
        return plan.status || "In Progress";
    };

    const getProgress = (plan: any) => {
        // Use pre-calculated progress from backend for speed
        return plan.progress ?? 0;
    };

    const uniqueSites = React.useMemo(() => {
        const sites = auditPlans.map(plan => plan.auditProgram?.site?.name || plan.location).filter(Boolean);
        return ["all", ...Array.from(new Set(sites))];
    }, [auditPlans]);

    const filteredPlansBySite = filteredPlansBySearch.filter(plan => {
        if (selectedSite === "all") return true;
        const siteName = plan.auditProgram?.site?.name || plan.location;
        return siteName === selectedSite;
    });

    const filteredPlans = filteredPlansBySite.filter(plan => {
        if (statusFilter === "all") return true;
        return getStatus(plan).toLowerCase() === statusFilter.toLowerCase();
    });

    const counts = {
        all: filteredPlansBySite.length,
        draft: filteredPlansBySite.filter(p => getStatus(p) === "Draft").length,
        scheduled: filteredPlansBySite.filter(p => getStatus(p) === "Scheduled").length,
        inProgress: filteredPlansBySite.filter(p => getStatus(p) === "In Progress").length,
        completed: filteredPlansBySite.filter(p => getStatus(p) === "Completed").length,
        cancelled: filteredPlansBySite.filter(p => getStatus(p) === "Cancelled").length,
        postponed: filteredPlansBySite.filter(p => getStatus(p) === "Postponed").length,
    };

    const totalPages = Math.ceil(filteredPlans.length / itemsPerPage);
    const paginatedPlans = filteredPlans.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Reset page to 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, statusFilter, selectedSite]);

    return (
        <div className="flex-1 space-y-8 p-8 pt-6 min-h-screen bg-white">
            <div className="w-full max-w-[1800px] mx-auto space-y-8 animate-in fade-in duration-500">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10 w-full">
                    <div className="space-y-1">
                        <h2 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
                            Audit Active List
                        </h2>
                        <p className="text-sm text-[#64748B] font-medium">
                            View and manage all your verified audit plans.
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search audits..."
                                className="pl-9 w-[250px] h-12 rounded-xl border-slate-200 bg-white shadow-sm focus-visible:ring-1 focus-visible:ring-[#213847]/40"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {uniqueSites.length > 2 && (
                    <div className="flex flex-col gap-3 animate-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-[#213847]" />
                            <span className="text-sm font-bold text-[#213847]">Select Site</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {uniqueSites.map((site) => (
                                <button
                                    key={site}
                                    onClick={() => setSelectedSite(site)}
                                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 border ${selectedSite === site
                                        ? "bg-[#213847] text-white border-[#213847] shadow-md"
                                        : "bg-white text-slate-600 border-slate-200 hover:border-[#213847]/30 hover:bg-slate-50"
                                        }`}
                                >
                                    {site === "all" ? "All Sites" : site}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <Tabs defaultValue="all" onValueChange={setStatusFilter} className="w-full relative z-10 space-y-6">
                    <div className="bg-slate-50/50 rounded-xl p-1.5 inline-block border border-slate-100">
                        <TabsList className="bg-transparent h-auto p-0 space-x-2">
                            <TabsTrigger value="all" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg px-4 py-2 text-sm font-medium text-slate-600 data-[state=active]:text-[#213847] border-b-2 border-transparent data-[state=active]:border-[#213847] data-[state=active]:rounded-b-none transition-none">
                                All <span className="ml-2 bg-slate-200/50 text-slate-600 px-2 py-0.5 rounded-md text-xs">{counts.all}</span>
                            </TabsTrigger>
                            <TabsTrigger value="draft" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg px-4 py-2 text-sm font-medium text-slate-500 data-[state=active]:text-[#213847] data-[state=active]:border-b-2 data-[state=active]:border-[#213847] data-[state=active]:rounded-b-none transition-none">
                                Draft <span className="ml-2 bg-slate-200/50 text-slate-600 px-2 py-0.5 rounded-md text-xs">{counts.draft}</span>
                            </TabsTrigger>
                            <TabsTrigger value="scheduled" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg px-4 py-2 text-sm font-medium text-slate-500 data-[state=active]:text-[#213847] data-[state=active]:border-b-2 data-[state=active]:border-[#213847] data-[state=active]:rounded-b-none transition-none">
                                Scheduled <span className="ml-2 bg-slate-200/50 text-slate-600 px-2 py-0.5 rounded-md text-xs">{counts.scheduled}</span>
                            </TabsTrigger>
                            <TabsTrigger value="in progress" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg px-4 py-2 text-sm font-medium text-slate-500 data-[state=active]:text-[#213847] data-[state=active]:border-b-2 data-[state=active]:border-[#213847] data-[state=active]:rounded-b-none transition-none">
                                In Progress <span className="ml-2 bg-slate-200/50 text-slate-600 px-2 py-0.5 rounded-md text-xs">{counts.inProgress}</span>
                            </TabsTrigger>
                            <TabsTrigger value="completed" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg px-4 py-2 text-sm font-medium text-slate-500 data-[state=active]:text-[#213847] data-[state=active]:border-b-2 data-[state=active]:border-[#213847] data-[state=active]:rounded-b-none transition-none">
                                Completed <span className="ml-2 bg-slate-200/50 text-slate-600 px-2 py-0.5 rounded-md text-xs">{counts.completed}</span>
                            </TabsTrigger>
                            <TabsTrigger value="cancelled" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg px-4 py-2 text-sm font-medium text-slate-500 data-[state=active]:text-[#213847] data-[state=active]:border-b-2 data-[state=active]:border-[#213847] data-[state=active]:rounded-b-none transition-none">
                                Cancelled <span className="ml-2 bg-slate-200/50 text-slate-600 px-2 py-0.5 rounded-md text-xs">{counts.cancelled}</span>
                            </TabsTrigger>
                            <TabsTrigger value="postponed" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg px-4 py-2 text-sm font-medium text-slate-500 data-[state=active]:text-[#213847] data-[state=active]:border-b-2 data-[state=active]:border-[#213847] data-[state=active]:rounded-b-none transition-none">
                                Postponed <span className="ml-2 bg-slate-200/50 text-slate-600 px-2 py-0.5 rounded-md text-xs">{counts.postponed}</span>
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm relative z-10 w-full">
                        <Table>
                            <TableHeader className="bg-[#213847]">
                                <TableRow className="hover:bg-[#213847] border-none">
                                    <TableHead className="font-medium text-white h-12 py-3">Plan Name</TableHead>
                                    <TableHead className="font-medium text-white h-12 py-3">Audit</TableHead>
                                    <TableHead className="font-medium text-white h-12 py-3">Site</TableHead>
                                    <TableHead className="font-medium text-white h-12 py-3">Date & Time</TableHead>
                                    <TableHead className="font-medium text-white h-12 py-3">Lead Auditor</TableHead>
                                    <TableHead className="font-medium text-white h-12 py-3">Status</TableHead>
                                    <TableHead className="font-medium text-white h-12 py-3">Progress</TableHead>
                                    <TableHead className="text-right font-medium text-white h-12 py-3">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-48 text-center">
                                            <div className="flex flex-col items-center justify-center gap-3">
                                                <div className="w-8 h-8 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                                                <p className="text-sm font-medium text-slate-500">Loading audit plans...</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredPlans.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-48 text-center text-slate-500 font-medium">
                                            No audit plans found matching your criteria.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedPlans.map((plan) => {
                                        const status = getStatus(plan);
                                        let timeString = "-";
                                        try {
                                            if (plan.itinerary) {
                                                const parsedItin = typeof plan.itinerary === 'string' ? JSON.parse(plan.itinerary) : plan.itinerary;
                                                if (Array.isArray(parsedItin) && parsedItin.length > 0) {
                                                    timeString = `${parsedItin[0].startTime} - ${parsedItin[parsedItin.length - 1].endTime}`;
                                                }
                                            }
                                        } catch (e) {
                                            console.warn("Failed to parse itinerary", e);
                                        }

                                        return (
                                            <TableRow key={plan.id} className="cursor-pointer hover:bg-slate-50/80 transition-colors border-b border-slate-100 last:border-0 group">
                                                <TableCell className="font-bold text-slate-800 py-5">
                                                    {plan.auditName || "Unnamed Audit"}
                                                </TableCell>
                                                <TableCell className="py-5">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-700">{plan.executionId || "Standalone"}</span>
                                                        <span className="text-xs text-slate-400 font-medium">ISO Standards</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-slate-600 font-bold py-5">
                                                    {plan.auditProgram?.site?.name || plan.location?.split(',')[0] || "Head Office"}
                                                </TableCell>
                                                <TableCell className="py-5">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center text-slate-700 font-bold text-sm bg-slate-100 w-fit px-2 py-0.5 rounded-md gap-1.5">
                                                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                                                            {plan.date ? format(new Date(plan.date), "yyyy-MM-dd") : "TBD"}
                                                        </div>
                                                        <div className="flex items-center text-slate-500 text-xs font-semibold gap-1.5 px-2">
                                                            <Clock className="w-3.5 h-3.5 opacity-70" />
                                                            {timeString}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-bold text-slate-600 py-5">
                                                    {plan.leadAuditor ? `${plan.leadAuditor.firstName} ${plan.leadAuditor.lastName}` : "-"}
                                                </TableCell>
                                                <TableCell className="py-5">
                                                    <Badge variant="outline" className={`border-0 uppercase tracking-wider text-[10px] font-black px-2.5 py-1 ${status === 'In Progress' ? 'bg-amber-100 text-amber-700' : status === 'Scheduled' ? 'bg-blue-100 text-blue-700' : status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                                        {status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="py-5">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-xs font-bold text-slate-500 min-w-[20px]">{getProgress(plan)}%</span>
                                                        <Progress value={getProgress(plan)} className={`w-16 h-1.5 bg-slate-100 ${getProgress(plan) === 100 ? "[&>div]:bg-emerald-500" : "[&>div]:bg-emerald-400"}`} />
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right py-5">
                                                    <div className="flex justify-end items-center gap-2 pr-2">
                                                        <Button variant="ghost" size="icon" className="w-8 h-8 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-700 rounded-full" title="Perform Audit" onClick={() => navigate(`/audit/execute/${plan.id}`, { state: { plan } })}>
                                                            <Eye className="w-4 h-4" />
                                                        </Button>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="w-8 h-8 text-slate-500 hover:bg-slate-100 rounded-full">
                                                                    <Download className="w-4 h-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-44">
                                                                <DropdownMenuItem onClick={() => handleDownloadPDF(plan)} className="gap-2 cursor-pointer">
                                                                    <FileText className="w-4 h-4 text-red-500" /> Download PDF
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => handleDownloadDocx(plan)} className="gap-2 cursor-pointer">
                                                                    <FileText className="w-4 h-4 text-blue-500" /> Download Word
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => handleDownloadExcel(plan)} className="gap-2 cursor-pointer">
                                                                    <FileText className="w-4 h-4 text-emerald-500" /> Download Excel
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    <ReusablePagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={filteredPlans.length}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                        className="mt-6"
                    />
                </Tabs>
            </div>
        </div>
    );
};

export default AuditList;
