import React, { useState, useEffect } from "react";
import { TopNav } from "@/components/TopNav";
import { API_BASE_URL } from "@/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Check, ChevronDown, Plus, Save, Edit, Trash2, Eye, ArrowLeft, MoreHorizontal, Search, Star, FileText, Download } from "lucide-react";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Document, Packer, Paragraph, Table as DocxTable, TableCell as DocxTableCell, TableRow as DocxTableRow, WidthType, TextRun, HeadingLevel, AlignmentType, BorderStyle, ImageRun, Header } from 'docx';
import { saveAs } from 'file-saver';
import logoImg from "@/assets/logo.png";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import ReusablePagination from "@/components/ReusablePagination";

const ISO_STANDARDS = [
    "ISO 9001:2015 - Quality Management System",
    "ISO 14001:2015 - Environmental Management System",
    "ISO 45001:2018 - Occupational Health and Safety",
];

const FREQUENCIES = ["Monthly", "Quarterly", "Bi-annually", "Annually"];

interface Clause {
    id: string;
    name: string;
    isHeading?: boolean;
}

const CLAUSES: Clause[] = [
    { id: "4", name: "4. CONTEXT OF THE ORGANISATION", isHeading: true },
    { id: "4.1", name: "4.1 Understanding the organization & its context" },
    { id: "4.2", name: "4.2 Understanding the needs and expectations of interested parties" },
    { id: "4.3", name: "4.3 Determining the scope of the EMS" },
    { id: "4.4", name: "4.4 Environmental management system" },
    { id: "5", name: "5 LEADERSHIP", isHeading: true },
    { id: "5.1", name: "5.1 Leadership and commitment" },
    { id: "5.2", name: "5.2 Environmental policy" },
    { id: "5.3", name: "5.3 Organizational roles, responsibilities and authorities" },
    { id: "6", name: "6 PLANNING", isHeading: true },
    { id: "6.1", name: "6.1 Actions to address risks & opportunities", isHeading: true },
    { id: "6.1.1", name: "6.1.1 General" },
    { id: "6.1.2", name: "6.1.2 Environmental aspects" },
    { id: "6.1.3", name: "6.1.3 Compliance obligations" },
    { id: "6.1.4", name: "6.1.4 Planning action" },
    { id: "6.2", name: "6.2 Environmental objectives and planning to achieve them", isHeading: true },
    { id: "6.2.1", name: "6.2.1 Environmental objectives" },
    { id: "6.2.2", name: "6.2.2 Planning actions to achieve environmental objectives" },
    { id: "7", name: "7 SUPPORT", isHeading: true },
    { id: "7.1", name: "7.1 Resources" },
    { id: "7.2", name: "7.2 Competence" },
    { id: "7.3", name: "7.3 Awareness" },
    { id: "7.4", name: "7.4 Communication", isHeading: true },
    { id: "7.4.1", name: "7.4.1 General" },
    { id: "7.4.2", name: "7.4.2 Internal Communication" },
    { id: "7.4.3", name: "7.4.3 External Communication" },
    { id: "7.5", name: "7.5 Documented information", isHeading: true },
    { id: "7.5.1", name: "7.5.1 General" },
    { id: "7.5.2", name: "7.5.2 Creating and updating" },
    { id: "7.5.3", name: "7.5.3 Control of documented information" },
    { id: "8", name: "8 OPERATIONS", isHeading: true },
    { id: "8.1", name: "8.1 Operational planning and control" },
    { id: "8.2", name: "8.2 Emergency Preparedness and Response" },
    { id: "9", name: "9 PERFORMANCE EVALUATION", isHeading: true },
    { id: "9.1", name: "9.1 Monitoring, measuring, analysis and evaluation", isHeading: true },
    { id: "9.1.1", name: "9.1.1 General" },
    { id: "9.1.2", name: "9.1.2 Evaluation of compliance" },
    { id: "9.2", name: "9.2 Internal audit", isHeading: true },
    { id: "9.2.1", name: "9.2.1 General" },
    { id: "9.2.2", name: "9.2.2 Internal audit programme" },
    { id: "9.3", name: "9.3 Management review" },
    { id: "10", name: "10 IMPROVEMENT", isHeading: true },
    { id: "10.1", name: "10.1 General" },
    { id: "10.2", name: "10.2 Nonconformity & corrective action" },
    { id: "10.3", name: "10.3 Continual improvement" },
];

const AuditPrograms = () => {
    const [view, setView] = useState<"list" | "create" | "edit" | "view">("list");
    const [auditPrograms, setAuditPrograms] = useState<any[]>([]);
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [showSchedule, setShowSchedule] = useState(false);
    const [loading, setLoading] = useState(false);
    const [sites, setSites] = useState<any[]>([]);
    const [auditors, setAuditors] = useState<any[]>([]);

    // Search and Filter states
    const [searchQuery, setSearchQuery] = useState("");
    const [standardFilter, setStandardFilter] = useState("all");
    const [siteFilter, setSiteFilter] = useState("all");

    // Form state
    const [currentId, setCurrentId] = useState<number | null>(null);
    const [auditName, setAuditName] = useState("");
    const [selectedStandard, setSelectedStandard] = useState("");
    const [frequency, setFrequency] = useState("Bi-annually");
    const [duration, setDuration] = useState(3);
    const [selectedSite, setSelectedSite] = useState("");
    const [selectedAuditors, setSelectedAuditors] = useState<string[]>([]);
    const [leadAuditorId, setLeadAuditorId] = useState<string | null>(null);
    const [selectedCells, setSelectedCells] = useState<Record<string, boolean>>({});

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

    useEffect(() => {
        const fetchData = async () => {
            try {
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                const [sitesRes, usersRes, programsRes] = await Promise.all([
                    fetch("${API_BASE_URL}/api/sites"),
                    fetch(`${API_BASE_URL}/api/users?creatorId=${user.id}`), // Scope users as well or maybe fetch all depending on req, let's keep it safe
                    fetch(`${API_BASE_URL}/api/audit-programs?userId=${user.id}`)
                ]);
                const sitesData = sitesRes.ok ? await sitesRes.json() : [];
                const usersData = usersRes.ok ? await usersRes.json() : [];
                const programsData = programsRes.ok ? await programsRes.json() : [];

                setSites(Array.isArray(sitesData) ? sitesData : []);
                setAuditors(Array.isArray(usersData) ? usersData : []);
                setAuditPrograms(Array.isArray(programsData) ? programsData : []);

                if (!sitesRes.ok || !usersRes.ok || !programsRes.ok) {
                    toast.error("Some data failed to load from server");
                }
            } catch (error) {
                console.error("Failed to fetch data:", error);
                toast.error("Failed to load data from server");
            }
        };
        fetchData();
    }, []);

    const fetchPrograms = async () => {
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const res = await fetch(`${API_BASE_URL}/api/audit-programs?userId=${user.id}`);
            if (res.ok) {
                const data = await res.json();
                setAuditPrograms(Array.isArray(data) ? data : []);
            } else {
                toast.error("Failed to refresh audit programs");
                setAuditPrograms([]);
            }
        } catch (error) {
            console.error("Failed to fetch programs:", error);
        }
    };

    const filteredAuditPrograms = (Array.isArray(auditPrograms) ? auditPrograms : []).filter(program => {
        const matchesSearch = program.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStandard = standardFilter === "all" || program.isoStandard === standardFilter;
        const matchesSite = siteFilter === "all" || program.siteId?.toString() === siteFilter;
        return matchesSearch && matchesStandard && matchesSite;
    });

    const totalPages = Math.ceil(filteredAuditPrograms.length / itemsPerPage);
    const paginatedPrograms = filteredAuditPrograms.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Reset page to 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, standardFilter, siteFilter]);

    // Dynamic period generation based on duration and frequency
    const calculatePeriods = (frequencyVal = frequency, durationVal = duration) => {
        const count = frequencyVal === "Monthly" ? durationVal * 12 :
            frequencyVal === "Quarterly" ? durationVal * 4 :
                frequencyVal === "Bi-annually" ? durationVal * 2 :
                    durationVal; // Annually

        const result = [];
        const currentDate = new Date(2026, 1, 1); // Start from Feb 2026

        for (let i = 0; i < count; i++) {
            const monthLabel = currentDate.toLocaleString('default', { month: 'short' }).toUpperCase();
            const yearLabel = currentDate.getFullYear().toString().slice(-2);
            result.push({
                label: `${monthLabel} ${yearLabel}`
            });

            if (frequencyVal === "Monthly") currentDate.setMonth(currentDate.getMonth() + 1);
            else if (frequencyVal === "Quarterly") currentDate.setMonth(currentDate.getMonth() + 3);
            else if (frequencyVal === "Bi-annually") currentDate.setMonth(currentDate.getMonth() + 6);
            else currentDate.setFullYear(currentDate.getFullYear() + 1);
        }
        return result;
    };

    const periods = calculatePeriods();

    const isPeriodActive = (colIndex: number) => {
        return Object.keys(selectedCells).some(key => {
            const parts = key.split("-");
            return parts[1] === colIndex.toString() && selectedCells[key];
        });
    };

    const handleGenerateSchedule = () => {
        if (!auditName || !selectedStandard || !selectedSite) {
            toast.error("Please fill in Audit Name, Standard and Site");
            return;
        }
        setShowSchedule(true);
        toast.success("Schedule updated!");
    };

    const toggleCell = (row: number, col: number) => {
        if (CLAUSES[row].isHeading || view === "view") return;
        const key = `${row}-${col}`;
        setSelectedCells(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const handleSaveProgram = async () => {
        setLoading(true);
        const url = view === "edit" ? `${API_BASE_URL}/api/audit-programs/${currentId}` : "${API_BASE_URL}/api/audit-programs";
        const method = view === "edit" ? "PUT" : "POST";

        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: auditName,
                    isoStandard: selectedStandard,
                    frequency,
                    duration,
                    siteId: selectedSite,
                    auditorIds: selectedAuditors,
                    leadAuditorId: leadAuditorId,
                    scheduleData: selectedCells,
                    userId: user.id
                })
            });

            if (response.ok) {
                toast.success(view === "edit" ? "Audit Program updated!" : "Audit Program created!");
                await fetchPrograms();
                setView("list");
                resetForm();
            } else {
                toast.error("Failed to save Audit Program");
            }
        } catch (error) {
            console.error("Save error:", error);
            toast.error("An error occurred while saving");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteProgram = async () => {
        if (!deleteId) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/audit-programs/${deleteId}`, { method: "DELETE" });
            if (res.ok) {
                toast.success("Program deleted");
                await fetchPrograms();
            }
        } catch (error) {
            toast.error("Failed to delete program");
        } finally {
            setIsDeleteDialogOpen(false);
            setDeleteId(null);
        }
    };

    const handleEditProgram = (program: any) => {
        setCurrentId(program.id);
        setAuditName(program.name);
        setSelectedStandard(program.isoStandard);
        setFrequency(program.frequency);
        setDuration(program.duration);
        setSelectedSite(program.siteId.toString());
        setSelectedAuditors(program.auditors.map((a: any) => a.id.toString()));
        setLeadAuditorId(program.leadAuditorId?.toString() || null);
        setSelectedCells(program.scheduleData || {});
        setShowSchedule(true);
        setView("edit");
    };

    const handleViewProgram = (program: any) => {
        setCurrentId(program.id);
        setAuditName(program.name);
        setSelectedStandard(program.isoStandard);
        setFrequency(program.frequency);
        setDuration(program.duration);
        setSelectedSite(program.siteId.toString());
        setSelectedAuditors(program.auditors.map((a: any) => a.id.toString()));
        setLeadAuditorId(program.leadAuditorId?.toString() || null);
        setSelectedCells(program.scheduleData || {});
        setShowSchedule(true);
        setView("view");
    };

    const resetForm = () => {
        setCurrentId(null);
        setAuditName("");
        setSelectedStandard("");
        setFrequency("Bi-annually");
        setDuration(3);
        setSelectedSite("");
        setSelectedAuditors([]);
        setLeadAuditorId(null);
        setSelectedCells({});
        setShowSchedule(false);
    };

    const getSelectedClausesList = () => {
        const result: { clause: Clause; periods: string[] }[] = [];
        CLAUSES.forEach((clause, rowIndex) => {
            const activePeriods: string[] = [];
            periods.forEach((period, colIndex) => {
                if (selectedCells[`${rowIndex}-${colIndex}`]) {
                    activePeriods.push(period.label);
                }
            });
            if (activePeriods.length > 0) {
                result.push({ clause, periods: activePeriods });
            }
        });
        return result;
    };

    const selectedClausesList = getSelectedClausesList();

    const handleDownloadPDF = async (program: any) => {
        const doc = new jsPDF();
        const programPeriods = calculatePeriods(program.frequency, program.duration);

        // Add Logo
        try {
            const response = await fetch("/iAudit Global-01.png");
            const blob = await response.blob();
            const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
            });
            doc.addImage(base64, 'PNG', 14, 10, 25, 25);
        } catch (error) {
            console.error("Failed to load logo for PDF", error);
        }

        // Title
        doc.setFontSize(20);
        doc.setTextColor(40, 40, 40);
        doc.text("Audit Program Schedule", 14, 45); // Moved down

        // Metadata
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text(`Program Name: ${program.name}`, 14, 55);
        doc.text(`Standard: ${program.isoStandard}`, 14, 61);
        doc.text(`Frequency: ${program.frequency}`, 14, 67);
        doc.text(`Site: ${program.site?.name || "N/A"}`, 14, 73);

        // Prepare table data
        const tableHead = [["Clause", ...programPeriods.map(p => p.label)]];
        const tableBody: any[] = [];

        CLAUSES.forEach((clause, rowIndex) => {
            const row: any[] = [clause.name];
            programPeriods.forEach((_, colIndex) => {
                const key = `${rowIndex}-${colIndex}`;
                // Check if this exact cell is selected in the program's scheduleData
                const isSelected = program.scheduleData && program.scheduleData[key];
                row.push(isSelected ? "X" : "");
            });
            tableBody.push(row);
        });

        // Generate Table
        autoTable(doc, {
            startY: 85, // Moved down to accommodate logo and metadata
            head: tableHead,
            body: tableBody,
            theme: 'grid',
            headStyles: {
                fillColor: [16, 185, 129], // Emerald-500
                textColor: [0, 0, 0], // Black text
                fontStyle: 'bold'
            },
            styles: { fontSize: 8, cellPadding: 2 },
            columnStyles: {
                0: { cellWidth: 60, fontStyle: 'bold' } // Clause column
            },
            didParseCell: (data) => {
                // Highlight heading rows
                const rowIndex = data.row.index;
                if (CLAUSES[rowIndex] && CLAUSES[rowIndex].isHeading) {
                    data.cell.styles.fillColor = [241, 245, 249]; // Slate-100
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        });

        doc.save(`${program.name.replace(/\s+/g, '_')}_Schedule.pdf`);
        toast.success("PDF downloaded successfully");
    };

    const handleDownloadWord = async (program: any) => {
        const programPeriods = calculatePeriods(program.frequency, program.duration);
        // Fetch logo image for Docx
        let logoBuffer: ArrayBuffer | null = null;
        try {
            const response = await fetch("/iAudit Global-01.png");
            logoBuffer = await response.arrayBuffer();
        } catch (error) {
            console.error("Failed to fetch logo for Word doc:", error);
        }

        // Create table header row
        const headerCells = [
            new DocxTableCell({
                children: [new Paragraph({ text: "Clause", style: "strong" })],
                width: { size: 4000, type: WidthType.DXA },
            }),
            ...programPeriods.map(p => new DocxTableCell({
                children: [new Paragraph({ text: p.label, style: "strong", alignment: AlignmentType.CENTER })],
                width: { size: 1000, type: WidthType.DXA },
            }))
        ];

        // Create table body rows
        const bodyRows = CLAUSES.map((clause, rowIndex) => {
            const cells = [
                new DocxTableCell({
                    children: [new Paragraph({ text: clause.name })],
                    shading: clause.isHeading ? { fill: "F1F5F9" } : undefined
                })
            ];

            programPeriods.forEach((_, colIndex) => {
                const key = `${rowIndex}-${colIndex}`;
                const isSelected = program.scheduleData && program.scheduleData[key];
                cells.push(new DocxTableCell({
                    children: [new Paragraph({
                        text: isSelected ? "X" : "",
                        alignment: AlignmentType.CENTER
                    })],
                    shading: clause.isHeading ? { fill: "F1F5F9" } : undefined
                }));
            });

            return new DocxTableRow({ children: cells });
        });

        const table = new DocxTable({
            rows: [
                new DocxTableRow({ children: headerCells, tableHeader: true }),
                ...bodyRows
            ],
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
                left: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
                right: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
                insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
                insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
            }
        });

        const children: any[] = [];

        // Add Logo if available
        if (logoBuffer) {
            children.push(new Paragraph({
                children: [
                    new ImageRun({
                        data: logoBuffer,
                        transformation: {
                            width: 80,
                            height: 80,
                        },
                    }),
                ],
                spacing: { after: 200 }
            }));
        }

        children.push(
            new Paragraph({
                text: "Audit Program Schedule",
                heading: HeadingLevel.HEADING_1,
                spacing: { after: 200 }
            }),
            new Paragraph({ text: `Program Name: ${program.name}` }),
            new Paragraph({ text: `Standard: ${program.isoStandard}` }),
            new Paragraph({ text: `Frequency: ${program.frequency}` }),
            new Paragraph({ text: `Site: ${program.site?.name || "N/A"}`, spacing: { after: 400 } }),
            table
        );

        const doc = new Document({
            sections: [{
                properties: {},
                children: children,
            }],
        });

        Packer.toBlob(doc).then((blob) => {
            saveAs(blob, `${program.name.replace(/\s+/g, '_')}_Schedule.docx`);
            toast.success("Word document downloaded successfully");
        });
    };

    // Dynamic grid column sizing: reduce width as periods increase
    // Use minmax to ensure they don't get TOO small, but shrink them
    const getGridColsStyle = () => {
        const colWidth = periods.length > 12 ? '70px' : periods.length > 6 ? '90px' : '110px';
        return {
            gridTemplateColumns: `minmax(250px, 1fr) repeat(${periods.length}, ${colWidth})`
        };
    };

    return (
        <div className="flex-1 space-y-8 p-8 pt-6 min-h-screen bg-white">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">Audit Program</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Plan and schedule your ISO audits across multiple periods.
                    </p>
                </div>
                {view === "list" && (
                    <Button
                        onClick={() => { resetForm(); setView("create"); }}
                        className="bg-[#213847] hover:bg-[#213847]/90 text-white gap-2 rounded-xl h-11 px-5 shadow-sm font-semibold"
                    >
                        <Plus className="w-4 h-4" /> Create Audit Program
                    </Button>
                )}
            </div>

            {view === "list" ? (
                <>
                    <div className="flex flex-col sm:flex-row gap-4 mb-6">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search audit programs..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 bg-white border-slate-200 h-11 rounded-xl focus-visible:ring-[#213847]"
                            />
                        </div>
                        <Select value={standardFilter} onValueChange={setStandardFilter}>
                            <SelectTrigger className="w-full sm:w-[240px] bg-white border-slate-200 h-11 rounded-xl">
                                <SelectValue placeholder="All Standards" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Standards</SelectItem>
                                {ISO_STANDARDS.map(std => (
                                    <SelectItem key={std} value={std}>{std.split(' - ')[0]}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={siteFilter} onValueChange={setSiteFilter}>
                            <SelectTrigger className="w-full sm:w-[200px] bg-white border-slate-200 h-11 rounded-xl">
                                <SelectValue placeholder="All Sites" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Sites</SelectItem>
                                {sites.map(site => (
                                    <SelectItem key={site.id} value={site.id.toString()}>{site.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <Card className="border border-muted shadow-sm overflow-hidden bg-white rounded-xl">
                        <CardContent className="p-0 bg-white">
                            <Table>
                                <TableHeader className="bg-[#213847]">
                                    <TableRow className="hover:bg-transparent border-none">
                                        <TableHead className="w-[80px] font-bold text-xs uppercase tracking-wider text-white pl-6 text-center">Sl No.</TableHead>
                                        <TableHead className="font-bold text-xs uppercase tracking-wider text-white">Program Name</TableHead>
                                        <TableHead className="font-bold text-xs uppercase tracking-wider text-white">ISO Standard</TableHead>
                                        <TableHead className="font-bold text-xs uppercase tracking-wider text-white">Site</TableHead>
                                        <TableHead className="font-bold text-xs uppercase tracking-wider text-white text-center">Periods</TableHead>
                                        <TableHead className="w-[100px] font-bold text-xs uppercase tracking-wider text-white text-right pr-6">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredAuditPrograms.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-64 text-center">
                                                <div className="flex flex-col items-center justify-center space-y-3">
                                                    <div className="w-16 h-16 bg-slate-100 rounded-[2rem] flex items-center justify-center text-slate-400 mb-2">
                                                        <FileText className="w-8 h-8" />
                                                    </div>
                                                    <p className="text-lg font-bold text-slate-900">No audit programs yet</p>
                                                    <p className="text-sm text-slate-500 max-w-sm mx-auto">Create your first audit program to begin scheduling audits.</p>
                                                    <Button
                                                        onClick={() => { resetForm(); setView("create"); }}
                                                        className="bg-[#213847] hover:bg-[#213847]/90 text-white font-bold rounded-xl h-11 px-6 shadow-sm mt-4 gap-2"
                                                    >
                                                        <Plus className="w-4 h-4" /> Create Program
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        paginatedPrograms.map((program, idx) => (
                                            <TableRow key={program.id} className="hover:bg-muted/20 border-muted/30 transition-colors group">
                                                <TableCell className="text-center text-sm font-medium text-muted-foreground/60 pl-6">{(currentPage - 1) * itemsPerPage + idx + 1}</TableCell>
                                                <TableCell className="font-bold text-foreground group-hover:text-blue-600 transition-colors uppercase">{program.name}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="text-[10px] font-medium py-0 h-4 bg-blue-50 border-blue-200 text-blue-700 lowercase">
                                                        {program.isoStandard.split("-")[0]}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-sm text-foreground font-medium">{program.site?.name || "N/A"}</TableCell>
                                                <TableCell className="text-center font-bold text-emerald-600">
                                                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                                                        {Object.keys(program.scheduleData || {}).length > 0 ? "Configured" : "Not Set"}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right pr-6">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                                <span className="sr-only">Open menu</span>
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem
                                                                onClick={() => handleViewProgram(program)}
                                                                className="cursor-pointer"
                                                            >
                                                                <Eye className="mr-2 h-4 w-4" />
                                                                View Details
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                onClick={() => handleEditProgram(program)}
                                                                className="cursor-pointer"
                                                            >
                                                                <Edit className="mr-2 h-4 w-4" />
                                                                Edit Program
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                onClick={() => handleDownloadPDF(program)}
                                                                className="cursor-pointer"
                                                            >
                                                                <FileText className="mr-2 h-4 w-4" />
                                                                Download PDF
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                onClick={() => handleDownloadWord(program)}
                                                                className="cursor-pointer"
                                                            >
                                                                <FileText className="mr-2 h-4 w-4" />
                                                                Download Word
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                onClick={() => { setDeleteId(program.id); setIsDeleteDialogOpen(true); }}
                                                                className="text-red-600 cursor-pointer focus:text-red-600"
                                                            >
                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                Delete
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                    <ReusablePagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={filteredAuditPrograms.length}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                        className="mt-4"
                    />
                </>
            ) : (
                <>
                    <div className="flex items-center gap-4 mb-2">
                        <Button variant="ghost" size="sm" className="gap-2 text-slate-500" onClick={() => setView("list")}>
                            <ArrowLeft className="w-4 h-4" /> Back to List
                        </Button>
                    </div>
                    <Card className="border-none shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                        <CardHeader>
                            <CardTitle className="text-lg font-semibold">
                                {view === "edit" ? "Edit Audit Program" : view === "view" ? "View Audit Program" : "Create Audit Program"}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            <div className="space-y-2">
                                <Label htmlFor="audit-name">Audit Name</Label>
                                <Input
                                    id="audit-name"
                                    placeholder="E.g. Annual Quality Audit"
                                    className="bg-white border-slate-200"
                                    value={auditName}
                                    onChange={(e) => setAuditName(e.target.value)}
                                    disabled={view === "view"}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>ISO Standard</Label>
                                <Select onValueChange={setSelectedStandard} value={selectedStandard} disabled={view === "view"}>
                                    <SelectTrigger className="bg-white border-slate-200">
                                        <SelectValue placeholder="Select ISO standard" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ISO_STANDARDS.map((std) => (
                                            <SelectItem key={std} value={std}>
                                                {std}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Frequency</Label>
                                <Select onValueChange={setFrequency} value={frequency} disabled={view === "view"}>
                                    <SelectTrigger className="bg-white border-slate-200">
                                        <SelectValue placeholder="Select frequency" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {FREQUENCIES.map((freq) => (
                                            <SelectItem key={freq} value={freq}>
                                                {freq}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="duration">Duration (Years)</Label>
                                <Input
                                    id="duration"
                                    type="number"
                                    className="bg-white border-slate-200"
                                    value={duration}
                                    onChange={(e) => setDuration(parseInt(e.target.value))}
                                    disabled={view === "view"}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Site</Label>
                                <Select onValueChange={setSelectedSite} value={selectedSite} disabled={view === "view"}>
                                    <SelectTrigger className="bg-white border-slate-200">
                                        <SelectValue placeholder="Select site" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {sites.map((site) => (
                                            <SelectItem key={site.id} value={site.id.toString()}>
                                                {site.name} ({site.company?.name})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Auditors</Label>
                                <Select
                                    onValueChange={(val) => {
                                        if (!selectedAuditors.includes(val)) {
                                            setSelectedAuditors(prev => [...prev, val]);
                                            if (selectedAuditors.length === 0) setLeadAuditorId(val);
                                        }
                                    }}
                                    disabled={view === "view"}
                                >
                                    <SelectTrigger className="bg-white border-slate-200">
                                        <SelectValue placeholder="Select auditors" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {auditors.map((user) => (
                                            <SelectItem key={user.id} value={user.id.toString()}>
                                                {user.firstName} {user.lastName}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {selectedAuditors.map(id => {
                                        const auditor = auditors.find(a => a.id.toString() === id);
                                        const isLead = leadAuditorId === id;
                                        return auditor ? (
                                            <Badge
                                                key={id}
                                                variant={isLead ? "default" : "secondary"}
                                                className={cn(
                                                    "text-[10px] pl-1.5 pr-1 items-center gap-1 group transition-all",
                                                    isLead ? "bg-amber-100 text-amber-900 border-amber-300" : ""
                                                )}
                                            >
                                                {isLead && <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />}
                                                {auditor.firstName}
                                                {isLead && <span className="text-[8px] font-bold opacity-70 uppercase tracking-tight ml-0.5">Lead</span>}
                                                {view !== "view" && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedAuditors(prev => prev.filter(aid => aid !== id));
                                                            if (isLead) setLeadAuditorId(null);
                                                        }}
                                                        className="ml-1 hover:text-red-500 opacity-50 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        ×
                                                    </button>
                                                )}
                                            </Badge>
                                        ) : null;
                                    })}
                                </div>

                                {selectedAuditors.length > 1 && (
                                    <div className="mt-4 p-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-300">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                                                <Star className="w-4 h-4 text-amber-600 fill-amber-600" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-slate-800">Designate Lead Auditor</h4>
                                                <p className="text-[11px] text-slate-500">Pick the main auditor in charge for this program</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                                            {selectedAuditors.map(id => {
                                                const auditor = auditors.find(a => a.id.toString() === id);
                                                const isLead = leadAuditorId === id;
                                                return auditor ? (
                                                    <button
                                                        key={id}
                                                        type="button"
                                                        onClick={() => view !== "view" && setLeadAuditorId(id)}
                                                        disabled={view === "view"}
                                                        className={cn(
                                                            "flex items-center justify-between p-2.5 rounded-lg border transition-all text-left group/btn",
                                                            isLead
                                                                ? "bg-amber-50 border-amber-400 ring-1 ring-amber-400 shadow-sm"
                                                                : "bg-white border-slate-200 hover:border-amber-200 hover:bg-amber-50/30"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-2 overflow-hidden text-ellipsis">
                                                            <div className={cn(
                                                                "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors",
                                                                isLead ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-600 group-hover/btn:bg-amber-100 group-hover/btn:text-amber-700"
                                                            )}>
                                                                {auditor.firstName[0]}{auditor.lastName[0]}
                                                            </div>
                                                            <span className={cn(
                                                                "text-sm font-semibold truncate transition-colors",
                                                                isLead ? "text-amber-950" : "text-slate-700 group-hover/btn:text-amber-900"
                                                            )}>
                                                                {auditor.firstName} {auditor.lastName}
                                                            </span>
                                                        </div>
                                                        {isLead ? (
                                                            <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                                                                <Check className="w-3 h-3 text-white" />
                                                            </div>
                                                        ) : (
                                                            <div className="w-5 h-5 rounded-full border border-slate-200 group-hover/btn:border-amber-300 shrink-0" />
                                                        )}
                                                    </button>
                                                ) : null;
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                        {view !== "view" && (
                            <div className="px-6 pb-6">
                                <Button
                                    className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-2 h-auto rounded-lg font-semibold transition-all shadow-sm"
                                    onClick={handleGenerateSchedule}
                                >
                                    Generate Schedule
                                </Button>
                            </div>
                        )}
                    </Card>

                    {showSchedule && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* Program Timeline */}
                            <Card className="border-none shadow-sm overflow-hidden bg-white">
                                <CardHeader className="flex flex-row items-center gap-4 pb-2">
                                    <div className="p-2.5 bg-emerald-50 rounded-xl">
                                        <Calendar className="w-5 h-5 text-emerald-600" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg font-bold text-slate-800">Program Timeline</CardTitle>
                                        <div className="text-[11px] font-medium text-slate-500 flex items-center gap-2 mt-0.5">
                                            <span>{duration} Years</span> • <span>{frequency} Frequency</span> • <span>{periods.length} Periods</span>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-8 pb-10 relative overflow-x-auto scrollbar-thin pb-12">
                                    <div className="min-w-fit px-6">
                                        <div className="relative pt-4 pb-4">
                                            <div className="absolute top-[32px] left-0 right-0 h-[3px] bg-slate-100 z-0 rounded-full" />
                                            <div className="flex justify-between items-center relative z-10 gap-8">
                                                {periods.map((period, idx) => {
                                                    const dotActive = isPeriodActive(idx);
                                                    return (
                                                        <div key={idx} className="flex flex-col items-center gap-4 shrink-0">
                                                            <div className={cn(
                                                                "w-[18px] h-[18px] rounded-full border-[3px] border-white shadow-md ring-[6px] transition-all duration-300",
                                                                dotActive ? "bg-emerald-500 ring-emerald-50" : "bg-slate-300 ring-slate-50"
                                                            )} />
                                                            <div className="flex flex-col items-center">
                                                                <span className={cn(
                                                                    "text-[10px] font-bold uppercase tracking-widest whitespace-nowrap",
                                                                    dotActive ? "text-emerald-600" : "text-slate-400"
                                                                )}>{period.label}</span>
                                                                <div className={cn(
                                                                    "mt-2 w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shadow-sm transition-all",
                                                                    dotActive ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400"
                                                                )}>
                                                                    {Object.keys(selectedCells).filter(k => k.endsWith(`-${idx}`) && selectedCells[k]).length}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="space-y-4">
                                <Badge variant="outline" className="px-4 py-1.5 rounded-full border-emerald-200 text-emerald-700 bg-white font-bold text-[10px] tracking-wide shadow-sm hover:bg-white transition-none uppercase">
                                    {selectedStandard || "ISO 9001:2015 - Quality Management System"}
                                </Badge>

                                <div className="overflow-x-auto scrollbar-thin border rounded-xl bg-white shadow-sm">
                                    <div className="grid gap-x-0.5 gap-y-0.5 p-1 min-w-max" style={getGridColsStyle()}>
                                        <div className="sticky left-0 bg-white z-20 h-8 flex items-end px-3 pb-1 text-[10px] font-bold text-slate-400 border-r border-slate-100">CLAUSE NAME</div>
                                        {periods.map((p, i) => (
                                            <div key={i} className="h-8 flex items-end justify-center text-[10px] font-bold text-slate-400 pb-1">
                                                {p.label}
                                            </div>
                                        ))}

                                        {CLAUSES.map((clause, rowIndex) => (
                                            <React.Fragment key={clause.id}>
                                                <div className={cn(
                                                    "flex items-center text-[11px] py-1.5 px-3 rounded-lg sticky left-0 z-10 border-r border-slate-100",
                                                    clause.isHeading ? "bg-slate-700 text-white font-black mt-1" : "bg-white font-semibold text-slate-600 pl-6"
                                                )}>
                                                    {clause.name}
                                                </div>
                                                {periods.map((_, colIndex) => {
                                                    const isChecked = selectedCells[`${rowIndex}-${colIndex}`];
                                                    return (
                                                        <div
                                                            key={colIndex}
                                                            onClick={() => toggleCell(rowIndex, colIndex)}
                                                            className={cn(
                                                                "rounded-md border h-8 flex items-center justify-center cursor-pointer transition-all duration-200",
                                                                clause.isHeading ? "bg-slate-50/50 border-transparent cursor-default pointer-events-none" : (
                                                                    isChecked
                                                                        ? "bg-emerald-100 border-emerald-400 text-emerald-600 shadow-sm"
                                                                        : "bg-white border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 hover:shadow-inner"
                                                                )
                                                            )}
                                                        >
                                                            {!clause.isHeading && isChecked && (
                                                                <div className="animate-in zoom-in-75 duration-200">
                                                                    <Check className="w-4 h-4 stroke-[4px]" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </React.Fragment>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Dynamic Clauses Selection Display */}
                            {selectedClausesList.length > 0 && (
                                <div className="space-y-4 pt-10 border-t border-slate-200">
                                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                        Selected Audit Schedule
                                    </h3>
                                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                        {selectedClausesList.map((item, idx) => (
                                            <Card key={idx} className="border-none shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
                                                <div className="h-1 bg-emerald-500 w-0 group-hover:w-full transition-all duration-500" />
                                                <CardContent className="p-4">
                                                    <div className="text-[12px] font-bold text-slate-800 leading-tight mb-3">
                                                        {item.clause.name}
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {item.periods.map(p => (
                                                            <Badge key={p} className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-100 text-[9px] font-bold tracking-wider">
                                                                {p}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {view !== "view" && (
                                <div className="pt-10 flex justify-end">
                                    <Button
                                        className="bg-slate-900 hover:bg-slate-800 text-white px-10 py-6 h-auto rounded-xl font-bold text-lg gap-3 shadow-lg hover:shadow-xl transition-all active:scale-95"
                                        onClick={handleSaveProgram}
                                        disabled={loading || selectedClausesList.length === 0}
                                    >
                                        {loading ? (
                                            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <>
                                                <Save className="w-6 h-6" />
                                                {view === "edit" ? "Update Program" : "Create Program"}
                                            </>
                                        )}
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the audit program
                            and remove all associated schedule data.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => { setIsDeleteDialogOpen(false); setDeleteId(null); }}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteProgram} className="bg-red-600 hover:bg-red-700 text-white">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div >
    );
};

export default AuditPrograms;
