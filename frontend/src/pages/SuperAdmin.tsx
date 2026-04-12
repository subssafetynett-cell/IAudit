import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "@/config";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Search,
    MoreHorizontal,
    User as UserIcon,
    Mail,
    Shield,
    Trash2,
    Eye,
    UserCheck,
    UserMinus,
    Building2,
    CheckCircle2,
    XCircle,
    LogOut
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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
import UserModal from "@/components/UserModal";
import ReusablePagination from "@/components/ReusablePagination";

const API_URL = `${API_BASE_URL}/api`;

export default function SuperAdmin() {
    const navigate = useNavigate();
    const [users, setUsers] = useState<any[]>([]);
    const [companies, setCompanies] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Search and Filter States
    const [searchQuery, setSearchQuery] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(15);

    // Reset page to 1 when filters or page size change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, roleFilter, statusFilter, itemsPerPage]);

    // Modal States
    const [showUserModal, setShowUserModal] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [modalMode, setModalMode] = useState<"create" | "edit" | "view">("view");
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        const isAuth = localStorage.getItem("isSuperAdminAuthenticated") === "true";
        if (!isAuth) {
            navigate("/super-admin-login");
            return;
        }
        fetchData();
    }, [navigate]);

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const [usersRes, companiesRes] = await Promise.all([
                fetch(`${API_URL}/users`),
                fetch(`${API_URL}/companies?admin=true`)
            ]);

            if (usersRes.ok && companiesRes.ok) {
                const usersData = await usersRes.json();
                const companiesData = await companiesRes.json();
                setUsers(usersData);
                setCompanies(companiesData);
            } else {
                toast.error("Failed to load data");
            }
        } catch (error) {
            console.error("Failed to fetch data:", error);
            toast.error("Failed to load dashboard data");
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleStatus = async (user: any) => {
        try {
            const response = await fetch(`${API_URL}/users/${user.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...user, isActive: !user.isActive }),
            });

            if (response.ok) {
                const updatedUser = await response.json();
                setUsers(users.map(u => u.id === updatedUser.id ? updatedUser : u));
                toast.success(`User ${updatedUser.firstName} is now ${updatedUser.isActive ? 'Active' : 'Inactive'}`);
            } else {
                toast.error("Failed to update status");
            }
        } catch (error) {
            console.error("Error toggling status:", error);
            toast.error("An error occurred");
        }
    };

                onSubmit={handleAddUser}
                mode={modalMode}
                initialData={selectedUser}
            />

            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent className="rounded-[2rem] border-slate-100 shadow-2xl p-8">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-2xl font-bold text-[#1e293b]">Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-500 text-base mt-2">
                            This action cannot be undone. This will permanently delete the user account for
                            <span className="font-bold text-[#213847] ml-1">
                                {selectedUser?.firstName} {selectedUser?.lastName}
                            </span> and remove their data from our servers.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-8 gap-3">
                        <AlertDialogCancel className="rounded-2xl h-12 px-6 font-semibold border-slate-200 text-slate-600 hover:bg-slate-50">
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleDeleteUser();
                            }}
                            disabled={isDeleting}
                            className="rounded-2xl h-12 px-6 font-semibold bg-red-500 hover:bg-red-600 text-white border-none shadow-lg shadow-red-200"
                        >
                            {isDeleting ? "Deleting..." : "Delete Permanently"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

// Utility function for conditional classes (if not already globally available)
function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(" ");
}
