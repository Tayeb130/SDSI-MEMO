import { useState } from "react";
import {
  FaHome,
  FaHistory,
  FaFileExport,
  FaUser,
} from "react-icons/fa";
import HomeContent from "./components/HomeContent";
import EventHistoryContent from "./components/EventHistoryContent";
import ExportContent from "./components/ExportContent";
import NotificationBell from "./components/NotificationBell";
import { NotificationProvider } from "./contexts/NotificationContext";

interface SidebarItem {
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

interface User {
  fullname: string;
  email: string;
}

function Dashboard() {
  const [activeTab, setActiveTab] = useState("home");
  const [user, setUser] = useState<User>(() => {
    const savedUser = localStorage.getItem("user");
    console.log("Stored user data:", savedUser);
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        console.log("Parsed user data:", parsed);
        return {
          fullname: parsed.user?.fullname || parsed.fullname || "User",
          email: parsed.user?.email || parsed.email || "email@example.com",
        };
      } catch (e) {
        console.error("Error parsing user data:", e);
        return { fullname: "User", email: "email@example.com" };
      }
    }
    return { fullname: "User", email: "email@example.com" };
  });

  const sidebarItems: SidebarItem[] = [
    {
      title: "Accueil",
      icon: <FaHome className="w-5 h-5" />,
      content: <HomeContent />,
    },
    {
      title: "Historique",
      icon: <FaHistory className="w-5 h-5" />,
      content: <EventHistoryContent />,
    },
    {
      title: "Exporter",
      icon: <FaFileExport className="w-5 h-5" />,
      content: <ExportContent />,
    },
  ];

  const handleLogout = () => {
    localStorage.removeItem("user");
    window.location.href = "/";
  };

  return (
    <NotificationProvider>
      <div className="flex h-screen bg-gray-100">
        {/* Sidebar */}
        <div className="w-64 bg-blue-200 shadow-lg flex flex-col">
          <div className="p-4 border-b border-blue-300">
            <h2 className="text-xl font-semibold text-gray-800">Tableau de Bord</h2>
          </div>

          <nav className="flex-1 mt-4">
            {sidebarItems.map((item) => (
              <button
                key={item.title}
                onClick={() => setActiveTab(item.title.toLowerCase())}
                className={`w-full flex items-center px-6 py-3 text-grey-600 hover:bg-blue-50 hover:text-blue-600 transition-colors ${
                  activeTab === item.title.toLowerCase()
                    ? "bg-blue-50 text-blue-600 border-r-4 border-blue-500"
                    : ""
                }`}
              >
                {item.icon}
                <span className="ml-3">{item.title}</span>
              </button>
            ))}
          </nav>

          {/* Logos at the bottom of sidebar */}
          <div className="mt-auto p-4 border-t border-blue-300">
            <div className="flex justify-center items-center space-x-4">
              <img
                src="/images__5_-removebg-preview.png"
                alt="Logo Université"
                className="w-24 h-24 object-contain"
              />
              <img
                src="/unnamed.png"
                alt="Logo Faculté"
                className="w-24 h-24 object-contain"
              />
            </div>
          </div>
        </div>

        {/* Main Content Area with Top Navigation */}
        <div className="flex-1 flex flex-col">
          {/* Top Navigation */}
          <div className="bg-white h-16 shadow-sm flex items-center justify-end px-8">
            <div className="flex items-center space-x-6">
              <NotificationBell />
              <div className="flex items-center space-x-3">
                <div className="bg-blue-200 p-2 rounded-full">
                  <FaUser className="w-5 h-5 text-gray-600" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-700">
                    {user.fullname}
                  </span>
                  <span className="text-xs text-gray-500">{user.email}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 text-sm bg-white text-gray-700 border border-gray-300 rounded-md transition-colors hover:bg-red-600 hover:text-white hover:border-red-600"
                >
                  Déconnexion
                </button>
              </div>
            </div>
          </div>

          {/* Page Content */}
          <div className="flex-1 overflow-auto p-8">
            {
              sidebarItems.find((item) => item.title.toLowerCase() === activeTab)
                ?.content
            }
          </div>
        </div>
      </div>
    </NotificationProvider>
  );
}

export default Dashboard;
