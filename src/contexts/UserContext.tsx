import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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

interface UserContextType {
  user: UserData;
  loading: boolean;
  updateUser: (data: Partial<UserData>) => Promise<void>;
  updateProfileImage: (image: string | null) => Promise<void>;
  uploadAvatar: (file: File) => Promise<string | null>;
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
  const [user, setUser] = useState<UserData>(defaultUser);
  const [loading, setLoading] = useState(true);

  // Fetch profile when auth user changes
  useEffect(() => {
    if (authUser) {
      fetchProfile();
    } else {
      setUser(defaultUser);
      setLoading(false);
    }
  }, [authUser]);

  const fetchProfile = async () => {
    if (!authUser) return;

    try {
      setLoading(true);
      
      // First check if user is an employee
      const { data: employeeData } = await supabase
        .from("employees")
        .select("*")
        .eq("user_id", authUser.id)
        .maybeSingle();

      // Check user role
      const { data: userRole } = await supabase.rpc("get_user_role", {
        _user_id: authUser.id,
      });

      if (employeeData) {
        // User is an employee - use employee data
        const nameParts = employeeData.full_name?.split(" ") || ["", ""];
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";
        
        setUser({
          firstName,
          lastName,
          email: employeeData.email || "",
          phone: employeeData.phone || "",
          department: employeeData.job_role || "",
          location: "",
          profileImage: employeeData.avatar_url,
          role: userRole === "admin" ? "مدير النظام" : "موظف",
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
            role: userRole === "admin" ? "مدير النظام" : "مستخدم",
            jobRole: "",
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
            role: userRole === "admin" ? "مدير النظام" : "مستخدم",
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
      // Check if user is an employee
      const { data: employeeData } = await supabase
        .from("employees")
        .select("id")
        .eq("user_id", authUser.id)
        .maybeSingle();

      if (employeeData) {
        // Update employee record
        const employeeUpdateData: Record<string, any> = {};
        if (data.firstName !== undefined || data.lastName !== undefined) {
          const fullName = `${data.firstName || user.firstName} ${data.lastName || user.lastName}`.trim();
          employeeUpdateData.full_name = fullName;
        }
        if (data.email !== undefined) employeeUpdateData.email = data.email;
        if (data.phone !== undefined) employeeUpdateData.phone = data.phone;
        if (data.username !== undefined) employeeUpdateData.username = data.username;
        if (data.department !== undefined) employeeUpdateData.job_role = data.department;

        if (Object.keys(employeeUpdateData).length > 0) {
          const { error } = await supabase
            .from("employees")
            .update(employeeUpdateData)
            .eq("user_id", authUser.id);

          if (error) {
            console.error("Error updating employee:", error);
            throw error;
          }
        }
      } else {
        // Update profile record
        const updateData: Record<string, any> = {};
        if (data.firstName !== undefined) updateData.first_name = data.firstName;
        if (data.lastName !== undefined) updateData.last_name = data.lastName;
        if (data.email !== undefined) updateData.email = data.email;
        if (data.phone !== undefined) updateData.phone = data.phone;
        if (data.department !== undefined) updateData.department = data.department;
        if (data.location !== undefined) updateData.location = data.location;

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
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: image })
        .eq("user_id", authUser.id);

      if (error) {
        console.error("Error updating avatar:", error);
        throw error;
      }

      setUser((prev) => ({ ...prev, profileImage: image }));
    } catch (error) {
      console.error("Error in updateProfileImage:", error);
      throw error;
    }
  };

  return (
    <UserContext.Provider value={{ user, loading, updateUser, updateProfileImage, uploadAvatar }}>
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
