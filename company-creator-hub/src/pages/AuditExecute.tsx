import React, { useState, useEffect } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Edit,
  Save,
  CheckCircle2,
  Building2,
  User,
  Calendar,
  Clock,
  Image as ImageIcon,
  Upload,
  Plus,
  Trash2,
  FileText,
  AlertCircle,
  ArrowDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  auditTemplates,
  ChecklistContent,
  SectionContent,
  ClauseChecklistContent,
  ProcessAuditContent,
} from "@/data/auditTemplates";
import { toast } from "sonner";
import { format } from "date-fns";

const CLAUSES = [
  { id: "4", name: "4. CONTEXT OF THE ORGANISATION", isHeading: true },
  { id: "4.1", name: "4.1 Understanding the organization & its context" },
  {
    id: "4.2",
    name: "4.2 Understanding the needs and expectations of interested parties",
  },
  { id: "4.3", name: "4.3 Determining the scope of the EMS" },
  { id: "4.4", name: "4.4 Environmental management system" },
  { id: "5", name: "5 LEADERSHIP", isHeading: true },
  { id: "5.1", name: "5.1 Leadership and commitment" },
  { id: "5.2", name: "5.2 Environmental policy" },
  {
    id: "5.3",
    name: "5.3 Organizational roles, responsibilities and authorities",
  },
  { id: "6", name: "6 PLANNING", isHeading: true },
  {
    id: "6.1",
    name: "6.1 Actions to address risks & opportunities",
    isHeading: true,
  },
  { id: "6.1.1", name: "6.1.1 General" },
  { id: "6.1.2", name: "6.1.2 Environmental aspects" },
  { id: "6.1.3", name: "6.1.3 Compliance obligations" },
  { id: "6.1.4", name: "6.1.4 Planning action" },
  {
    id: "6.2",
    name: "6.2 Environmental objectives and planning to achieve them",
    isHeading: true,
  },
  { id: "6.2.1", name: "6.2.1 Environmental objectives" },
  {
    id: "6.2.2",
    name: "6.2.2 Planning actions to achieve environmental objectives",
  },
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
  {
    id: "9.1",
    name: "9.1 Monitoring, measuring, analysis and evaluation",
    isHeading: true,
  },
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

const calculatePeriods = (frequency: string, duration: number) => {
  const count =
    frequency === "Monthly"
      ? duration * 12
      : frequency === "Quarterly"
        ? duration * 4
        : frequency === "Bi-annually"
          ? duration * 2
          : duration;
  const result = [];
  const currentDate = new Date(2026, 1, 1);
  for (let i = 0; i < count; i++) {
    const monthLabel = currentDate
      .toLocaleString("default", { month: "short" })
      .toUpperCase();
    const yearLabel = currentDate.getFullYear().toString().slice(-2);
    result.push(`${monthLabel} ${yearLabel}`);
    if (frequency === "Monthly")
      currentDate.setMonth(currentDate.getMonth() + 1);
    else if (frequency === "Quarterly")
      currentDate.setMonth(currentDate.getMonth() + 3);
    else if (frequency === "Bi-annually")
      currentDate.setMonth(currentDate.getMonth() + 6);
    else currentDate.setFullYear(currentDate.getFullYear() + 1);
  }
  return result;
};

const AuditExecute = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  // State for the loaded plan
  const [currentPlan, setCurrentPlan] = useState<any>(location.state?.plan);
  const plan = currentPlan;

  // State to filter for findings only
  const [focusFindings, setFocusFindings] = useState<boolean>(
    location.state?.focusFindings === true
  );

  // Use the template attached to the plan, or fallback
  const templateId = plan?.templateId;
  const template = auditTemplates.find((t) => t.id === templateId);

  // --- Pre-calculate Schedule Data ---
  let colIndex = -1;
  let activeScheduleData: Record<string, boolean> | undefined;
  const explicitlySelectedClauses: {
    id: string;
    name: string;
    isHeading?: boolean;
  }[] = [];

  if (plan?.auditProgram && plan?.executionId) {
    const parts = plan.executionId.split(" - ");
    const periodLabel =
      parts.length > 1 ? parts.slice(1).join(" - ") : parts[0];
    activeScheduleData = plan.auditProgram.scheduleData as Record<
      string,
      boolean
    >;
    const programPeriods = calculatePeriods(
      plan.auditProgram.frequency,
      plan.auditProgram.duration,
    );
    colIndex = programPeriods.indexOf(periodLabel);

    if (activeScheduleData && colIndex !== -1) {
      CLAUSES.forEach((clause, rowIndex) => {
        if (activeScheduleData![`${rowIndex}-${colIndex}`] === true) {
          explicitlySelectedClauses.push(clause);
        }
      });
    }
  }

  const isClauseSelected = (clauseStr: string) => {
    if (!activeScheduleData || Object.keys(activeScheduleData).length === 0)
      return true;
    if (colIndex === -1) return true;

    const match = clauseStr.match(/^(\d+(?:\.\d+)*)/);
    if (!match) return false;

    const cleanId = match[1];

    return explicitlySelectedClauses.some(
      (c) =>
        c.id === cleanId ||
        c.id.startsWith(cleanId + ".") ||
        cleanId.startsWith(c.id + "."),
    );
  };

  const [checklistData, setChecklistData] = useState<
    Record<
      number,
      {
        findings: string;
        evidence: string;
        ofi: string;
        description?: string;
        correction?: string;
        rootCause?: string;
        correctiveAction?: string;
        actionBy?: string;
        closeDate?: string;
        assignTo?: string;
        clause?: string;
      }
    >
  >({});

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load saved progress
  useEffect(() => {
    const fetchPlanDetails = async () => {
      if (!id) return;
      setIsRefreshing(true);
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const res = await fetch(`http://localhost:3001/api/audit-plans?userId=${user.id}`);
        const allPlans = await res.json();
        const found = allPlans.find((p: any) => p.id === parseInt(id));
        if (found) {
          setCurrentPlan(found);
          if (found.auditData) {
            const data = typeof found.auditData === 'string' ? JSON.parse(found.auditData) : found.auditData;
            if (data.checklistData) setChecklistData(data.checklistData);
            if (data.sectionData) setSectionData(data.sectionData);
            if (data.clauseData) setClauseData(data.clauseData);
            if (data.previousFindings) setPreviousFindings(data.previousFindings);
            if (data.detailsOfChanges) setDetailsOfChanges(data.detailsOfChanges);
            if (data.participants) setParticipants(data.participants);
            if (data.positiveAspects) setPositiveAspects(data.positiveAspects);
            if (data.opportunities) setOpportunities(data.opportunities);
            if (data.nonConformances) setNonConformances(data.nonConformances);
            if (data.executiveSummary) setExecutiveSummary(data.executiveSummary);
            if (data.summaryCounts) setSummaryCounts(data.summaryCounts);
            if (data.auditFindings) setAuditFindings(data.auditFindings);
            if (data.auditGlobalInfo) setAuditGlobalInfo(data.auditGlobalInfo);
            if (data.processAudits) setProcessAudits(data.processAudits);
            if (data.showExecutiveSummary !== undefined) setShowExecutiveSummary(data.showExecutiveSummary);
            if (data.showAuditParticipants !== undefined) setShowAuditParticipants(data.showAuditParticipants);
            if (data.showAuditFindings !== undefined) setShowAuditFindings(data.showAuditFindings);
          }
        }
      } catch (error) {
        console.error("Failed to fetch plan details:", error);
      } finally {
        setIsRefreshing(false);
      }
    };
    fetchPlanDetails();
  }, [id]);
  const [sectionData, setSectionData] = useState<Record<number, string>>({});
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [clauseFiles, setClauseFiles] = useState<Record<string, File[]>>({});
  const [genericFiles, setGenericFiles] = useState<Record<string, File[]>>({});

  // --------------------------------------------------------------------------
  // HANDLERS
  // --------------------------------------------------------------------------
  const [clauseData, setClauseData] = useState<
    Record<string, ClauseChecklistContent>
  >({});

  const getClausesToRender = () => {
    if (!template || template.type !== "clause-checklist") return [];
    if (explicitlySelectedClauses.length > 0) {
      return explicitlySelectedClauses.filter((c) => !c.isHeading);
    }
    const all: { id: string; name: string }[] = [];
    (template.content as ClauseChecklistContent[]).forEach((c) => {
      if (c.subClauses) {
        c.subClauses.forEach((sub) => {
          const match = sub.match(/^(\d+(?:\.\d+)*)/);
          if (match) all.push({ id: match[1], name: sub });
        });
      } else {
        all.push({ id: c.clauseId, name: c.title });
      }
    });
    return all;
  };
  const clausesToRender = getClausesToRender();

  // Extended Sections State
  const [previousFindings, setPreviousFindings] = useState("");
  const [detailsOfChanges, setDetailsOfChanges] = useState([
    { item: "Scope", actionRequired: false, notes: "" },
    { item: "Boundary", actionRequired: false, notes: "" },
    {
      item: "Key IMS documented information",
      actionRequired: false,
      notes: "",
    },
    { item: "Organisational structure", actionRequired: false, notes: "" },
    { item: "Compliance Obligations", actionRequired: false, notes: "" },
    { item: "Other noteworthy changes", actionRequired: false, notes: "" },
  ]);
  const [participants, setParticipants] = useState([
    { name: "", position: "", opening: false, closing: false, interviewed: "" },
  ]);
  const [positiveAspects, setPositiveAspects] = useState([
    { id: "PA-01", standardClause: "", areaProcess: "", aspect: "" },
  ]);
  const [opportunities, setOpportunities] = useState([
    { id: "OFI-01", standardClause: "", areaProcess: "", opportunity: "" },
  ]);
  const [nonConformances, setNonConformances] = useState([
    {
      id: "NCR-01",
      standardClause: "",
      areaProcess: "",
      statement: "",
      dueDate: "",
      actionBy: "",
    },
  ]);


  // Process Audit states
  const [executiveSummary, setExecutiveSummary] = useState("");
  const [summaryCounts, setSummaryCounts] = useState({
    major: "",
    minor: "",
    ofi: "",
    positive: "",
  });
  const [auditFindings, setAuditFindings] = useState([
    { refNo: "", clauseNo: "", details: "", category: "" },
  ]);

  const [auditGlobalInfo, setAuditGlobalInfo] = useState({
    refNo: "",
    clauseNo: "",
    department: "",
  });

  const [processAudits, setProcessAudits] = useState<ProcessAuditContent[]>([
    {
      id: "1",
      processArea: "",
      auditees: "",
      evidence: "",
      conclusion: "",
    },
  ]);

  const addProcessAudit = () =>
    setProcessAudits([
      ...processAudits,
      {
        id: Date.now().toString(),
        processArea: "",
        auditees: "",
        evidence: "",
        conclusion: "",
      },
    ]);
  const updateProcessAudit = (
    index: number,
    field: keyof ProcessAuditContent,
    value: any,
  ) => {
    const newAudits = [...processAudits];
    newAudits[index] = { ...newAudits[index], [field]: value };
    setProcessAudits(newAudits);
  };
  const removeProcessAudit = (index: number) =>
    setProcessAudits(processAudits.filter((_, i) => i !== index));
  const addAuditFinding = () =>
    setAuditFindings([
      ...auditFindings,
      { refNo: "", clauseNo: "", details: "", category: "" },
    ]);
  const removeAuditFinding = (index: number) =>
    setAuditFindings(auditFindings.filter((_, i) => i !== index));

  // Visibility toggles for the Process Audit top sections
  const [showExecutiveSummary, setShowExecutiveSummary] = useState(true);
  const [showAuditParticipants, setShowAuditParticipants] = useState(true);
  const [showAuditFindings, setShowAuditFindings] = useState(true);

  // Derived Progress logic
  const calculateProgress = () => {
    if (!template)
      return {
        percentage: 0,
        totalItems: 0,
        completedItems: 0,
        pendingItems: 0,
      };

    let totalItems = 0;
    let completedItems = 0;

    if (template.type === "checklist" && Array.isArray(template.content)) {
      const activeItems = (template.content as ChecklistContent[]).filter(
        (item) => isClauseSelected(item.clause),
      );
      totalItems = activeItems.length;
      completedItems = Object.keys(checklistData).filter((key) => {
        const itemIndex = Number(key);
        const item = template.content[itemIndex] as ChecklistContent;
        return activeItems.includes(item) && checklistData[itemIndex]?.findings;
      }).length;
    } else if (template.type === "clause-checklist") {
      totalItems = clausesToRender.length;
      completedItems = clausesToRender.filter(
        (clause) => !!clauseData[clause.id]?.findingType,
      ).length;
    } else if (template.type === "section" && Array.isArray(template.content)) {
      totalItems = template.content.length;
      completedItems = Object.keys(sectionData).filter(
        (key) => sectionData[Number(key)]?.trim() !== "",
      ).length;
    } else if (template.type === "process-audit") {
      totalItems = processAudits.length;
      completedItems = processAudits.filter(
        (pa) => pa.processArea?.trim() !== "" && pa.auditees?.trim() !== "",
      ).length;
    }

    return {
      percentage:
        totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
      totalItems,
      completedItems,
      pendingItems: totalItems - completedItems,
    };
  };

  const {
    percentage: progressValue,
    totalItems,
    completedItems,
    pendingItems,
  } = calculateProgress();

  const collectFindings = () => {
    const findings: {
      source: "clause" | "checklist" | "process";
      id: string;
      ref: string;
      type: string;
      description: string;
      actionBy: string;
      closeDate: string;
      assignTo: string;
    }[] = [];

    if (template?.type === "clause-checklist") {
      Object.entries(clauseData).forEach(([id, data]) => {
        if (data.findingType && data.findingType !== "C") {
          findings.push({
            source: "clause",
            id,
            ref: `Clause ${id}`,
            type: data.findingType,
            description: data.description || "",
            actionBy: data.actionBy || "",
            closeDate: data.closeDate || "",
            assignTo: data.assignTo || "",
          });
        }
      });
    }

    if (template?.type === "checklist") {
      Object.entries(checklistData).forEach(([idx, data]) => {
        const type = data.findings;
        if (type && type !== "C" && type !== "") {
          const item = (template?.content as ChecklistContent[])?.[Number(idx)];
          findings.push({
            source: "checklist",
            id: idx,
            ref: item?.clause
              ? `Clause ${item.clause}`
              : `Item ${Number(idx) + 1}`,
            type: type === "Min" ? "Minor" : type === "Maj" ? "Major" : type,
            description: data.description || "",
            actionBy: data.actionBy || "",
            closeDate: data.closeDate || "",
            assignTo: data.assignTo || "",
          });
        }
      });
    }

    if (template?.type === "process-audit") {
      processAudits.forEach((audit, idx) => {
        if (audit.findingType && audit.findingType !== "C") {
          findings.push({
            source: "process",
            id: idx.toString(),
            ref: `Process #${idx + 1}`,
            type: audit.findingType,
            description: audit.description || "",
            actionBy: audit.actionBy || "",
            closeDate: audit.closeDate || "",
            assignTo: audit.assignTo || "",
          });
        }
      });
    }

    return findings;
  };

  const findingsList = collectFindings();

  if (!plan || !template) {
    return (
      <div className="flex-1 p-8 pt-6 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-800">
            Plan or Template not found
          </h2>
          <Button className="mt-4" onClick={() => navigate("/audit")}>
            Return to Audit List
          </Button>
        </div>
      </div>
    );
  }

  const addParticipant = () =>
    setParticipants([
      ...participants,
      {
        name: "",
        position: "",
        opening: false,
        closing: false,
        interviewed: "",
      },
    ]);
  const addPositiveAspect = () =>
    setPositiveAspects([
      ...positiveAspects,
      {
        id: `PA-${String(positiveAspects.length + 1).padStart(2, "0")}`,
        standardClause: "",
        areaProcess: "",
        aspect: "",
      },
    ]);
  const addOpportunity = () =>
    setOpportunities([
      ...opportunities,
      {
        id: `OFI-${String(opportunities.length + 1).padStart(2, "0")}`,
        standardClause: "",
        areaProcess: "",
        opportunity: "",
      },
    ]);
  const addNonConformance = () =>
    setNonConformances([
      ...nonConformances,
      {
        id: `NCR-${String(nonConformances.length + 1).padStart(2, "0")}`,
        standardClause: "",
        areaProcess: "",
        statement: "",
        dueDate: "",
        actionBy: "",
      },
    ]);


  const removeParticipant = (index: number) =>
    setParticipants(participants.filter((_, i) => i !== index));
  const removePositiveAspect = (index: number) =>
    setPositiveAspects(positiveAspects.filter((_, i) => i !== index));
  const removeOpportunity = (index: number) =>
    setOpportunities(opportunities.filter((_, i) => i !== index));
  const removeNonConformance = (index: number) =>
    setNonConformances(nonConformances.filter((_, i) => i !== index));

  const handleChecklistChange = (
    index: number,
    field: string,
    value: string,
  ) => {
    setChecklistData((prev) => ({
      ...prev,
      [index]: { ...prev[index], [field]: value },
    }));
  };

  const handleClauseFileUpload = (clause: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newFiles = Array.from(files);
    setClauseFiles(prev => ({
      ...prev,
      [clause]: [...(prev[clause] || []), ...newFiles]
    }));
    toast.success(`${newFiles.length} file(s) attached for Clause ${clause}`);
  };

  const removeClauseFile = (clause: string, indexToRemove: number) => {
    setClauseFiles(prev => ({
      ...prev,
      [clause]: prev[clause].filter((_, index) => index !== indexToRemove)
    }));
  };

  const handleGenericFileUpload = (key: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newFiles = Array.from(files);
    setGenericFiles(prev => ({
      ...prev,
      [key]: [...(prev[key] || []), ...newFiles]
    }));
    toast.success(`${newFiles.length} file(s) attached`);
  };

  const removeGenericFile = (key: string, indexToRemove: number) => {
    setGenericFiles(prev => ({
      ...prev,
      [key]: prev[key].filter((_, index) => index !== indexToRemove)
    }));
  };

  const handleSectionChange = (index: number, value: string) => {
    setSectionData((prev) => ({ ...prev, [index]: value }));
  };

  const handleClauseChange = (
    clauseId: string,
    field: keyof ClauseChecklistContent,
    value: any,
  ) => {
    setClauseData((prev) => ({
      ...prev,
      [clauseId]: { ...prev[clauseId], [field]: value },
    }));
  };

  const handleSubmit = async () => {
    try {
      const auditData = {
        checklistData,
        sectionData,
        clauseData,
        previousFindings,
        detailsOfChanges,
        participants,
        positiveAspects,
        opportunities,
        nonConformances,
        executiveSummary,
        summaryCounts,
        auditFindings,
        auditGlobalInfo,
        processAudits,
        showExecutiveSummary,
        showAuditParticipants,
        showAuditFindings,
        lastSaved: new Date().toISOString(),
        progress: progressValue
      };

      const res = await fetch(`http://localhost:3001/api/audit-plans/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Preserve existing plan fields if needed, or just send auditData
          auditData: auditData
        })
      });

      if (res.ok) {
        toast.success("Audit execution saved successfully!");
        navigate("/audit");
      } else {
        throw new Error("Failed to save");
      }
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save audit progress");
    }
  };

  return (
    <div className="flex-1 p-8 pt-6 bg-transparent min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6 pb-24">
        {/* Header Navigation */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate("/audit")}
              className="gap-2 pl-0 hover:bg-transparent hover:text-slate-600"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Audit List
            </Button>
          </div>
        </div>

        {/* --- TOP OVERVIEW CARDS --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Column: Plan Overview & Audit Details */}
          <div className="col-span-1 md:col-span-2 space-y-6">
            {/* Plan Overview Card */}
            <Card className="shadow-sm border-slate-100 p-6 flex flex-col pt-5 h-fit">
              <div className="flex justify-between items-center bg-white mb-5">
                <h2 className="text-lg font-bold text-slate-900">
                  Plan Overview
                </h2>
              </div>

              <div className="space-y-4 mb-2">
                <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                  <span className="text-sm font-medium text-slate-500">
                    Plan Name
                  </span>
                  <span className="text-sm font-semibold text-slate-800">
                    {plan.auditName}
                  </span>
                </div>
                <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                  <span className="text-sm font-medium text-slate-500">
                    Site
                  </span>
                  <span className="text-sm font-semibold text-slate-800">
                    {plan.site?.name || plan.location || "N/A"}
                  </span>
                </div>
                <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                  <span className="text-sm font-medium text-slate-500">
                    Date
                  </span>
                  <div className="flex items-center gap-2 text-slate-800">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    <span className="text-sm">
                      {plan.date
                        ? format(new Date(plan.date), "yyyy-MM-dd")
                        : "-"}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                  <span className="text-sm font-medium text-slate-500">
                    Time
                  </span>
                  <div className="flex items-center gap-2 text-slate-800">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <span className="text-sm">8:00 - 17:00</span>
                  </div>
                </div>
                <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                  <span className="text-sm font-medium text-slate-500">
                    Lead Auditor
                  </span>
                  <div className="flex items-center gap-2 text-slate-800">
                    <User className="w-4 h-4 text-slate-500" />
                    <span className="text-sm">
                      {plan.leadAuditor
                        ? `${plan.leadAuditor.firstName} ${plan.leadAuditor.lastName}`
                        : "-"}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Audit Details Card */}
            <Card className="shadow-sm border-slate-100 p-6 flex flex-col gap-5 bg-white">
              <div className="flex items-center gap-2">
                <div className="bg-slate-500 p-1.5 rounded-md">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-white"
                  >
                    <line x1="8" y1="6" x2="21" y2="6"></line>
                    <line x1="8" y1="12" x2="21" y2="12"></line>
                    <line x1="8" y1="18" x2="21" y2="18"></line>
                    <line x1="3" y1="6" x2="3.01" y2="6"></line>
                    <line x1="3" y1="12" x2="3.01" y2="12"></line>
                    <line x1="3" y1="18" x2="3.01" y2="18"></line>
                  </svg>
                </div>
                <h2 className="text-base font-bold text-slate-900">
                  Audit Details
                </h2>
              </div>

              <div className="space-y-4">
                <div>
                  <span className="block text-xs font-semibold text-slate-500 mb-1.5">
                    Objective
                  </span>
                  <p className="text-sm text-slate-800">
                    {plan.objective || "N/A"}
                  </p>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-slate-500 mb-1.5">
                    Scope
                  </span>
                  <p className="text-sm text-slate-800">
                    {plan.scope || "N/A"}
                  </p>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-slate-500 mb-1.5">
                    Audit Criteria
                  </span>
                  <p className="text-sm text-slate-800">
                    {plan.criteria || "N/A"}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column: Progress & Downloads */}
          <div className="col-span-1 flex flex-col gap-6 h-fit">
            {/* Progress Card */}
            <Card className="shadow-sm border-slate-100 p-6 flex flex-col gap-6">
              <h2 className="text-lg font-bold text-slate-900 bg-white">
                Progress
              </h2>

              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <span className="text-sm font-medium text-slate-500">
                    Completion
                  </span>
                  <span className="text-3xl font-bold text-emerald-500 leading-none">
                    {progressValue}%
                  </span>
                </div>
                <Progress
                  value={progressValue}
                  className="h-2 bg-slate-100 [&>div]:bg-emerald-500 rounded-full"
                />
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-medium text-slate-500">
                    Total Items
                  </span>
                  <span className="font-bold text-slate-800">{totalItems}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="font-medium text-slate-500">Completed</span>
                  <span className="font-bold text-emerald-500">
                    {completedItems}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="font-medium text-slate-500">Pending</span>
                  <span className="font-bold text-amber-500">
                    {pendingItems}
                  </span>
                </div>
              </div>
            </Card>

            {/* Download Options Card */}
            <Card className="shadow-sm border-slate-100 p-6 flex flex-col gap-4 bg-white">
              <h2 className="text-sm font-bold text-slate-900 mb-2">
                Export Report
              </h2>
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-10 text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-emerald-600"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16h16V8l-6-6Z" />
                  <path d="M14 2v6h6" />
                  <path d="m8 12 4 4" />
                  <path d="m8 16 4-4" />
                </svg>
                Download Excel
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-10 text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-red-500"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <path d="M9 15v-4" />
                  <path d="M10.1 12H9v4" />
                  <path d="M15 11v4h2" />
                  <path d="M12 11v4" />
                  <path d="M12 13h1" />
                </svg>
                Download PDF
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-10 text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-blue-600"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <path d="M8 11.5l2 4 1-2 1 2 2-4" />
                </svg>
                Download Word
              </Button>
            </Card>
          </div>
        </div>

        {/* --- EXTENDED SECTIONS --- */}
        {(template.type === "clause-checklist" ||
          template.type === "checklist") && !focusFindings && (
            <div className="space-y-8 bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              {/* Previous Audit Findings */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
                  Previous Audit Findings
                </h3>
                <div className="border border-slate-200 rounded-md overflow-hidden">
                  <div className="bg-slate-50 text-slate-700 font-bold p-3 text-sm border-b border-slate-200">
                    Closure of Findings from Previous Audit
                  </div>
                  <Textarea
                    className="min-h-[120px] border-0 rounded-none focus-visible:ring-0 resize-y p-4 bg-white"
                    placeholder="Enter details of previous findings closure..."
                    value={previousFindings}
                    onChange={(e) => setPreviousFindings(e.target.value)}
                  />
                </div>
              </div>

              {/* Details of Changes */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
                  Details of Changes
                </h3>
                <div className="border border-slate-200 rounded-md overflow-hidden overflow-x-auto shadow-sm">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow className="hover:bg-slate-50">
                        <TableHead className="font-bold text-slate-700 w-[40%]">
                          Change Management monitoring in relation to:
                        </TableHead>
                        <TableHead className="font-bold text-slate-700 w-[12%]">
                          Action Required
                        </TableHead>
                        <TableHead className="font-bold text-slate-700">
                          Notes
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailsOfChanges.map((change, idx) => (
                        <TableRow
                          key={idx}
                          className="divide-x divide-slate-100 bg-white hover:bg-slate-50 transition-colors"
                        >
                          <TableCell className="font-medium text-slate-700 py-3">
                            {change.item}
                          </TableCell>
                          <TableCell className="text-center align-middle py-3">
                            <input
                              type="checkbox"
                              className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                              checked={change.actionRequired}
                              onChange={(e) => {
                                const newChanges = [...detailsOfChanges];
                                newChanges[idx].actionRequired = e.target.checked;
                                setDetailsOfChanges(newChanges);
                              }}
                            />
                          </TableCell>
                          <TableCell className="p-0">
                            <Input
                              className="border-0 focus-visible:ring-0 rounded-none bg-transparent h-full min-h-[44px] px-4"
                              value={change.notes}
                              placeholder="Add notes..."
                              onChange={(e) => {
                                const newChanges = [...detailsOfChanges];
                                newChanges[idx].notes = e.target.value;
                                setDetailsOfChanges(newChanges);
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Audit Participants */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
                  Audit Participants
                </h3>
                <div className="border border-slate-200 rounded-md overflow-hidden overflow-x-auto shadow-sm">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow className="hover:bg-slate-50">
                        <TableHead className="font-bold text-slate-700 w-[25%]">
                          Name
                        </TableHead>
                        <TableHead className="font-bold text-slate-700 w-[25%]">
                          Position
                        </TableHead>
                        <TableHead className="font-bold text-slate-700 w-[10%] text-center leading-tight">
                          Opening
                          <br />
                          meeting
                        </TableHead>
                        <TableHead className="font-bold text-slate-700 w-[10%] text-center leading-tight">
                          Closing
                          <br />
                          meeting
                        </TableHead>
                        <TableHead className="font-bold text-slate-700 w-[25%] leading-tight">
                          Interviewed
                          <br />
                          (processes)
                        </TableHead>
                        <TableHead className="w-[5%]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {participants.map((p, idx) => (
                        <TableRow
                          key={idx}
                          className="divide-x divide-slate-100 bg-white hover:bg-slate-50 transition-colors"
                        >
                          <TableCell className="p-0">
                            <Input
                              placeholder="Name..."
                              className="border-0 focus-visible:ring-0 rounded-none bg-transparent min-h-[44px] px-4"
                              value={p.name}
                              onChange={(e) => {
                                const n = [...participants];
                                n[idx].name = e.target.value;
                                setParticipants(n);
                              }}
                            />
                          </TableCell>
                          <TableCell className="p-0">
                            <Input
                              placeholder="Position..."
                              className="border-0 focus-visible:ring-0 rounded-none bg-transparent min-h-[44px] px-4"
                              value={p.position}
                              onChange={(e) => {
                                const n = [...participants];
                                n[idx].position = e.target.value;
                                setParticipants(n);
                              }}
                            />
                          </TableCell>
                          <TableCell className="text-center align-middle">
                            <input
                              type="checkbox"
                              className="w-4 h-4 cursor-pointer text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                              checked={p.opening}
                              onChange={(e) => {
                                const n = [...participants];
                                n[idx].opening = e.target.checked;
                                setParticipants(n);
                              }}
                            />
                          </TableCell>
                          <TableCell className="text-center align-middle">
                            <input
                              type="checkbox"
                              className="w-4 h-4 cursor-pointer text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                              checked={p.closing}
                              onChange={(e) => {
                                const n = [...participants];
                                n[idx].closing = e.target.checked;
                                setParticipants(n);
                              }}
                            />
                          </TableCell>
                          <TableCell className="p-0">
                            <Input
                              placeholder="Processes..."
                              className="border-0 focus-visible:ring-0 rounded-none bg-transparent min-h-[44px] px-4"
                              value={p.interviewed}
                              onChange={(e) => {
                                const n = [...participants];
                                n[idx].interviewed = e.target.value;
                                setParticipants(n);
                              }}
                            />
                          </TableCell>
                          <TableCell className="p-2 text-center">
                            {participants.length > 1 && (
                              <Trash2
                                className="w-4 h-4 text-slate-400 cursor-pointer hover:text-red-500 mx-auto transition-colors"
                                onClick={() => removeParticipant(idx)}
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="bg-white p-3 border-t border-slate-200 flex justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addParticipant}
                      className="gap-2 text-slate-600 border-dashed border-slate-300 hover:bg-slate-50 hover:text-slate-900 w-full max-w-xs"
                    >
                      <Plus className="w-4 h-4" /> Add Participant
                    </Button>
                  </div>
                </div>
              </div>

              {/* Audit Findings Summary */}
              <div className="space-y-6 pt-6 border-t border-slate-100 mt-8">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    Global Findings Log
                  </h3>

                  {/* Positive Aspects */}
                  <div className="space-y-3 mb-8">
                    <h4 className="font-semibold text-base text-slate-800">
                      Positive Aspects
                    </h4>
                    <div className="border border-slate-200 rounded-md overflow-hidden overflow-x-auto shadow-sm">
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow className="hover:bg-slate-50">
                            <TableHead className="font-bold text-slate-700 w-[8%]">
                              No.
                            </TableHead>
                            <TableHead className="font-bold text-slate-700 w-[20%]">
                              Standard &<br />
                              Clause No.
                            </TableHead>
                            <TableHead className="font-bold text-slate-700 w-[25%]">
                              Area / Process
                            </TableHead>
                            <TableHead className="font-bold text-slate-700">
                              Positive Aspect
                            </TableHead>
                            <TableHead className="w-[5%]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {positiveAspects.map((pa, idx) => (
                            <TableRow
                              key={idx}
                              className="divide-x divide-slate-100 bg-white hover:bg-slate-50 transition-colors"
                            >
                              <TableCell className="font-bold text-slate-500 bg-slate-50/50 text-center">
                                {pa.id}
                              </TableCell>
                              <TableCell className="p-0">
                                <Input
                                  className="border-0 focus-visible:ring-0 rounded-none bg-transparent min-h-[44px] px-4"
                                  placeholder="e.g. 7.1"
                                  value={pa.standardClause}
                                  onChange={(e) => {
                                    const n = [...positiveAspects];
                                    n[idx].standardClause = e.target.value;
                                    setPositiveAspects(n);
                                  }}
                                />
                              </TableCell>
                              <TableCell className="p-0">
                                <Input
                                  className="border-0 focus-visible:ring-0 rounded-none bg-transparent min-h-[44px] px-4"
                                  placeholder="e.g. HR"
                                  value={pa.areaProcess}
                                  onChange={(e) => {
                                    const n = [...positiveAspects];
                                    n[idx].areaProcess = e.target.value;
                                    setPositiveAspects(n);
                                  }}
                                />
                              </TableCell>
                              <TableCell className="p-0">
                                <Input
                                  className="border-0 focus-visible:ring-0 rounded-none bg-transparent min-h-[44px] px-4"
                                  placeholder="Detail..."
                                  value={pa.aspect}
                                  onChange={(e) => {
                                    const n = [...positiveAspects];
                                    n[idx].aspect = e.target.value;
                                    setPositiveAspects(n);
                                  }}
                                />
                              </TableCell>
                              <TableCell className="p-2 text-center">
                                {positiveAspects.length > 1 && (
                                  <Trash2
                                    className="w-4 h-4 text-slate-400 cursor-pointer hover:text-red-500 mx-auto transition-colors"
                                    onClick={() => removePositiveAspect(idx)}
                                  />
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <div className="bg-white p-3 border-t border-slate-200 flex justify-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={addPositiveAspect}
                          className="gap-2 text-slate-600 border-dashed border-slate-300 hover:bg-slate-50 hover:text-slate-900 w-full max-w-xs"
                        >
                          <Plus className="w-4 h-4" /> Add Row
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Opportunities for Improvement */}
                  <div className="space-y-3 mb-8">
                    <div>
                      <h4 className="font-semibold text-base text-slate-800">
                        Opportunities for Improvement (OFI)
                      </h4>
                      <p className="text-sm text-slate-500 mt-1">
                        Recommendations to ensure continuous improvement.
                      </p>
                    </div>
                    <div className="border border-slate-200 rounded-md overflow-hidden overflow-x-auto shadow-sm">
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow className="hover:bg-slate-50">
                            <TableHead className="font-bold text-slate-700 w-[8%]">
                              No.
                            </TableHead>
                            <TableHead className="font-bold text-slate-700 w-[20%]">
                              Standard
                              <br />
                              Clause
                            </TableHead>
                            <TableHead className="font-bold text-slate-700 w-[25%]">
                              Area / Process
                            </TableHead>
                            <TableHead className="font-bold text-slate-700">
                              Opportunity for Improvement
                            </TableHead>
                            <TableHead className="w-[5%]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {opportunities.map((ofi, idx) => (
                            <TableRow
                              key={idx}
                              className="divide-x divide-slate-100 bg-white hover:bg-slate-50 transition-colors"
                            >
                              <TableCell className="font-bold text-amber-600 bg-slate-50/50 text-center">
                                {ofi.id}
                              </TableCell>
                              <TableCell className="p-0">
                                <Input
                                  className="border-0 focus-visible:ring-0 rounded-none bg-transparent min-h-[44px] px-4"
                                  placeholder="e.g. 8.2"
                                  value={ofi.standardClause}
                                  onChange={(e) => {
                                    const n = [...opportunities];
                                    n[idx].standardClause = e.target.value;
                                    setOpportunities(n);
                                  }}
                                />
                              </TableCell>
                              <TableCell className="p-0">
                                <Input
                                  className="border-0 focus-visible:ring-0 rounded-none bg-transparent min-h-[44px] px-4"
                                  placeholder="e.g. Production"
                                  value={ofi.areaProcess}
                                  onChange={(e) => {
                                    const n = [...opportunities];
                                    n[idx].areaProcess = e.target.value;
                                    setOpportunities(n);
                                  }}
                                />
                              </TableCell>
                              <TableCell className="p-0">
                                <Input
                                  className="border-0 focus-visible:ring-0 rounded-none bg-transparent min-h-[44px] px-4"
                                  placeholder="Detail..."
                                  value={ofi.opportunity}
                                  onChange={(e) => {
                                    const n = [...opportunities];
                                    n[idx].opportunity = e.target.value;
                                    setOpportunities(n);
                                  }}
                                />
                              </TableCell>
                              <TableCell className="p-2 text-center">
                                {opportunities.length > 1 && (
                                  <Trash2
                                    className="w-4 h-4 text-slate-400 cursor-pointer hover:text-red-500 mx-auto transition-colors"
                                    onClick={() => removeOpportunity(idx)}
                                  />
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <div className="bg-white p-3 border-t border-slate-200 flex justify-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={addOpportunity}
                          className="gap-2 text-slate-600 border-dashed border-slate-300 hover:bg-slate-50 hover:text-slate-900 w-full max-w-xs"
                        >
                          <Plus className="w-4 h-4" /> Add Row
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Non-conformance */}
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-semibold text-base text-slate-800">
                        Non-conformances (NCR)
                      </h4>
                      <p className="text-sm text-slate-500 mt-1">
                        Incomplete compliance requiring corrective action.
                      </p>
                    </div>
                    <div className="border border-slate-200 rounded-md overflow-hidden overflow-x-auto shadow-sm">
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow className="hover:bg-slate-50">
                            <TableHead className="font-bold text-slate-700 w-[8%]">
                              No.
                            </TableHead>
                            <TableHead className="font-bold text-slate-700 w-[18%]">
                              Standard &<br />
                              Clause No.
                            </TableHead>
                            <TableHead className="font-bold text-slate-700 w-[20%]">
                              Area / Process
                            </TableHead>
                            <TableHead className="font-bold text-slate-700">
                              Statement of Non-conformance
                            </TableHead>
                            <TableHead className="font-bold text-slate-700 w-[15%]">
                              Due Date
                            </TableHead>
                            <TableHead className="font-bold text-slate-700 w-[13%]">
                              Action By
                            </TableHead>
                            <TableHead className="w-[5%]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {nonConformances.map((ncr, idx) => (
                            <TableRow
                              key={idx}
                              className="divide-x divide-slate-100 bg-white hover:bg-slate-50 transition-colors"
                            >
                              <TableCell className="font-bold text-red-600 bg-slate-50/50 text-center">
                                {ncr.id}
                              </TableCell>
                              <TableCell className="p-0">
                                <Input
                                  className="border-0 focus-visible:ring-0 rounded-none bg-transparent min-h-[44px] px-4"
                                  placeholder="e.g. 9.1"
                                  value={ncr.standardClause}
                                  onChange={(e) => {
                                    const n = [...nonConformances];
                                    n[idx].standardClause = e.target.value;
                                    setNonConformances(n);
                                  }}
                                />
                              </TableCell>
                              <TableCell className="p-0">
                                <Input
                                  className="border-0 focus-visible:ring-0 rounded-none bg-transparent min-h-[44px] px-4"
                                  placeholder="e.g. QA"
                                  value={ncr.areaProcess}
                                  onChange={(e) => {
                                    const n = [...nonConformances];
                                    n[idx].areaProcess = e.target.value;
                                    setNonConformances(n);
                                  }}
                                />
                              </TableCell>
                              <TableCell className="p-0">
                                <Textarea
                                  className="min-h-[44px] border-0 focus-visible:ring-0 rounded-none bg-transparent resize-y p-3"
                                  placeholder="Detail..."
                                  value={ncr.statement}
                                  onChange={(e) => {
                                    const n = [...nonConformances];
                                    n[idx].statement = e.target.value;
                                    setNonConformances(n);
                                  }}
                                />
                              </TableCell>
                              <TableCell className="p-0">
                                <Input
                                  type="date"
                                  className="border-0 focus-visible:ring-0 rounded-none bg-transparent min-h-[44px] px-4"
                                  value={ncr.dueDate}
                                  onChange={(e) => {
                                    const n = [...nonConformances];
                                    n[idx].dueDate = e.target.value;
                                    setNonConformances(n);
                                  }}
                                />
                              </TableCell>
                              <TableCell className="p-0">
                                <Input
                                  className="border-0 focus-visible:ring-0 rounded-none bg-transparent min-h-[44px] px-4"
                                  placeholder="Responsible person..."
                                  value={ncr.actionBy || ""}
                                  onChange={(e) => {
                                    const n = [...nonConformances];
                                    n[idx].actionBy = e.target.value;
                                    setNonConformances(n);
                                  }}
                                />
                              </TableCell>
                              <TableCell className="p-2 text-center">
                                {nonConformances.length > 1 && (
                                  <Trash2
                                    className="w-4 h-4 text-slate-400 cursor-pointer hover:text-red-500 mx-auto transition-colors"
                                    onClick={() => removeNonConformance(idx)}
                                  />
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <div className="bg-white p-3 border-t border-slate-200 flex justify-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={addNonConformance}
                          className="gap-2 text-slate-600 border-dashed border-slate-300 hover:bg-slate-50 hover:text-slate-900 w-full max-w-xs"
                        >
                          <Plus className="w-4 h-4" /> Add Row
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}


        {/* Findings Summary Table */}
        {focusFindings && findingsList.length > 0 && (
          <Card className="overflow-hidden border border-slate-200 shadow-md mb-8">
            <div className="bg-slate-800 px-6 py-4 border-b border-slate-700">
              <h3 className="text-white font-bold flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-400" />
                Audit Findings Summary
              </h3>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow className="divide-x divide-slate-200">
                    <TableHead className="w-12 text-center font-bold text-slate-700">#</TableHead>
                    <TableHead className="w-[15%] font-bold text-slate-700">Clause / Ref</TableHead>
                    <TableHead className="w-[10%] font-bold text-slate-700">Type</TableHead>
                    <TableHead className="w-[45%] font-bold text-slate-700">
                      <div className="grid grid-cols-3 gap-4">
                        <span>Action By</span>
                        <span>Close Date</span>
                        <span>Assign To</span>
                      </div>
                    </TableHead>
                    <TableHead className="w-12 text-center font-bold text-slate-700">Go</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {findingsList.map((f, idx) => (
                    <TableRow key={`${f.source}-${f.id}`} className="divide-x divide-slate-100 hover:bg-slate-50 transition-colors">
                      <TableCell className="text-center font-medium text-slate-500">{idx + 1}</TableCell>
                      <TableCell className="font-bold text-slate-900">{f.ref}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider text-white ${f.type === 'OFI' ? 'bg-amber-500' : f.type === 'Minor' ? 'bg-orange-600' : 'bg-red-600'
                          }`}>
                          {f.type}
                        </span>
                      </TableCell>
                      <TableCell className="p-0">
                        <div className="grid grid-cols-3 divide-x divide-slate-100">
                          <Input
                            className="border-0 focus-visible:ring-0 rounded-none bg-transparent h-12 px-4 shadow-none text-sm"
                            placeholder="Action By..."
                            value={f.actionBy}
                            onChange={(e) => {
                              if (f.source === 'clause') handleClauseChange(f.id, 'actionBy', e.target.value);
                              else if (f.source === 'checklist') handleChecklistChange(Number(f.id), 'actionBy', e.target.value);
                              else if (f.source === 'process') updateProcessAudit(Number(f.id), 'actionBy', e.target.value);
                            }}
                          />
                          <Input
                            type="date"
                            className="border-0 focus-visible:ring-0 rounded-none bg-transparent h-12 px-4 shadow-none text-sm"
                            value={f.closeDate}
                            onChange={(e) => {
                              if (f.source === 'clause') handleClauseChange(f.id, 'closeDate', e.target.value);
                              else if (f.source === 'checklist') handleChecklistChange(Number(f.id), 'closeDate', e.target.value);
                              else if (f.source === 'process') updateProcessAudit(Number(f.id), 'closeDate', e.target.value);
                            }}
                          />
                          <Input
                            className="border-0 focus-visible:ring-0 rounded-none bg-transparent h-12 px-4 shadow-none text-sm"
                            placeholder="Assign To..."
                            value={f.assignTo}
                            onChange={(e) => {
                              if (f.source === 'clause') handleClauseChange(f.id, 'assignTo', e.target.value);
                              else if (f.source === 'checklist') handleChecklistChange(Number(f.id), 'assignTo', e.target.value);
                              else if (f.source === 'process') updateProcessAudit(Number(f.id), 'assignTo', e.target.value);
                            }}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-slate-400 hover:text-emerald-600"
                          onClick={() => {
                            const el = document.getElementById(`finding-${f.source}-${f.id}`);
                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }}
                        >
                          <ArrowDown className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}

        <div className="flex items-center gap-3">
          <div className="h-0.5 flex-1 bg-slate-200"></div>
          <span className="text-sm font-bold text-slate-400 uppercase tracking-widest px-2">
            Audit Checklist
          </span>
          <div className="h-0.5 flex-1 bg-slate-200"></div>
        </div>

        {/* --- TEMPLATE DYNAMIC CHECKLIST --- */}
        {template.type === "clause-checklist" ? (
          <div className="space-y-6">
            {clausesToRender.map((clause) => {
              const currentData =
                clauseData[clause.id] || ({} as ClauseChecklistContent);
              const type = currentData.findingType;

              if (focusFindings && !['OFI', 'Minor', 'Major'].includes(type as string)) {
                return null;
              }

              const showExtended =
                type === "Minor" || type === "Major" || type === "OFI";

              return (
                <Card
                  key={clause.id}
                  className="overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Header */}
                  <div className="bg-slate-800 text-white p-4">
                    <h3 className="text-xl font-bold flex items-center gap-3">
                      <span className="bg-white/20 px-2 py-0.5 rounded text-sm shrink-0">
                        Clause {clause.id}
                      </span>
                      {clause.name}
                    </h3>
                  </div>

                  <CardContent className="p-5 bg-white text-slate-900 flex flex-col gap-6">
                    {/* Finding Type Selector */}
                    <div className="flex flex-wrap md:flex-nowrap items-center gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                      <span className="text-sm font-bold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                        Finding Type:
                      </span>
                      <div className="flex gap-2 flex-wrap">
                        {[
                          { label: "OFI", value: "OFI", color: "bg-amber-500" },
                          {
                            label: "Minor N/C",
                            value: "Minor",
                            color: "bg-orange-600",
                          },
                          {
                            label: "Major N/C",
                            value: "Major",
                            color: "bg-red-600",
                          },
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() =>
                              handleClauseChange(
                                clause.id,
                                "findingType",
                                opt.value,
                              )
                            }
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all border shadow-sm ${type === opt.value
                              ? `${opt.color} text-white border-transparent scale-[1.02] shadow-md ring-2 ring-slate-200 ring-offset-1`
                              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                              }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Initial Finding Input */}
                    {!showExtended && (
                      <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                        <Label className="text-sm font-bold text-slate-700">
                          Finding Details
                        </Label>
                        <Textarea
                          className="bg-slate-50/50 border-slate-200 text-slate-900 placeholder:text-slate-400 min-h-[100px] resize-y p-4 text-base focus:bg-white transition-colors"
                          placeholder="Enter initial audit evidence / findings..."
                          value={currentData.findingDetails || ""}
                          onChange={(e) =>
                            handleClauseChange(
                              clause.id,
                              "findingDetails",
                              e.target.value,
                            )
                          }
                        />
                      </div>
                    )}

                    {/* Extended Fields for Non-Compliance/OFI */}
                    {showExtended && (
                      <div className="space-y-5 pt-5 border-t border-slate-100 animate-in fade-in slide-in-from-top-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div
                            className={`px-2 py-0.5 rounded text-xs font-bold text-white uppercase tracking-wider
                                                    ${type === "OFI" ? "bg-amber-500" : type === "Minor" ? "bg-orange-600" : "bg-red-600"}`}
                          >
                            {type} Details
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label className="text-sm font-bold text-slate-700 flex items-center gap-1">
                              Description of Finding{" "}
                              {type !== "OFI" && (
                                <span className="text-red-500">*</span>
                              )}
                            </Label>
                            <Textarea
                              className="bg-white border-slate-200 text-slate-900 min-h-[120px] resize-y p-3 focus:ring-slate-400"
                              value={currentData.description || ""}
                              onChange={(e) =>
                                handleClauseChange(
                                  clause.id,
                                  "description",
                                  e.target.value,
                                )
                              }
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-sm font-bold text-slate-700 flex items-center gap-1">
                              Correction Done{" "}
                              {type !== "OFI" && (
                                <span className="text-red-500">*</span>
                              )}
                            </Label>
                            <Textarea
                              className="bg-white border-slate-200 text-slate-900 min-h-[120px] resize-y p-3 focus:ring-slate-400"
                              placeholder="Immediate action taken..."
                              value={currentData.correction || ""}
                              onChange={(e) =>
                                handleClauseChange(
                                  clause.id,
                                  "correction",
                                  e.target.value,
                                )
                              }
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-sm font-bold text-slate-700 flex items-center gap-1">
                              Root Cause{" "}
                              {type !== "OFI" && (
                                <span className="text-red-500">*</span>
                              )}
                            </Label>
                            <Textarea
                              className="bg-white border-slate-200 text-slate-900 min-h-[120px] resize-y p-3 focus:ring-slate-400"
                              placeholder="Why did this occur?"
                              value={currentData.rootCause || ""}
                              onChange={(e) =>
                                handleClauseChange(
                                  clause.id,
                                  "rootCause",
                                  e.target.value,
                                )
                              }
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-sm font-bold text-slate-700 flex items-center gap-1">
                              Corrective Action{" "}
                              {type !== "OFI" && (
                                <span className="text-red-500">*</span>
                              )}
                            </Label>
                            <Textarea
                              className="bg-white border-slate-200 text-slate-900 min-h-[120px] resize-y p-3 focus:ring-slate-400"
                              placeholder="Action to prevent recurrence..."
                              value={currentData.correctiveAction || ""}
                              onChange={(e) =>
                                handleClauseChange(
                                  clause.id,
                                  "correctiveAction",
                                  e.target.value,
                                )
                              }
                            />
                          </div>
                        </div>

                        {/* Action By / Close Date / Assign To row for Clause Checklist */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                          <div className="space-y-2">
                            <Label className="text-sm font-bold text-slate-700">
                              Action By
                            </Label>
                            <Input
                              className="bg-white border-slate-200 text-slate-900"
                              placeholder="Who is responsible..."
                              value={currentData.actionBy || ""}
                              onChange={(e) =>
                                handleClauseChange(clause.id, "actionBy", e.target.value)
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-bold text-slate-700">
                              Close Date
                            </Label>
                            <Input
                              type="date"
                              className="bg-white border-slate-200 text-slate-900"
                              value={currentData.closeDate || ""}
                              onChange={(e) =>
                                handleClauseChange(clause.id, "closeDate", e.target.value)
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-bold text-slate-700">
                              Assign To
                            </Label>
                            <Input
                              className="bg-white border-slate-200 text-slate-900"
                              placeholder="Department or Person..."
                              value={currentData.assignTo || ""}
                              onChange={(e) =>
                                handleClauseChange(clause.id, "assignTo", e.target.value)
                              }
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Footer / Upload */}
                    <div className="border-t border-slate-200 pt-3 mt-2 flex flex-col gap-3">
                      <label className="flex items-center justify-center p-4 border border-dashed border-slate-300 rounded-lg hover:bg-slate-50 bg-slate-50/50 cursor-pointer transition-colors group">
                        <input
                          type="file"
                          multiple
                          className="hidden"
                          onChange={(e) => handleGenericFileUpload(`clause_checklist_${clause.id}`, e.target.files)}
                        />
                        <div className="flex items-center gap-2 text-slate-500 group-hover:text-slate-700">
                          <Upload className="w-4 h-4" />
                          <span>Add / Upload / Insert record or picture</span>
                        </div>
                      </label>

                      {genericFiles[`clause_checklist_${clause.id}`] && genericFiles[`clause_checklist_${clause.id}`].length > 0 && (
                        <div className="w-full flex flex-col gap-2 p-2">
                          <span className="text-xs font-bold text-slate-500 uppercase">Attached Files</span>
                          <div className="flex flex-wrap gap-2">
                            {genericFiles[`clause_checklist_${clause.id}`].map((file, fileIdx) => (
                              <div key={fileIdx} className="flex items-center gap-2 bg-slate-50 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-md text-xs shadow-sm">
                                <FileText className="w-4 h-4 text-emerald-600" />
                                <span className="max-w-[150px] truncate" title={file.name}>{file.name}</span>
                                <Trash2
                                  className="w-3.5 h-3.5 text-slate-400 hover:text-red-500 cursor-pointer ml-1 transition-colors"
                                  onClick={() => removeGenericFile(`clause_checklist_${clause.id}`, fileIdx)}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : template.type === "section" ? (
          <div className="space-y-6">
            {(template.content as SectionContent[]).map((section, index) => (
              <Card
                key={index}
                className="overflow-hidden border border-slate-200 shadow-sm"
              >
                <CardHeader className="bg-slate-800 text-white py-4 px-5">
                  <CardTitle className="text-xl font-bold">
                    {section.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 bg-white">
                  <Textarea
                    className="min-h-[150px] text-sm resize-y p-5 text-base border-0 focus-visible:ring-0 rounded-none"
                    placeholder={`Enter findings for ${section.title}...`}
                    value={sectionData[index] || ""}
                    onChange={(e) => handleSectionChange(index, e.target.value)}
                  />

                  <div className="border-t border-slate-100 bg-slate-50 mt-4 flex flex-col items-center justify-center rounded-b-lg -mx-4 -mb-4">
                    <label className="w-full p-3 flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-100 transition-colors text-slate-500 text-sm">
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => handleGenericFileUpload(`section_${index}`, e.target.files)}
                      />
                      <Upload className="w-4 h-4" />
                      <span>Add / Upload / Insert record or picture</span>
                    </label>

                    {genericFiles[`section_${index}`] && genericFiles[`section_${index}`].length > 0 && (
                      <div className="w-full p-3 border-t border-slate-200 bg-white flex flex-col gap-2">
                        <span className="text-xs font-bold text-slate-500 uppercase px-1">Attached Files</span>
                        <div className="flex flex-wrap gap-2">
                          {genericFiles[`section_${index}`].map((file, fileIdx) => (
                            <div key={fileIdx} className="flex items-center gap-2 bg-slate-50 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-md text-xs shadow-sm">
                              <FileText className="w-4 h-4 text-emerald-600" />
                              <span className="max-w-[150px] truncate" title={file.name}>{file.name}</span>
                              <Trash2
                                className="w-3.5 h-3.5 text-slate-400 hover:text-red-500 cursor-pointer ml-1 transition-colors"
                                onClick={() => removeGenericFile(`section_${index}`, fileIdx)}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : template.type === "process-audit" ? (
          <div className="space-y-8">
            {/* Process Audit Configuration Header */}
            {!focusFindings && (
              <div className="bg-slate-900 text-white rounded-xl p-6 shadow-md border border-slate-800 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-700 pb-4">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <FileText className="w-5 h-5 text-emerald-400" />
                    Process Audit Report Options
                  </h3>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-3 bg-slate-800 px-4 py-2 rounded-lg cursor-pointer hover:bg-slate-700 transition-colors border border-slate-700">
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-emerald-500 rounded border-slate-600 focus:ring-emerald-500 cursor-pointer"
                        checked={showExecutiveSummary}
                        onChange={(e) => setShowExecutiveSummary(e.target.checked)}
                      />
                      <span className="text-sm font-bold text-slate-200">
                        Executive Summary
                      </span>
                    </label>
                    <label className="flex items-center gap-3 bg-slate-800 px-4 py-2 rounded-lg cursor-pointer hover:bg-slate-700 transition-colors border border-slate-700">
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-emerald-500 rounded border-slate-600 focus:ring-emerald-500 cursor-pointer"
                        checked={showAuditParticipants}
                        onChange={(e) => setShowAuditParticipants(e.target.checked)}
                      />
                      <span className="text-sm font-bold text-slate-200">
                        Audit Participants
                      </span>
                    </label>
                    <label className="flex items-center gap-3 bg-slate-800 px-4 py-2 rounded-lg cursor-pointer hover:bg-slate-700 transition-colors border border-slate-700">
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-emerald-500 rounded border-slate-600 focus:ring-emerald-500 cursor-pointer"
                        checked={showAuditFindings}
                        onChange={(e) => setShowAuditFindings(e.target.checked)}
                      />
                      <span className="text-sm font-bold text-slate-200">
                        Audit Findings
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Executive Summary & Findings Overview */}
            {!focusFindings && (showExecutiveSummary ||
              showAuditParticipants ||
              showAuditFindings) && (
                <div className="space-y-8 bg-white rounded-xl p-6 shadow-sm border border-slate-200 mt-6">
                  {/* Metadata Table (The requested 3 columns) */}
                  <div className="bg-white rounded-lg overflow-hidden border border-slate-200">
                    <Table>
                      <TableHeader className="bg-slate-800">
                        <TableRow className="hover:bg-slate-800 divide-x divide-slate-600">
                          <TableHead className="font-bold text-white px-4 py-3">Reference No.</TableHead>
                          <TableHead className="font-bold text-white px-4 py-3">ISO Standard / Clause No.</TableHead>
                          <TableHead className="font-bold text-white px-4 py-3">Department / Area</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow className="bg-white divide-x divide-slate-200">
                          <TableCell className="p-0">
                            <Input
                              className="border-0 focus-visible:ring-0 rounded-none bg-transparent h-12 px-4 shadow-none"
                              placeholder="Enter Reference No..."
                              value={auditGlobalInfo.refNo}
                              onChange={(e) => setAuditGlobalInfo({ ...auditGlobalInfo, refNo: e.target.value })}
                            />
                          </TableCell>
                          <TableCell className="p-0">
                            <Input
                              className="border-0 focus-visible:ring-0 rounded-none bg-transparent h-12 px-4 shadow-none"
                              placeholder="Enter Standard or Clause..."
                              value={auditGlobalInfo.clauseNo}
                              onChange={(e) => setAuditGlobalInfo({ ...auditGlobalInfo, clauseNo: e.target.value })}
                            />
                          </TableCell>
                          <TableCell className="p-0">
                            <Input
                              className="border-0 focus-visible:ring-0 rounded-none bg-transparent h-12 px-4 shadow-none"
                              placeholder="Enter Department or Area..."
                              value={auditGlobalInfo.department}
                              onChange={(e) => setAuditGlobalInfo({ ...auditGlobalInfo, department: e.target.value })}
                            />
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  {showExecutiveSummary && (
                    <div className="space-y-4">
                      <h3 className="text-xl font-bold text-slate-900 border-b border-slate-200 pb-2">
                        Executive Summary
                      </h3>
                      <div className="border-2 border-slate-800 rounded-lg overflow-hidden shadow-sm bg-white">
                        <Textarea
                          className="min-h-[200px] border-0 border-b border-slate-800 rounded-none focus-visible:ring-0 resize-y p-6 text-base bg-white placeholder:text-slate-300"
                          placeholder="Type your overall audit summary here..."
                          value={executiveSummary}
                          onChange={(e) => setExecutiveSummary(e.target.value)}
                        />
                        {/* Refined Executive Summary Table - Single row with 8 cells */}
                        <Table>
                          <TableHeader className="bg-slate-800">
                            <TableRow className="hover:bg-slate-800 border-b-0 divide-x divide-slate-600">
                              <TableHead className="font-bold text-white border-none px-4 py-3 text-center text-xs">Major NCs</TableHead>
                              <TableHead className="bg-white p-0 w-16"></TableHead>
                              <TableHead className="font-bold text-white border-none px-4 py-3 text-center text-xs">Minor NCs</TableHead>
                              <TableHead className="bg-white p-0 w-16"></TableHead>
                              <TableHead className="font-bold text-white border-none px-4 py-3 text-center text-xs">OFIs</TableHead>
                              <TableHead className="bg-white p-0 w-16"></TableHead>
                              <TableHead className="font-bold text-white border-none px-4 py-3 text-center text-xs whitespace-nowrap">Positive Aspect</TableHead>
                              <TableHead className="bg-white p-0 w-16"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow className="bg-white hover:bg-slate-50 transition-colors border-0 divide-x divide-slate-200">
                              <TableCell className="p-0 bg-slate-800"></TableCell>
                              <TableCell className="p-0">
                                <Input
                                  className="border-0 focus-visible:ring-0 rounded-none bg-transparent h-10 px-2 shadow-none text-center font-bold"
                                  value={summaryCounts.major}
                                  onChange={(e) => setSummaryCounts({ ...summaryCounts, major: e.target.value })}
                                />
                              </TableCell>
                              <TableCell className="p-0 bg-slate-800"></TableCell>
                              <TableCell className="p-0">
                                <Input
                                  className="border-0 focus-visible:ring-0 rounded-none bg-transparent h-10 px-2 shadow-none text-center font-bold"
                                  value={summaryCounts.minor}
                                  onChange={(e) => setSummaryCounts({ ...summaryCounts, minor: e.target.value })}
                                />
                              </TableCell>
                              <TableCell className="p-0 bg-slate-800"></TableCell>
                              <TableCell className="p-0">
                                <Input
                                  className="border-0 focus-visible:ring-0 rounded-none bg-transparent h-10 px-2 shadow-none text-center font-bold"
                                  value={summaryCounts.ofi}
                                  onChange={(e) => setSummaryCounts({ ...summaryCounts, ofi: e.target.value })}
                                />
                              </TableCell>
                              <TableCell className="p-0 bg-slate-800"></TableCell>
                              <TableCell className="p-0">
                                <Input
                                  className="border-0 focus-visible:ring-0 rounded-none bg-transparent h-10 px-2 shadow-none text-center font-bold"
                                  value={summaryCounts.positive}
                                  onChange={(e) => setSummaryCounts({ ...summaryCounts, positive: e.target.value })}
                                />
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {showAuditParticipants && (
                    <div className="space-y-4 pt-4 border-t border-slate-100">
                      <h3 className="text-xl font-bold text-slate-900 border-b border-slate-200 pb-2">
                        Audit Participants
                      </h3>
                      <div className="border-2 border-slate-800 rounded-lg overflow-hidden overflow-x-auto shadow-sm">
                        <Table>
                          <TableHeader className="bg-slate-800">
                            <TableRow className="hover:bg-slate-800 divide-x divide-slate-600">
                              <TableHead className="font-bold text-white w-[25%] px-4 py-3">
                                Name
                              </TableHead>
                              <TableHead className="font-bold text-white w-[25%] px-4 py-3">
                                Position
                              </TableHead>
                              <TableHead className="font-bold text-white w-[12%] text-center px-2 py-3 leading-tight">
                                Opening meeting
                              </TableHead>
                              <TableHead className="font-bold text-white w-[12%] text-center px-2 py-3 leading-tight">
                                Closing meeting
                              </TableHead>
                              <TableHead className="font-bold text-white w-[26%] px-4 py-3 leading-tight">
                                Interviewed (processes)
                              </TableHead>
                              <TableHead className="w-[50px] bg-slate-800"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {participants.map((p, idx) => (
                              <TableRow
                                key={idx}
                                className="bg-white hover:bg-slate-50 transition-colors divide-x divide-slate-200"
                              >
                                <TableCell className="p-0">
                                  <Input
                                    placeholder="Enter Name..."
                                    className="border-0 focus-visible:ring-0 rounded-none bg-transparent min-h-[48px] px-4 shadow-none"
                                    value={p.name}
                                    onChange={(e) => {
                                      const n = [...participants];
                                      n[idx].name = e.target.value;
                                      setParticipants(n);
                                    }}
                                  />
                                </TableCell>
                                <TableCell className="p-0">
                                  <Input
                                    placeholder="Enter Position..."
                                    className="border-0 focus-visible:ring-0 rounded-none bg-transparent min-h-[48px] px-4 shadow-none"
                                    value={p.position}
                                    onChange={(e) => {
                                      const n = [...participants];
                                      n[idx].position = e.target.value;
                                      setParticipants(n);
                                    }}
                                  />
                                </TableCell>
                                <TableCell className="p-0 text-center align-middle">
                                  <div className="flex justify-center items-center h-full min-h-[48px]">
                                    <input
                                      type="checkbox"
                                      className="w-4 h-4 cursor-pointer accent-emerald-600"
                                      checked={p.opening}
                                      onChange={(e) => {
                                        const n = [...participants];
                                        n[idx].opening = e.target.checked;
                                        setParticipants(n);
                                      }}
                                    />
                                  </div>
                                </TableCell>
                                <TableCell className="p-0 text-center align-middle">
                                  <div className="flex justify-center items-center h-full min-h-[48px]">
                                    <input
                                      type="checkbox"
                                      className="w-4 h-4 cursor-pointer accent-emerald-600"
                                      checked={p.closing}
                                      onChange={(e) => {
                                        const n = [...participants];
                                        n[idx].closing = e.target.checked;
                                        setParticipants(n);
                                      }}
                                    />
                                  </div>
                                </TableCell>
                                <TableCell className="p-0">
                                  <Input
                                    placeholder="Enter processes interviewed..."
                                    className="border-0 focus-visible:ring-0 rounded-none bg-transparent min-h-[48px] px-4 shadow-none"
                                    value={p.interviewed}
                                    onChange={(e) => {
                                      const n = [...participants];
                                      n[idx].interviewed = e.target.value;
                                      setParticipants(n);
                                    }}
                                  />
                                </TableCell>
                                <TableCell className="p-0 text-center align-middle">
                                  {participants.length > 1 && (
                                    <Trash2
                                      className="w-4 h-4 text-slate-400 cursor-pointer hover:text-red-500 mx-auto transition-colors"
                                      onClick={() => removeParticipant(idx)}
                                    />
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        <div className="bg-slate-50 p-2 border-t border-slate-200 flex justify-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={addParticipant}
                            className="text-emerald-700 font-bold hover:bg-emerald-50 hover:text-emerald-800 gap-2 px-6"
                          >
                            <Plus className="w-4 h-4" /> Add Another Participant
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {showAuditFindings && (
                    <div className="space-y-4 pt-4 border-t border-slate-100">
                      <h3 className="text-xl font-bold text-slate-900 border-b border-slate-200 pb-2">
                        Audit Findings
                      </h3>
                      <div className="border-2 border-slate-800 rounded-lg overflow-hidden overflow-x-auto shadow-sm">
                        <Table>
                          <TableHeader className="bg-slate-800">
                            <TableRow className="hover:bg-slate-800 divide-x divide-slate-600">
                              <TableHead className="font-bold text-white w-[15%] px-4 py-3">
                                Ref No.
                              </TableHead>
                              <TableHead className="font-bold text-white w-[15%] px-4 py-3">
                                Clause No.
                              </TableHead>
                              <TableHead className="font-bold text-white w-[50%] px-4 py-3">
                                Details of finding[s] raised
                              </TableHead>
                              <TableHead className="font-bold text-white w-[20%] text-center px-4 py-3">
                                Category of Finding
                              </TableHead>
                              <TableHead className="w-[50px] bg-slate-800"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {auditFindings.map((finding, idx) => (
                              <TableRow
                                key={idx}
                                className="bg-white hover:bg-slate-50 transition-colors divide-x divide-slate-200"
                              >
                                <TableCell className="p-0">
                                  <Input
                                    className="border-0 focus-visible:ring-0 rounded-none bg-transparent min-h-[48px] px-4 shadow-none"
                                    placeholder="Ref..."
                                    value={finding.refNo}
                                    onChange={(e) => {
                                      const n = [...auditFindings];
                                      n[idx].refNo = e.target.value;
                                      setAuditFindings(n);
                                    }}
                                  />
                                </TableCell>
                                <TableCell className="p-0">
                                  <Input
                                    className="border-0 focus-visible:ring-0 rounded-none bg-transparent min-h-[48px] px-4 shadow-none"
                                    placeholder="Clause..."
                                    value={finding.clauseNo}
                                    onChange={(e) => {
                                      const n = [...auditFindings];
                                      n[idx].clauseNo = e.target.value;
                                      setAuditFindings(n);
                                    }}
                                  />
                                </TableCell>
                                <TableCell className="p-0">
                                  <Input
                                    className="border-0 focus-visible:ring-0 rounded-none bg-transparent min-h-[48px] px-4 shadow-none"
                                    placeholder="Enter finding details..."
                                    value={finding.details}
                                    onChange={(e) => {
                                      const n = [...auditFindings];
                                      n[idx].details = e.target.value;
                                      setAuditFindings(n);
                                    }}
                                  />
                                </TableCell>
                                <TableCell className="p-0">
                                  <Input
                                    className="border-0 focus-visible:ring-0 text-center rounded-none bg-transparent min-h-[48px] px-4 shadow-none"
                                    placeholder="Category..."
                                    value={finding.category}
                                    onChange={(e) => {
                                      const n = [...auditFindings];
                                      n[idx].category = e.target.value;
                                      setAuditFindings(n);
                                    }}
                                  />
                                </TableCell>
                                <TableCell className="p-0 text-center align-middle">
                                  {auditFindings.length > 1 && (
                                    <Trash2
                                      className="w-4 h-4 text-slate-400 cursor-pointer hover:text-red-500 mx-auto transition-colors"
                                      onClick={() => removeAuditFinding(idx)}
                                    />
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        <div className="bg-slate-50 p-2 border-t border-slate-200 flex justify-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={addAuditFinding}
                            className="text-emerald-700 font-bold hover:bg-emerald-50 hover:text-emerald-800 gap-2 px-6"
                          >
                            <Plus className="w-4 h-4" /> Add Another Finding
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

            {/* Repeatable Audits */}
            <div className="flex items-center gap-3 py-2 mt-8">
              <div className="h-0.5 flex-1 bg-slate-200"></div>
              <span className="text-sm font-bold text-slate-400 uppercase tracking-widest px-2">
                Audit Reports
              </span>
              <div className="h-0.5 flex-1 bg-slate-200"></div>
            </div>

            {processAudits.map((audit, index) => {
              const type = audit.findingType;

              if (focusFindings && !['OFI', 'Minor', 'Major'].includes(type as string)) {
                return null;
              }

              const showExtended =
                type === "Minor" ||
                type === "Major" ||
                type === "OFI" ||
                type === "C";

              return (
                <Card
                  key={audit.id}
                  className="overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between bg-slate-800 text-white p-4">
                    <h3 className="text-xl font-bold flex items-center gap-3">
                      <span className="bg-white/20 px-2 py-0.5 rounded text-sm shrink-0">
                        #{index + 1}
                      </span>
                      Audit Report
                    </h3>
                    {processAudits.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-white hover:bg-red-500/20 hover:text-red-400"
                        onClick={() => removeProcessAudit(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <CardContent className="p-0 bg-white text-slate-900 flex flex-col">
                    <Table>
                      <TableBody>
                        <TableRow className="border-b border-slate-100 hover:bg-transparent">
                          <TableCell className="w-[30%] font-bold text-slate-700 bg-slate-50 border-r align-top py-4">
                            Auditee[s]
                          </TableCell>
                          <TableCell className="p-0 align-top">
                            <Input
                              className="border-0 focus-visible:ring-0 rounded-none bg-transparent min-h-[50px] px-4 shadow-none"
                              value={audit.auditees}
                              onChange={(e) =>
                                updateProcessAudit(
                                  index,
                                  "auditees",
                                  e.target.value,
                                )
                              }
                            />
                          </TableCell>
                        </TableRow>
                        <TableRow className="border-b border-slate-100 hover:bg-transparent">
                          <TableCell
                            colSpan={2}
                            className="font-bold text-slate-700 bg-slate-50 p-4 border-b"
                          >
                            Evidence to support the audit conclusion
                          </TableCell>
                        </TableRow>
                        <TableRow className="border-b border-slate-100 hover:bg-transparent">
                          <TableCell colSpan={2} className="p-0">
                            <Textarea
                              className="w-full min-h-[120px] border-0 focus-visible:ring-0 rounded-none bg-transparent resize-y p-5 shadow-none"
                              value={audit.evidence}
                              onChange={(e) =>
                                updateProcessAudit(
                                  index,
                                  "evidence",
                                  e.target.value,
                                )
                              }
                            />
                          </TableCell>
                        </TableRow>
                        <TableRow className="border-b border-slate-100 hover:bg-transparent">
                          <TableCell
                            colSpan={2}
                            className="font-bold text-slate-700 bg-slate-50 p-4 border-b"
                          >
                            Conclusion of the overall effectiveness of the
                            process
                          </TableCell>
                        </TableRow>
                        <TableRow className="border-b border-slate-100 hover:bg-transparent">
                          <TableCell colSpan={2} className="p-0">
                            <Textarea
                              className="w-full min-h-[120px] border-0 focus-visible:ring-0 rounded-none bg-transparent resize-y p-5 shadow-none"
                              value={audit.conclusion}
                              onChange={(e) =>
                                updateProcessAudit(
                                  index,
                                  "conclusion",
                                  e.target.value,
                                )
                              }
                            />
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>

                    {/* Finding and details section inside the process report */}
                    <div className="p-5 border-t border-slate-100 flex flex-col gap-6 bg-slate-50/30">
                      <div className="flex flex-wrap md:flex-nowrap items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <span className="text-sm font-bold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                          Category of Finding:
                        </span>
                        <div className="flex gap-2 flex-wrap">
                          {[
                            {
                              label: "Compliant (C)",
                              value: "C",
                              color: "bg-emerald-500",
                            },
                            {
                              label: "OFI",
                              value: "OFI",
                              color: "bg-amber-500",
                            },
                            {
                              label: "Minor N/C",
                              value: "Minor",
                              color: "bg-orange-600",
                            },
                            {
                              label: "Major N/C",
                              value: "Major",
                              color: "bg-red-600",
                            },
                          ].map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() =>
                                updateProcessAudit(
                                  index,
                                  "findingType",
                                  type === opt.value
                                    ? undefined
                                    : (opt.value as any),
                                )
                              }
                              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all border shadow-sm ${type === opt.value
                                ? `${opt.color} text-white border-transparent scale-[1.02] shadow-md ring-2 ring-slate-200 ring-offset-1`
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                                }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {showExtended && (
                        <div className="space-y-6 bg-white rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-200 p-6 animate-in fade-in slide-in-from-top-2">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <Label className="text-sm font-bold text-slate-700 flex items-center gap-1">
                                Description of Finding
                              </Label>
                              <Textarea
                                className="bg-slate-50 border-slate-200 text-slate-900 min-h-[100px] resize-y p-3 focus:bg-white"
                                value={audit.description || ""}
                                onChange={(e) =>
                                  updateProcessAudit(
                                    index,
                                    "description",
                                    e.target.value,
                                  )
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm font-bold text-slate-700 flex items-center gap-1">
                                Correction Done
                              </Label>
                              <Textarea
                                className="bg-slate-50 border-slate-200 text-slate-900 min-h-[100px] resize-y p-3 focus:bg-white"
                                value={audit.correction || ""}
                                onChange={(e) =>
                                  updateProcessAudit(
                                    index,
                                    "correction",
                                    e.target.value,
                                  )
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm font-bold text-slate-700 flex items-center gap-1">
                                Root Cause
                              </Label>
                              <Textarea
                                className="bg-slate-50 border-slate-200 text-slate-900 min-h-[100px] resize-y p-3 focus:bg-white"
                                value={audit.rootCause || ""}
                                onChange={(e) =>
                                  updateProcessAudit(
                                    index,
                                    "rootCause",
                                    e.target.value,
                                  )
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm font-bold text-slate-700 flex items-center gap-1">
                                Corrective Action
                              </Label>
                              <Textarea
                                className="bg-slate-50 border-slate-200 text-slate-900 min-h-[100px] resize-y p-3 focus:bg-white"
                                value={audit.correctiveAction || ""}
                                onChange={(e) =>
                                  updateProcessAudit(
                                    index,
                                    "correctiveAction",
                                    e.target.value,
                                  )
                                }
                              />
                            </div>
                          </div>

                          {/* Action By / Close Date / Assign To row for Process Audit */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2 pb-6 px-6 bg-white rounded-b-xl border-t border-slate-100">
                            <div className="space-y-2">
                              <Label className="text-sm font-bold text-slate-700">
                                Action By
                              </Label>
                              <Input
                                className="bg-slate-50 border-slate-200 text-slate-900 focus:bg-white"
                                placeholder="Who is responsible..."
                                value={audit.actionBy || ""}
                                onChange={(e) =>
                                  updateProcessAudit(index, "actionBy", e.target.value)
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm font-bold text-slate-700">
                                Close Date
                              </Label>
                              <Input
                                type="date"
                                className="bg-slate-50 border-slate-200 text-slate-900 focus:bg-white"
                                value={audit.closeDate || ""}
                                onChange={(e) =>
                                  updateProcessAudit(index, "closeDate", e.target.value)
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm font-bold text-slate-700">
                                Assign To
                              </Label>
                              <Input
                                className="bg-slate-50 border-slate-200 text-slate-900 focus:bg-white"
                                placeholder="Department or Person..."
                                value={audit.assignTo || ""}
                                onChange={(e) =>
                                  updateProcessAudit(index, "assignTo", e.target.value)
                                }
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-col items-center justify-center p-4 border-t border-slate-100 bg-slate-50/50">
                        <label className="flex items-center justify-center w-full p-4 border-2 border-dashed border-slate-200 bg-white rounded-xl hover:bg-slate-50 hover:border-slate-300 cursor-pointer transition-all group">
                          <input
                            type="file"
                            multiple
                            className="hidden"
                            onChange={(e) => handleGenericFileUpload(`process_audit_${index}`, e.target.files)}
                          />
                          <div className="flex items-center gap-3 text-slate-500 group-hover:text-slate-800 font-medium">
                            <div className="bg-slate-100 p-2 rounded-full group-hover:bg-slate-200 transition-colors">
                              <Upload className="w-4 h-4" />
                            </div>
                            <span>Add / Upload / Insert record or picture</span>
                          </div>
                        </label>
                        {genericFiles[`process_audit_${index}`] && genericFiles[`process_audit_${index}`].length > 0 && (
                          <div className="w-full mt-4 flex flex-col gap-2">
                            <span className="text-sm font-bold text-slate-500 uppercase px-1">Attached Files</span>
                            <div className="flex flex-wrap gap-2">
                              {genericFiles[`process_audit_${index}`].map((file, fileIdx) => (
                                <div key={fileIdx} className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-md text-sm shadow-sm">
                                  <FileText className="w-4 h-4 text-emerald-600" />
                                  <span className="max-w-[150px] truncate" title={file.name}>{file.name}</span>
                                  <Trash2
                                    className="w-4 h-4 text-slate-400 hover:text-red-500 cursor-pointer ml-1 transition-colors"
                                    onClick={() => removeGenericFile(`process_audit_${index}`, fileIdx)}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            <Button
              variant="outline"
              className="w-full py-8 border-dashed border-emerald-300 bg-emerald-50/50 hover:bg-emerald-100/50 text-emerald-700 font-bold hover:text-emerald-800 hover:border-emerald-400 transition-all gap-2"
              onClick={addProcessAudit}
            >
              <Plus className="w-5 h-5" /> Add Another Audit Report Section
            </Button>
          </div>
        ) : (
          <Card className="overflow-hidden border border-slate-200 shadow-sm bg-white rounded-xl">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-800 hover:bg-slate-800 border-none">
                    <TableHead className="w-[80px] font-bold text-white border-r border-slate-700">
                      Clause
                    </TableHead>
                    <TableHead className="w-[35%] font-bold text-white border-r border-slate-700">
                      Audit Question
                    </TableHead>
                    <TableHead className="w-[20%] font-bold text-white text-center border-r border-slate-700">
                      Finding
                    </TableHead>
                    <TableHead className="w-[35%] font-bold text-white text-center">
                      Audit Evidence
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(template.content as ChecklistContent[]).map(
                    (item, index, array) => {
                      // Determine if this checklist item is relevant
                      if (!isClauseSelected(item.clause)) {
                        return null;
                      }

                      const type = checklistData[index]?.findings;

                      if (focusFindings && !['OFI', 'Min', 'Maj'].includes(type as string)) {
                        return null;
                      }

                      const showClause = index === 0 || array[index - 1].clause !== item.clause;
                      const isLastInGroup = index === array.length - 1 || array[index + 1].clause !== item.clause;

                      return (
                        <React.Fragment key={index}>
                          <TableRow className={`divide-x divide-slate-100 bg-white hover:bg-slate-50/50 transition-colors ${!isLastInGroup ? 'border-b-0' : ''}`}>
                            <TableCell className={`font-bold text-slate-600 align-top ${showClause ? 'bg-slate-50/30' : 'bg-transparent text-transparent select-none border-t-0'}`}>
                              {showClause ? item.clause : ''}
                            </TableCell>
                            <TableCell className="align-top font-medium text-slate-800 py-4">
                              {item.question}
                            </TableCell>

                            {/* Findings Selection */}
                            <TableCell className="p-4 align-top">
                              <div className="flex flex-wrap gap-2 justify-center">
                                {[
                                  { val: "OFI", color: "bg-amber-500" },
                                  { val: "Min", color: "bg-orange-600" },
                                  { val: "Maj", color: "bg-red-600" },
                                ].map((opt) => (
                                  <div
                                    key={opt.val}
                                    className={`
                                                                    w-10 h-10 rounded-lg flex items-center justify-center text-xs font-black cursor-pointer border transition-all shadow-sm
                                                                    ${type ===
                                        opt.val
                                        ? `${opt.color} text-white border-transparent scale-105 shadow-md ring-2 ring-slate-200 ring-offset-1`
                                        : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                                      }
                                                                `}
                                    onClick={() => {
                                      handleChecklistChange(index, "findings", opt.val);
                                      // Also persist clause so AuditFindings can group correctly
                                      handleChecklistChange(index, "clause", item.clause);
                                    }}

                                  >
                                    {opt.val}
                                  </div>
                                ))}
                              </div>
                            </TableCell>

                            {/* Evidence */}
                            <TableCell className="p-3 align-top">
                              <div className="flex flex-col h-full">
                                {!["OFI", "Min", "Maj"].includes(type) && (
                                  <Textarea
                                    className="min-h-[100px] text-sm resize-y border-slate-200 bg-slate-50/50 focus:bg-white shadow-sm transition-colors placeholder:text-slate-400 p-3"
                                    placeholder="Documented info / records checked..."
                                    value={checklistData[index]?.evidence || ""}
                                    onChange={(e) =>
                                      handleChecklistChange(
                                        index,
                                        "evidence",
                                        e.target.value,
                                      )
                                    }
                                  />
                                )}
                              </div>
                            </TableCell>
                          </TableRow>

                          {/* Extended findings conditionally */}
                          {["OFI", "Min", "Maj"].includes(type) && (
                            <TableRow className="bg-slate-50 border-b-4 border-slate-200 text-sm">
                              <TableCell colSpan={4} className="p-0">
                                <div className="p-6 ml-6 mr-6 my-4 border bg-white rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border-slate-200">
                                  <div className="flex items-center gap-3 mb-5 border-b border-slate-100 pb-3">
                                    <div
                                      className={`px-2.5 py-1 rounded-md text-xs font-black text-white uppercase tracking-wider
                                                                    ${type === "OFI" ? "bg-amber-500" : type === "Min" ? "bg-orange-600" : "bg-red-600"}`}
                                    >
                                      {type === "Min"
                                        ? "Minor N/C"
                                        : type === "Maj"
                                          ? "Major N/C"
                                          : "OFI"}{" "}
                                      Details
                                    </div>
                                    <span className="text-slate-400 text-xs font-medium">
                                      Fill in the findings form below.
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                      <Label className="font-bold text-slate-700 flex items-center gap-1">
                                        Details{" "}
                                        {type !== "OFI" && (
                                          <span className="text-red-500">
                                            *
                                          </span>
                                        )}
                                      </Label>
                                      <Textarea
                                        placeholder="Detailed description..."
                                        className="min-h-[100px] bg-slate-50 border-slate-200 focus:bg-white resize-y p-3"
                                        value={
                                          checklistData[index]?.description ||
                                          ""
                                        }
                                        onChange={(e) =>
                                          handleChecklistChange(
                                            index,
                                            "description",
                                            e.target.value,
                                          )
                                        }
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label className="font-bold text-slate-700 flex items-center gap-1">
                                        Correction{" "}
                                        {type !== "OFI" && (
                                          <span className="text-red-500">
                                            *
                                          </span>
                                        )}
                                      </Label>
                                      <Textarea
                                        placeholder="Immediate action..."
                                        className="min-h-[100px] bg-slate-50 border-slate-200 focus:bg-white resize-y p-3"
                                        value={
                                          checklistData[index]?.correction || ""
                                        }
                                        onChange={(e) =>
                                          handleChecklistChange(
                                            index,
                                            "correction",
                                            e.target.value,
                                          )
                                        }
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label className="font-bold text-slate-700 flex items-center gap-1">
                                        Root Cause{" "}
                                        {type !== "OFI" && (
                                          <span className="text-red-500">
                                            *
                                          </span>
                                        )}
                                      </Label>
                                      <Textarea
                                        placeholder="Why did this happen?"
                                        className="min-h-[100px] bg-slate-50 border-slate-200 focus:bg-white resize-y p-3"
                                        value={
                                          checklistData[index]?.rootCause || ""
                                        }
                                        onChange={(e) =>
                                          handleChecklistChange(
                                            index,
                                            "rootCause",
                                            e.target.value,
                                          )
                                        }
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label className="font-bold text-slate-700 flex items-center gap-1">
                                        Corrective Action{" "}
                                        {type !== "OFI" && (
                                          <span className="text-red-500">
                                            *
                                          </span>
                                        )}
                                      </Label>
                                      <Textarea
                                        placeholder="Preventative measures..."
                                        className="min-h-[100px] bg-slate-50 border-slate-200 focus:bg-white resize-y p-3"
                                        value={
                                          checklistData[index]
                                            ?.correctiveAction || ""
                                        }
                                        onChange={(e) =>
                                          handleChecklistChange(
                                            index,
                                            "correctiveAction",
                                            e.target.value,
                                          )
                                        }
                                      />
                                    </div>
                                  </div>

                                  {/* Action By / Close Date / Assign To row for Checklist */}
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-100 mt-4">
                                    <div className="space-y-2">
                                      <Label className="text-sm font-bold text-slate-700">
                                        Action By
                                      </Label>
                                      <Input
                                        className="bg-slate-50 border-slate-200 text-slate-900 focus:bg-white"
                                        placeholder="Who is responsible..."
                                        value={checklistData[index]?.actionBy || ""}
                                        onChange={(e) =>
                                          handleChecklistChange(index, "actionBy", e.target.value)
                                        }
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label className="text-sm font-bold text-slate-700">
                                        Close Date
                                      </Label>
                                      <Input
                                        type="date"
                                        className="bg-slate-50 border-slate-200 text-slate-900 focus:bg-white"
                                        value={checklistData[index]?.closeDate || ""}
                                        onChange={(e) =>
                                          handleChecklistChange(index, "closeDate", e.target.value)
                                        }
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label className="text-sm font-bold text-slate-700">
                                        Assign To
                                      </Label>
                                      <Input
                                        className="bg-slate-50 border-slate-200 text-slate-900 focus:bg-white"
                                        placeholder="Department or Person..."
                                        value={checklistData[index]?.assignTo || ""}
                                        onChange={(e) =>
                                          handleChecklistChange(index, "assignTo", e.target.value)
                                        }
                                      />
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}

                          {/* Upload Evidence per Clause Group */}
                          {isLastInGroup && (
                            <>
                              <TableRow className="bg-slate-50 border-b-4 border-slate-200">
                                <TableCell colSpan={4} className="p-0">
                                  <label className="flex items-center justify-center p-3 bg-slate-50 border-t border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors group">
                                    <input
                                      type="file"
                                      multiple
                                      className="hidden"
                                      onChange={(e) => handleClauseFileUpload(item.clause, e.target.files)}
                                    />
                                    <div className="flex flex-col items-center gap-1 text-slate-500 group-hover:text-slate-700">
                                      <div className="bg-white p-2 text-slate-400 group-hover:text-amber-600 rounded-full shadow-sm border border-slate-200 group-hover:border-amber-200 transition-all">
                                        <Upload className="w-4 h-4" />
                                      </div>
                                      <span className="text-xs font-semibold">
                                        Upload evidence (images, docs, pdfs) for Clause {item.clause}
                                      </span>
                                    </div>
                                  </label>
                                </TableCell>
                              </TableRow>
                              {clauseFiles[item.clause] && clauseFiles[item.clause].length > 0 && (
                                <TableRow className="bg-white border-b-2 border-slate-100">
                                  <TableCell colSpan={4} className="py-3 px-6">
                                    <div className="flex flex-col gap-2">
                                      <span className="text-xs font-bold text-slate-500 uppercase">Attached Files</span>
                                      <div className="flex flex-wrap gap-2">
                                        {clauseFiles[item.clause].map((file, fileIdx) => (
                                          <div key={fileIdx} className="flex items-center gap-2 bg-slate-50 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-md text-xs shadow-sm">
                                            <FileText className="w-4 h-4 text-emerald-600" />
                                            <span className="max-w-[150px] truncate" title={file.name}>{file.name}</span>
                                            <Trash2
                                              className="w-3.5 h-3.5 text-slate-400 hover:text-red-500 cursor-pointer ml-1 transition-colors"
                                              onClick={() => removeClauseFile(item.clause, fileIdx)}
                                            />
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </>
                          )}
                        </React.Fragment>
                      );
                    },
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}

        {/* Submit Actions */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 shadow-lg flex justify-end gap-4 z-50">
          <Button
            variant="outline"
            size="lg"
            className="bg-white"
            onClick={() => navigate("/audit")}
          >
            Cancel
          </Button>
          <Button
            size="lg"
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 px-8 shadow-sm"
            onClick={handleSubmit}
          >
            <Save className="w-5 h-5" /> Save Audit Progress
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AuditExecute;
