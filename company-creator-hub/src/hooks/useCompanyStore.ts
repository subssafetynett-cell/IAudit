import { useState, useCallback, useEffect } from "react";
import { Company, Site, Department, ISOStandard } from "@/types/company";

const API_URL = "http://localhost:3001/api";

let globalCompanies: Company[] = [];
let listeners: Array<() => void> = [];
let isInitialized = false;

function notify() {
  listeners.forEach((l) => l());
}

export function useCompanyStore() {
  const [, setTick] = useState(0);

  const rerender = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    listeners.push(rerender);
    if (!isInitialized) {
      isInitialized = true;
      fetchCompanies();
    }
    return () => {
      listeners = listeners.filter((l) => l !== rerender);
    };
  }, [rerender]);

  const fetchCompanies = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const response = await fetch(`${API_URL}/companies?userId=${user.id}`);
      if (response.ok) {
        const data = await response.json();
        globalCompanies = data.map((c: any) => ({
          ...c,
          id: String(c.id),
          isoStandards: c.isoStandards || [],
          sites: c.sites || [],
          createdAt: new Date(c.createdAt),
        }));
        notify();
      }
    } catch (error) {
      console.error("Failed to fetch companies:", error);
    }
  };

  const addCompany = async (data: {
    name: string;
    logo?: string;
    industry?: string;
    contactNumber?: string;
    description?: string;
    streetAddress?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
    standards: ISOStandard[];
  }) => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const response = await fetch(`${API_URL}/companies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, userId: user.id }),
      });
      if (response.ok) {
        const newCompany = await response.json();
        const company: Company = {
          ...newCompany,
          id: String(newCompany.id),
          isoStandards: data.standards,
          sites: [],
          createdAt: new Date(newCompany.createdAt),
        };
        globalCompanies = [...globalCompanies, company];
        notify();
        return company;
      }
    } catch (error) {
      console.error("Failed to add company:", error);
    }
  };

  const deleteCompany = async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/companies/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        globalCompanies = globalCompanies.filter((c) => c.id !== id);
        notify();
      }
    } catch (error) {
      console.error("Failed to delete company:", error);
    }
  };

  const updateCompany = async (
    companyId: string,
    data: {
      name: string;
      logo?: string;
      industry?: string;
      contactNumber?: string;
      description?: string;
      streetAddress?: string;
      city?: string;
      state?: string;
      country?: string;
      postalCode?: string;
      standards: ISOStandard[];
    }
  ) => {
    try {
      const response = await fetch(`${API_URL}/companies/${companyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (response.ok) {
        const updated = await response.json();
        globalCompanies = globalCompanies.map((c) =>
          c.id === companyId
            ? {
              ...c,
              ...updated,
              id: String(updated.id),
              isoStandards: data.standards,
            }
            : c
        );
        notify();
      }
    } catch (error) {
      console.error("Failed to update company:", error);
    }
  };

  // Sites
  const addSite = async (companyId: string, data: any) => {
    try {
      const response = await fetch(`${API_URL}/companies/${companyId}/sites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (response.ok) {
        const newSite = await response.json();
        const site: Site = {
          ...newSite,
          id: String(newSite.id),
          departments: [],
        };
        globalCompanies = globalCompanies.map((c) =>
          c.id === companyId ? { ...c, sites: [...c.sites, site] } : c
        );
        notify();
        return site;
      }
    } catch (error) {
      console.error("Failed to add site:", error);
    }
  };

  const updateSite = async (companyId: string, siteId: string, data: any) => {
    try {
      const response = await fetch(`${API_URL}/sites/${siteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (response.ok) {
        const updated = await response.json();
        globalCompanies = globalCompanies.map((c) =>
          c.id === companyId
            ? {
              ...c,
              sites: c.sites.map((s) => s.id === siteId ? { ...s, ...updated, id: String(updated.id) } : s)
            }
            : c
        );
        notify();
      }
    } catch (error) {
      console.error("Failed to update site:", error);
    }
  };
  const deleteSite = async (companyId: string, siteId: string) => {
    try {
      const response = await fetch(`${API_URL}/sites/${siteId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        globalCompanies = globalCompanies.map((c) =>
          c.id === companyId ? { ...c, sites: c.sites.filter((s) => s.id !== siteId) } : c
        );
        notify();
      }
    } catch (error) {
      console.error("Failed to delete site:", error);
    }
  };

  // Departments
  const addDepartment = async (companyId: string, siteId: string, name: string, data: any) => {
    try {
      const response = await fetch(`${API_URL}/sites/${siteId}/departments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, ...data }),
      });
      if (response.ok) {
        const newDept = await response.json();
        const dept: Department = {
          ...newDept,
          id: String(newDept.id),
        };
        globalCompanies = globalCompanies.map((c) =>
          c.id === companyId
            ? {
              ...c,
              sites: c.sites.map((s) =>
                s.id === siteId ? { ...s, departments: [...s.departments, dept] } : s
              ),
            }
            : c
        );
        notify();
        return dept;
      }
    } catch (error) {
      console.error("Failed to add department:", error);
    }
  };

  const updateDepartment = async (companyId: string, siteId: string, deptId: string, data: any) => {
    try {
      const response = await fetch(`${API_URL}/departments/${deptId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (response.ok) {
        const updated = await response.json();
        globalCompanies = globalCompanies.map((c) =>
          c.id === companyId
            ? {
              ...c,
              sites: c.sites.map((s) =>
                s.id === siteId
                  ? {
                    ...s,
                    departments: s.departments.map((d) => d.id === deptId ? { ...d, ...updated, id: String(updated.id) } : d)
                  }
                  : s
              ),
            }
            : c
        );
        notify();
      }
    } catch (error) {
      console.error("Failed to update department:", error);
    }
  };

  const deleteDepartment = async (companyId: string, siteId: string, deptId: string) => {
    try {
      const response = await fetch(`${API_URL}/departments/${deptId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        globalCompanies = globalCompanies.map((c) =>
          c.id === companyId
            ? {
              ...c,
              sites: c.sites.map((s) =>
                s.id === siteId ? { ...s, departments: s.departments.filter((d) => d.id !== deptId) } : s
              ),
            }
            : c
        );
        notify();
      }
    } catch (error) {
      console.error("Failed to delete department:", error);
    }
  };

  return {
    companies: globalCompanies,
    addCompany,
    deleteCompany,
    addSite,
    deleteSite,
    updateSite,
    addDepartment,
    updateDepartment,
    deleteDepartment,
    updateCompany,
    getCompany: (id: string) => globalCompanies.find((c) => c.id === id),
  };
}
