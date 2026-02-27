import { Navigate, useLocation } from "react-router-dom";
import { useUserStatus } from "@/hooks/useUserStatus";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const location = useLocation();

    // Periodically verify the user's status on the server.
    // This hook handles logout if the user is deleted or set to inactive.
    useUserStatus();

    // Check auth synchronously to prevent flash of unauthenticated content
    const user = localStorage.getItem("user");
    const isAuthenticated = !!user;

    if (!isAuthenticated) {
        // Redirect them to the /login page
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return <>{children}</>;
}
