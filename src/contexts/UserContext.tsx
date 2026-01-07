import { createContext, useContext, useState, ReactNode, useEffect } from "react";

interface UserData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  department: string;
  location: string;
  profileImage: string | null;
  role: string;
}

interface UserContextType {
  user: UserData;
  updateUser: (data: Partial<UserData>) => void;
  updateProfileImage: (image: string | null) => void;
}

const defaultUser: UserData = {
  firstName: "جابر",
  lastName: "الحريصي",
  email: "jaber@atef.org",
  phone: "+966 50 123 4567",
  department: "الإدارة العليا",
  location: "الرياض، السعودية",
  profileImage: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
  role: "مدير النظام",
};

const STORAGE_KEY = "atef_user_data";

const getStoredUser = (): UserData => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...defaultUser, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error("Error reading user data from localStorage:", error);
  }
  return defaultUser;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData>(getStoredUser);

  // Save to localStorage whenever user changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } catch (error) {
      console.error("Error saving user data to localStorage:", error);
    }
  }, [user]);

  const updateUser = (data: Partial<UserData>) => {
    setUser((prev) => ({ ...prev, ...data }));
  };

  const updateProfileImage = (image: string | null) => {
    setUser((prev) => ({ ...prev, profileImage: image }));
  };

  return (
    <UserContext.Provider value={{ user, updateUser, updateProfileImage }}>
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
