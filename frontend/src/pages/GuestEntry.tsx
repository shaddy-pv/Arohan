import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingSpinner } from "@/components/LoadingSpinner";

const GuestEntry = () => {
  const { continueAsGuest } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    continueAsGuest();
    navigate("/dashboard", { replace: true });
  }, [continueAsGuest, navigate]);

  return <LoadingSpinner fullScreen message="Entering AROHAN Guest Mode..." />;
};

export default GuestEntry;
