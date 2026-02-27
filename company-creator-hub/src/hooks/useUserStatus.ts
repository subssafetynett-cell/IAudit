import { useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const CHECK_INTERVAL_MS = 15000; // Check every 15 seconds

/**
 * Hook that periodically verifies the currently logged-in user's status.
 * If the user is deleted or deactivated, they are logged out automatically.
 */
export function useUserStatus() {
    const navigate = useNavigate();

    const checkUserStatus = useCallback(async () => {
        const storedUser = localStorage.getItem("user");
        if (!storedUser) return; // Not logged in, nothing to check

        let userId: number | null = null;
        try {
            userId = JSON.parse(storedUser)?.id;
        } catch {
            // Corrupt data — log them out
            localStorage.removeItem("user");
            navigate("/login", { replace: true });
            return;
        }

        if (!userId) return;

        try {
            const res = await fetch(`http://localhost:3001/api/users/${userId}/status`);
            if (!res.ok) return; // Server error: don't force logout (could be temporary)

            const data = await res.json();

            // If user was deleted OR deactivated, log them out
            if (!data.exists || !data.isActive) {
                localStorage.removeItem("user");
                navigate("/login", { replace: true });
            }
        } catch {
            // Network error: do not force logout to avoid disruping offline usage
        }
    }, [navigate]);

    useEffect(() => {
        // Run immediately on mount
        checkUserStatus();

        // Then poll every interval
        const timer = setInterval(checkUserStatus, CHECK_INTERVAL_MS);

        return () => clearInterval(timer);
    }, [checkUserStatus]);
}
