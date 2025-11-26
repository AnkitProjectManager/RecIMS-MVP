import React from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { recims } from "@/api/recimsClient";

export default function Home() {
  const navigate = useNavigate();

  React.useEffect(() => {
    const redirect = async () => {
      try {
        const user = await recims.auth.me();
        if (user) {
          navigate(createPageUrl("Dashboard"));
        }
      } catch (error) {
        navigate(createPageUrl("Dashboard"));
      }
    };
    redirect();
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading RecIMS...</p>
      </div>
    </div>
  );
}