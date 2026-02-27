import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { AlertTriangle, ArrowRight, RefreshCw, SearchX, Search } from "lucide-react";
import { auditTemplates, ChecklistContent } from "@/data/auditTemplates";
import ReusablePagination from "@/components/ReusablePagination";

// ─── Types ────────────────────────────────────────────────────────────────────

type FindingType = "OFI" | "Minor" | "Major";

interface Finding {
    auditId: number;
    auditName: string;
    clauseRef: string;
    type: FindingType;
    details: string;
    description: string;
    actionBy: string;
    closeDate: string;
    assignTo: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<
    FindingType,
    { label: string; bg: string; text: string; ring: string }
> = {
    OFI: {
        label: "OFI",
        bg: "bg-amber-100",
        text: "text-amber-800",
        ring: "ring-amber-300",
    },
    Minor: {
        label: "Minor N/C",
        bg: "bg-orange-100",
        text: "text-orange-800",
        ring: "ring-orange-300",
    },
    Major: {
        label: "Major N/C",
        bg: "bg-red-100",
        text: "text-red-800",
        ring: "ring-red-300",
    },
};

function extractFindings(plan: any): Finding[] {
    const results: Finding[] = [];
    if (!plan.auditData) return results;

    const data =
        typeof plan.auditData === "string"
            ? JSON.parse(plan.auditData)
            : plan.auditData;

    const auditName: string = plan.auditName || `Audit #${plan.id}`;

    // ── clause-checklist (AuditExecute – clauseData) ──────────────────────────
    // Stores findingType per clause id key: 'OFI' | 'Minor' | 'Major' | 'C'
    if (data.clauseData && typeof data.clauseData === "object") {
        Object.entries(data.clauseData).forEach(([clauseId, entry]: any) => {
            const ft: string | undefined = entry?.findingType;
            if (!ft || ft === "C") return; // Strictly ignore C and empty types!

            if (ft === "OFI" || ft === "Minor" || ft === "Major") {
                results.push({
                    auditId: plan.id,
                    auditName,
                    clauseRef: `Clause ${clauseId}`,
                    type: ft as FindingType,
                    details: entry.findingDetails || "",
                    description: entry.description || "",
                    actionBy: entry.actionBy || "",
                    closeDate: entry.closeDate || "",
                    assignTo: entry.assignTo || "",
                });
            }
        });
    }

    // ── checklist table (ExecuteAuditTemplate – checklistData) ────────────────
    // The C/OFI/Min/Maj buttons store their label in checklistData[index].findings
    // Values: 'C' | 'OFI' | 'Min' | 'Maj'  (also accept 'Minor'/'Major' for AuditExecute)
    if (data.checklistData && typeof data.checklistData === "object") {
        // Resolve the template's checklist content so we can look up the clause per index
        const templateContent = (() => {
            const tmplId = plan.templateId;
            if (!tmplId) return null;
            const tmpl = auditTemplates.find((t) => t.id === tmplId);
            if (!tmpl || tmpl.type !== "checklist") return null;
            return tmpl.content as ChecklistContent[];
        })();

        Object.entries(data.checklistData).forEach(([idx, entry]: any) => {
            const raw: string | undefined = entry?.findings;
            if (!raw || raw === "C" || raw.trim() === "") return;

            let type: FindingType | null = null;
            if (raw === "OFI") type = "OFI";
            else if (raw === "Min" || raw === "Minor") type = "Minor";
            else if (raw === "Maj" || raw === "Major") type = "Major";

            if (type) {
                // Priority: 1) clause persisted directly in entry, 2) template lookup, 3) Item N
                const itemIndex = Number(idx);
                const templateItem = templateContent?.[itemIndex];
                const clauseRef =
                    entry.clause
                        ? `Clause ${entry.clause}`
                        : templateItem?.clause
                            ? `Clause ${templateItem.clause}`
                            : `Item ${itemIndex + 1}`;

                results.push({
                    auditId: plan.id,
                    auditName,
                    clauseRef,
                    type,
                    details: entry.evidence || "",
                    description: entry.description || "",
                    actionBy: entry.actionBy || "",
                    closeDate: entry.closeDate || "",
                    assignTo: entry.assignTo || "",
                });
            }
        });
    }

    // ── process-audit (AuditExecute – processAudits) ─────────────────────────
    if (data.processAudits && Array.isArray(data.processAudits)) {
        data.processAudits.forEach((audit: any, idx: number) => {
            const ft = audit.findingType;
            if (!ft || ft === "C") return;

            if (ft === "OFI" || ft === "Minor" || ft === "Major") {
                results.push({
                    auditId: plan.id,
                    auditName,
                    clauseRef: `Process #${idx + 1}`,
                    type: ft as FindingType,
                    details: audit.evidence || "",
                    description: audit.description || "",
                    actionBy: audit.actionBy || "",
                    closeDate: audit.closeDate || "",
                    assignTo: audit.assignTo || "",
                });
            }
        });
    }

    // ── Deduplicate by (auditId, clauseRef) – keep highest severity ───────────
    const SEVERITY: Record<FindingType, number> = { OFI: 1, Minor: 2, Major: 3 };
    const seen = new Map<string, Finding>();
    results.forEach((f) => {
        const key = `${f.auditId}::${f.clauseRef}`;
        const existing = seen.get(key);
        if (!existing || SEVERITY[f.type] > SEVERITY[existing.type]) {
            seen.set(key, f);
        }
    });

    return Array.from(seen.values());
}



// ─── Component ────────────────────────────────────────────────────────────────

type FilterType = "All" | FindingType;

const FILTERS: FilterType[] = ["All", "OFI", "Minor", "Major"];

const FILTER_STYLE: Record<FilterType, string> = {
    All: "bg-slate-800 text-white hover:bg-slate-700",
    OFI: "bg-amber-500 text-white hover:bg-amber-600",
    Minor: "bg-orange-600 text-white hover:bg-orange-700",
    Major: "bg-red-600 text-white hover:bg-red-700",
};

const FILTER_INACTIVE =
    "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50";

export default function AuditFindings() {
    const navigate = useNavigate();
    const [findings, setFindings] = useState<Finding[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState<FilterType>("All");
    const [searchQuery, setSearchQuery] = useState("");

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

    const fetchFindings = async () => {
        setLoading(true);
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const res = await fetch(`http://localhost:3001/api/audit-plans?userId=${user.id}`);
            const plans: any[] = await res.json();
            const all: Finding[] = [];
            plans.forEach((plan) => {
                all.push(...extractFindings(plan));
            });
            setFindings(all);
        } catch {
            setFindings([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFindings();
    }, []);

    const searchedFindings = findings.filter(f => {
        const query = searchQuery.toLowerCase();
        return (
            f.auditName.toLowerCase().includes(query) ||
            f.details.toLowerCase().includes(query) ||
            f.description.toLowerCase().includes(query) ||
            f.clauseRef.toLowerCase().includes(query)
        );
    });

    const filtered =
        activeFilter === "All"
            ? searchedFindings
            : searchedFindings.filter((f) => f.type === activeFilter);

    const countOf = (type: FindingType) =>
        searchedFindings.filter((f) => f.type === type).length;

    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const paginatedFindings = filtered.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Reset page to 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, activeFilter]);

    return (
        <div className="flex-1 p-8 pt-6 bg-white min-h-screen">
            <div className="max-w-6xl mx-auto space-y-6 pb-16">
                {/* ── Header ── */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <AlertTriangle className="w-6 h-6 text-amber-500" />
                            Audit Findings
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">
                            All OFI, Minor N/C and Major N/C findings across every audit.
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchFindings}
                        className="gap-2 text-slate-600 border-slate-200"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </Button>
                </div>

                {/* ── Summary Cards ── */}
                <div className="grid grid-cols-3 gap-4">
                    {(
                        [
                            { type: "OFI", label: "OFI", accent: "amber" },
                            { type: "Minor", label: "Minor N/C", accent: "orange" },
                            { type: "Major", label: "Major N/C", accent: "red" },
                        ] as const
                    ).map(({ type, label, accent }) => (
                        <button
                            key={type}
                            onClick={() => setActiveFilter(type)}
                            className={`rounded-xl border p-5 text-left transition-all shadow-sm cursor-pointer
                ${activeFilter === type
                                    ? `border-${accent}-400 ring-2 ring-${accent}-200 bg-${accent}-50`
                                    : "border-slate-200 bg-white hover:bg-slate-50"
                                }`}
                        >
                            <span
                                className={`text-xs font-bold uppercase tracking-widest text-${accent}-600`}
                            >
                                {label}
                            </span>
                            <div
                                className={`text-4xl font-extrabold mt-1 text-${accent}-600`}
                            >
                                {countOf(type)}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">findings</div>
                        </button>
                    ))}
                </div>

                {/* ── Filter Pills and Search ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex gap-2 flex-wrap">
                        {FILTERS.map((f) => (
                            <button
                                key={f}
                                onClick={() => setActiveFilter(f)}
                                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all shadow-sm ${activeFilter === f ? FILTER_STYLE[f] : FILTER_INACTIVE
                                    }`}
                            >
                                {f === "All"
                                    ? `All (${searchedFindings.length})`
                                    : f === "Minor"
                                        ? `Minor N/C (${countOf(f)})`
                                        : f === "Major"
                                            ? `Major N/C (${countOf(f)})`
                                            : `OFI (${countOf(f)})`}
                            </button>
                        ))}
                    </div>

                    <div className="relative w-full sm:w-[320px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search findings, audits, clauses..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 bg-white border-slate-200 h-10 rounded-xl focus-visible:ring-amber-500"
                        />
                    </div>
                </div>

                {/* ── Table ── */}
                {loading ? (
                    <div className="flex items-center justify-center py-24 text-slate-400 text-sm gap-2">
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Loading findings…
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
                        <SearchX className="w-12 h-12 opacity-40" />
                        <p className="text-base font-semibold">No findings found</p>
                        <p className="text-sm text-center max-w-sm">
                            {searchQuery
                                ? `No results found for "${searchQuery}".`
                                : activeFilter === "All"
                                    ? "No OFI, Minor or Major findings have been recorded yet."
                                    : `No ${activeFilter === "Minor" ? "Minor N/C" : activeFilter === "Major" ? "Major N/C" : "OFI"} findings found.`}
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                            <Table>
                                <TableHeader className="bg-[#213847]">
                                    <TableRow className="hover:bg-slate-800 divide-x divide-slate-600">
                                        <TableHead className="text-white font-bold w-12 text-center">
                                            #
                                        </TableHead>
                                        <TableHead className="text-white font-bold w-[20%]">
                                            Audit Name
                                        </TableHead>
                                        <TableHead className="text-white font-bold w-[12%]">
                                            Clause / Item
                                        </TableHead>
                                        <TableHead className="text-white font-bold w-[10%]">
                                            Type
                                        </TableHead>
                                        <TableHead className="text-white font-bold w-[22%]">
                                            Finding Details
                                        </TableHead>
                                        <TableHead className="text-white font-bold w-[22%]">
                                            Description
                                        </TableHead>
                                        <TableHead className="text-white font-bold w-[12%]">
                                            Action By
                                        </TableHead>
                                        <TableHead className="text-white font-bold w-20 text-center">
                                            View
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedFindings.map((finding, idx) => {
                                        const cfg = TYPE_CONFIG[finding.type];
                                        return (
                                            <TableRow
                                                key={`${finding.auditId}-${finding.clauseRef}-${idx}`}
                                                className="bg-white hover:bg-slate-50 transition-colors divide-x divide-slate-100"
                                            >
                                                <TableCell className="text-center text-slate-500 font-medium text-sm">
                                                    {(currentPage - 1) * itemsPerPage + idx + 1}
                                                </TableCell>
                                                <TableCell className="font-semibold text-slate-800 text-sm py-3">
                                                    {finding.auditName}
                                                </TableCell>
                                                <TableCell className="text-slate-600 text-sm font-mono">
                                                    {finding.clauseRef}
                                                </TableCell>
                                                <TableCell>
                                                    <span
                                                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ring-1 ${cfg.bg} ${cfg.text} ${cfg.ring}`}
                                                    >
                                                        {cfg.label}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-slate-600 text-sm max-w-[220px]">
                                                    <p className="line-clamp-3 leading-snug">
                                                        {finding.details || "—"}
                                                    </p>
                                                </TableCell>
                                                <TableCell className="text-slate-600 text-sm max-w-[220px]">
                                                    <p className="line-clamp-3 leading-snug">
                                                        {finding.description || "—"}
                                                    </p>
                                                </TableCell>
                                                <TableCell className="text-slate-600 text-sm font-medium">
                                                    {finding.actionBy || "—"}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() =>
                                                            navigate(`/audit/execute/${finding.auditId}`, { state: { focusFindings: true } })
                                                        }
                                                        className="h-8 w-8 p-0 text-slate-400 hover:text-slate-800"
                                                        title="Go to audit"
                                                    >
                                                        <ArrowRight className="w-4 h-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                        <ReusablePagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={filtered.length}
                            itemsPerPage={itemsPerPage}
                            onPageChange={setCurrentPage}
                            className="mt-6"
                        />
                    </>
                )}
            </div>
        </div>
    );
}
