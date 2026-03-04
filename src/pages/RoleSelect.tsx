import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { User, Store } from "lucide-react";
import mascotImage from "@/assets/mascot-cutesy.png";

const RoleSelect = () => {
  const navigate = useNavigate();

  const handleRoleSelect = (role: "user" | "merchant") => {
    localStorage.setItem("selectedRole", role);
    navigate(role === "merchant" ? "/merchant-auth" : "/auth");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background flex flex-col items-center justify-center p-6">
      {/* Mascot with speech bubble */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center mb-8"
      >
        <div className="relative">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="absolute -top-16 left-1/2 -translate-x-1/2 bg-card px-4 py-2 rounded-2xl shadow-md border-2 border-border whitespace-nowrap"
          >
            <p className="text-primary font-medium text-sm">Which are you? ✨</p>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-card"></div>
          </motion.div>
          <img
            src={mascotImage}
            alt="Mascot"
            className="w-32 h-32 object-contain mix-blend-multiply"
          />
        </div>
      </motion.div>

      {/* Role selection cards */}
      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleRoleSelect("user")}
          className="flex-1 bg-card rounded-3xl p-6 shadow-lg border-2 border-border hover:border-primary transition-all group"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <User className="w-8 h-8 text-primary" />
            </div>
            <span className="text-lg font-semibold text-foreground">User</span>
            <p className="text-sm text-muted-foreground text-center">
              Looking to explore and connect
            </p>
          </div>
        </motion.button>

        <motion.button
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleRoleSelect("merchant")}
          className="flex-1 bg-card rounded-3xl p-6 shadow-lg border-2 border-border hover:border-primary transition-all group"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Store className="w-8 h-8 text-primary" />
            </div>
            <span className="text-lg font-semibold text-foreground">Merchant</span>
            <p className="text-sm text-muted-foreground text-center">
              Offering services or experiences
            </p>
          </div>
        </motion.button>
      </div>
    </div>
  );
};

export default RoleSelect;
