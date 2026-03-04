import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { API_BASE_URL } from "@/config";
import { TopNav } from "@/components/TopNav";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Calendar, ClipboardCheck, Sparkles, ArrowRight, LayoutDashboard,
    Globe, LayoutGrid, List, MoreVertical, FileText, Trash2, Download, Eye, Edit
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Document, Packer, Paragraph, TextRun, ImageRun } from "docx";
import { saveAs } from "file-saver";
import logoImg from "@/assets/logo.png";
import { auditTemplates } from "@/data/auditTemplates";
import { CLAUSE_MATRIX, ClauseMatrixRow } from "@/data/clauseMapping";

interface Clause {
    id: string;
    name: string;
    isHeading?: boolean;
}

// CLAUSES array removed in favor of imported CLAUSE_MATRIX

const AuditProgramPage = () => {
    const [sites, setSites] = useState<any[]>([]);
    const [auditPrograms, setAuditPrograms] = useState<any[]>([]);
    const [auditPlans, setAuditPlans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<"card" | "list">("card");
    const [activeSiteId, setActiveSiteId] = useState<string>("");
    const navigate = useNavigate();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                const [sitesRes, programsRes, plansRes] = await Promise.all([
                    fetch(`${API_BASE_URL}/api/sites?userId=${user.id}`),
                    fetch(`${API_BASE_URL}/api/audit-programs?userId=${user.id}`),
                    fetch(`${API_BASE_URL}/api/audit-plans?userId=${user.id}`)
                ]);
                const sitesData = await sitesRes.json();
                const programsData = await programsRes.json();
                const plansData = await plansRes.json();

                const validSites = Array.isArray(sitesData) ? sitesData : [];
                const validPrograms = Array.isArray(programsData) ? programsData : [];
                const validPlans = Array.isArray(plansData) ? plansData : [];

                setSites(validSites);
                setAuditPrograms(validPrograms);
                setAuditPlans(validPlans);

                // Set first site as default if activeSiteId is not set
                if (validSites.length > 0) {
                    setActiveSiteId(validSites[0].id.toString());
                }
            } catch (error) {
                console.error("Failed to fetch data:", error);
                toast.error("Failed to load data");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const calculatePeriods = (frequency: string, duration: number) => {
        const count = frequency === "Monthly" ? duration * 12 :
            frequency === "Quarterly" ? duration * 4 :
                frequency === "Bi-annually" ? duration * 2 :
                    duration;

        const result = [];
        const currentDate = new Date(2026, 0, 1); // Start in January 2026

        for (let i = 0; i < count; i++) {
            const monthLabel = currentDate.toLocaleString('default', { month: 'short' }).toUpperCase();
            const yearLabel = currentDate.getFullYear().toString();
            result.push(`${monthLabel} ${yearLabel}`);

            if (frequency === "Monthly") currentDate.setMonth(currentDate.getMonth() + 1);
            else if (frequency === "Quarterly") currentDate.setMonth(currentDate.getMonth() + 3);
            else if (frequency === "Bi-annually") currentDate.setMonth(currentDate.getMonth() + 6);
            else currentDate.setFullYear(currentDate.getFullYear() + 1);
        }
        return result;
    };

    const getAuditExecutions = (program: any) => {
        const programPeriods = calculatePeriods(program.frequency, program.duration);
        const executions: any[] = [];
        const isoStandard = program.isoStandard || "";
        const is9001 = isoStandard.includes("9001");
        const is14001 = isoStandard.includes("14001");
        const is45001 = isoStandard.includes("45001");

        programPeriods.forEach((periodLabel, colIndex) => {
            const selectedClauses: Clause[] = [];
            CLAUSE_MATRIX.forEach((matrixRow, rowIndex) => {
                if (program.scheduleData?.[`${rowIndex}-${colIndex}`]) {
                    let clauseName = "";
                    if (is9001) clauseName = matrixRow.iso9001;
                    else if (is14001) clauseName = matrixRow.iso14001;
                    else if (is45001) clauseName = matrixRow.iso45001;
                    else clauseName = matrixRow.iso14001; // Default to 14001 as fallback for naming

                    if (clauseName && clauseName !== "Corresponding Clause does not exist") {
                        selectedClauses.push({
                            id: matrixRow.id,
                            name: clauseName,
                            isHeading: matrixRow.isHeading
                        });
                    }
                }
            });

            // If clauses were selected, add them
            if (selectedClauses.length > 0) {
                const executionId = `${program.name} - ${periodLabel}`;
                executions.push({
                    id: executionId,
                    programId: program.id,
                    title: executionId,
                    period: periodLabel,
                    clauseCount: selectedClauses.length,
                    clauses: selectedClauses,
                    site: sites.find(s => s.id === program.siteId)
                });
            } else {
                // FALLBACK: If no clauses selected for this SPECIFIC period but it exists in the cycle,
                // we still create a card for it so the user sees every month.
                // For the fallback, we'll list all non-heading clauses from 14001 as a general reference
                const fallbackClauses = CLAUSE_MATRIX
                    .filter(cm => !cm.isHeading)
                    .map(cm => ({
                        id: cm.id,
                        name: is9001 ? cm.iso9001 : (is45001 ? cm.iso45001 : cm.iso14001),
                        isHeading: false
                    }))
                    .filter(c => c.name !== "Corresponding Clause does not exist");

                const executionId = `${program.name} - ${periodLabel}`;
                executions.push({
                    id: executionId,
                    programId: program.id,
                    title: executionId,
                    period: periodLabel,
                    clauseCount: fallbackClauses.length,
                    clauses: fallbackClauses,
                    site: sites.find(s => s.id === program.siteId)
                });
            }
        });

        return executions;
    };

    const hasPlan = (programId: number, executionId: string) => {
        return (auditPlans || []).some(p => p.auditProgramId === programId && p.executionId === executionId);
    };

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

    const handleDownloadPDF = async (plan: any, executionTitle: string, program?: any) => {
        const doc = new jsPDF();

        // Add Logo - compressed via canvas to prevent huge file sizes
        try {
            const response = await fetch("/iAudit Global-01.png");
            const blob = await response.blob();
            const base64Compressed = await new Promise<string>((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    // Max 120x120px, 60% JPEG quality
                    const MAX = 120;
                    const canvas = document.createElement("canvas");
                    let { width, height } = img;
                    if (width > MAX || height > MAX) {
                        if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
                        else { width = Math.round(width * MAX / height); height = MAX; }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL("image/jpeg", 0.6));
                };
                img.onerror = reject;
                img.src = URL.createObjectURL(blob);
            });
            doc.addImage(base64Compressed, 'JPEG', 20, 10, 25, 25);
        } catch (error) {
            console.error("Failed to load logo for PDF", error);
        }

        // Header
        doc.setFillColor(16, 185, 129); // Emerald 500
        doc.rect(0, 40, 210, 15, "F"); // Moved down and reduced height
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.text("Audit Plan", 20, 50);

        // Meta Info
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);

        const template = (auditTemplates || []).find(t => t.id === plan.templateId);

        // ISO Standards - show ALL selected standards (stored as comma-separated string)
        const standardsRaw: string = program?.isoStandard || plan.isoStandard || "";
        const standards: string[] = standardsRaw ? standardsRaw.split(", ").map((s: string) => s.trim()).filter(Boolean) : [];
        const standardsText = standards.length > 0 ? standards.join("  |  ") : "N/A";

        doc.text(`Execution: ${executionTitle}`, 20, 70);
        doc.text(`Audit Name: ${plan.auditName || plan.auditType || "N/A"}`, 20, 80);
        doc.text(`Date: ${plan.date ? new Date(plan.date).toLocaleDateString() : "TBD"}`, 120, 70);
        doc.text(`Location: ${plan.location || "N/A"}`, 120, 80);

        if (template) {
            doc.text(`Template: ${template.title}`, 20, 90);
        }

        // Render all selected ISO Standards
        doc.setFontSize(11);
        doc.setTextColor(16, 185, 129);
        doc.text("ISO Standards:", 20, 100);
        doc.setTextColor(60, 60, 60);
        const splitStandards = doc.splitTextToSize(standardsText, 170);
        doc.text(splitStandards, 20, 107);

        const offsetAfterStandards = 107 + splitStandards.length * 6;

        // Scope & Objective
        doc.setFontSize(14);
        doc.setTextColor(16, 185, 129);
        doc.text("Scope & Objective", 20, offsetAfterStandards + 8);

        doc.setTextColor(60, 60, 60);
        doc.setFontSize(10);
        const splitScope = doc.splitTextToSize(`Scope: ${plan.scope || "N/A"}`, 170);
        doc.text(splitScope, 20, offsetAfterStandards + 18);

        const splitObjective = doc.splitTextToSize(`Objective: ${plan.objective || "N/A"}`, 170);
        doc.text(splitObjective, 20, offsetAfterStandards + 18 + (splitScope.length * 5) + 5);

        // Itinerary Table
        const startY = offsetAfterStandards + 18 + (splitScope.length * 5) + (splitObjective.length * 5) + 20;

        doc.setFontSize(14);
        doc.setTextColor(16, 185, 129);
        doc.text("Audit Itinerary", 20, startY);

        const itineraryData = Array.isArray(plan.itinerary) ? plan.itinerary.map((item: any) => [
            `${item.startTime} - ${item.endTime}`,
            item.activity,
            item.notes || "-"
        ]) : [];

        autoTable(doc, {
            startY: startY + 10,
            head: [['Time', 'Activity', 'Objective']],
            body: itineraryData,
            headStyles: { fillColor: [16, 185, 129] },
        });

        doc.save(`Audit_Plan_${executionTitle.replace(/[^a-z0-9]/gi, '_')}.pdf`);
        toast.success("PDF Downloaded");
    };

    const handleDownloadDocx = async (plan: any, executionTitle: string, program?: any) => {
        // Fetch logo image for Docx - compressed via canvas to prevent huge file sizes
        let logoBuffer: ArrayBuffer | null = null;
        try {
            const response = await fetch("/iAudit Global-01.png");
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
                    canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
                    canvas.toBlob((compressedBlob) => {
                        if (compressedBlob) compressedBlob.arrayBuffer().then(resolve).catch(reject);
                        else reject(new Error("Canvas toBlob returned null"));
                    }, "image/jpeg", 0.6);
                };
                img.onerror = reject;
                img.src = URL.createObjectURL(blob);
            });
        } catch (error) {
            console.error("Failed to fetch logo for Word doc:", error);
        }

        const template = (auditTemplates || []).find(t => t.id === plan.templateId);
        const children: any[] = [];

        // ISO Standards - show ALL selected standards (stored as comma-separated string)
        const standardsRaw: string = program?.isoStandard || plan.isoStandard || "";
        const standards: string[] = standardsRaw ? standardsRaw.split(", ").map((s: string) => s.trim()).filter(Boolean) : [];


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
                children: [
                    new TextRun({
                        text: "Audit Plan",
                        bold: true,
                        size: 48,
                        color: "10B981"
                    }),
                ],
                spacing: { after: 400 }
            }),
            new Paragraph({
                children: [new TextRun({ text: `Execution: ${executionTitle}`, bold: true })]
            }),
            new Paragraph({
                children: [new TextRun({ text: `Audit Name: ${plan.auditName || plan.auditType || "N/A"}` })]
            })
        );

        if (template) {
            children.push(
                new Paragraph({
                    children: [new TextRun({ text: `Template: ${template.title}` })]
                })
            );
        }

        // Add all selected ISO Standards as separate lines
        if (standards.length > 0) {
            children.push(
                new Paragraph({
                    children: [new TextRun({ text: "ISO Standards:", bold: true, color: "10B981" })],
                    spacing: { before: 200 }
                }),
                ...standards.map(std => new Paragraph({
                    children: [new TextRun({ text: `• ${std}` })],
                }))
            );
        }

        children.push(
            new Paragraph({
                children: [new TextRun({ text: `Date: ${plan.date ? new Date(plan.date).toLocaleDateString() : "TBD"}` })]
            }),
            new Paragraph({
                children: [new TextRun({ text: `Location: ${plan.location || "N/A"}` })],
                spacing: { after: 200 }
            }),
            new Paragraph({
                children: [new TextRun({ text: "Scope:", bold: true, color: "10B981" })]
            }),
            new Paragraph({
                children: [new TextRun(plan.scope || "N/A")],
                spacing: { after: 200 }
            }),
            new Paragraph({
                children: [new TextRun({ text: "Objective:", bold: true, color: "10B981" })]
            }),
            new Paragraph({
                children: [new TextRun(plan.objective || "N/A")],
                spacing: { after: 400 }
            }),
            new Paragraph({
                children: [new TextRun({ text: "Itinerary", bold: true, size: 32, color: "10B981" })],
                spacing: { after: 200 }
            }),
            ...((plan.itinerary as any[]) || []).map(item => new Paragraph({
                children: [new TextRun({
                    text: `${item.startTime} - ${item.endTime}: ${item.activity} (${item.notes || ""})`
                })],
                bullet: { level: 0 }
            }))
        );

        const doc = new Document({
            sections: [{
                properties: {},
                children: children
            }]
        });

        Packer.toBlob(doc).then(blob => {
            saveAs(blob, `Audit_Plan_${executionTitle.replace(/[^a-z0-9]/gi, '_')}.docx`);
            toast.success("Word Document Downloaded");
        });
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                <p className="text-slate-500 font-medium animate-pulse text-sm">Synchronizing audit data...</p>
            </div>
        </div>
    );

    return (
        <div className="flex-1 space-y-8 p-8 pt-6 min-h-screen bg-white">
            <div className="w-full max-w-[1800px] mx-auto space-y-8 animate-in fade-in duration-500">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10 w-full">
                    <div className="space-y-1">
                        <h2 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
                            Audit Plans
                        </h2>
                        <p className="text-sm text-[#64748B] font-medium">
                            View and manage your audit plans and executions.
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex bg-[#F1F5F9] p-1 rounded-2xl border border-slate-100 shadow-sm">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setViewMode("list")}
                                className={cn(
                                    "w-12 h-12 rounded-xl transition-all duration-300",
                                    viewMode === "list" ? "bg-[#34967C] text-white shadow-md hover:bg-[#34967C]/90" : "text-[#1E293B] hover:bg-slate-200/50"
                                )}
                            >
                                <List className="w-6 h-6" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setViewMode("card")}
                                className={cn(
                                    "w-12 h-12 rounded-xl transition-all duration-300",
                                    viewMode === "card" ? "bg-[#34967C] text-white shadow-md hover:bg-[#34967C]/90" : "text-[#1E293B] hover:bg-slate-200/50"
                                )}
                            >
                                <LayoutGrid className="w-6 h-6" />
                            </Button>
                        </div>
                    </div>
                </div>

                {sites.length > 0 && (
                    <Tabs value={activeSiteId} onValueChange={setActiveSiteId} className="w-full">
                        <TabsList className="bg-transparent h-auto p-0 flex gap-8 border-b border-slate-200 w-full justify-start rounded-none">

                            {sites.map(site => (
                                <TabsTrigger
                                    key={site.id}
                                    value={site.id.toString()}
                                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#34967C] data-[state=active]:bg-transparent data-[state=active]:text-[#34967C] px-0 pb-2 text-base font-semibold text-slate-500 hover:text-slate-700 transition-all shadow-none"
                                >
                                    {site.name}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>
                )}

                {sites.length > 0 ? (
                    <div className="space-y-8 relative z-10">
                        {(() => {
                            const allExecutions = (auditPrograms || [])
                                .filter(p => p.siteId.toString() === activeSiteId)
                                .flatMap(p => {
                                    const site = (sites || []).find(s => s.id === p.siteId);
                                    const executions = getAuditExecutions(p) || [];
                                    return executions.map(exec => ({
                                        ...exec,
                                        siteName: site?.name || "N/A",
                                        site: site // passing full site object for state navigation
                                    }));
                                });

                            if (!allExecutions || allExecutions.length === 0) {
                                return (
                                    <div className="h-[300px] flex flex-col items-center justify-center bg-white/40 backdrop-blur-sm rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 gap-4 transition-all hover:bg-white/60 focus:bg-white/60">
                                        <ClipboardCheck className="w-12 h-12 opacity-20" />
                                        <div className="text-center space-y-1">
                                            <p className="text-lg font-bold text-slate-600">No Audit Plans</p>
                                            <p className="text-sm text-slate-400 font-medium">No active audit executions mapped across your sites.</p>
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <div className={cn(
                                    "animate-in fade-in slide-in-from-bottom-4 duration-700",
                                    viewMode === "card" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "flex flex-col gap-3"
                                )}>
                                    {(allExecutions || []).map((exec, idx) => {
                                        const siteProgram = (auditPrograms || []).find(p => p.id === exec.programId);
                                        const plan = (auditPlans || []).find(p => p.auditProgramId === exec.programId && p.executionId === exec.id);
                                        const planExists = !!plan;

                                        return viewMode === "card" ? (
                                            <Card key={idx} className="group relative border border-white/50 bg-white shadow-sm hover:shadow-md transition-all duration-500 rounded-2xl p-6 flex flex-col gap-6 border-slate-200/50">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="space-y-2 flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <div className={cn(
                                                                "p-2 rounded-lg transition-all duration-300",
                                                                planExists ? "bg-indigo-100 text-indigo-600 group-hover:bg-indigo-50 group-hover:text-white" : "bg-emerald-100 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white"
                                                            )}>
                                                                <ClipboardCheck className="w-4 h-4" />
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] font-black text-slate-400 tracking-wider uppercase">
                                                                    Audit #{idx + 1}
                                                                </span>
                                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                                    <Globe className="w-3 h-3 text-emerald-500" />
                                                                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-tight">{exec.siteName}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <h3 className="text-lg font-black text-[#0F172A] leading-tight group-hover:text-emerald-600 transition-colors duration-300 uppercase line-clamp-2 mt-2">
                                                            {exec.title.split(' - ')[0]}
                                                            <span className="text-slate-400 font-medium normal-case block text-sm mt-1">
                                                                {planExists ? format(new Date(plan.date), 'MMM dd, yyyy') : exec.title.split(' - ')[1]}
                                                            </span>
                                                        </h3>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="outline" className="text-[10px] font-bold px-2 py-1 border-slate-100 text-slate-500 bg-slate-50 rounded-lg whitespace-nowrap">
                                                            {exec.clauseCount} SECTIONS
                                                        </Badge>
                                                        {planExists && (
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-emerald-600">
                                                                        <MoreVertical className="h-4 w-4" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end" className="w-48">
                                                                    <DropdownMenuItem onClick={() => navigate("/audit-program/create-plan", { state: { execution: exec, program: siteProgram, site: exec.site, plan } })}>
                                                                        <Edit className="mr-2 h-4 w-4" /> Edit Plan
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem onClick={() => navigate("/audit-program/create-plan", { state: { execution: exec, program: siteProgram, site: exec.site, plan } })}>
                                                                        <Eye className="mr-2 h-4 w-4" /> View Details
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem onClick={() => handleDownloadPDF(plan, exec.title, siteProgram)}>
                                                                        <FileText className="mr-2 h-4 w-4" /> Download PDF
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem onClick={() => handleDownloadDocx(plan, exec.title, siteProgram)}>
                                                                        <FileText className="mr-2 h-4 w-4" /> Download DOCX
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem onClick={() => handleDeletePlan(plan.id)} className="text-red-600 focus:text-red-600 focus:bg-red-50">
                                                                        <Trash2 className="mr-2 h-4 w-4" /> Delete Plan
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex-1">
                                                    <div className="flex flex-wrap gap-2">
                                                        {exec.clauses.slice(0, 3).map((clause: Clause) => (
                                                            <div key={clause.id} className="text-[10px] font-semibold text-slate-600 bg-slate-50 px-3 py-1 rounded-lg border border-slate-100 truncate max-w-full">
                                                                {clause.name}
                                                            </div>
                                                        ))}
                                                        {exec.clauses.length > 3 && (
                                                            <span className="text-[10px] font-bold text-slate-400 px-2 truncate">+{exec.clauses.length - 3} more</span>
                                                        )}
                                                    </div>
                                                </div>

                                                <Button
                                                    size="lg"
                                                    className={cn(
                                                        "w-full font-bold rounded-2xl h-12 shadow-md transition-all duration-300 group/btn text-sm relative overflow-hidden",
                                                        planExists ? "bg-white text-indigo-600 border-2 border-indigo-100 hover:bg-indigo-50 hover:border-indigo-200" : "bg-slate-900 hover:bg-emerald-600 text-white"
                                                    )}
                                                    onClick={() => navigate("/audit-program/create-plan", { state: { execution: exec, program: siteProgram, site: exec.site, plan } })}
                                                >
                                                    <div className="relative z-10 flex items-center justify-center gap-2">
                                                        {planExists ? <LayoutDashboard className="w-4 h-4" /> : <Calendar className="w-4 h-4 transition-transform duration-500 group-hover/btn:rotate-12" />}
                                                        {planExists ? "VIEW / EDIT PLAN" : "CREATE PLAN"}
                                                        {!planExists && <ArrowRight className="w-4 h-4 opacity-0 -translate-x-4 group-hover/btn:opacity-100 group-hover/btn:translate-x-0 transition-all duration-300" />}
                                                    </div>
                                                </Button>
                                            </Card>
                                        ) : (
                                            <div key={idx} className="group flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 gap-4">
                                                <div className="flex flex-col gap-3">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className={cn("text-lg font-bold tracking-tight", planExists ? "text-indigo-600" : "text-emerald-600")}>
                                                            {planExists
                                                                ? `${exec.title.split(' - ')[0]} - ${format(new Date(plan.date), 'MMM dd, yyyy')}`
                                                                : exec.title
                                                            }
                                                        </h3>
                                                        <Badge variant="outline" className="text-[10px] font-bold border-emerald-100 text-emerald-600 bg-emerald-50 rounded-lg">
                                                            {exec.siteName}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {exec.clauses.map((clause: Clause) => (
                                                            <span key={clause.id} className="text-sm font-medium text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg">
                                                                {clause.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4 self-start sm:self-center mt-2 sm:mt-0">
                                                    <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 shadow-sm whitespace-nowrap">
                                                        {exec.clauseCount} Sections
                                                    </div>
                                                    <Button
                                                        className={cn(
                                                            "font-bold rounded-xl h-10 px-6 shadow-md transition-all duration-300 hover:scale-105 active:scale-95 group/btn relative overflow-hidden",
                                                            planExists ? "bg-white text-indigo-600 border-2 border-indigo-100 hover:bg-indigo-50" : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-100"
                                                        )}
                                                        onClick={() => navigate("/audit-program/create-plan", { state: { execution: exec, program: siteProgram, site: exec.site, plan } })}
                                                    >
                                                        <div className="relative z-10 flex items-center justify-center gap-2">
                                                            {planExists ? <LayoutDashboard className="w-4 h-4" /> : <Calendar className="w-4 h-4 transition-transform duration-500 group-hover/btn:rotate-12" />}
                                                            {planExists ? "View / Edit" : "Create Plan"}
                                                            {!planExists && <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover/btn:opacity-100 group-hover/btn:translate-x-0 transition-all duration-300" />}
                                                        </div>
                                                    </Button>
                                                    {planExists && (
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-400 hover:text-emerald-600 bg-white border border-slate-200 rounded-xl hover:bg-emerald-50 hover:border-emerald-200 transition-all duration-300">
                                                                    <MoreVertical className="w-4 h-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-48">
                                                                <DropdownMenuItem onClick={() => navigate("/audit-program/create-plan", { state: { execution: exec, program: siteProgram, site: exec.site, plan } })}>
                                                                    <Edit className="mr-2 h-4 w-4" /> Edit Plan
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => navigate("/audit-program/create-plan", { state: { execution: exec, program: siteProgram, site: exec.site, plan } })}>
                                                                    <Eye className="mr-2 h-4 w-4" /> View Details
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => handleDownloadPDF(plan, exec.title, siteProgram)}>
                                                                    <FileText className="mr-2 h-4 w-4" /> Download PDF
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => handleDownloadDocx(plan, exec.title, siteProgram)}>
                                                                    <FileText className="mr-2 h-4 w-4" /> Download DOCX
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => handleDeletePlan(plan.id)} className="text-red-600 focus:text-red-600 focus:bg-red-50">
                                                                    <Trash2 className="mr-2 h-4 w-4" /> Delete Plan
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                    </div>
                ) : ((
                    <div className="flex flex-col items-center justify-center p-24 bg-white/50 backdrop-blur-xl rounded-2xl border-2 border-dashed border-slate-200 text-center space-y-6 animate-in zoom-in-95 duration-1000">
                        <Globe className="w-16 h-16 text-slate-200" />
                        <div className="space-y-2">
                            <h3 className="text-xl font-black text-slate-800">Operational Sites Missing</h3>
                            <p className="text-slate-500 max-w-sm mx-auto text-sm font-medium">
                                To visualize your global audit program, please first define at least one operational site.
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AuditProgramPage;
