import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/contexts/OrganizationContext";
import { getOrgPrivilegeFlags } from "@/lib/orgAuthorization";

type EmployeeUpdateData = {
  full_name?: string;
  email?: string;
  phone?: string;
  username?: string;
  job_role?: string;
};

type ProfileUpdateData = {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  department?: string;
  location?: string;
  job_role?: string;
};

interface UserData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  department: string;
  location: string;
  profileImage: string | null;
  role: string;
  jobRole: string;
  username: string;
  isEmployee: boolean;
}

interface PreviewEmployee {
  id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  job_role: string;
  avatar_url: string | null;
}

interface UserContextType {
  user: UserData;
  loading: boolean;
  updateUser: (data: Partial<UserData>) => Promise<void>;
  updateProfileImage: (image: string | null) => Promise<void>;
  uploadAvatar: (file: File) => Promise<string | null>;
  // Preview mode - allows admin to see the UI as an employee
  previewAsEmployee: boolean;
  setPreviewAsEmployee: (value: boolean) => void;
  // Preview specific employee
  previewingEmployee: PreviewEmployee | null;
  setPreviewingEmployee: (employee: PreviewEmployee | null) => void;
}

const defaultUser: UserData = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  department: "",
  location: "",
  profileImage: null,
  role: "مستخدم",
  jobRole: "",
  username: "",
  isEmployee: false,
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const { user: authUser } = useAuth();
  const { currentOrg } = useOrganization();
  const [user, setUser] = useState<UserData>(defaultUser);
  const [loading, setLoading] = useState(true);
  const [previewAsEmployee, setPreviewAsEmployee] = useState(false);
  const [previewingEmployee, setPreviewingEmployee] = useState<PreviewEmployee | null>(null);

  // When previewing a specific employee, update user data
  useEffect(() => {
    if (previewingEmployee) {
      setPreviewAsEmployee(true);
    }
  }, [previewingEmployee]);

  // Fetch the profile again when either the authenticated user or active
  // organization changes, because one auth identity may belong to many orgs.
  useEffect(() => {
    if (authUser) {
      fetchProfile();
    } else {
      setUser(defaultUser);
      setLoading(false);
    }
  }, [authUser, currentOrg?.id]);

  const fetchProfile = async () => {
    if (!authUser) return;

    try {
      setLoading(true);
      
      // Resolve employee/profile data inside the active organization.
      let employeeQuery = supabase
        .from("employees")
        .select("*")
        .eq("user_id", authUser.id);
      if (currentOrg?.id) {
        employeeQuery = employeeQuery.eq("organization_id", currentOrg.id);
      }
      const { data: employeeData } = await employeeQuery.maybeSingle();

      const flags = await getOrgPrivilegeFlags(
        authUser.id,
        currentOrg?.id,
      );

      if (employeeData) {
        // User is an employee - use employee data
        const nameParts = employeeData.full_name?.split(" ") || ["", ""];
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";
        
        // جلب القسم من خلال job_roles -> departments
        let departmentName = "";
        if (employeeData.job_role) {
          let jobRoleQuery = supabase
            .from("job_roles")
            .select("department_id, departments(name)")
            .eq("name", employeeData.job_role);
          if (currentOrg?.id) {
            jobRoleQuery = jobRoleQuery.eq("organization_id", currentOrg.id);
          }
          const { data: jobRoleData } = await jobRoleQuery.maybeSingle();
          
          if (jobRoleData?.departments) {
            departmentName = (jobRoleData.departments as any).name || "";
          }
        }
        
        const displayRole = flags.isSuperAdmin
          ? "مدير النظام"
          : flags.isOrgAdmin
            ? "مدير الجمعية"
            : (employeeData.job_role || "موظف");
        
        setUser({
          firstName,
          lastName,
          email: employeeData.email || "",
          phone: employeeData.phone || "",
          department: departmentName,
          location: "",
          profileImage: employeeData.avatar_url,
          role: displayRole,
          jobRole: employeeData.job_role || "",
          username: employeeData.username || "",
          isEmployee: true,
        });
      } else {
        // Not an employee - fetch from profiles
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", authUser.id)
          .maybeSingle();

        if (error && error.code !== "PGRST116") {
          console.error("Error fetching profile:", error);
        }

        if (data) {
          setUser({
            firstName: data.first_name || "",
            lastName: data.last_name || "",
            email: data.email || authUser.email || "",
            phone: data.phone || "",
            department: data.department || "",
            location: data.location || "",
            profileImage: data.avatar_url,
            role: flags.isSuperAdmin
              ? "مدير النظام"
              : flags.isOrgAdmin
                ? "مدير الجمعية"
                : "مستخدم",
            jobRole: (data as any).job_role || "",
            username: authUser.user_metadata?.username || "",
            isEmployee: false,
          });
        } else {
          // Create profile if it doesn't exist
          const firstName = authUser.user_metadata?.first_name || "";
          const lastName = authUser.user_metadata?.last_name || "";
          
          const { error: insertError } = await supabase.from("profiles").insert({
            user_id: authUser.id,
            first_name: firstName,
            last_name: lastName,
            email: authUser.email,
          });

          if (insertError) {
            console.error("Error creating profile:", insertError);
          }

          setUser({
            ...defaultUser,
            firstName,
            lastName,
            email: authUser.email || "",
            role: flags.isSuperAdmin
              ? "مدير النظام"
              : flags.isOrgAdmin
                ? "مدير الجمعية"
                : "مستخدم",
          });
        }
      }
    } catch (error) {
      console.error("Error in fetchProfile:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async (data: Partial<UserData>) => {
    if (!authUser) return;

    try {
      let employeeLookup = supabase
        .from("employees")
        .select("id")
        .eq("user_id", authUser.id);
      if (currentOrg?.id) {
        employeeLookup = employeeLookup.eq("organization_id", currentOrg.id);
      }
      const { data: employeeData } = await employeeLookup.maybeSingle();

      if (employeeData) {
        // Update employee record
        const employeeUpdateData: EmployeeUpdateData = {};
        if (data.firstName !== undefined || data.lastName !== undefined) {
          const fullName = `${data.firstName || user.firstName} ${data.lastName || user.lastName}`.trim();
          employeeUpdateData.full_name = fullName;
        }
        if (data.email !== undefined) employeeUpdateData.email = data.email;
        if (data.phone !== undefined) employeeUpdateData.phone = data.phone;
        if (data.username !== undefined) employeeUpdateData.username = data.username;
        if (data.department !== undefined) employeeUpdateData.job_role = data.department;

        if (Object.keys(employeeUpdateData).length > 0) {
          let updateQuery = supabase
            .from("employees")
            .update(employeeUpdateData)
            .eq("user_id", authUser.id);
          if (currentOrg?.id) {
            updateQuery = updateQuery.eq("organization_id", currentOrg.id);
          }
          const { error } = await updateQuery;

          if (error) {
            console.error("Error updating employee:", error);
            throw error;
          }
        }
      } else {
        // Update profile record
        const updateData: ProfileUpdateData = {};
        if (data.firstName !== undefined) updateData.first_name = data.firstName;
        if (data.lastName !== undefined) updateData.last_name = data.lastName;
        if (data.email !== undefined) updateData.email = data.email;
        if (data.phone !== undefined) updateData.phone = data.phone;
        if (data.department !== undefined) updateData.department = data.department;
        if (data.location !== undefined) updateData.location = data.location;
        if (data.jobRole !== undefined) updateData.job_role = data.jobRole;

        if (Object.keys(updateData).length > 0) {
          const { error } = await supabase
            .from("profiles")
            .update(updateData)
            .eq("user_id", authUser.id);

          if (error) {
            console.error("Error updating profile:", error);
            throw error;
          }
        }
      }

      setUser((prev) => ({ ...prev, ...data }));
    } catch (error) {
      console.error("Error in updateUser:", error);
      throw error;
    }
  };

  const uploadAvatar = async (file: File): Promise<string | null> => {
    if (!authUser) return null;

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${authUser.id}/avatar.${fileExt}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        console.error("Error uploading avatar:", uploadError);
        throw uploadError;
      }

      // Get public URL
      const { data } = supabase.storage.from("avatars").getPublicUrl(fileName);
      const avatarUrl = `${data.publicUrl}?t=${Date.now()}`; // Cache bust

      return avatarUrl;
    } catch (error) {
      console.error("Error in uploadAvatar:", error);
      throw error;
    }
  };

  const updateProfileImage = async (image: string | null) => {
    if (!authUser) return;

    try {
      let employeeLookup = supabase
        .from("employees")
        .select("id")
        .eq("user_id", authUser.id);
      if (currentOrg?.id) {
        employeeLookup = employeeLookup.eq("organization_id", currentOrg.id);
      }
      const { data: employeeData } = await employeeLookup.maybeSingle();

      if (employeeData) {
        // Update employee avatar
        let updateQuery = supabase
          .from("employees")
          .update({ avatar_url: image })
          .eq("user_id", authUser.id);
        if (currentOrg?.id) {
          updateQuery = updateQuery.eq("organization_id", currentOrg.id);
        }
        const { error } = await updateQuery;

        if (error) {
          console.error("Error updating employee avatar:", error);
          throw error;
        }
      } else {
        // Update profile avatar
        const { error } = await supabase
          .from("profiles")
          .update({ avatar_url: image })
          .eq("user_id", authUser.id);

        if (error) {
          console.error("Error updating profile avatar:", error);
          throw error;
        }
      }

      setUser((prev) => ({ ...prev, profileImage: image }));
    } catch (error) {
      console.error("Error in updateProfileImage:", error);
      throw error;
    }
  };

  // Get displayed user data (actual user or previewed employee)
  const displayedUser = previewingEmployee ? {
    ...user,
    firstName: previewingEmployee.full_name.split(" ")[0] || "",
    lastName: previewingEmployee.full_name.split(" ").slice(1).join(" ") || "",
    email: previewingEmployee.email || "",
    phone: previewingEmployee.phone || "",
    profileImage: previewingEmployee.avatar_url,
    jobRole: previewingEmployee.job_role,
    role: previewingEmployee.job_role || "موظف",
    isEmployee: true,
  } : user;

  return (
    <UserContext.Provider value={{ 
      user: displayedUser, 
      loading, 
      updateUser, 
      updateProfileImage, 
      uploadAvatar, 
      previewAsEmployee, 
      setPreviewAsEmployee: (value) => {
        setPreviewAsEmployee(value);
        if (!value) setPreviewingEmployee(null);
      },
      previewingEmployee,
      setPreviewingEmployee
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
